/* PocketPal - Paldex (collection) and shell colour unlocks (pure).
 *
 * Paldex: 42 entries = 6 species x (baby, child, teen, Scrappy, Solid, Champion, Secret).
 *   1.9.7: an unknown secret form shows as a dark silhouette with a short hint (secret: true).
 *   'raised' = one of your pals reached that stage/form. 'seen' = met it in a battle or
 *   a friend code (shown as a dim picture, but it does not count for milestones).
 *   Stored compactly as state.dex["lion:perfect"] = { r: raisedAt, s: seenAt }.
 * Shells: free colours + specials unlocked by arena cups or Paldex milestones.
 *   Once unlocked, a shell stays unlocked (state.unlocks).
 */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var D = PP.DATA;
  var KEYS = ['baby', 'child', 'teen', 'bad', 'good', 'perfect', 'secret'];
  var ADULT = ['bad', 'good', 'perfect', 'secret'];

  function entries() {
    var out = [];
    D.SPECIES.forEach(function (sp) { KEYS.forEach(function (k) { out.push({ species: sp, key: k, id: sp + ':' + k, name: D.NAMES[sp][k], adult: ADULT.indexOf(k) >= 0, secret: k === 'secret' }); }); });
    return out;
  }
  function keyOf(p) { return !p || p.stage === 'egg' ? null : p.stage === 'adult' ? (p.form || 'good') : p.stage; }
  function get(state, sp, key) { return (state.dex || {})[sp + ':' + key] || null; }

  /* Marks an entry. kind: 'raised' | 'seen'. Returns true if this is new information. */
  function mark(state, sp, key, kind, now) {
    if (D.SPECIES.indexOf(sp) < 0 || KEYS.indexOf(key) < 0) return false;
    state.dex = state.dex || {};
    var id = sp + ':' + key, e = state.dex[id] || (state.dex[id] = {});
    var f = kind === 'raised' ? 'r' : 's';
    if (e[f]) return false;
    e[f] = now || 1;
    return true;
  }
  function markPet(state, p, now) { var k = keyOf(p); return k ? mark(state, p.species, k, 'raised', now) : false; }
  function markSeen(state, card, now) { return card && card.form ? mark(state, card.species, card.form, 'seen', now) : false; }

  function counts(state) {
    var c = { adults: 0, adultsSeen: 0, young: 0, total: 0, perSpecies: {} };
    D.SPECIES.forEach(function (sp) {
      var n = 0;
      KEYS.forEach(function (k) {
        var e = get(state, sp, k);
        if (e && e.r) { c.total++; n++; if (ADULT.indexOf(k) >= 0) c.adults++; else c.young++; }
        else if (e && e.s && ADULT.indexOf(k) >= 0) c.adultsSeen++;
      });
      c.perSpecies[sp] = n;
    });
    return c;
  }
  var HOW = {
    baby: 'Hatch a {S} egg',
    child: 'Raise a {S} to the child stage (2 h)',
    teen: 'Raise a {S} to the teen stage (~1.5 days)',
    bad: 'Raise a {S} with poor care (lots of care mistakes)',
    good: 'Raise a {S} with decent care (care score 60+)',
    perfect: 'Raise a {S} with perfect care: max 2 mistakes, score 90+, discipline 50%+'
  };
  function hint(sp, key) {
    if (key === 'secret') return 'Secret form. ' + D.SECRET[sp].hint;   // 1.9.7
    return HOW[key].replace('{S}', D.SPECIES_INFO[sp].label);
  }

  /* Fill the Paldex from pals you already have (used when loading older saves). */
  function syncFromState(state) {
    (state.album || []).forEach(function (a) {
      if (!a || D.SPECIES.indexOf(a.species) < 0) return;
      var order = ['baby', 'child', 'teen', 'adult'], upto = order.indexOf(a.stage);
      for (var i = 0; i <= upto && i < 3; i++) mark(state, a.species, order[i], 'raised', a.hatchedAt || 1);
      if (a.stage === 'adult') mark(state, a.species, a.form || 'good', 'raised', a.hatchedAt || 1);
    });
    (state.slots || []).forEach(function (p) {
      if (!p || p.stage === 'egg') return;
      var order = ['baby', 'child', 'teen', 'adult'], upto = order.indexOf(p.stage);
      for (var i = 0; i <= upto && i < 3; i++) mark(state, p.species, order[i], 'raised', p.hatchedAt || 1);
      if (p.stage === 'adult') markPet(state, p, p.hatchedAt || 1);
    });
    (state.friends || []).forEach(function (c) { markSeen(state, c, 1); });
  }

  /* ---------------------------------------------------------------- shells */
  function shell(id) { for (var i = 0; i < D.SHELLS.length; i++) if (D.SHELLS[i].id === id) return D.SHELLS[i]; return null; }
  function requirement(s) {
    var u = s.unlock; if (!u) return '';
    if (u.cup) return 'Win the ' + D.ARENA[u.cup - 1].name + ' (arena cup ' + u.cup + ')';
    if (u.champion) return 'Become Arena Champion (win all ' + D.ARENA_MAIN + ' main cups)';
    if (u.dex) return 'Raise ' + u.dex + ' different adult forms (Paldex)';
    if (u.season) { var se = PP.Daily.season(u.season); return 'Finish all 3 daily goals on ' + PP.Daily.SEASON_DAYS + ' days in ' + (se ? se.window : u.season); }
    if (u.golden) return 'Hatch a rare golden egg';
    return '';
  }
  /* { ok, need, have, goal } - have/goal give a progress count for the menu. */
  function shellStatus(state, id) {
    var s = shell(id);
    if (!s) return { ok: false, need: 'Unknown shell' };
    if (s.price) return (state.unlocks || []).indexOf(id) >= 0 ? { ok: true, need: '', bought: true } : { ok: false, need: 'Buy it in the Pal Store (' + s.price + ' coins)', price: s.price, have: 0, goal: 1 };
    if (!s.unlock) return { ok: true, need: '' };
    if ((state.unlocks || []).indexOf(id) >= 0) return { ok: true, need: requirement(s) };
    var u = s.unlock, have = 0, goal = 1;
    // 1.8.4: from the per-cup records (a cup counts only when it was really won)
    if (u.cup) { have = PP.Arena.won(state, u.cup - 1) ? u.cup : PP.Arena.mainWon(state, u.cup - 1); goal = u.cup; }
    else if (u.champion) { have = PP.Arena.mainWon(state); goal = D.ARENA_MAIN; }
    else if (u.dex) { have = Math.min(counts(state).adults, u.dex); goal = u.dex; }
    else if (u.season) { have = Math.min(PP.Daily ? PP.Daily.seasonDays(state, u.season) : 0, PP.Daily ? PP.Daily.SEASON_DAYS : 3); goal = PP.Daily ? PP.Daily.SEASON_DAYS : 3; }
    else if (u.golden) { have = state.daily && state.daily.golden > 0 ? 1 : 0; goal = 1; }
    return { ok: have >= goal, need: requirement(s), have: have, goal: goal };
  }
  /* Records newly earned specials; returns the shells unlocked just now. */
  function checkUnlocks(state) {
    state.unlocks = state.unlocks || [];
    var fresh = [];
    D.SHELLS.forEach(function (s) {
      if (!s.unlock || state.unlocks.indexOf(s.id) >= 0) return;
      if (shellStatus(state, s.id).ok) { state.unlocks.push(s.id); fresh.push(s); }
    });
    return fresh;
  }

  PP.Collection = { KEYS: KEYS, entries: entries, keyOf: keyOf, get: get, mark: mark, markPet: markPet, markSeen: markSeen, counts: counts, hint: hint,
    syncFromState: syncFromState, shell: shell, shellStatus: shellStatus, checkUnlocks: checkUnlocks, requirement: requirement };
})(typeof window !== 'undefined' ? window : globalThis);
