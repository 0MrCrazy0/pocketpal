/* PocketPal Service Worker v2.10 */
const CACHE = 'pocketpal-v211';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req).then((resp) => {
        // Cache same-origin successful responses
        if (resp && resp.ok && req.url.startsWith(self.location.origin)) {
          const clone = resp.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone)).catch(() => {});
        }
        return resp;
      }).catch(() => cached || caches.match('./index.html'));

      // Prefer network, fall back to cache (good for updates)
      return fetched;
    })
  );
});
