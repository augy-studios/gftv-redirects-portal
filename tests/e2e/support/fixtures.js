// Fixture data for the faked API. The shapes copy what the handlers in api/
// return (field names included: these are the API's names and must not
// change). Everything here is made up: example.com addresses, fixed ids and
// fixed timestamps, so every run renders the same page.
import QRCode from 'qrcode';

// The frozen "now" for every test: Friday 13 November 2026, 10:00 in
// Singapore. Inside the 09:00 to 18:00 daylight window, so time-based mode
// resolves to light.
export const FROZEN_TIME = new Date('2026-11-13T10:00:00+08:00');

// Bearer tokens the fake accepts, one per signed-in persona.
export const TOKENS = {
    officer: 'test-token-officer',
    admin: 'test-token-admin',
    twoFactor: 'test-token-two-factor',
};

export const PASSWORD = 'Correct-Horse-9';

const USER_IDS = {
    officer: '11111111-1111-4111-8111-111111111111',
    admin: '22222222-2222-4222-8222-222222222222',
    twoFactor: '33333333-3333-4333-8333-333333333333',
    otter: '44444444-4444-4444-8444-444444444444',
    viewer: '55555555-5555-4555-8555-555555555555',
    pending: '66666666-6666-4666-8666-666666666666',
};

// Users as /api/auth/me returns them: every column except password_hash and
// totp_secret, plus totp_enabled.
export const USERS = {
    officer: {
        id: USER_IDS.officer,
        username: 'kiri_fox',
        display_name: 'Kiri Fox',
        email: 'kiri@example.com',
        is_admin: false,
        is_approved: true,
        is_editor: true,
        avatar_url: null,
        social_links: [
            { label: 'Website', url: 'https://example.com/kiri' },
            { label: 'Mastodon', url: 'https://social.example.com/@kiri' },
        ],
        created_at: '2026-01-15T03:00:00.000Z',
        updated_at: '2026-10-01T03:00:00.000Z',
        totp_enabled: false,
    },
    admin: {
        id: USER_IDS.admin,
        username: 'mod_lynx',
        display_name: 'Lynx Moderator',
        email: 'lynx@example.com',
        is_admin: true,
        is_approved: true,
        is_editor: true,
        avatar_url: null,
        social_links: [],
        created_at: '2025-11-02T03:00:00.000Z',
        updated_at: '2026-09-12T03:00:00.000Z',
        totp_enabled: false,
    },
    twoFactor: {
        id: USER_IDS.twoFactor,
        username: 'tess_wolf',
        display_name: 'Tess Wolf',
        email: 'tess@example.com',
        is_admin: false,
        is_approved: true,
        is_editor: true,
        avatar_url: '/gsl-192.png',
        social_links: [],
        created_at: '2026-03-08T03:00:00.000Z',
        updated_at: '2026-10-20T03:00:00.000Z',
        totp_enabled: true,
    },
};

// Short author records as the directory query embeds them.
function directoryAuthor(user) {
    return {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        social_links: user.social_links,
        is_admin: user.is_admin,
    };
}

const OTTER = {
    id: USER_IDS.otter,
    username: 'pip_otter',
    display_name: 'Pip Otter',
    avatar_url: null,
    social_links: [{ label: 'Blog', url: 'https://blog.example.com/pip' }],
    is_admin: false,
};

// Links as /api/links/mine returns them (select('*') on gftvlinks_links).
export const LINKS = {
    officer: [
        {
            id: 'aaaaaaaa-0001-4000-8000-000000000001',
            slug: 'winter-meetup',
            destination: 'https://events.example.com/2026/winter-meetup',
            user_id: USER_IDS.officer,
            is_active: true,
            access_count: 128,
            tags: ['events', 'meetup'],
            created_at: '2026-10-02T04:30:00.000Z',
            updated_at: '2026-10-05T04:30:00.000Z',
        },
        {
            id: 'aaaaaaaa-0002-4000-8000-000000000002',
            slug: 'discord',
            destination: 'https://chat.example.com/invite/gftv',
            user_id: USER_IDS.officer,
            is_active: true,
            access_count: 342,
            tags: ['social'],
            created_at: '2026-08-20T09:15:00.000Z',
            updated_at: '2026-08-20T09:15:00.000Z',
        },
        {
            id: 'aaaaaaaa-0003-4000-8000-000000000003',
            slug: 'old-survey',
            destination: 'https://forms.example.com/r/survey-2025',
            user_id: USER_IDS.officer,
            is_active: false,
            access_count: 17,
            tags: [],
            created_at: '2025-12-01T02:00:00.000Z',
            updated_at: '2026-02-01T02:00:00.000Z',
        },
    ],
    admin: [
        {
            id: 'aaaaaaaa-0004-4000-8000-000000000004',
            slug: 'rules',
            destination: 'https://example.com/community/rules',
            user_id: USER_IDS.admin,
            is_active: true,
            access_count: 905,
            tags: ['policy'],
            created_at: '2026-02-14T01:00:00.000Z',
            updated_at: '2026-02-14T01:00:00.000Z',
        },
    ],
    twoFactor: [
        {
            id: 'aaaaaaaa-0005-4000-8000-000000000005',
            slug: 'art-gallery',
            destination: 'https://gallery.example.com/tess',
            user_id: USER_IDS.twoFactor,
            is_active: true,
            access_count: 56,
            tags: ['art'],
            created_at: '2026-06-30T07:45:00.000Z',
            updated_at: '2026-06-30T07:45:00.000Z',
        },
    ],
};

// The directory (/api/links): every link with its author embedded.
export const DIRECTORY = [
    ...LINKS.officer.map((link) => ({ link, author: USERS.officer })),
    ...LINKS.admin.map((link) => ({ link, author: USERS.admin })),
    ...LINKS.twoFactor.map((link) => ({ link, author: USERS.twoFactor })),
].map(({ link, author }) => ({
    id: link.id,
    slug: link.slug,
    destination: link.destination,
    is_active: link.is_active,
    access_count: link.access_count,
    tags: link.tags,
    created_at: link.created_at,
    gftvhello_users: directoryAuthor(author),
})).concat([
    {
        id: 'aaaaaaaa-0006-4000-8000-000000000006',
        slug: 'otter-zine',
        destination: 'https://zine.example.com/issue-7',
        is_active: true,
        access_count: 73,
        tags: ['zine', 'art'],
        created_at: '2026-09-09T11:00:00.000Z',
        gftvhello_users: OTTER,
    },
]);

export const STATS = { officers: 12, links: 87, clicks: 4321 };

// /api/links/analytics?id=... for the officer's first link. The daily
// clicks cover the seven days that end on the frozen date (UTC).
export const ANALYTICS = {
    total_clicks: 128,
    devices: [
        { device_type: 'Desktop', cnt: 70 },
        { device_type: 'Mobile', cnt: 50 },
        { device_type: 'Tablet', cnt: 6 },
        { device_type: 'Others', cnt: 2 },
    ],
    daily_clicks: [
        { day: '2026-11-07', cnt: 3 },
        { day: '2026-11-08', cnt: 9 },
        { day: '2026-11-09', cnt: 4 },
        { day: '2026-11-10', cnt: 12 },
        { day: '2026-11-11', cnt: 7 },
        { day: '2026-11-12', cnt: 15 },
        { day: '2026-11-13', cnt: 2 },
    ],
    all_daily_clicks: [
        { day: '2026-10-02', cnt: 40 },
        { day: '2026-11-13', cnt: 2 },
    ],
    heatmap: [
        { dow: 1, hr: 9, cnt: 5 },
        { dow: 1, hr: 20, cnt: 11 },
        { dow: 3, hr: 13, cnt: 8 },
        { dow: 5, hr: 18, cnt: 14 },
        { dow: 6, hr: 21, cnt: 9 },
        { dow: 0, hr: 11, cnt: 3 },
    ],
    history: [
        {
            id: 'bbbbbbbb-0003-4000-8000-000000000003',
            event_type: 'updated',
            description: 'Destination changed to https://events.example.com/2026/winter-meetup',
            created_at: '2026-10-05T04:30:00.000Z',
        },
        {
            id: 'bbbbbbbb-0002-4000-8000-000000000002',
            event_type: 'status',
            description: 'Link set to ACTIVE',
            created_at: '2026-10-03T08:00:00.000Z',
        },
        {
            id: 'bbbbbbbb-0001-4000-8000-000000000001',
            event_type: 'created',
            description: 'Link created as INACTIVE pointing to https://events.example.com/draft',
            created_at: '2026-10-02T04:30:00.000Z',
        },
    ],
};

export const OWNERSHIP_REQUESTS = [
    {
        id: 'cccccccc-0001-4000-8000-000000000001',
        status: 'pending',
        created_at: '2026-11-10T06:00:00.000Z',
        gftvlinks_links: {
            id: LINKS.officer[1].id,
            slug: LINKS.officer[1].slug,
            destination: LINKS.officer[1].destination,
        },
        requester: { id: OTTER.id, username: OTTER.username, display_name: OTTER.display_name, avatar_url: null },
    },
    {
        id: 'cccccccc-0002-4000-8000-000000000002',
        status: 'approved',
        created_at: '2026-09-01T06:00:00.000Z',
        gftvlinks_links: {
            id: LINKS.officer[0].id,
            slug: LINKS.officer[0].slug,
            destination: LINKS.officer[0].destination,
        },
        requester: {
            id: USERS.twoFactor.id,
            username: USERS.twoFactor.username,
            display_name: USERS.twoFactor.display_name,
            avatar_url: USERS.twoFactor.avatar_url,
        },
    },
];

// /api/admin/users: the columns the handler selects.
function adminUserRow(user) {
    return {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        email: user.email,
        is_admin: user.is_admin,
        is_approved: user.is_approved,
        is_editor: user.is_editor,
        avatar_url: user.avatar_url,
        created_at: user.created_at,
    };
}

export const ADMIN_USERS = [
    {
        id: USER_IDS.pending,
        username: 'new_raccoon',
        display_name: 'New Raccoon',
        email: 'raccoon@example.com',
        is_admin: false,
        is_approved: false,
        is_editor: false,
        avatar_url: null,
        created_at: '2026-11-12T05:00:00.000Z',
    },
    {
        id: USER_IDS.viewer,
        username: 'quiet_deer',
        display_name: 'Quiet Deer',
        email: 'deer@example.com',
        is_admin: false,
        is_approved: true,
        is_editor: false,
        avatar_url: null,
        created_at: '2026-07-04T05:00:00.000Z',
    },
    adminUserRow(USERS.twoFactor),
    adminUserRow(USERS.officer),
    adminUserRow(USERS.admin),
];

export const PREAPPROVED = [
    {
        id: 'dddddddd-0001-4000-8000-000000000001',
        email: 'future.editor@example.com',
        preapproved_role: 'editor',
        user_id: null,
        preapproved_at: '2026-11-11T02:00:00.000Z',
        activated_at: null,
    },
    {
        id: 'dddddddd-0002-4000-8000-000000000002',
        email: 'deer@example.com',
        preapproved_role: 'viewer',
        user_id: USER_IDS.viewer,
        preapproved_at: '2026-07-01T02:00:00.000Z',
        activated_at: '2026-07-04T05:00:00.000Z',
    },
];

// /api/profile/views?profile_id=...: the viewer's short record plus viewed_at.
export const PROFILE_VIEWERS = [
    { id: OTTER.id, username: OTTER.username, display_name: OTTER.display_name, avatar_url: null, viewed_at: '2026-11-12T10:00:00.000Z' },
    {
        id: USERS.admin.id,
        username: USERS.admin.username,
        display_name: USERS.admin.display_name,
        avatar_url: null,
        viewed_at: '2026-11-11T10:00:00.000Z',
    },
];

export const TRUSTED_DEVICES = [
    { id: 'eeeeeeee-0001-4000-8000-000000000001', created_at: '2026-11-01T01:00:00.000Z', expires_at: '2026-12-01T01:00:00.000Z' },
    { id: 'eeeeeeee-0002-4000-8000-000000000002', created_at: '2026-10-20T01:00:00.000Z', expires_at: '2026-11-19T01:00:00.000Z' },
];

export const API_KEY = {
    api_key: 'test-api-key-0000-not-a-real-key',
    created_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-10-30T00:00:00.000Z',
};
export const NEW_API_KEY = 'test-api-key-1111-regenerated';

// The TOTP setup reply. The secret is the RFC 4226 example, not a real one;
// the QR image comes from the same `qrcode` library the handler uses.
export const TOTP_SECRET = 'JBSWY3DPEHPK3PXP';
export const TOTP_SETUP = {
    secret: TOTP_SECRET,
    qr_data_url: await QRCode.toDataURL(`otpauth://totp/GFTV%20Links:kiri_fox?secret=${TOTP_SECRET}&issuer=GFTV%20Links`, { margin: 1, width: 200 }),
};

export const BACKUP_CODES = [
    'A1B2C-3D4E5', 'F6A7B-8C9D0', 'E1F2A-3B4C5', 'D6E7F-8A9B0', 'C1D2E-3F4A5',
    'B6C7D-8E9F0', 'A2B3C-4D5E6', 'F7A8B-9C0D1', 'E2F3A-4B5C6', 'D7E8F-9A0B1',
];
export const REGENERATED_BACKUP_CODES = BACKUP_CODES.map((code) => code.split('').reverse().join(''));

export const CHALLENGE_TOKEN = 'test-challenge-token';
export const DEVICE_TOKEN = 'test-device-token';
export const RESET_PASSWORD = 'Temp-Reset-Pass-16';
