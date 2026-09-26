/* PocketPal 2 - pet creation, genes, names (pure). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;

  /* Hidden genes: small random variance that makes every pal a little different.
   *  hp/atk/def/spd: -3..+3 flat stat bonus (grows slowly with level)
   *  appetite 0.9..1.1 (how fast hunger drops), hardy 0..1 (sickness resistance),
   *  spirit -2..+2 (nudges the evolution score), temper 0..1 (fake-call tendency) */
  function randomGenes(rng) {
    function g3() { return rng.int(-2, 2) + (rng.chance(0.3) ? rng.pick([-1, 1]) : 0); }
    return {
      hp: U.clamp(g3(), -3, 3), atk: U.clamp(g3(), -3, 3), def: U.clamp(g3(), -3, 3), spd: U.clamp(g3(), -3, 3),
      appetite: Math.round((0.9 + rng() * 0.2) * 100) / 100,
      hardy: Math.round(rng() * 100) / 100,
      spirit: rng.int(-2, 2),
      temper: Math.round(rng() * 100) / 100
    };
  }
  function sanitizeGenes(g) {
    g = g || {};
    return {
      hp: U.int(g.hp, 0, -3, 3), atk: U.int(g.atk, 0, -3, 3), def: U.int(g.def, 0, -3, 3), spd: U.int(g.spd, 0, -3, 3),
      appetite: U.num(g.appetite, 1, 0.9, 1.1), hardy: U.num(g.hardy, 0.5, 0, 1),
      spirit: U.int(g.spirit, 0, -2, 2), temper: U.num(g.temper, 0.5, 0, 1)
    };
  }

  function randomName(rng) {
    var a = rng.pick(D.NAME_BITS.a), b = rng.pick(D.NAME_BITS.b);
    return a + b;
  }
  function cleanName(s) {
    s = String(s == null ? '' : s).replace(/[^A-Za-z0-9 \-']/g, '').replace(/\s+/g, ' ').trim();
    return s.slice(0, 12);
  }

  /* opts: { species, sex, genes, gen, parents, inheritedSkills, seed, now, name } */
  function createEgg(opts) {
    opts = opts || {};
    var seed = (opts.seed >>> 0) || (U.hash(Math.random(), Date.now()) >>> 0);
    var rng = U.makeRng(seed);
    var species = D.SPECIES.indexOf(opts.species) >= 0 ? opts.species : rng.pick(D.SPECIES);
    var now = opts.now || Date.now();
    return {
      id: U.uid(rng), seed: seed,
      name: cleanName(opts.name) || randomName(rng),
      species: species,
      sex: opts.sex === 'M' || opts.sex === 'F' ? opts.sex : (rng.chance(0.5) ? 'M' : 'F'),
      gen: U.int(opts.gen, 1, 1, 999),
      parents: opts.parents || null,
      genes: opts.genes ? sanitizeGenes(opts.genes) : randomGenes(rng),
      inheritedSkills: (opts.inheritedSkills || []).slice(0, 2),
      boost: { hp: 0, atk: 0, def: 0, spd: 0 },   // Pal Store boosts (capped, never inherited)
      stage: 'egg', form: null,
      clock: 0, ageMin: 0, stageMin: 0,
      createdAt: now, hatchedAt: null, lastTickAt: now,
      hunger: 4, happy: 4, energy: 100, weight: 5, discipline: 0, poop: 0,
      sick: false, sickDoses: 0, health: 100,
      asleep: false, sleepKind: null, lights: true,
      sched: null, schedAt: null, dayMin: null, holdTo: null,                 // own sleep schedule {bed, wake} (minutes after midnight); null = stage default
      acc: { hunger: 0, happy: 0, poop: 0 },
      need: {}, fake: null, snacks: [],
      mistakes: 0, totalMistakes: 0, mistakeLog: [], mistakeAt: [],
      evo: { moodSum: 0, moodN: 0, trainings: 0 },
      unhappyMin: 0, nightKey: null,
      level: 1, xp: 0, sp: 0, skills: [], wins: 0, losses: 0,
      lastBredClock: -1e9,
      fate: null, fateCause: null
    };
  }

  function stageKey(p) { return p.stage === 'adult' ? (p.form || 'good') : p.stage; }
  function formName(p) { return D.NAMES[p.species][stageKey(p)]; }
  function spriteStage(p) { return p.stage === 'adult' ? 'adult_' + (p.form || 'good') : (p.stage === 'dead' ? 'adult_good' : p.stage); }
  function isAlive(p) { return p && !p.fate; }
  function ageDays(p) { return Math.floor((p.ageMin || 0) / 1440); }

  PP.Pet = { createEgg: createEgg, randomGenes: randomGenes, sanitizeGenes: sanitizeGenes, cleanName: cleanName,
    randomName: randomName, formName: formName, spriteStage: spriteStage, stageKey: stageKey, isAlive: isAlive, ageDays: ageDays };
})(typeof window !== 'undefined' ? window : globalThis);
