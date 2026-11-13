// Reply shapes and DB calls for api/admin/preapproved.js and api/admin/users.js.
// Run with `npm test` (tests/api/index.js installs the fake Supabase first).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { fake } from './helpers/fake-supabase.js';
import { callHandler } from './helpers/http.js';
import { expectReply, MESSAGE_SHAPE } from './helpers/shape.js';
import { admin, IDS, sessionAs, SESSION_HEADERS, SESSION_LOOKUP, EARLIER_TIME, LATER_TIME } from './helpers/fixtures.js';

import preapproved from '../../api/admin/preapproved.js';
import users from '../../api/admin/users.js';

// Admin list of pre-approved emails: list, add (a new email, or an already approved user) and remove.
describe('api/admin/preapproved.js', () => {
    // Lists the pre-approved rows newest first; the rows pass straight through to the reply.
    test('GET: list pre-approved users', async () => {
        fake.reset([
            sessionAs(admin()),
            {
                table: 'gftvhello_users_preapproved',
                operation: 'select',
                reply: {
                    data: [
                        {
                            id: IDS.preapproved, email: 'invited@example.com', preapproved_role: 'editor',
                            user_id: IDS.other, preapproved_at: EARLIER_TIME, activated_at: LATER_TIME,
                        },
                    ],
                },
            },
        ]);
        const reply = await callHandler(preapproved, { method: 'GET', url: '/api/admin/preapproved', headers: SESSION_HEADERS });
        expectReply(reply, 200, {
            success: 'boolean',
            preapproved: [{
                id: 'string', email: 'string', preapproved_role: 'string', user_id: 'string',
                preapproved_at: 'string', activated_at: 'string',
            }],
        });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users_preapproved).select("id, email, preapproved_role, user_id, preapproved_at, activated_at").order(preapproved_at,{ascending:false})',
        ]);
    });

    test('POST: pre-approve a new email', async () => {
        fake.reset([sessionAs(admin())]);
        const reply = await callHandler(preapproved, {
            method: 'POST', url: '/api/admin/preapproved', headers: SESSION_HEADERS,
            body: { email: ' New.Person@Example.com ', role: 'viewer' },
        });
        expectReply(reply, 201, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users_preapproved).select("id").eq(email).maybeSingle()',
            'from(gftvhello_users).select("id, is_approved").eq(email).maybeSingle()',
            'from(gftvhello_users_preapproved).insert({email,preapproved_by,preapproved_role})',
        ]);
        assert.deepStrictEqual(fake.find('gftvhello_users_preapproved', 'insert').payload, {
            email: 'new.person@example.com', preapproved_role: 'viewer', preapproved_by: IDS.admin,
        });
    });

    test('POST: pre-approve an already approved user (linked at once)', async () => {
        fake.reset([
            sessionAs(admin()),
            { table: 'gftvhello_users', operation: 'select', reply: { data: { id: IDS.other, is_approved: true } } },
        ]);
        const reply = await callHandler(preapproved, {
            method: 'POST', url: '/api/admin/preapproved', headers: SESSION_HEADERS,
            body: { email: 'other.user@example.com', role: 'editor' },
        });
        expectReply(reply, 201, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users_preapproved).select("id").eq(email).maybeSingle()',
            'from(gftvhello_users).select("id, is_approved").eq(email).maybeSingle()',
            'from(gftvhello_users_preapproved).insert({activated_at,email,preapproved_by,preapproved_role,user_id})',
        ]);
    });

    test('DELETE: remove a pre-approval', async () => {
        fake.reset([sessionAs(admin())]);
        const reply = await callHandler(preapproved, {
            method: 'DELETE', url: `/api/admin/preapproved?id=${IDS.preapproved}`, headers: SESSION_HEADERS,
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, 'from(gftvhello_users_preapproved).delete().eq(id)']);
    });
});

// Admin user management: list, every PUT action, and delete. Most PUT actions look up the target user, update it, then sync the pre-approved list.
describe('api/admin/users.js', () => {
    const TARGET_LOOKUP = 'from(gftvhello_users).select("email, is_approved").eq(id).single()';
    const targetRule = {
        table: 'gftvhello_users', operation: 'select', columns: 'email, is_approved',
        reply: { data: { email: 'viewer.one@example.com', is_approved: true } },
    };

    function put(body) {
        return callHandler(users, { method: 'PUT', url: '/api/admin/users', headers: SESSION_HEADERS, body });
    }

    // Lists users newest first, with the nine public columns.
    test('GET: list users', async () => {
        fake.reset([
            sessionAs(admin()),
            {
                table: 'gftvhello_users',
                operation: 'select',
                reply: {
                    data: [{
                        id: IDS.viewer, username: 'viewer_one', display_name: 'Viewer One', email: 'viewer.one@example.com',
                        is_admin: false, is_approved: true, is_editor: false, avatar_url: null, created_at: EARLIER_TIME,
                    }],
                },
            },
        ]);
        const reply = await callHandler(users, { method: 'GET', url: '/api/admin/users', headers: SESSION_HEADERS });
        expectReply(reply, 200, {
            success: 'boolean',
            users: [{
                id: 'string', username: 'string', display_name: 'string', email: 'string', is_admin: 'boolean',
                is_approved: 'boolean', is_editor: 'boolean', avatar_url: 'null', created_at: 'string',
            }],
        });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users).select("id, username, display_name, email, is_admin, is_approved, is_editor, avatar_url, created_at").order(created_at,{ascending:false})',
        ]);
    });

    for (const action of ['grant_editor', 'grant_viewer']) {
        test(`PUT ${action}`, async () => {
            fake.reset([sessionAs(admin()), targetRule]);
            const reply = await put({ user_id: IDS.viewer, action });
            expectReply(reply, 200, MESSAGE_SHAPE);
            assert.deepStrictEqual(fake.log(), [
                SESSION_LOOKUP,
                TARGET_LOOKUP,
                'from(gftvhello_users).update({is_approved,is_editor,updated_at}).eq(id)',
                'from(gftvhello_users_preapproved).update({activated_at,user_id}).eq(email).is(user_id,null)',
            ]);
        });
    }

    test('PUT revoke_editor', async () => {
        fake.reset([sessionAs(admin()), targetRule]);
        const reply = await put({ user_id: IDS.viewer, action: 'revoke_editor' });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            TARGET_LOOKUP,
            'from(gftvhello_users).update({is_editor,updated_at}).eq(id)',
        ]);
    });

    test('PUT revoke_viewer', async () => {
        fake.reset([sessionAs(admin()), targetRule]);
        const reply = await put({ user_id: IDS.viewer, action: 'revoke_viewer' });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            TARGET_LOOKUP,
            'from(gftvhello_users).update({is_approved,is_editor,updated_at}).eq(id)',
            'from(gftvhello_users_preapproved).update({activated_at,user_id}).eq(email)',
        ]);
    });

    test('PUT toggle_admin', async () => {
        fake.reset([
            sessionAs(admin()),
            { table: 'gftvhello_users', operation: 'select', columns: 'is_admin', reply: { data: { is_admin: false } } },
            targetRule,
        ]);
        const reply = await put({ user_id: IDS.viewer, action: 'toggle_admin' });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users).select("is_admin").eq(id).single()',
            TARGET_LOOKUP,
            'from(gftvhello_users).update({is_admin,updated_at}).eq(id)',
        ]);
        assert.equal(fake.find('gftvhello_users', 'update').payload.is_admin, true);
    });

    test('PUT update_details', async () => {
        fake.reset([sessionAs(admin()), targetRule]);
        const reply = await put({
            user_id: IDS.viewer, action: 'update_details',
            username: 'Renamed_User', display_name: ' Renamed User ', email: 'Renamed.User@Example.com',
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users).select("id").eq(username).single()',
            'from(gftvhello_users).select("id").eq(email).single()',
            TARGET_LOOKUP,
            'from(gftvhello_users).update({display_name,email,updated_at,username}).eq(id)',
        ]);
        const detailUpdates = { ...fake.find('gftvhello_users', 'update').payload };
        delete detailUpdates.updated_at;
        assert.deepStrictEqual(detailUpdates, {
            username: 'renamed_user', display_name: 'Renamed User', email: 'renamed.user@example.com',
        });
    });

    test('PUT reset_password', async () => {
        fake.reset([sessionAs(admin())]);
        const reply = await put({ user_id: IDS.viewer, action: 'reset_password' });
        expectReply(reply, 200, { success: 'boolean', message: 'string', password: 'string' });
        assert.match(reply.json.password, /^[A-Za-z0-9]{16}$/);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvhello_users).update({password_hash,updated_at}).eq(id)',
        ]);
        const { password_hash: passwordHash } = fake.find('gftvhello_users', 'update').payload;
        assert.ok(await bcrypt.compare(reply.json.password, passwordHash), 'stored hash matches the returned password');
    });

    test('DELETE: delete a user', async () => {
        fake.reset([sessionAs(admin())]);
        const reply = await callHandler(users, {
            method: 'DELETE', url: `/api/admin/users?user_id=${IDS.viewer}`, headers: SESSION_HEADERS,
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, 'from(gftvhello_users).delete().eq(id)']);
    });
});
