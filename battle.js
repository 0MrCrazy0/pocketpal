/* PocketPal - turn-based battle engine (pure, seeded, deterministic).
 *
 * damage = power x 0.45 x scale x ATK/(ATK+DEF) x buffs x (0.9..1.0) x crit 1.5 x passives
 *   buffs = (own ATK buffs) / (target DEF buffs): a +35% ATK buff is +35% damage (1.8.0, from the v1.2 work).
 *   scale = the attacker's growth factor (form multiplier x level growth), so damage
 *   grows with level at the same rate as HP and fights stay ~5-8 turns at every level.
 * Order each turn: priority moves first, then higher SPD, ties by the seeded RNG.
 * Speed: the faster side gets up to +12% dodge / +12% crit, scaled by the speed gap.
 * Healing moves can only be used a limited number of times per battle ("uses").
 * Bleed: 5% max HP per turn. Stun: loses the next action (then 1 turn immune).
 * After 40 turns the higher HP% wins.
 * Run / flee (1.8.4): choiceA = 'flee'. Arena and friend battles: an instant forfeit (a loss).
 * Quick (wild) battles: always escapes when faster, else a 50-75% chance by the speed ratio;
 * a failed escape loses the turn (the foe still acts).
 */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;
  var MAX_TURNS = 40, BLEED_PCT = 0.05, BASE_CRIT = 6;
  var DMG_K = 0.45;
  var SPD_DODGE = 20, SPD_DODGE_CAP = 12, SPD_CRIT = 20, SPD_CRIT_CAP = 12;

  /* card: { name, species, form, level, genes, skills, sex, hunger?, happy?, weight? } */
  function fighter(card, opts) {
    var s = PP.Stats.battleStats(card, opts);
    return {
      name: card.name || 'Pal', species: card.species, form: card.form, level: card.level, sex: card.sex || 'M',
      maxHp: s.hp, hp: s.hp, atk: s.atk, def: s.def, spd: s.spd, bp: PP.Stats.bp(s), scale: PP.Stats.scale(card.form, card.level),
      moves: PP.Skills.moveList(card.species, card.skills), cds: {}, used: {}, passives: s.passives,
      buffs: [], stunned: false, stunGuard: 0, bleed: 0, evade: 0, evadeTurns: 0, skip: false
    };
  }
  function create(cardA, cardB, seed, opts) {
    return {
      seed: seed >>> 0, rng: (seed >>> 0) || 1, turn: 0, over: false, winner: null,
      f: [fighter(cardA, opts && opts.a), fighter(cardB, opts && opts.b)]
    };
  }
  /* Stat multiplier from active buffs / debuffs (1.8.0: ATK and DEF changes act directly on
   * damage, so "ATK +35%" really means 35% more damage and "DEF -25%" 33% more damage taken). */
  function mult(f, stat) {
    var v = 1;
    for (var i = 0; i < f.buffs.length; i++) if (f.buffs[i].stat === stat) v *= f.buffs[i].mult;
    if (stat === 'atk' && f.passives.lowHpAtk && f.hp < f.maxHp * 0.3) v *= 1 + f.passives.lowHpAtk / 100;
    return v;
  }
  /* Effective stat. SPD includes buffs (it decides turn order, dodge and crit); ATK / DEF are the
   * base stats that feed the ATK/(ATK+DEF) ratio - their buffs are applied by dmgMult(). */
  function eff(f, stat) {
    if (stat === 'spd') return f.spd * mult(f, 'spd');
    return f[stat];
  }
  function dmgMult(u, t) { return mult(u, 'atk') / mult(t, 'def'); }
  function available(f) {
    return f.moves.filter(function (m) {
      var mv = D.MOVES[m];
      return !(f.cds[m] > 0) && !(mv.uses && (f.used[m] || 0) >= mv.uses);
    });
  }
  function addBuff(f, key, stat, mult, turns) {
    f.buffs = f.buffs.filter(function (b) { return b.key !== key; });
    f.buffs.push({ key: key, stat: stat, mult: mult, turns: turns });
  }

  function useMove(B, ui, ti, moveId, rng, ev) {
    var u = B.f[ui], t = B.f[ti];
    if (u.hp <= 0 || t.hp <= 0) return;
    if (u.skip) { u.skip = false; ev.push({ t: 'rest', who: ui }); return; }
    if (u.stunned) { u.stunned = false; u.stunGuard = 2; ev.push({ t: 'stunned', who: ui }); return; }
    if (available(u).indexOf(moveId) < 0) moveId = available(u)[0] || u.moves[0];
    var m = D.MOVES[moveId];
    if (m.uses) u.used[moveId] = (u.used[moveId] || 0) + 1;
    ev.push({ t: 'move', who: ui, move: moveId, name: m.name });
    if (m.cd) u.cds[moveId] = m.cd + 1;
    var dealt = 0;
    if (m.power > 0) {
      // speed matters: a faster target dodges more, a faster attacker crits more
      var su = eff(u, 'spd'), st = eff(t, 'spd');
      var spdDodge = st > su ? Math.min(SPD_DODGE_CAP, (st - su) / st * SPD_DODGE) : 0;
      var spdCrit = su > st ? Math.min(SPD_CRIT_CAP, (su - st) / su * SPD_CRIT) : 0;
      var acc = m.acc + (u.passives.accAdd || 0) - ((t.evadeTurns > 0 ? t.evade : 0) * 100 + (t.passives.dodgeAdd || 0) + spdDodge);
      if (rng() * 100 >= acc) { ev.push({ t: 'miss', who: ui }); return; }
      var hits = m.hits ? m.hits[0] + Math.floor(rng() * (m.hits[1] - m.hits[0] + 1)) : 1;
      for (var h = 0; h < hits && t.hp > 0; h++) {
        var A = eff(u, 'atk'), Df = eff(t, 'def');
        var crit = m.crit ? true : rng() * 100 < BASE_CRIT + (u.passives.critAdd || 0) + spdCrit;
        var dmg = m.power * DMG_K * u.scale * A / (A + Df) * dmgMult(u, t) * (0.9 + 0.1 * rng()) * (crit ? 1.5 : 1);
        if (u.passives.fasterDmg && eff(u, 'spd') > eff(t, 'spd')) dmg *= 1 + u.passives.fasterDmg / 100;
        if (t.passives.dmgRed) dmg *= 1 - t.passives.dmgRed / 100;
        if (t.passives.lowHpGuard && t.hp < t.maxHp * 0.5) dmg *= 1 - t.passives.lowHpGuard / 100;
        dmg = Math.max(1, Math.round(dmg));
        t.hp = Math.max(0, t.hp - dmg); dealt += dmg;
        ev.push({ t: 'hit', who: ti, dmg: dmg, crit: crit, hp: t.hp });
      }
      if (t.hp <= 0) { ev.push({ t: 'faint', who: ti }); }
    }
    (m.fx || []).forEach(function (fx) {
      if (fx.t === 'recoil' && dealt > 0) {
        var r = Math.max(1, Math.round(dealt * fx.pct / 100));
        u.hp = Math.max(0, u.hp - r); ev.push({ t: 'recoil', who: ui, dmg: r, hp: u.hp });
        if (u.hp <= 0) ev.push({ t: 'faint', who: ui });
        return;
      }
      if (fx.t === 'heal') {
        var amt = Math.min(u.maxHp - u.hp, Math.round(u.maxHp * fx.pct / 100));
        u.hp += amt; ev.push({ t: 'heal', who: ui, amt: amt, hp: u.hp }); return;
      }
      if (fx.t === 'skip') { u.skip = true; return; }
      if (fx.t === 'buff') { addBuff(u, moveId + fx.stat, fx.stat, fx.mult, fx.turns + 1); ev.push({ t: 'buff', who: ui, stat: fx.stat, up: fx.mult > 1 }); return; }
      if (fx.t === 'evade') { u.evade = fx.add; u.evadeTurns = fx.turns + 1; ev.push({ t: 'evade', who: ui }); return; }
      if (t.hp <= 0) return;
      if (fx.t === 'debuff') { addBuff(t, moveId + fx.stat, fx.stat, fx.mult, fx.turns + 1); ev.push({ t: 'buff', who: ti, stat: fx.stat, up: false }); return; }
      if (fx.t === 'bleed') { if (t.bleed <= 0) ev.push({ t: 'bleedStart', who: ti }); t.bleed = Math.max(t.bleed, fx.turns); return; }
      if (fx.t === 'stun') {
        if (t.passives.stunImmune || t.stunGuard > 0 || t.stunned) return;
        if (rng() < fx.chance) { t.stunned = true; ev.push({ t: 'stun', who: ti }); }
      }
    });
  }

  /* Chance that side 0 escapes a quick battle: 1 when faster, else 0.5 + 0.25 x (own / foe SPD). */
  function fleeChance(B) {
    var s0 = eff(B.f[0], 'spd'), s1 = eff(B.f[1], 'spd');
    return s0 > s1 ? 1 : 0.5 + 0.25 * Math.max(0, Math.min(1, s0 / Math.max(1, s1)));
  }
  function forfeits(B) { var k = B.meta && B.meta.kind; return k === 'arena' || k === 'friend'; }
  function flee(B, choiceB, rng, ev) {
    if (forfeits(B)) {
      ev.push({ t: 'flee', who: 0, ok: true, forfeit: true });
      B.over = true; B.winner = 1; B.fled = 'forfeit';
      ev.push({ t: 'end', winner: 1, fled: 'forfeit' });
      return ev;
    }
    if (rng() < fleeChance(B)) {
      ev.push({ t: 'flee', who: 0, ok: true });
      B.over = true; B.winner = null; B.fled = 'escaped';
      ev.push({ t: 'end', winner: null, fled: 'escaped' });
      return ev;
    }
    ev.push({ t: 'flee', who: 0, ok: false });
    useMove(B, 1, 0, choiceB || chooseAI(B, 1, rng), rng, ev);
    endTurn(B, 1, ev);
    return ev;
  }

  /* Resolve one turn. choiceA/choiceB are move ids (or null = AI picks); choiceA may be 'flee'. */
  function turn(B, choiceA, choiceB) {
    if (B.over) return [];
    var rng = U.makeRng(B.rng), ev = [];
    if (choiceA === 'flee') { flee(B, choiceB, rng, ev); B.rng = rng.state(); return ev; }
    var picks = [choiceA || chooseAI(B, 0, rng), choiceB || chooseAI(B, 1, rng)];
    var pri = [0, 1].map(function (i) { var m = D.MOVES[picks[i]]; return (m && m.pri) || 0; });
    var first;
    if (pri[0] !== pri[1]) first = pri[0] > pri[1] ? 0 : 1;
    else {
      var s0 = eff(B.f[0], 'spd'), s1 = eff(B.f[1], 'spd');
      first = s0 === s1 ? (rng() < 0.5 ? 0 : 1) : (s0 > s1 ? 0 : 1);
    }
    useMove(B, first, 1 - first, picks[first], rng, ev);
    useMove(B, 1 - first, first, picks[1 - first], rng, ev);
    endTurn(B, first, ev);
    B.rng = rng.state();
    return ev;
  }
  function endTurn(B, first, ev) {
    B.f.forEach(function (f, i) {
      if (f.hp > 0 && f.bleed > 0) {
        var d = Math.max(1, Math.round(f.maxHp * BLEED_PCT));
        f.hp = Math.max(0, f.hp - d); f.bleed--;
        ev.push({ t: 'bleed', who: i, dmg: d, hp: f.hp });
        if (f.hp <= 0) ev.push({ t: 'faint', who: i });
      }
      f.buffs.forEach(function (b) { b.turns--; });
      f.buffs = f.buffs.filter(function (b) { return b.turns > 0; });
      if (f.evadeTurns > 0) f.evadeTurns--;
      if (f.stunGuard > 0) f.stunGuard--;
      for (var k in f.cds) if (f.cds[k] > 0) f.cds[k]--;
    });
    B.turn++;
    var a = B.f[0].hp > 0, b = B.f[1].hp > 0;
    if (!a || !b || B.turn >= MAX_TURNS) {
      B.over = true;
      if (a && !b) B.winner = 0;
      else if (b && !a) B.winner = 1;
      else if (!a && !b) B.winner = first === 0 ? 1 : 0; // both fell: whoever acted second landed last
      else {
        var pa = B.f[0].hp / B.f[0].maxHp, pb = B.f[1].hp / B.f[1].maxHp;
        B.winner = pa === pb ? (B.f[0].spd >= B.f[1].spd ? 0 : 1) : (pa > pb ? 0 : 1);
      }
      ev.push({ t: 'end', winner: B.winner, timeout: a && b });
    }
  }

  /* Computer player (1.8.0, from the v1.2 work): every ready move is scored by its EXPECTED VALUE in
   * "foe-HP equivalents" over the turns the fight is likely to last:
   *  - damage now (with accuracy, crits, multi-hits) and a big bonus for a finishing blow;
   *  - buffs / debuffs = the extra damage dealt (or damage avoided) on each remaining turn
   *    they are active, computed from the real damage formula (so a DEF cut is worth more
   *    against a tanky foe, an ATK cut more against a hard hitter);
   *  - heals = HP restored, valued in proportion to how close the pal is to being KO'd;
   *  - stun / bleed / dodge / recoil / resting turns as expected HP swings;
   *  - priority when the pal would otherwise be KO'd before acting.
   * Own HP is converted to foe-HP units by relative max HP, so a heal and a hit compare
   * fairly. A small random factor keeps fights varied. */
  function ratioAD(A, Df) { return A / (A + Df); }
  function expDmg(u, t, m, atkMul, defMul) {
    if (!(m.power > 0)) return 0;
    var hits = m.hits ? (m.hits[0] + m.hits[1]) / 2 : 1;
    var A = eff(u, 'atk'), Df = eff(t, 'def'), bm = dmgMult(u, t) * (atkMul || 1) / (defMul || 1);
    var su = eff(u, 'spd'), st = eff(t, 'spd');
    var dodge = (st > su ? Math.min(SPD_DODGE_CAP, (st - su) / st * SPD_DODGE) : 0) + (t.evadeTurns > 0 ? t.evade * 100 : 0) + (t.passives.dodgeAdd || 0);
    var acc = Math.max(5, Math.min(100, m.acc + (u.passives.accAdd || 0) - dodge)) / 100;
    var critP = m.crit ? 1 : Math.min(1, (BASE_CRIT + (u.passives.critAdd || 0) + (su > st ? Math.min(SPD_CRIT_CAP, (su - st) / su * SPD_CRIT) : 0)) / 100);
    var k = 1;
    if (u.passives.fasterDmg && su > st) k *= 1 + u.passives.fasterDmg / 100;
    if (t.passives.dmgRed) k *= 1 - t.passives.dmgRed / 100;
    if (t.passives.lowHpGuard && t.hp < t.maxHp * 0.5) k *= 1 - t.passives.lowHpGuard / 100;
    return m.power * DMG_K * u.scale * ratioAD(A, Df) * bm * 0.95 * hits * acc * (1 + 0.5 * critP) * k;
  }
  /* average damage per turn a side can expect from its move set (cooldowns ignored, ~ mix of best moves) */
  function perTurn(u, t) {
    var list = u.moves.map(function (id) { return expDmg(u, t, D.MOVES[id]); }).sort(function (a, b) { return b - a; });
    var best = list[0] || 1, second = list[1] || best * 0.7;
    return Math.max(1, best * 0.55 + second * 0.45);
  }
  function hasBuff(f, key) { var b = f.buffs.filter(function (x) { return x.key === key; })[0]; return b ? b.turns - 1 : 0; }
  function evMove(B, i, id, ctx) {
    var u = B.f[i], t = B.f[1 - i], m = D.MOVES[id];
    var ours = ctx.ours, theirs = ctx.theirs, left = ctx.left, hpK = t.maxHp / u.maxHp;
    var v = expDmg(u, t, m);
    if (m.power > 0 && v >= t.hp) v += 1000 + m.acc;                           // finishing blow (prefer the surest)
    var future = Math.max(0, left - 1);                                        // turns after this one
    (m.fx || []).forEach(function (fx) {
      var n = Math.min(fx.turns || 0, future), key = id + fx.stat;
      if (fx.t === 'buff') {
        var had = Math.min(hasBuff(u, key), future); n = Math.max(0, n - had);   // refreshing only adds the missing turns
        if (fx.stat === 'atk') v += ours * (fx.mult - 1) * n;
        else if (fx.stat === 'def') v += theirs * (1 - 1 / fx.mult) * n * hpK;
        else if (fx.stat === 'spd') v += (ours + theirs * hpK) * (fx.mult - 1) * 0.35 * n;
      } else if (fx.t === 'debuff') {
        if (t.hp <= v) return;
        var had2 = Math.min(hasBuff(t, key), future); n = Math.max(0, n - had2);
        if (fx.stat === 'def') v += ours * (1 / fx.mult - 1) * n;
        else if (fx.stat === 'atk') v += theirs * (1 - fx.mult) * n * hpK;
        else if (fx.stat === 'spd') v += (theirs * hpK + ours) * (1 - fx.mult) * 0.35 * n;
      } else if (fx.t === 'heal') {
        var amt = Math.min(u.maxHp - u.hp, u.maxHp * fx.pct / 100);
        var danger = Math.min(1.6, theirs * 2 / Math.max(1, u.hp));             // near KO: healing buys whole turns
        v += amt < u.maxHp * 0.12 ? -1000 : amt * hpK * (0.45 + danger);
      } else if (fx.t === 'skip') v -= ours;
      else if (fx.t === 'evade') v += u.evadeTurns > 0 ? -ours : theirs * hpK * fx.add * Math.min(fx.turns, left);
      else if (fx.t === 'stun') { if (!(t.passives.stunImmune || t.stunGuard > 0 || t.stunned) && t.hp > v) v += fx.chance * (m.acc / 100) * theirs * hpK * 1.1; }
      else if (fx.t === 'bleed') { if (t.hp > v) v += t.maxHp * BLEED_PCT * Math.max(0, Math.min(fx.turns, left) - Math.max(0, t.bleed)) * 0.9; }
      else if (fx.t === 'recoil') v -= expDmg(u, t, m) * fx.pct / 100 * hpK * (u.hp < u.maxHp * 0.25 ? 3 : 1);
    });
    if (m.pri && m.power > 0 && ctx.slower && u.hp <= theirs * 1.1 && expDmg(u, t, m) >= t.hp * 0.8) v += 500;   // strike first before being KO'd
    return v;
  }
  function chooseAI(B, i, rng) {
    var u = B.f[i], t = B.f[1 - i];
    var avail = available(u);
    var ours = perTurn(u, t), theirs = perTurn(t, u);
    var left = Math.max(1, Math.min(8, Math.ceil(Math.min(t.hp / ours, u.hp / theirs))));   // turns the fight is likely to last
    var ctx = { ours: ours, theirs: theirs, left: left, slower: eff(u, 'spd') < eff(t, 'spd') };
    var best = null, bestScore = -1e9;
    avail.forEach(function (id) {
      var s = evMove(B, i, id, ctx);
      s *= 0.9 + 0.2 * rng();
      if (s > bestScore) { bestScore = s; best = id; }
    });
    return best || u.moves[0];
  }

  /* Run a whole battle with both sides on AI (tests, balance, quick-sim). */
  function simulate(cardA, cardB, seed, opts) {
    var B = create(cardA, cardB, seed, opts), all = [];
    while (!B.over) all = all.concat(turn(B, null, null));
    return { winner: B.winner, turns: B.turn, log: all, battle: B };
  }

  PP.Battle = { create: create, turn: turn, chooseAI: chooseAI, evMove: evMove, expDmg: expDmg, mult: mult, simulate: simulate, fighter: fighter, available: available, eff: eff, fleeChance: fleeChance, forfeits: forfeits, MAX_TURNS: MAX_TURNS };
})(typeof window !== 'undefined' ? window : globalThis);
