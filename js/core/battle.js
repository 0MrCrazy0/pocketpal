/* PocketPal 2 - turn-based battle engine (pure, seeded, deterministic).
 *
 * damage = power x 0.45 x scale x ATK/(ATK+DEF) x (0.9..1.0) x crit 1.5 x passives
 *   scale = the attacker's growth factor (form multiplier x level growth), so damage
 *   grows with level at the same rate as HP and fights stay ~5-8 turns at every level.
 * Order each turn: priority moves first, then higher SPD, ties by the seeded RNG.
 * Speed: the faster side gets up to +12% dodge / +12% crit, scaled by the speed gap.
 * Healing moves can only be used a limited number of times per battle ("uses").
 * Bleed: 5% max HP per turn. Stun: loses the next action (then 1 turn immune).
 * After 40 turns the higher HP% wins.
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
  function eff(f, stat) {
    var v = f[stat];
    for (var i = 0; i < f.buffs.length; i++) if (f.buffs[i].stat === stat) v *= f.buffs[i].mult;
    if (stat === 'atk' && f.passives.lowHpAtk && f.hp < f.maxHp * 0.3) v *= 1 + f.passives.lowHpAtk / 100;
    return v;
  }
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
        var dmg = m.power * DMG_K * u.scale * A / (A + Df) * (0.9 + 0.1 * rng()) * (crit ? 1.5 : 1);
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

  /* Resolve one turn. choiceA/choiceB are move ids (or null = AI picks). */
  function turn(B, choiceA, choiceB) {
    if (B.over) return [];
    var rng = U.makeRng(B.rng), ev = [];
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
    // end of turn
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
    B.rng = rng.state();
    return ev;
  }

  /* Heuristic computer player: scores each ready move in "HP-damage equivalents". */
  function expDmg(u, t, m) {
    if (!(m.power > 0)) return 0;
    var hits = m.hits ? (m.hits[0] + m.hits[1]) / 2 : 1;
    return m.power * DMG_K * u.scale * eff(u, 'atk') / (eff(u, 'atk') + eff(t, 'def')) * 0.95 * hits * (m.acc / 100) * (m.crit ? 1.5 : 1.06);
  }
  function chooseAI(B, i, rng) {
    var u = B.f[i], t = B.f[1 - i];
    var avail = available(u);
    var bestDmg = 1;
    avail.forEach(function (id) { bestDmg = Math.max(bestDmg, expDmg(u, t, D.MOVES[id])); });
    var best = null, bestScore = -1e9;
    avail.forEach(function (id) {
      var m = D.MOVES[id], s = expDmg(u, t, m);
      if (s >= t.hp) s += 1000;                         // finishing blow
      (m.fx || []).forEach(function (fx) {
        var has = function (f, k) { return f.buffs.some(function (b) { return b.key === k; }); };
        if (fx.t === 'heal') s += u.hp < u.maxHp * 0.5 ? Math.min(u.maxHp - u.hp, u.maxHp * fx.pct / 100) * 1.1 : -1000;
        if (fx.t === 'skip') s -= bestDmg * 0.8;
        if (fx.t === 'buff') s += (has(u, id + fx.stat) || u.hp < u.maxHp * 0.35) ? -bestDmg : (fx.mult > 1 ? bestDmg * (fx.mult - 1) * (m.power > 0 ? 2.6 : 1.55) : -bestDmg * (1 - fx.mult) * 1.5);
        if (fx.t === 'debuff') s += has(t, id + fx.stat) ? 0 : bestDmg * (1 - fx.mult) * (fx.stat === 'def' ? 2.4 : 1.8);
        if (fx.t === 'evade') s += u.evadeTurns > 0 ? -bestDmg : bestDmg * fx.add * 2;
        if (fx.t === 'stun') s += t.passives.stunImmune || t.stunGuard > 0 ? 0 : fx.chance * bestDmg;
        if (fx.t === 'bleed') s += t.bleed > 0 ? 0 : t.maxHp * BLEED_PCT * fx.turns * 0.7;
        if (fx.t === 'recoil') s -= u.hp < u.maxHp * 0.2 ? bestDmg : bestDmg * 0.1;
      });
      s *= 0.88 + 0.24 * rng();
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

  PP.Battle = { create: create, turn: turn, chooseAI: chooseAI, simulate: simulate, fighter: fighter, available: available, eff: eff, MAX_TURNS: MAX_TURNS };
})(typeof window !== 'undefined' ? window : globalThis);
