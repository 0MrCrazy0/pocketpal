/* PocketPal - tiny 5x7 bitmap font for the LCD canvas (crisp at any zoom; 2.0.0: drawn hi-res on the x5 backing store). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  /* 2.0.0: the menus' web font (fonts/pp-lcd.woff, the same letters traced as outlines). Loaded from here instead of a CSS
   * @font-face so a game opened straight from a file (file://, where browsers block font files) quietly keeps the
   * fallback font instead of logging CORS errors; online it comes from the offline cache like every other file. */
  if (typeof document !== 'undefined' && typeof FontFace !== 'undefined' && root.location && /^https?:$/.test(root.location.protocol)) {
    try { var lcd = new FontFace('PocketPal LCD', "url('fonts/pp-lcd.woff') format('woff')", { display: 'block' }); document.fonts.add(lcd); lcd.load().catch(function () { /* fallback font */ }); } catch (e) { /* old browser */ }
  }
  var G = {
    'A': '.###.#...##...#######...##...##...#', 'B': '####.#...##...#####.#...##...#####.',
    'C': '.###.#...##....#....#....#...#.###.', 'D': '####.#...##...##...##...##...#####.',
    'E': '######....#....####.#....#....#####', 'F': '######....#....####.#....#....#....',
    'G': '.###.#...##....#.####...##...#.####', 'H': '#...##...##...#######...##...##...#',
    'I': '.###...#....#....#....#....#...###.', 'J': '..###...#....#....#....#.#..#..##..',
    'K': '#...##..#.#.#..##...#.#..#..#.#...#', 'L': '#....#....#....#....#....#....#####',
    'M': '#...###.###.#.##.#.##...##...##...#', 'N': '#...##...###..##.#.##..###...##...#',
    'O': '.###.#...##...##...##...##...#.###.', 'P': '####.#...##...#####.#....#....#....',
    'Q': '.###.#...##...##...##.#.##..#..##.#', 'R': '####.#...##...#####.#.#..#..#.#...#',
    'S': '.#####....#.....###.....#....#####.', 'T': '#####..#....#....#....#....#....#..',
    'U': '#...##...##...##...##...##...#.###.', 'V': '#...##...##...##...##...#.#.#...#..',
    'W': '#...##...##...##.#.##.#.##.#.#.#.#.', 'X': '#...##...#.#.#...#...#.#.#...##...#',
    'Y': '#...##...#.#.#...#....#....#....#..', 'Z': '#####....#...#...#...#...#....#####',
    '0': '.###.#...##..###.#.###..##...#.###.', '1': '..#...##....#....#....#....#...###.',
    '2': '.###.#...#....#...#...#...#...#####', '3': '####.....#....#.###.....#....#####.',
    '4': '...#...##..#.#.#..#.#####...#....#.', '5': '######....####.....#....##...#.###.',
    '6': '..##..#...#....####.#...##...#.###.', '7': '#####....#...#...#...#....#....#...',
    '8': '.###.#...##...#.###.#...##...#.###.', '9': '.###.#...##...#.####....#...#..##..',
    '.': '..........................##...##..', ',': '.....................##....#...#...',
    '!': '..#....#....#....#....#.........#..', '?': '.###.#...#....#...#...#.........#..',
    ':': '......##...##.........##...##......', ';': '......##...##.........##....#...#..',
    '-': '...............#####...............', '+': '.......#....#..#####..#....#.......',
    '/': '....#....#...#...#...#...#....#....', '%': '##..###..#...#...#...#...#..###..##',
    "'": '..#....#...#.......................', '"': '.#.#..#.#..........................',
    '(': '...#...#...#....#....#.....#.....#.', ')': '.#.....#.....#....#....#...#...#...',
    '<': '...#...#...#...#.....#.....#.....#.', '>': '.#.....#.....#.....#...#...#...#...',
    '=': '..........#####.....#####..........', '*': '.....#.#.#.###.#####.###.#.#.#.....',
    '#': '.#.#..#.#.#####.#.#.#####.#.#..#.#.', '_': '..............................#####',
    '&': '.##..#..#..##...##.##..#.##..#.##.#', ' ': '...................................',
    '\u2665': '......#.#.###########.###...#......', '\u2661': '......#.#.#.#.##...#.#.#...#.......',
    '\u2642': '..###...##..#.#.##..#..#.#..#..##..', '\u2640': '.###.#...##...#.###...#...###...#..',
    '\u25b6': '.#....##...###..####.###..##...#...', '\u25c0': '...#...##..###.####..###...##....#.',
    '\u2191': '..#...###.#.#.#..#....#....#....#..', '\u2193': '..#....#....#....#..#.#.#.###...#..',
    '\u263e': '..##..##..##...##...##....##....##.', '\u2600': '..#..#.#.#.###.#####.###.#.#.#..#..',
    '\u2605': '..#....#..#####.###..#.#.#...#.....'
  };
  var ADV = 6;
  function glyph(ch) {
    var g = G[ch] || G[ch.toUpperCase()] || G['?'];
    return g;
  }
  function width(text, scale) { return String(text).length * ADV * (scale || 1) - (scale || 1); }
  /* 2.0.0 HI-RES TEXT. The LCD canvas has a x5 backing store (render.js DPR), so every glyph is drawn on a fine grid of
   * R = 5 x scale sub-pixels per font pixel - the same 5x7 letters in the same boxes (layout unchanged), but as smooth
   * strokes: each pixel of the bitmap is a node, joined to its 4-neighbours (and to a diagonal neighbour where the two
   * pixels only touch at a corner) by round-ended strokes one font pixel wide; solid 2x2 blocks stay solid. Diagonals
   * become clean slants, curves become round, stroke ends and corners are softly rounded - like the 1.9.8 x5 strip glyphs.
   * mask(ch, R) -> rows of R*5-bit sub-pixel masks; tools/lcd_font.py builds the menu web font from the same rule. */
  var STROKE = 0.5, DIAG = 0.56;
  function on(g, i, j) { return i >= 0 && i < 5 && j >= 0 && j < 7 && g.charCodeAt(j * 5 + i) === 35; }
  function segs(g) {
    var s = [], i, j, d;
    for (j = 0; j < 7; j++) for (i = 0; i < 5; i++) {
      if (!on(g, i, j)) continue;
      s.push([i + .5, j + .5, i + .5, j + .5, STROKE]);
      if (on(g, i + 1, j)) s.push([i + .5, j + .5, i + 1.5, j + .5, STROKE]);
      if (on(g, i, j + 1)) s.push([i + .5, j + .5, i + .5, j + 1.5, STROKE]);
      for (d = -1; d <= 1; d += 2) if (on(g, i + d, j + 1) && !on(g, i + d, j) && !on(g, i, j + 1)) s.push([i + .5, j + .5, i + d + .5, j + 1.5, DIAG]);
    }
    return s;
  }
  function near(u, v, q) {
    var dx = q[2] - q[0], dy = q[3] - q[1], L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((u - q[0]) * dx + (v - q[1]) * dy) / L2)) : 0;
    var ex = u - q[0] - t * dx, ey = v - q[1] - t * dy;
    return ex * ex + ey * ey <= q[4] * q[4];
  }
  /* -> array of 7R rows, each an array of 5R booleans */
  function mask(ch, R) {
    var g = typeof ch === 'string' && ch.length === 35 ? ch : glyph(ch), S = segs(g), rows = [], x, y, k;
    for (y = 0; y < 7 * R; y++) {
      var row = [];
      for (x = 0; x < 5 * R; x++) {
        var u = (x + .5) / R, v = (y + .5) / R, i = Math.floor(u), j = Math.floor(v), hit = false;
        // solid 2x2 blocks: the square between their four centres is filled
        var bi = u - i < .5 ? i - 1 : i, bj = v - j < .5 ? j - 1 : j;
        if (on(g, bi, bj) && on(g, bi + 1, bj) && on(g, bi, bj + 1) && on(g, bi + 1, bj + 1)) hit = true;
        for (k = 0; k < S.length && !hit; k++) if (near(u, v, S[k])) hit = true;
        row.push(hit);
      }
      rows.push(row);
    }
    return rows;
  }
  var cache = {};
  function sprite(ch, color, R) {
    var key = ch + '|' + color + '|' + R;
    if (cache[key]) return cache[key];
    var m = mask(ch, R), cv = document.createElement('canvas');
    cv.width = 5 * R; cv.height = 7 * R;
    var c = cv.getContext('2d'); c.fillStyle = color;
    for (var y = 0; y < m.length; y++) for (var x = 0; x < m[y].length; x++) {
      if (!m[y][x]) continue;
      var x0 = x; while (x + 1 < m[y].length && m[y][x + 1]) x++;
      c.fillRect(x0, y, x - x0 + 1, 1);
    }
    return (cache[key] = cv);
  }
  function backing(ctx) {           // device pixels per LCD pixel of this context (5 on the LCD, 1 on a plain canvas)
    try { var t = ctx.getTransform && ctx.getTransform(); return t && t.a > 0 ? t.a : 1; } catch (e) { return 1; }
  }
  var hires = typeof document !== 'undefined';
  /* align: 'left' | 'center' | 'right' */
  function draw(ctx, text, x, y, color, scale, align) {
    text = String(text); scale = scale || 1;
    var w = width(text, scale);
    if (align === 'center') x = Math.round(x - w / 2);
    else if (align === 'right') x = Math.round(x - w);
    color = color || '#0f380f';
    var R = hires && ctx.drawImage ? Math.round(backing(ctx) * scale) : 0;
    if (R > 1) {
      var sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;
      for (var n = 0; n < text.length; n++) {
        if (text[n] !== ' ') ctx.drawImage(sprite(glyph(text[n]), color, R), x, y, 5 * scale, 7 * scale);
        x += ADV * scale;
      }
      ctx.imageSmoothingEnabled = sm;
      return w;
    }
    ctx.fillStyle = color;
    for (var i = 0; i < text.length; i++) {
      var g = glyph(text[i]);
      for (var p = 0; p < 35; p++) if (g.charCodeAt(p) === 35) ctx.fillRect(x + (p % 5) * scale, y + ((p / 5) | 0) * scale, scale, scale);
      x += ADV * scale;
    }
    return w;
  }
  /* Word-wrap into lines of at most maxChars. */
  function wrap(text, maxChars) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      if (!cur.length) cur = w;
      else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
      else { lines.push(cur); cur = w; }
    });
    if (cur) lines.push(cur);
    return lines;
  }
  PP.Font = { draw: draw, width: width, wrap: wrap, ADV: ADV, _glyphs: G, mask: mask, glyph: glyph };
})(typeof window !== 'undefined' ? window : globalThis);
