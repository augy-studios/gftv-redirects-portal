// Playwright baseline for GFTV Shortlinks ("same behaviour, new names").
//
//   npm run test:e2e                          run the suite
//   npx playwright test --update-snapshots    rewrite the baselines (only on purpose)
//
// The suite runs offline against tests/serve.js, with the API faked in the
// browser (tests/e2e/support/fake-api.js) and every third-party load stubbed
// (tests/e2e/support/offline.js). Chromium only, headless, one viewport, a
// fixed clock, time zone and locale, so the screenshots are reproducible.
//
// Baselines:
//   tests/e2e/baselines/dom/          DOM snapshots (tags, ids, classes), any OS
//   tests/e2e/baselines/screenshots/  screenshots, suffixed with the OS they were
//                                     taken on (-darwin = the Mac mini)
import { createServer } from 'node:net';
import { defineConfig, devices } from '@playwright/test';

// A free port for tests/serve.js, picked once in the runner process. Workers
// load this file again, but inherit the runner's environment, so they all see
// the same port.
async function findFreePort() {
    return new Promise((resolve, reject) => {
        const probe = createServer();
        probe.unref();
        probe.on('error', reject);
        probe.listen(0, '127.0.0.1', () => {
            const { port } = probe.address();
            probe.close(() => resolve(port));
        });
    });
}

if (!process.env.GFTV_E2E_PORT) {
    process.env.GFTV_E2E_PORT = String(await findFreePort());
}
const port = Number(process.env.GFTV_E2E_PORT);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.spec.js',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    reporter: [['list']],
    timeout: 30_000,

    // DOM snapshots are plain text and the same on every OS.
    snapshotPathTemplate: '{testDir}/baselines/dom/{testFileName}/{arg}{ext}',

    expect: {
        timeout: 5_000,
        toHaveScreenshot: {
            pathTemplate: '{testDir}/baselines/screenshots/{testFileName}/{arg}{-platform}{ext}',
            maxDiffPixelRatio: 0.01,
            animations: 'disabled',
            caret: 'hide',
            scale: 'css',
        },
    },

    use: {
        baseURL,
        headless: true,
        viewport: { width: 1280, height: 800 },
        deviceScaleFactor: 1,
        colorScheme: 'light',
        reducedMotion: 'reduce',
        locale: 'en-SG',
        timezoneId: 'Asia/Singapore',
        serviceWorkers: 'block',
        trace: 'retain-on-failure',
    },

    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1280, height: 800 },
                deviceScaleFactor: 1,
            },
        },
    ],

    webServer: {
        command: `node tests/serve.js --port ${port}`,
        url: `${baseURL}/`,
        reuseExistingServer: false,
        stdout: 'ignore',
        stderr: 'pipe',
        timeout: 15_000,
    },
});
