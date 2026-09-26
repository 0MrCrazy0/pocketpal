/* PocketPal 2 - per-pal sleep schedules (pure).
 * Each pal has a bedtime and a wake time in minutes after midnight (local clock),
 * in 15-minute steps. p.sched = null means "use the default for my stage", so a
 * pal that never had a custom schedule keeps following the stage defaults as it
 * grows. A custom schedule must give a sensible amount of sleep for the stage
 * (younger pals need more); it may cross midnight (22:00 -> 08:00) or not
 * (01:00 -> 09:00 for night owls). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var D = PP.DATA;

  var STEP = 15;
  /* Allowed sleep length in hours [min, max] per stage. Defaults sit inside. */
  var LIMITS = { baby: [11, 15], child: [10, 14], teen: [9, 13], adult: [8, 12] };
  function stageOf(stage) { return LIMITS[stage] ? stage : 'adult'; }
  function defaultFor(stage) {
    var s = (D.CARE[stageOf(stage)] || D.CARE.adult).sleep;
    return { bed: s[0] * 60, wake: s[1] * 60 };
  }
  function norm(m) { return ((Math.round(m) % 1440) + 1440) % 1440; }
  function lengthMin(s) { var l = norm(s.wake - s.bed); return l === 0 ? 1440 : l; }
  function limits(stage) { var l = LIMITS[stageOf(stage)]; return { min: l[0] * 60, max: l[1] * 60 }; }

  /* null if OK, otherwise a short reason for the player. */
  function check(s, stage) {
    if (!s || !isFinite(s.bed) || !isFinite(s.wake)) return 'Missing times';
    if (s.bed < 0 || s.bed >= 1440 || s.wake < 0 || s.wake >= 1440) return 'Times must be within the day';
    if (s.bed % STEP || s.wake % STEP) return 'Times go in ' + STEP + '-minute steps';
    var l = lengthMin(s), lim = limits(stage), label = stageOf(stage) === 'adult' ? 'adults' : stageOf(stage) === 'baby' ? 'babies' : stageOf(stage) + 's';
    if (l < lim.min) return 'Too short: ' + label + ' need at least ' + lim.min / 60 + 'h of sleep';
    if (l > lim.max) return 'Too long: ' + label + ' sleep at most ' + lim.max / 60 + 'h';
    return null;
  }
  /* Keep the bedtime, move the wake time so the length fits the stage. */
  function fit(s, stage) {
    if (!s || !isFinite(s.bed) || !isFinite(s.wake)) return defaultFor(stage);
    var bed = norm(Math.round(s.bed / STEP) * STEP), wake = norm(Math.round(s.wake / STEP) * STEP);
    var lim = limits(stage), l = lengthMin({ bed: bed, wake: wake });
    if (l < lim.min) wake = norm(bed + lim.min);
    else if (l > lim.max) wake = norm(bed + lim.max);
    return { bed: bed, wake: wake };
  }
  function same(a, b) { return !!a && !!b && a.bed === b.bed && a.wake === b.wake; }
  /* The schedule the pal actually follows. */
  function of(p) {
    var st = p && p.stage;
    if (p && p.sched && !check(p.sched, st)) return p.sched;
    return defaultFor(st);
  }
  function isNight(minOfDay, s) {
    var m = norm(minOfDay);
    return s.bed > s.wake ? (m >= s.bed || m < s.wake) : (m >= s.bed && m < s.wake);
  }
  /* Minutes from minOfDay until the next bedtime / wake time. */
  function until(minOfDay, target) { var d = norm(target - minOfDay); return d === 0 ? 1440 : d; }

  /* Player sets a new schedule. Takes effect from the next simulated minute.
   * Fairness: the lights-off grace period restarts, so moving bedtime earlier
   * (the pal falls asleep right away) never causes an instant care mistake. */
  function set(p, s) {
    if (!p || p.fate) return { ok: false, msg: 'No pal' };
    if (p.stage === 'egg') return { ok: false, msg: 'Eggs do not have a bedtime yet' };
    var err = check(s, p.stage);
    if (err) return { ok: false, msg: err };
    var clean = { bed: norm(s.bed), wake: norm(s.wake) };
    p.sched = same(clean, defaultFor(p.stage)) ? null : clean;
    p.schedAt = p.clock; p.holdTo = null;
    if (p.need) p.need.lights = null;
    return { ok: true, msg: 'Sleep schedule saved', sched: of(p) };
  }
  function clean(v, stage) {
    if (!v || typeof v !== 'object' || !isFinite(v.bed) || !isFinite(v.wake)) return null;
    var s = fit(v, stage);
    return same(s, defaultFor(stage)) ? null : s;
  }

  PP.Sleep = { STEP: STEP, LIMITS: LIMITS, defaultFor: defaultFor, lengthMin: lengthMin, limits: limits, check: check, fit: fit,
    of: of, isNight: isNight, until: until, set: set, clean: clean, same: same };
})(typeof window !== 'undefined' ? window : globalThis);
