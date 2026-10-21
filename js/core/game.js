/* PocketPal - game orchestration (pure). The UI only talks to this API.
 * State: up to 4 pals in the Pal Box. Only the ACTIVE pal lives in real time;
 * the others are in stasis (their clocks are frozen) until you switch to them. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA, R = D.RULES;

  function newState(now) {
    now = now || Date.now();
    var st0 = {
      schema: 11 /* = PP.Save.SCHEMA */, createdAt: now, seed: U.hash('world', now, Math.random()) >>> 0,
      slots: [null, null, null, null], boxSize: 4, active: 0,
      album: [], friends: [],
      arena: { rank: 0, attempt: 0, champion: false, cups: [], run: null, note: null },
      dex: {}, unlocks: [],
      wallet: { coins: D.ECONOMY.startCoins, day: null, earned: 0, lastDaily: null, streak: 0, mistakesAt: null }, inv: {},
      settings: { sound: true, test: false, speed: 1, alerts: false, notify: false, shell: 'black', guideSeen: false, alertsAsked: false, clock: PP.Time.defaultClock(),
        hints: true, music: true, hardNext: false, cloud: false, reportCard: true, alertTypes: PP.Reminders.defaults() },
      daily: null, hints: { done: {} }, backup: { lastExport: null, snoozeUntil: null },
      timeOffset: 0, lastSeenAt: now
    };
    return Object.assign(st0, PP.World.defaults());   // 2.4.0: things, trips, mail, visits, events, family line
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
    e.fate = p.fate == null ? null : p.fate; e.hatchedAt = p.hatchedAt || e.hatchedAt || null;
    e.days = PP.Pet.ageDays(p);
    if (p.hard) e.hard = true; else delete e.hard;          // 1.9.0: hard-mode memorial
    if (p.golden) e.golden = true; else delete e.golden;
    if (p.fateCause) e.cause = String(p.fateCause).slice(0, 30); else if (!p.fate) delete e.cause;
    e.mem = (p.mem || []).slice(-30);                       // 2.4.0: the memory book stays with the album entry
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
      return { id: ref.id, name: ref.name || a.name, form: ref.form || a.form, stage: ref.stage || a.stage, sex: ref.sex || a.sex, species: ref.species || a.species,
        gen: ref.gen || a.gen, parents: depth < 2 ? parents.map(function (q) { return node(q, depth + 1); }) : [] };
    }
    return node(p, 0);
  }

  /* 1.9.7: has this player won the post-game Myth Cup? */
  function mythWon(state) {
    for (var r = 0; r < D.ARENA.length; r++) if (D.ARENA[r].post && PP.Arena.won(state, r)) return true;
    return false;
  }
  /* ---------------------------------------------------------------- lifecycle */
  function startEgg(state, species, realNow, opts) {
    var i = freeSlot(state);
    if (i < 0) return { ok: false, msg: 'Pal Box is full (' + state.slots.length + '). Release a pal or buy a slot in the Pal Store.' };
    opts = Object.assign({ hard: !!(state.settings && state.settings.hardNext) }, opts || {});
    if (opts.golden) opts.hard = false;                     // a golden egg is a gift: always a normal-mode pal
    var egg = PP.Pet.createEgg(Object.assign({ species: species, now: now(state, realNow), seed: U.hash(state.seed, 'egg', state.album.length, realNow, Math.random()) }, opts));
    if (mythWon(state)) egg.myth = true;                   // 1.9.7: laid after the Myth Cup -> Eclipsar can appear
    state.slots[i] = egg;
    var a = active(state);
    if (!a || a.fate) state.active = i;
    return { ok: true, slot: i, pet: egg };
  }
  function setActive(state, i, realNow) {
    if (i < 0 || i >= state.slots.length || !state.slots[i]) return { ok: false, msg: 'Empty slot' };
    state.active = i;
    PP.Care.outOfBox(state.slots[i], now(state, realNow)); // it was in stasis: no catch-up for frozen time (1.9.1: and awake if its night is over)
    return { ok: true, msg: state.slots[i].name + ' is out!' };
  }
  function release(state, i, realNow) {
    var p = state.slots[i];
    if (!p) return { ok: false, msg: 'Empty slot' };
    if (!p.fate) p.fate = p.stage === 'egg' ? 'gone' : 'released';
    albumUpsert(state, p);
    state.slots[i] = null;
    if (state.active === i) {
      var j = state.slots.findIndex(function (s) { return s && !s.fate; });
      state.active = j >= 0 ? j : 0;
      // 1.9.1: the pal that comes out was in stasis - no catch-up for the time it spent in the box
      // (it used to be simulated for all of it, up to 14 days, and could even die)
      if (j >= 0) PP.Care.outOfBox(state.slots[j], now(state, realNow));
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
      if (p && p.fate && p.fate !== 'released' && p.fate !== 'retired' && !p.hard) {
        seen[p.id] = true;
        list.push({ kind: 'slot', slot: i, pet: p, name: p.name, cost: reviveCost(p) });
      }
    });
    (state.album || []).forEach(function (e) {
      if (e && (e.fate === 'dead' || e.fate === 'gone') && e.snap && !e.hard && !seen[e.id] && e.snap.stage !== 'egg' && !inSlots(state, e.id)) {
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
      if (e.fate !== 'dead' && e.fate !== 'gone') return { ok: false, msg: e.fate === 'retired' ? 'Retired pals are resting - they cannot be revived' : 'Released pals cannot be revived' };
      if (inSlots(state, e.id)) return { ok: false, msg: 'That pal is already in your Pal Box' };
      p = PP.Save && PP.Save.sanitizePet ? PP.Save.sanitizePet(U.deepCopy(e.snap)) : U.deepCopy(e.snap);
      slot = freeSlot(state);
      if (slot < 0) return { ok: false, msg: 'Pal Box is full - free a slot first' };
    }
    if (!p || !p.fate) return { ok: false, msg: 'That pal is still with you' };
    if (p.fate === 'released' || p.fate === 'retired') return { ok: false, msg: 'Only lost pals can be revived' };
    if (p.stage === 'egg') return { ok: false, msg: 'Eggs cannot be revived' };
    if (p.hard) return { ok: false, msg: 'Hard-mode pals cannot be revived. They live on in your Album.' };
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
    // 2.3.21: a fresh start also means the lights on and no night in progress - a pal that died in its sleep with the
    // lights off used to come back in the dark and fall straight into a nap
    p.lights = true; p.wokeAt = null; p.night = null; p.holdTo = null; p.stepAt = null;
    p.lastTickAt = now(state, opts.now);
    state.slots[slot] = p;
    if (!state.slots[state.active] || state.slots[state.active].fate) state.active = slot;
    PP.World.remember(p, 'revive', 'Came back to life!', p.lastTickAt);   // 2.4.0
    albumUpsert(state, p);
    return { ok: true, msg: p.name + ' is back!' + (cost ? ' (-' + cost + 'c)' : ''), slot: slot, pet: p, cost: cost };
  }

  /* Advance the active pal. opts.offline -> mercy rules (used on app start / return). */
  function update(state, realNow, opts) {
    var p = active(state);
    if (!p || p.fate) return [];
    var ev = PP.Care.tick(p, now(state, realNow), opts);
    var grew = false, t = now(state, realNow);
    ev.forEach(function (e) {
      if (e.t === 'hatch' || e.t === 'evolve') { albumUpsert(state, p); if (PP.Collection.markPet(state, p, t)) grew = true; }
      if (e.t === 'hatch') { PP.Hints.learn(state, 'hatch'); if (p.golden) { PP.Daily.ensure(state).golden++; grew = true; } }
      if (e.t === 'died' || e.t === 'ranaway') albumUpsert(state, p);
      memo(p, e, t);                                        // 2.4.0 memory book
    });
    if (!p.fate && !p.elderSeen && PP.World.isElder(p)) {   // 2.4.0: an Elder may retire (never forced)
      p.elderSeen = true; PP.World.remember(p, 'elder', 'Became an Elder (' + PP.World.elderAt(p) + '+ days as an adult) - retiring is optional', t); ev.push({ t: 'elder', name: p.name });
    }
    if (grew) unlockEvents(state, ev);
    if (p.stage !== 'egg') {
      var d = PP.Shop.claimDaily(state, t);
      if (d) ev.push({ t: 'daily', coins: d.coins, care: d.care, streak: d.streak });
    }
    if (!p.fate) {                                          // 1.9.0: daily goals / rare events
      PP.Daily.roll(state, t, p).forEach(function (e) { ev.push(e); });
      PP.Daily.observe(state, t);
    }
    return ev;
  }
  /* 2.4.0: battle milestones -> the memory book (first win, every 25th, every 5th level, cups) - never every battle */
  function memoBattle(p, out, lv0, t) {
    var W = PP.World;
    if (out.won && p.wins === 1) W.remember(p, 'battle', 'Won its first battle!', t);
    else if (out.won && p.wins % 25 === 0) W.remember(p, 'battle', p.wins + ' battle wins!', t);
    for (var L = lv0 + 1; L <= p.level; L++) if (L % 5 === 0 || L === D.LEVEL.ultimateLevel) W.remember(p, 'level', 'Reached Lv' + L, t);
    if (out.firstClear && out.cup) W.remember(p, 'cup', 'Won the ' + out.cup + '!', t);
  }
  /* 2.4.0: life events -> the pal's memory book */
  function memo(p, e, t) {
    var W = PP.World, N = D.NAMES[p.species] || {};
    if (e.t === 'hatch') W.remember(p, 'hatch', 'Hatched into a ' + N.baby + (p.gen > 1 ? ' (generation ' + p.gen + ')' : ''), t);
    else if (e.t === 'evolve' && p.stage === 'adult') W.remember(p, 'adult', 'Grew up into ' + N[p.form || 'good'], t);
    else if (e.t === 'evolve') W.remember(p, 'grow', 'Grew into a ' + N[p.stage] + ' (' + p.stage + ')', t);
    else if (e.t === 'died') W.remember(p, 'note', 'Passed away' + (e.cause ? ' (' + e.cause + ')' : ''), t);
    else if (e.t === 'ranaway') W.remember(p, 'note', 'Ran away', t);
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
    var t = now(state), r = action === 'lights' ? PP.Care.toggleLights(p, t) : map[action](p);
    if (r && r.ok) {
      PP.Hints.learn(state, action);
      if (action === 'meal') PP.Daily.record(state, 'meal', t);
      if (action === 'clean') PP.Daily.record(state, 'clean', t);
      if (action === 'praise') PP.Daily.record(state, 'praise', t);
      if (action === 'snack') PP.Daily.record(state, 'snack', t);   // 2.4.99: the 'Give a snack' goal was never counted
      if (action === 'lights' && !p.lights && p.asleep && p.sleepKind === 'night') PP.Daily.record(state, 'lights', t);
      PP.Daily.observe(state, t);
    }
    return r;
  }
  function exercise(state, kind, success, mini) {
    var r = PP.Care.exercise(active(state), kind, success, mini);
    if (r.ok) {
      r.coins = PP.Shop.earn(state, success ? D.ECONOMY.trainWin : D.ECONOMY.trainLoss, now(state));
      if (r.coins) r.msg += ' +' + r.coins + 'c';
      PP.Hints.learn(state, kind);
      if (kind === 'train') PP.Daily.record(state, 'train', now(state));
      if (kind === 'game' && success) PP.Daily.record(state, 'game', now(state));
      PP.Daily.observe(state, now(state));
    }
    return r;
  }

  /* ---------------------------------------------------------------- battles */
  function canBattle(p) {
    if (!p || p.fate) return 'No pal';
    if (p.stage === 'egg' || p.stage === 'baby') return 'Eggs and babies can\u2019t battle yet';   // 2.4.92: child / teen can (junior battles)
    if (p.asleep) return PP.Care.SLEEP_MSG;
    if (p.sick) return 'Too sick to battle';
    if (p.energy < R.costs.battle) return 'Too tired... (needs ' + R.costs.battle + ' energy)';
    return null;
  }
  var JUNIOR = D.JUNIOR;
  var JUNIOR_KINDS = ['quick', 'junior'];
  /* 2.4.92: a stage-matched CPU foe for a child / teen (never an adult) */
  function juniorFoe(state, p, key, idx) {
    var h = U.hash(state.seed, p.id, 'jr', p.stage, key, idx | 0), sp = D.SPECIES[h % D.SPECIES.length], lean = (idx | 0) - 1;
    var gene = function (k) { return U.clamp(((U.hash(h, k) % 3) - 1) + (lean > 0 ? 1 : 0), -3, 3); };
    return { id: ('jr' + (h % 1e8).toString(36)).slice(0, 12), name: idx != null ? ['Scout', 'Rival', 'Cup boss'][idx | 0] : 'Wild pal', species: sp, sex: h % 2 ? 'M' : 'F',
      form: 'good', level: 1, genes: { hp: gene('hp'), atk: gene('atk'), def: gene('def'), spd: gene('spd') }, skills: [], innate: [], gen: 1, stage: p.stage };
  }
  function startJuniorQuick(state, seed) {
    var p = active(state);
    if (!PP.Stats.isJunior(p)) return { ok: false, msg: 'Quick battles here are for child and teen pals' };
    return startBattle(state, juniorFoe(state, p, 'quick:' + quickPin(p, 'junior')), { kind: 'quick', junior: true }, seed);
  }
  /* 2.4.94 Junior Cup = a ladder per stage (DATA.JUNIOR.ladders), built like an arena cup: fixed foes of rising strength,
   * the same for everyone, so the menu can list them and tick off the ones beaten in this run. */
  function ladderOf(stage) { return JUNIOR.ladders[stage] || null; }
  function ladderFoe(stage, idx) {
    var L = ladderOf(stage); if (!L) return null;
    idx = U.clamp(idx | 0, 0, L.foes.length - 1);
    var f = L.foes[idx], rng = U.makeRng(U.hash('jr-ladder', stage, idx)), genes = { hp: f[2][0], atk: f[2][1], def: f[2][2], spd: f[2][3] };   // fixed species + genes: each rung only ever gets stronger
    var sp = f[1];
    return { id: 'jl' + stage.charAt(0) + idx, name: f[0], species: sp, sex: rng.chance(0.5) ? 'M' : 'F', form: 'good', level: 1, genes: genes,
      skills: [], innate: [], gen: 1, stage: stage, cpu: true, jpow: f[3], rung: idx, ladder: L.name };
  }
  /* the saved run of the pal that is out: { stage, foe } (foe = index of the next rung) */
  function ladderRun(p) { return p && p.jcup && p.jcup.stage === p.stage ? p.jcup : null; }
  /* save-wide trophies and the daily junior coin cap */
  function juniorState(state) {
    var j = state.junior;
    if (!j || typeof j !== 'object') j = state.junior = {};
    if (!j.trophies || typeof j.trophies !== 'object') j.trophies = {};
    if (!j.paid || typeof j.paid !== 'object') j.paid = {};
    JUNIOR.stages.forEach(function (st) { j.trophies[st] = j.trophies[st] | 0; if (j.paid[st] == null) j.paid[st] = -1; });
    if (j.day == null) j.day = -1;
    j.coins = j.coins | 0;
    return j;
  }
  function startJuniorCup(state, seed) {
    var p = active(state);
    if (!PP.Stats.isJunior(p)) return { ok: false, msg: 'The Junior Cup is for child and teen pals' };
    var L = ladderOf(p.stage), c = ladderRun(p), run = c ? U.clamp(c.foe | 0, 0, L.foes.length - 1) : 0;
    var r = startBattle(state, ladderFoe(p.stage, run), { kind: 'junior', foe: run, foes: L.foes.length, ladder: p.stage }, seed);
    if (r.ok) p.jcup = { stage: p.stage, foe: run, live: 1 };   // 2.4.96: live = a fight is on (see Save)
    return r;
  }
  function startBattle(state, oppCard, meta, seed) {
    var p = active(state);
    var why = canBattle(p);
    if (why) return { ok: false, msg: why };
    var jr = PP.Stats.isJunior(p), kind = (meta && meta.kind) || 'quick';
    if (jr && JUNIOR_KINDS.indexOf(kind) < 0) return { ok: false, msg: 'Adults only - young pals can try a Quick battle or the Junior Cup' };
    if ((oppCard.stage || 'adult') !== p.stage) return { ok: false, msg: jr ? 'Young pals only battle pals of the same stage' : 'Adults only battle adults' };
    p.energy -= R.costs.battle;
    var B = PP.Battle.create(p, oppCard, seed >>> 0 || U.hash(state.seed, p.clock, oppCard.id), { b: { noCondition: true } });
    B.meta = meta || {};
    B.hats = [PP.World ? PP.World.shown(state, p).hat : null, PP.Cards.cardHat(oppCard.hat)];   // 2.5.0: both hats (cosmetic, never in PP.Battle)
    // Best of 3 (first to 2) on every fight, including live rooms.
    // Live keeps B.turn climbing across rounds so the worker's turn index stays monotonic.
    if (!B.meta.bo3) {
      B.meta.bo3 = { wins: [0, 0], round: 1 };
    }
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
    if (r.ok) state.arena.run = { cup: rank, foe: idx, pal: active(state).id, live: 1 };   // 2.4.96: live = a fight is on (see Arena.clean)
    return r;
  }
  /* Quick (wild) battle - no arena or friend record; the only kind you can simply run from. */
  function startQuick(state, card, seed) {
    var err = PP.Cards.validateCard(card);
    if (err) return { ok: false, msg: err };
    return startBattle(state, card, { kind: 'quick' }, seed);
  }
  /* 2.4.94 adult Quick battle: a fast practice fight against a computer pal of your own level. No stakes: no arena rank or
   * run change, no injury, no happy loss, no coins, no win / loss record or daily goal. The normal battle energy; small
   * XP under the training anti-farm limit (the first trainDayFull quick fights a pet-day, then 1 XP). */
  /* 2.4.96: a quick-battle foe is pinned until that battle is fought to a result (or QUICK_PIN_MIN passes), so backing
   * out / running away and starting again no longer rerolls an easier foe. k = 'adult' | 'junior'. */
  var QUICK_PIN_MIN = 60;
  function quickPin(p, k) {
    var q = p.qpin, age = q ? p.clock - q.c : -1;
    if (!q || q.k !== k || q.st !== p.stage || !(age >= 0 && age < QUICK_PIN_MIN)) q = p.qpin = { k: k, c: p.clock, st: p.stage };
    return q.c;
  }
  function quickFoe(state, p) {
    var h = U.hash(state.seed, p.id, 'quick', quickPin(p, 'adult')), rng = U.makeRng(h), lv = U.clamp(p.level | 0, 1, PP.Stats.levelCap('good'));
    var sp = D.SPECIES[h % D.SPECIES.length], names = ['Sparring pal', 'Practice pal', 'Wild pal'];
    var card = { id: ('qk' + (h % 1e8).toString(36)).slice(0, 12), name: names[(h >>> 4) % names.length], species: sp, sex: rng.chance(0.5) ? 'M' : 'F', form: 'good',
      level: lv, genes: { hp: 0, atk: 0, def: 0, spd: 0 }, skills: [], innate: [], gen: 1, stage: 'adult', sp: PP.Stats.totalSpForLevel(lv) };
    PP.Skills.autoLearn(card, rng); delete card.sp;
    return card;
  }
  function startAdultQuick(state, seed) {
    var p = active(state);
    if (!p || p.stage !== 'adult') return { ok: false, msg: 'Quick battle here is for adult pals' };
    return startBattle(state, quickFoe(state, p), { kind: 'quick', practice: true }, seed);
  }
  function finishPractice(state, p, B, won, out) {
    out.practice = true;
    var day = Math.floor(p.clock / 1440);
    if (!p.trainDay || p.trainDay.d !== day) p.trainDay = { d: day, n: 0 };
    p.trainDay.q = (p.trainDay.q || 0) + 1;
    var full = p.trainDay.q <= R.trainDayFull, txp = D.LEVEL.trainXp(p.level);
    out.xp = !full ? 1 : won ? Math.ceil(txp / 2) : 1; out.limit = !full;
    if (won) { p.happy = Math.min(4, p.happy + 1); p.energy = Math.min(100, p.energy + 4); }
    var lv0 = p.level; out.levels = PP.Stats.addXp(p, out.xp);
    memoBattle(p, { won: false }, lv0, now(state));          // level memos only (practice wins are not battle wins)
    albumUpsert(state, p);
    PP.Collection.markSeen(state, B.opp, now(state));
    return out;
  }
  /* 1.9.0 rare event: a visiting wild pal (one try a day, +25 coins for a win). */
  function visitorCard(state, t) {
    var p = active(state), rank = 0;
    if (!p || p.stage !== 'adult') return null;
    D.ARENA.forEach(function (c, i) { if (!c.post && c.lv <= p.level) rank = i; });
    var c = PP.Arena.opponent(rank, U.hash(state.seed, 'visitor', PP.Shop.dayOf(t || now(state))) % 1e6);
    c.name = 'Visitor'; c.id = 'visitor' + PP.Shop.dayOf(t || now(state));
    return c;
  }
  function startWeekly(state, seed) {
    var p = active(state);
    if (!p) return { ok: false, msg: 'No pal' };
    if (p.weekDone != null && !U.newDay(p.weekDone, PP.Daily.weekOf(now(state)), 2)) return { ok: false, msg: 'Already beaten this week' };
    var card = PP.Daily.weeklyFoe(state);
    if (!card) return { ok: false, msg: 'Only adults can battle' };
    return startBattle(state, card, { kind: 'weekly' }, seed);
  }
  function startDaily(state, seed) {
    var p = active(state);
    if (!p) return { ok: false, msg: 'No pal' };
    if (p.arenaDay != null && !U.newDay(p.arenaDay, PP.Shop.dayOf(now(state)))) return { ok: false, msg: 'Already beaten today' };
    var card = PP.Daily.arenaCard(state);
    if (!card) return { ok: false, msg: 'Only adults can battle' };
    return startBattle(state, card, { kind: 'daily' }, seed);
  }
  function startVisitor(state, seed) {
    if (!PP.Daily.visitorReady(state, now(state))) return { ok: false, msg: 'No visitor today' };
    var card = visitorCard(state);
    if (!card) return { ok: false, msg: 'Only adults can battle' };
    var r = startBattle(state, card, { kind: 'visitor' }, seed);
    if (r.ok) PP.Daily.useVisitor(state, now(state));
    return r;
  }
  /* Power Training: a real battle against a soft Training Dummy. Same move menu and
   * attack animations as the arena; the dummy is tuned weak so every skill is easy to land.
   * Costs train energy (not battle) and pays training rewards (Mighty style, discipline, XP). */
  function canTrainDummy(p) {
    if (!p || p.fate) return 'No pal';
    if (p.stage === 'egg') return 'Still an egg';
    if (p.asleep) return PP.Care.SLEEP_MSG;
    if (p.sick) return 'Too sick to train';
    if (p.energy < R.costs.train) return 'Too tired... (needs ' + R.costs.train + ' energy)';
    return null;
  }
  function softDummy(B) {
    var a = B.f[0], d = B.f[1];
    d.name = 'Dummy';
    d.form = 'good';
    // One solid hit ends a round; match is best of 3 (first to 2)
    var mid = 40, i, mv;
    for (i = 0; i < a.moves.length; i++) {
      mv = D.MOVES[a.moves[i]];
      if (mv && mv.power > 0) { mid = mv.power; break; }
    }
    var one = Math.max(10, Math.floor(mid * 0.45 * (a.scale || 1) * a.atk / (a.atk + Math.max(4, a.def * 0.35))));
    d.maxHp = one + 4;
    d.hp = d.maxHp;
    d.atk = 1;                              // almost no damage back - training bag
    d.def = Math.max(1, Math.floor(a.def * 0.35));
    d.spd = 1;
    d.bp = PP.Stats.bp({ hp: d.maxHp, atk: d.atk, def: d.def, spd: d.spd });
    d.moves = ['chomp'];                    // one weak poke only
    d.cds = {}; d.used = {}; d.passives = {};
  }
  function startDummy(state, seed) {
    var p = active(state);
    var why = canTrainDummy(p);
    if (why) return { ok: false, msg: why };
    p.energy -= R.costs.train;
    var card = {
      id: 'train-dummy', name: 'Dummy', species: p.species, form: 'bad', level: 1,
      genes: { hp: 0, atk: 0, def: 0, spd: 0 }, skills: [], sex: 'M'
    };
    var B = PP.Battle.create(p, card, seed >>> 0 || U.hash(state.seed, p.clock, 'dummy'), {
      a: { noCondition: true }, b: { noCondition: true }
    });
    softDummy(B);
    B.meta = { kind: 'dummy', bo3: { wins: [0, 0], round: 1 } };
    B.opp = card;
    return { ok: true, battle: B };
  }
  function startFriend(state, card, seed) {

    var err = PP.Cards.validateCard(card);
    if (err) return { ok: false, msg: err };
    return startBattle(state, card, { kind: 'friend' }, seed);
  }
  /* 1.9.7 live friend battle: the canonical battle (host = fighter 0) plus this player's view.
   * Costs battle energy like any battle; pays like a friend battle (finishBattle with the view). */
  function startLive(state, hostCard, guestCard, side, seed, round) {
    var p = active(state), why = canBattle(p);
    if (why) return { ok: false, msg: why };
    var errH = PP.Cards.validateCard(hostCard), errG = PP.Cards.validateCard(guestCard);
    if (errH || errG) return { ok: false, msg: 'Pal not valid: ' + (errH || errG) };
    if ((hostCard.stage || 'adult') !== (guestCard.stage || 'adult')) return { ok: false, msg: 'Live battles need two pals of the same stage' };   // 2.4.92
    p.energy -= R.costs.battle;
    var B = PP.Live.create(hostCard, guestCard, seed, round), v = PP.Live.view(B, side);
    v.opp = side === 'g' ? hostCard : guestCard;
    return { ok: true, battle: B, view: v };
  }
  /* 2.4.92 junior battle result: gentle (no injury), XP is banked for adulthood (capped), small coins. */
  function bankJunior(p, xp) {
    var before = p.jxp || 0;
    p.jxp = Math.min(JUNIOR.bankCap, before + Math.max(0, Math.round(xp)));
    return p.jxp - before;
  }
  function finishJunior(state, p, B, won, out) {
    out.junior = true;
    if (won) { p.wins++; p.happy = Math.min(4, p.happy + 1); p.energy = Math.min(100, p.energy + 4); }
    else { p.losses++; p.happy = Math.max(0, p.happy - 1); }
    out.xp = bankJunior(p, won ? JUNIOR.xpWin[p.stage] : JUNIOR.xpLoss);
    out.str = PP.Evolution.battleStr(p, won); out.strNow = p.str || 0; out.strCap = JUNIOR.str.cap;   // 2.6.0
    out.bank = p.jxp; out.bankCap = JUNIOR.bankCap;
    var bonus = 0, J = juniorState(state), day = PP.Shop.dayOf(now(state));
    if (U.newDay(J.day, day)) { J.day = day; J.coins = 0; }                     // (a clock set back never resets the cap)
    if (B.meta.kind === 'junior') {
      var L = ladderOf(p.stage), n = L.foes.length, i = U.clamp(B.meta.foe | 0, 0, n - 1);
      var c = ladderRun(p) || (p.jcup = { stage: p.stage, foe: 0 });
      out.cup = L.name; out.foe = i + 1; out.foes = n; out.ladder = p.stage;
      if (!won) c.foe = 0;
      else if (i + 1 >= n) {
        c.foe = 0; out.cleared = true;
        J.trophies[p.stage] = (J.trophies[p.stage] | 0) + 1; out.trophies = J.trophies[p.stage];
        if (J.trophies[p.stage] === 1) { out.firstClear = true; out.trophy = L.trophy; }
        if (U.newDay(J.paid[p.stage], day)) {   /* 2.4.96: was !== (a clock set back paid the clear bonus again) */ J.paid[p.stage] = day; bonus = JUNIOR.coins.clear; } else out.bonusPaid = true;
      } else { c.foe = i + 1; out.next = c.foe + 1; }
    }
    // coins: the junior cap first (JUNIOR.dailyCoins a day), then the game's normal daily battle cap
    var want = (won ? JUNIOR.coins.win : JUNIOR.coins.loss) + bonus, room = Math.max(0, JUNIOR.dailyCoins - J.coins), give = Math.min(want, room);
    J.coins += give;
    out.coins = give ? PP.Shop.earn(state, give, now(state)) : 0;
    out.jrCap = give < want;
    albumUpsert(state, p);
    PP.Collection.markSeen(state, B.opp, now(state));
    return out;
  }
  function finishBattle(state, B) {
    var p = active(state);
    if (!p || !B || !B.over) return null;
    if (p.jcup) delete p.jcup.live;   // 2.4.96: the fight is over (see startJuniorCup)
    if (B.paid) return null;                                // 1.9.1: a battle pays out once
    B.paid = true;
    if (B.meta.kind === 'quick' && !B.fled && !B.meta.live && p.qpin) delete p.qpin;   // 2.4.96: fought to a result - the next quick battle gets a new foe
    var won = B.winner === 0, oppLv = B.f[1].level, out = { won: won, xp: 0, levels: 0, injured: false, unlocked: null, coins: 0, kind: B.meta.kind };
    var cleared = false, champ = false, arena = B.meta.kind === 'arena', rank = B.meta.rank | 0, rec = arena ? PP.Arena.record(state, rank) : null;
    if (arena) {
      state.arena.attempt++;
      out.cup = D.ARENA[rank].name; out.foe = (B.meta.foe | 0) + 1; out.foes = PP.Arena.foeCount(rank);
    }
    /* Power Training dummy: training rewards, no injury, no win/loss, no Paldex mark. */
    if (B.meta.kind === 'dummy') {
      if (B.fled) {
        out.fled = B.fled; out.won = false;
        p.energy = Math.min(100, p.energy + Math.floor(R.costs.train / 2));
        return out;
      }
      p.weight = Math.max(Math.ceil(PP.Care.baseWeight(p) * 0.5), p.weight - 1);
      PP.Evolution.noteStyle(p, 'dummy', won);
      if (won) p.energy = Math.min(100, p.energy + 4);
      if (!p.evo) p.evo = { trainings: 0, games: 0 };
      p.evo.trainings = (p.evo.trainings || 0) + 1;
      var day = Math.floor(p.clock / 1440);
      if (!p.trainDay || p.trainDay.d !== day) p.trainDay = { d: day, n: 0 };
      p.trainDay.n++;
      PP.Evolution.noteTraining(p);
      var full = p.trainDay.n <= R.trainDayFull;
      var msg;
      if (won && full) { p.happy = Math.min(4, p.happy + 1); p.discipline = Math.min(100, p.discipline + 5); }
      msg = !full ? (won ? 'Good fight, but your pal is over-trained today' : 'Nice try!')
                  : won ? 'Dummy down! Discipline +5%, happy +1' : 'Nice try!';
      if (p.stage === 'baby') msg += PP.Care.babyTrainNote(p);   // 2.5.2
      if (PP.Stats.isJunior(p) && won && full) { out.xp = bankJunior(p, JUNIOR.xpTrain); if (out.xp) msg += ' +' + out.xp + ' XP saved for adulthood'; }   // 2.4.92
      if (p.stage === 'adult') {
        var xp = PP.Traits.trainXp(p, !full ? 1 : won ? D.LEVEL.trainXp(p.level) : Math.ceil(D.LEVEL.trainXp(p.level) / 3));   // 2.4.97 Humble
        out.xp = xp;
        out.levels = PP.Stats.addXp(p, xp);
        msg += ' +' + xp + ' XP' + (out.levels ? ' LEVEL UP!' : '');
      }
      out.msg = msg;
      out.coins = PP.Shop.earn(state, won ? D.ECONOMY.trainWin : D.ECONOMY.trainLoss, now(state));
      if (out.coins) out.msg += ' +' + out.coins + 'c';
      PP.Daily.record(state, 'train', now(state));
      PP.Daily.observe(state, now(state));
      PP.Hints.learn(state, 'train');
      albumUpsert(state, p);
      return out;
    }
    /* 1.8.4: running away - no XP, no coins, no injury; half the battle energy comes back.
     * Arena: the run is over and counts as a loss; friend battles: a forfeit (a loss). */
    if (B.fled) {
      out.fled = B.fled; out.won = false;
      p.energy = Math.min(100, p.energy + Math.floor(R.costs.battle / 2));
      if (B.fled === 'forfeit') p.losses++;
      if (arena) { rec.losses++; state.arena.run = null; }
      // 2.4.96: running from a Junior Cup fight ends the ladder run too (no loss is counted) -
      // before, the run was kept, so a losing fight could be escaped and tried again for free
      if (B.meta.kind === 'junior' && ladderRun(p) && ladderRun(p).foe) { ladderRun(p).foe = 0; out.cupReset = true; }
      if (B.meta.fcup) PP.World.fcupResult(state, B, out, now(state));   // 2.4.0 Friends Cup: the run is over
      PP.Collection.markSeen(state, B.opp, now(state));
      return out;
    }
    p.weight = Math.max(Math.ceil(PP.Care.baseWeight(p) * 0.5), p.weight - 1);
    if (PP.Stats.isJunior(p)) return finishJunior(state, p, B, won, out);   // 2.4.92
    if (B.meta.practice) return finishPractice(state, p, B, won, out);       // 2.4.94 adult Quick battle
    if (won) {
      p.wins++; out.xp = D.LEVEL.winXp(p.level, oppLv);
      p.happy = Math.min(4, p.happy + 1);
      p.energy = Math.min(100, p.energy + 4);
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
    var lv0 = p.level;
    out.levels = PP.Stats.addXp(p, out.xp);
    var tr = PP.Traits.afterBattle(p, B, won);              // 2.4.97 battle traits (real adult battles only)
    if (tr) { out.trait = { id: tr.id, name: PP.Traits.label(tr), short: PP.Traits.DEFS[tr.id].short }; PP.World.remember(p, 'battle', 'Earned the ' + PP.Traits.label(tr) + ' trait', now(state)); }
    memoBattle(p, out, lv0, now(state));                    // 2.4.0 memory book
    var bc = PP.Shop.battleCoins(won, oppLv, B.meta, cleared, champ, out.myth);
    if (won && B.meta.kind === 'visitor') { bc.bonus += PP.Daily.VISITOR_BONUS; out.visitor = true; }
    if (won && B.meta.kind === 'daily') { bc.bonus += 50; out.daily = true; var p = active(state); if (p) { var dd = PP.Shop.dayOf(now(state)); if (U.newDay(p.arenaDay, dd)) p.arenaDay = dd; p.wonDaily = true; } }   // 2.4.96: >= / max - a clock set back no longer re-opens the bonus
    if (won && B.meta.kind === 'weekly') { bc.bonus += 150; out.weekly = true; var p = active(state); if (p) { var ww = PP.Daily.weekOf(now(state)); if (U.newDay(p.weekDone, ww, 2)) p.weekDone = ww; p.wonWeekly = true; } }
    out.coins = PP.Shop.earn(state, bc.capped, now(state)) + PP.Shop.earn(state, bc.bonus, now(state), false);
    if (won) { var dr = PP.Daily.record(state, 'battle', now(state)); out.coins += dr.coins; }
    out.capped = bc.capped > 0 && out.coins < bc.capped + bc.bonus;
    if (B.meta.fcup) PP.World.fcupResult(state, B, out, now(state));     // 2.4.0 Friends Cup (after the capped coins)
    albumUpsert(state, p);
    PP.Collection.markSeen(state, B.opp, now(state));
    out.shells = PP.Collection.checkUnlocks(state).map(function (s) { return s.name; });
    return out;
  }

  /* ---------------------------------------------------------------- friends & breeding */
  /* 2.1.0: opts.via = 'live' when the friend comes from a live battle (the room already carried both battle codes, so no
   * extra storage is needed anywhere). The code itself is kept so it can be copied / re-shared later. */
  function addFriend(state, code, opts) {
    var r = PP.Cards.decode(code);
    if (!r.ok) return { ok: false, msg: r.error };
    if (r.card.stage !== 'adult') return { ok: false, msg: 'Only adult pals can be added as friends' };   // 2.4.92: young cards are for live rooms only
    var mine = state.slots.some(function (s) { return s && s.id === r.card.id; });
    if (mine) return { ok: false, msg: "That's your own pal's code" };
    var existed = state.friends.some(function (f) { return f.id === r.card.id; });
    var prev = state.friends.filter(function (f) { return f.id === r.card.id; })[0];
    state.friends = state.friends.filter(function (f) { return f.id !== r.card.id; });
    r.card.code = String(code).replace(/\s+/g, '');
    r.card.via = (opts && opts.via === 'live') || (prev && prev.via === 'live') ? 'live' : 'code';
    r.card.added = now(state);
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
    r.egg.hard = !!(state.settings && state.settings.hardNext);
    if (mythWon(state)) r.egg.myth = true;
    state.slots[i] = r.egg;
    PP.World.remember(p, 'egg', 'Had an egg with ' + (partner.name || 'a friend'), now(state, realNow));   // 2.4.0
    PP.World.remember(r.egg, 'egg', 'Laid by ' + p.name + ' and ' + (partner.name || 'a friend'), now(state, realNow));
    return { ok: true, msg: r.msg + ' - it is in slot ' + (i + 1), slot: i, egg: r.egg };
  }
  function mates(state) {
    var p = active(state);
    if (!p) return [];
    var list = [];
    state.slots.forEach(function (s, i) { if (s && s !== p) list.push({ kind: 'slot', slot: i, pal: s, check: PP.Breeding.canBreed(p, s, now(state)) }); });
    state.friends.forEach(function (c, i) { list.push({ kind: 'friend', idx: i, pal: c, check: PP.Breeding.canBreed(p, c, now(state)) }); });
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

  PP.Game = { startLive: startLive, newState: newState, now: now, active: active, freeSlot: freeSlot, startEgg: startEgg, setActive: setActive, release: release, revive: revive, reviveCost: reviveCost, lostPals: lostPals,
    update: update, act: act, exercise: exercise, canBattle: canBattle, juniorFoe: juniorFoe, ladderFoe: ladderFoe, ladderRun: ladderRun, juniorState: juniorState, startJuniorQuick: startJuniorQuick, startAdultQuick: startAdultQuick, quickFoe: quickFoe, quickPin: quickPin, QUICK_PIN_MIN: QUICK_PIN_MIN, startJuniorCup: startJuniorCup, bankJunior: bankJunior, canTrainDummy: canTrainDummy, startDummy: startDummy, startArena: startArena, startBattle: startBattle, startFriend: startFriend, startQuick: startQuick, startVisitor: startVisitor, startDaily: startDaily, startWeekly: startWeekly, visitorCard: visitorCard, finishBattle: finishBattle,
    addFriend: addFriend, breedWith: breedWith, mates: mates, albumUpsert: albumUpsert, albumFind: albumFind, familyTree: familyTree, Test: Test };
})(typeof window !== 'undefined' ? window : globalThis);
