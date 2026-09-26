/* PocketPal 2 - shared helpers (pure, no DOM).
 * Every core file attaches to the global PP namespace so the game works from
 * classic <script> tags (file://) and from Node tests (require in order). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function num(v, def, lo, hi) {
    var n = typeof v === 'number' && isFinite(v) ? v : def;
    if (lo != null) n = Math.max(lo, n);
    if (hi != null) n = Math.min(hi, n);
    return n;
  }
  function int(v, def, lo, hi) { return Math.round(num(v, def, lo, hi)); }

  /* 32-bit string/number hash (FNV-1a + avalanche). Deterministic everywhere. */
  function hash() {
    var h = 2166136261 >>> 0;
    for (var a = 0; a < arguments.length; a++) {
      var s = String(arguments[a]);
      for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      h ^= 0x9e3779b9; h = Math.imul(h, 16777619) >>> 0;
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  /* Seeded PRNG (mulberry32). rng() -> [0,1). State is a plain number so it can be saved. */
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    var r = function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.state = function () { return s; };
    r.int = function (lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); };
    r.pick = function (arr) { return arr[Math.floor(r() * arr.length)]; };
    r.chance = function (p) { return r() < p; };
    return r;
  }
  /* Stateless "random number for this key" - used by the care tick so that
   * simulating 10 hours in one go or in 600 one-minute steps gives the same result. */
  function roll() { return hash.apply(null, arguments) / 4294967296; }

  function uid(rng) {
    var r = rng || Math.random;
    var s = '';
    for (var i = 0; i < 10; i++) s += 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(r() * 31)];
    return s;
  }
  function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }

  var MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  PP.util = { clamp: clamp, num: num, int: int, hash: hash, makeRng: makeRng, roll: roll, uid: uid, deepCopy: deepCopy, MIN: MIN, HOUR: HOUR, DAY: DAY };
  if (typeof module !== 'undefined' && module.exports) module.exports = PP;
})(typeof window !== 'undefined' ? window : globalThis);
