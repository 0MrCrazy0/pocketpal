/* PocketPal Service Worker v2.18 */
const CACHE = 'pocketpal-v218';
const ASSETS = [
  './', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('pocketpal-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'POCKETPAL_NOTIFICATION') {
    const title = event.data.title || 'PocketPal';
    const options = event.data.options || {};
    event.waitUntil(self.registration.showNotification(title, options));
  }
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(fetch(req).then(resp => {
    if (resp && resp.ok && req.url.startsWith(self.location.origin)) {
      const clone = resp.clone(); caches.open(CACHE).then(cache => cache.put(req, clone)).catch(() => {});
    }
    return resp;
  }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html'))));
});
