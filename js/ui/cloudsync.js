/* PocketPal 1.9.0 - cloud save client (opt-in). Talks only to YOUR worker (PP.CONFIG.relayUrl).
 * The recovery code + optional passphrase live in their own localStorage key on this device
 * (never inside the save, never sent to the server). Everything uploaded is encrypted first
 * (PP.Cloud, AES-GCM). If the worker is down or the device is offline, nothing breaks:
 * the game keeps its normal local save and simply tries again later. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var KEY = 'pocketpal2.rewrite.cloud';
  var AUTO_MS = 30 * 60e3, TIMEOUT_MS = 15000;
  var busy = false;

  function store() { try { return root.localStorage; } catch (e) { return null; } }
  function creds() {
    var s = store(); if (!s) return null;
    try { var c = JSON.parse(s.getItem(KEY) || 'null'); return c && PP.Cloud.valid(c.code) ? c : null; } catch (e) { return null; }
  }
  function setCreds(c) { var s = store(); if (!s) return; try { if (c) s.setItem(KEY, JSON.stringify(c)); else s.removeItem(KEY); } catch (e) {} }
  function base() { var u = (PP.CONFIG || {}).relayUrl || ''; return /^https?:\/\//.test(u) ? u.replace(/\/+$/, '') : ''; }
  function available() { return !!base() && typeof fetch === 'function' && !!(root.crypto && root.crypto.subtle); }
  function call(method, id, token, body) {
    if (!base()) return Promise.reject(new Error('No worker set up (see DEPLOY.md)'));
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, TIMEOUT_MS) : null;
    var opt = { method: method, headers: { 'X-PP-Token': token }, signal: ctl ? ctl.signal : undefined };
    if (body != null) { opt.headers['Content-Type'] = 'application/json'; opt.body = body; }
    return fetch(base() + '/save/' + id, opt).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) {}
        if (!r.ok) throw new Error((j && j.error) || ('Server error ' + r.status));
        return { json: j, text: t, savedAt: +r.headers.get('X-PP-Saved-At') || null };
      });
    }, function (e) { throw new Error(e && e.name === 'AbortError' ? 'The server took too long' : 'Could not reach the server (offline?)'); })
      .finally(function () { if (timer) clearTimeout(timer); });
  }
  /* Turn cloud save on: makes a fresh recovery code (returned once, to show the player). */
  function enable(pass) {
    var code = PP.Cloud.newCode();
    setCreds({ code: code, pass: String(pass || ''), lastUp: 0 });
    return code;
  }
  function upload(state) {
    var c = creds(); if (!c) return Promise.reject(new Error('Cloud save is off'));
    if (busy) return Promise.reject(new Error('Already saving'));
    busy = true;
    var text = PP.Save.serialize(state, Date.now());
    return PP.Cloud.ids(c.code).then(function (k) {
      return PP.Cloud.encrypt(text, c.code, c.pass).then(function (blob) { return call('PUT', k.id, k.token, JSON.stringify(blob)); });
    }).then(function (r) {
      var cur = creds() || c; cur.lastUp = Date.now(); cur.lastErr = null; setCreds(cur);
      return r.json;
    }, function (e) { var cur = creds(); if (cur) { cur.lastErr = e.message; cur.lastTry = Date.now(); setCreds(cur); } throw e; })
      .finally(function () { busy = false; });
  }
  /* Fetch + decrypt a cloud save. Resolves with PP.Save.importCode's result ({ ok, state, info }). */
  function download(code, pass) {
    if (!PP.Cloud.valid(code)) return Promise.reject(new Error('That recovery code does not look right'));
    return PP.Cloud.ids(code).then(function (k) { return call('GET', k.id, k.token); }).then(function (r) {
      return PP.Cloud.decrypt(r.json, code, pass).then(function (text) {
        var res = PP.Save.importCode(text, Date.now());
        if (res.ok) res.savedAt = r.savedAt || (r.json && r.json.at) || null;
        return res;
      });
    });
  }
  function remove() {
    var c = creds(); if (!c) return Promise.resolve({ ok: true, deleted: false });
    return PP.Cloud.ids(c.code).then(function (k) { return call('DELETE', k.id, k.token); }).then(function (r) { return r.json; });
  }
  function forget() { setCreds(null); }
  /* Called from the save loop: quietly upload at most every 30 minutes. */
  function auto(state) {
    if (!state || !state.settings || !state.settings.cloud || !available() || busy) return false;
    var c = creds(); if (!c) return false;
    if (c.lastErr && Date.now() - (c.lastTry || 0) < AUTO_MS) return false;
    if (Date.now() - (c.lastUp || 0) < AUTO_MS) return false;
    upload(state).catch(function () {});
    return true;
  }
  function status() { var c = creds(); return c ? { on: true, lastUp: c.lastUp || 0, lastErr: c.lastErr || null, hasPass: !!c.pass, code: c.code } : { on: false }; }
  PP.CloudSync = { KEY: KEY, AUTO_MS: AUTO_MS, available: available, creds: creds, setCreds: setCreds, enable: enable, upload: upload, download: download, remove: remove, forget: forget, auto: auto, status: status };
})(typeof window !== 'undefined' ? window : globalThis);
