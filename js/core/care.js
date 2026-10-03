/* PocketPal - care simulation (pure, deterministic).
 *
 * The world advances in whole simulated minutes. Every random event uses
 * U.roll(petSeed, minuteIndex, tag), so simulating 10 hours in one go (offline
 * catch-up) or minute-by-minute (live play) gives exactly the same pet.
 */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA, R = D.RULES;

  function defaultHourOf(ms) { return new Date(ms).getHours(); }
  function defaultMinuteOf(ms) { var d = new Date(ms); return d.getHours() * 60 + d.getMinutes(); }
  /* Minute of the local day for a timestamp. Tests may inject minuteOf, or the older
   * hourOf (whole hours; the minute is taken from the timestamp). */
  function minuteFn(opts) {
    if (opts && opts.minuteOf) return opts.minuteOf;
    if (opts && opts.hourOf) { var h = opts.hourOf; return function (ms) { return h(ms) * 60 + Math.floor(ms / 60000) % 60; }; }
    return defaultMinuteOf;
  }

  function careCfg(p) { return D.CARE[p.stage] || D.CARE.adult; }
  function baseWeight(p) { return careCfg(p).weight; }
  function isOverweight(p) { return p.weight > baseWeight(p) * 1.5; }
  function isUnderweight(p) { return p.weight < baseWeight(p) * 0.7; }
  function canAct(p) { return p && !p.fate && p.stage !== 'egg'; }

  /* mistakeLog holds the reasons, mistakeAt the matching times (ms) for the status page. */
  function pushLog(p, msg, at) {
    p.mistakeLog = p.mistakeLog || [];
    p.mistakeAt = p.mistakeAt || [];
    while (p.mistakeAt.length < p.mistakeLog.length) p.mistakeAt.unshift(0);
    p.mistakeLog.push(msg); p.mistakeAt.push(at || 0);
    while (p.mistakeLog.length > 12) { p.mistakeLog.shift(); p.mistakeAt.shift(); }
  }

  /* Record a care mistake. ctx.offline enforces the mercy cap. */
  function addMistake(p, why, ctx, ev) {
    if (ctx && ctx.offline) {
      if ((ctx.offlineMistakes || 0) >= R.offlineMaxMistakes) return false;
      ctx.offlineMistakes = (ctx.offlineMistakes || 0) + 1;
    }
    p.totalMistakes++;
    if (p.stage !== 'adult') p.mistakes++;
    pushLog(p, why, (ctx && ctx.now) || p.lastTickAt);
    if (p.hard) {                                   // 1.9.0 hard mode: remember when, for the 24 h runaway rule
      var at = (ctx && ctx.now) || p.lastTickAt || 0;
      p.hardMist = (p.hardMist || []).filter(function (v) { return at - v < 24 * U.HOUR; });
      p.hardMist.push(at);
    }
    if (ev) ev.push({ t: 'mistake', why: why });
    return true;
  }

  function realNeeds(p) {
    return {
      hunger: !p.asleep && p.hunger <= 0,
      happy: !p.asleep && p.happy <= 0,
      poop: p.poop > 0,
      sick: !!p.sick,
      lights: p.asleep && p.sleepKind === 'night' && p.lights
    };
  }
  function hasRealCall(p) {
    var n = realNeeds(p);
    return n.hunger || n.happy || n.sick || n.lights;
  }

  /* What the pal wants right now, most urgent first (drives the flashing attention
   * icon on the LCD). Tantrums count too: they need a scolding. */
  var ATTENTION_ORDER = ['sick', 'hunger', 'happy', 'lights', 'poop', 'tantrum'];
  function attention(p) {
    if (!p || p.fate || p.stage === 'egg') return [];
    var n = realNeeds(p), out = [];
    ATTENTION_ORDER.forEach(function (k) { if (k === 'tantrum' ? !!p.fake : n[k]) out.push(k); });
    return out;
  }

  function sicknessPerHour(p) {
    var h = 0.004 + 0.03 * p.poop + (p.hunger <= 0 ? 0.03 : 0) + (isOverweight(p) ? 0.02 : 0) + (p.happy <= 0 ? 0.01 : 0);
    if (p.asleep) h *= 0.5;
    return h * (1 - 0.4 * (p.genes ? p.genes.hardy : 0.5));
  }

  var HOLD_MAX = 120;   // 1.9.1: longest clock-back hold (daylight saving is 60 min, Lord Howe 30)
  /* Advance one simulated minute. tMs = wall-clock time of this minute. */
  /* 1.9.1: what the night was like, for the morning report card (null if not tracked). */
  function nightReport(p) {
    var n = p.night; p.night = null;
    if (!n || !(n.mins > 0)) return null;
    return { mins: n.mins, dark: n.dark, lit: n.lit, mistakes: Math.max(0, (p.totalMistakes || 0) - (n.mist || 0)) };
  }
  /* 1.9.1: a pal coming out of the Pal Box (it was in stasis) starts fresh at `nowMs`: no
   * catch-up, no clock-back hold, and if its night is over it is awake straight away instead
   * of sleeping on until the next simulated minute. */
  function outOfBox(p, nowMs, opts) {
    p.lastTickAt = nowMs; p.holdTo = null; p.stepAt = null;
    if (p.stage !== 'egg' && !p.fate && p.asleep && p.sleepKind === 'night' && !PP.Sleep.isNight(minuteFn(opts)(nowMs), PP.Sleep.of(p))) {
      p.asleep = false; p.sleepKind = null; p.lights = true; p.night = null;
      return true;
    }
    return false;
  }
  function stepMinute(p, tMs, ctx, ev) {
    if (p.fate) return;
    p.clock++;
    if (p.stage === 'egg') {
      p.stageMin++;
      if (p.stageMin >= D.STAGE_MIN.egg) {
        p.stage = 'baby'; p.stageMin = 0; p.hatchedAt = tMs;
        p.weight = D.CARE.baby.weight; p.hunger = 3; p.happy = 3; p.energy = 100;
        ev.push({ t: 'hatch' });
      }
      return;
    }
    p.ageMin++; p.stageMin++;
    var cfg = careCfg(p);
    ctx.now = tMs;
    var mod = (ctx.minuteOf || defaultMinuteOf)(tMs);
    var night = PP.Sleep.isNight(mod, PP.Sleep.of(p));   // this pal's own schedule
    // Local clock jumped BACK by up to 2 h between two back-to-back minutes (daylight saving
    // ends): hold the current sleep state until the clock is past where it was, so a pal doesn't
    // wake up for the repeated hour and fall asleep again.
    // 1.9.1 wake-bug fix: this used to compare against the last minute this pal was simulated,
    // however long ago. A pal brought back from the Pal Box, revived, re-synced after a clock
    // change or capped after 14 days away looked like "the clock went back" and was frozen
    // asleep (or awake) for up to 12 h - lights could not wake it. Now only a real clock change
    // between consecutive simulated minutes counts, and a hold never outlives a gap.
    var contiguous = p.stepAt != null && tMs - p.stepAt === U.MIN;
    if (!contiguous) p.holdTo = null;
    else if (p.dayMin != null) {
      var back = (p.dayMin - mod + 1440) % 1440;           // 1439 = the normal +1 minute
      if (back > 0 && back <= HOLD_MAX && p.holdTo == null) p.holdTo = p.dayMin;
    }
    if (p.holdTo != null) {
      var left = (p.holdTo - mod + 1440) % 1440;
      if (left === 0 || left > HOLD_MAX) p.holdTo = null;
      else night = !!(p.asleep && p.sleepKind === 'night');
    }
    p.dayMin = mod; p.stepAt = tMs;
    if (p.asleep && p.sleepKind !== 'night' && p.sleepKind !== 'nap') p.sleepKind = 'night';   // 1.9.1: never an unknown sleep

    // ---- sleep & lights
    if (night && !(p.asleep && p.sleepKind === 'night')) {
      p.asleep = true; p.sleepKind = 'night';
      p.nightKey = p.clock;       // when this night's sleep started
      p.fake = null;
      p.night = { mins: 0, dark: 0, lit: 0, mist: p.totalMistakes || 0 };   // 1.9.1 morning report card
      ev.push({ t: 'sleep' });
    } else if (!night && p.asleep && p.sleepKind === 'night') {
      p.asleep = false; p.sleepKind = null; p.lights = true;
      ev.push({ t: 'wake', from: 'night', report: nightReport(p) });
    }
    if (!night && !p.asleep && !p.lights && p.energy < R.napEnergy) {
      p.asleep = true; p.sleepKind = 'nap'; ev.push({ t: 'nap' });
    } else if (p.asleep && p.sleepKind === 'nap' && (p.lights || p.energy >= 100)) {
      p.asleep = false; p.sleepKind = null; ev.push({ t: 'wake', from: 'nap' });
    }
    if (ctx.offline && p.asleep && p.sleepKind === 'night' && p.lights) p.lights = false; // mercy: pal switches lights off itself while you're away
    if (p.asleep && p.sleepKind === 'night' && p.night) { p.night.mins++; if (p.lights) p.night.lit++; else p.night.dark++; }

    // ---- meters
    if (!p.asleep) {
      var app = p.genes ? p.genes.appetite : 1;
      p.acc.hunger += app / cfg.hungerMin;
      if (p.acc.hunger >= 1) { p.acc.hunger -= 1; if (p.hunger > 0) p.hunger--; }
      var hm = 1;
      if (p.sick) hm *= 2;
      if (p.poop >= 2) hm *= 1.5;
      if (p.energy <= 0) hm *= 2;
      p.acc.happy += hm / cfg.happyMin;
      if (p.acc.happy >= 1) { p.acc.happy -= 1; if (p.happy > 0) p.happy--; }
      p.acc.poop += 1 / cfg.poopMin;
      if (p.acc.poop >= 1) {
        p.acc.poop -= 1;
        if (p.poop < R.maxPoop) { p.poop++; ev.push({ t: 'poop' }); }
      }
      p.energy = Math.max(0, p.energy - 1 / R.energyAwakeMin);
      // metabolism (1.8.0): an awake pal burns about one meal's worth of weight per hunger heart,
      // so normal feeding keeps it near its base weight; only extra snacks / cakes / feasts make it
      // heavy. Before this, weight only ever went up and every well-fed adult ended up "Heavy".
      if (p.weight > cfg.weight) {
        p.acc.weight = (p.acc.weight || 0) + app / cfg.hungerMin;
        if (p.acc.weight >= 1) { p.acc.weight -= 1; p.weight = Math.max(cfg.weight, p.weight - 1); }
      } else p.acc.weight = 0;
    } else {
      p.energy = Math.min(100, p.energy + 1 / (p.lights ? R.energySleepLitMin : R.energySleepMin));
    }

    // ---- sickness
    if (!p.sick && U.roll(p.seed, p.clock, 'sick') < sicknessPerHour(p) / 60) {
      p.sick = true; p.sickDoses = 0; ev.push({ t: 'sick' });
    }

    // ---- fake calls (tantrums): child and older, awake, nothing really wrong
    if (p.fake && p.clock >= p.fake.until) {
      p.fake = null;
      p.discipline = Math.max(0, p.discipline - 8);
      ev.push({ t: 'fakeEnd' });
    }
    if (!p.fake && !p.asleep && p.stage !== 'baby' && !hasRealCall(p)) {
      var temper = p.genes ? 0.7 + 0.6 * p.genes.temper : 1;
      var pf = R.fakeCallPerHour * temper * (1 - p.discipline / 120) / 60;
      if (U.roll(p.seed, p.clock, 'fake') < pf) {
        p.fake = { until: p.clock + R.fakeCallMin };
        ev.push({ t: 'call', fake: true });
      }
    }

    // ---- needs -> care mistakes
    var needs = realNeeds(p);
    var gm = firstDay(p) ? 2 : 1;                     // 1.9.0: a new pal's first day is gentler (normal mode only)
    var grace = { hunger: R.callGraceMin * gm, happy: R.callGraceMin * gm, poop: R.poopGraceMin * gm, sick: R.sickGraceMin * gm, lights: R.lightsGraceMin * gm };
    var labels = { hunger: 'Left hungry', happy: 'Left unhappy', poop: 'Poop not cleaned', sick: 'Sickness untreated', lights: 'Lights left on at bedtime' };
    p.need = p.need || {};
    for (var k in needs) {
      if (needs[k]) {
        if (!p.need[k]) {
          p.need[k] = { since: p.clock, next: p.clock + grace[k] };
          if (k !== 'poop') ev.push({ t: 'call', need: k });
        }
        if (p.clock >= p.need[k].next) {
          if (k === 'lights') {
            // at most one lights mistake per 12 h, even if a schedule change wakes the pal and it falls asleep again
            if (!(p.clock - (p.need.lightsAt == null ? -1e9 : p.need.lightsAt) < 720)) { addMistake(p, labels[k], ctx, ev); p.need.lightsAt = p.clock; }
            p.need[k].next = 1e15;
          } else {
            addMistake(p, labels[k], ctx, ev);
            p.need[k].next = p.clock + R.neglectRepeatMin;
          }
        }
      } else if (p.need[k]) {
        p.need[k] = null;
      }
    }

    // ---- health
    var dr = R.healthDrain, drain = 0, cause = null, worst = 0;
    function d(v, c) { drain += v; if (v > worst) { worst = v; cause = c; } }
    if (p.hunger <= 0 && !p.asleep) d(dr.hunger, 'starved');   // sleeping pals don't starve
    if (p.sick) d(dr.sick, 'illness');
    if (p.poop >= 3) d(dr.poop, 'illness');
    if (p.happy <= 0 && !p.asleep) d(dr.happy, 'sadness');
    if (drain > 0) p.health -= drain;
    else p.health += p.asleep ? R.healthRegenSleep : R.healthRegen;
    p.health = U.clamp(p.health, 0, 100);
    var mercy = ctx.offline && (ctx.elapsedMin || 0) < R.offlineMercyMin;
    if (mercy && p.health < ctx.floor) p.health = ctx.floor; // an absence under 24 h cannot push health below the floor
    if (p.health <= 0) {
      p.fate = 'dead'; p.fateCause = cause || 'neglect'; p.asleep = false;
      ev.push({ t: 'died', cause: p.fateCause, hard: !!p.hard });
      return;
    }
    if (p.hard && hardRules(p, tMs, ev)) return;

    // ---- runaway: miserable for 24 h straight (awake), low discipline
    if (!p.asleep) {
      if (p.happy <= 0 && p.discipline < 40) p.unhappyMin++;
      else if (p.happy >= 2) p.unhappyMin = 0;
    }
    if (p.unhappyMin >= R.runawayMin && !mercy) {
      p.fate = 'gone'; p.fateCause = 'ran away'; ev.push({ t: 'ranaway', hard: !!p.hard });
      return;
    }

    // ---- evolution bookkeeping
    if (!p.asleep && p.stage !== 'adult') {
      p.evo.moodSum += (p.hunger + p.happy) / 2;
      p.evo.moodN++;
    }
    if (!p.asleep && p.stage !== 'adult' && p.stageMin >= D.STAGE_MIN[p.stage]) {
      var from = PP.Pet.stageKey(p);
      PP.Evolution.advance(p);
      ev.push({ t: 'evolve', from: from, to: PP.Pet.stageKey(p) });
      if (p.sched) {   // a custom bedtime is kept; the wake time moves if the new stage needs more or less sleep
        var fitted = PP.Sleep.fit(p.sched, p.stage);
        if (!PP.Sleep.same(fitted, p.sched)) ev.push({ t: 'schedFit', bed: fitted.bed, wake: fitted.wake });
        p.sched = PP.Sleep.same(fitted, PP.Sleep.defaultFor(p.stage)) ? null : fitted;
      }
    }
  }

  /* 1.9.0 first-day grace: need windows are doubled for the first 24 h after hatching. */
  function firstDay(p) { return !p.hard && p.stage !== 'egg' && (p.ageMin || 0) < (R.firstDayGraceMin || 0); }
  /* 1.9.0 hard mode (opt-in, per pal). Losses are permanent. Returns true if the pal is lost. */
  var HARD = { starveMin: 12 * 60, sickMin: 24 * 60, mistakes: 6 };
  function hardRules(p, tMs, ev) {
    if (p.hunger <= 0 && !p.asleep) p.hardHungry = (p.hardHungry || 0) + 1; else if (p.hunger > 0) p.hardHungry = 0;
    if (p.sick) p.hardSick = (p.hardSick || 0) + 1; else p.hardSick = 0;
    p.hardMist = (p.hardMist || []).filter(function (v) { return tMs - v < 24 * U.HOUR; });
    var cause = null, fate = 'dead';
    if (p.hardHungry >= HARD.starveMin) cause = 'starved';
    else if (p.hardSick >= HARD.sickMin) cause = 'illness';
    else if (p.hardMist.length >= HARD.mistakes) { fate = 'gone'; cause = 'ran away'; }
    if (!cause) return false;
    p.fate = fate; p.fateCause = cause; p.asleep = false;
    ev.push(fate === 'dead' ? { t: 'died', cause: cause, hard: true } : { t: 'ranaway', hard: true });
    return true;
  }

  /* Bring a pet up to date. Returns list of events.
   * opts: { minuteOf (or hourOf), offline (bool), maxMin } */
  function tick(p, nowMs, opts) {
    opts = opts || {};
    var ev = [];
    if (!p || p.fate) return ev;
    // The device clock went backwards (manual change, time-zone travel): re-sync instead of
    // freezing the pal until the clock catches up. Nothing is simulated for the "lost" time.
    if (nowMs < p.lastTickAt - 2 * U.MIN) {
      p.lastTickAt = nowMs; p.holdTo = null; p.stepAt = null; ev.push({ t: 'clockBack' });
      // 1.9.1: follow the new clock straight away (a night sleep that is now in the day ends)
      if (p.stage !== 'egg' && p.asleep && p.sleepKind === 'night' && !PP.Sleep.isNight(minuteFn(opts)(nowMs), PP.Sleep.of(p))) {
        p.asleep = false; p.sleepKind = null; p.lights = true; ev.push({ t: 'wake', from: 'night', report: nightReport(p) });
      }
      return ev;
    }
    var elapsed = Math.floor((nowMs - p.lastTickAt) / U.MIN);
    if (elapsed <= 0) return ev;
    var ctx = { minuteOf: minuteFn(opts), offline: !!opts.offline, elapsedMin: elapsed, offlineMistakes: 0,
      floor: Math.min(p.health, R.offlineHealthFloor) };
    var steps = Math.min(elapsed, opts.maxMin || R.offlineMaxSimMin);
    var start = p.lastTickAt + (elapsed - steps) * U.MIN; // if capped, skip the oldest part
    for (var i = 1; i <= steps; i++) {
      var n0 = ev.length, tm = start + i * U.MIN;
      stepMinute(p, tm, ctx, ev);
      for (var j = n0; j < ev.length; j++) ev[j].at = tm;   // when it happened (away summary)
      if (p.fate) break;
    }
    p.lastTickAt += elapsed * U.MIN;
    if (ctx.offline) ev.push({ t: 'caughtUp', minutes: elapsed, mistakes: ctx.offlineMistakes });
    return ev;
  }

  /* ------------------------------------------------------------ player actions
   * Each returns { ok, msg, anim } and mutates the pet. */
  function res(ok, msg, anim) { return { ok: ok, msg: msg, anim: anim || null }; }
  function blocked(p) {
    if (!p) return res(false, 'No pal');
    if (p.fate) return res(false, 'Your pal is gone');
    if (p.stage === 'egg') return res(false, 'Still an egg!');
    return null;
  }

  function feedMeal(p) {
    var b = blocked(p); if (b) return b;
    if (p.asleep) return res(false, 'Zzz... asleep');
    if (p.fake) return res(false, 'Tantrum! It refuses food', 'refuse');   // a tantrum is not a good deed
    if (p.hunger >= R.maxHearts) {
      // politely saying no when full is worth praise - but only once an hour, so it can't be farmed
      if (p.clock - (p.refuseAt == null ? -1e9 : p.refuseAt) >= R.praise.refuseEveryMin) { p.refuseAt = p.clock; deed(p); }
      return res(false, 'Full! It shakes its head', 'refuse');
    }
    p.hunger++; p.weight += 1;
    p.energy = Math.min(100, p.energy + R.energyFood.meal);
    return res(true, 'Yum! Hunger +1', 'eat');
  }
  function feedSnack(p) {
    var b = blocked(p); if (b) return b;
    if (p.asleep) return res(false, 'Zzz... asleep');
    p.snacks = (p.snacks || []).filter(function (c) { return p.clock - c < R.snackWindowMin; });
    p.snacks.push(p.clock);
    p.happy = Math.min(R.maxHearts, p.happy + 1); p.weight += 2;
    p.energy = Math.min(100, p.energy + R.energyFood.snack);
    if (p.snacks.length > R.snackLimit) {
      addMistake(p, 'Overfed snacks', null, null);
      if (!p.sick && U.roll(p.seed, p.clock, 'snack', p.snacks.length) < 0.35) { p.sick = true; p.sickDoses = 0; return res(true, 'Too many snacks! Tummy ache', 'sick'); }
      return res(true, 'Too many snacks! (care mistake)', 'sad');
    }
    return res(true, 'Sweet! Happy +1', 'happy');
  }
  function clean(p) {
    var b = blocked(p); if (b) return b;
    if (p.poop <= 0) return res(false, 'Already clean');
    p.poop = 0; p.acc.poop = Math.min(p.acc.poop, 0.5);
    if (p.need) p.need.poop = null;
    return res(true, 'All clean!', 'happy');
  }
  function medicine(p) {
    var b = blocked(p); if (b) return b;
    if (!p.sick) {
      p.happy = Math.max(0, p.happy - 1);
      return res(false, "Yuck! It isn't sick", 'sad');
    }
    p.sickDoses++;
    var need = R.medicineDoses[p.stage] || 1;
    if (p.sickDoses >= need) {
      p.sick = false; p.sickDoses = 0; if (p.need) p.need.sick = null;
      return res(true, 'Cured!', 'happy');
    }
    return res(true, 'One more dose needed', 'sick');
  }
  /* Lights. 1.9.1: switching them ON never traps a pal in sleep:
   *  - a nap always ends;
   *  - a night sleep ends when it is already the pal's own waking time (for example a wake
   *    time that has passed), and any clock-back hold is dropped;
   *  - during the pal's real sleep hours it stays asleep, like the classic toys, and the result
   *    says until when (r.asleepUntil = wake minute) so the game can show a clear hint.
   * nowMs / opts (minuteOf) are optional; without them the last simulated minute is used. */
  function toggleLights(p, nowMs, opts) {
    var b = blocked(p); if (b) return b;
    p.lights = !p.lights;
    if (!p.lights && p.need) p.need.lights = null;
    if (!p.lights) return res(true, 'Lights off', null);
    if (p.asleep && p.sleepKind === 'nap') { p.asleep = false; p.sleepKind = null; return Object.assign(res(true, 'Lights on - awake again!', null), { woke: true, from: 'nap' }); }
    if (p.asleep && p.sleepKind === 'night') {
      var sch = PP.Sleep.of(p), mod = nowMs != null ? minuteFn(opts)(nowMs) : p.dayMin;
      if (mod != null && !PP.Sleep.isNight(mod, sch)) {
        p.asleep = false; p.sleepKind = null; p.holdTo = null;
        if (p.need) p.need.lights = null;
        return Object.assign(res(true, 'Lights on - ' + (PP.Time ? PP.Time.greeting(mod).toLowerCase() : 'good morning') + '!', null), { woke: true, from: 'night', report: nightReport(p), at: mod });   // 1.9.9: by the hour
      }
      return Object.assign(res(true, 'Lights on - still asleep (bedtime)', null), { asleepUntil: sch.wake });
    }
    return res(true, 'Lights on', null);
  }
  function scold(p) {
    var b = blocked(p); if (b) return b;
    if (p.stage === 'baby') return res(false, 'Too young to scold');
    if (p.asleep) return res(false, 'Zzz... asleep');
    if (p.fake) {
      p.fake = null;
      p.discipline = Math.min(100, p.discipline + 25);
      return res(true, 'Good! Discipline +25%', 'sad');
    }
    p.happy = Math.max(0, p.happy - 1);
    return res(false, 'It did nothing wrong... Happy -1', 'sad');
  }
  /* A good deed (training success, refusing food when full) opens a short praise window. */
  function deed(p) { p.praiseReady = true; p.praiseAt = p.clock; }
  function praiseOpen(p) { return !!p.praiseReady && p.clock - (p.praiseAt == null ? p.clock : p.praiseAt) <= R.praise.deedMin; }
  function praise(p) {
    var b = blocked(p); if (b) return b;
    if (p.stage === 'baby') return res(false, 'Too young to praise');
    if (p.asleep) return res(false, 'Zzz... asleep');
    var open = praiseOpen(p);
    p.praiseReady = false;
    if (open && !p.fake) {
      p.discipline = Math.min(100, p.discipline + R.praise.earned);
      p.happy = Math.min(R.maxHearts, p.happy + 1);
      return res(true, 'Good pal! Discipline +' + R.praise.earned + '%', 'happy');
    }
    p.discipline = Math.max(0, p.discipline - R.praise.spoil);
    // empty praise still cheers it up, but at most once an hour (it is not free happiness)
    if (p.clock - (p.spoilAt == null ? -1e9 : p.spoilAt) >= R.praise.spoilHappyMin) { p.spoilAt = p.clock; p.happy = Math.min(R.maxHearts, p.happy + 1); }
    return res(false, (p.fake ? 'Praising a tantrum spoils it.' : 'Spoiled a little.') + ' Discipline -' + R.praise.spoil + '%', p.fake ? 'sad' : 'happy');
  }
  /* Mini-game / training results. kind: 'train' | 'game'. success: bool */
  function canExercise(p, kind) {
    var b = blocked(p); if (b) return b;
    if (p.asleep) return res(false, 'Zzz... asleep');
    if (p.sick) return res(false, 'Too sick to play');
    var cost = kind === 'train' ? R.costs.train : R.costs.game;
    if (p.energy < cost) { var t = res(false, 'Too tired... (needs ' + cost + ' energy)'); t.tired = cost; return t; }
    return res(true, '');
  }
  function exercise(p, kind, success) {
    var c = canExercise(p, kind); if (!c.ok) return c;
    p.energy = Math.max(0, p.energy - (kind === 'train' ? R.costs.train : R.costs.game));
    p.weight = Math.max(Math.ceil(baseWeight(p) * 0.5), p.weight - 1);
    var msg;
    if (kind === 'train') {
      p.evo.trainings++;
      var day = Math.floor(p.clock / 1440);                  // 1.8.2 anti-farm: full rewards for the first N trainings a day
      if (!p.trainDay || p.trainDay.d !== day) p.trainDay = { d: day, n: 0 };
      p.trainDay.n++;
      PP.Evolution.noteTraining(p);                         // 1.9.7: training streak (Aurorawing)
      var full = p.trainDay.n <= R.trainDayFull;
      if (success && full) { p.happy = Math.min(R.maxHearts, p.happy + 1); p.discipline = Math.min(100, p.discipline + 3); deed(p); }
      msg = !full ? (success ? 'Good hit, but your pal is over-trained today' : 'Nice try!') : success ? 'Great training! Discipline +3%' : 'Nice try!';
      if (p.stage === 'adult') {
        var xp = !full ? 1 : success ? D.LEVEL.trainXp(p.level) : Math.ceil(D.LEVEL.trainXp(p.level) / 3);
        var lv = PP.Stats.addXp(p, xp);
        msg += ' +' + xp + ' XP' + (lv ? ' LEVEL UP!' : '');
      }
    } else {
      if (success) p.happy = Math.min(R.maxHearts, p.happy + 2);
      else p.happy = Math.min(R.maxHearts, p.happy + (p.happy < 1 ? 1 : 0));
      msg = success ? 'You won! Happy +2' : 'Lost... but it had fun';
    }
    return res(true, msg, success ? 'happy' : 'idle');
  }

  /* Current mood/pose for rendering. */
  /* 1.8.3: awake and low on energy -> the pal looks tired (render + behaviour use this). */
  function isTired(p) { return !!p && !p.asleep && !p.fate && p.stage !== 'egg' && p.energy < R.tiredEnergy; }
  function moodPose(p) {
    if (!p || p.stage === 'egg') return 'idle';
    if (p.fate === 'dead') return 'faint';
    if (p.asleep) return 'sleep';
    if (p.sick) return 'sick';
    if (p.fake) return 'angry';
    if (p.hunger <= 0 || p.happy <= 0) return 'sad';
    return 'idle';
  }

  /* Forecast (on a copy) when the pal will next need you - used for optional
   * push reminders. Returns { at: ms, need } or null if nothing within maxMin. */
  function nextCall(p, fromMs, opts) {
    opts = opts || {};
    if (!p || p.fate || p.stage === 'egg') return null;
    var q = U.deepCopy(p), max = opts.maxMin || 12 * 60, ctx = { minuteOf: minuteFn(opts), offline: false };
    q.lastTickAt = fromMs;
    for (var i = 1; i <= max; i++) {
      var ev = [];
      stepMinute(q, fromMs + i * U.MIN, ctx, ev);
      for (var j = 0; j < ev.length; j++) {
        var e = ev[j];
        if ((e.t === 'call' && !e.fake) || e.t === 'sick' || (e.t === 'poop' && q.poop >= 2)) return { at: fromMs + i * U.MIN, need: e.need || e.t };
      }
      if (q.fate) return { at: fromMs + i * U.MIN, need: 'danger' };
    }
    return null;
  }

  PP.Care = { nextCall: nextCall, attention: attention, ATTENTION_ORDER: ATTENTION_ORDER,
    tick: tick, stepMinute: stepMinute, realNeeds: realNeeds, hasRealCall: hasRealCall,
    feedMeal: feedMeal, feedSnack: feedSnack, clean: clean, medicine: medicine, toggleLights: toggleLights, nightReport: nightReport, outOfBox: outOfBox,
    scold: scold, praise: praise, praiseOpen: praiseOpen, exercise: exercise, canExercise: canExercise, moodPose: moodPose, isTired: isTired,
    baseWeight: baseWeight, isOverweight: isOverweight, isUnderweight: isUnderweight, canAct: canAct,
    sicknessPerHour: sicknessPerHour, addMistake: addMistake, firstDay: firstDay, HARD: HARD, defaultHourOf: defaultHourOf, defaultMinuteOf: defaultMinuteOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
