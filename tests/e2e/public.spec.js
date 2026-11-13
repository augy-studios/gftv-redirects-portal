// Signed-out pages: home, the official banner, theme and menu, sign-in and
// registration with their validation, the waiting and pre-approved pages, and
// 404.html.
import { test, expect } from './support/test.js';
import { PASSWORD, TOKENS } from './support/fixtures.js';
import { PREAPPROVED_EMAIL } from './support/fake-api.js';

test.describe('home', () => {
    test('home page, signed out', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await expect(page.locator('#home-typing-slug')).toHaveText('we-care');
        await expect(page.locator('#home-stat-officers')).toHaveText('12');
        await expect(page.locator('#home-stat-links')).toHaveText('87');
        expect(app.api.calls.map((call) => `${call.method} ${call.path}`)).toEqual(['GET /stats']);
        await app.expectView('home', { fullPage: true });
    });

    test('official banner opens and remembers it', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await page.locator('#officialBarToggle').click();
        await app.runClock(50);
        await expect(page.locator('#officialBar')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#officialBarToggle')).toHaveAttribute('aria-expanded', 'true');
        const storage = await app.readStorage(['gftv-gftvlinks.officialBar']);
        expect(storage['gftv-gftvlinks.officialBar'].local).toBe('open');
        await app.expectView('official-banner-open');
    });
});

test.describe('theme', () => {
    test('theme picker: modes and colour themes', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        const root = page.locator('html');
        await expect(root).toHaveAttribute('data-color-theme', 'classic');
        await expect(root).toHaveAttribute('data-mode', 'light');

        await page.locator('#theme-picker-btn').click();
        await expect(page.locator('#modal-theme')).toHaveClass(/\bopen\b/);
        await expect(page.locator('[data-mode-option="light"]')).toHaveAttribute('aria-pressed', 'true');
        await app.expectView('theme-modal');

        await page.locator('[data-mode-option="dark"]').click();
        await expect(root).toHaveAttribute('data-mode', 'dark');
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111111');
        await app.expectView('theme-modal-dark');

        await page.locator('.theme-swatch[data-theme-id="hellotheme"]').click();
        await expect(root).toHaveAttribute('data-color-theme', 'hellotheme');
        await page.locator('[data-mode-option="time"]').click();
        await expect(root).toHaveAttribute('data-mode-preference', 'time');
        await expect(root).toHaveAttribute('data-mode', 'light');
        await expect(page.locator('#mode-note')).toHaveText("Light from 9:00 to 18:00 on this device's clock. Currently light.");
        await app.expectView('theme-modal-hellotheme-time');

        const storage = await app.readStorage(['gftv-gftvlinks.colorTheme', 'gftv-gftvlinks.mode']);
        expect(storage['gftv-gftvlinks.colorTheme'].local).toBe('hellotheme');
        expect(storage['gftv-gftvlinks.mode'].local).toBe('time');

        await page.locator('#modal-theme .appearance-close').click();
        await expect(page.locator('#modal-theme')).not.toHaveClass(/\bopen\b/);
        await app.expectView('home-hellotheme');
    });

    test('a stored dark preference is applied before the page paints', async ({ app, page }) => {
        await page.addInitScript(() => {
            window.localStorage.setItem('gftv-gftvlinks.colorTheme', 'classic');
            window.localStorage.setItem('gftv-gftvlinks.mode', 'dark');
        });
        await app.open();
        await app.settleHome();
        await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark');
        await app.expectView('home-dark');
    });
});

test.describe('menu in a narrow window', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('menu, signed out', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await expect(page.locator('#nav-links')).toBeHidden();
        await page.locator('#hamburger-btn').click();
        await expect(page.locator('#mobile-nav')).toHaveClass(/\bopen\b/);
        await expect(page.locator('#mobile-nav button')).toHaveText([
            'Send us feedback', 'Guide', 'Contribute', 'Log In', 'Register',
        ]);
        await app.expectView('menu-mobile-signed-out');
    });
});

test.describe('sign in', () => {
    test('login page and its validation', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await app.navTo('Log In');
        await expect(page.locator('#page-login')).toHaveClass(/\bactive\b/);
        await app.expectView('login');

        // A space in the username is caught before anything is sent.
        await page.locator('#login-username').fill('kiri fox');
        await page.locator('#login-password').fill(PASSWORD);
        await page.locator('#login-btn').click();
        await expect(page.locator('#login-error')).toHaveText('No spaces are allowed in your username or email');
        await expect(page.locator('#login-username')).toHaveClass(/\bis-invalid\b/);
        expect(app.api.callsTo('POST /auth/login')).toHaveLength(0);
        await app.expectView('login-error-spaces');

        // A wrong password shows the server's message.
        app.allowConsoleError(/status of 401/);
        await page.locator('#login-username').fill('kiri_fox');
        await page.locator('#login-password').fill('wrong-password');
        await page.locator('#login-btn').click();
        await expect(page.locator('#login-error')).toHaveText('Invalid credentials');
        await expect(page.locator('#login-btn')).toHaveText('Log In');
        await app.expectView('login-error-invalid');
    });

    for (const remember of [false, true]) {
        test(`logging in as an officer (stay logged in: ${remember})`, async ({ app, page }) => {
            await app.open();
            await app.settleHome();
            await app.navTo('Log In');
            await page.locator('#login-username').fill('kiri_fox');
            await page.locator('#login-password').fill(PASSWORD);
            if (remember) {
                await page.locator('#login-remember').check();
            }
            await page.locator('#login-btn').click();
            await app.settleDashboard();
            await expect(page.locator('#toast-container')).toContainText('Welcome back, Kiri Fox!');

            expect(app.api.callsTo('POST /auth/login').map((call) => call.body)).toEqual([
                { username: 'kiri_fox', password: PASSWORD, remember },
            ]);
            const storage = await app.readStorage(['gftv_token']);
            if (remember) {
                expect(storage.gftv_token).toEqual({ local: TOKENS.officer, session: null });
            } else {
                expect(storage.gftv_token).toEqual({ local: null, session: TOKENS.officer });
            }
            expect(app.api.callsTo('GET /links/mine')[0].token).toBe(TOKENS.officer);
        });
    }

    test('an account waiting for approval goes to the waiting page', async ({ app, page }) => {
        app.allowConsoleError(/status of 403/);
        await app.open();
        await app.settleHome();
        await app.navTo('Log In');
        await page.locator('#login-username').fill('new_raccoon');
        await page.locator('#login-password').fill(PASSWORD);
        await page.locator('#login-btn').click();
        await expect(page.locator('#page-pending')).toHaveClass(/\bactive\b/);
        await app.expectView('pending');
    });
});

test.describe('registration', () => {
    test('registration form and its validation', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await app.navTo('Register');
        await expect(page.locator('#page-register')).toHaveClass(/\bactive\b/);
        await app.expectView('register');

        await page.locator('#reg-username').fill('new fox');
        await page.locator('#reg-displayname').fill('New Fox');
        await page.locator('#reg-email').fill('fox@example.com');
        await page.locator('#reg-password').fill('Tr0ub4dor&3xyz');
        await page.locator('#reg-confirm').fill('Tr0ub4dor&3xyz');
        await expect(page.locator('#pwd-strength-bar')).toHaveAttribute('class', 'pwd-strength pwd-strength-4');
        await page.locator('#register-btn').click();
        await expect(page.locator('#register-error')).toHaveText('No spaces are allowed in your username');
        await expect(page.locator('#reg-username')).toHaveClass(/\bis-invalid\b/);
        await app.expectView('register-error-spaces');

        await page.locator('#reg-username').fill('new_fox');
        await page.locator('#reg-email').fill('not-an-email');
        await page.locator('#register-btn').click();
        await expect(page.locator('#register-error')).toHaveText('Please enter a valid email address');
        await app.expectView('register-error-email');

        await page.locator('#reg-email').fill('fox@example.com');
        await page.locator('#reg-password').fill('short');
        await expect(page.locator('#pwd-strength-bar')).toHaveAttribute('class', 'pwd-strength pwd-strength-0');
        await page.locator('#reg-confirm').fill('different');
        await page.locator('#register-btn').click();
        await expect(page.locator('#register-error')).toHaveText('Passwords do not match');
        await app.expectView('register-error-mismatch');

        expect(app.api.callsTo('POST /auth/register')).toHaveLength(0);
    });

    test('registering without a pre-approval goes to the waiting page', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await app.navTo('Register');
        await page.locator('#reg-username').fill('new_fox');
        await page.locator('#reg-displayname').fill('New Fox');
        await page.locator('#reg-email').fill('fox@example.com');
        await page.locator('#reg-password').fill('Tr0ub4dor&3xyz');
        await page.locator('#reg-confirm').fill('Tr0ub4dor&3xyz');
        await page.locator('#register-btn').click();
        await expect(page.locator('#page-pending')).toHaveClass(/\bactive\b/);
        await expect(page.locator('#toast-container')).toContainText('Account created! Waiting for admin approval.');
        expect(app.api.callsTo('POST /auth/register').map((call) => call.body)).toEqual([
            { username: 'new_fox', display_name: 'New Fox', email: 'fox@example.com', password: 'Tr0ub4dor&3xyz' },
        ]);
    });

    test('registering with a pre-approved email', async ({ app, page }) => {
        await app.open();
        await app.settleHome();
        await app.navTo('Register');
        await page.locator('#reg-username').fill('new_fox');
        await page.locator('#reg-displayname').fill('New Fox');
        await page.locator('#reg-email').fill(PREAPPROVED_EMAIL);
        await page.locator('#reg-password').fill('Tr0ub4dor&3xyz');
        await page.locator('#reg-confirm').fill('Tr0ub4dor&3xyz');
        await page.locator('#register-btn').click();
        await expect(page.locator('#page-preapproved')).toHaveClass(/\bactive\b/);
        await expect(page.locator('#preapproved-role-text')).toHaveText('Congratulations, you have been pre-approved with Editor access!');
        await expect(page.locator('#preapproved-cta-btn')).toHaveText('Go to Dashboard →');
        const storage = await app.readStorage(['gftv_token']);
        expect(storage.gftv_token).toEqual({ local: 'test-token-newcomer', session: null });
        await app.expectView('preapproved');

        // The new account has no links yet.
        await page.locator('#preapproved-cta-btn').click();
        await app.settleDashboard();
        await expect(page.locator('#dashboard-links-wrap .empty-state h3')).toHaveText('No links yet');
        await app.expectView('dashboard-empty');
    });
});

test('404 page', async ({ app, page }) => {
    await app.open('/404');
    await expect(page.locator('h1.title-text')).toHaveText('Page Not Found uwu');
    await app.expectView('404');
});
