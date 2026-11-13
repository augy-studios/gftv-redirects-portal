// The faked API for the browser tests. Every call api.js can make is
// answered here with fixture data, in the same shape the real handler in
// api/ returns (`{ success: true, ...data }` or `{ success: false, error }`).
//
// The signed-in user comes from the Bearer token, as on the real server:
// TOKENS.officer, TOKENS.admin and TOKENS.twoFactor (fixtures.js). Every call
// is recorded, so a test can check the method, path, query and JSON body the
// page sent: those field names are the API's and must not change.
import {
    USERS,
    TOKENS,
    PASSWORD,
    LINKS,
    DIRECTORY,
    STATS,
    ANALYTICS,
    OWNERSHIP_REQUESTS,
    ADMIN_USERS,
    PREAPPROVED,
    PROFILE_VIEWERS,
    TRUSTED_DEVICES,
    API_KEY,
    NEW_API_KEY,
    TOTP_SETUP,
    TOTP_SECRET,
    BACKUP_CODES,
    REGENERATED_BACKUP_CODES,
    CHALLENGE_TOKEN,
    DEVICE_TOKEN,
    RESET_PASSWORD,
} from './fixtures.js';

export const VALID_TOTP_CODE = '123456';
export const PREAPPROVED_EMAIL = 'invited@example.com';

// A brand-new account, returned when someone registers with PREAPPROVED_EMAIL.
const NEWCOMER_TOKEN = 'test-token-newcomer';
const NEWCOMER = {
    id: '77777777-7777-4777-8777-777777777777',
    username: 'new_fox',
    display_name: 'New Fox',
    email: PREAPPROVED_EMAIL,
    is_admin: false,
    is_approved: true,
    is_editor: true,
    avatar_url: null,
    social_links: [],
    created_at: '2026-11-13T02:00:00.000Z',
    updated_at: '2026-11-13T02:00:00.000Z',
    totp_enabled: false,
};

const PERSONA_BY_TOKEN = {
    [TOKENS.officer]: 'officer',
    [TOKENS.admin]: 'admin',
    [TOKENS.twoFactor]: 'twoFactor',
    [NEWCOMER_TOKEN]: 'newcomer',
};

function userFor(persona) {
    if (persona === 'newcomer') {
        return NEWCOMER;
    }
    return USERS[persona];
}

function success(data = {}, status = 200) {
    return { status, data: { success: true, ...data } };
}

function failure(message, status = 400) {
    return { status, data: { success: false, error: message } };
}

const UNAUTHORIZED = failure('Unauthorized', 401);

// Login by username or email, as the real handler does (lower-cased).
function findLoginUser(usernameOrEmail) {
    const wanted = String(usernameOrEmail || '').toLowerCase();
    const candidates = [
        { persona: 'officer', user: USERS.officer },
        { persona: 'admin', user: USERS.admin },
        { persona: 'twoFactor', user: USERS.twoFactor },
    ];
    return candidates.find(({ user }) => user.username === wanted || user.email === wanted) || null;
}

// The route table: one entry per method and path the API serves. `auth`
// entries answer 401 when there is no valid token, like getSessionUser().
// Paths are relative to /api, with :name for a path parameter.
export const ROUTES = [
    {
        method: 'POST', path: '/auth/register', handle: ({ body }) => {
            if (body.email === PREAPPROVED_EMAIL) {
                return success({
                    message: 'Account created and pre-approved!',
                    preapproved: true,
                    preapproved_role: 'editor',
                    token: NEWCOMER_TOKEN,
                    user: NEWCOMER,
                }, 201);
            }
            return success({ message: 'Account created. Waiting for admin approval.' }, 201);
        },
    },
    {
        method: 'POST', path: '/auth/login', handle: ({ body }) => {
            if (String(body.username || '').toLowerCase() === 'new_raccoon' && body.password === PASSWORD) {
                return failure('PENDING_APPROVAL', 403);
            }
            const match = findLoginUser(body.username);
            if (!match || body.password !== PASSWORD) {
                return failure('Invalid credentials', 401);
            }
            if (match.persona === 'twoFactor' && body.device_token !== DEVICE_TOKEN) {
                return success({ requires_2fa: true, challenge_token: CHALLENGE_TOKEN, username: match.user.username });
            }
            return success({ token: TOKENS[match.persona], user: match.user, remember: !!body.remember });
        },
    },
    { method: 'POST', path: '/auth/logout', handle: () => success({ message: 'Logged out' }) },
    { method: 'POST', path: '/auth/logout-all', auth: true, handle: () => success({ message: 'All sessions terminated' }) },
    { method: 'GET', path: '/auth/me', auth: true, handle: ({ user }) => success({ user }) },
    { method: 'GET', path: '/auth/totp-setup', auth: true, handle: () => success(TOTP_SETUP) },
    {
        method: 'POST', path: '/auth/totp-enable', auth: true, handle: ({ body }) => {
            if (body.secret !== TOTP_SECRET || body.code !== VALID_TOTP_CODE) {
                return failure('Invalid code. Make sure your authenticator app is synced.');
            }
            return success({ message: '2FA enabled successfully', backup_codes: BACKUP_CODES });
        },
    },
    {
        method: 'POST', path: '/auth/totp-disable', auth: true, handle: ({ body }) => {
            if (body.password !== PASSWORD) {
                return failure('Incorrect password', 401);
            }
            return success({ message: '2FA disabled successfully' });
        },
    },
    {
        method: 'POST', path: '/auth/totp-verify', handle: ({ body }) => {
            if (body.challenge_token !== CHALLENGE_TOKEN) {
                return failure('Invalid or expired challenge', 401);
            }
            const codeIsValid = body.code === VALID_TOTP_CODE || body.backup_code === BACKUP_CODES[0];
            if (!codeIsValid) {
                return failure('Invalid verification code', 401);
            }
            let deviceToken = null;
            if (body.trust_device) {
                deviceToken = DEVICE_TOKEN;
            }
            return success({ token: TOKENS.twoFactor, user: USERS.twoFactor, device_token: deviceToken, remember: !!body.remember });
        },
    },
    {
        method: 'POST', path: '/auth/backup-codes-regenerate', auth: true, handle: ({ body }) => {
            if (body.password !== PASSWORD) {
                return failure('Incorrect password', 401);
            }
            return success({ backup_codes: REGENERATED_BACKUP_CODES });
        },
    },
    { method: 'GET', path: '/links', auth: true, handle: () => success({ links: DIRECTORY }) },
    { method: 'POST', path: '/links', auth: true, handle: () => success({ message: 'Link created' }, 201) },
    { method: 'GET', path: '/links/mine', auth: true, handle: ({ persona }) => success({ links: LINKS[persona] || [] }) },
    { method: 'GET', path: '/links/analytics', auth: true, handle: () => success(ANALYTICS) },
    { method: 'PUT', path: '/links/:id', auth: true, handle: () => success({ message: 'Link updated' }) },
    { method: 'DELETE', path: '/links/:id', auth: true, handle: () => success({ message: 'Link deleted' }) },
    {
        method: 'GET', path: '/ownership', auth: true, handle: ({ persona }) => {
            if (persona === 'officer') {
                return success({ requests: OWNERSHIP_REQUESTS });
            }
            return success({ requests: [] });
        },
    },
    { method: 'POST', path: '/ownership', auth: true, handle: () => success({ message: 'Ownership request submitted' }, 201) },
    {
        method: 'PUT', path: '/ownership/:id', auth: true, handle: ({ body }) => {
            let status = 'rejected';
            if (body.action === 'approve') {
                status = 'approved';
            }
            return success({ message: `Request ${status}` });
        },
    },
    {
        method: 'GET', path: '/admin/users', auth: true, admin: true, handle: () => success({ users: ADMIN_USERS }),
    },
    {
        method: 'PUT', path: '/admin/users', auth: true, admin: true, handle: ({ body }) => {
            if (body.action === 'reset_password') {
                return success({ message: 'Password reset', password: RESET_PASSWORD });
            }
            return success({ message: 'User updated' });
        },
    },
    { method: 'DELETE', path: '/admin/users', auth: true, admin: true, handle: () => success({ message: 'User deleted' }) },
    { method: 'GET', path: '/admin/preapproved', auth: true, admin: true, handle: () => success({ preapproved: PREAPPROVED }) },
    {
        method: 'POST', path: '/admin/preapproved', auth: true, admin: true,
        handle: () => success({ message: 'User pre-approved successfully' }, 201),
    },
    { method: 'DELETE', path: '/admin/preapproved', auth: true, admin: true, handle: () => success({ message: 'Pre-approval removed' }) },
    { method: 'PUT', path: '/profile/update', auth: true, handle: () => success({ message: 'Profile updated' }) },
    {
        method: 'DELETE', path: '/profile/delete', auth: true, handle: ({ body }) => {
            if (body.password !== PASSWORD) {
                return failure('Incorrect password', 401);
            }
            return success({ message: 'Account deleted' });
        },
    },
    { method: 'POST', path: '/profile/avatar', auth: true, handle: () => success({ avatar_url: '/gsl-180.png' }) },
    {
        method: 'POST', path: '/profile/views', auth: true, handle: ({ body, user }) => {
            if (body.viewed_id === user.id) {
                return success({ message: 'Self-view not tracked' });
            }
            return success({ message: 'View recorded' });
        },
    },
    { method: 'GET', path: '/profile/views', auth: true, handle: () => success({ viewers: PROFILE_VIEWERS }) },
    { method: 'GET', path: '/profile/trusted-devices', auth: true, handle: () => success({ devices: TRUSTED_DEVICES }) },
    { method: 'DELETE', path: '/profile/trusted-devices', auth: true, handle: () => success({ message: 'Device removed' }) },
    {
        method: 'GET', path: '/apikeys', auth: true, handle: ({ persona }) => {
            if (persona === 'officer') {
                return success(API_KEY);
            }
            return success({ api_key: null });
        },
    },
    { method: 'POST', path: '/apikeys', auth: true, handle: () => success({ api_key: NEW_API_KEY }, 201) },
    { method: 'GET', path: '/stats', handle: () => success(STATS) },
];

function compileRoutePath(path) {
    const pattern = path.replace(/:[A-Za-z]+/g, '[^/]+');
    return new RegExp(`^${pattern}$`);
}

const COMPILED_ROUTES = ROUTES.map((route) => ({ ...route, pattern: compileRoutePath(route.path) }));

export function findRoute(method, path) {
    return COMPILED_ROUTES.find((route) => route.method === method && route.pattern.test(path)) || null;
}

// Installs the fake on a page. Returns the recorder: `calls` (every request,
// in order), `unhandled` (requests with no route), and `override()` to answer
// one method and path differently in a single test.
export async function installFakeApi(page, baseURL) {
    const origin = new URL(baseURL).origin;
    const calls = [];
    const unhandled = [];
    const overrides = new Map();

    await page.route((url) => url.origin === origin && url.pathname.startsWith('/api/'), async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const path = url.pathname.slice('/api'.length);
        const method = request.method();
        let body = null;
        if (request.postData()) {
            body = request.postDataJSON();
        }
        const authorization = request.headers().authorization || '';
        const token = authorization.replace(/^Bearer\s+/i, '');
        const call = {
            method,
            path,
            query: Object.fromEntries(url.searchParams),
            body,
            token,
        };
        calls.push(call);

        let reply;
        const override = overrides.get(`${method} ${path}`);
        const matchedRoute = findRoute(method, path);
        const persona = PERSONA_BY_TOKEN[token] || null;
        const user = persona && userFor(persona);
        if (override) {
            reply = override(call);
        } else if (!matchedRoute) {
            unhandled.push(`${method} ${path}`);
            reply = failure(`Not faked: ${method} ${path}`, 404);
        } else if (matchedRoute.auth && !user) {
            reply = UNAUTHORIZED;
        } else if (matchedRoute.admin && !user.is_admin) {
            reply = failure('Forbidden', 403);
        } else {
            reply = matchedRoute.handle({ body: body || {}, query: call.query, user, persona });
        }

        await route.fulfill({
            status: reply.status,
            contentType: 'application/json',
            body: JSON.stringify(reply.data),
        });
    });

    return {
        calls,
        unhandled,
        // Answer `METHOD /path` with `responder(call)`, which returns
        // { status, data } (use the success/failure helpers' shape).
        override(methodAndPath, responder) {
            overrides.set(methodAndPath, responder);
        },
        // The recorded calls for one method and path, e.g. 'POST /links'.
        callsTo(methodAndPath) {
            return calls.filter((call) => `${call.method} ${call.path}` === methodAndPath);
        },
    };
}
