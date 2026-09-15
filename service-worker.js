/* PocketPal Service Worker v3.10 */
const CACHE = 'pocketpal-v310';
const META = 'pocketpal-meta';
const ASSETS = [
  './', './index.html', './manifest.json',
  './icon-192.png', './icon-512.png', './icon.svg'
];
let snap = null;
let alarmTimer = 0;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('pocketpal-') && k !== CACHE && k !== META).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

async function writeSnap(data) {
  snap = data;
  try {
    const cache = await caches.open(META);
    await cache.put('/care-snapshot', new Response(JSON.stringify(data || {})));
  } catch (e) {}
}
async function readSnap() {
  if (snap) return snap;
  try {
    const cache = await caches.open(META);
    const res = await cache.match('/care-snapshot');
    if (res) snap = await res.json();
  } catch (e) {}
  return snap;
}
function projectedStat(v, last, step, now) {
  v = v | 0;
  if (v <= 0) return 0;
  if (!last || !step || step <= 0) return v;
  return Math.max(0, v - Math.floor((now - last) / step));
}
function dueAlarms(s, now) {
  if (!s || !s.enabled || s.paused || s.sleep) return [];
  const out = [];
  if (projectedStat(s.hunger, s.lastH, s.hungerMs || 20 * 60000, now) <= 1) {
    out.push({ type: 'hunger', title: 'PocketPal is hungry', body: 'Food is almost gone — time to feed.' });
  }
  if (projectedStat(s.happy, s.lastY, s.happyMs || 24 * 60000, now) <= 1) {
    out.push({ type: 'happy', title: 'PocketPal wants to play', body: 'Happy is almost gone — play a game.' });
  }
  if ((s.poopCount || 0) >= 2) {
    out.push({ type: 'poop', title: 'PocketPal made a mess', body: 'More than one pile — please clean.' });
  }
  if (s.sick) {
    out.push({ type: 'sick', title: 'PocketPal feels sick', body: 'I need medicine.' });
  }
  return out;
}
function nextWakeMs(s, now) {
  if (!s || !s.enabled || s.paused || s.sleep) return 0;
  const waits = [];
  if (s.hunger > 0 && s.lastH) waits.push((s.lastH + (s.hungerMs || 150000)) - now);
  if (s.happy > 0 && s.lastY) waits.push((s.lastY + (s.happyMs || 192000)) - now);
  const pos = waits.filter(t => t > 1000);
  return pos.length ? Math.min.apply(null, pos) : 0;
}
async function fireDue() {
  const s = await readSnap();
  const now = Date.now();
  const due = dueAlarms(s, now);
  for (const n of due) {
    const icon = new URL('icon-512.png', self.registration.scope).href;
    const badge = new URL('icon-192.png', self.registration.scope).href;
    await self.registration.showNotification(n.title, {
      body: n.body,
      icon: icon,
      badge: badge,
      tag: 'pocketpal-' + n.type,
      renotify: true,
      vibrate: [80, 40, 80],
      data: { url: './index.html?care=' + n.type, type: n.type, care: true }
    });
  }
  armAlarm();
}
function armAlarm() {
  if (alarmTimer) { clearTimeout(alarmTimer); alarmTimer = 0; }
  const s = snap;
  const wait = nextWakeMs(s, Date.now());
  if (!wait || wait > 30 * 60000) return;
  alarmTimer = setTimeout(() => { alarmTimer = 0; fireDue(); }, Math.min(wait, 10 * 60000));
}

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'POCKETPAL_NOTIFICATION') {
    const title = data.title || 'PocketPal';
    const options = data.options || {};
    event.waitUntil(self.registration.showNotification(title, options));
  }
  if (data.type === 'CARE_SNAPSHOT') {
    event.waitUntil(writeSnap(data).then(() => { armAlarm(); }));
  }
});
self.addEventListener('periodicsync', event => {
  if (event.tag === 'pocketpal-care') event.waitUntil(fireDue());
});
self.addEventListener('push', event => {
  let data = { title: 'PocketPal', body: 'Your pet needs care', type: 'care' };
  try {
    if (event.data) data = Object.assign(data, event.data.json());
  } catch (e) {}
  const title = data.title || 'PocketPal';
  const icon = new URL('icon-512.png', self.registration.scope).href;
  const badge = new URL('icon-192.png', self.registration.scope).href;
  const options = {
    body: data.body || 'Your pet needs care',
    icon: icon,
    badge: badge,
    tag: 'pocketpal-' + (data.type || 'care'),
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: './index.html?care=' + (data.type || 'care'), type: data.type || 'care', care: true }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener('notificationclick', event => {
  const note = event.notification;
  const type = (note.data && note.data.type) || '';
  note.close();
  const dest = new URL('./index.html', self.registration.scope);
  if (type) dest.searchParams.set('care', type);
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      try { c.postMessage({ type: 'CARE_OPEN', care: type }); } catch (e) {}
      if ('focus' in c) return c.focus();
    }
    if (clients.openWindow) return clients.openWindow(dest.href);
  })());
});
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached || caches.match('./index.html')))
  );
});
