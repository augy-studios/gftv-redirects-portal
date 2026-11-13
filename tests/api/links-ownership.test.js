// Reply shapes and DB calls for api/links/[id].js, analytics.js, index.js, mine.js and
// api/ownership/[id].js, index.js.
// Run with `npm test` (tests/api/index.js installs the fake Supabase first).

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fake } from './helpers/fake-supabase.js';
import { callHandler } from './helpers/http.js';
import { expectReply, MESSAGE_SHAPE } from './helpers/shape.js';
import { editor, IDS, linkRow, sessionAs, SESSION_HEADERS, SESSION_LOOKUP, EARLIER_TIME, LATER_TIME } from './helpers/fixtures.js';

import linkById from '../../api/links/[id].js';
import analytics from '../../api/links/analytics.js';
import linksIndex from '../../api/links/index.js';
import mine from '../../api/links/mine.js';
import ownershipById from '../../api/ownership/[id].js';
import ownershipIndex from '../../api/ownership/index.js';

const LINK_ROW_SHAPE = {
    id: 'string', slug: 'string', destination: 'string', user_id: 'string', is_active: 'boolean',
    access_count: 'number', tags: ['string'], created_at: 'string', updated_at: 'string',
};

// Edit or delete one link, found by the id at the end of the URL path.
describe('api/links/[id].js', () => {
    const LINK_LOOKUP = 'from(gftvlinks_links).select("*").eq(id).single()';
    const linkRule = { table: 'gftvlinks_links', operation: 'select', eq: { id: IDS.link }, reply: { data: linkRow() } };

    test('PUT: edit every field and transfer ownership', async () => {
        fake.reset([
            sessionAs(editor()),
            linkRule,
            { table: 'gftvhello_users', operation: 'select', eq: { username: 'other_user' }, reply: { data: { id: IDS.other } } },
            { table: 'gftvlinks_links', operation: 'update', reply: { data: [{ id: IDS.link }] } },
        ]);
        const reply = await callHandler(linkById, {
            method: 'PUT', url: `/api/links/${IDS.link}`, headers: SESSION_HEADERS,
            body: {
                slug: 'renamed-link', destination: 'https://example.org/new', is_active: false,
                tags: ['events', 'promo'], new_owner_username: ' Other_User ',
            },
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            LINK_LOOKUP,
            'from(gftvhello_users).select("id").eq(username).single()',
            'from(gftvlinks_links).update({destination,is_active,slug,tags,updated_at,user_id}).eq(id).select("id")',
        ]);
        assert.equal(fake.find('gftvlinks_links', 'update').payload.user_id, IDS.other);
    });

    test('DELETE: remove the link', async () => {
        fake.reset([sessionAs(editor()), linkRule]);
        const reply = await callHandler(linkById, { method: 'DELETE', url: `/api/links/${IDS.link}`, headers: SESSION_HEADERS });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, LINK_LOOKUP, 'from(gftvlinks_links).delete().eq(id)']);
    });
});

// Analytics for one link: four RPCs and the history query, run in parallel.
describe('api/links/analytics.js', () => {
    // Every RPC reply passes straight through to its reply field.
    test('GET: analytics for an owned link', async () => {
        fake.reset([
            sessionAs(editor()),
            {
                table: 'gftvlinks_links', operation: 'select',
                reply: { data: { id: IDS.link, user_id: IDS.editor, access_count: 42 } },
            },
            { rpc: 'get_link_device_breakdown', reply: { data: [{ device_type: 'Mobile', cnt: 30 }] } },
            { rpc: 'get_link_daily_clicks', reply: { data: [{ day: '2026-01-01', cnt: 4 }] } },
            { rpc: 'get_link_all_daily_clicks', reply: { data: [{ day: '2026-01-01', cnt: 4 }] } },
            { rpc: 'get_link_traffic_heatmap', reply: { data: [{ dow: 4, hr: 13, cnt: 2 }] } },
            {
                table: 'gftvlinks_linkhistory', operation: 'select',
                reply: { data: [{ id: IDS.history, event_type: 'created', description: 'Link created', created_at: EARLIER_TIME }] },
            },
        ]);
        const reply = await callHandler(analytics, {
            method: 'GET', url: `/api/links/analytics?id=${IDS.link}`, headers: SESSION_HEADERS,
        });
        expectReply(reply, 200, {
            success: 'boolean',
            total_clicks: 'number',
            devices: [{ device_type: 'string', cnt: 'number' }],
            daily_clicks: [{ day: 'string', cnt: 'number' }],
            all_daily_clicks: [{ day: 'string', cnt: 'number' }],
            heatmap: [{ dow: 'number', hr: 'number', cnt: 'number' }],
            history: [{ id: 'string', event_type: 'string', description: 'string', created_at: 'string' }],
        });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_links).select("id, user_id, access_count").eq(id).single()',
            'rpc(get_link_device_breakdown,{p_link_id})',
            'rpc(get_link_daily_clicks,{p_link_id})',
            'rpc(get_link_all_daily_clicks,{p_link_id})',
            'rpc(get_link_traffic_heatmap,{p_link_id})',
            'from(gftvlinks_linkhistory).select("id, event_type, description, created_at").eq(link_id).order(created_at,{ascending:false})',
        ]);
    });
});

// The link directory (with keyword, tag and username search) and link creation.
describe('api/links/index.js', () => {
    const DIRECTORY_SELECT =
        'from(gftvlinks_links).select("id, slug, destination, is_active, access_count, tags, created_at, gftvhello_users(id, username, display_name, avatar_url, social_links, is_admin)").order(created_at,{ascending:false})';
    const owner = (id, username, displayName) => ({
        id, username, display_name: displayName, avatar_url: null,
        social_links: [{ label: 'Website', url: 'https://example.com/' + username }], is_admin: false,
    });
    const directoryRow = (id, slug, user) => ({
        id, slug, destination: `https://example.com/${slug}`, is_active: true, access_count: 7,
        tags: ['events'], created_at: EARLIER_TIME, gftvhello_users: user,
    });
    const directoryRule = {
        table: 'gftvlinks_links', operation: 'select',
        reply: {
            data: [
                directoryRow(IDS.link, 'test-link', owner(IDS.editor, 'editor_one', 'Editor One')),
                directoryRow(IDS.link2, 'other-link', owner(IDS.other, 'other_user', 'Other User')),
            ],
        },
    };
    const DIRECTORY_SHAPE = {
        success: 'boolean',
        links: [{
            id: 'string', slug: 'string', destination: 'string', is_active: 'boolean', access_count: 'number',
            tags: ['string'], created_at: 'string',
            gftvhello_users: {
                id: 'string', username: 'string', display_name: 'string', avatar_url: 'null',
                social_links: [{ label: 'string', url: 'string' }], is_admin: 'boolean',
            },
        }],
    };

    function get(query) {
        return callHandler(linksIndex, { method: 'GET', url: `/api/links${query}`, headers: SESSION_HEADERS });
    }

    test('GET: whole directory', async () => {
        fake.reset([sessionAs(editor()), directoryRule]);
        const reply = await get('');
        expectReply(reply, 200, DIRECTORY_SHAPE);
        assert.equal(reply.json.links.length, 2);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, DIRECTORY_SELECT]);
    });

    test('GET: keyword search', async () => {
        fake.reset([sessionAs(editor()), directoryRule]);
        const reply = await get('?q=promo');
        expectReply(reply, 200, DIRECTORY_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            DIRECTORY_SELECT + '.or("slug.ilike.%promo%,destination.ilike.%promo%")',
        ]);
    });

    test('GET: tag search', async () => {
        fake.reset([sessionAs(editor()), directoryRule]);
        const reply = await get('?q=events&type=tag');
        expectReply(reply, 200, DIRECTORY_SHAPE);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, DIRECTORY_SELECT + '.contains(tags)']);
    });

    test('GET: username search (filtered after the query)', async () => {
        fake.reset([sessionAs(editor()), directoryRule]);
        const reply = await get('?q=other&type=username');
        expectReply(reply, 200, DIRECTORY_SHAPE);
        assert.deepStrictEqual(reply.json.links.map(link => link.slug), ['other-link']);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, DIRECTORY_SELECT]);
    });

    test('POST: create a link', async () => {
        fake.reset([sessionAs(editor())]);
        const reply = await callHandler(linksIndex, {
            method: 'POST', url: '/api/links', headers: SESSION_HEADERS,
            body: { slug: 'new-link', destination: 'https://example.com/new', tags: ['events'] },
        });
        expectReply(reply, 201, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP, 'from(gftvlinks_links).insert({destination,slug,tags,user_id})']);
    });
});

describe('api/links/mine.js', () => {
    test('GET: my links', async () => {
        fake.reset([sessionAs(editor()), { table: 'gftvlinks_links', operation: 'select', reply: { data: [linkRow()] } }]);
        const reply = await callHandler(mine, { method: 'GET', url: '/api/links/mine', headers: SESSION_HEADERS });
        expectReply(reply, 200, { success: 'boolean', links: [LINK_ROW_SHAPE] });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_links).select("*").eq(user_id).order(created_at,{ascending:false})',
        ]);
    });
});

// The link owner approves or rejects an ownership request; approving moves the link.
describe('api/ownership/[id].js', () => {
    const requestRule = {
        table: 'gftvlinks_ownership_requests', operation: 'select', eq: { id: IDS.request },
        reply: {
            data: {
                id: IDS.request, link_id: IDS.link, requester_id: IDS.other, owner_id: IDS.editor,
                status: 'pending', created_at: EARLIER_TIME, updated_at: LATER_TIME,
            },
        },
    };
    const BASE_LOG = [
        SESSION_LOOKUP,
        'from(gftvlinks_ownership_requests).select("*").eq(id).single()',
        'from(gftvlinks_ownership_requests).update({status,updated_at}).eq(id)',
    ];

    test('PUT approve: request approved, link moves to the requester', async () => {
        fake.reset([sessionAs(editor()), requestRule]);
        const reply = await callHandler(ownershipById, {
            method: 'PUT', url: `/api/ownership/${IDS.request}`, headers: SESSION_HEADERS, body: { action: 'approve' },
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.equal(reply.json.message, 'Request approved');
        assert.deepStrictEqual(fake.log(), [...BASE_LOG, 'from(gftvlinks_links).update({updated_at,user_id}).eq(id)']);
        assert.equal(fake.find('gftvlinks_links', 'update').payload.user_id, IDS.other);
    });

    test('PUT reject: request rejected', async () => {
        fake.reset([sessionAs(editor()), requestRule]);
        const reply = await callHandler(ownershipById, {
            method: 'PUT', url: `/api/ownership/${IDS.request}`, headers: SESSION_HEADERS, body: { action: 'reject' },
        });
        expectReply(reply, 200, MESSAGE_SHAPE);
        assert.equal(reply.json.message, 'Request rejected');
        assert.deepStrictEqual(fake.log(), BASE_LOG);
    });
});

// Ownership requests: list the ones for my links, and ask for someone else's link.
describe('api/ownership/index.js', () => {
    // The reply nests the link and the requester under each request.
    test('GET: requests for links I own', async () => {
        fake.reset([
            sessionAs(editor()),
            {
                table: 'gftvlinks_ownership_requests', operation: 'select',
                reply: {
                    data: [{
                        id: IDS.request, status: 'pending', created_at: EARLIER_TIME,
                        gftvlinks_links: { id: IDS.link, slug: 'test-link', destination: 'https://example.com/landing' },
                        requester: { id: IDS.other, username: 'other_user', display_name: 'Other User', avatar_url: null },
                    }],
                },
            },
        ]);
        const reply = await callHandler(ownershipIndex, { method: 'GET', url: '/api/ownership', headers: SESSION_HEADERS });
        expectReply(reply, 200, {
            success: 'boolean',
            requests: [{
                id: 'string', status: 'string', created_at: 'string',
                gftvlinks_links: { id: 'string', slug: 'string', destination: 'string' },
                requester: { id: 'string', username: 'string', display_name: 'string', avatar_url: 'null' },
            }],
        });
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_ownership_requests).select("id, status, created_at, gftvlinks_links(id, slug, destination), requester:gftvhello_users!gftvlinks_ownership_requests_requester_id_fkey(id, username, display_name, avatar_url)").eq(owner_id).order(created_at,{ascending:false})',
        ]);
    });

    test('POST: request ownership of someone else\'s link', async () => {
        fake.reset([
            sessionAs(editor()),
            { table: 'gftvlinks_links', operation: 'select', eq: { id: IDS.link2 }, reply: { data: { user_id: IDS.other } } },
        ]);
        const reply = await callHandler(ownershipIndex, {
            method: 'POST', url: '/api/ownership', headers: SESSION_HEADERS, body: { link_id: IDS.link2 },
        });
        expectReply(reply, 201, MESSAGE_SHAPE);
        assert.deepStrictEqual(fake.log(), [
            SESSION_LOOKUP,
            'from(gftvlinks_links).select("user_id").eq(id).single()',
            'from(gftvlinks_ownership_requests).select("id").eq(link_id).eq(requester_id).eq(status).single()',
            'from(gftvlinks_ownership_requests).insert({link_id,owner_id,requester_id,status})',
        ]);
        assert.deepStrictEqual(fake.find('gftvlinks_ownership_requests', 'insert').payload, {
            link_id: IDS.link2, requester_id: IDS.editor, owner_id: IDS.other, status: 'pending',
        });
    });
});
