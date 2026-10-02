/* PocketPal - game orchestration (pure). The UI only talks to this API.
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
      arena: { rank: 0, attempt: 0, champion: false, cups: [], run: null, note: null },
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
    // a full copy is only needed to revive a pal that died or ran away (keeps the save small)
    if (e.fate === 'dead' || e.fate === 'gone') e.snap = U.deepCopy(p); else delete e.snap;
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
  function inSlots(state, id) { return (state.slots || []).some(function (s) { return s && s.id === id; }); }
  function lostPals(state) {
    var list = [], seen = {};
    (state.slots || []).forEach(function (p, i) {
      if (p && p.fate && p.fate !== 'released') {
        seen[p.id] = true;
        list.push({ kind: 'slot', slot: i, pet: p, name: p.name, cost: reviveCost(p) });
      }
    });
    (state.album || []).forEach(function (e) {
      if (e && (e.fate === 'dead' || e.fate === 'gone') && e.snap && !seen[e.id] && e.snap.stage !== 'egg' && !inSlots(state, e.id)) {
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
      if (e.fate !== 'dead' && e.fate !== 'gone') return { ok: false, msg: 'Released pals cannot be revived' };
      if (inSlots(state, e.id)) return { ok: false, msg: 'That pal is already in your Pal Box' };
      p = PP.Save && PP.Save.sanitizePet ? PP.Save.sanitizePet(U.deepCopy(e.snap)) : U.deepCopy(e.snap);
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
    p.sick = false; p.sickDoses = 0; p.asleep = false; p.sleepKind = null; p.fake = null;
    p.unhappyMin = 0; p.need = {}; p.poop = Math.min(p.poop || 0, 1);   // a fresh start: no stale neglect timers
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
    if (p.energy < R.costs.battle) return 'Too tired... (needs ' + R.costs.battle + ' energy)';
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
  /* Arena (1.8.4): a cup is a run of foes beaten in a row. Starting a cup continues its run
   * (or starts one at foe 1); starting a different cup drops the other run. */
  function startArena(state, rank, seed) {
    rank = rank | 0;
    if (rank < 0 || rank >= D.ARENA.length) return { ok: false, msg: 'No such cup' };
    if (PP.Arena.status(state, rank) === 'locked') return { ok: false, msg: D.ARENA[rank].post ? 'Become Arena Champion first' : 'Win the previous cup first' };
    var idx = PP.Arena.nextFoe(state, rank);
    var r = startBattle(state, PP.Arena.foe(rank, idx), { kind: 'arena', rank: rank, foe: idx }, seed);
    if (r.ok) state.arena.run = { cup: rank, foe: idx, pal: active(state).id };
    return r;
  }
  /* Quick (wild) battle - no arena or friend record; the only kind you can simply run from. */
  function startQuick(state, card, seed) {
    var err = PP.Cards.validateCard(card);
    if (err) return { ok: false, msg: err };
    return startBattle(state, card, { kind: 'quick' }, seed);
  }
  function startFriend(state, card, seed) {
    var err = PP.Cards.validateCard(card);
    if (err) return { ok: false, msg: err };
    return startBattle(state, card, { kind: 'friend' }, seed);
  }
  function finishBattle(state, B) {
    var p = active(state);
    if (!p || !B || !B.over) return null;
    var won = B.winner === 0, oppLv = B.f[1].level, out = { won: won, xp: 0, levels: 0, injured: false, unlocked: null, coins: 0, kind: B.meta.kind };
    var cleared = false, champ = false, arena = B.meta.kind === 'arena', rank = B.meta.rank | 0, rec = arena ? PP.Arena.record(state, rank) : null;
    if (arena) {
      state.arena.attempt++;
      out.cup = D.ARENA[rank].name; out.foe = (B.meta.foe | 0) + 1; out.foes = PP.Arena.foeCount(rank);
    }
    /* 1.8.4: running away - no XP, no coins, no injury; half the battle energy comes back.
     * Arena: the run is over and counts as a loss; friend battles: a forfeit (a loss). */
    if (B.fled) {
      out.fled = B.fled; out.won = false;
      p.energy = Math.min(100, p.energy + Math.floor(R.costs.battle / 2));
      if (B.fled === 'forfeit') p.losses++;
      if (arena) { rec.losses++; state.arena.run = null; }
      PP.Collection.markSeen(state, B.opp, now(state));
      return out;
    }
    p.weight = Math.max(Math.ceil(PP.Care.baseWeight(p) * 0.5), p.weight - 1);
    if (won) {
      p.wins++; out.xp = D.LEVEL.winXp(p.level, oppLv);
      p.happy = Math.min(4, p.happy + 1);
      if (arena) {
        var fi = B.meta.foe | 0, n = PP.Arena.foeCount(rank);
        rec.wins++; rec.beat[fi] = true; rec.best = Math.max(rec.best, fi + 1);
        if (fi + 1 >= n) {                                    // the boss is down: cup cleared
          state.arena.run = null; out.cleared = true;
          if (!rec.won) {
            rec.won = true; cleared = true; out.firstClear = true;
            if (!D.ARENA[rank].post && rank + 1 < D.ARENA_MAIN && state.arena.rank < rank + 1) { state.arena.rank = rank + 1; out.unlocked = D.ARENA[rank + 1].name; }
            if (!D.ARENA[rank].post && !state.arena.champion && PP.Arena.mainWon(state) === D.ARENA_MAIN) { state.arena.champion = true; champ = true; out.unlocked = 'ARENA CHAMPION + ' + D.ARENA[D.ARENA_MAIN].name; }
            if (D.ARENA[rank].post) out.myth = true;
          }
        } else { state.arena.run = { cup: rank, foe: fi + 1, pal: p.id }; out.next = fi + 2; }
      }
    } else {
      p.losses++; out.xp = D.LEVEL.lossXp(p.level, oppLv);
      p.happy = Math.max(0, p.happy - 1);
      if (arena) { rec.losses++; state.arena.run = null; }
      if (U.roll(p.seed, p.clock, 'injury', p.losses) < 0.2) { p.sick = true; p.sickDoses = 0; out.injured = true; }
    }
    out.levels = PP.Stats.addXp(p, out.xp);
    var bc = PP.Shop.battleCoins(won, oppLv, B.meta, cleared, champ, out.myth);
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
    var existed = state.friends.some(function (f) { return f.id === r.card.id; });
    state.friends = state.friends.filter(function (f) { return f.id !== r.card.id; });
    state.friends.unshift(r.card);
    PP.Collection.markSeen(state, r.card, now(state));
    state.friends = state.friends.slice(0, 12);
    return { ok: true, msg: (existed ? 'Updated ' : 'Added ') + r.card.name + ' (' + D.NAMES[r.card.species][r.card.form] + ' Lv' + r.card.level + ')', card: r.card, updated: existed };
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
    unlockArena: function (state) { state.arena.rank = D.ARENA_MAIN - 1; },   // opens every main cup - no stars (1.8.4)
    coins: function (state, n) { return PP.Shop.add(state, n); },
    champion: function (state) {   // test cheat: mark the 12 main cups won
      state.arena.rank = D.ARENA_MAIN - 1; state.arena.champion = true;
      for (var i = 0; i < D.ARENA_MAIN; i++) { var r = PP.Arena.record(state, i); r.won = true; r.best = r.beat.length; r.beat = r.beat.map(function () { return true; }); }
      return PP.Collection.checkUnlocks(state);
    },
    fillDex: function (state) { PP.Collection.entries().forEach(function (e) { PP.Collection.mark(state, e.species, e.key, 'raised', now(state)); }); return PP.Collection.checkUnlocks(state); },
    sick: function (state) { var p = active(state); if (p) { p.sick = true; p.sickDoses = 0; } },
    poop: function (state) { var p = active(state); if (p) p.poop = Math.min(4, p.poop + 1); },
    fake: function (state) { var p = active(state); if (p && p.stage !== 'baby' && p.stage !== 'egg') p.fake = { until: p.clock + R.fakeCallMin }; },
    revive: function (state) { return revive(state, { slot: state.active, free: true, now: Date.now() }); }
  };

  PP.Game = { newState: newState, now: now, active: active, freeSlot: freeSlot, startEgg: startEgg, setActive: setActive, release: release, revive: revive, reviveCost: reviveCost, lostPals: lostPals,
    update: update, act: act, exercise: exercise, canBattle: canBattle, startArena: startArena, startFriend: startFriend, startQuick: startQuick, finishBattle: finishBattle,
    addFriend: addFriend, breedWith: breedWith, mates: mates, albumUpsert: albumUpsert, albumFind: albumFind, familyTree: familyTree, Test: Test };
})(typeof window !== 'undefined' ? window : globalThis);
