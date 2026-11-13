// What the page sends to the API. Each test drives an action and checks the
// method, path, query and JSON body against the API's field names, which
// must not change when the code is renamed. Between this file and the view
// tests, every call in api.js is made at least once.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test, expect } from './support/test.js';
import { findRoute } from './support/fake-api.js';
import {
    PASSWORD,
    TOKENS,
    LINKS,
    DIRECTORY,
    OWNERSHIP_REQUESTS,
    PREAPPROVED,
    TRUSTED_DEVICES,
    BACKUP_CODES,
    CHALLENGE_TOKEN,
    DEVICE_TOKEN,
    RESET_PASSWORD,
    USERS,
} from './support/fixtures.js';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

const PROJECT_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const [winterMeetup] = LINKS.officer;
const otterZine = DIRECTORY.find((link) => link.slug === 'otter-zine');
const DEER_ID = '55555555-5555-4555-8555-555555555555';

// Every req(...) call in api.js, in file order, as "METHOD /path" with the
// query string dropped and ${...} parts shown as :param.
function readApiCalls() {
    const source = readFileSync(`${PROJECT_ROOT}api.js`, 'utf8');
    const calls = [];
    for (const match of source.matchAll(/req\('([A-Z]+)',\s*(['`])(.*?)\2/g)) {
        const path = match[3].split('?')[0].replace(/\$\{[^}]+\}/g, ':param');
        calls.push(`${match[1]} ${path}`);
    }
    return calls;
}

test('every call in api.js has a route in the fake API', () => {
    const calls = readApiCalls();
    expect(calls).toEqual([
        'POST /auth/register',
        'POST /auth/login',
        'POST /auth/logout',
        'POST /auth/logout-all',
        'GET /auth/me',
        'GET /auth/totp-setup',
        'POST /auth/totp-enable',
        'POST /auth/totp-disable',
        'POST /auth/totp-verify',
        'POST /auth/totp-verify',
        'POST /auth/backup-codes-regenerate',
        'GET /links',
        'GET /links/mine',
        'POST /links',
        'PUT /links/:param',
        'DELETE /links/:param',
        'GET /links/analytics',
        'GET /ownership',
        'POST /ownership',
        'PUT /ownership/:param',
        'GET /admin/users',
        'PUT /admin/users',
        'PUT /admin/users',
        'PUT /admin/users',
        'DELETE /admin/users',
        'GET /admin/preapproved',
        'POST /admin/preapproved',
        'DELETE /admin/preapproved',
        'PUT /profile/update',
        'DELETE /profile/delete',
        'POST /profile/avatar',
        'POST /profile/views',
        'GET /profile/views',
        'GET /profile/trusted-devices',
        'DELETE /profile/trusted-devices',
        'GET /apikeys',
        'POST /apikeys',
        'GET /stats',
    ]);
    const missing = calls.filter((call) => {
        const [method, path] = call.split(' ');
        return !findRoute(method, path.replace(':param', 'some-id'));
    });
    expect(missing).toEqual([]);
});

test.describe('as an officer', () => {
    test.beforeEach(async ({ app }) => {
        await app.signInAs('officer');
        await app.open();
        await app.settleDashboard();
    });

    test('logging out', async ({ app, page }) => {
        await app.navTo('Logout');
        await expect(page.locator('#page-home')).toHaveClass(/\bactive\b/);
        await expect(page.locator('#toast-container')).toContainText('Logged out successfully');
        const [logout] = app.api.callsTo('POST /auth/logout');
        expect(logout).toMatchObject({ body: null, token: TOKENS.officer });
        const storage = await app.readStorage(['gftv_token']);
        expect(storage.gftv_token).toEqual({ local: null, session: null });
    });

    test('turning a link off, then deleting it', async ({ app, page }) => {
        const firstRow = page.locator('#dashboard-links-wrap tbody tr').first();
        await firstRow.locator('.active-check').uncheck();
        await expect(page.locator('#toast-container')).toContainText('Link disabled');
        expect(app.api.callsTo(`PUT /links/${winterMeetup.id}`).map((call) => call.body)).toEqual([{ is_active: false }]);

        const dialogMessages = [];
        page.once('dialog', (dialog) => {
            dialogMessages.push(dialog.message());
            dialog.accept();
        });
        await firstRow.locator('button[title="Delete link"]').click();
        await expect(page.locator('#toast-container')).toContainText('Link deleted');
        expect(dialogMessages).toEqual(['Delete this link? This cannot be undone.']);
        expect(app.api.callsTo(`DELETE /links/${winterMeetup.id}`)).toHaveLength(1);
    });

    test('downloading the links as CSV', async ({ app, page }) => {
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#page-dashboard button', { hasText: 'Download CSV' }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('my-links.csv');
        const csv = await readFile(await download.path(), 'utf8');
        expect(csv).toBe([
            'Short URL,Original URL,Status,Tags,Visits,Created At,Last Modified',
            'https://gftv.asia/winter-meetup,https://events.example.com/2026/winter-meetup,Active,events; meetup,128,2026-10-02T04:30:00.000Z,2026-10-05T04:30:00.000Z',
            'https://gftv.asia/discord,https://chat.example.com/invite/gftv,Active,social,342,2026-08-20T09:15:00.000Z,2026-08-20T09:15:00.000Z',
            'https://gftv.asia/old-survey,https://forms.example.com/r/survey-2025,Inactive,,17,2025-12-01T02:00:00.000Z,2026-02-01T02:00:00.000Z',
        ].join('\n'));
        await expect(page.locator('#toast-container')).toContainText('Downloaded 3 links as CSV');
    });

    test('downloading the click statistics as CSV', async ({ page }) => {
        await page.locator('#dashboard-links-wrap tbody tr').first().locator('button[title="View analytics"]').click();
        await expect(page.locator('#analytics-total-clicks')).toHaveText('128 total clicks');
        await page.locator('.analytics-tab-btn[data-tab="clicks"]').click();
        const downloadPromise = page.waitForEvent('download');
        await page.locator('#analytics-tab-content a', { hasText: 'Download full link click statistics here' }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toBe('analytics-winter-meetup.csv');
        expect(await readFile(await download.path(), 'utf8')).toBe('date,clicks\n2026-10-02,40\n2026-11-13,2');
    });

    test('requesting ownership, and answering a request', async ({ app, page }) => {
        await app.navTo('Directory');
        await page.locator('#directory-table-wrap tr', { hasText: 'otter-zine' }).locator('button', { hasText: 'Request Ownership' }).click();
        await expect(page.locator('#toast-container')).toContainText('Ownership request sent!');
        expect(app.api.callsTo('POST /ownership').map((call) => call.body)).toEqual([{ link_id: otterZine.id }]);

        await app.navTo('Requests');
        await page.locator('#ownership-list button', { hasText: 'Approve' }).click();
        await expect(page.locator('#toast-container')).toContainText('Request approved');
        expect(app.api.callsTo(`PUT /ownership/${OWNERSHIP_REQUESTS[0].id}`).map((call) => call.body)).toEqual([{ action: 'approve' }]);
    });

    test('editing the profile and changing the password', async ({ app, page }) => {
        await app.navTo('Profile');
        await page.locator('#edit-displayname').fill('Kiri the Fox');
        await page.locator('#profile-tab-edit button', { hasText: '+ Add Social Link' }).click();
        const newRow = page.locator('#social-links-editor .social-link-row').nth(2);
        await newRow.locator('input[data-field="label"]').fill('Shop');
        await newRow.locator('input[data-field="url"]').fill('https://shop.example.com/kiri');
        await page.locator('#save-profile-btn').click();
        await expect(page.locator('#toast-container')).toContainText('Profile updated!');
        await expect(page.locator('#profile-display-name')).toHaveText('Kiri the Fox');
        await app.dismissToasts();
        expect(app.api.callsTo('PUT /profile/update').map((call) => call.body)).toEqual([
            {
                display_name: 'Kiri the Fox',
                social_links: [
                    ...USERS.officer.social_links,
                    { label: 'Shop', url: 'https://shop.example.com/kiri' },
                ],
            },
        ]);

        await page.locator('#page-profile .tabs .tab-btn', { hasText: 'Password' }).click();
        await page.locator('#current-password').fill(PASSWORD);
        await page.locator('#new-password').fill('New-Password-42');
        await page.locator('#confirm-new-password').fill('Different-42');
        await page.locator('#change-pwd-btn').click();
        await expect(page.locator('#toast-container')).toContainText('Passwords do not match');
        await app.dismissToasts();
        await page.locator('#new-password').fill('short');
        await page.locator('#confirm-new-password').fill('short');
        await page.locator('#change-pwd-btn').click();
        await expect(page.locator('#toast-container')).toContainText('Password must be at least 8 characters');
        expect(app.api.callsTo('PUT /profile/update')).toHaveLength(1);
        await app.dismissToasts();

        await page.locator('#new-password').fill('New-Password-42');
        await expect(page.locator('#new-pwd-strength')).toHaveAttribute('class', 'pwd-strength pwd-strength-4');
        await page.locator('#confirm-new-password').fill('New-Password-42');
        await page.locator('#change-pwd-btn').click();
        await expect(page.locator('#toast-container')).toContainText('Password changed!');
        expect(app.api.callsTo('PUT /profile/update')[1].body).toEqual({ current_password: PASSWORD, new_password: 'New-Password-42' });
    });

    test('uploading an avatar', async ({ app, page }) => {
        await app.navTo('Profile');
        await page.locator('#avatar-file-input').setInputFiles(`${PROJECT_ROOT}gsl-192.png`);
        await expect(page.locator('#toast-container')).toContainText('Avatar updated!');
        const [upload] = app.api.callsTo('POST /profile/avatar');
        expect(Object.keys(upload.body)).toEqual(['image_base64']);
        expect(upload.body.image_base64).toMatch(/^data:image\/webp;base64,/);
        await expect(page.locator('#nav-user img.nav-avatar')).toHaveAttribute('src', '/gsl-180.png');
    });

    test('removing a trusted device, then logging out everywhere', async ({ app, page }) => {
        await app.navTo('Profile');
        await page.locator('#page-profile .tabs .tab-btn', { hasText: 'Danger Zone' }).click();
        await page.locator('#trusted-devices-list button', { hasText: 'Remove' }).first().click();
        await expect(page.locator('#toast-container')).toContainText('Device removed');
        expect(app.api.callsTo('DELETE /profile/trusted-devices').map((call) => call.query)).toEqual([{ id: TRUSTED_DEVICES[0].id }]);

        await page.locator('#profile-tab-danger button', { hasText: 'Log Out All Devices' }).click();
        await expect(page.locator('#modal-logout-all')).toHaveClass(/\bopen\b/);
        await page.locator('#logout-all-confirm-btn').click();
        await expect(page.locator('#page-home')).toHaveClass(/\bactive\b/);
        await expect(page.locator('#toast-container')).toContainText('Logged out of all devices.');
        expect(app.api.callsTo('POST /auth/logout-all')).toHaveLength(1);
        const storage = await app.readStorage(['gftv_token']);
        expect(storage.gftv_token).toEqual({ local: null, session: null });
    });

    test('deleting the account', async ({ app, page }) => {
        await app.navTo('Profile');
        await page.locator('#page-profile .tabs .tab-btn', { hasText: 'Danger Zone' }).click();
        await page.locator('#profile-tab-danger button', { hasText: 'Delete My Account' }).click();
        await expect(page.locator('#delete-step-text')).toHaveText('Are you sure you want to delete your account? All your links will also be deleted.');
        for (let step = 0; step < 3; step++) {
            await page.locator('#modal-delete-account button', { hasText: 'Continue →' }).click();
        }
        await expect(page.locator('#modal-delete-final')).toHaveClass(/\bopen\b/);
        await page.locator('#delete-confirm-password').fill(PASSWORD);
        await page.locator('#delete-account-final-btn').click();
        await expect(page.locator('#page-home')).toHaveClass(/\bactive\b/);
        await expect(page.locator('#toast-container')).toContainText('Account deleted. Goodbye!');
        expect(app.api.callsTo('DELETE /profile/delete').map((call) => call.body)).toEqual([{ password: PASSWORD }]);
    });
});

test.describe('as an admin', () => {
    test.beforeEach(async ({ app }) => {
        await app.signInAs('admin');
        await app.open();
        await app.settleDashboard();
    });

    test('changing, resetting and deleting a user', async ({ app, page }) => {
        await app.navTo('Admin');
        await page.locator('#admin-users-wrap tr', { hasText: '@quiet_deer' }).locator('button', { hasText: 'Edit' }).click();

        await page.locator('#admin-manage-perm-btns button', { hasText: 'Grant Editor' }).click();
        await expect(page.locator('#toast-container')).toContainText('User updated');

        await page.locator('#admin-manage-username').fill('quiet_doe');
        await page.locator('#admin-manage-displayname').fill('Quiet Doe');
        await page.locator('#admin-manage-email').fill('doe@example.com');
        await page.locator('#admin-manage-details-btn').click();
        await expect(page.locator('#toast-container')).toContainText('User details updated');

        await page.locator('#modal-admin-manage button', { hasText: 'Reset Password' }).click();
        await expect(page.locator('#toast-container')).toContainText('Password reset & copied to clipboard');
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(RESET_PASSWORD);

        expect(app.api.callsTo('PUT /admin/users').map((call) => call.body)).toEqual([
            { user_id: DEER_ID, action: 'grant_editor' },
            { user_id: DEER_ID, action: 'update_details', username: 'quiet_doe', display_name: 'Quiet Doe', email: 'doe@example.com' },
            { user_id: DEER_ID, action: 'reset_password' },
        ]);

        await page.locator('#admin-delete-user-row button', { hasText: 'Delete Account' }).click();
        for (let step = 0; step < 3; step++) {
            await page.locator('#modal-admin-delete-user button', { hasText: 'Continue →' }).click();
        }
        await expect(page.locator('#toast-container')).toContainText('User deleted');
        expect(app.api.callsTo('DELETE /admin/users').map((call) => call.query)).toEqual([{ user_id: DEER_ID }]);
    });

    test('removing a pre-approval', async ({ app, page }) => {
        await app.navTo('Admin');
        page.once('dialog', (dialog) => dialog.accept());
        await page.locator('#admin-preapproved-wrap tr', { hasText: PREAPPROVED[0].email }).locator('button', { hasText: 'Remove' }).click();
        await expect(page.locator('#toast-container')).toContainText('Pre-approval removed');
        expect(app.api.callsTo('DELETE /admin/preapproved').map((call) => call.query)).toEqual([{ id: PREAPPROVED[0].id }]);
    });

    test('saving, transferring and deleting a link from the directory', async ({ app, page }) => {
        await app.navTo('Directory');
        const editOtterZine = page.locator('#directory-table-wrap tr', { hasText: 'otter-zine' }).locator('button', { hasText: 'Edit' });

        await editOtterZine.click();
        await page.locator('#admin-link-status').selectOption('false');
        await page.locator('#admin-manage-link-save-btn').click();
        await expect(page.locator('#toast-container')).toContainText('Link updated!');

        await editOtterZine.click();
        await page.locator('#admin-link-new-owner').fill('kiri_fox');
        await page.locator('#admin-transfer-link-btn').click();
        await expect(page.locator('#toast-container')).toContainText('Ownership transferred to @kiri_fox');

        expect(app.api.callsTo(`PUT /links/${otterZine.id}`).map((call) => call.body)).toEqual([
            { slug: 'otter-zine', destination: otterZine.destination, is_active: false, tags: ['zine', 'art'] },
            { new_owner_username: 'kiri_fox' },
        ]);

        await editOtterZine.click();
        page.once('dialog', (dialog) => dialog.accept());
        await page.locator('#modal-admin-manage-link button', { hasText: 'Delete Link' }).click();
        await expect(page.locator('#toast-container')).toContainText('Link deleted');
        expect(app.api.callsTo(`DELETE /links/${otterZine.id}`)).toHaveLength(1);
    });
});

test.describe('signing in with 2FA', () => {
    test('with a backup code', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await app.navTo('Log In');
        await page.locator('#login-username').fill('tess_wolf');
        await page.locator('#login-password').fill(PASSWORD);
        await page.locator('#login-btn').click();
        await expect(page.locator('#totp-login-code')).toBeVisible();
        await page.locator('button', { hasText: 'Use a backup code instead' }).click();
        await page.locator('#totp-login-backup-code').fill(BACKUP_CODES[0]);
        await page.locator('#totp-login-btn').click();
        await app.settleDashboard();
        expect(app.api.callsTo('POST /auth/totp-verify').map((call) => call.body)).toEqual([
            { challenge_token: CHALLENGE_TOKEN, backup_code: BACKUP_CODES[0], trust_device: false, remember: false },
        ]);
    });

    test('a trusted device skips the 2FA prompt', async ({ app, page }) => {
        await page.addInitScript((deviceToken) => {
            window.localStorage.setItem('gftv_device_tess_wolf', deviceToken);
        }, DEVICE_TOKEN);
        await app.open();
        await app.settleHome();
        await app.navTo('Log In');
        await page.locator('#login-username').fill('Tess_Wolf');
        await page.locator('#login-password').fill(PASSWORD);
        await page.locator('#login-remember').check();
        await page.locator('#login-btn').click();
        await app.settleDashboard();
        expect(app.api.callsTo('POST /auth/login').map((call) => call.body)).toEqual([
            { username: 'Tess_Wolf', password: PASSWORD, device_token: DEVICE_TOKEN, remember: true },
        ]);
        expect(app.api.callsTo('POST /auth/totp-verify')).toHaveLength(0);
        const storage = await app.readStorage(['gftv_token']);
        expect(storage.gftv_token).toEqual({ local: TOKENS.twoFactor, session: null });
    });
});
