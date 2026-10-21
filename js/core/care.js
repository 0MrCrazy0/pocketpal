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
    var K = R.sick;   // 2.6.0: neglect makes a pal sick (was 0.004 + 0.03 / poop + 0.03 hungry + 0.02 heavy + 0.01 unhappy)
    var h = K.base + K.poop * p.poop + (p.poop >= K.pileAt ? K.pile : 0) + (p.hunger <= 0 ? K.hungry : 0) + (isOverweight(p) ? K.heavy : 0) + (p.happy <= 0 ? K.unhappy : 0);
    if (p.asleep) h *= 0.5;
    return h * (1 - 0.4 * (p.genes ? p.genes.hardy : 0.5));
  }

  var ACC_FULL = 1 - 1e-9;   // 2.5.2: 30 x (1/30) adds up to 0.99999...: a heart dropped one minute late
  var HOLD_MAX = 120;   // 1.9.1: longest clock-back hold (daylight saving is 60 min, Lord Howe 30)
  /* Advance one simulated minute. tMs = wall-clock time of this minute. */
  /* 1.9.1: what the night was like, for the morning report card (null if not tracked). */
  function nightReport(p) {
    var n = p.night; p.night = null;
    if (!n || !(n.mins > 0)) return null;
    return { mins: n.mins, dark: n.dark, lit: n.lit, woke: n.woke || 0, mistakes: Math.max(0, (p.totalMistakes || 0) - (n.mist || 0)) };
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
    // 2.2.0: woken early (lights on at night). It stays up while the lights are on, for at most wokenAwakeMin,
    // then dozes off again (lights off puts it straight back to bed). The night's log carries on.
    if (p.wokeAt != null && (p.asleep || !night || !p.lights || p.clock - p.wokeAt >= R.wokenAwakeMin || p.wokeAt > p.clock)) {
      var resleep = !p.asleep && night;
      p.wokeAt = null;
      if (!night && !p.asleep && p.night) { ev.push({ t: 'wake', from: 'night', report: nightReport(p), early: true }); }
      if (resleep) { p.asleep = true; p.sleepKind = 'night'; p.fake = null; if (!p.night) p.night = { mins: 0, dark: 0, lit: 0, mist: p.totalMistakes || 0 }; ev.push({ t: 'sleep', again: true }); }
    }
    if (night && !(p.asleep && p.sleepKind === 'night') && p.wokeAt == null) {
      p.asleep = true; p.sleepKind = 'night';
      p.nightKey = p.clock;       // when this night's sleep started
      p.fake = null;
      p.night = { mins: 0, dark: 0, lit: 0, mist: p.totalMistakes || 0 };   // 1.9.1 morning report card
      ev.push({ t: 'sleep' });
    } else if (!night && p.asleep && p.sleepKind === 'night') {
      p.asleep = false; p.sleepKind = null; p.lights = true;
      ev.push({ t: 'wake', from: 'night', report: nightReport(p) });
    }
    if (night && p.asleep && p.sleepKind === 'nap') { p.sleepKind = 'night'; p.nightKey = p.clock; p.night = { mins: 0, dark: 0, lit: 0, mist: p.totalMistakes || 0 }; ev.push({ t: 'sleep', from: 'nap' }); }
    if (!night && !p.asleep && !p.lights && p.energy < R.napEnergy) {
      p.asleep = true; p.sleepKind = 'nap'; p.fake = null; ev.push({ t: 'nap' });   // 2.3.21: a pal does not sulk in its sleep (every other way to fall asleep ends a tantrum too)
    } else if (p.asleep && p.sleepKind === 'nap' && (p.lights || (p.energy >= 100 && !PP.Sleep.windDown(mod, PP.Sleep.of(p))))) {
      // 2.4.92: a nap that fills up in the last hour before bedtime dozes on into the night (it used to wake the pal, put
      // the lights on and send "woke from its nap" just before bedtime - then the bedtime alert for the lights it turned on)
      if (night) { p.sleepKind = 'night'; p.nightKey = p.clock; p.night = { mins: 0, dark: 0, lit: 0, mist: p.totalMistakes || 0 }; ev.push({ t: 'sleep', from: 'nap' }); }
      else { p.asleep = false; p.sleepKind = null; p.lights = true; ev.push({ t: 'wake', from: 'nap' }); }
    }
    if (p.asleep && p.sleepKind === 'night' && p.night) { p.night.mins++; if (p.lights) p.night.lit++; else p.night.dark++; }

    // ---- meters
    if (!p.asleep) {
      var app = p.genes ? p.genes.appetite : 1;
      p.acc.hunger += app / cfg.hungerMin;
      if (p.acc.hunger >= ACC_FULL) { p.acc.hunger = Math.max(0, p.acc.hunger - 1); if (p.hunger > 0) p.hunger--; }
      var hm = 1;
      if (p.sick) hm *= 2;
      if (p.poop >= 2) hm *= 1.5;
      if (p.energy <= 0) hm *= 2;
      p.acc.happy += hm / cfg.happyMin;
      if (p.acc.happy >= ACC_FULL) { p.acc.happy = Math.max(0, p.acc.happy - 1); if (p.happy > 0) p.happy--; }
      p.acc.poop += 1 / cfg.poopMin;
      if (p.acc.poop >= ACC_FULL) {
        p.acc.poop = Math.max(0, p.acc.poop - 1);
        if (p.poop < R.maxPoop) { p.poop++; ev.push({ t: 'poop' }); }
      }
      p.energy = Math.max(0, p.energy - 1 / R.energyAwakeMin);
      // metabolism (1.8.0): an awake pal burns about one meal's worth of weight per hunger heart,
      // so normal feeding keeps it near its base weight; only extra snacks / cakes / feasts make it
      // heavy. Before this, weight only ever went up and every well-fed adult ended up "Heavy".
      if (p.weight > cfg.weight) {
        p.acc.weight = (p.acc.weight || 0) + app / cfg.hungerMin;
        if (p.acc.weight >= ACC_FULL) { p.acc.weight = Math.max(0, p.acc.weight - 1); p.weight = Math.max(cfg.weight, p.weight - 1); }
      } else p.acc.weight = 0;
    } else {
      p.energy = Math.min(100, p.energy + 1 / (p.lights ? R.energySleepLitMin : (p.sleepKind === 'nap' ? R.energyNapMin : R.energySleepMin)));
    }

    // ---- sickness
    if (!p.sick && U.roll(p.seed, p.clock, 'sick') < sicknessPerHour(p) / 60) {
      p.sick = true; p.sickDoses = 0; ev.push({ t: 'sick' });
    }

    // ---- fake calls (tantrums): child and older, awake, nothing really wrong
    if (p.fake && p.stage === 'baby') p.fake = null;   // 2.5.2: a baby can't be disciplined, so it never has a tantrum to lose discipline over (old saves)
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
    var missAt = p.need.missAt || (p.need.missAt = {});
    for (var k in needs) {
      // 2.4.95 fairness: while the pal sleeps (night or nap) the poop and sickness timers stand still and no new call
      // starts - medicine needs it awake and nobody should have to get up at night to clean. They carry on when it wakes.
      if (needs[k] && p.asleep && (k === 'poop' || k === 'sick')) { if (p.need[k]) p.need[k].next++; continue; }
      if (needs[k]) {
        if (!p.need[k]) {
          var nx = p.clock + grace[k];
          // 2.4.95: a hunger / unhappy call that a nap interrupted does not restart at a fresh 30 min right after a
          // miss (that counted the same neglect twice within the hour) - the next miss keeps the 3 h repeat gap
          if (missAt[k] != null && p.clock - missAt[k] < R.neglectRepeatMin) nx = Math.max(nx, missAt[k] + R.neglectRepeatMin);
          p.need[k] = { since: p.clock, next: nx };
          if (k !== 'poop') ev.push({ t: 'call', need: k });
        }
        if (p.clock >= p.need[k].next) {
          if (k === 'lights') {
            // at most one lights mistake per 12 h, even if a schedule change wakes the pal and it falls asleep again
            if (!(p.clock - (p.need.lightsAt == null ? -1e9 : p.need.lightsAt) < 720)) { addMistake(p, labels[k], ctx, ev); p.need.lightsAt = p.clock; }
            p.need[k].next = 1e15;
          } else {
            addMistake(p, labels[k], ctx, ev);
            p.need[k].next = p.clock + R.neglectRepeatMin; missAt[k] = p.clock;
          }
        }
      } else {
        if (p.need[k]) p.need[k] = null;
        if (!p.asleep && missAt[k] != null) delete missAt[k];   // answered (not just asleep): a later call starts fresh
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
  var HARD = { starveMin: 12 * 60, sickMin: 24 * 60, mistakes: 4 };   // 2.4.96: 6 -> 4 (misses are fair since 2.4.95: neglect peaks at 4-5 a day, 2-hourly care at 3)
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
    // 2.5.2: away longer than the simulation cap (14 days): only the last 14 days are played, but the pal still got that
    // much older - its age follows real time (the stage clock does not, so a long absence never skips a stage)
    if (steps < elapsed && !p.fate && p.stage !== 'egg') p.ageMin = (p.ageMin || 0) + (elapsed - steps);
    p.lastTickAt += elapsed * U.MIN;
    if (ctx.offline) ev.push({ t: 'caughtUp', minutes: elapsed, mistakes: ctx.offlineMistakes });
    return ev;
  }

  /* ------------------------------------------------------------ player actions
   * Each returns { ok, msg, anim } and mutates the pet. */
  function res(ok, msg, anim) { return { ok: ok, msg: msg, anim: anim || null }; }
  /* 2.2.0: one clear answer for every care action that needs the pal awake (feed, snack, medicine, play, train, scold,
   * praise, battle, items). Cleaning is allowed in its sleep - the classic toys let you, and a mess left all night
   * would otherwise be an unavoidable care mistake. */
  var SLEEP_MSG = "Shh... it's asleep. Lights on wakes it";
  function asleepRes() { return Object.assign(res(false, SLEEP_MSG), { asleep: true }); }
  function blocked(p) {
    if (!p) return res(false, 'No pal');
    if (p.fate) return res(false, 'Your pal is gone');
    if (p.stage === 'egg') return res(false, 'Still an egg!');
    return null;
  }

  function feedMeal(p) {
    var b = blocked(p); if (b) return b;
    if (p.asleep) return asleepRes();
    if (p.fake) return res(false, 'Tantrum! It refuses food', 'refuse');   // a tantrum is not a good deed
    if (p.hunger >= R.maxHearts) {
      // politely saying no when full is worth praise - but only once an hour, so it can't be farmed
      if (p.clock - (p.refuseAt == null ? -1e9 : p.refuseAt) >= R.praise.refuseEveryMin) { p.refuseAt = p.clock; deed(p); }
      return res(false, 'Full! It shakes its head', 'refuse');
    }
    p.hunger++; p.weight += 1;
    p.energy = Math.min(100, p.energy + R.energyFood.meal);
    deed(p);   // feeding a hungry pal is worth praise
    return res(true, 'Yum! Hunger +1', 'eat');
  }
  function feedSnack(p) {
    var b = blocked(p); if (b) return b;
    if (p.asleep) return asleepRes();
    p.snacks = (p.snacks || []).filter(function (c) { return p.clock - c < R.snackWindowMin; });
    p.snacks.push(p.clock);
    p.happy = Math.min(R.maxHearts, p.happy + 1); p.weight += 2;
    p.energy = Math.min(100, p.energy + R.energyFood.snack);
    if (p.snacks.length > R.snackLimit) {
      addMistake(p, 'Overfed snacks', null, null);
      if (!p.sick && U.roll(p.seed, p.clock, 'snack', p.snacks.length) < 0.35) { p.sick = true; p.sickDoses = 0; return res(true, 'Too many snacks! Tummy ache', 'sick'); }
      return res(true, 'Too many snacks! (care mistake)', 'sad');
    }
    return res(true, 'Sweet! Happy +1', 'eat');
  }
  function clean(p) {
    var b = blocked(p); if (b) return b;
    if (p.poop <= 0) return res(false, 'Already clean');
    p.poop = 0; p.acc.poop = Math.min(p.acc.poop, 0.5);
    if (p.need) p.need.poop = null;
    deed(p);
    return res(true, 'All clean!', 'happy');
  }
  function medicine(p) {
    var b = blocked(p); if (b) return b;
    if (p.asleep) return asleepRes();               // 2.2.0: it could be given medicine in its sleep
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
    return res(true, 'Dose ' + p.sickDoses + ' of ' + need + '. One more needed', 'sick');
  }
  /* Lights. 2.2.0: switching them ON always wakes the pal (the 1.9.1 rule kept it asleep in its sleep hours, which
   * players read as "stuck - it won't wake up"):
   *  - a nap ends;
   *  - a night sleep after the pal's own wake time ends with the morning report (as before);
   *  - a night sleep IN its sleep hours ends too, Tamagotchi-style: it wakes up grumpy (happy -1, once a night), stays
   *    up while the lights are on - at most R.wokenAwakeMin - and then dozes off again by itself. Lights off sends it
   *    straight back to bed. r.early = true, r.backBy = the minute of day it will doze off at the latest.
   * Lights OFF in its sleep hours while it is up (woken early) puts it back to sleep at once.
   * nowMs / opts (minuteOf) are optional; without them the last simulated minute is used. */
  function toggleLights(p, nowMs, opts) {
    var b = blocked(p); if (b) return b;
    var mod = nowMs != null ? minuteFn(opts)(nowMs) : p.dayMin, sch = PP.Sleep.of(p);
    var inNight = mod != null && PP.Sleep.isNight(mod, sch);
    p.lights = !p.lights;
    if (!p.lights && p.need) p.need.lights = null;
    if (!p.lights) {
      if (inNight) {
        if (!(p.asleep && p.sleepKind === 'night')) p.nightKey = p.clock;
        p.wokeAt = null; p.asleep = true; p.sleepKind = 'night'; p.fake = null;
        if (!p.night) p.night = { mins: 0, dark: 0, lit: 0, mist: p.totalMistakes || 0 };
        deed(p);
        return Object.assign(res(true, 'Lights off - straight to sleep.', null), { resleep: true });
      }
      if (!p.asleep) {
        p.wokeAt = null;   // 2.4.99: falling asleep always ends 'woken early' (lights off right at the night edge left it set)
        p.night = null;    // 2.5.1: the night is over - a log left from being woken early ends too (the save dropped it: a reload changed the state)
        p.asleep = true; p.sleepKind = 'nap'; p.fake = null;
        return Object.assign(res(true, 'Lights off - a nap. Energy is recovering.', null), { resleep: true });
      }
      return res(true, 'Lights off', null);
    }
    if (p.asleep && p.sleepKind === 'nap') { p.asleep = false; p.sleepKind = null; return Object.assign(res(true, 'Lights on - awake again!', null), { woke: true, from: 'nap' }); }
    if (p.asleep && p.sleepKind === 'night') {
      p.asleep = false; p.sleepKind = null; p.holdTo = null;
      if (p.need) p.need.lights = null;
      if (mod == null || !inNight) {
        p.wokeAt = null;
        return Object.assign(res(true, 'Lights on - ' + (PP.Time && mod != null ? PP.Time.greeting(mod).toLowerCase() : 'good morning') + '!', null), { woke: true, from: 'night', report: nightReport(p), at: mod });   // 1.9.9: by the hour
      }
      p.wokeAt = p.clock;
      if (!p.night) p.night = { mins: 0, dark: 0, lit: 0, mist: p.totalMistakes || 0 };
      var first = !(p.night.woke > 0);
      p.night.woke = (p.night.woke || 0) + 1;
      if (first) p.happy = Math.max(0, p.happy - 1);
      return Object.assign(res(true, first ? 'Lights on - it wakes up grumpy! Happy -1' : 'Lights on - awake again (still grumpy)', 'sad'),
        { woke: true, from: 'early', early: true, grumpy: first, backBy: (mod + R.wokenAwakeMin) % 1440, wakeAt: sch.wake });
    }
    return res(true, 'Lights on', null);
  }
  function scold(p) {
    var b = blocked(p); if (b) return b;
    if (p.stage === 'baby') return res(false, 'Babies don\u2019t throw tantrums yet. Nothing to scold!');   // 2.5.2: no penalty, no tantrums, the meter cannot drop
    if (p.asleep) return asleepRes();
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
    if (p.stage === 'baby') return res(false, 'Praise starts when it\u2019s a child. Train it for discipline +5% now');
    if (p.asleep) return asleepRes();
    var open = praiseOpen(p);
    p.praiseReady = false;
    if (p.fake) {
      p.discipline = Math.max(0, p.discipline - R.praise.spoil);
      return res(false, 'Praising a tantrum spoils it. Discipline -' + R.praise.spoil + '%', 'sad');
    }
    if (open) {
      p.discipline = Math.min(100, p.discipline + R.praise.earned);
      p.happy = Math.min(R.maxHearts, p.happy + 1);
      return res(true, 'Good pal! Discipline +' + R.praise.earned + '%', 'happy');
    }
    // a plain praise still builds a little, once an hour, so the meter is not stuck at 0
    if (p.clock - (p.spoilAt == null ? -1e9 : p.spoilAt) >= R.praise.spoilHappyMin) {
      p.spoilAt = p.clock;
      p.discipline = Math.min(100, p.discipline + 4);
      p.happy = Math.min(R.maxHearts, p.happy + 1);
      return res(true, 'Nice! Discipline +4%', 'happy');
    }
    return res(true, 'It likes that. Praise again in a bit.', 'happy');
  }
  /* Mini-game / training results. kind: 'train' | 'game'. success: bool */
  /* 2.5.2: babies get no XP or style points; their trainings count toward the adult's care score (up to 12, kept at growing up). */
  function babyTrainNote(p) { var n = Math.min(12, (p.evo && p.evo.trainings) || 0); return ' \u00b7 Stronger adult: training ' + n + '/12'; }
  function canExercise(p, kind) {
    var b = blocked(p); if (b) return b;
    if (p.asleep) return asleepRes();
    if (p.sick) return res(false, 'Too sick to play');
    var cost = kind === 'train' ? R.costs.train : R.costs.game;
    if (p.energy < cost) { var t = res(false, 'Too tired... (needs ' + cost + ' energy)'); t.tired = cost; return t; }
    return res(true, '');
  }
  function exercise(p, kind, success, mini) {
    var c = canExercise(p, kind); if (!c.ok) return c;
    PP.Evolution.noteStyle(p, mini || kind, !!success);       // 2.4.0: young pals' training style (style adult forms)
    p.energy = Math.max(0, p.energy - (kind === 'train' ? R.costs.train : R.costs.game));
    if (success) p.energy = Math.min(100, p.energy + (kind === 'train' ? 4 : 2));
    p.weight = Math.max(Math.ceil(baseWeight(p) * 0.5), p.weight - 1);
    var msg;
    if (kind === 'train') {
      p.evo.trainings++;
      var day = Math.floor(p.clock / 1440);                  // 1.8.2 anti-farm: full rewards for the first N trainings a day
      if (!p.trainDay || p.trainDay.d !== day) p.trainDay = { d: day, n: 0 };
      p.trainDay.n++;
      PP.Evolution.noteTraining(p);                         // 1.9.7: training streak (Aurorawing)
      var full = p.trainDay.n <= R.trainDayFull;
      if (success && full) { p.happy = Math.min(R.maxHearts, p.happy + 1); p.discipline = Math.min(100, p.discipline + 5); deed(p); }
      msg = !full ? (success ? 'Good hit, but your pal is over-trained today' : 'Nice try!') : success ? 'Great training! Discipline +5%, happy +1' : 'Nice try!';
      if (p.stage === 'baby') msg += babyTrainNote(p);   // 2.5.2: what a baby's training really changes
      if (p.stage === 'adult') {
        var xp = PP.Traits.trainXp(p, !full ? 1 : success ? D.LEVEL.trainXp(p.level) : Math.ceil(D.LEVEL.trainXp(p.level) / 3));   // 2.4.97 Humble
        var lv = PP.Stats.addXp(p, xp);
        msg += ' +' + xp + ' XP' + (lv ? ' LEVEL UP!' : '');
      }
    } else {
      if (success) p.happy = Math.min(R.maxHearts, p.happy + 2);
      else p.happy = Math.min(R.maxHearts, p.happy + (p.happy < 1 ? 1 : 0));
      msg = success ? 'You won! Happy +2' : 'Lost... but it had fun';
      // Adults: Memory / Match also pay XP (half of Power Training) so every Training drill levels the pal
      if (p.stage === 'adult') {
        // 2.4.92 anti-farm (like Power Training): only the first trainDayFull games a pet-day pay the half XP, then 1 XP
        var gday = Math.floor(p.clock / 1440);
        if (!p.trainDay || p.trainDay.d !== gday) p.trainDay = { d: gday, n: 0 };
        p.trainDay.g = (p.trainDay.g || 0) + 1;
        var gfull = p.trainDay.g <= R.trainDayFull;
        var gxp = PP.Traits.trainXp(p, success && gfull ? Math.max(2, Math.ceil(D.LEVEL.trainXp(p.level) / 2)) : 1);   // 2.4.97 Humble
        var glv = PP.Stats.addXp(p, gxp);
        msg += ' +' + gxp + ' XP' + (glv ? ' LEVEL UP!' : '');
      }
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


  /* 2.4.95: the schedule / care-call status line under the screen. Pure. Returns { kind, text, left } or null.
   * left = minutes before the call counts as a care mistake (the countdown). minOfDay = local minute of the day.
   * fmt(minOfDay) formats a clock time (default 24 h HH:MM). */
  var STATUS_TEXT = { hunger: 'Hungry! Feed it', happy: 'Sad! Play with it', sick: 'Sick! Give medicine', poop: 'Clean up the mess',
    lights: 'Bedtime: lights off' };
  function minText(m) { m = Math.max(1, Math.ceil(m)); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h ' + ('0' + (m % 60)).slice(-2) + 'm'; }
  function careStatus(p, minOfDay, fmt) {
    if (!p || p.fate || p.stage === 'egg') return null;
    fmt = fmt || function (m) { return ('0' + Math.floor(m / 60)).slice(-2) + ':' + ('0' + (m % 60)).slice(-2); };
    var sch = PP.Sleep.of(p), best = null, n = realNeeds(p);
    ['sick', 'hunger', 'happy', 'lights', 'poop'].forEach(function (k) {
      var nd = p.need && p.need[k];
      if (!n[k] || !nd || !(nd.next < 1e14)) return;
      var left = nd.next - p.clock;
      if (left > 0 && (!best || left < best.left)) best = { kind: k, left: left };
    });
    if (best) return { kind: best.kind, left: best.left, text: STATUS_TEXT[best.kind] + ' \u00b7 ' + minText(best.left) + ' left' };
    if (p.fake && !p.asleep) { var tl = p.fake.until - p.clock; return { kind: 'tantrum', left: tl, text: 'Tantrum! Scold it \u00b7 ' + minText(tl) + ' left' }; }
    if (p.asleep && p.sleepKind === 'night') return { kind: 'sleeping', text: 'Sleeping until ' + fmt(sch.wake) };
    if (p.asleep) return { kind: 'nap', text: 'Napping \u00b7 lights on wakes it' };
    if (minOfDay != null && PP.Sleep.isNight(minOfDay, sch)) return { kind: 'bedtime', text: 'Bedtime: put your pal to bed' };
    if (minOfDay != null && PP.Sleep.until(minOfDay, sch.bed) <= BEDTIME_SOON_MIN) return { kind: 'bedsoon', left: PP.Sleep.until(minOfDay, sch.bed), text: 'Bedtime soon \u00b7 ' + fmt(sch.bed) };
    return { kind: 'awake', text: 'Awake: play time' };
  }
  var BEDTIME_SOON_MIN = 15;

  PP.Care = { SLEEP_MSG: SLEEP_MSG, nextCall: nextCall, attention: attention, ATTENTION_ORDER: ATTENTION_ORDER,
    careStatus: careStatus, minText: minText, BEDTIME_SOON_MIN: BEDTIME_SOON_MIN, tick: tick, stepMinute: stepMinute, realNeeds: realNeeds, hasRealCall: hasRealCall,
    feedMeal: feedMeal, feedSnack: feedSnack, clean: clean, medicine: medicine, toggleLights: toggleLights, nightReport: nightReport, outOfBox: outOfBox,
    scold: scold, praise: praise, praiseOpen: praiseOpen, exercise: exercise, canExercise: canExercise, babyTrainNote: babyTrainNote, moodPose: moodPose, isTired: isTired,
    baseWeight: baseWeight, isOverweight: isOverweight, isUnderweight: isUnderweight, canAct: canAct,
    sicknessPerHour: sicknessPerHour, addMistake: addMistake, firstDay: firstDay, HARD: HARD, defaultHourOf: defaultHourOf, defaultMinuteOf: defaultMinuteOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
