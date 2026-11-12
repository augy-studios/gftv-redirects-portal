// Checks the app icons in a real browser, after `python3 tools/make-icons.py`.
//
//   node tools/check-icons.mjs [screenshot.png]
//
// Serves the project root on a local port, opens it in headless Chromium and
// checks, failing with a non-zero exit on any problem:
//
//   - every icon is the #fedc00 plate with its artwork centred on both axes
//   - no ink falls outside a circle crop: the inscribed circle for the "any"
//     icons, the 40% maskable safe zone for the maskable ones
//   - the manifest lists both purposes, every icon loads at its stated size
//   - each page's apple-touch-icon and favicon load
//   - the service worker installs, which only happens if every precached
//     file exists, and the new icons end up in its cache
//
// Pass a path to also save a contact sheet of every icon, cropped to a circle.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, dirname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PLATE = [254, 220, 0];
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain',
};

const ICONS = [
  { file: 'gsl-main.png', size: 2250, radius: 0.5 },
  { file: 'gsl-512.png', size: 512, radius: 0.5 },
  { file: 'gsl-192.png', size: 192, radius: 0.5 },
  { file: 'gsl-180.png', size: 180, radius: 0.5 },
  { file: 'gsl-512-maskable.png', size: 512, radius: 0.4 },
  { file: 'gsl-192-maskable.png', size: 192, radius: 0.4 },
];

// A plain static server: Vercel serves these files as-is, and nothing here
// needs the API or the rewrites.
const server = createServer(async (req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/') path = '/index.html';
  const file = normalize(join(ROOT, path));
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${server.address().port}`;

const failures = [];
const check = (ok, message) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${message}`);
  if (!ok) failures.push(message);
};

const browser = await chromium.launch();
const page = await browser.newPage();
// Keep third-party scripts (ads, analytics, CDNs) out of the test.
await page.route((url) => !url.href.startsWith(BASE), (route) => route.abort());
await page.goto(`${BASE}/robots.txt`);

// ---- Pixels: plate, centring and circle crop ----
for (const icon of ICONS) {
  const r = await page.evaluate(async ({ src, PLATE, radius }) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1, outside = 0, far = 0;
    const cx = w / 2, cy = h / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const diff = Math.abs(d[i] - PLATE[0]) + Math.abs(d[i + 1] - PLATE[1]) + Math.abs(d[i + 2] - PLATE[2]);
        if (diff <= 24) continue;
        x0 = Math.min(x0, x); x1 = Math.max(x1, x);
        y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        const dist = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        far = Math.max(far, dist);
        if (dist > radius * w) outside++;
      }
    }
    const corner = [d[0], d[1], d[2]];
    return { w, h, corner, left: x0, right: w - 1 - x1, top: y0, bottom: h - 1 - y1, outside, far: far / w };
  }, { src: `${BASE}/${icon.file}`, PLATE, radius: icon.radius });

  const tol = Math.max(1, Math.round(icon.size / 512));
  check(r.w === icon.size && r.h === icon.size, `${icon.file} is ${r.w}x${r.h}`);
  check(r.corner.every((v, i) => Math.abs(v - PLATE[i]) <= 1), `${icon.file} plate is #fedc00 (corner ${r.corner})`);
  check(Math.abs(r.left - r.right) <= tol,
    `${icon.file} centred horizontally (left ${r.left}, right ${r.right})`);
  check(Math.abs(r.top - r.bottom) <= tol,
    `${icon.file} centred vertically (top ${r.top}, bottom ${r.bottom})`);
  check(r.outside === 0,
    `${icon.file} ink inside a ${icon.radius * 100}% circle (farthest ${(r.far * 100).toFixed(1)}%)`);
}

// ---- Favicon decodes ----
const fav = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img.naturalWidth;
  // The query string matters: with request routing on, Playwright fails a
  // bare /favicon.ico request itself, before it reaches the server.
}, `${BASE}/favicon.ico?check`);
check(fav > 0, `favicon.ico decodes (${fav}px)`);

// ---- Manifest ----
const manifest = JSON.parse(await (await page.request.get(`${BASE}/manifest.json`)).text());
check(manifest.background_color === '#fedc00', `manifest background_color is ${manifest.background_color}`);
const purposes = new Set(manifest.icons.map((i) => i.purpose));
check(purposes.has('any') && purposes.has('maskable'), `manifest has any and maskable icons`);
for (const icon of manifest.icons) {
  const size = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    return `${img.naturalWidth}x${img.naturalHeight}`;
  }, new URL(icon.src, `${BASE}/`).href);
  check(size === icon.sizes, `manifest ${icon.src} (${icon.purpose}) loads at ${size}`);
}

// ---- Page links ----
for (const html of ['index.html', '404.html']) {
  const src = await readFile(join(ROOT, html), 'utf8');
  for (const rel of ['apple-touch-icon', 'icon']) {
    const href = src.match(new RegExp(`<link rel="${rel}" href="([^"]+)"`))?.[1];
    const res = href && await page.request.get(new URL(href, `${BASE}/`).href);
    check(res?.ok(), `${html} ${rel} -> ${href} (${res?.status()})`);
    if (rel === 'apple-touch-icon') check(href === '/gsl-180.png', `${html} apple-touch-icon is the 180 icon`);
  }
}

// ---- Service worker installs and precaches the icons ----
await page.goto(`${BASE}/`);
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.register('/sw.js');
  const worker = reg.installing || reg.waiting || reg.active;
  if (worker.state !== 'installed' && worker.state !== 'activated') {
    await new Promise((ok) => worker.addEventListener('statechange', () => {
      if (worker.state !== 'installing') ok();
    }));
  }
  const keys = [];
  for (const name of await caches.keys()) {
    for (const req of await (await caches.open(name)).keys()) keys.push(new URL(req.url).pathname);
  }
  return { state: worker.state, keys };
});
check(sw.state === 'installed' || sw.state === 'activated', `service worker installs (${sw.state})`);
for (const f of ['/gsl-180.png', '/gsl-192-maskable.png', '/gsl-512-maskable.png', '/favicon.ico']) {
  check(sw.keys.includes(f), `service worker precached ${f}`);
}

// ---- Optional contact sheet ----
const out = process.argv[2];
if (out) {
  const sheet = await browser.newPage({ viewport: { width: 1120, height: 620 } });
  const tile = (f, px, clip) =>
    `<figure><img src="${BASE}/${f}" width="${px}" height="${px}" style="${clip ? 'border-radius:50%' : ''}">` +
    `<figcaption>${f}${clip ? ' (circle)' : ''}</figcaption></figure>`;
  await sheet.setContent(`<body style="margin:0;padding:20px;background:#555;font:13px sans-serif;color:#fff;display:flex;flex-wrap:wrap;gap:20px;align-items:flex-end">
    ${tile('gsl-512.png', 240, false)}${tile('gsl-512.png', 240, true)}
    ${tile('gsl-512-maskable.png', 240, false)}${tile('gsl-512-maskable.png', 240, true)}
    ${tile('gsl-180.png', 180, true)}${tile('gsl-192-maskable.png', 96, true)}
    ${tile('favicon.ico', 32, false)}${tile('favicon.ico', 16, false)}</body>`);
  await sheet.waitForLoadState('networkidle');
  await sheet.screenshot({ path: out });
  console.log(`saved ${out}`);
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall icon checks passed');
