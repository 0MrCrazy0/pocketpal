/* PocketPal 2 service worker - offline cache (only registered on http/https).
 * CACHE carries the game version: bump it with every release so players get the update.
 * A new version installs in the background and WAITS; the page shows "New version ready"
 * and sends {type:'skipWaiting'} when the player taps it. Old caches are deleted on activate. */
var CACHE = 'pocketpal2-v1.6.6';
var FILES = [
  './', 'index.html', 'manifest.json', 'css/style.css',
  'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png',
  'sprites/croc.png', 'sprites/lion.png', 'sprites/eagle.png', 'sprites/elephant.png', 'sprites/bear.png', 'sprites/wolf.png', 'sprites/fx.png', 'sprites/icons.png',
  'js/config.js', 'js/data/atlas.js',
  'js/core/util.js', 'js/core/data.js', 'js/core/time.js', 'js/core/sleep.js', 'js/core/pet.js', 'js/core/care.js', 'js/core/evolution.js', 'js/core/stats.js', 'js/core/skills.js',
  'js/core/battle.js', 'js/core/breeding.js', 'js/core/cards.js', 'js/core/arena.js', 'js/core/collection.js', 'js/core/shop.js', 'js/core/behaviour.js',
  'js/core/save.js', 'js/core/game.js',
  'js/ui/font.js', 'js/ui/sprites.js', 'js/ui/audio.js', 'js/ui/shells.js', 'js/ui/render.js', 'js/ui/battleview.js', 'js/ui/minigames.js', 'js/ui/menus.js',
  'js/ui/input.js', 'js/ui/testpanel.js', 'js/ui/net.js', 'js/ui/main.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () {
    if (!self.registration.active) return self.skipWaiting();   // very first install: take over straight away
  }));
});
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('pocketpal2-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // never cache the optional relay
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(function (hit) {
    if (hit) return hit;
    return fetch(req).then(function (res) {
      if (res && res.ok && res.type === 'basic') { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return req.mode === 'navigate' ? caches.match('index.html') : Response.error(); });
  }));
});
/* Optional care alerts: the relay sends an empty push, we show a generic reminder. */
self.addEventListener('push', function (e) {
  e.waitUntil(self.registration.showNotification('PocketPal 2', {
    body: 'Your pal needs you! Come and check on them.', icon: 'icon-192.png', badge: 'icon-192.png', tag: 'pp2-care', renotify: true
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
    return self.clients.openWindow('./');
  }));
});
