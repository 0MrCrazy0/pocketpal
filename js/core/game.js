/* PocketPal 2 - game orchestration (pure). The UI only talks to this API.
 * State: up to 4 pals in the Pal Box. Only the ACTIVE pal lives in real time;
 * the others are in stasis (their clocks are frozen) until you switch to them. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA, R = D.RULES;

  function newState(now) {
    now = now || Date.now();
    return {
      schema: 4, createdAt: now, seed: U.hash('world', now, Math.random()) >>> 0,
      slots: [null, null, null, null], boxSize: 4, active: 0,
      album: [], friends: [],
      arena: { rank: 0, attempt: 0, champion: false },
      dex: {}, unlocks: [],
      wallet: { coins: D.ECONOMY.startCoins, day: null, earned: 0, lastDaily: null, streak: 0, mistakesAt: null }, inv: {},
      settings: { sound: true, test: false, speed: 1, alerts: false, notify: false, shell: 'pink', guideSeen: false, clock: PP.Time.defaultClock() },
      timeOffset: 0, lastSeenAt: now
    };
  }
  function now(state, realNow) { return (realNow || Date.now()) + (state.timeOffset || 0); }
  function active(state) { return state.slots[state.active] || null; }
  function freeSlot(state) {
    for (var i = 0; i < state.slots.length; i++) if (!state.slots[i]) return i;
    return -1;
  }

  /* ---------------------------------------------------------------- album */
  function albumUpsert(state, p) {
    if (!p || p.stage === 'egg') return;
    var e = null;
    for (var i = 0; i < state.album.length; i++) if (state.album[i].id === p.id) e = state.album[i];
    if (!e) { e = { id: p.id }; state.album.push(e); if (state.album.length > 200) state.album.shift(); }
    e.name = p.name; e.species = p.species; e.sex = p.sex; e.gen = p.gen || 1;
    e.stage = p.stage; e.form = p.form; e.level = p.level || 0; e.wins = p.wins || 0;
    e.parents = (p.parents || []).map(function (q) {
      return q ? { id: q.id, name: q.name, species: q.species, form: q.form, sex: q.sex, gen: q.gen,
        parents: (q.parents || []).map(function (g) { return g ? { id: g.id, name: g.name, species: g.species, form: g.form, sex: g.sex, gen: g.gen } : null; }) } : null;
    });
    e.fate = p.fate || e.fate || null; e.hatchedAt = p.hatchedAt || e.hatchedAt || null;
    e.days = PP.Pet.ageDays(p);
    e.snap = U.deepCopy(p);
  }
  function albumFind(state, id) {
    for (var i = 0; i < state.album.length; i++) if (state.album[i].id === id) return state.album[i];
    return null;
  }
  /* Ancestors of a pal (for the family tree), up to 3 generations. */
  function familyTree(state, p) {
    function node(ref, depth) {
      if (!ref) return null;
      var a = albumFind(state, ref.id) || {};
      var parents = (ref.parents && ref.parents.length ? ref.parents : a.parents) || [];
      return { id: ref.id, name: ref.name || a.name, form: ref.form || a.form, sex: ref.sex || a.sex, species: ref.species || a.species,
        gen: ref.gen || a.gen, parents: depth < 2 ? parents.map(function (q) { return node(q, depth + 1); }) : [] };
    }
    return node(p, 0);
  }

  /* ---------------------------------------------------------------- lifecycle */
  function startEgg(state, species, realNow, opts) {
    var i = freeSlot(state);
    if (i < 0) return { ok: false, msg: 'Pal Box is full (' + state.slots.length + '). Release a pal or buy a slot in the Pal Store.' };
    var egg = PP.Pet.createEgg(Object.assign({ species: species, now: now(state, realNow), seed: U.hash(state.seed, 'egg', state.album.length, realNow, Math.random()) }, opts || {}));
    state.slots[i] = egg;
    var a = active(state);
    if (!a || a.fate) state.active = i;
    return { ok: true, slot: i, pet: egg };
  }
  function setActive(state, i, realNow) {
    if (i < 0 || i >= state.slots.length || !state.slots[i]) return { ok: false, msg: 'Empty slot' };
    state.active = i;
    state.slots[i].lastTickAt = now(state, realNow); // it was in stasis: no catch-up for frozen time
    return { ok: true, msg: state.slots[i].name + ' is out!' };
  }
  function release(state, i) {
    var p = state.slots[i];
    if (!p) return { ok: false, msg: 'Empty slot' };
    if (!p.fate) p.fate = p.stage === 'egg' ? 'gone' : 'released';
    albumUpsert(state, p);
    state.slots[i] = null;
    if (state.active === i) {
      var j = state.slots.findIndex(function (s) { return s && !s.fate; });
      state.active = j >= 0 ? j : 0;
    }
    return { ok: true, msg: 'Goodbye, ' + p.name + '!' };
  }

  function reviveCost(p) {
    if (!p) return 0;
    return 50 + ((p.gen || 1) * 15) + ((p.level || 1) * 2);
  }
  function lostPals(state) {
    var list = [], seen = {};
    (state.slots || []).forEach(function (p, i) {
      if (p && p.fate && p.fate !== 'released') {
        seen[p.id] = true;
        list.push({ kind: 'slot', slot: i, pet: p, name: p.name, cost: reviveCost(p) });
      }
    });
    (state.album || []).forEach(function (e) {
      if (e && e.fate && e.snap && !seen[e.id] && e.snap.stage !== 'egg') {
        list.push({ kind: 'album', albumId: e.id, pet: e.snap, name: e.name, cost: reviveCost(e.snap) });
      }
    });
    return list;
  }
  function revive(state, opts) {
    opts = opts || {};
    var p = null, slot = -1;
    if (opts.slot != null) {
      p = state.slots[opts.slot];
      slot = opts.slot;
    } else if (opts.albumId) {
      var e = albumFind(state, opts.albumId);
      if (!e || !e.snap) return { ok: false, msg: 'No body left to restore' };
      p = U.deepCopy(e.snap);
      slot = freeSlot(state);
      if (slot < 0) return { ok: false, msg: 'Pal Box is full - free a slot first' };
    }
    if (!p || !p.fate) return { ok: false, msg: 'That pal is still with you' };
    if (p.stage === 'egg') return { ok: false, msg: 'Eggs cannot be revived' };
    var cost = opts.free ? 0 : reviveCost(p);
    if (!opts.free) {
      if (PP.Shop.coins(state) < cost) return { ok: false, msg: 'Need ' + cost + ' coins to revive' };
      PP.Shop.add(state, -cost);
    }
    p.fate = null; p.fateCause = null;
    p.sick = false; p.asleep = false; p.fake = null;
    p.health = Math.max(50, p.health || 50);
    p.hunger = Math.max(2, Math.min(4, p.hunger || 2));
    p.happy = Math.max(2, Math.min(4, p.happy || 2));
    p.energy = Math.max(50, p.energy || 50);
    p.lastTickAt = now(state, opts.now);
    state.slots[slot] = p;
    if (!state.slots[state.active] || state.slots[state.active].fate) state.active = slot;
    albumUpsert(state, p);
    return { ok: true, msg: p.name + ' is back!' + (cost ? ' (-' + cost + 'c)' : ''), slot: slot, pet: p, cost: cost };
  }

  /* Advance the active pal. opts.offline -> mercy rules (used on app start / return). */
  function update(state, realNow, opts) {
    var p = active(state);
    if (!p || p.fate) return [];
    var ev = PP.Care.tick(p, now(state, realNow), opts);
    var grew = false;
    ev.forEach(function (e) {
      if (e.t === 'hatch' || e.t === 'evolve') { albumUpsert(state, p); if (PP.Collection.markPet(state, p, now(state, realNow))) grew = true; }
      if (e.t === 'died' || e.t === 'ranaway') albumUpsert(state, p);
    });
    if (grew) unlockEvents(state, ev);
    if (p.stage !== 'egg') {
      var d = PP.Shop.claimDaily(state, now(state, realNow));
      if (d) ev.push({ t: 'daily', coins: d.coins, care: d.care, streak: d.streak });
    }
    return ev;
  }
  /* New shell colours earned -> 'unlock' events for the UI. */
  function unlockEvents(state, ev) {
    PP.Collection.checkUnlocks(state).forEach(function (s) { ev.push({ t: 'unlock', shell: s.id, name: s.name }); });
    return ev;
  }

  /* ---------------------------------------------------------------- care actions */
  function act(state, action) {
    var p = active(state);
    var map = { meal: PP.Care.feedMeal, snack: PP.Care.feedSnack, clean: PP.Care.clean, medicine: PP.Care.medicine,
      lights: PP.Care.toggleLights, scold: PP.Care.scold, praise: PP.Care.praise };
    if (!map[action]) return { ok: false, msg: 'Unknown action' };
    return map[action](p);
  }
  function exercise(state, kind, success) {
    var r = PP.Care.exercise(active(state), kind, success);
    if (r.ok) {
      r.coins = PP.Shop.earn(state, success ? D.ECONOMY.trainWin : D.ECONOMY.trainLoss, now(state));
      if (r.coins) r.msg += ' +' + r.coins + 'c';
    }
    return r;
  }

  /* ---------------------------------------------------------------- battles */
  function canBattle(p) {
    if (!p || p.fate) return 'No pal';
    if (p.stage !== 'adult') return 'Only adults can battle';
    if (p.asleep) return 'Zzz... asleep';
    if (p.sick) return 'Too sick to battle';
    if (p.energy < R.costs.battle) return 'Too tired (needs ' + R.costs.battle + ' energy)';
    return null;
  }
  function startBattle(state, oppCard, meta, seed) {
    var p = active(state);
    var why = canBattle(p);
    if (why) return { ok: false, msg: why };
    p.energy -= R.costs.battle;
    var B = PP.Battle.create(p, oppCard, seed >>> 0 || U.hash(state.seed, p.clock, oppCard.id), { b: { noCondition: true } });
    B.meta = meta || {};
    B.opp = oppCard;
    return { ok: true, battle: B };
  }
  function startArena(state, rank, seed) {
    if (rank > state.arena.rank) return { ok: false, msg: 'Win the previous cup first' };
    var opp = PP.Arena.opponent(rank, state.arena.attempt, state.seed);
    return startBattle(state, opp, { kind: 'arena', rank: rank }, seed);
  }
  function startFriend(state, card, seed) {
    var err = PP.Cards.validateCard(card);
    if (err) return { ok: false, msg: err };
    return startBattle(state, card, { kind: 'friend' }, seed);
  }
  function finishBattle(state, B) {
    var p = active(state);
    if (!p || !B || !B.over) return null;
    var won = B.winner === 0, oppLv = B.f[1].level, out = { won: won, xp: 0, levels: 0, injured: false, unlocked: null, coins: 0 };
    var cleared = false, champ = false;
    p.weight = Math.max(Math.ceil(PP.Care.baseWeight(p) * 0.5), p.weight - 1);
    if (won) {
      p.wins++; out.xp = D.LEVEL.winXp(p.level, oppLv);
      p.happy = Math.min(4, p.happy + 1);
      if (B.meta.kind === 'arena') {
        state.arena.attempt++;
        if (B.meta.rank === state.arena.rank) {
          if (state.arena.rank < D.ARENA.length - 1) { state.arena.rank++; out.unlocked = D.ARENA[state.arena.rank].name; cleared = true; }
          else if (!state.arena.champion) { state.arena.champion = true; out.unlocked = 'ARENA CHAMPION'; cleared = true; champ = true; }
        }
      }
    } else {
      p.losses++; out.xp = D.LEVEL.lossXp(p.level, oppLv);
      p.happy = Math.max(0, p.happy - 1);
      if (B.meta.kind === 'arena') state.arena.attempt++;
      if (U.roll(p.seed, p.clock, 'injury', p.losses) < 0.2) { p.sick = true; p.sickDoses = 0; out.injured = true; }
    }
    out.levels = PP.Stats.addXp(p, out.xp);
    var bc = PP.Shop.battleCoins(won, oppLv, B.meta, cleared, champ);
    out.coins = PP.Shop.earn(state, bc.capped, now(state)) + PP.Shop.earn(state, bc.bonus, now(state), false);
    out.capped = bc.capped > 0 && out.coins < bc.capped + bc.bonus;
    albumUpsert(state, p);
    PP.Collection.markSeen(state, B.opp, now(state));
    out.shells = PP.Collection.checkUnlocks(state).map(function (s) { return s.name; });
    return out;
  }

  /* ---------------------------------------------------------------- friends & breeding */
  function addFriend(state, code) {
    var r = PP.Cards.decode(code);
    if (!r.ok) return { ok: false, msg: r.error };
    var mine = state.slots.some(function (s) { return s && s.id === r.card.id; });
    if (mine) return { ok: false, msg: "That's your own pal's code" };
    state.friends = state.friends.filter(function (f) { return f.id !== r.card.id; });
    state.friends.unshift(r.card);
    PP.Collection.markSeen(state, r.card, now(state));
    state.friends = state.friends.slice(0, 12);
    return { ok: true, msg: 'Added ' + r.card.name + ' (' + D.NAMES[r.card.species][r.card.form] + ' Lv' + r.card.level + ')', card: r.card };
  }
  function breedWith(state, partner, realNow) {
    var p = active(state);
    var i = freeSlot(state);
    if (i < 0) return { ok: false, msg: 'Pal Box is full - release a pal to make room for the egg' };
    var r = PP.Breeding.breed(p, partner, U.hash(state.seed, p.id, partner.id, p.clock), now(state, realNow));
    if (!r.ok) return r;
    state.slots[i] = r.egg;
    return { ok: true, msg: r.msg + ' - it is in slot ' + (i + 1), slot: i, egg: r.egg };
  }
  function mates(state) {
    var p = active(state);
    if (!p) return [];
    var list = [];
    state.slots.forEach(function (s, i) { if (s && s !== p) list.push({ kind: 'slot', slot: i, pal: s, check: PP.Breeding.canBreed(p, s) }); });
    state.friends.forEach(function (c, i) { list.push({ kind: 'friend', idx: i, pal: c, check: PP.Breeding.canBreed(p, c) }); });
    return list;
  }

  /* ---------------------------------------------------------------- test mode helpers */
  var Test = {
    skip: function (state, minutes, realNow) {
      state.timeOffset += minutes * U.MIN;
      return update(state, realNow, { offline: false });
    },
    stage: function (state, stage, form) {
      var p = active(state); if (!p) return [];
      PP.Evolution.forceStage(p, stage, form); albumUpsert(state, p);
      var ev = [];
      if (PP.Collection.markPet(state, p, now(state))) unlockEvents(state, ev);
      return ev;
    },
    xp: function (state, n) { var p = active(state); return p ? PP.Stats.addXp(p, n) : 0; },
    sp: function (state, n) { var p = active(state); if (p && p.stage === 'adult') p.sp += n; },
    fill: function (state) { var p = active(state); if (!p) return; p.hunger = 4; p.happy = 4; p.energy = 100; p.health = 100; p.poop = 0; p.sick = false; p.fake = null; p.need = {}; },
    mate: function (state, realNow) {
      var p = active(state);
      if (!p || p.stage !== 'adult') return { ok: false, msg: 'Active pal must be an adult' };
      var r = startEgg(state, p.species, realNow, { sex: p.sex === 'M' ? 'F' : 'M' });
      if (!r.ok) return r;
      PP.Evolution.forceStage(r.pet, 'adult', 'good');
      r.pet.lastBredClock = -1e9; albumUpsert(state, r.pet);
      return { ok: true, msg: 'Mate ' + r.pet.name + ' added to slot ' + (r.slot + 1) };
    },
    unlockArena: function (state) { state.arena.rank = D.ARENA.length - 1; },
    coins: function (state, n) { return PP.Shop.add(state, n); },
    champion: function (state) { state.arena.rank = D.ARENA.length - 1; state.arena.champion = true; return PP.Collection.checkUnlocks(state); },
    fillDex: function (state) { PP.Collection.entries().forEach(function (e) { PP.Collection.mark(state, e.species, e.key, 'raised', now(state)); }); return PP.Collection.checkUnlocks(state); },
    sick: function (state) { var p = active(state); if (p) { p.sick = true; p.sickDoses = 0; } },
    poop: function (state) { var p = active(state); if (p) p.poop = Math.min(4, p.poop + 1); },
    fake: function (state) { var p = active(state); if (p && p.stage !== 'baby' && p.stage !== 'egg') p.fake = { until: p.clock + R.fakeCallMin }; },
    revive: function (state) { return revive(state, { slot: state.active, free: true, now: Date.now() }); }
  };

  PP.Game = { newState: newState, now: now, active: active, freeSlot: freeSlot, startEgg: startEgg, setActive: setActive, release: release, revive: revive, reviveCost: reviveCost, lostPals: lostPals,
    update: update, act: act, exercise: exercise, canBattle: canBattle, startArena: startArena, startFriend: startFriend, finishBattle: finishBattle,
    addFriend: addFriend, breedWith: breedWith, mates: mates, albumUpsert: albumUpsert, albumFind: albumFind, familyTree: familyTree, Test: Test };
})(typeof window !== 'undefined' ? window : globalThis);
