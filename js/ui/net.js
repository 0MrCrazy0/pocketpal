/* PocketPal - care-alert pushes via YOUR Cloudflare worker. No live P2P. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  function cfg() { return PP.CONFIG || {}; }
  function enabled() { return !!cfg().relayUrl && /^https:\/\//.test(cfg().relayUrl) && typeof fetch === 'function'; }
  function api(path, body) {
    if (!cfg().relayUrl) return Promise.reject(new Error('no worker url'));
    return fetch(cfg().relayUrl + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); });
  }
  function b64uToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); var raw = atob(s + '==='.slice((s.length + 3) % 4)); var a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }

  function scheduleAlert(state) {
    if (!cfg().vapidPublicKey || cfg().vapidPublicKey.length < 80) return;
    if (!state || !state.settings.alerts || !('serviceWorker' in navigator)) return;
    var p = PP.Game.active(state);
    var nowG = PP.Game.now(state);
    var nc = p ? PP.Care.nextCall(p, nowG, { maxMin: 48 * 60 }) : null;
    /* If nothing is due soon, still arm a 3-hour welfare ping so a closed app
       cannot sit silent until the pal is already gone. */
    var at = nc ? (Date.now() + Math.max(60e3, nc.at - nowG)) : (Date.now() + 3 * 3600e3);
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(cfg().vapidPublicKey) });
      }).then(function (sub) {
        return api('/alerts', { subscription: sub.toJSON(), at: at });
      }).then(function (j) {
        if (PP.App && PP.App.toast && j && j.scheduled) {
          var mins = Math.max(1, Math.round((j.at - Date.now()) / 60000));
          PP.App.toast(mins >= 120 ? 'Next care ping in about ' + Math.round(mins / 60) + 'h' : 'Next care ping in about ' + mins + ' min');
        }
      });
    }).catch(function (e) { if (PP.App && PP.App.toast) PP.App.toast('Alerts: ' + (e && e.message || 'blocked')); });
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
          return reg.pushManager.getSubscription().then(function (sub) {
            if (sub) return api('/alerts', { subscription: sub.toJSON(), at: null });
          });
        }).catch(function () {});
      }
      if (PP.App && PP.App.toast) PP.App.toast('Care alerts off');
      return;
    }
    var go = function () { scheduleAlert(s); };
    if (root.Notification && Notification.requestPermission) {
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') {
          s.settings.alerts = false; s.settings.notify = false; PP.App.save();
          if (PP.UI && PP.UI.refresh) PP.UI.refresh();
          PP.App.toast('Allow notifications first');
        } else go();
      });
    } else go();
  }

  PP.Net = { enabled: enabled, scheduleAlert: scheduleAlert, setAlerts: setAlerts };
})(typeof window !== 'undefined' ? window : globalThis);
