// Reply shapes and DB calls for api/stats.js and api/apikeys.js.
// Run with `npm test` (tests/api/index.js installs the fake Supabase first).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fake } from './helpers/fake-supabase.js';
import { callHandler } from './helpers/http.js';
import { expectReply } from './helpers/shape.js';
import { editor, sessionAs, SESSION_HEADERS, SESSION_LOOKUP, EARLIER_TIME, LATER_TIME } from './helpers/fixtures.js';

import stats from '../../api/stats.js';
import apikeys from '../../api/apikeys.js';

// Public counts: approved editors and admins, links, and total clicks.
describe('api/stats.js', () => {
    // Three queries run in parallel; clicks is the sum of access_count.
    test('GET: public counts', async () => {
        fake.reset([
            { table: 'gftvhello_users', operation: 'select', reply: { count: 3 } },
            {
                table: 'gftvlinks_links',
                operation: 'select',
                // The head-only select counts the links; the other one sums access_count.
                reply: (call) => {
                    let cannedReply;
                    if (call.selectOptions?.head) {
                        cannedReply = { count: 2 };
                    } else {
                        cannedReply = { data: [{ access_count: 5 }, { access_count: 7 }] };
                    }
                    return cannedReply;
                },
            },
        ]);
        const reply = await callHandler(stats, { method: 'GET', url: '/api/stats' });
        expectReply(reply, 200, { success: 'boolean', officers: 'number', links: 'number', clicks: 'number' });
        assert.deepStrictEqual(reply.json, { success: true, officers: 3, links: 2, clicks: 12 });
        assert.deepStrictEqual(fake.log(), [
            'from(gftvhello_users).select("*", {count:exact,head:true}).eq(is_approved).or("is_editor.eq.true,is_admin.eq.true")',
            'from(gftvlinks_links).select("*", {count:exact,head:true})',
            'from(gftvlinks_links).select("access_count")',
        ]);
    });
});

// My API key: read it (or null when there is none), and generate a new one.
describe('api/apikeys.js', () => {
    test('GET: existing key', async () => {
        fake.reset([
            sessionAs(editor()),
            {
                table: 'gftvlinks_api_keys',
                operation: 'select',
                columns: 'api_key, created_at, updated_at',
                reply: { data: { api_key: 'gftv_test_api_key_0001', created_at: EARLIER_TIME, updated_at: LATER_TIME } },
            },
        ]);
        const reply = await callHandler(apikeys, { method: 'GET', url: '/api/apikeys', headers: SESSION_HEADERS });
        expectReply(reply, 200, { success: 'boolean', api_key: 'string', created_at: 'string', updated_at: 'string' });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_api_keys).select("api_key, created_at, updated_at").eq(user_id).single()',
        ]);
    });

    test('GET: no key yet', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(apikeys, { method: 'GET', url: '/api/apikeys', headers: SESSION_HEADERS });
        expectReply(reply, 200, { success: 'boolean', api_key: 'null' });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_api_keys).select("api_key, created_at, updated_at").eq(user_id).single()',
        ]);
    });

    test('POST: generate a key', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(apikeys, { method: 'POST', url: '/api/apikeys', headers: SESSION_HEADERS });
        expectReply(reply, 201, { success: 'boolean', api_key: 'string' });
        assert.match(reply.json.api_key, /^gftv_[0-9a-f]{64}$/);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_api_keys).upsert({api_key,updated_at,user_id},{onConflict:user_id})',
        ]);
        assert.equal(fake.find('gftvlinks_api_keys', 'upsert').payload.api_key, reply.json.api_key);
    });
});
