// Fixture rows for the API handler tests. Run the tests with `npm test`.
// Everything here is obviously fake: example.com addresses, made-up UUIDs, fixed timestamps,
// a test-only password and TOTP secret. The functions return fresh copies on every call.

import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export const EARLIER_TIME = '2026-01-01T00:00:00.000Z';
export const LATER_TIME = '2026-01-02T00:00:00.000Z';
export const FAR_FUTURE = '2099-01-01T00:00:00.000Z';

export const IDS = {
    editor: '11111111-1111-4111-8111-111111111111',
    admin: '22222222-2222-4222-8222-222222222222',
    viewer: '33333333-3333-4333-8333-333333333333',
    other: '44444444-4444-4444-8444-444444444444',
    link: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    link2: 'aaaaaaaa-aaaa-4aaa-8aaa-bbbbbbbbbbbb',
    request: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    preapproved: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    device: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    session: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    apiKeyRow: 'ffffffff-ffff-4fff-8fff-000000000001',
    history: 'ffffffff-ffff-4fff-8fff-000000000002',
    backupCode: 'ffffffff-ffff-4fff-8fff-000000000003',
};

// Test-only credentials (never real).
export const PASSWORD = 'Fixture-Pass-2026!';
export const NEW_PASSWORD = 'Brand-New-Pass-2026?';
export const PASSWORD_HASH = bcrypt.hashSync(PASSWORD, 4); // low cost: compare() works with any cost
export const TOTP_SECRET = 'JBSWY3DPEHPK3PXP'; // the well-known RFC/docs example secret
export const SESSION_TOKEN = 'test-session-token-0001';
export const API_KEY = 'gftv_test_api_key_0001';
export const DEVICE_TOKEN = 'test-device-token-0001';
export const CHALLENGE_TOKEN = 'test-challenge-token-0001';
export const BACKUP_CODE = 'ABCDE-12345';

export const SESSION_HEADERS = { authorization: `Bearer ${SESSION_TOKEN}` };
export const API_KEY_HEADERS = { authorization: `ApiKey ${API_KEY}` };

export const FAKE_SUPABASE_URL = 'https://fake-project.supabase.example.com';

// The same hash the handlers store for a backup code: SHA-256 of the code with its dash removed.
export function hashBackupCode(code) {
    return crypto.createHash('sha256').update(code.replace('-', '')).digest('hex');
}

function userRow(fields) {
    return {
        id: IDS.editor,
        username: 'editor_one',
        display_name: 'Editor One',
        email: 'editor.one@example.com',
        password_hash: PASSWORD_HASH,
        is_admin: false,
        is_approved: true,
        avatar_url: `${FAKE_SUPABASE_URL}/storage/v1/object/public/gftvhello_avatars/${fields.id ?? IDS.editor}.webp`,
        social_links: [{ label: 'Website', url: 'https://example.com/editor-one' }],
        created_at: EARLIER_TIME,
        updated_at: LATER_TIME,
        is_editor: true,
        totp_secret: null,
        ...fields,
    };
}

export const editor = (overrides = {}) => userRow({ ...overrides });
export const editorWith2fa = (overrides = {}) => userRow({ totp_secret: TOTP_SECRET, ...overrides });
export const admin = (overrides = {}) => userRow({
    id: IDS.admin, username: 'admin_one', display_name: 'Admin One', email: 'admin.one@example.com',
    is_admin: true, ...overrides,
});
export const viewer = (overrides = {}) => userRow({
    id: IDS.viewer, username: 'viewer_one', display_name: 'Viewer One', email: 'viewer.one@example.com',
    is_editor: false, ...overrides,
});
export const otherUser = (overrides = {}) => userRow({
    id: IDS.other, username: 'other_user', display_name: 'Other User', email: 'other.user@example.com',
    ...overrides,
});

// Shape of a gftvhello_users row (as above) once password_hash and totp_secret are stripped and
// totp_enabled is added: what login, totp-verify and me return as `user`.
export const PUBLIC_USER_SHAPE = {
    id: 'string',
    username: 'string',
    display_name: 'string',
    email: 'string',
    is_admin: 'boolean',
    is_approved: 'boolean',
    avatar_url: 'string',
    social_links: [{ label: 'string', url: 'string' }],
    created_at: 'string',
    updated_at: 'string',
    is_editor: 'boolean',
    totp_enabled: 'boolean',
};

export function linkRow(fields = {}) {
    return {
        id: IDS.link,
        slug: 'test-link',
        destination: 'https://example.com/landing',
        user_id: IDS.editor,
        is_active: true,
        access_count: 42,
        tags: ['events'],
        created_at: EARLIER_TIME,
        updated_at: LATER_TIME,
        ...fields,
    };
}

// The columns the v1 API selects for a link (no user_id).
export function v1LinkRow(fields = {}) {
    const link = linkRow(fields);
    delete link.user_id;
    return link;
}

export const V1_LINK_SHAPE = {
    id: 'string',
    slug: 'string',
    destination: 'string',
    is_active: 'boolean',
    access_count: 'number',
    tags: ['string'],
    created_at: 'string',
    updated_at: 'string',
};

export const V1_LINK_COLUMNS = 'id, slug, destination, is_active, access_count, tags, created_at, updated_at';

// --- Auth rules for the fake Supabase -------------------------------------------------------

// lib/auth.js getSessionUser: the session row joined to its user.
export function sessionAs(user) {
    return {
        table: 'gftvhello_sessions',
        operation: 'select',
        eq: { token: SESSION_TOKEN },
        reply: {
            data: {
                id: IDS.session, user_id: user.id, token: SESSION_TOKEN, expires_at: FAR_FUTURE,
                created_at: EARLIER_TIME, gftvhello_users: user,
            },
        },
    };
}

// lib/auth.js getApiKeyUser: the API key row joined to its user.
export function apiKeyAs(user) {
    return {
        table: 'gftvlinks_api_keys',
        operation: 'select',
        eq: { api_key: API_KEY },
        reply: {
            data: {
                id: IDS.apiKeyRow, user_id: user.id, api_key: API_KEY, created_at: EARLIER_TIME,
                updated_at: LATER_TIME, gftvhello_users: user,
            },
        },
    };
}

export const SESSION_LOOKUP =
    'from(gftvhello_sessions).select("*, gftvhello_users(*)").eq(token).gt(expires_at).single()';
export const API_KEY_LOOKUP =
    'from(gftvlinks_api_keys).select("*, gftvhello_users(*)").eq(api_key).single()';
