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
const server = createServer(async (request, response) => {
  let requestPath = decodeURIComponent(new URL(request.url, 'http://x').pathname);
  if (requestPath === '/') requestPath = '/index.html';
  const filePath = normalize(join(ROOT, requestPath));
  // Refuse anything that resolves outside the project folder.
  if (!filePath.startsWith(ROOT)) { response.writeHead(403).end(); return; }
  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': TYPES[extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const BASE_URL = `http://127.0.0.1:${server.address().port}`;

const failures = [];
// Prints one check result and remembers it if it failed.
const check = (passed, message) => {
  let label = 'FAIL';
  if (passed) {
    label = 'ok  ';
  }
  console.log(`${label} ${message}`);
  if (!passed) failures.push(message);
};

const browser = await chromium.launch();
const page = await browser.newPage();
// Keep third-party scripts (ads, analytics, CDNs) out of the test.
await page.route((url) => !url.href.startsWith(BASE_URL), (route) => route.abort());
await page.goto(`${BASE_URL}/robots.txt`);

// ---- Pixels: plate, centring and circle crop ----
for (const icon of ICONS) {
  // Runs in the page: draws the icon on a canvas and measures the painted area.
  const measured = await page.evaluate(async ({ src, PLATE, radius }) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    const width = image.naturalWidth, height = image.naturalHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const canvasContext = canvas.getContext('2d', { willReadFrequently: true });
    canvasContext.drawImage(image, 0, 0);
    const pixels = canvasContext.getImageData(0, 0, width, height).data;
    let minX = width, minY = height, maxX = -1, maxY = -1, outside = 0, farthest = 0;
    const centreX = width / 2, centreY = height / 2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = (y * width + x) * 4;
        const difference = Math.abs(pixels[index] - PLATE[0]) + Math.abs(pixels[index + 1] - PLATE[1]) + Math.abs(pixels[index + 2] - PLATE[2]);
        if (difference <= 24) continue;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        const distance = Math.hypot(x + 0.5 - centreX, y + 0.5 - centreY);
        farthest = Math.max(farthest, distance);
        if (distance > radius * width) outside++;
      }
    }
    const corner = [pixels[0], pixels[1], pixels[2]];
    return { width, height, corner, left: minX, right: width - 1 - maxX, top: minY, bottom: height - 1 - maxY, outside, farthest: farthest / width };
  }, { src: `${BASE_URL}/${icon.file}`, PLATE, radius: icon.radius });

  const tolerance = Math.max(1, Math.round(icon.size / 512));
  check(measured.width === icon.size && measured.height === icon.size, `${icon.file} is ${measured.width}x${measured.height}`);
  check(measured.corner.every((value, channel) => Math.abs(value - PLATE[channel]) <= 1), `${icon.file} plate is #fedc00 (corner ${measured.corner})`);
  check(Math.abs(measured.left - measured.right) <= tolerance,
    `${icon.file} centred horizontally (left ${measured.left}, right ${measured.right})`);
  check(Math.abs(measured.top - measured.bottom) <= tolerance,
    `${icon.file} centred vertically (top ${measured.top}, bottom ${measured.bottom})`);
  check(measured.outside === 0,
    `${icon.file} ink inside a ${icon.radius * 100}% circle (farthest ${(measured.farthest * 100).toFixed(1)}%)`);
}

// ---- Favicon decodes ----
const faviconWidth = await page.evaluate(async (src) => {
  const image = new Image();
  image.src = src;
  await image.decode();
  return image.naturalWidth;
  // The query string matters: with request routing on, Playwright fails a
  // bare /favicon.ico request itself, before it reaches the server.
}, `${BASE_URL}/favicon.ico?check`);
check(faviconWidth > 0, `favicon.ico decodes (${faviconWidth}px)`);

// ---- Manifest ----
const manifest = JSON.parse(await (await page.request.get(`${BASE_URL}/manifest.json`)).text());
check(manifest.background_color === '#fedc00', `manifest background_color is ${manifest.background_color}`);
const purposes = new Set(manifest.icons.map((manifestIcon) => manifestIcon.purpose));
check(purposes.has('any') && purposes.has('maskable'), `manifest has any and maskable icons`);
for (const icon of manifest.icons) {
  const loadedSize = await page.evaluate(async (src) => {
    const image = new Image();
    image.src = src;
    await image.decode();
    return `${image.naturalWidth}x${image.naturalHeight}`;
  }, new URL(icon.src, `${BASE_URL}/`).href);
  check(loadedSize === icon.sizes, `manifest ${icon.src} (${icon.purpose}) loads at ${loadedSize}`);
}

// ---- Page links ----
for (const html of ['index.html', '404.html']) {
  const source = await readFile(join(ROOT, html), 'utf8');
  for (const relation of ['apple-touch-icon', 'icon']) {
    const href = source.match(new RegExp(`<link rel="${relation}" href="([^"]+)"`))?.[1];
    const response = href && await page.request.get(new URL(href, `${BASE_URL}/`).href);
    check(response?.ok(), `${html} ${relation} -> ${href} (${response?.status()})`);
    if (relation === 'apple-touch-icon') check(href === '/gsl-180.png', `${html} apple-touch-icon is the 180 icon`);
  }
}

// ---- Service worker installs and precaches the icons ----
await page.goto(`${BASE_URL}/`);
const serviceWorker = await page.evaluate(async () => {
  const registration = await navigator.serviceWorker.register('/sw.js');
  const worker = registration.installing || registration.waiting || registration.active;
  // Wait until the worker has finished installing.
  if (worker.state !== 'installed' && worker.state !== 'activated') {
    await new Promise((resolve) => worker.addEventListener('statechange', () => {
      if (worker.state !== 'installing') resolve();
    }));
  }
  const keys = [];
  for (const name of await caches.keys()) {
    for (const cachedRequest of await (await caches.open(name)).keys()) keys.push(new URL(cachedRequest.url).pathname);
  }
  return { state: worker.state, keys };
});
check(serviceWorker.state === 'installed' || serviceWorker.state === 'activated', `service worker installs (${serviceWorker.state})`);
for (const file of ['/gsl-180.png', '/gsl-192-maskable.png', '/gsl-512-maskable.png', '/favicon.ico']) {
  check(serviceWorker.keys.includes(file), `service worker precached ${file}`);
}

// ---- Optional contact sheet ----
const outputPath = process.argv[2];
if (outputPath) {
  const sheet = await browser.newPage({ viewport: { width: 1120, height: 620 } });
  // One labelled tile for the contact sheet, optionally cropped to a circle.
  const tile = (file, pixels, clip) => {
    let style = '';
    let caption = file;
    if (clip) {
      style = 'border-radius:50%';
      caption = `${file} (circle)`;
    }
    return `<figure><img src="${BASE_URL}/${file}" width="${pixels}" height="${pixels}" style="${style}">` +
      `<figcaption>${caption}</figcaption></figure>`;
  };
  await sheet.setContent(`<body style="margin:0;padding:20px;background:#555;font:13px sans-serif;color:#fff;display:flex;flex-wrap:wrap;gap:20px;align-items:flex-end">
    ${tile('gsl-512.png', 240, false)}${tile('gsl-512.png', 240, true)}
    ${tile('gsl-512-maskable.png', 240, false)}${tile('gsl-512-maskable.png', 240, true)}
    ${tile('gsl-180.png', 180, true)}${tile('gsl-192-maskable.png', 96, true)}
    ${tile('favicon.ico', 32, false)}${tile('favicon.ico', 16, false)}</body>`);
  await sheet.waitForLoadState('networkidle');
  await sheet.screenshot({ path: outputPath });
  console.log(`saved ${outputPath}`);
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall icon checks passed');
