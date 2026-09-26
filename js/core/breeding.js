/* PocketPal 2 - breeding (pure).
 * Rules: two ADULTS of the SAME species and OPPOSITE sex. Own pals must be healthy
 * (not sick, health >= 50) and not have bred in the last 24 h. The partner can be
 * another pal from your Pal Box or a friend's pal from their battle code. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;

  function canBreed(a, b) {
    if (!a || !b) return { ok: false, reason: 'Pick two pals' };
    if (a.id && a.id === b.id) return { ok: false, reason: 'Needs two different pals' };
    if (a.fate || b.fate) return { ok: false, reason: 'Both pals must be alive' };
    if (a.stage !== 'adult' || b.stage !== 'adult') return { ok: false, reason: 'Both must be adults' };
    if (a.species !== b.species) return { ok: false, reason: 'Must be the same species' };
    if (a.sex === b.sex) return { ok: false, reason: 'Needs one male and one female' };
    var own = [a, b].filter(function (p) { return p.clock != null; });
    for (var i = 0; i < own.length; i++) {
      var p = own[i];
      if (p.sick) return { ok: false, reason: p.name + ' is sick' };
      if (p.health < 50) return { ok: false, reason: p.name + ' is too weak' };
      if (p.clock - (p.lastBredClock == null ? -1e9 : p.lastBredClock) < D.RULES.breedCooldownMin) {
        var left = Math.ceil((D.RULES.breedCooldownMin - (p.clock - p.lastBredClock)) / 60);
        return { ok: false, reason: p.name + ' needs rest (' + left + 'h)' };
      }
    }
    return { ok: true, reason: '' };
  }

  function blendGenes(ga, gb, rng) {
    ga = PP.Pet.sanitizeGenes(ga); gb = PP.Pet.sanitizeGenes(gb);
    function stat(k) {
      var v = (ga[k] + gb[k]) / 2;
      v = rng.chance(0.5) ? Math.floor(v) : Math.ceil(v);
      if (rng.chance(0.25)) v += rng.chance(0.5) ? 1 : -1;   // mutation
      return U.clamp(v, -3, 3);
    }
    function mix(k, spread, lo, hi) {
      return Math.round(U.clamp((ga[k] + gb[k]) / 2 + (rng() * 2 - 1) * spread, lo, hi) * 100) / 100;
    }
    return {
      hp: stat('hp'), atk: stat('atk'), def: stat('def'), spd: stat('spd'),
      appetite: mix('appetite', 0.03, 0.9, 1.1), hardy: mix('hardy', 0.1, 0, 1),
      spirit: U.clamp(Math.round((ga.spirit + gb.spirit) / 2 + rng.int(-1, 1)), -2, 2),
      temper: mix('temper', 0.1, 0, 1)
    };
  }

  /* One learned (non-ultimate) skill may pass down from each parent. */
  function pickInherited(parent, rng) {
    var pool = (parent.skills || []).filter(function (id) {
      var s = PP.Skills.find(parent.species, id); return s && s.tier <= 3;
    });
    return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
  }

  /* A parent reference carries that parent's own parents, so every egg knows its
   * grandparents without needing the album (friends' pals included, when their code has them). */
  function ref(p) { return { id: String(p.id || ''), name: p.name, species: p.species, form: p.form || null, sex: p.sex, gen: p.gen || 1 }; }
  function parentRef(p) {
    var r = ref(p);
    r.parents = (p.parents || []).slice(0, 2).map(function (g) { return g ? ref(g) : null; });
    return r;
  }

  function breed(a, b, seed, now) {
    var chk = canBreed(a, b);
    if (!chk.ok) return { ok: false, msg: chk.reason };
    var rng = U.makeRng(seed >>> 0 || 7);
    var inh = [];
    [a, b].forEach(function (p) {
      var s = pickInherited(p, rng);
      if (s && inh.indexOf(s) < 0) inh.push(s);
    });
    var egg = PP.Pet.createEgg({
      species: a.species, seed: U.hash('egg', seed, a.id, b.id),
      genes: blendGenes(a.genes, b.genes, rng),
      gen: Math.max(a.gen || 1, b.gen || 1) + 1,
      parents: [a, b].map(parentRef),
      inheritedSkills: inh, now: now
    });
    [a, b].forEach(function (p) { if (p.clock != null) p.lastBredClock = p.clock; });
    return { ok: true, egg: egg, msg: 'An egg! Gen ' + egg.gen };
  }

  PP.Breeding = { canBreed: canBreed, breed: breed, blendGenes: blendGenes, parentRef: parentRef };
})(typeof window !== 'undefined' ? window : globalThis);
