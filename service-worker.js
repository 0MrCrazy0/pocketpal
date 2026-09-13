/* PocketPal Service Worker v2.66 */
const CACHE = 'pocketpal-v266';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon.svg'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('pocketpal-') && k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'POCKETPAL_NOTIFICATION') {
    const title = event.data.title || 'PocketPal';
    const options = event.data.options || {};
    event.waitUntil(self.registration.showNotification(title, options));
  }
});
self.addEventListener('push', event => {
  let data = { title: 'PocketPal', body: 'Your pet needs care', type: 'care' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {}
  const title = data.title || 'PocketPal';
  const options = {
    body: data.body || 'Your pet needs care',
    icon: './icon-512.png',
    badge: './icon-192.png',
    image: './icon-512.png',
    tag: 'pocketpal-' + (data.type || 'care'),
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: './index.html', type: data.type || 'care', care: true }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c && (c.url.includes('index.html') || c.url.endsWith('/') || c.url.includes('pocketpal'))) {
          return c.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    fetch(req).then(resp => {
      if (resp && resp.ok && req.url.startsWith(self.location.origin)) {
        const clone = resp.clone();
        caches.open(CACHE).then(cache => cache.put(req, clone)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match(req).then(cached => cached || caches.match('./index.html')))
  );
});
