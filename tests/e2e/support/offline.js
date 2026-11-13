// Keeps the browser tests offline. Every request that leaves the local test
// server is answered here, so nothing reaches the network and no console
// errors come from blocked loads.
//
// The pages load these third-party files (index.html, 404.html):
//   - Google tag (gtag.js) and AdSense: empty scripts. The inline gtag()
//     snippet only pushes to window.dataLayer, which works without them.
//   - Font Awesome 6.5.2 (CSS from cdnjs, JS from use.fontawesome.com): empty.
//     Nothing on the pages uses a Font Awesome class; every icon is inline SVG.
//   - QRious 4.0.2 from jsDelivr: served from node_modules/qrious (the same
//     version, a dev dependency), because the QR modal draws with it.
// Anything else gets an empty stub of the right type and is recorded in
// `unexpected`, which fails the test: a new remote load should be added here
// on purpose.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const QRIOUS_SOURCE = readFileSync(require.resolve('qrious/dist/qrious.min.js'), 'utf8');

const EMPTY_SCRIPT = { contentType: 'text/javascript; charset=utf-8', body: '' };
const EMPTY_STYLESHEET = { contentType: 'text/css; charset=utf-8', body: '' };

// A 1x1 transparent PNG, for any remote image.
const TRANSPARENT_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
);

export const KNOWN_THIRD_PARTY = [
    { host: 'www.googletagmanager.com', path: '/gtag/js', stub: EMPTY_SCRIPT },
    { host: 'pagead2.googlesyndication.com', path: '/pagead/js/adsbygoogle.js', stub: EMPTY_SCRIPT },
    { host: 'cdnjs.cloudflare.com', path: '/ajax/libs/font-awesome/6.5.2/css/all.min.css', stub: EMPTY_STYLESHEET },
    { host: 'use.fontawesome.com', path: '/releases/v6.5.2/js/all.js', stub: EMPTY_SCRIPT },
    {
        host: 'cdn.jsdelivr.net',
        path: '/npm/qrious@4.0.2/dist/qrious.min.js',
        stub: { contentType: 'text/javascript; charset=utf-8', body: QRIOUS_SOURCE },
    },
];

// An empty answer of the right type for a request nobody planned for.
function fallbackStub(resourceType) {
    if (resourceType === 'script') return EMPTY_SCRIPT;
    if (resourceType === 'stylesheet') return EMPTY_STYLESHEET;
    if (resourceType === 'image') return { contentType: 'image/png', body: TRANSPARENT_PNG };
    if (resourceType === 'document') return { contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>stub</title>' };
    return { status: 204, contentType: 'text/plain; charset=utf-8', body: '' };
}

// Routes every non-local http(s) request to a stub. Returns the lists of
// third-party URLs that were requested (`requested`) and of those that were
// not in KNOWN_THIRD_PARTY (`unexpected`).
export async function stayOffline(page, baseURL) {
    const origin = new URL(baseURL).origin;
    const requested = [];
    const unexpected = [];

    await page.route((url) => url.protocol.startsWith('http') && url.origin !== origin, async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        requested.push(url.href);
        const known = KNOWN_THIRD_PARTY.find((entry) => entry.host === url.hostname && entry.path === url.pathname);
        let stub;
        if (known) {
            stub = known.stub;
        } else {
            unexpected.push(url.href);
            stub = fallbackStub(request.resourceType());
        }
        await route.fulfill({ status: 200, ...stub });
    });

    return { requested, unexpected };
}
