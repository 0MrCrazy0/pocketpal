/* PocketPal - care alerts (1.9.7 smarter reminders) via YOUR Cloudflare worker.
 * The game plans the next reminders itself (PP.Reminders) and uploads ONLY their times; the
 * wording stays on this device (a small cache the service worker reads when a push arrives).
 * Without a worker it falls back, where the browser has them, to local Notification Triggers
 * (scheduled on the device) or periodic background sync (Chromium, installed app, coarse). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var SCHED_CACHE = 'ppalerts-sched', SCHED_KEY = './__pp_alert_schedule';
  function cfg() { return PP.CONFIG || {}; }
  function enabled() { return !!cfg().relayUrl && /^https:\/\//.test(cfg().relayUrl) && typeof fetch === 'function'; }
  function api(path, body) {
    if (!cfg().relayUrl) return Promise.reject(new Error('no worker url'));
    return fetch(cfg().relayUrl + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); });
  }
  function b64uToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); var raw = atob(s + '==='.slice((s.length + 3) % 4)); var a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  function sameKey(sub, key) {      // unknown (old browsers) counts as the same
    var k = sub && sub.options && sub.options.applicationServerKey;
    if (!k) return true;
    var a = new Uint8Array(k);
    if (a.length !== key.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== key[i]) return false;
    return true;
  }
  function pushReady() { return !!(cfg().vapidPublicKey && cfg().vapidPublicKey.length >= 80 && enabled() && root.PushManager !== undefined); }
  function hasTriggers() { return typeof root.TimestampTrigger === 'function' && typeof Notification !== 'undefined' && 'showTrigger' in Notification.prototype; }
  function isIOS() { var n = root.navigator || {}; return /iPad|iPhone|iPod/.test(n.userAgent || '') || (n.platform === 'MacIntel' && n.maxTouchPoints > 1); }
  function standalone() { var n = root.navigator || {}; return !!(n.standalone || (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches)); }
  /* How reminders reach this device: 'push' (your worker) | 'trigger' (local, scheduled) | 'sync' (local, coarse) | 'open' (only while open) | 'none' */
  function mode() {
    if (typeof Notification === 'undefined' || !('serviceWorker' in (root.navigator || {}))) return 'none';
    if (pushReady()) return 'push';
    if (hasTriggers()) return 'trigger';
    if (root.ServiceWorkerRegistration && 'periodicSync' in root.ServiceWorkerRegistration.prototype) return 'sync';
    return 'open';
  }
  function plan(state) {
    if (!PP.Reminders) return [];
    return PP.Reminders.schedule(state, Date.now()).map(function (e) { return { at: e.at, type: e.type, text: PP.Reminders.type(e.type).text }; });
  }
  function storeLocal(list, local) {
    if (!root.caches) return Promise.resolve();
    // 2.4.95: quiet hours = the active pal's sleep hours (local clock), so the service worker can keep a re-arm ping silent
    var st = PP.App && PP.App.state, p = st && PP.Game.active(st), q = p && !p.fate && p.stage !== 'egg' ? PP.Sleep.of(p) : null;
    var body = JSON.stringify({ list: list, at: Date.now(), local: !!local, shown: Date.now(), quiet: q ? { bed: q.bed, wake: q.wake } : null });
    return root.caches.open(SCHED_CACHE).then(function (c) { return c.put(SCHED_KEY, new Response(body, { headers: { 'Content-Type': 'application/json' } })); }).catch(function () {});
  }
  function localFallback(list, m) {
    return navigator.serviceWorker.ready.then(function (reg) {
      if (m === 'trigger') {
        return reg.getNotifications({ includeTriggered: true }).then(function (ns) {
          ns.forEach(function (n) { if (n.tag && n.tag.indexOf('pp-local-') === 0) n.close(); });
          return Promise.all(list.map(function (e, i) {
            /* global TimestampTrigger */
            return reg.showNotification('PocketPal', { body: e.text, tag: 'pp-local-' + i, icon: 'icon-192.png', badge: 'badge-96.png', showTrigger: new TimestampTrigger(e.at) });
          }));
        });
      }
      if (m === 'sync' && reg.periodicSync) return reg.periodicSync.register('pp-remind', { minInterval: 3600e3 });
    });
  }
  function nextText(list) {
    var e = list && list[0];
    return e ? PP.Reminders.describe(e, PP.App && PP.App.state && PP.App.state.settings.clock, Date.now()) : 'none planned';
  }

  /* announce: only when the player just switched alerts on (bell / Settings). 1.9.2: the background re-arm on every
   * hide / pagehide / launch is silent. */
  /* 2.6.4: the last schedule the worker accepted. An upload the worker would treat as unchanged (same endpoint and
   * quiet hours, every time within its 60 s tolerance) is skipped, e.g. the hide + pagehide pair; it is re-sent after
   * 6 h anyway in case the worker lost it. Stored only after the worker said ok, so a failed upload is retried. */
  var SIG_KEY = 'pocketpal2.alertSig', SIG_RESEND = 6 * 3600e3;
  function sigGet() { try { var j = JSON.parse(localStorage.getItem(SIG_KEY) || 'null'); return j && typeof j === 'object' ? j : null; } catch (e) { return null; } }
  function sigSet(v) { try { if (v) localStorage.setItem(SIG_KEY, JSON.stringify(v)); else localStorage.removeItem(SIG_KEY); } catch (e) { /* storage off */ } }
  function sameSig(a, b, now) {
    return !!(a && b && a.ep === b.ep && Array.isArray(a.times) && a.times.length === b.times.length && now - (+a.sent || 0) < SIG_RESEND &&
      a.times.every(function (t, i) { return Math.abs(t - b.times[i]) < 60e3; }) && JSON.stringify(a.quiet || []) === JSON.stringify(b.quiet || []));
  }
  function scheduleAlert(state, announce) {
    if (!state || !state.settings.alerts || !('serviceWorker' in navigator)) return;
    if (PP.App && PP.App.passive) return;   // 2.6.4: a paused tab (another tab, or a newer save) must not replace the real schedule
    var m = mode(), list = plan(state);
    Net.last = { list: list, at: Date.now(), mode: m };
    if (m === 'none' || m === 'open') return;
    if (m !== 'push') {
      storeLocal(list, true).then(function () { return localFallback(list, m); }).then(function () {
        if (announce && PP.App && PP.App.toast) PP.App.toast('Next alert: ' + nextText(list) + ' (on this device)');
      }).catch(function (e) { if (announce && PP.App && PP.App.toast) PP.App.toast('Alerts: ' + (e && e.message || 'blocked')); });
      return;
    }
    var times = list.map(function (e) { return e.at; });
    storeLocal(list, false);
    navigator.serviceWorker.ready.then(function (reg) {
      var key = b64uToBytes(cfg().vapidPublicKey);
      var fresh = function () { return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); };
      return reg.pushManager.getSubscription().then(function (sub) {
        /* 2.1.0 audit: after the worker's VAPID keys are changed (config.js), the old subscription is still tied to the
         * OLD key - every push the worker signs with the new key is refused, and subscribe() with the new key throws
         * while it exists. Drop it and subscribe again. */
        if (sub && !sameKey(sub, key)) return Promise.resolve(sub.unsubscribe()).catch(function () {}).then(fresh);
        return sub || fresh();
      }).then(function (sub) {
        /* times = the 1.9.7 schedule; at = its first time, for a worker that is still on 1.9.4 */
        var quiet = PP.Reminders.quietSpans(state, Date.now()), sig = { ep: sub.endpoint, times: times.slice().sort(function (a, b) { return a - b; }), quiet: quiet };
        if (!announce && times.length && sameSig(sigGet(), sig, Date.now())) return null;   // 2.6.4: the worker has it already
        return api('/alerts', { subscription: sub.toJSON(), times: times, at: times.length ? times[0] : null, quiet: quiet }).then(function (j) {   // 2.4.96 quiet
          if (j && j.ok) { if (j.scheduled) { sig.sent = Date.now(); sigSet(sig); } else sigSet(null); }
          return j;
        }, function (e) { sigSet(null); throw e; });
      }).then(function (j) {
        if (announce && PP.App && PP.App.toast && j) PP.App.toast(j.scheduled ? 'Next alert: ' + nextText(list) : (list.length ? 'Next alert: ' + nextText(list) : 'No alert types are on'));
      });
    }).catch(function (e) { if (announce && PP.App && PP.App.toast) PP.App.toast('Alerts: ' + (e && e.message || 'blocked')); });
  }

  function setAlerts(on) {
    var s = PP.App.state;
    s.settings.alerts = !!on;
    s.settings.notify = !!on;
    PP.App.save();
    if (PP.App.updateBellBtn) PP.App.updateBellBtn();
    if (PP.UI && PP.UI.refresh) PP.UI.refresh();
    if (!on) {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.ready.then(function (reg) {
          if (reg.getNotifications) reg.getNotifications({ includeTriggered: true }).then(function (ns) { ns.forEach(function (n) { if (n.tag && n.tag.indexOf('pp-local-') === 0) n.close(); }); }).catch(function () {});
          return reg.pushManager && reg.pushManager.getSubscription().then(function (sub) {
            sigSet(null);
            if (sub && enabled()) return api('/alerts', { subscription: sub.toJSON(), at: null });
          });
        }).catch(function () {});
      }
      storeLocal([], false);
      if (PP.App && PP.App.toast) PP.App.toast('Care alerts off');
      return;
    }
    var go = function () { scheduleAlert(s, true); };
    if (root.Notification && Notification.requestPermission) {
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') {
          s.settings.alerts = false; s.settings.notify = false; PP.App.save();
          if (PP.App.updateBellBtn) PP.App.updateBellBtn();   // 1.9.3: the bell kept saying ON after "Block"
          if (PP.UI && PP.UI.refresh) PP.UI.refresh();
          PP.App.toast('Allow notifications first');
        } else go();
      });
    } else go();
  }
  /* Honest, device-specific limits for the Alerts screen. */
  function limits() {
    var m = mode(), out = [];
    if (m === 'push') out.push('Pushes come from your worker. With the 5-minute cron they arrive within about 3 minutes of the planned time (the old hourly cron: up to 15 min early or ~45 min late).');
    if (m === 'trigger') out.push('No worker: reminders are scheduled on this device (Notification Triggers). They fire on time even when PocketPal is closed.');
    if (m === 'sync') out.push('No worker: this browser only offers background sync, which runs about once an hour at best (often less). Reminders can be late.');
    if (m === 'open') out.push('No worker and no background scheduling here: reminders only work while PocketPal is open in a tab.');
    if (m === 'none') out.push('This browser cannot show notifications.');
    if (isIOS()) out.push(standalone() ? 'iPhone/iPad: pushes work from the Home Screen app (iOS 16.4+), but iOS may delay or group them, and Focus modes can hide them. iOS has no local scheduling or background sync.'
      : 'iPhone/iPad: alerts only work after Share \u25b8 Add to Home Screen (iOS 16.4+), opened from the Home Screen. Even then iOS may delay them.');
    out.push('Times come from a simulation without your care, so they move when you feed, clean or play. Only the times are sent - no pal data.');
    return out;
  }

  var Net = PP.Net = { enabled: enabled, scheduleAlert: scheduleAlert, setAlerts: setAlerts, mode: mode, limits: limits, plan: plan, sameKey: sameKey, last: null, isIOS: isIOS, _sameSig: sameSig };
})(typeof window !== 'undefined' ? window : globalThis);
