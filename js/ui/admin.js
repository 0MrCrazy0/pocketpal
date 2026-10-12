/* PocketPal - hidden admin access to the test panel (1.8.0).
 *
 * Tap the C button (or the C / D key) 10 times within 3.5 seconds on the home screen (menus
 * included) to get a password box on the LCD. The right password unlocks the test panel until
 * the page is reloaded. 5 wrong tries lock the box for 30 seconds (the lock survives a reload).
 *
 * Before 1.8.0 the password sat in main.js as plain text and used window.prompt (which some
 * phones / in-app browsers block). Now only a salted SHA-256 hash is stored here.
 * Change the password with:  node tools/set-admin-password.js "new password"
 */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};

  // ADMIN-HASH (rewritten by tools/set-admin-password.js - keep on one line)
  var ADMIN = { salt: 'c5b19cfc60bf9df941c34d2e', hash: '7e794d30680f8b71d9c54e3495b201dbd8152ade6dd934a13b101457815b2d48' };

  var TAPS = 10, WINDOW_MS = 3500, MAX_FAILS = 5, LOCK_MS = 30000, LOCK_KEY = 'pocketpal.adminLock';
  var taps = [], unlocked = false, promptOpen = false;

  /* ---------------------------------------------------------------- SHA-256 (pure JS, UTF-8) */
  var K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function utf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 0xd800 && c < 0xdc00 && i + 1 < s.length) { c = 0x10000 + ((c - 0xd800) << 10) + (s.charCodeAt(++i) - 0xdc00); }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return out;
  }
  function sha256(str) {
    var b = utf8(String(str)), len = b.length * 8;
    b.push(0x80); while (b.length % 64 !== 56) b.push(0);
    for (var s = 56; s >= 0; s -= 8) b.push(s >= 32 ? Math.floor(len / Math.pow(2, s)) & 255 : (len >>> s) & 255);
    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
    function rr(x, n) { return (x >>> n) | (x << (32 - n)); }
    for (var o = 0; o < b.length; o += 64) {
      for (var i = 0; i < 16; i++) w[i] = (b[o + 4 * i] << 24) | (b[o + 4 * i + 1] << 16) | (b[o + 4 * i + 2] << 8) | b[o + 4 * i + 3];
      for (i = 16; i < 64; i++) {
        var s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & bb) ^ (a & c) ^ (bb & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = bb; bb = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + bb) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }
  function check(pw) { return sha256(ADMIN.salt + ':' + pw) === ADMIN.hash; }

  /* ---------------------------------------------------------------- lockout (survives reloads) */
  function lockState() {
    try { var v = JSON.parse(root.localStorage.getItem(LOCK_KEY) || 'null'); if (v && typeof v === 'object') return { fails: +v.fails || 0, until: +v.until || 0 }; } catch (e) { /* no storage */ }
    return lockState.mem || { fails: 0, until: 0 };
  }
  function setLock(v) { lockState.mem = v; try { root.localStorage.setItem(LOCK_KEY, JSON.stringify(v)); } catch (e) { /* no storage */ } }
  function lockedFor() { return Math.max(0, lockState().until - Date.now()); }

  /* ---------------------------------------------------------------- C-button counter
   * Called for every C press BEFORE its normal action (back / cancel / deselect), which still
   * happens - those are harmless on the home screen. Presses only count on the home screen
   * (menus included), never during a battle, mini-game or cut-scene, so C keeps its meaning there. */
  function countC() {
    var A = PP.App;
    if (!A || A.cut || A.scene !== 'home' || promptOpen) { taps = []; return false; }
    var t = Date.now();
    taps.push(t);
    taps = taps.filter(function (x) { return t - x <= WINDOW_MS; });
    if (taps.length < TAPS) return false;
    taps = [];
    setTimeout(function () { if (unlocked) { A.testAllowed = true; A.setTestMode(true); A.toast('Admin: test panel'); } else openPrompt(); }, 0);
    return true;
  }

  function msg(text) { var el = document.getElementById('adminMsg'); if (el) el.textContent = text; }
  function shake() {
    var el = document.getElementById('overlay'); if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    setTimeout(function () { el.classList.remove('shake'); }, 500);
  }
  function screen() {
    var left = lockedFor();
    return { title: 'ADMIN', admin: true,
      html: '<p>Enter the admin password to open the test panel.</p>' +
        '<p><input id="adminPw" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Admin password" maxlength="64"></p>' +
        '<p id="adminMsg" class="tip" role="alert">' + (left ? 'Locked - try again in ' + Math.ceil(left / 1000) + 's' : '') + '</p>',
      items: [{ label: 'Unlock', act: submit }, { label: 'Cancel', act: close }] };
  }
  function openPrompt() {
    var UI = PP.UI; if (!UI) return;
    UI.close(); promptOpen = true;
    UI.open(screen);
    setTimeout(function () {
      var inp = document.getElementById('adminPw'); if (!inp) return;
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit(); } });
      try { inp.focus(); } catch (e) { /* ignore */ }
    }, 30);
  }
  function close() { promptOpen = false; if (PP.UI) PP.UI.close(); }
  function submit() {
    var inp = document.getElementById('adminPw'), pw = inp ? inp.value : '';
    var left = lockedFor();
    if (left) { msg('Locked - try again in ' + Math.ceil(left / 1000) + 's'); shake(); if (PP.Audio) PP.Audio.play('no'); return false; }
    if (check(pw)) {
      setLock({ fails: 0, until: 0 }); unlocked = true; close();
      var A = PP.App; A.testAllowed = true; A.setTestMode(true); A.toast('Admin unlocked - test panel on'); if (PP.Audio) PP.Audio.play('ok');
      return true;
    }
    var st = lockState(); st.fails++;
    if (st.fails >= MAX_FAILS) { st = { fails: 0, until: Date.now() + LOCK_MS }; msg('Wrong password. Locked for ' + LOCK_MS / 1000 + 's'); }
    else msg('Wrong password (' + (MAX_FAILS - st.fails) + ' tries left)');
    setLock(st);
    if (inp) { inp.value = ''; try { inp.focus(); } catch (e) { /* ignore */ } }
    shake(); if (PP.Audio) PP.Audio.play('no');
    return false;
  }
  function onMenuClosed() { promptOpen = false; }

  PP.Admin = { countC: countC, sha256: sha256, check: check, isUnlocked: function () { return unlocked; }, isPromptOpen: function () { return promptOpen; },
    lockedFor: lockedFor, onMenuClosed: onMenuClosed, TAPS: TAPS, WINDOW_MS: WINDOW_MS, MAX_FAILS: MAX_FAILS, LOCK_MS: LOCK_MS,
    _expireLock: function () { var s = lockState(); s.until = 0; setLock(s); } };
})(typeof window !== 'undefined' ? window : globalThis);
