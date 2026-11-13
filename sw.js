// Bump on every deploy that changes anything the worker serves. The browser
// compares this file byte for byte: if nothing here changes, no update is
// detected and the update bar never appears, however much else has moved.
const VERSION = "v13";
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
  "/sw-update.js",
  "/manifest.json",
  "/favicon.ico",
  "/assets/fonts/ProximaNova-Regular.woff2",
  "/gftv-flag.png",
  "/gsl-main.png",
  "/gsl-180.png",
  "/gsl-192.png",
  "/gsl-512.png",
  "/gsl-192-maskable.png",
  "/gsl-512-maskable.png",
  "/gsl-qr.png",
  "/gsl-timg.png",
  "/images/screenshot_1.png",
  "/images/screenshot_2.png",
  "/404.html",
  "/404.css"
];

// The worker never promotes itself. It installs, then waits; the only thing
// that activates it is the "skip-waiting" message sent when a person presses
// Reload on the update bar. No skipWaiting() here, no clients.claim() in
// activate: either one would swap the site under a reader mid-session.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !CACHES.includes(key)).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("message", (event) => {
  // The page sends either a plain string or an object with a `type` field.
  let type;
  if (typeof event.data === "string") {
    type = event.data;
  } else {
    type = event.data?.type;
  }

  // The only place either of these is ever called.
  if (type === "skip-waiting") {
    event.waitUntil(self.skipWaiting().then(() => self.clients.claim()));
    return;
  }

  if (type === "CLEAR_API_CACHE") {
    event.waitUntil(caches.delete(API_CACHE));
  }
});

// Decides how each GET request is answered: API calls go network-first, shell
// files come from this version's precache, other cross-origin files use
// stale-while-revalidate, and everything else is left to the browser.
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Mutations always hit the network, they can't be meaningfully served offline
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    // The shell is served from this version's precache and nothing else, so a
    // reader stays on one consistent build until they accept the update. A
    // background refresh here would drift them onto a mixed build silently.
    if (SHELL_ASSETS.includes(url.pathname)) {
      event.respondWith(cacheFirst(request, SHELL_CACHE));
    }
    // Anything else on this origin is a short link slug (/abc) that has to
    // reach the redirect handler live, so it is left to the browser untouched.
    return;
  }

  // Cross-origin static (icon/QR CDN scripts): cache once, refresh in background
  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

// Cache-first: the precached shell for this version, network only if a shell
// path somehow was not precached (then cached for next time)
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

// Network-first: try live data first, fall back to the last cached response when offline
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

// Stale-while-revalidate: serve from cache instantly, refresh the cache in the background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetched = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fetched;
}
