// Reply shapes and DB calls for api/profile/avatar.js, delete.js, trusted-devices.js, update.js
// and views.js. Run with `npm test` (tests/api/index.js installs the fake Supabase first).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { fake } from './helpers/fake-supabase.js';
import { callHandler } from './helpers/http.js';
import { expectReply, MESSAGE_SHAPE } from './helpers/shape.js';
import {
    editor, FAKE_SUPABASE_URL, FAR_FUTURE, IDS, NEW_PASSWORD, PASSWORD, sessionAs, SESSION_HEADERS,
    SESSION_LOOKUP, EARLIER_TIME,
} from './helpers/fixtures.js';

import avatar from '../../api/profile/avatar.js';
import profileDelete from '../../api/profile/delete.js';
import trustedDevices from '../../api/profile/trusted-devices.js';
import profileUpdate from '../../api/profile/update.js';
import views from '../../api/profile/views.js';

describe('api/profile/avatar.js', () => {
    test('POST: upload a webp avatar', async () => {
        fake.reset([sessionAs(editor())]);
        const image = 'data:image/webp;base64,' + Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 fake').toString('base64');
        const reply = await callHandler(avatar, {
            method: 'POST', url: '/api/profile/avatar', headers: SESSION_HEADERS, body: { image_base64: image },
        });
        expectReply(reply, 200, { success: 'boolean', avatar_url: 'string' });
        const file = `${IDS.editor}.webp`;
        assert.equal(reply.json.avatar_url, `${FAKE_SUPABASE_URL}/storage/v1/object/public/gftvhello_avatars/${file}`);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            `storage.from(gftvhello_avatars).upload(${file},{contentType:image/webp,upsert:true})`,
            `storage.from(gftvhello_avatars).getPublicUrl(${file})`,
            'from(gftvhello_users).update({avatar_url,updated_at}).eq(id)',
        ]);
    });
});

describe('api/profile/delete.js', () => {
    test('DELETE: correct password deletes the account', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(profileDelete, {
            method: 'DELETE', url: '/api/profile/delete', headers: SESSION_HEADERS, body: { password: PASSWORD },
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, 'from(gftvhello_users).delete().eq(id)']);
    });
});

// List my trusted 2FA devices, or remove one.
describe('api/profile/trusted-devices.js', () => {
    test('GET: list my trusted devices', async () => {
        fake.reset([
            sessionAs(editor()),
            {
                table: 'gftvhello_trusted_devices', operation: 'select',
                reply: { data: [{ id: IDS.device, created_at: EARLIER_TIME, expires_at: FAR_FUTURE }] },
            },
        ]);
        const reply = await callHandler(trustedDevices, {
            method: 'GET', url: '/api/profile/trusted-devices', headers: SESSION_HEADERS,
        });
        expectReply(reply, 200, {
            success: 'boolean', devices: [{ id: 'string', created_at: 'string', expires_at: 'string' }],
        });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_trusted_devices).select("id, created_at, expires_at").eq(user_id).order(created_at,{ascending:false})',
        ]);
    });

    test('DELETE: remove one device (id from req.query)', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(trustedDevices, {
            method: 'DELETE', url: `/api/profile/trusted-devices?id=${IDS.device}`, headers: SESSION_HEADERS,
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_trusted_devices).delete().eq(id).eq(user_id)',
        ]);
    });
});

describe('api/profile/update.js', () => {
    test('PUT: display name, social links, avatar and password', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(profileUpdate, {
            method: 'PUT', url: '/api/profile/update', headers: SESSION_HEADERS,
            body: {
                display_name: ' Editor Renamed ',
                social_links: [{ label: 'Website', url: 'https://example.com/renamed' }],
                avatar_url: 'https://example.com/avatar.webp',
                new_password: NEW_PASSWORD,
                current_password: PASSWORD,
            },
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users).update({avatar_url,display_name,password_hash,social_links,updated_at}).eq(id)',
        ]);
        const payload = fake.find('gftvhello_users', 'update').payload;
        assert.equal(payload.display_name, 'Editor Renamed');
        assert.ok(await bcrypt.compare(NEW_PASSWORD, payload.password_hash), 'new password is hashed');
    });
});

// Profile views: record a view (never of myself) and list a profile's recent viewers.
describe('api/profile/views.js', () => {
    test('POST: record a view of another profile', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(views, {
            method: 'POST', url: '/api/profile/views', headers: SESSION_HEADERS, body: { viewed_id: IDS.other },
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.equal(reply.json.message, 'View recorded');
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_profileviews).upsert({viewed_at,viewed_id,viewer_id},{onConflict:viewer_id,viewed_id})',
        ]);
    });

    test('POST: self-view is not recorded', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(views, {
            method: 'POST', url: '/api/profile/views', headers: SESSION_HEADERS, body: { viewed_id: IDS.editor },
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.equal(reply.json.message, 'Self-view not tracked');
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP]);
    });

    test('GET: recent viewers of a profile', async () => {
        fake.reset([
            sessionAs(editor()),
            {
                table: 'gftvlinks_profileviews', operation: 'select',
                reply: {
                    data: [{
                        viewed_at: EARLIER_TIME,
                        viewer: { id: IDS.other, username: 'other_user', display_name: 'Other User', avatar_url: null },
                    }],
                },
            },
        ]);
        const reply = await callHandler(views, {
            method: 'GET', url: `/api/profile/views?profile_id=${IDS.editor}`, headers: SESSION_HEADERS,
        });
        expectReply(reply, 200, {
            success: 'boolean',
            viewers: [{ id: 'string', username: 'string', display_name: 'string', avatar_url: 'null', viewed_at: 'string' }],
        });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_profileviews).select("viewed_at, viewer:viewer_id(id, username, display_name, avatar_url)").eq(viewed_id).neq(viewer_id).order(viewed_at,{ascending:false}).limit(5)',
        ]);
    });
});
