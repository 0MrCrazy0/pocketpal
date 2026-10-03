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
    { id: 'lights', label: 'Bedtime', text: 'Bedtime! Turn the lights off.' },
    { id: 'hunger', label: 'Hungry', text: 'Your pal is hungry.' },
    { id: 'medicine', label: 'Medicine', text: 'Your pal is sick - medicine time.' },
    { id: 'poop', label: 'Clean-up', text: 'Time to clean up after your pal.' },
    { id: 'calls', label: 'Calls', text: 'Your pal is calling you.' },
    { id: 'wake', label: 'Wake-up', text: 'Your pal is waking up.' }
  ];
  var CHECK = { id: 'check', label: 'Check-in', text: 'Your pal misses you - come and say hi.' };
  var MAX = 8;                  // times per upload
  var AHEAD_MIN = 24 * 60;      // how far to look ahead
  var MERGE_MS = 5 * 60e3;      // times closer than this become one alert (the cron runs every 5 min)
  var CHECK_MS = 3 * 3600e3;    // nothing due: one welfare check-in after 3 h
  var POOP_LEAD_MIN = 60;

  function defaults() { return { lights: true, hunger: true, medicine: true, poop: true, calls: true, wake: false }; }
  function clean(o) {
    var d = defaults(), out = {};
    TYPES.forEach(function (t) { out[t.id] = o && typeof o === 'object' && typeof o[t.id] === 'boolean' ? o[t.id] : d[t.id]; });
    return out;
  }
  function type(id) { for (var i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i]; return id === 'check' ? CHECK : null; }

  /* First upcoming moment of each type, in GAME ms. Pure: works on a copy. */
  function upcoming(p, fromMs, opts) {
    opts = opts || {};
    if (!p || p.fate || p.stage === 'egg') return [];
    var q = U.deepCopy(p), max = opts.maxMin || AHEAD_MIN, first = {}, n = 0;
    var ctx = { minuteOf: opts.minuteOf || PP.Care.defaultMinuteOf, offline: false };
    q.lastTickAt = fromMs;
    function hit(id, at) { if (first[id] == null) { first[id] = at; n++; } }
    for (var i = 1; i <= max && n < TYPES.length; i++) {
      var ev = [], at = fromMs + i * U.MIN;
      PP.Care.stepMinute(q, at, ctx, ev);
      for (var j = 0; j < ev.length; j++) {
        var e = ev[j];
        if (e.t === 'call' && !e.fake) hit({ hunger: 'hunger', sick: 'medicine', lights: 'lights', poop: 'poop' }[e.need] || 'calls', at);
        else if (e.t === 'sick') hit('medicine', at);
        else if (e.t === 'poop') hit('poop', at + POOP_LEAD_MIN * U.MIN);
        else if (e.t === 'sleep' && q.lights) hit('lights', at);
        else if (e.t === 'wake' && e.from === 'night') hit('wake', at);
      }
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
    upcoming(p, nowG, opts).forEach(function (e) {
      if (!on[e.type]) return;
      var at = realNow + Math.max(60e3, e.at - nowG);
      var last = out[out.length - 1];
      if (last && at - last.at < MERGE_MS) return;          // one ping covers both
      out.push({ at: at, type: e.type });
    });
    var any = TYPES.some(function (t) { return on[t.id]; });
    if (!out.length && any && p && !p.fate && p.stage !== 'egg') out.push({ at: realNow + CHECK_MS, type: 'check' });
    return out.slice(0, MAX);
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
      if (d > 20 * 60e3 || d < -3 * 3600e3) return;
      if (!best || Math.abs(d) < Math.abs(best.at - now)) best = e;
    });
    return best;
  }

  PP.Reminders = { TYPES: TYPES, CHECK: CHECK, MAX: MAX, MERGE_MS: MERGE_MS, defaults: defaults, clean: clean, type: type,
    upcoming: upcoming, schedule: schedule, next: next, describe: describe, pick: pick };
})(typeof window !== 'undefined' ? window : globalThis);
