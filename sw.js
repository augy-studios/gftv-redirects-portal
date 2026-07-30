const VERSION = "v5";
const SHELL_CACHE = "gftvlinks-shell-" + VERSION;
const API_CACHE = "gftvlinks-api-" + VERSION;
const RUNTIME_CACHE = "gftvlinks-runtime-" + VERSION;
const CACHES = [SHELL_CACHE, API_CACHE, RUNTIME_CACHE];

// App shell: everything the SPA needs to boot and render fully offline
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/script.js",
  "/ui.js",
  "/api.js",
  "/manifest.json",
  "/favicon.ico",
  "/gsl-main.png",
  "/gsl-192.png",
  "/gsl-512.png",
  "/gsl-qr.png",
  "/gsl-timg.png",
  "/images/screenshot_1.png",
  "/images/screenshot_2.png",
  "/404.html",
  "/404.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !CACHES.includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data === "CLEAR_API_CACHE") {
    event.waitUntil(caches.delete(API_CACHE));
  }
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Mutations always hit the network, they can't be meaningfully served offline
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
    return;
  }

  // Cross-origin static (fonts, icon/QR CDN scripts): cache once, refresh in background
  event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
});

// Network-first: try live data first, fall back to the last cached response when offline
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw err;
  }
}

// Stale-while-revalidate: serve from cache instantly, refresh the cache in the background
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetched = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => cached);
  return cached || fetched;
}
