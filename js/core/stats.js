/* PocketPal - battle stats, levels, XP (pure).
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
    if (form === 'secret' && D.SECRET[species]) {          // 1.9.7: the secret form's stat spread
      var t = D.SECRET[species].tilt, bb = Object.assign({}, b), up = null;
      for (var k in t) { bb[k] += t[k]; if (t[k] > 0) up = k; }
      var s = statsFrom(bb, f, level, genes), c = statsFrom(b, D.FORM_INFO.perfect, level, genes);
      while (up && bp(s) > bp(c) && s[up] > 1) s[up]--;   // rounding can never lift it above the Champion
      return s;
    }
    if (D.STYLE && D.STYLE.tilt[form]) {                    // 2.4.0: a style form's spread - never more BP than the Solid form
      var tt = D.STYLE.tilt[form], b2 = Object.assign({}, b), top = null;
      for (var k2 in tt) { b2[k2] += tt[k2]; if (tt[k2] > 0) top = k2; }
      var s2 = statsFrom(b2, f, level, genes), c2 = statsFrom(b, D.FORM_INFO.good, level, genes);
      while (top && bp(s2) > bp(c2) && s2[top] > 1) s2[top]--;
      return s2;
    }
    return statsFrom(b, f, level, genes);
  }
  function statsFrom(b, f, level, genes) {
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
    // 2.6.0: children and teens lose less (-8%): with tiny junior stats -15% turned a fair fight into a 1-in-20 win
    if (p.hunger <= 0 || p.happy <= 0) { var pen = isJunior(p) ? 8 : 15; c.all = 1 - pen / 100; c.notes.push((p.hunger <= 0 ? 'Hungry -' : 'Unhappy -') + pen + '%'); }
    if (PP.Care.isOverweight(p)) { c.spd = 0.9; c.notes.push('Heavy: SPD -10%'); }
    if (PP.Care.isUnderweight(p)) { c.hp = 0.9; c.notes.push('Skinny: HP -10%'); }
    var nm = recentAdultMistakes(p), wk = D.RULES.adultCare.weak.filter(function (r) { return nm >= r[0]; })[0];   // 2.6.0 adult neglect
    if (wk) { c.all *= wk[1]; c.notes.push('Neglected (' + nm + ' care mistakes in 3 days) -' + Math.round((1 - wk[1]) * 100) + '%'); }
    return c;
  }
  /* Final battle stats for a pet-like object {species, form, level, genes, skills} */
  function isJunior(p) { return !!(p && D.JUNIOR && D.JUNIOR.stages.indexOf(p.stage) >= 0); }
  /* 2.4.92: a child / teen fights with the Solid adult's level-1 stats scaled down by stage (no skills, no boosts) */
  /* 2.6.0 adult care: mistakes made as an adult (lifetime total minus the young ones) and those of the last 3 pet-days */
  function adultMistakes(p) { return p && p.stage === 'adult' ? Math.max(0, (p.totalMistakes || 0) - (p.mistakes || 0)) : 0; }
  function recentAdultMistakes(p) {
    if (!p || p.stage !== 'adult' || p.legend === true || !Array.isArray(p.mistakeAt)) return 0;   // 2.6.1: a Legend is never 'Neglected'
    var now = p.lastTickAt || 0, win = D.RULES.adultCare.recentMin * 60000;
    return Math.min(adultMistakes(p), p.mistakeAt.filter(function (t) { return t > 0 && now - t < win; }).length);
  }
  /* 2.6.0 STRENGTH: 0..cap points -> +0..maxBonus HP / ATK / DEF for a child or teen (not ladder foes) */
  function strBonus(p) { var S = D.JUNIOR.str; return p && !p.cpu ? Math.min(1, Math.max(0, (p.str || 0) / S.cap)) * S.maxBonus : 0; }
  function juniorStats(p) {
    var r = rawStats(p.species, 'good', 1, p.genes), k = D.JUNIOR.scale[p.stage] * (p.cpu && p.jpow > 0 ? Math.min(1.3, p.jpow) : 1);   // 2.4.94: ladder foes (cpu) are a notch stronger per rung
    var b = 1 + strBonus(p);
    return { hp: Math.max(1, Math.floor(r.hp * k * b)), atk: Math.max(1, Math.floor(r.atk * k * b)), def: Math.max(1, Math.floor(r.def * k * b)), spd: Math.max(1, Math.floor(r.spd * k)) };
  }
  function battleStats(p, opts) {
    if (isJunior(p)) {
      var jr = juniorStats(p), jc = (opts && opts.noCondition) ? condition(null) : condition(p);
      return { hp: Math.max(1, Math.round(jr.hp * jc.all * jc.hp)), atk: Math.max(1, Math.round(jr.atk * jc.all)), def: Math.max(1, Math.round(jr.def * jc.all)),
        spd: Math.max(1, Math.round(jr.spd * jc.all * jc.spd)), passives: passives(p.species, []), notes: jc.notes };
    }
    var r = rawStats(p.species, p.form, p.level, p.genes);
    var ps = passives(p.species, p.skills);
    var c = (opts && opts.noCondition) ? condition(null) : condition(p);
    var b = PP.Shop ? PP.Shop.boostPct(p) : { hp: 0, atk: 0, def: 0, spd: 0 };   // Pal Store boosts: max +4%/stat, 4 items total
    return {
      hp: Math.max(1, Math.round(r.hp * (1 + (ps.hpPct + b.hp + (PP.Traits ? PP.Traits.hpPct(p) : 0)) / 100) * c.all * c.hp)),   // 2.4.97: + Battle-Hardened
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

  PP.Stats = { adultMistakes: adultMistakes, recentAdultMistakes: recentAdultMistakes, strBonus: strBonus, levelCap: levelCap, rawStats: rawStats, passives: passives, condition: condition,
    battleStats: battleStats, isJunior: isJunior, juniorStats: juniorStats, bp: bp, scale: scale, addXp: addXp, totalSpForLevel: totalSpForLevel };
})(typeof window !== 'undefined' ? window : globalThis);
