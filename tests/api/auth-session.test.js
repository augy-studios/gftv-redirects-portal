// Reply shapes and DB calls for api/auth/login.js, register.js, logout.js, logout-all.js and me.js.
// Run with `npm test` (tests/api/index.js installs the fake Supabase first).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fake } from './helpers/fake-supabase.js';
import { callHandler } from './helpers/http.js';
import { expectReply, MESSAGE_SHAPE } from './helpers/shape.js';
import {
    DEVICE_TOKEN, editor, editorWith2fa, IDS, NEW_PASSWORD, PASSWORD, PUBLIC_USER_SHAPE,
    sessionAs, SESSION_HEADERS, SESSION_LOOKUP, SESSION_TOKEN, EARLIER_TIME,
} from './helpers/fixtures.js';

import login from '../../api/auth/login.js';
import register from '../../api/auth/register.js';
import logout from '../../api/auth/logout.js';
import logoutAll from '../../api/auth/logout-all.js';
import me from '../../api/auth/me.js';

const USER_BY_NAME = 'from(gftvhello_users).select("*").or("username.eq.editor_one,email.eq.editor_one").single()';
const SESSION_INSERT = 'from(gftvhello_sessions).insert({expires_at,token,user_id})';

// Login has three normal paths: no 2FA, 2FA from an untrusted device (a challenge), and 2FA from a trusted device.
describe('api/auth/login.js', () => {
    test('POST: no 2FA, session created', async () => {
        fake.reset([{ table: 'gftvhello_users', operation: 'select', reply: { data: editor() } }]);
        const reply = await callHandler(login, {
            method: 'POST', url: '/api/auth/login',
            body: { username: 'Editor_One', password: PASSWORD, remember: true },
        });
        expectReply(reply, 200, { success: 'boolean', token: 'string', user: PUBLIC_USER_SHAPE, remember: 'boolean' });
        assert.equal(reply.json.user.totp_enabled, false);
        assert.equal(reply.json.remember, true);
        assert.deepStrictEqual(fake.log(), [USER_BY_NAME, SESSION_INSERT]);
        assert.equal(fake.find('gftvhello_sessions', 'insert').payload.token, reply.json.token);
    });

    test('POST: 2FA on, device not trusted, challenge issued', async () => {
        fake.reset([{ table: 'gftvhello_users', operation: 'select', reply: { data: editorWith2fa() } }]);
        const reply = await callHandler(login, {
            method: 'POST', url: '/api/auth/login', body: { username: 'editor_one', password: PASSWORD },
        });
        expectReply(reply, 200, {
            success: 'boolean', requires_2fa: 'boolean', challenge_token: 'string', username: 'string',
        });
        assert.deepStrictEqual(fake.log(), [
            USER_BY_NAME,
            'from(gftvhello_totp_challenges).insert({expires_at,token,user_id})',
        ]);
        assert.equal(fake.find('gftvhello_totp_challenges', 'insert').payload.token, reply.json.challenge_token);
    });

    test('POST: 2FA on, trusted device, session created', async () => {
        fake.reset([
            { table: 'gftvhello_users', operation: 'select', reply: { data: editorWith2fa() } },
            {
                table: 'gftvhello_trusted_devices', operation: 'select', eq: { device_token: DEVICE_TOKEN },
                reply: { data: { id: IDS.device } },
            },
        ]);
        const reply = await callHandler(login, {
            method: 'POST', url: '/api/auth/login',
            body: { username: 'editor_one', password: PASSWORD, device_token: DEVICE_TOKEN },
        });
        expectReply(reply, 200, { success: 'boolean', token: 'string', user: PUBLIC_USER_SHAPE, remember: 'boolean' });
        assert.equal(reply.json.user.totp_enabled, true);
        assert.equal(reply.json.remember, false);
        assert.deepStrictEqual(fake.log(), [
            USER_BY_NAME,
            'from(gftvhello_trusted_devices).select("id").eq(user_id).eq(device_token).gt(expires_at).single()',
            SESSION_INSERT,
        ]);
    });
});

// Register checks for duplicates and a pre-approval, then inserts the user; a pre-approved user also gets a session.
describe('api/auth/register.js', () => {
    const body = {
        username: 'New_User', display_name: 'New User', email: 'new.user@example.com', password: NEW_PASSWORD,
    };
    const newUserRow = {
        id: IDS.other, username: 'new_user', display_name: 'New User', email: 'new.user@example.com',
        is_admin: false, is_approved: false, is_editor: false, avatar_url: null, created_at: EARLIER_TIME,
    };
    const BASE_LOG = [
        'from(gftvhello_users).select("id").or("username.eq.New_User,email.eq.new.user@example.com").limit(1)',
        'from(gftvhello_users_preapproved).select("id, preapproved_role").eq(email).is(user_id,null).maybeSingle()',
        'from(gftvhello_users).insert({display_name,email,is_admin,is_approved,is_editor,password_hash,username}).select("id, username, display_name, email, is_admin, is_approved, is_editor, avatar_url, created_at").single()',
    ];

    test('POST: new account waiting for approval', async () => {
        fake.reset([
            { table: 'gftvhello_users', operation: 'select', reply: { data: [] } },
            { table: 'gftvhello_users', operation: 'insert', reply: { data: newUserRow } },
        ]);
        const reply = await callHandler(register, { method: 'POST', url: '/api/auth/register', body });
        expectReply(reply, 201, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), BASE_LOG);
    });

    // A pre-approved email is approved at once, linked to its pre-approval row and logged in.
    test('POST: pre-approved account, logged in at once', async () => {
        fake.reset([
            { table: 'gftvhello_users', operation: 'select', reply: { data: [] } },
            {
                table: 'gftvhello_users_preapproved', operation: 'select',
                reply: { data: { id: IDS.preapproved, preapproved_role: 'editor' } },
            },
            {
                table: 'gftvhello_users', operation: 'insert',
                reply: { data: { ...newUserRow, is_approved: true, is_editor: true } },
            },
        ]);
        const reply = await callHandler(register, { method: 'POST', url: '/api/auth/register', body });
        expectReply(reply, 201, {
            success: 'boolean',
            message: 'string',
            preapproved: 'boolean',
            preapproved_role: 'string',
            token: 'string',
            user: {
                id: 'string', username: 'string', display_name: 'string', email: 'string', is_admin: 'boolean',
                is_approved: 'boolean', is_editor: 'boolean', avatar_url: 'null', created_at: 'string',
                totp_enabled: 'boolean',
            },
        });
        assert.deepStrictEqual(fake.log(), [
            ...BASE_LOG,
            'from(gftvhello_users_preapproved).update({activated_at,user_id}).eq(id)',
            SESSION_INSERT,
        ]);
        const insertedUser = fake.find('gftvhello_users', 'insert').payload;
        assert.equal(insertedUser.is_approved, true);
        assert.equal(insertedUser.is_editor, true);
    });
});

describe('api/auth/logout.js', () => {
    test('POST: deletes the current session', async () => {
        fake.reset([]);
        const reply = await callHandler(logout, { method: 'POST', url: '/api/auth/logout', headers: SESSION_HEADERS });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), ['from(gftvhello_sessions).delete().eq(token)']);
        assert.deepStrictEqual(fake.calls[0].steps[0].argumentsList, ['token', SESSION_TOKEN]);
    });
});

describe('api/auth/logout-all.js', () => {
    test('POST: deletes every session of the user', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(logoutAll, { method: 'POST', url: '/api/auth/logout-all', headers: SESSION_HEADERS });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, 'from(gftvhello_sessions).delete().eq(user_id)']);
    });
});

describe('api/auth/me.js', () => {
    test('GET: current user without secrets', async () => {
        fake.reset([sessionAs(editorWith2fa())]);
        const reply = await callHandler(me, { method: 'GET', url: '/api/auth/me', headers: SESSION_HEADERS });
        expectReply(reply, 200, { success: 'boolean', user: PUBLIC_USER_SHAPE });
        assert.equal(reply.json.user.totp_enabled, true);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP]);
    });
});
