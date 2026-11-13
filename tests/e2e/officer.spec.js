// A signed-in officer (an editor) with links: the dashboard and its modals
// (create, edit, QR, analytics), the directory and its search, a profile,
// ownership requests, the API key page, the profile tabs and 2FA set-up.
import { test, expect } from './support/test.js';
import { LINKS, USERS, TOTP_SECRET, BACKUP_CODES, NEW_API_KEY } from './support/fixtures.js';
import { VALID_TOTP_CODE } from './support/fake-api.js';

const [winterMeetup] = LINKS.officer;
const OTTER_ID = '44444444-4444-4444-8444-444444444444';

test.beforeEach(async ({ app }) => {
    await app.signInAs('officer');
    await app.open();
    await app.settleDashboard();
});

test.describe('dashboard', () => {
    test('dashboard with links', async ({ app, page }) => {
        await expect(page.locator('#dashboard-links-wrap tbody tr')).toHaveCount(3);
        await expect(page.locator('#dashboard-stats .stat-value')).toHaveText(['3', '2', '487']);
        expect(app.api.calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /auth/me', 'GET /links/mine']);
        await app.expectView('dashboard');
    });

    test('dashboard search, filters and sort', async ({ app, page }) => {
        const rows = page.locator('#dashboard-links-wrap tbody tr');
        const firstSlug = page.locator('#dashboard-links-wrap tbody tr .copy-btn').first();

        await page.locator('#dash-search-keyword').fill('disc');
        await app.runClock(250);
        await expect(rows).toHaveCount(1);
        await expect(firstSlug).toContainText('discord');
        await app.expectView('dashboard-search');

        await page.locator('#dash-search-keyword').fill('');
        await page.locator('#dash-search-tag').fill('meet');
        await app.runClock(250);
        await expect(rows).toHaveCount(1);
        await expect(firstSlug).toContainText('winter-meetup');

        await page.locator('#dash-search-tag').fill('');
        await app.runClock(250);
        await page.locator('#dash-filter-status').selectOption('inactive');
        await expect(rows).toHaveCount(1);
        await expect(firstSlug).toContainText('old-survey');
        await app.expectView('dashboard-filter-inactive');

        await page.locator('#dash-filter-status').selectOption('all');
        await page.locator('#dash-sort').selectOption('visits');
        await expect(page.locator('#dashboard-links-wrap tbody tr .copy-btn')).toContainText(['discord', 'winter-meetup', 'old-survey']);

        await page.locator('#dash-search-keyword').fill('zzz');
        await app.runClock(250);
        await expect(page.locator('#dashboard-links-wrap .empty-state h3')).toHaveText('No links match');
        await app.expectView('dashboard-no-match');
    });

    test('create link modal', async ({ app, page }) => {
        await page.locator('#page-dashboard button', { hasText: '+ New Link' }).click();
        await expect(page.locator('#modal-create-link')).toHaveClass(/\bopen\b/);
        await app.expectView('create-link-modal');

        await page.locator('#create-slug').fill('spring-sale');
        await page.locator('#create-dest').fill('https://shop.example.com/spring');
        const tagsInput = page.locator('#create-tags-container .tags-input');
        await tagsInput.click();
        await tagsInput.pressSequentially('promo');
        await tagsInput.press('Enter');
        await tagsInput.pressSequentially('winter,');
        await expect(page.locator('#create-tags-container .tag-chip')).toHaveCount(2);
        await app.expectView('create-link-modal-filled');

        await page.locator('#create-link-btn').click();
        await expect(page.locator('#modal-create-link')).not.toHaveClass(/\bopen\b/);
        await expect(page.locator('#toast-container')).toContainText('Link created!');
        expect(app.api.callsTo('POST /links').map((call) => call.body)).toEqual([
            { slug: 'spring-sale', destination: 'https://shop.example.com/spring', tags: ['promo', 'winter'] },
        ]);
        await expect.poll(() => app.api.callsTo('GET /links/mine').length).toBe(2);
    });

    test('edit link modal', async ({ app, page }) => {
        await page.locator('#dashboard-links-wrap tbody tr').first().locator('button[title="Edit link"]').click();
        await expect(page.locator('#modal-edit-link')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#edit-slug')).toHaveValue(winterMeetup.slug);
        await expect(page.locator('#edit-dest')).toHaveValue(winterMeetup.destination);
        await expect(page.locator('#edit-tags-container .tag-chip')).toHaveCount(2);
        await app.expectView('edit-link-modal');

        // A space in the new owner's username is caught before anything is sent.
        await page.locator('#edit-transfer-owner').fill('pip otter');
        await page.locator('#edit-link-btn').click();
        await expect(page.locator('#toast-container')).toContainText('No spaces are allowed in a username');
        await expect(page.locator('#edit-transfer-owner')).toHaveClass(/\bis-invalid\b/);
        expect(app.api.callsTo(`PUT /links/${winterMeetup.id}`)).toHaveLength(0);
        await app.expectView('edit-link-error-spaces');

        await page.locator('#edit-transfer-owner').fill('pip_otter');
        await page.locator('#edit-dest').fill('https://events.example.com/2026/winter-meetup-v2');
        await page.locator('#edit-link-btn').click();
        await expect(page.locator('#modal-edit-link')).not.toHaveClass(/\bopen\b/);
        await expect(page.locator('#toast-container')).toContainText('Link updated!');
        expect(app.api.callsTo(`PUT /links/${winterMeetup.id}`).map((call) => call.body)).toEqual([
            {
                slug: 'winter-meetup',
                destination: 'https://events.example.com/2026/winter-meetup-v2',
                tags: ['events', 'meetup'],
                new_owner_username: 'pip_otter',
            },
        ]);
    });

    test('QR code modal', async ({ app, page }) => {
        await page.locator('#dashboard-links-wrap tbody tr').first().locator('.qr-btn').click();
        await expect(page.locator('#modal-qr')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#qr-modal-subtitle')).toHaveText('https://gftv.asia/winter-meetup');
        await expect(page.locator('#qr-canvas-container canvas')).toBeVisible();
        await app.expectView('qr-modal');
    });

    test('analytics modal and its tabs', async ({ app, page }) => {
        await page.locator('#dashboard-links-wrap tbody tr').first().locator('button[title="View analytics"]').click();
        await expect(page.locator('#modal-analytics')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#analytics-total-clicks')).toHaveText('128 total clicks');
        await expect(page.locator('#analytics-modal-slug')).toHaveText('https://gftv.asia/winter-meetup');
        expect(app.api.callsTo('GET /links/analytics').map((call) => call.query)).toEqual([{ id: winterMeetup.id }]);
        await app.expectView('analytics-devices');

        await page.locator('.analytics-tab-btn[data-tab="clicks"]').click();
        await expect(page.locator('#analytics-tab-content svg[viewBox="0 0 520 160"] circle')).toHaveCount(7);
        await app.expectView('analytics-clicks');

        await page.locator('.analytics-tab-btn[data-tab="traffic"]').click();
        await expect(page.locator('#analytics-tab-content td[title="Fri 6pm: 14 clicks"]')).toHaveCount(1);
        await app.expectView('analytics-traffic');

        await page.locator('.analytics-tab-btn[data-tab="history"]').click();
        await expect(page.locator('#analytics-tab-content strong', { hasText: 'INACTIVE' })).toHaveCount(1);
        await app.expectView('analytics-history');
    });
});

test.describe('directory', () => {
    test.beforeEach(async ({ app, page }) => {
        await app.navTo('Directory');
        await expect(page.locator('#page-directory')).toHaveClass(/\bactive\b/);
        await expect(page.locator('#directory-table-wrap tbody tr')).toHaveCount(6);
    });

    test('directory as an officer', async ({ app, page }) => {
        expect(app.api.callsTo('GET /links').map((call) => call.query)).toEqual([{ q: '', type: 'keyword' }]);
        await expect(page.locator('#directory-table-wrap tbody tr', { hasText: 'You own this' })).toHaveCount(3);
        await expect(page.locator('#directory-table-wrap button', { hasText: 'Request Ownership' })).toHaveCount(3);
        await app.expectView('directory');
    });

    test('directory search, filters and sort', async ({ app, page }) => {
        const rows = page.locator('#directory-table-wrap tbody tr');

        // Keyword search also matches the author's name.
        await page.locator('#dir-search-keyword').fill('otter');
        await app.runClock(250);
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText('otter-zine');
        await app.expectView('directory-search');

        await page.locator('#dir-search-keyword').fill('');
        await page.locator('#dir-search-tag').fill('art');
        await app.runClock(250);
        await expect(rows).toHaveCount(2);
        await app.expectView('directory-filter-tag');

        await page.locator('#dir-search-tag').fill('');
        await app.runClock(250);
        await page.locator('#dir-filter-status').selectOption('inactive');
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText('old-survey');

        await page.locator('#dir-filter-status').selectOption('all');
        await page.locator('#dir-sort').selectOption('visits');
        await expect(page.locator('#directory-table-wrap tbody tr .copy-btn')).toContainText([
            'rules', 'discord', 'winter-meetup', 'otter-zine', 'art-gallery', 'old-survey',
        ]);

        await page.locator('#dir-search-keyword').fill('zzz');
        await app.runClock(250);
        await expect(page.locator('#directory-table-wrap .empty-state h3')).toHaveText('No links match');
        await app.expectView('directory-no-match');
    });

    test('a profile from the directory', async ({ app, page }) => {
        await page.locator('#directory-table-wrap td.td-user-clickable', { hasText: 'Pip Otter' }).click();
        await expect(page.locator('#modal-view-profile')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#view-profile-content .viewer-pill')).toHaveCount(2);
        expect(app.api.callsTo('POST /profile/views').map((call) => call.body)).toEqual([{ viewed_id: OTTER_ID }]);
        expect(app.api.callsTo('GET /profile/views').map((call) => call.query)).toEqual([{ profile_id: OTTER_ID }]);
        await app.expectView('directory-profile-modal');
    });
});

test('ownership requests page', async ({ app, page }) => {
    await app.navTo('Requests');
    await expect(page.locator('#page-ownership')).toHaveClass(/\bactive\b/);
    await expect(page.locator('#ownership-list button', { hasText: 'Approve' })).toHaveCount(1);
    await app.expectView('ownership-requests');
});

test('API integration page', async ({ app, page }) => {
    await app.navTo('API');
    await expect(page.locator('#page-apiintegration')).toHaveClass(/\bactive\b/);
    await expect(page.locator('#api-key-status')).toContainText('Last regenerated: 30 Oct 2026.');
    await expect(page.locator('#api-key-display')).toHaveAttribute('type', 'password');
    await app.expectView('api-integration');

    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#api-key-regen-btn').click();
    await expect(page.locator('#api-key-display')).toHaveValue(NEW_API_KEY);
    await expect(page.locator('#api-key-display')).toHaveAttribute('type', 'text');
    await expect(page.locator('#api-key-status')).toHaveText('Your new API key is shown above. Copy it now; it will be hidden once you leave this page.');
    expect(app.api.callsTo('POST /apikeys')).toHaveLength(1);
    await app.expectView('api-integration-regenerated');
});

test.describe('profile', () => {
    test.beforeEach(async ({ app, page }) => {
        await app.navTo('Profile');
        await expect(page.locator('#page-profile')).toHaveClass(/\bactive\b/);
        await expect(page.locator('#profile-viewers-wrap .viewer-pill')).toHaveCount(2);
    });

    test('profile page and its tabs', async ({ app, page }) => {
        expect(app.api.callsTo('GET /profile/views').map((call) => call.query)).toEqual([{ profile_id: USERS.officer.id }]);
        await expect(page.locator('#profile-display-name')).toHaveText('Kiri Fox');
        await expect(page.locator('#social-links-editor .social-link-row')).toHaveCount(2);
        await app.expectView('profile-edit', { fullPage: true });

        const tabs = page.locator('#page-profile .tabs .tab-btn');
        await tabs.filter({ hasText: 'Password' }).click();
        await expect(page.locator('#profile-tab-password')).toBeVisible();
        await app.expectView('profile-password', { fullPage: true });

        await tabs.filter({ hasText: '2FA' }).click();
        await expect(page.locator('#totp-disabled-view')).toBeVisible();
        await app.expectView('profile-2fa-off', { fullPage: true });

        await tabs.filter({ hasText: 'Danger Zone' }).click();
        await expect(page.locator('#trusted-devices-list button', { hasText: 'Remove' })).toHaveCount(2);
        await app.expectView('profile-danger', { fullPage: true });
    });

    test('danger zone modals', async ({ app, page }) => {
        await page.locator('#page-profile .tabs .tab-btn', { hasText: 'Danger Zone' }).click();
        await expect(page.locator('#trusted-devices-list button', { hasText: 'Remove' })).toHaveCount(2);

        await page.locator('#profile-tab-danger button', { hasText: 'Log Out All Devices' }).click();
        await expect(page.locator('#modal-logout-all')).toHaveClass(/\bopen\b/);
        await app.expectView('logout-all-modal');
        await page.locator('#modal-logout-all button', { hasText: 'Cancel' }).click();
        await expect(page.locator('#modal-logout-all')).not.toHaveClass(/\bopen\b/);

        await page.locator('#profile-tab-danger button', { hasText: 'Delete My Account' }).click();
        await expect(page.locator('#modal-delete-account')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#delete-step-text')).toHaveText('Are you sure you want to delete your account? All your links will also be deleted.');
        await app.expectView('delete-account-step-1');

        for (let step = 0; step < 3; step++) {
            await page.locator('#modal-delete-account button', { hasText: 'Continue →' }).click();
        }
        await expect(page.locator('#modal-delete-final')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#modal-delete-account')).not.toHaveClass(/\bopen\b/);
        await app.expectView('delete-account-final');
        expect(app.api.callsTo('DELETE /profile/delete')).toHaveLength(0);
        expect(app.api.callsTo('POST /auth/logout-all')).toHaveLength(0);
    });

    test('setting up 2FA', async ({ app, page }) => {
        await page.locator('#page-profile .tabs .tab-btn', { hasText: '2FA' }).click();
        await page.locator('#totp-disabled-view button', { hasText: 'Set Up 2FA' }).click();
        await expect(page.locator('#totp-setup-step1')).toBeVisible();
        await expect(page.locator('#totp-manual-key')).toHaveText(TOTP_SECRET);
        await expect(page.locator('#totp-qr-img')).toBeVisible();
        await expect.poll(() => page.locator('#totp-qr-img').evaluate((image) => image.complete && image.naturalWidth)).toBeGreaterThan(0);
        await app.expectView('2fa-setup-step1', { fullPage: true });

        await page.locator('#totp-next-btn').click();
        await app.runClock(100);
        await expect(page.locator('#totp-setup-step2')).toBeVisible();
        await expect(page.locator('#totp-verify-code')).toBeFocused();
        await app.expectView('2fa-setup-step2', { fullPage: true });

        // A short code is caught before anything is sent.
        await page.locator('#totp-verify-code').fill('12345');
        await page.locator('#totp-enable-btn').click();
        await expect(page.locator('#totp-enable-error')).toHaveText('Please enter the 6-digit code');
        expect(app.api.callsTo('POST /auth/totp-enable')).toHaveLength(0);

        await page.locator('#totp-verify-code').fill(VALID_TOTP_CODE);
        await page.locator('#totp-enable-btn').click();
        await expect(page.locator('#totp-setup-step3')).toBeVisible();
        await expect(page.locator('#backup-codes-grid code')).toHaveText(BACKUP_CODES);
        expect(app.api.callsTo('POST /auth/totp-enable').map((call) => call.body)).toEqual([
            { secret: TOTP_SECRET, code: VALID_TOTP_CODE },
        ]);
        await app.expectView('2fa-setup-step3', { fullPage: true });

        await page.locator('#totp-setup-step3 button', { hasText: "I've saved my codes. Done" }).click();
        await expect(page.locator('#totp-enabled-view')).toBeVisible();
        await expect(page.locator('#toast-container')).toContainText('2FA enabled successfully!');
    });
});

test.describe('menu in a narrow window', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('menu, signed in as an officer', async ({ app, page }) => {
        await page.locator('#hamburger-btn').click();
        await expect(page.locator('#mobile-nav')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#mobile-nav button')).toHaveText([
            'Directory', 'My Links', 'Requests', 'API', 'Profile', 'Logout',
        ]);
        await app.expectView('menu-mobile-officer');
    });
});
