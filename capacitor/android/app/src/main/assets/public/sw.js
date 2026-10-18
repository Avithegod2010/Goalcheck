/* =========================================================
   GoalCheck service worker — offline-first app shell.
   ---------------------------------------------------------
   The app is 100% client-side: once the shell is cached,
   the app works with the network fully cut off. Strategy:

   - navigations (HTML): stale-while-revalidate — instant
     load from cache, refresh in background when online.
   - same-origin static assets (js/css/fonts/icons):
     cache-first (immutable hashed files), fall back to
     network, cache successful responses.
   - everything else: untouched (the app makes no API
     calls by design — privacy guarantee).

   Base-path aware: everything is resolved against the
   registration scope, so it works identically on
   localhost, the standalone server and GitHub Pages
   (/Goalcheck/).
   ========================================================= */

const CACHE = "gc-shell-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([new URL("./", self.registration.scope).href]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // privacy: never touch third-party

  const scopeUrl = new URL(self.registration.scope);
  const inScope = url.pathname.startsWith(scopeUrl.pathname);
  if (!inScope) return;

  // Navigations → stale-while-revalidate with offline cache fallback
  if (req.mode === "navigate") {
    const shellUrl = new URL("./", self.registration.scope).href;
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = (await cache.match(shellUrl)) || (await cache.match(req.url));
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(shellUrl, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // Static assets → cache-first, then network (+cache put)
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req.url);
      if (cached) return cached;
      try {
        const res = await fetch(req);
        if (res && res.ok && (res.type === "basic" || res.type === "default")) {
          cache.put(req.url, res.clone());
        }
        return res;
      } catch (err) {
        return cached || Response.error();
      }
    })
  );
});
