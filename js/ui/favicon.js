/* PocketPal 1.9.4 - live tab icon. The browser tab / favicon shows a tiny LCD with the
 * ACTIVE pal (its real sprite frame: idle, sleeping or sick), a dark screen when the
 * lights are off and a red "!" badge when it needs you - handy when the game sits in a
 * background tab. The icon wears the player's shell colour, and the tab title gets a "(!)"
 * too (for browsers that ignore live favicons, e.g. Safari), and the installed app icon gets a
 * badge dot where the system supports it. Redrawn only when that picture changes. Falls back to the static
 * icon.svg / icon-192.png whenever it can't draw (no pal, pal gone, sprites not loaded,
 * no canvas, or a "tainted" canvas on file:// where toDataURL throws). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var SIZE = 96, C = { ink: '#0f380f', dark: '#306230', mid: '#8bac0f', bg: '#9bbc0f', pink: '#e85a71', pinkD: '#b83550', bezel: '#1a1a1a', red: '#e8262b' };
  var lastKey = null, links = null;

  /* What to draw for this pal (pure: unit-tested in node). null = use the static icon. */
  function picture(p, shell) {
    if (!p || p.fate) return null;
    var stageKey = PP.Sprites && PP.Sprites.stageKeyOf ? PP.Sprites.stageKeyOf(p) : (p.stage === 'adult' ? 'adult_' + (p.form || 'good') : p.stage);
    var attn = PP.Care && PP.Care.attention ? PP.Care.attention(p).filter(function (k) { return k !== 'poop' || p.poop >= 1; }) : [];
    var pose = p.stage === 'egg' ? 'idle' : p.asleep ? 'sleep' : p.sick ? 'sick' : 'idle';
    var sh = shell && /^#[0-9a-f]{6}$/i.test(shell.base) && /^#[0-9a-f]{6}$/i.test(shell.dark) ? shell : null;
    return { species: p.species, stageKey: stageKey, pose: pose, dark: !p.lights, alert: attn.length > 0, shell: sh ? sh.base : C.pink, rim: sh ? sh.dark : C.pinkD };
  }
  function keyOf(pic) { return pic ? [pic.species, pic.stageKey, pic.pose, pic.dark ? 1 : 0, pic.alert ? 1 : 0, pic.shell, pic.rim].join('|') : 'static'; }
  var TITLE = 'PocketPal';
  function titleFor(pic) { return pic && pic.alert ? '(!) ' + TITLE : TITLE; }

  function draw(ctx, pic) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    rr(ctx, 0, 0, SIZE, SIZE, 18, pic.rim); rr(ctx, 2, 2, SIZE - 4, SIZE - 4, 16, pic.shell);   // shell (the player's colour)
    rr(ctx, 6, 6, SIZE - 12, SIZE - 12, 4, C.bezel);                                            // bezel
    ctx.fillStyle = pic.dark ? C.dark : C.bg; ctx.fillRect(8, 8, SIZE - 16, SIZE - 16);       // screen (80 x 80)
    ctx.fillStyle = pic.dark ? C.ink : C.mid; ctx.fillRect(8, SIZE - 20, SIZE - 16, 12);       // ground
    ctx.save(); ctx.beginPath(); ctx.rect(8, 8, SIZE - 16, SIZE - 16); ctx.clip();
    var cell = (PP.ATLAS && PP.ATLAS.frame) || 80;                                             // 80 px cell drawn 1:1
    PP.Sprites.draw(ctx, pic.species, pic.stageKey, pic.pose, 0, 8, SIZE - 8 - cell + 3, cell / 32);
    ctx.restore();
    if (pic.alert) {                                                                            // red "!" badge, top right
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(SIZE - 20, 20, 18, 0, 7); ctx.fill();
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(SIZE - 20, 20, 15, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(SIZE - 23, 9, 6, 14); ctx.fillRect(SIZE - 23, 26, 6, 6);
    }
  }
  function rr(ctx, x, y, w, h, r, col) {
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }

  function iconLinks() {
    if (!links) {
      links = Array.prototype.slice.call(document.querySelectorAll('link[rel~="icon"]'));
      links.forEach(function (l) { l.setAttribute('data-static', l.getAttribute('href')); l.setAttribute('data-type', l.getAttribute('type') || ''); });
    }
    return links;
  }
  function setStatic() {
    iconLinks().forEach(function (l) { l.href = l.getAttribute('data-static'); var t = l.getAttribute('data-type'); if (t) l.type = t; });
  }
  /* Call often; it only repaints when the picture changes. Returns 'live' | 'static' | 'same'. */
  function update(p, shell) {
    if (typeof document === 'undefined') return 'static';
    var pic = picture(p, shell), key = keyOf(pic), title = titleFor(pic);
    if (document.title !== title) document.title = title;
    if (pic && !(PP.Sprites && PP.Sprites.ready && PP.Sprites.ready())) { pic = null; key = 'static'; }
    if (key === lastKey) return 'same';
    lastKey = key;
    appBadge(!!(pic && pic.alert));
    if (!pic) { setStatic(); return 'static'; }
    try {
      var cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
      var ctx = cv.getContext('2d'); if (!ctx) throw new Error('no 2d');
      draw(ctx, pic);
      var url = cv.toDataURL('image/png');                 // throws on a tainted (file://) canvas
      if (url.indexOf('data:image/png') !== 0) throw new Error('no png');
      iconLinks().forEach(function (l) { l.type = 'image/png'; l.href = url; });
      return 'live';
    } catch (e) { setStatic(); return 'static'; }
  }
  /* The installed app's home-screen / dock icon gets a badge dot while the pal needs you (installed
   * Chrome / Edge PWAs, iOS 16.4+ home-screen apps with notification permission). Silent everywhere else. */
  var badgeOn = null;
  function appBadge(on) {
    var n = typeof navigator !== 'undefined' ? navigator : null;
    if (!n || on === badgeOn || typeof n.setAppBadge !== 'function') return;
    badgeOn = on;
    try { var r = on ? n.setAppBadge() : n.clearAppBadge(); if (r && r.catch) r.catch(function () {}); } catch (e) { /* not allowed here */ }
  }
  function reset() { lastKey = null; }
  PP.Favicon = { picture: picture, keyOf: keyOf, titleFor: titleFor, update: update, reset: reset, SIZE: SIZE };
})(typeof window !== 'undefined' ? window : globalThis);
