// Sanity check: every handler that needs a session or API key answers 401 with the error shape
// when called without one, before touching the database. Run with `npm test`.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { fake } from './helpers/fake-supabase.js';
import { callHandler } from './helpers/http.js';
import { expectReply, ERROR_SHAPE } from './helpers/shape.js';
import { IDS, SESSION_HEADERS, SESSION_LOOKUP } from './helpers/fixtures.js';

import apikeys from '../../api/apikeys.js';
import preapproved from '../../api/admin/preapproved.js';
import users from '../../api/admin/users.js';
import backupCodesRegenerate from '../../api/auth/backup-codes-regenerate.js';
import logoutAll from '../../api/auth/logout-all.js';
import me from '../../api/auth/me.js';
import totpDisable from '../../api/auth/totp-disable.js';
import totpEnable from '../../api/auth/totp-enable.js';
import totpSetup from '../../api/auth/totp-setup.js';
import linkById from '../../api/links/[id].js';
import analytics from '../../api/links/analytics.js';
import linksIndex from '../../api/links/index.js';
import mine from '../../api/links/mine.js';
import ownershipById from '../../api/ownership/[id].js';
import ownershipIndex from '../../api/ownership/index.js';
import avatar from '../../api/profile/avatar.js';
import profileDelete from '../../api/profile/delete.js';
import trustedDevices from '../../api/profile/trusted-devices.js';
import profileUpdate from '../../api/profile/update.js';
import views from '../../api/profile/views.js';
import v1Index from '../../api/v1/links/index.js';
import v1BySlug from '../../api/v1/links/[slug].js';

const CASES = [
    ['api/apikeys.js', apikeys, 'GET', '/api/apikeys'],
    ['api/admin/preapproved.js', preapproved, 'GET', '/api/admin/preapproved'],
    ['api/admin/users.js', users, 'GET', '/api/admin/users'],
    ['api/auth/backup-codes-regenerate.js', backupCodesRegenerate, 'POST', '/api/auth/backup-codes-regenerate'],
    ['api/auth/logout-all.js', logoutAll, 'POST', '/api/auth/logout-all'],
    ['api/auth/me.js', me, 'GET', '/api/auth/me'],
    ['api/auth/totp-disable.js', totpDisable, 'POST', '/api/auth/totp-disable'],
    ['api/auth/totp-enable.js', totpEnable, 'POST', '/api/auth/totp-enable'],
    ['api/auth/totp-setup.js', totpSetup, 'GET', '/api/auth/totp-setup'],
    ['api/links/[id].js', linkById, 'PUT', `/api/links/${IDS.link}`],
    ['api/links/analytics.js', analytics, 'GET', `/api/links/analytics?id=${IDS.link}`],
    ['api/links/index.js', linksIndex, 'GET', '/api/links'],
    ['api/links/mine.js', mine, 'GET', '/api/links/mine'],
    ['api/ownership/[id].js', ownershipById, 'PUT', `/api/ownership/${IDS.request}`],
    ['api/ownership/index.js', ownershipIndex, 'GET', '/api/ownership'],
    ['api/profile/avatar.js', avatar, 'POST', '/api/profile/avatar'],
    ['api/profile/delete.js', profileDelete, 'DELETE', '/api/profile/delete'],
    ['api/profile/trusted-devices.js', trustedDevices, 'GET', '/api/profile/trusted-devices'],
    ['api/profile/update.js', profileUpdate, 'PUT', '/api/profile/update'],
    ['api/profile/views.js', views, 'GET', `/api/profile/views?profile_id=${IDS.editor}`],
    ['api/v1/links/index.js', v1Index, 'GET', '/api/v1/links'],
    ['api/v1/links/[slug].js', v1BySlug, 'GET', '/api/v1/links/test-link'],
];

describe('no credentials: 401', () => {
    for (const [name, handler, method, url] of CASES) {
        test(`${name} ${method}`, async () => {
            fake.reset([]);
            const reply = await callHandler(handler, { method, url, body: {} });
            expectReply(reply, 401, ERROR_SHAPE);
            assert.deepStrictEqual(fake.log(), [], 'no DB call without credentials');
        });
    }
});

describe('unknown or expired session token: 401', () => {
    test('api/auth/me.js GET', async () => {
        fake.reset([]); // the session lookup finds nothing
        const reply = await callHandler(me, { method: 'GET', url: '/api/auth/me', headers: SESSION_HEADERS });
        expectReply(reply, 401, ERROR_SHAPE);
        assert.deepStrictEqual(fake.log(), [SESSION_LOOKUP]);
    });
});
