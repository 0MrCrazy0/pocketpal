/* PocketPal - QR code maker (2.4.97, pure, no dependencies; written for this game, nothing loaded from a CDN).
 * Byte mode, error correction M (L for long codes), versions 1-40, all 8 masks tried (lowest penalty wins), as in
 * ISO/IEC 18004. PP.QR.matrix(text) -> { size, mods: [[bool]] }; PP.QR.svg(text, px) -> an <svg> string with a
 * 4-module quiet zone. Only used to SHOW your own battle code; scanning uses the browser's BarcodeDetector. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var ECC_PER_BLOCK = {
    L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
  };
  var BLOCKS = {
    L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
  };
  var FORMAT_BITS = { L: 1, M: 0 };

  function rawModules(v) {
    var r = (16 * v + 128) * v + 64;
    if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  function dataCodewords(v, e) { return Math.floor(rawModules(v) / 8) - ECC_PER_BLOCK[e][v] * BLOCKS[e][v]; }
  function utf8(s) { var b = [], u = unescape(encodeURIComponent(String(s))); for (var i = 0; i < u.length; i++) b.push(u.charCodeAt(i)); return b; }

  function gmul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 255; }
  function rsDivisor(deg) {
    var r = []; for (var i = 0; i < deg; i++) r.push(0); r[deg - 1] = 1;
    var rt = 1;
    for (var k = 0; k < deg; k++) { for (var j = 0; j < deg; j++) { r[j] = gmul(r[j], rt); if (j + 1 < deg) r[j] ^= r[j + 1]; } rt = gmul(rt, 2); }
    return r;
  }
  function rsRem(data, div) {
    var r = div.map(function () { return 0; });
    data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); for (var i = 0; i < div.length; i++) r[i] ^= gmul(div[i], f); });
    return r;
  }
  function alignPos(v, size) {
    if (v === 1) return [];
    var n = Math.floor(v / 7) + 2, step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, out = [6];
    for (var pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
    return out;
  }

  function encode(text) {
    var bytes = utf8(text), ecl = null, ver = 0;
    ['M', 'L'].some(function (e) {
      for (var v = 1; v <= 40; v++) { var cc = v <= 9 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCodewords(v, e) * 8 && bytes.length < (1 << cc)) { ecl = e; ver = v; return true; } }
      return false;
    });
    if (!ecl) throw new Error('Too long for a QR code');
    // M is preferred unless it needs a much bigger symbol than L (keeps long codes easy to scan on a phone screen)
    if (ecl === 'M') for (var vl = 1; vl < ver - 2; vl++) { var c2 = vl <= 9 ? 8 : 16; if (4 + c2 + bytes.length * 8 <= dataCodewords(vl, 'L') * 8) { ecl = 'L'; ver = vl; break; } }
    var cap = dataCodewords(ver, ecl) * 8, bits = [];
    var put = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, ver <= 9 ? 8 : 16); bytes.forEach(function (b) { put(b, 8); });
    put(0, Math.min(4, cap - bits.length)); put(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
    // split into blocks, add Reed-Solomon codewords, interleave
    var nb = BLOCKS[ecl][ver], el = ECC_PER_BLOCK[ecl][ver], raw = Math.floor(rawModules(ver) / 8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(el), blocks = [], k = 0;
    for (var bi = 0; bi < nb; bi++) {
      var d = data.slice(k, k + shortLen - el + (bi < nShort ? 0 : 1)); k += d.length;
      var blk = d.concat(rsRem(d, div)); if (bi < nShort) blk.splice(shortLen - el, 0, null);
      blocks.push(blk);
    }
    var all = [];
    for (var x = 0; x < blocks[0].length; x++) for (var y = 0; y < nb; y++) if (blocks[y][x] !== null) all.push(blocks[y][x]);
    return { ver: ver, ecl: ecl, codewords: all };
  }

  function build(enc, mask) {
    var v = enc.ver, size = v * 4 + 17, M = [], F = [];
    for (var r = 0; r < size; r++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    var set = function (x, y, dark) { M[y][x] = !!dark; F[y][x] = true; };
    for (var i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) {
        var xx = c[0] + dx, yy = c[1] + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, dist !== 2 && dist !== 4);
      }
    });
    var ap = alignPos(v, size), n = ap.length;
    for (var a = 0; a < n; a++) for (var b = 0; b < n; b++) {
      if ((a === 0 && b === 0) || (a === 0 && b === n - 1) || (a === n - 1 && b === 0)) continue;
      for (var ey = -2; ey <= 2; ey++) for (var ex = -2; ex <= 2; ex++) set(ap[a] + ex, ap[b] + ey, Math.max(Math.abs(ex), Math.abs(ey)) !== 1);
    }
    formatBits(set, size, enc.ecl, 0);   // reserve
    if (v >= 7) {
      var rem = v; for (var q = 0; q < 12; q++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
      var vb = (v << 12) | rem;
      for (var t = 0; t < 18; t++) { var bit = (vb >>> t) & 1, aa = size - 11 + t % 3, bb = Math.floor(t / 3); set(aa, bb, bit); set(bb, aa, bit); }
    }
    // codewords, zig-zag from the bottom right
    var cw = enc.codewords, bi2 = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (var j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!F[y][x] && bi2 < cw.length * 8) { M[y][x] = ((cw[bi2 >>> 3] >>> (7 - (bi2 & 7))) & 1) === 1; bi2++; }
      }
    }
    for (var yy2 = 0; yy2 < size; yy2++) for (var xx2 = 0; xx2 < size; xx2++) if (!F[yy2][xx2] && maskBit(mask, xx2, yy2)) M[yy2][xx2] = !M[yy2][xx2];
    formatBits(set, size, enc.ecl, mask);
    return M;
  }
  function maskBit(m, x, y) {
    switch (m) {
      case 0: return (x + y) % 2 === 0; case 1: return y % 2 === 0; case 2: return x % 3 === 0; case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; case 5: return x * y % 2 + x * y % 3 === 0;
      case 6: return (x * y % 2 + x * y % 3) % 2 === 0; default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
    }
  }
  function formatBits(set, size, ecl, mask) {
    var d = (FORMAT_BITS[ecl] << 3) | mask, rem = d;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((d << 10) | rem) ^ 0x5412, g = function (k) { return (bits >>> k) & 1; };
    for (var a = 0; a <= 5; a++) set(8, a, g(a));
    set(8, 7, g(6)); set(8, 8, g(7)); set(7, 8, g(8));
    for (var b = 9; b < 15; b++) set(14 - b, 8, g(b));
    for (var c = 0; c < 8; c++) set(size - 1 - c, 8, g(c));
    for (var e = 8; e < 15; e++) set(8, size - 15 + e, g(e));
    set(8, size - 8, 1);
  }
  function penalty(M) {
    var n = M.length, p = 0, dark = 0, line, run, prev, x, y;
    for (var pass = 0; pass < 2; pass++) for (y = 0; y < n; y++) {
      run = 0; prev = null; line = '';
      for (x = 0; x < n; x++) {
        var c = pass ? M[x][y] : M[y][x]; line += c ? '1' : '0';
        if (c === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else { run = 1; prev = c; }
      }
      var re = /(?=(10111010000|00001011101))/g; while (re.exec(line)) { p += 40; re.lastIndex++; }
    }
    for (y = 0; y < n - 1; y++) for (x = 0; x < n - 1; x++) { var v = M[y][x]; if (v === M[y][x + 1] && v === M[y + 1][x] && v === M[y + 1][x + 1]) p += 3; }
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (M[y][x]) dark++;
    p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
    return p;
  }
  function matrix(text) {
    var enc = encode(text), best = null, bp = Infinity;
    for (var m = 0; m < 8; m++) { var M = build(enc, m), pe = penalty(M); if (pe < bp) { bp = pe; best = M; } }
    return { size: best.length, mods: best, ver: enc.ver, ecl: enc.ecl };
  }
  function svg(text, px) {
    var q = matrix(text), n = q.size + 8, d = '';
    for (var y = 0; y < q.size; y++) for (var x = 0; x < q.size; x++) if (q.mods[y][x]) d += 'M' + (x + 4) + ' ' + (y + 4) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="qr" viewBox="0 0 ' + n + ' ' + n + '" width="' + (px || 240) + '" height="' + (px || 240) +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code of your battle code"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
  }
  PP.QR = { matrix: matrix, svg: svg, _encode: encode };
})(typeof window !== 'undefined' ? window : globalThis);
