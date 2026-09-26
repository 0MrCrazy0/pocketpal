/* PocketPal 2 - OPTIONAL online helpers (short battle-code relay + care-alert pushes).
 * Disabled unless PP.CONFIG.relayUrl is set. The game never needs this to be playable. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  function cfg() { return PP.CONFIG || {}; }
  function enabled() { return !!cfg().relayUrl && /^https:\/\//.test(cfg().relayUrl) && typeof fetch === 'function'; }
  function api(path, body) {
    return fetch(cfg().relayUrl + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; }); });
  }
  function shareCode(code) { return api('/code', { code: code }); }         // -> { id, expires }
  function fetchCode(id) { return api('/code/' + encodeURIComponent(id)); } // -> { code }

  /* Care alerts: ask the server to send a (payload-less) push at the time our pure
   * simulation says the pal will next need attention. */
  function b64uToBytes(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); var raw = atob(s + '==='.slice((s.length + 3) % 4)); var a = new Uint8Array(raw.length); for (var i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i); return a; }
  function scheduleAlert(state) {
    if (!enabled() || !cfg().vapidPublicKey || !state.settings.alerts || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return;
    var p = PP.Game.active(state); if (!p) return;
    var nc = PP.Care.nextCall(p, PP.Game.now(state));
    navigator.serviceWorker.ready.then(function (reg) {
      return reg.pushManager.getSubscription().then(function (sub) {
        return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(cfg().vapidPublicKey) });
      }).then(function (sub) {
        return api('/alerts', { subscription: sub.toJSON(), at: nc ? nc.at - (state.timeOffset || 0) : null });
      });
    }).catch(function () { /* alerts are best-effort */ });
  }
  function screen() {
    var UI = PP.UI, esc = UI.esc;
    return function () {
      var p = PP.Game.active(PP.App.state);
      return { title: 'ONLINE RELAY', html: '<p>Turn your long battle code into a short one, or fetch a friend\'s short code.</p><input id="relayIn" maxlength="12" placeholder="short code" aria-label="Short code" autocomplete="off">', items: [
        { label: 'Make short code for my pal', disabled: !p || p.stage !== 'adult', reason: 'Adults only', act: function () {
          shareCode(PP.Cards.encode(p)).then(function (r) { PP.App.toast('Short code: ' + esc(r.id)); var i = document.getElementById('relayIn'); if (i) i.value = r.id; }, function (e) { PP.App.toast('Relay error: ' + e.message); });
        } },
        { label: 'Fetch friend by short code', act: function () {
          var id = ((document.getElementById('relayIn') || {}).value || '').trim();
          fetchCode(id).then(function (r) { var a = PP.Game.addFriend(PP.App.state, r.code); PP.App.toast(a.msg); PP.App.save(); }, function (e) { PP.App.toast('Relay error: ' + e.message); });
        } },
        { label: 'Care alerts', right: PP.App.state.settings.alerts ? 'ON' : 'OFF', sub: 'Push reminder when your pal will need you', act: function () {
          var s = PP.App.state; s.settings.alerts = !s.settings.alerts;
          if (s.settings.alerts && root.Notification && Notification.requestPermission) Notification.requestPermission();
          PP.App.save(); UI.refresh();
        } },
        { label: 'Back', act: UI.pop }
      ] };
    };
  }
  PP.Net = { enabled: enabled, shareCode: shareCode, fetchCode: fetchCode, scheduleAlert: scheduleAlert, screen: screen };
})(typeof window !== 'undefined' ? window : globalThis);
