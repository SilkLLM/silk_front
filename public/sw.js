/*
 * sw.js
 * SilkLLM service worker.
 *
 * Three rules, and the reasoning behind each:
 *
 *  - API traffic is never cached. Responses carry balances, keys and per-user
 *    ledgers; a shared cache on a shared device would serve one person's numbers
 *    to the next. Network only, no exceptions.
 *
 *  - Build assets are cache-first. Vite content-hashes their filenames, so a
 *    cached asset can never be stale: a new build produces a new URL.
 *
 *  - Navigations are network-first with a cached shell fallback. That keeps the
 *    app launchable with no connection while never showing a stale page when
 *    the network is there.
 *
 * Bump CACHE_VERSION to evict everything on the next activation.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `silk-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `silk-assets-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

// The minimum needed to boot the app with no network. Hashed bundles are added
// at runtime as they are requested, because their names are not known here.
const SHELL_FILES = [
  "/",
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/logo-mark.png",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // addAll rejects the whole batch if any single file 404s, which would
      // leave the worker uninstalled. Failures are tolerated individually.
      .then((cache) => Promise.allSettled(SHELL_FILES.map((f) => cache.add(f))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("silk-") && k !== SHELL_CACHE && k !== ASSET_CACHE)
          .map((k) => caches.delete(k)),
      );
      // Navigation preload lets the browser start the network request before
      // this worker has finished booting, which removes the usual SW cold-start
      // penalty on the first navigation.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

/** Let the page tell a waiting worker to take over immediately. */
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const isApi = (url) => url.pathname.startsWith("/api/");
const isAsset = (url) =>
  url.pathname.startsWith("/assets/") ||
  /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|svg|gif|webp|avif|ico)$/i.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only GET is cacheable, and only same-origin traffic is ours to manage.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache authenticated data.
  if (isApi(url)) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          if (preloaded) {
            cachePut(SHELL_CACHE, "/", preloaded.clone());
            return preloaded;
          }
          const fresh = await fetch(request);
          // Keep the latest shell so a cold offline launch has something to run.
          cachePut(SHELL_CACHE, "/", fresh.clone());
          return fresh;
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          // The SPA serves every route from one document, so the cached root is
          // a valid response for any path.
          return (await cache.match("/")) || (await cache.match(OFFLINE_URL)) || Response.error();
        }
      })(),
    );
    return;
  }

  if (isAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return hit || Response.error();
        }
      })(),
    );
  }
});

function cachePut(cacheName, key, response) {
  if (!response || !response.ok) return;
  caches.open(cacheName).then((c) => c.put(key, response)).catch(() => {});
}

/* EOF silkllm-frontend/public/sw.js */
