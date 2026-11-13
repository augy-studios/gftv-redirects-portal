// The shared test harness: `test` and `expect` with an `app` fixture.
//
// Each test gets a fresh page that is offline (offline.js), talks to the
// faked API (fake-api.js), and runs on a paused clock fixed at FROZEN_TIME.
// Timers only fire when a test calls app.runClock(), so typing animations,
// counters, debounces and toasts land in the same state on every run.
//
// When the test ends, the fixture fails it if the page logged a console error
// or threw, asked for an API route the fake doesn't know, or loaded a
// third-party file offline.js doesn't know.
import { test as base, expect } from '@playwright/test';
import { installFakeApi } from './fake-api.js';
import { stayOffline } from './offline.js';
import { FROZEN_TIME, TOKENS } from './fixtures.js';

export { expect };

// Runs in the page. Writes the DOM as one line per element: tag, #id and
// sorted .classes, indented by depth. Inline <svg> icons are one line each,
// and a page or modal that isn't showing (.page without .active,
// .modal-overlay without .open) is one line with its contents left out, since
// it is the same static markup in every view. Elements that are in the tree
// but not rendered (display: none) are marked "(hidden)".
function serialiseDom() {
    const lines = [];
    const rootElement = document.documentElement;
    const themeAttributes = ['data-color-theme', 'data-mode', 'data-mode-preference']
        .map((name) => `[${name}=${rootElement.getAttribute(name)}]`)
        .join('');
    lines.push(`html${themeAttributes}`);

    function describe(element) {
        let line = element.tagName.toLowerCase();
        if (element.id) line += `#${element.id}`;
        const classes = [...element.classList].sort();
        if (classes.length > 0) line += `.${classes.join('.')}`;
        return line;
    }

    function isCollapsed(element) {
        if (element.classList.contains('page') && !element.classList.contains('active')) return true;
        if (element.classList.contains('modal-overlay') && !element.classList.contains('open')) return true;
        return false;
    }

    function walk(element, depth) {
        let line = '  '.repeat(depth) + describe(element);
        const tagName = element.tagName.toLowerCase();
        const isLeaf = tagName === 'svg' || tagName === 'script' || tagName === 'style';
        const collapsed = isCollapsed(element);
        if (collapsed) {
            line += ' …';
        } else if (tagName !== 'script' && tagName !== 'style' && getComputedStyle(element).display === 'none') {
            line += ' (hidden)';
        }
        lines.push(line);
        if (collapsed || isLeaf) return;
        for (const child of element.children) walk(child, depth + 1);
    }

    walk(document.body, 0);
    return `${lines.join('\n')}\n`;
}

// What each test drives the app through.
class AppHarness {
    constructor(page, baseURL) {
        this.page = page;
        this.baseURL = baseURL;
        this.consoleErrors = [];
        this.allowedConsoleErrors = [];
    }

    async setUp() {
        this.page.on('console', (message) => {
            if (message.type() === 'error') this.consoleErrors.push(message.text());
        });
        this.page.on('pageerror', (error) => {
            this.consoleErrors.push(`Uncaught: ${error.message}`);
        });
        this.thirdParty = await stayOffline(this.page, this.baseURL);
        this.api = await installFakeApi(this.page, this.baseURL);
        await this.page.clock.install({ time: FROZEN_TIME });
        await this.page.clock.pauseAt(FROZEN_TIME);
    }

    // Lets a test expect a console error, e.g. Chromium's "Failed to load
    // resource: ... 401" line when the fake API answers a request with 401.
    allowConsoleError(pattern) {
        this.allowedConsoleErrors.push(pattern);
    }

    // Starts the next page load signed in as a persona from fixtures.js
    // (officer, admin, twoFactor), the way a returning visitor arrives: with
    // the session token already in localStorage under its real key.
    async signInAs(persona) {
        await this.page.addInitScript((token) => {
            window.localStorage.setItem('gftv_token', token);
        }, TOKENS[persona]);
    }

    // Opens a path on the test server: the app, unless told otherwise.
    async open(path = '/') {
        await this.page.goto(path);
    }

    // Moves the paused clock forward, firing any timers that fall due.
    async runClock(milliseconds) {
        await this.page.clock.runFor(milliseconds);
    }

    // Toasts leave after 3s plus a 0.3s fade, on the page's clock. Run it past
    // that when a pile of toasts would cover the next thing to click.
    async dismissToasts() {
        await this.runClock(3400);
        await expect(this.page.locator('#toast-container .toast')).toHaveCount(0);
    }

    // The signed-out home page, settled: waits for the stats request, then
    // runs the clock in small steps until the three counters reach their
    // final values (about 1.2s of page time). The typing animation is then
    // paused on its first slug, "we-care", which it holds until 1.96s.
    async settleHome() {
        await expect(this.page.locator('#page-home')).toHaveClass(/\bactive\b/);
        await expect.poll(() => this.api.callsTo('GET /stats').length).toBe(1);
        await expect(async () => {
            await this.runClock(100);
            await expect(this.page.locator('#home-stat-clicks')).toHaveText('4,321', { timeout: 50 });
        }).toPass({ intervals: [50], timeout: 10_000 });
    }

    // The signed-in landing page for an editor: the dashboard with its table.
    async settleDashboard() {
        await expect(this.page.locator('#page-dashboard')).toHaveClass(/\bactive\b/);
        await expect(this.page.locator('#dashboard-links-wrap table, #dashboard-links-wrap .empty-state')).toBeVisible();
    }

    // Reads the app's browser storage keys, which must not change.
    async readStorage(keys) {
        return this.page.evaluate((storageKeys) => {
            const values = {};
            for (const key of storageKeys) {
                values[key] = {
                    local: window.localStorage.getItem(key),
                    session: window.sessionStorage.getItem(key),
                };
            }
            return values;
        }, keys);
    }

    // Clicks a button in the desktop navbar by its label.
    async navTo(label) {
        await this.page.locator('#nav-links button', { hasText: label }).click();
    }

    // Saves (or checks) the two baselines for a view: the DOM snapshot and
    // the screenshot. Pass { fullPage: true } for pages taller than the window.
    async expectView(name, { fullPage = false } = {}) {
        // Park the mouse on the banner so no hover style depends on the last click.
        await this.page.mouse.move(1, 1);
        await this.page.evaluate(() => document.fonts.ready.then(() => true));
        const dom = await this.page.evaluate(serialiseDom);
        expect(dom).toMatchSnapshot(`${name}.dom.txt`);
        await expect(this.page).toHaveScreenshot(`${name}.png`, { fullPage });
    }

    // Fails the test on anything that shouldn't have happened.
    assertClean() {
        const unexpectedErrors = this.consoleErrors.filter(
            (text) => !this.allowedConsoleErrors.some((pattern) => pattern.test(text)),
        );
        expect(unexpectedErrors, 'console errors').toEqual([]);
        expect(this.api.unhandled, 'API calls the fake does not know').toEqual([]);
        expect(this.thirdParty.unexpected, 'unplanned third-party loads').toEqual([]);
    }
}

export const test = base.extend({
    app: async ({ page, baseURL }, use) => {
        const app = new AppHarness(page, baseURL);
        await app.setUp();
        await use(app);
        app.assertClean();
    },
});
