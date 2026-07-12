/* The London Journal — service worker.
   Precache the whole shell so the guide opens with no signal.
   Maps are the only thing that need the outside world. */

const CACHE = "london-journal-v1";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./assets/fonts.css",
  "./js/data.js",
  "./js/app.js",
  "./assets/favicon.svg",
  "./assets/icon-180.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-512-maskable.png",
  "./assets/fonts/cormorant-garamond-400.woff2",
  "./assets/fonts/cormorant-garamond-400-italic.woff2",
  "./assets/fonts/cormorant-garamond-500.woff2",
  "./assets/fonts/cormorant-garamond-600.woff2",
  "./assets/fonts/inter-400.woff2",
  "./assets/fonts/inter-500.woff2",
  "./assets/fonts/inter-600.woff2",
  "./assets/fonts/ibm-plex-mono-400.woff2",
  "./assets/fonts/ibm-plex-mono-500.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Never intercept map deep links or anything cross-origin.
  if (url.origin !== self.location.origin) return;

  // App navigations: serve the cached shell first, fall back to network.
  if (request.mode === "navigate") {
    e.respondWith(caches.match("./index.html").then((r) => r || fetch(request)));
    return;
  }

  // Cache-first for same-origin assets; fill the cache as we go.
  e.respondWith(
    caches.match(request).then((cached) =>
      cached ||
      fetch(request).then((resp) => {
        if (resp && resp.status === 200 && resp.type === "basic") {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return resp;
      }).catch(() => cached)
    )
  );
});
