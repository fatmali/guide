/* The London Journal — service worker.
   Precache the whole shell so the guide opens with no signal.
   Content (HTML/JS/CSS) is network-first so edits show up the moment you're
   online; fonts and icons are cache-first because they never change.
   Maps are the only thing that need the outside world. */

const CACHE = "london-journal-v18";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./assets/fonts.css",
  "./assets/leaflet/leaflet.css",
  "./assets/leaflet/leaflet.js",
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

const putInCache = (req, resp) => {
  if (resp && resp.status === 200 && resp.type === "basic") {
    const copy = resp.clone();
    caches.open(CACHE).then((c) => c.put(req, copy));
  }
  return resp;
};

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch map deep links

  const isNav = request.mode === "navigate";
  // the app's own code + content — network-first so edits appear at once.
  // Leaflet is a pinned vendor lib (never changes), so leave it to cache-first.
  const contentFirst = (isNav || /\.(?:html|js|css|json|webmanifest)$/.test(url.pathname))
    && !url.pathname.includes("/assets/leaflet/");

  if (contentFirst) {
    e.respondWith(
      fetch(request)
        .then((resp) => putInCache(isNav ? "./index.html" : request, resp))
        .catch(() => caches.match(isNav ? "./index.html" : request).then((r) => r || caches.match("./index.html")))
    );
    return;
  }

  // fonts + icons — immutable, so cache-first is fastest
  e.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((resp) => putInCache(request, resp)).catch(() => cached)
    )
  );
});
