/* PocketPal 2 - battle stats, levels, XP (pure).
 *
 * stat(L) = floor( base x formMult x (1 + growth x (L-1)) + gene x (1 + (L-1)/10) )
 *   (HP grows at 1.35 x growth and uses gene x 3). Then passive skills (+%) and condition modifiers apply.
 * BP (Battle Power) = round( (HP/4 + ATK + DEF + SPD) x 4 ).
 */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;

  var HP_GROWTH = 1.35; // HP grows 35% faster than other stats so high-level fights last longer
  function levelCap(form) { return (D.FORM_INFO[form] || D.FORM_INFO.good).cap; }

  function rawStats(species, form, level, genes) {
    var b = D.SPECIES_INFO[species].base, f = D.FORM_INFO[form] || D.FORM_INFO.good;
    var g = genes || { hp: 0, atk: 0, def: 0, spd: 0 };
    var L = U.clamp(level | 0, 1, f.cap);
    var grow = 1 + f.growth * (L - 1), hpGrow = 1 + f.growth * HP_GROWTH * (L - 1), gl = 1 + (L - 1) / 10;
    return {
      hp: Math.floor(b.hp * f.mult * hpGrow + g.hp * 3 * gl),
      atk: Math.floor(b.atk * f.mult * grow + g.atk * gl),
      def: Math.floor(b.def * f.mult * grow + g.def * gl),
      spd: Math.floor(b.spd * f.mult * grow + g.spd * gl)
    };
  }
  function passives(species, skills) {
    var out = { hpPct: 0, atkPct: 0, defPct: 0, spdPct: 0, critAdd: 0, accAdd: 0, dodgeAdd: 0, lowHpGuard: 0, lowHpAtk: 0, stunImmune: 0, dmgRed: 0, fasterDmg: 0 };
    (skills || []).forEach(function (id) {
      var s = PP.Skills.find(species, id);
      if (s && s.kind === 'passive') for (var k in s.passive) out[k] = (out[k] || 0) + s.passive[k];
    });
    return out;
  }
  /* Condition from care: hungry/unhappy -15% all, overweight -10% SPD, underweight -10% HP. */
  function condition(p) {
    var c = { all: 1, spd: 1, hp: 1, notes: [] };
    if (!p || p.hunger == null) return c;
    if (p.hunger <= 0 || p.happy <= 0) { c.all = 0.85; c.notes.push(p.hunger <= 0 ? 'Hungry -15%' : 'Unhappy -15%'); }
    if (PP.Care.isOverweight(p)) { c.spd = 0.9; c.notes.push('Heavy: SPD -10%'); }
    if (PP.Care.isUnderweight(p)) { c.hp = 0.9; c.notes.push('Skinny: HP -10%'); }
    return c;
  }
  /* Final battle stats for a pet-like object {species, form, level, genes, skills} */
  function battleStats(p, opts) {
    var r = rawStats(p.species, p.form, p.level, p.genes);
    var ps = passives(p.species, p.skills);
    var c = (opts && opts.noCondition) ? condition(null) : condition(p);
    var b = PP.Shop ? PP.Shop.boostPct(p) : { hp: 0, atk: 0, def: 0, spd: 0 };   // Pal Store boosts: max +4%/stat, 4 items total
    return {
      hp: Math.max(1, Math.round(r.hp * (1 + (ps.hpPct + b.hp) / 100) * c.all * c.hp)),
      atk: Math.max(1, Math.round(r.atk * (1 + (ps.atkPct + b.atk) / 100) * c.all)),
      def: Math.max(1, Math.round(r.def * (1 + (ps.defPct + b.def) / 100) * c.all)),
      spd: Math.max(1, Math.round(r.spd * (1 + (ps.spdPct + b.spd) / 100) * c.all * c.spd)),
      passives: ps, notes: c.notes
    };
  }
  function scale(form, level) {
    var f = D.FORM_INFO[form] || D.FORM_INFO.good;
    return f.mult * (1 + f.growth * (U.clamp(level | 0, 1, f.cap) - 1));
  }
  function bp(s) { return Math.round((s.hp / 4 + s.atk + s.def + s.spd) * 4); }

  /* Adds XP, handles level-ups (+1 skill point each). Returns number of levels gained. */
  function addXp(p, xp) {
    if (p.stage !== 'adult') return 0;
    var cap = levelCap(p.form), gained = 0;
    if (p.level >= cap) { p.xp = 0; return 0; }
    p.xp += Math.max(0, Math.round(xp));
    while (p.level < cap && p.xp >= D.LEVEL.xpNeed(p.level)) {
      p.xp -= D.LEVEL.xpNeed(p.level);
      p.level++; p.sp++; gained++;
    }
    if (p.level >= cap) p.xp = 0;
    return gained;
  }
  /* Skill points a pet of this level can have earned in total (1 at adulthood + 1 per level). */
  function totalSpForLevel(level) { return 1 + (level - 1); }

  PP.Stats = { levelCap: levelCap, rawStats: rawStats, passives: passives, condition: condition,
    battleStats: battleStats, bp: bp, scale: scale, addXp: addXp, totalSpForLevel: totalSpForLevel };
})(typeof window !== 'undefined' ? window : globalThis);
