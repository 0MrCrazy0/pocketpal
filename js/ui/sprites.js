/* PocketPal 2 - sprite sheet drawing. Sheets are plain <img> PNGs (works on file://;
 * we only ever drawImage, never read pixels back, so a "tainted" canvas is fine). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var A = PP.ATLAS, imgs = {}, fxImg = null, loaded = 0, total = 0;

  function load(onDone) {
    var list = A.species.map(function (s) { return [s, A.sheets[s]]; }).concat([['fx', A.fx.src]]);
    total = list.length;
    list.forEach(function (it) {
      var im = new Image();
      im.onload = im.onerror = function () { loaded++; if (loaded === total && onDone) onDone(); };
      im.src = it[1];
      if (it[0] === 'fx') fxImg = im; else imgs[it[0]] = im;
    });
  }
  function ready() { return loaded === total && total > 0; }

  function stageIndex(stageKey) {
    var i = A.stages.indexOf(stageKey);
    return i < 0 ? 0 : i;
  }
  /* stageKey: 'egg'|'baby'|'child'|'teen'|'adult_bad'|'adult_good'|'adult_perfect'.
   * scale is in "base" units: the sprite is drawn base*scale pixels wide (base 32, so
   * scale 3 = 96 px). Cells are A.frame (48) px, so 3 -> an exact 2x blow-up. */
  function frameIndex(frame) { var n = A.framesPerPose; return ((Math.floor(frame) % n) + n) % n; }
  function draw(ctx, species, stageKey, pose, frame, x, y, scale, flip) {
    var im = imgs[species]; if (!im || !im.complete || !im.naturalWidth) return;
    var F = A.frame, pi = A.poses.indexOf(pose); if (pi < 0) pi = 0;
    var col = stageIndex(stageKey) * A.framesPerPose + frameIndex(frame || 0);
    var out = (A.base || F) * (scale || 1);
    ctx.save();
    if (flip) { ctx.translate(Math.round(x) + out, Math.round(y)); ctx.scale(-1, 1); ctx.drawImage(im, col * F, pi * F, F, F, 0, 0, out, out); }
    else ctx.drawImage(im, col * F, pi * F, F, F, Math.round(x), Math.round(y), out, out);
    ctx.restore();
  }
  function drawFx(ctx, name, x, y, scale) {
    var c = A.fx.cells[name]; if (!c || !fxImg || !fxImg.naturalWidth) return;
    var S = A.fx.cell, s = scale || 1;
    ctx.drawImage(fxImg, c[0] * S, c[1] * S, S, S, Math.round(x), Math.round(y), S * s, S * s);
  }
  /* CSS background for an HTML element showing one frame, sized in LCD pixels (n x --u)
   * so menu pictures scale with the screen (no canvas needed). */
  function cssU(species, stageKey, pose, frame, n) {
    var F = A.frame, k = n / F, pi = Math.max(0, A.poses.indexOf(pose || 'idle'));
    var col = stageIndex(stageKey) * A.framesPerPose + frameIndex(frame || 0);
    var u = function (v) { return 'calc(' + v + ' * var(--u))'; };
    return 'background-image:url(' + A.sheets[species] + ');background-size:' + u(A.sheetSize[0] * k) + ' ' + u(A.sheetSize[1] * k) +
      ';background-position:' + u(-col * n) + ' ' + u(-pi * n) + ';width:' + u(n) + ';height:' + u(n);
  }
  var icons = null;
  function loadIcons() { if (!icons) { icons = new Image(); icons.src = 'sprites/icons.png'; } return icons; }
  /* Draw one 12px menu icon (index into sprites/icons.png) on the canvas. */
  function drawIcon(ctx, i, x, y, scale) {
    var im = loadIcons(); if (!im.complete || !im.naturalWidth) return;
    var s = scale || 1; ctx.drawImage(im, i * 12, 0, 12, 12, Math.round(x), Math.round(y), 12 * s, 12 * s);
  }
  function stageKeyOf(p) {
    if (!p) return 'egg';
    return p.stage === 'adult' ? 'adult_' + (p.form || 'good') : p.stage;
  }
  PP.Sprites = { frameIndex: frameIndex, load: load, ready: ready, draw: draw, drawFx: drawFx, cssU: cssU, drawIcon: drawIcon, loadIcons: loadIcons, stageKeyOf: stageKeyOf };
})(typeof window !== 'undefined' ? window : globalThis);
