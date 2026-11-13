// Edge redirect (api/redirect/[slug].js) and the public v1 API (api/v1/links/index.js, [slug].js).
// The redirect handler is Edge-style (Request -> Response) and uses lib/supabase.js, so it gets the
// same fake client; no fetch stub is needed. Run with `npm test`.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fake } from './helpers/fake-supabase.js';
import { callHandler } from './helpers/http.js';
import { expectReply } from './helpers/shape.js';
import {
    API_KEY_HEADERS, apiKeyAs, API_KEY_LOOKUP, editor, IDS, linkRow, v1LinkRow, V1_LINK_COLUMNS, V1_LINK_SHAPE,
} from './helpers/fixtures.js';

import redirect, { config as redirectConfig } from '../../api/redirect/[slug].js';
import v1Index from '../../api/v1/links/index.js';
import v1BySlug from '../../api/v1/links/[slug].js';

// The handler's FALLBACK is 'https://globalfurrytv.news.blog'; Response.redirect() normalises it
// through new URL(), which adds the trailing slash.
const FALLBACK = 'https://globalfurrytv.news.blog/';
const IPHONE_USER_AGENT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';

// The short link redirect: an active link goes to its destination, anything else to the fallback.
describe('api/redirect/[slug].js', () => {
    const LOOKUP = 'from(gftvlinks_links).select("id, destination, is_active").eq(slug).single()';

    function visit(slug) {
        return redirect(new Request(`https://gftv.asia/${slug}`, { headers: { 'user-agent': IPHONE_USER_AGENT } }));
    }

    test('stays on the Edge runtime', () => {
        assert.deepStrictEqual(redirectConfig, { runtime: 'edge' });
    });

    test('active link: 302 to its destination, visit recorded', async () => {
        fake.reset([
            {
                table: 'gftvlinks_links', operation: 'select', eq: { slug: 'test-link' },
                reply: { data: { id: IDS.link, destination: 'https://example.com/landing', is_active: true } },
            },
        ]);
        const response = await visit('test-link');
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), 'https://example.com/landing');
        assert.deepStrictEqual(fake.log(), [LOOKUP, 'rpc(record_link_visit,{p_device_type,p_link_id,p_slug})']);
        assert.deepStrictEqual(fake.calls[1].parameters, { p_link_id: IDS.link, p_slug: 'test-link', p_device_type: 'Mobile' });
    });

    test('inactive link: 302 to the fallback, no visit recorded', async () => {
        fake.reset([
            {
                table: 'gftvlinks_links', operation: 'select',
                reply: { data: { id: IDS.link, destination: 'https://example.com/landing', is_active: false } },
            },
        ]);
        const response = await visit('test-link');
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), FALLBACK);
        assert.deepStrictEqual(fake.log(), [LOOKUP]);
    });

    test('unknown slug: 302 to the fallback', async () => {
        fake.reset([]);
        const response = await visit('no-such-link');
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('location'), FALLBACK);
        assert.deepStrictEqual(fake.log(), [LOOKUP]);
    });
});

// Public v1 API, authenticated by API key: list my links, or create one.
describe('api/v1/links/index.js', () => {
    test('GET: my links, with slug and tag filters and paging', async () => {
        fake.reset([
            apiKeyAs(editor()),
            { table: 'gftvlinks_links', operation: 'select', reply: { data: [v1LinkRow()] } },
        ]);
        const reply = await callHandler(v1Index, {
            method: 'GET', url: '/api/v1/links?slug=test&tag=events&limit=10&offset=5', headers: API_KEY_HEADERS,
        });
        expectReply(reply, 200, { success: 'boolean', links: [V1_LINK_SHAPE], count: 'number' });
        assert.equal(reply.json.count, 1);
        assert.deepStrictEqual(fake.log(), [
            API_KEY_LOOKUP,
            `from(gftvlinks_links).select("${V1_LINK_COLUMNS}").eq(user_id).order(created_at,{ascending:false}).range(5,14).ilike(slug).contains(tags)`,
        ]);
    });

    test('POST: create a link', async () => {
        fake.reset([
            apiKeyAs(editor()),
            {
                table: 'gftvlinks_links', operation: 'insert',
                reply: { data: v1LinkRow({ slug: 'api-link', destination: 'https://example.com/api', access_count: 0 }) },
            },
        ]);
        const reply = await callHandler(v1Index, {
            method: 'POST', url: '/api/v1/links', headers: API_KEY_HEADERS,
            body: { slug: 'api-link', destination: 'https://example.com/api', tags: ['events'] },
        });
        expectReply(reply, 201, { success: 'boolean', link: V1_LINK_SHAPE });
        assert.deepStrictEqual(fake.log(), [
            API_KEY_LOOKUP,
            `from(gftvlinks_links).insert({destination,slug,tags,user_id}).select("${V1_LINK_COLUMNS}").single()`,
        ]);
    });
});

// Public v1 API, authenticated by API key: read any link by slug, or update one I own.
describe('api/v1/links/[slug].js', () => {
    const LOOKUP = `from(gftvlinks_links).select("${V1_LINK_COLUMNS}, user_id").eq(slug).single()`;
    const linkRule = { table: 'gftvlinks_links', operation: 'select', eq: { slug: 'test-link' }, reply: { data: linkRow() } };

    test('GET: one link, without user_id', async () => {
        fake.reset([apiKeyAs(editor()), linkRule]);
        const reply = await callHandler(v1BySlug, { method: 'GET', url: '/api/v1/links/test-link', headers: API_KEY_HEADERS });
        expectReply(reply, 200, { success: 'boolean', link: V1_LINK_SHAPE });
        assert.deepStrictEqual(fake.log(), [API_KEY_LOOKUP, LOOKUP]);
    });

    test('PUT: update destination, is_active and tags', async () => {
        fake.reset([
            apiKeyAs(editor()),
            linkRule,
            {
                table: 'gftvlinks_links', operation: 'update',
                reply: { data: v1LinkRow({ destination: 'https://example.org/moved', is_active: false, tags: ['promo'] }) },
            },
        ]);
        const reply = await callHandler(v1BySlug, {
            method: 'PUT', url: '/api/v1/links/test-link', headers: API_KEY_HEADERS,
            body: { destination: 'https://example.org/moved', is_active: false, tags: ['promo'] },
        });
        expectReply(reply, 200, { success: 'boolean', link: V1_LINK_SHAPE });
        assert.deepStrictEqual(fake.log(), [
            API_KEY_LOOKUP,
            LOOKUP,
            `from(gftvlinks_links).update({destination,is_active,tags,updated_at}).eq(id).select("${V1_LINK_COLUMNS}").single()`,
        ]);
    });
});
