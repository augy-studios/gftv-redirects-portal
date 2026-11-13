// An account with 2FA on: the 2FA tab, the disable and regenerate modals,
// and signing in through the 2FA challenge.
import { test, expect } from './support/test.js';
import { PASSWORD, TOKENS, CHALLENGE_TOKEN, DEVICE_TOKEN, REGENERATED_BACKUP_CODES } from './support/fixtures.js';
import { VALID_TOTP_CODE } from './support/fake-api.js';

test.describe('profile with 2FA on', () => {
    test.beforeEach(async ({ app, page }) => {
        await app.signInAs('twoFactor');
        await app.open();
        await app.settleDashboard();
        await app.navTo('Profile');
        await expect(page.locator('#profile-viewers-wrap .viewer-pill')).toHaveCount(2);
        await page.locator('#page-profile .tabs .tab-btn', { hasText: '2FA' }).click();
        await expect(page.locator('#totp-enabled-view')).toBeVisible();
    });

    test('2FA tab', async ({ app, page }) => {
        await expect(page.locator('#totp-disabled-view')).toBeHidden();
        await app.expectView('profile-2fa-on', { fullPage: true });
    });

    test('disable 2FA modal', async ({ app, page }) => {
        await page.locator('#totp-enabled-view button', { hasText: 'Disable 2FA' }).click();
        await expect(page.locator('#modal-disable-2fa')).toHaveClass(/\bopen\b/);
        await app.expectView('disable-2fa-modal');

        app.allowConsoleError(/status of 401/);
        await page.locator('#disable-2fa-password').fill('wrong-password');
        await page.locator('#disable-2fa-btn').click();
        await expect(page.locator('#disable-2fa-error')).toHaveText('Incorrect password');
        await app.expectView('disable-2fa-error');

        await page.locator('#disable-2fa-password').fill(PASSWORD);
        await page.locator('#disable-2fa-btn').click();
        await expect(page.locator('#modal-disable-2fa')).not.toHaveClass(/\bopen\b/);
        await expect(page.locator('#totp-disabled-view')).toBeVisible();
        await expect(page.locator('#toast-container')).toContainText('2FA has been disabled.');
        expect(app.api.callsTo('POST /auth/totp-disable').map((call) => call.body)).toEqual([
            { password: 'wrong-password' },
            { password: PASSWORD },
        ]);
    });

    test('regenerate backup codes', async ({ app, page }) => {
        await page.locator('#totp-enabled-view button', { hasText: 'Regenerate Backup Codes' }).click();
        await expect(page.locator('#modal-regen-backup-codes')).toHaveClass(/\bopen\b/);
        await app.expectView('regen-backup-modal');

        await page.locator('#regen-backup-password').fill(PASSWORD);
        await page.locator('#regen-backup-btn').click();
        await expect(page.locator('#modal-backup-codes-display')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#modal-backup-codes-grid code')).toHaveText(REGENERATED_BACKUP_CODES);
        expect(app.api.callsTo('POST /auth/backup-codes-regenerate').map((call) => call.body)).toEqual([{ password: PASSWORD }]);
        await app.expectView('backup-codes-modal');
    });
});

test.describe('signing in with 2FA', () => {
    test.beforeEach(async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await app.navTo('Log In');
        await page.locator('#login-username').fill('tess_wolf');
        await page.locator('#login-password').fill(PASSWORD);
    });

    test('2FA challenge modal', async ({ app, page }) => {
        await page.locator('#login-btn').click();
        await expect(page.locator('#modal-totp-login')).toHaveClass(/\bopen\b/);
        // The overlay fades in from visibility: hidden, which can't take focus:
        // let it show (real time) before the page's 100ms focus timer runs.
        await expect(page.locator('#totp-login-code')).toBeVisible();
        await app.runClock(150);
        await expect(page.locator('#totp-login-code')).toBeFocused();
        expect(app.api.callsTo('POST /auth/login').map((call) => call.body)).toEqual([
            { username: 'tess_wolf', password: PASSWORD, remember: false },
        ]);
        await app.expectView('totp-login-modal');

        // An empty code is caught before anything is sent.
        await page.locator('#totp-login-btn').click();
        await expect(page.locator('#totp-login-error')).toHaveText('Please enter the 6-digit code');
        await app.expectView('totp-login-error');

        await page.locator('#totp-login-backup-section').waitFor({ state: 'hidden' });
        await page.locator('button', { hasText: 'Use a backup code instead' }).click();
        await app.runClock(100);
        await expect(page.locator('#totp-login-backup-section')).toBeVisible();
        await expect(page.locator('#totp-login-backup-code')).toBeFocused();
        await app.expectView('totp-login-backup');
        expect(app.api.callsTo('POST /auth/totp-verify')).toHaveLength(0);

        // Back to the app code; trust this device.
        await page.locator('button', { hasText: 'Use authenticator app instead' }).click();
        await page.locator('#totp-login-code').fill(VALID_TOTP_CODE);
        await page.locator('#totp-trust-device').check();
        await page.locator('#totp-login-btn').click();
        await app.settleDashboard();
        await expect(page.locator('#toast-container')).toContainText('Welcome back, Tess Wolf!');
        expect(app.api.callsTo('POST /auth/totp-verify').map((call) => call.body)).toEqual([
            { challenge_token: CHALLENGE_TOKEN, code: VALID_TOTP_CODE, trust_device: true, remember: false },
        ]);
        const storage = await app.readStorage(['gftv_token', 'gftv_device_tess_wolf']);
        expect(storage.gftv_token).toEqual({ local: null, session: TOKENS.twoFactor });
        expect(storage.gftv_device_tess_wolf.local).toBe(DEVICE_TOKEN);
    });
});
