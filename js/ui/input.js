/* PocketPal 2 - input: the A/B/C buttons, keyboard, tappable icons and LCD taps.
 * Hold A + C together for 3 seconds to toggle the hidden test panel. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var held = {}, comboTimer = null, cTaps = [], C_WINDOW = 3500;

  function press(btn) { if (PP.App && !PP.App.passive) PP.App.input(btn); }
  function tapCAdmin() {
    var now = Date.now();
    cTaps = cTaps.filter(function (t) { return now - t < C_WINDOW; });
    cTaps.push(now);
    if (cTaps.length < 10) return;
    cTaps = [];
    var pass = window.prompt('Admin password');
    if (!pass) return;
    if (!PP.App || pass !== PP.App.ADMIN_PASS) { if (PP.App) PP.App.toast('Wrong password'); return; }
    PP.App.testAllowed = true;
    PP.App.setTestMode(true);
    PP.App.toast('Test panel unlocked');
  }
  function holdStart(btn) {
    held[btn] = true;
    if (held.A && held.C && !comboTimer && PP.App && PP.App.testAllowed) comboTimer = setTimeout(function () { comboTimer = null; if (held.A && held.C && PP.App) PP.App.toggleTestPanel(true); }, 3000);
  }
  function holdEnd(btn) { held[btn] = false; if (comboTimer && !(held.A && held.C)) { clearTimeout(comboTimer); comboTimer = null; } }

  function init() {
    ['A', 'B', 'C'].forEach(function (b) {
      var el = document.getElementById('btn' + b);
      if (!el) return;
      el.addEventListener('pointerdown', function (e) {
        e.preventDefault(); PP.Audio.unlock(); el.classList.add('pressed'); holdStart(b); if (b === 'C') tapCAdmin(); press(b);
      });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (t) { el.addEventListener(t, function () { el.classList.remove('pressed'); holdEnd(b); }); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); press(b); } });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.icon'), function (el, i) {
      el.addEventListener('click', function (e) { e.preventDefault(); PP.Audio.unlock(); if (PP.App) PP.App.iconTap(i); });
    });
    var cv = document.getElementById('lcd');
    cv.addEventListener('pointerdown', function (e) {
      PP.Audio.unlock();
      var r = cv.getBoundingClientRect();
      if (PP.App) PP.App.lcdTap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
    });
    var KEYS = { a: 'A', ArrowRight: 'A', ArrowDown: 'A', s: 'B', Enter: 'B', ' ': 'B', d: 'C', Escape: 'C', Backspace: 'C', ArrowLeft: 'PREV', ArrowUp: 'PREV' };
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA');
      if (typing && e.key !== 'Escape') return;
      if (t && t.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ') && !t.classList.contains('btn')) return; // native button activation
      var k = KEYS[e.key] || KEYS[e.key.toLowerCase && e.key.toLowerCase()];
      if (!k || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault(); PP.Audio.unlock();
      var map = { A: 'A', B: 'B', C: 'C' };
      if (!e.repeat && map[k]) { holdStart(k); var el = document.getElementById('btn' + k); if (el) el.classList.add('pressed'); if (k === 'C') tapCAdmin(); }
      press(k);
    });
    document.addEventListener('keyup', function (e) {
      var k = KEYS[e.key] || KEYS[e.key.toLowerCase && e.key.toLowerCase()];
      if (k === 'A' || k === 'B' || k === 'C') { holdEnd(k); var el = document.getElementById('btn' + k); if (el) el.classList.remove('pressed'); }
    });
  }
  PP.Input = { init: init };
})(typeof window !== 'undefined' ? window : globalThis);
