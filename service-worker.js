/* PocketPal service worker - offline cache (only registered on http/https).
 * CACHE carries the game version: bump it with every release so players get the update.
 * A new version installs in the background and WAITS; the page shows "New version ready"
 * and sends {type:'skipWaiting'} when the player taps it. Old PocketPal caches are deleted on
 * activate (Cache Storage only: localStorage, i.e. the save, is never touched here).
 *
 * Fetch strategy (1.9.3, after "could not open app" on a reinstall that kept the site data):
 *  - NETWORK FIRST for every same-origin GET, with a cache fallback (ignoreSearch). Online you get
 *    the live files as one consistent version; offline you get this version's precache, also
 *    consistent. Fresh responses are never mixed into the cache.
 *  - A NAVIGATION always ends in the app page: network, else the cached index.html (any query
 *    string, e.g. a start_url with ?source=pwa), else an older PocketPal cache, else a small
 *    "offline" page - never a network error, which is what a launcher reports as "could not open".
 *    Any other in-scope page that fails or 404s is redirected to the app root.
 *  - Redirects are passed straight to the browser and never cached (a redirected response can't
 *    answer a navigation).
 *  - Install fetches with cache:'reload' (no stale HTTP-cached bytes), the code files must all
 *    arrive, the icons are best-effort so one changed/missing icon can't block an update. */
var CACHE = 'pocketpal-v2.3.18';
var FILES = [
  './', 'index.html', 'manifest.json', 'css/style.css', 'fonts/pp-lcd.woff',
  'sprites/croc.png', 'sprites/lion.png', 'sprites/eagle.png', 'sprites/elephant.png', 'sprites/bear.png', 'sprites/wolf.png', 'sprites/fx.png', 'sprites/icons.png',
  'js/config.js', 'js/data/atlas.js', 'js/data/glyphs.js',
  'js/core/util.js', 'js/core/data.js', 'js/core/time.js', 'js/core/sleep.js', 'js/core/pet.js', 'js/core/care.js', 'js/core/evolution.js', 'js/core/stats.js', 'js/core/skills.js',
  'js/core/battle.js', 'js/core/breeding.js', 'js/core/cards.js', 'js/core/arena.js', 'js/core/collection.js', 'js/core/shop.js', 'js/core/daily.js', 'js/core/hints.js', 'js/core/behaviour.js',
  'js/core/save.js', 'js/core/game.js', 'js/core/cloud.js', 'js/core/reminders.js', 'js/core/live.js',
  'js/ui/font.js', 'js/ui/sprites.js', 'js/ui/audio.js', 'js/ui/shells.js', 'js/ui/render.js', 'js/ui/battleview.js', 'js/ui/minigames.js', 'js/ui/menus.js',
  'js/ui/input.js', 'js/ui/testpanel.js', 'js/ui/admin.js', 'js/ui/net.js', 'js/ui/live.js', 'js/ui/cloudsync.js', 'js/ui/favicon.js', 'js/ui/main.js'
];
var ICONS = ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'badge-96.png'];
var SLOW_MS = 4000;   // a hanging network (lie-fi) falls back to the cache after this long

function isOurs(k) { return k.indexOf('pocketpal-') === 0 || k.indexOf('pocketpal2-') === 0; }
function plain(res) {   // drop the "redirected" flag so the copy can serve a navigation
  if (!res.redirected) return Promise.resolve(res);
  return res.blob().then(function (b) { return new Response(b, { status: res.status, statusText: res.statusText, headers: res.headers }); });
}
function grab(c, url) {
  return fetch(new Request(url, { cache: 'reload' })).then(function (res) {
    if (!res.ok) throw new Error(url + ' ' + res.status);
    return plain(res).then(function (r) { return c.put(url, r); });
  });
}
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(FILES.map(function (u) { return grab(c, u); }))
      .then(function () { return Promise.all(ICONS.map(function (u) { return grab(c, u).catch(function () {}); })); });
  }).then(function () {
    if (!self.registration.active) return self.skipWaiting();   // very first install: take over straight away
  }));
});
self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && isOurs(k); }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

/* this version's cache first, then any older PocketPal cache that is still around */
function cached(key) {
  var o = { ignoreSearch: true };
  return caches.open(CACHE).then(function (c) { return c.match(key, o); }).then(function (hit) {
    if (hit) return hit;
    return caches.keys().then(function (keys) {
      keys = keys.filter(function (k) { return k !== CACHE && isOurs(k); }).sort().reverse();
      return keys.reduce(function (p, k) {
        return p.then(function (h) { return h || caches.open(k).then(function (c) { return c.match(key, o); }); });
      }, Promise.resolve(undefined));
    });
  });
}
function appPage() {
  return cached('index.html').then(function (h) { return h || cached('./'); });
}
function offlinePage() {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width">' +
    '<title>PocketPal</title><body style="background:#1a1a2e;color:#fff;font:16px sans-serif;text-align:center;padding:40px 16px">' +
    '<p>PocketPal needs the internet once to finish installing.</p><p>Your pal is safe - connect and <a style="color:#e85a71" href="./">try again</a>.</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
function isAppUrl(u) {   // the scope itself or its index.html, any query string
  var p = new URL(u).pathname, s = new URL(self.registration.scope).pathname;
  return p === s || p === s + 'index.html';
}
function respond(req) {
  var nav = req.mode === 'navigate';
  // an in-scope page that isn't the app (old link, typo) goes to the app root: serving index.html at a deeper
  // path would break every relative script URL
  var fallback = nav ? function () {
    if (!isAppUrl(req.url)) return Promise.resolve(Response.redirect(self.registration.scope, 302));
    return appPage().then(function (h) { return h || offlinePage(); });
  } : function () { return cached(req); };
  return new Promise(function (resolve) {
    var done = false;
    function finish(r) { if (!done && r) { done = true; resolve(r); } }
    var timer = setTimeout(function () { (nav ? (isAppUrl(req.url) ? appPage() : Promise.resolve()) : cached(req)).then(finish); }, SLOW_MS);
    fetch(req).then(function (res) {
      if (res.type === 'opaqueredirect') return res;                 // let the browser follow it (e.g. /pocketpal -> /pocketpal/)
      if (res.ok) return nav ? plain(res) : res;
      return fallback().then(function (h) { return h || res; });     // a 404/5xx: use the cached copy if we have one
    }).catch(function () {
      return fallback().then(function (h) { return h || Response.error(); });
    }).then(function (r) { clearTimeout(timer); finish(r); });
  });
}
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return; // never cache the optional relay
  e.respondWith(respond(req));
});
/* Optional care alerts. The worker sends an EMPTY push (it only knows times). 1.9.7: the game
 * keeps its own copy of the schedule (time + wording) in a small cache on this device, so the
 * notification can say what the pal needs. periodicsync (Chromium, installed app, roughly
 * hourly at best) is an optional fallback that shows a reminder that came due while closed. */
var SCHED_CACHE = 'ppalerts-sched', SCHED_KEY = './__pp_alert_schedule';
var GENERIC = 'Your pal needs you! Come and check on them.';
function readSched() {
  return caches.open(SCHED_CACHE).then(function (c) { return c.match(SCHED_KEY); })
    .then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
}
function writeSched(o) {
  return caches.open(SCHED_CACHE).then(function (c) { return c.put(SCHED_KEY, new Response(JSON.stringify(o), { headers: { 'Content-Type': 'application/json' } })); }).catch(function () {});
}
function pickEntry(list, now) {        /* same rule as PP.Reminders.pick */
  var best = null;
  (list || []).forEach(function (e) {
    var d = e.at - now;
    if (d > 20 * 60e3 || d < -3 * 3600e3) return;
    if (!best || Math.abs(d) < Math.abs(best.at - now)) best = e;
  });
  return best;
}
function notify(body) {
  return self.registration.showNotification('PocketPal', { body: body, icon: 'icon-192.png', badge: 'badge-96.png', tag: 'pp-care', renotify: true });
}
self.addEventListener('push', function (e) {
  e.waitUntil(readSched().then(function (s) {
    var hit = s && pickEntry(s.list, Date.now());
    return notify(hit && hit.text ? hit.text : GENERIC);
  }));
});
self.addEventListener('periodicsync', function (e) {
  if (e.tag !== 'pp-remind') return;
  e.waitUntil(readSched().then(function (s) {
    if (!s || !s.local || !Array.isArray(s.list)) return;
    var now = Date.now(), due = s.list.filter(function (x) { return x.at <= now && x.at > (s.shown || 0); });
    if (!due.length) return;
    s.shown = now;
    return writeSched(s).then(function () { return notify(due[due.length - 1].text || GENERIC); });
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
    return self.clients.openWindow('./');
  }));
});
