/* PocketPal 1.9.0 - daily goals, rare events and seasonal shells (pure, no DOM).
 *
 * Every local game day the pal gets 3 small goals picked from a pool (by hash, so the
 * same day always gives the same goals). Each goal pays +5 coins; finishing all three
 * pays a bonus that grows with a streak of full days. Coins from here are bonuses
 * (not counted against the daily earning cap).
 *
 * Clock guard: a new day only starts when the day number is HIGHER than the last day
 * seen. Setting the device clock back never re-opens a day, re-rolls goals or events,
 * or pays anything twice.
 *
 * Rare events (at most one a day, by hash): a visiting wild pal (adults: one special
 * battle, +25 bonus coins for a win), a lucky coin day (coins from play x2, daily cap x2)
 * and, very rarely, a golden egg (a normal pal with a cosmetic golden sparkle; hatching
 * one unlocks the Gilded shell). None of them change stats or adult forms.
 *
 * Seasonal shells: finish all 3 goals on 3 different days inside the season window
 * (local month) to earn Spooky (Oct), Frost (Dec-Jan) or Blossom (Mar-May and Sep-Nov:
 * spring in both hemispheres). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util;

  var GOAL_COINS = 5, ALL_BONUS = 10, STREAK_STEP = 2, STREAK_MAX = 5, HARD_BONUS = 5, VISITOR_BONUS = 25;
  var SEASON_DAYS = 3;
  var POOL = [
    { id: 'meal', need: 2, text: 'Feed 2 meals' },
    { id: 'game', need: 1, text: 'Win a play game' },
    { id: 'train', need: 1, text: 'Train once' },
    { id: 'clean', need: 1, text: 'Clean up a mess' },
    { id: 'happy', need: 1, text: 'Fill every happy heart' },
    { id: 'battle', need: 1, text: 'Win a battle', adult: true },
    { id: 'praise', need: 1, text: 'Praise a good deed', notBaby: true },
    { id: 'lights', need: 1, text: 'Lights off at bedtime' }
  ];
  var SEASONS = [
    { id: 'spooky', name: 'Spooky', months: [9], window: 'October' },
    { id: 'frost', name: 'Frost', months: [11, 0], window: 'December - January' },
    { id: 'blossom', name: 'Blossom', months: [2, 3, 4, 8, 9, 10], window: 'March - May or September - November' }
  ];
  var EVENTS = {
    visitor: { name: 'A visitor!', text: 'A wild pal came to visit. Beat it once today for +' + VISITOR_BONUS + ' coins.' },
    lucky: { name: 'Lucky coin day!', text: 'Coins from games, training and battles are doubled today.' },
    golden: { name: 'A golden egg!', text: 'A rare golden egg appeared in your Pal Box.' }
  };
  var notes = [];   // in-memory queue the UI drains (toasts)

  function dayOf(t) { return PP.Shop.dayOf(t); }
  function blank() {
    return { day: null, goals: [], allPaid: false, streak: 0, lastAll: null, maxSeen: null, event: null, eventUsed: false,
      season: {}, golden: 0, pendingGolden: false };
  }
  function ensure(state) {
    if (!state.daily || typeof state.daily !== 'object') state.daily = blank();
    return state.daily;
  }
  function eligible(p) {
    var st = p ? p.stage : 'baby';
    return POOL.filter(function (g) { return !(g.adult && st !== 'adult') && !(g.notBaby && st === 'baby'); });
  }
  function pickGoals(state, p, dk) {
    var list = eligible(p).slice(), out = [], rng = U.makeRng(U.hash(state.seed, 'goals', dk) >>> 0);
    while (out.length < 3 && list.length) {
      var i = Math.floor(rng() * list.length), g = list.splice(i, 1)[0];
      out.push({ id: g.id, n: 0, need: g.need, done: false });
    }
    return out;
  }
  function pickEvent(state, p, dk) {
    var r = U.roll(state.seed, dk, 'rare');
    if (r < 0.015) return 'golden';
    if (r < 0.095) return 'lucky';
    if (r < 0.175 && p && p.stage === 'adult') return 'visitor';
    return null;
  }
  function seasonsAt(t) {
    var m = new Date(t).getMonth();
    return SEASONS.filter(function (s) { return s.months.indexOf(m) >= 0; }).map(function (s) { return s.id; });
  }

  /* Start a new day if (and only if) the day number went UP. Returns events for the UI. */
  function roll(state, t, p) {
    var d = ensure(state), dk = dayOf(t), ev = [];
    if (d.maxSeen == null || dk > d.maxSeen) d.maxSeen = dk;
    if (d.day != null && dk <= d.day) {                       // same day, or the clock went back: nothing new
      if (dk < d.day) ev.push({ t: 'dailyClockBack' });
      return ev.concat(placeGolden(state, t));
    }
    if (!p || p.fate || p.stage === 'egg') return ev.concat(placeGolden(state, t));   // goals start once a pal has hatched
    d.day = dk; d.goals = pickGoals(state, p, dk); d.allPaid = false;
    d.event = pickEvent(state, p, dk); d.eventUsed = false;
    ev.push({ t: 'dailyGoals', goals: d.goals.map(function (g) { return text(g); }) });
    if (d.event) {
      ev.push({ t: 'rare', kind: d.event, name: EVENTS[d.event].name, text: EVENTS[d.event].text });
      if (d.event === 'golden') d.pendingGolden = true;
    }
    return ev.concat(placeGolden(state, t));
  }
  /* A golden egg waits until there is a free Pal Box slot. */
  function placeGolden(state, t) {
    var d = ensure(state);
    if (!d.pendingGolden || PP.Game.freeSlot(state) < 0) return [];
    var sp = PP.DATA.SPECIES[U.hash(state.seed, 'golden', d.day) % PP.DATA.SPECIES.length];
    var r = PP.Game.startEgg(state, sp, t - (state.timeOffset || 0), { golden: true });
    if (!r.ok) return [];
    d.pendingGolden = false;
    return [{ t: 'goldenEgg', slot: r.slot, species: sp }];
  }
  function text(g) {
    var def = POOL.filter(function (x) { return x.id === g.id; })[0];
    return def ? def.text : g.id;
  }
  function today(state, t) {
    var d = ensure(state);
    return d.day != null && dayOf(t) === d.day ? d : null;
  }
  /* Progress a goal (only on the current day). Pays coins and queues notes. */
  function record(state, id, t, n) {
    var d = today(state, t), out = { coins: 0, done: [], all: false, shells: [] };
    if (!d) return out;
    d.goals.forEach(function (g) {
      if (g.id !== id || g.done) return;
      g.n = Math.min(g.need, g.n + (n || 1));
      if (g.n >= g.need) {
        g.done = true; out.done.push(text(g));
        out.coins += PP.Shop.earn(state, GOAL_COINS, t, false);
        notes.push({ t: 'goal', text: text(g), coins: GOAL_COINS });
      }
    });
    if (!d.allPaid && d.goals.length && d.goals.every(function (g) { return g.done; })) {
      d.allPaid = true; out.all = true;
      d.streak = d.lastAll === d.day - 1 ? d.streak + 1 : 1;
      d.lastAll = d.day;
      var p = PP.Game.active(state), bonus = ALL_BONUS + STREAK_STEP * Math.min(d.streak - 1, STREAK_MAX) + (p && p.hard ? HARD_BONUS : 0);
      out.coins += PP.Shop.earn(state, bonus, t, false);
      seasonsAt(t).forEach(function (s) {
        var list = d.season[s] = Array.isArray(d.season[s]) ? d.season[s] : [];
        if (list.indexOf(d.day) < 0) list.push(d.day);
      });
      out.shells = PP.Collection.checkUnlocks(state).map(function (s) { return s.name; });
      notes.push({ t: 'allGoals', coins: bonus, streak: d.streak, shells: out.shells });
    }
    return out;
  }
  /* Watch the pal for goals that are states rather than actions. */
  function observe(state, t) {
    var p = PP.Game.active(state);
    if (p && !p.fate && p.stage !== 'egg' && p.happy >= PP.DATA.RULES.maxHearts) record(state, 'happy', t);
  }
  function coinMult(state, t) { var d = today(state, t); return d && d.event === 'lucky' ? 2 : 1; }
  function visitorReady(state, t) { var d = today(state, t); return !!(d && d.event === 'visitor' && !d.eventUsed); }
  function useVisitor(state, t) { var d = today(state, t); if (d) d.eventUsed = true; }
  function seasonDays(state, id) { var d = ensure(state); return Array.isArray(d.season[id]) ? d.season[id].length : 0; }
  function season(id) { return SEASONS.filter(function (s) { return s.id === id; })[0] || null; }
  function drain() { return notes.splice(0, notes.length); }

  function clean(d) {
    var o = blank();
    if (!d || typeof d !== 'object') return o;
    var num = function (v) { return Number.isFinite(v) ? Math.round(v) : null; };
    o.day = num(d.day); o.maxSeen = num(d.maxSeen); o.lastAll = num(d.lastAll);
    o.streak = U.int(d.streak, 0, 0, 9999); o.allPaid = !!d.allPaid; o.eventUsed = !!d.eventUsed;
    o.event = EVENTS[d.event] ? d.event : null; o.pendingGolden = !!d.pendingGolden; o.golden = U.int(d.golden, 0, 0, 9999);
    o.goals = Array.isArray(d.goals) ? d.goals.filter(function (g) { return g && POOL.some(function (x) { return x.id === g.id; }); }).slice(0, 3).map(function (g) {
      var need = U.int(g.need, 1, 1, 10); return { id: g.id, need: need, n: U.int(g.n, 0, 0, need), done: !!g.done };
    }) : [];
    if (d.season && typeof d.season === 'object') SEASONS.forEach(function (s) {
      if (Array.isArray(d.season[s.id])) o.season[s.id] = d.season[s.id].filter(Number.isFinite).map(Math.round).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(-60);
    });
    if (o.maxSeen != null && o.day != null && o.maxSeen < o.day) o.maxSeen = o.day;
    return o;
  }

  PP.Daily = { POOL: POOL, SEASONS: SEASONS, EVENTS: EVENTS, SEASON_DAYS: SEASON_DAYS, GOAL_COINS: GOAL_COINS, ALL_BONUS: ALL_BONUS, VISITOR_BONUS: VISITOR_BONUS, HARD_BONUS: HARD_BONUS,
    ensure: ensure, roll: roll, record: record, observe: observe, today: today, text: text, coinMult: coinMult, seasonsAt: seasonsAt,
    visitorReady: visitorReady, useVisitor: useVisitor, seasonDays: seasonDays, season: season, placeGolden: placeGolden, drain: drain, clean: clean, notes: notes };
})(typeof window !== 'undefined' ? window : globalThis);
