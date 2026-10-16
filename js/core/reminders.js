/* PocketPal - smarter reminders (1.9.6 content, pure).
 * The game simulates the active pal forward (no player actions, same rules as the real
 * simulation) and lists the next moment each kind of care will be needed:
 *   lights   - bedtime: it falls asleep with the lights on (a mistake 1 h later)
 *   hunger   - a hunger call            medicine - it gets sick
 *   poop     - a mess to clean (1 h after the first poop, an hour before it counts)
 *   calls    - an unhappy call, or danger (it would starve / run away)
 *   wake     - it wakes up in the morning (off by default)
 * schedule() turns that into at most MAX real-clock times. Only those TIMES are sent to the
 * worker (no types, no pal data); the type of each time stays on this device so the service
 * worker can word the notification. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util;

  var TYPES = [
    { id: 'lights', label: 'Bedtime', text: 'Bedtime: your pal is asleep but the lights are still on. Turn them off.' },
    { id: 'hunger', label: 'Hungry', text: 'Your pal is hungry.' },
    { id: 'medicine', label: 'Medicine', text: 'Your pal is sick - medicine time.' },
    { id: 'poop', label: 'Clean-up', text: 'Time to clean up after your pal.' },
    { id: 'calls', label: 'Calls', text: 'Your pal is calling you.' },
    { id: 'wake', label: 'Wake-up', text: 'Your pal is waking up.' },
    { id: 'rested', label: 'Rested', text: 'Your pal woke up from its nap, full of energy.' },
    { id: 'hatch', label: 'Hatch', text: 'Your egg is hatching soon. Open the game and watch.' },
    { id: 'tantrum', label: 'Tantrum', text: 'Your pal is throwing a tantrum - scold it within 15 minutes.' },   // 2.4.95
    { id: 'bedsoon', label: 'Bedtime soon', text: 'Bedtime in 15 minutes - get your pal ready for bed.' },          // 2.4.95
    { id: 'evolve', label: 'Evolving', text: 'Your pal is about to evolve! Open the game and watch.' }              // 2.4.95
  ];
  /* 2.4.95: quiet hours = the pal's own sleep hours. Nothing that can become a care mistake runs while it sleeps (the poop
   * and sickness timers stand still, hunger and happiness do not drop), so only these may ring in the night. */
  var NIGHT_OK = { lights: true, wake: true, hatch: true };
  var MISSABLE = { lights: true, hunger: true, medicine: true, poop: true, calls: true, tantrum: true, bedsoon: true };   // can turn into a care mistake (or discipline loss)
  var CHECK = { id: 'check', label: 'Check-in', text: 'Your pal misses you - come and say hi.' };
  var MAX = 8;                  // times per upload
  var AHEAD_MIN = 24 * 60;      // how far to look ahead
  var MERGE_MS = 5 * 60e3;      // times closer than this become one alert (the cron runs every 5 min)
  var CHECK_MS = 3 * 3600e3;    // nothing due: one welfare check-in after 3 h
  var POOP_LEAD_MIN = 60;

  function defaults() { return { lights: true, hunger: true, medicine: true, poop: true, calls: true, wake: false, rested: true, hatch: true, tantrum: true, bedsoon: true, evolve: true }; }
  function clean(o) {
    var d = defaults(), out = {};
    TYPES.forEach(function (t) { out[t.id] = o && typeof o === 'object' && typeof o[t.id] === 'boolean' ? o[t.id] : d[t.id]; });
    return out;
  }
  function type(id) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i]; return id === 'check' ? CHECK : null; }

  /* First upcoming moment of each type, in GAME ms. Pure: works on a copy. */
  function upcoming(p, fromMs, opts) {
    opts = opts || {};
    if (!p || p.fate) return [];
    if (p.stage === 'egg') {
      var egg = U.deepCopy(p), first = {};
      var ctx = { minuteOf: opts.minuteOf || PP.Care.defaultMinuteOf, offline: false };
      egg.lastTickAt = fromMs;
      for (var i = 1; i <= (opts.maxMin || AHEAD_MIN); i++) {
        var ev = [], at = fromMs + i * U.MIN;
        PP.Care.stepMinute(egg, at, ctx, ev);
        for (var j = 0; j < ev.length; j++) if (ev[j].t === 'hatch') { first.hatch = Math.max(fromMs + 60e3, at - 4 * U.MIN); break; }
        if (first.hatch) break;
      }
      return first.hatch ? [{ type: 'hatch', at: first.hatch }] : [];
    }
    var q = U.deepCopy(p), max = opts.maxMin || AHEAD_MIN, first = {}, n = 0;
    var ctx = { minuteOf: opts.minuteOf || PP.Care.defaultMinuteOf, offline: false };
    q.lastTickAt = fromMs;
    function hit(id, at) { if (first[id] == null) { first[id] = at; n++; } }
    for (var i = 1; i <= max && n < TYPES.length; i++) {
      var ev = [], at = fromMs + i * U.MIN;
      PP.Care.stepMinute(q, at, ctx, ev);
      for (var j = 0; j < ev.length; j++) {
        var e = ev[j];
        if (e.t === 'call' && e.fake) hit('tantrum', at);
        else if (e.t === 'sleep' && q.lights) hit('lights', at);
        else if (e.t === 'evolve') hit('evolve', Math.max(fromMs + U.MIN, at - 5 * U.MIN));
        else if (e.t === 'wake' && e.from === 'night') hit('wake', at);
        else if (e.t === 'wake' && e.from === 'nap') hit('rested', at);
        else if (e.t === 'hatch') hit('hatch', at);
      }
      // 2.4.95: need timers, not just the moment a call starts - a call already showing (or a poop already lying there)
      // still gets its push before it counts as a mistake. Poop: an hour before; the others: as soon as they call.
      var nd = q.need || {};
      if (!q.asleep) {
        if (nd.hunger && nd.hunger.next < 1e14) hit('hunger', at);
        if (nd.happy && nd.happy.next < 1e14) hit('calls', at);
        if (nd.sick && nd.sick.next < 1e14) hit('medicine', at);
        if (nd.poop && nd.poop.next - q.clock <= POOP_LEAD_MIN) hit('poop', at);
        if (q.lights) { var sch = PP.Sleep.of(q); if (PP.Sleep.until(ctx.minuteOf(at), sch.bed) === PP.Care.BEDTIME_SOON_MIN) hit('bedsoon', at); }
      } else if (nd.lights && nd.lights.next < 1e14) hit('lights', at);
      if (q.fate) { hit('calls', at - 60 * U.MIN); break; }
    }
    var out = [];
    for (var k in first) out.push({ type: k, at: first[k] });
    return out.sort(function (a, b) { return a.at - b.at; });
  }

  /* The list to send: [{ at: real ms, type }] (sorted, merged, enabled types only). */
  function schedule(state, realNow, opts) {
    var p = PP.Game.active(state), on = clean(state && state.settings && state.settings.alertTypes);
    var nowG = PP.Game.now(state, realNow), out = [];
    var mof = (opts && opts.minuteOf) || PP.Care.defaultMinuteOf, sch = p && p.stage !== 'egg' ? PP.Sleep.of(p) : null;
    upcoming(p, nowG, opts).forEach(function (e) {
      if (!on[e.type]) return;
      if (sch && !NIGHT_OK[e.type] && PP.Sleep.isNight(mof(e.at), sch)) return;   // 2.4.95 quiet hours
      var at = realNow + Math.max(60e3, e.at - nowG);
      var last = out[out.length - 1];
      if (last && at - last.at < MERGE_MS && e.type !== 'hatch' && last.type !== 'hatch') {
        // 2.4.95: two alerts within 5 min become one - keep the wording of the one that can become a care mistake
        // (a "woke from its nap" push used to swallow the clean-up push due the same minute)
        if (MISSABLE[e.type] && !MISSABLE[last.type]) last.type = e.type;
        return;
      }
      out.push({ at: at, type: e.type });
    });
    var any = TYPES.some(function (t) { return on[t.id]; });
    if (!out.length && any && p && !p.fate && p.stage !== 'egg') {
      var ck = realNow + CHECK_MS, cm = mof(nowG + CHECK_MS);
      if (sch && PP.Sleep.isNight(cm, sch)) ck += (PP.Sleep.until(cm, sch.wake) + 30) * U.MIN;   // 2.4.95: not in the night
      out.push({ at: ck, type: 'check' });
    }
    return out.slice(0, MAX);
  }
  /* 2.4.96: the pal's next sleep spans [start, end] in REAL ms (at most 3, within 48 h) for the worker, so its 2-hourly
   * re-arm ping (an app left closed) waits until the pal is up. Only times - no pal data. */
  function quietSpans(state, realNow, opts) {
    var p = PP.Game.active(state); if (!p || p.fate || p.stage === 'egg') return [];
    var mof = (opts && opts.minuteOf) || PP.Care.defaultMinuteOf, sch = PP.Sleep.of(p), nowG = PP.Game.now(state, realNow);
    var off = nowG - realNow, out = [], start = null, t0 = Math.floor(nowG / U.MIN) * U.MIN;
    for (var i = 0; i <= 48 * 60 && out.length < 3; i++) {
      var t = t0 + i * U.MIN, night = PP.Sleep.isNight(mof(t), sch);
      if (night && start == null) start = t;
      if (!night && start != null) { out.push([start - off, t - off]); start = null; }
    }
    return out.filter(function (q) { return q[1] > realNow; });
  }
  function next(state, realNow, opts) { var s = schedule(state, realNow, opts); return s[0] || null; }
  /* "Hungry · 3:40 pm" style text for the Next alert line. */
  function describe(e, clock, realNow) {
    if (!e) return 'none planned';
    var t = type(e.type), d = new Date(e.at), mins = Math.round((e.at - realNow) / 60000);
    var hm = PP.Time && PP.Time.hm ? PP.Time.hm(d.getHours() * 60 + d.getMinutes(), clock || '12') : d.toTimeString().slice(0, 5);
    var rel = mins < 60 ? 'in ' + Math.max(1, mins) + ' min' : 'in ~' + Math.round(mins / 60) + ' h';
    return (t ? t.label : 'Reminder') + ' \u00b7 ' + hm + ' (' + rel + ')';   // 2.1.0: an unknown type (older schedule) no longer throws
  }
  /* For the service worker: the entry that a push arriving at `now` is most likely about. */
  function pick(list, now) {
    var best = null;
    (list || []).forEach(function (e) {
      var d = e.at - now;
      if (d > 20 * 60e3 || d < -30 * 60e3) return;   // 2.4.92: was -3 h - a later push (the worker's 2-hour re-arm) reused an old entry's words, e.g. "woke from its nap" in the night
      if (!best || Math.abs(d) < Math.abs(best.at - now)) best = e;
    });
    return best;
  }

  PP.Reminders = { TYPES: TYPES, CHECK: CHECK, MAX: MAX, MERGE_MS: MERGE_MS, defaults: defaults, clean: clean, type: type,
    NIGHT_OK: NIGHT_OK, MISSABLE: MISSABLE, upcoming: upcoming, schedule: schedule, quietSpans: quietSpans, next: next, describe: describe, pick: pick };
})(typeof window !== 'undefined' ? window : globalThis);
