/* PocketPal - battle traits (2.4.97, pure).
 * A pal earns a trait by what it does in real battles (not practice Quick battles) as an adult, and holds at most MAX.
 * Each one is small (3-5 %). They ride in the battle code ("t", optional, validated here and on the worker), so both
 * games of a live room build the same battle; a pal's young are born with its traits marked "inherited".
 *   Battle-Hardened  10 battle wins                      -> +3 % HP
 *   Comeback Kid     win a battle on 25 % HP or less      -> +5 % dodge while under 25 % HP
 *   Rival Spirit     beat the same friend's pal 3 times   -> +3 % damage against THAT pal only (not inherited)
 * (2.4.97 balance sims, best of 3 between two otherwise identical pals: +3 % HP wins ~57 %, Comeback ~52 %, Rival ~57 %
 *  against that pal, all three ~70 % - less than being one level ahead (~80 %). Best of 3 magnifies any edge.)
 *   Humble           lose 5 battles in a row              -> +5 % training XP
 * Stored on the pal: p.traits = [{ id, at (pal clock), inh (inherited), vs / vsName (rival only) }], p.tstat = counters. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var MAX = 3, INHERIT_MAX = 2, ID_RE = /^[a-z0-9]{4,16}$/;
  var DEFS = {
    hardened: { name: 'Battle-Hardened', short: '+3% HP', how: 'Win 10 battles', hpPct: 3 },
    comeback: { name: 'Comeback Kid', short: '+5% dodge when nearly knocked out', how: 'Win a battle with 25% HP or less left', lowHpDodge: 5, lowHp: 0.25 },
    rival:    { name: 'Rival Spirit', short: '+3% damage against that friend', how: 'Beat the same friend\u2019s pal 3 times', rivalDmg: 3 },
    humble:   { name: 'Humble', short: '+5% training XP', how: 'Lose 5 battles in a row', trainPct: 5 }
  };
  var ORDER = ['hardened', 'comeback', 'rival', 'humble'];
  var NEED = { wins: 10, rivalWins: 3, lossRun: 5 };

  function list(p) { return p && Array.isArray(p.traits) ? p.traits : []; }
  function has(p, id) { return ids(p).some(function (t) { return t === id || t.indexOf(id + '.') === 0; }); }
  /* the wire / battle form: ['hardened', 'rival.<pal id>', ...] - from a pal (objects) or a card (strings) */
  function ids(x) {
    if (!x || !Array.isArray(x.traits)) return [];
    return x.traits.map(function (t) { return typeof t === 'string' ? t : t && t.id === 'rival' ? 'rival.' + t.vs : t && t.id; }).filter(valid1);
  }
  function valid1(s) {
    if (typeof s !== 'string') return false;
    var m = /^([a-z]+)(?:\.([a-z0-9]{4,16}))?$/.exec(s);
    return !!m && !!DEFS[m[1]] && (m[1] === 'rival') === !!m[2];
  }
  /* a card's trait list: at most MAX, all known, no duplicates, one rival at most. Returns null if impossible. */
  function cleanIds(a) {
    if (a == null) return [];
    if (!Array.isArray(a) || a.length > MAX || !a.every(valid1)) return null;
    var base = a.map(function (s) { return s.split('.')[0]; });
    if (base.some(function (b, i) { return base.indexOf(b) !== i; })) return null;
    return a.slice();
  }
  function cleanPal(p) {
    var out = [], seen = {};
    (Array.isArray(p.traits) ? p.traits : []).forEach(function (t) {
      if (!t || typeof t !== 'object' || !DEFS[t.id] || seen[t.id] || out.length >= MAX) return;
      if (t.id === 'rival' && !(typeof t.vs === 'string' && ID_RE.test(t.vs))) return;
      var o = { id: t.id, at: Number.isFinite(t.at) ? Math.round(t.at) : 0 };
      if (t.inh) o.inh = true;
      if (t.id === 'rival') { o.vs = t.vs; o.vsName = typeof t.vsName === 'string' ? t.vsName.replace(/[^A-Za-z0-9 '\-]/g, '').slice(0, 12) : 'a friend'; }
      seen[t.id] = true; out.push(o);
    });
    var s = p.tstat && typeof p.tstat === 'object' ? p.tstat : {}, rv = {};
    if (s.rv && typeof s.rv === 'object') Object.keys(s.rv).slice(0, 20).forEach(function (k) { if (ID_RE.test(k) && Number.isInteger(s.rv[k]) && s.rv[k] > 0) rv[k] = Math.min(99, s.rv[k]); });
    return { traits: out, tstat: { lr: Number.isInteger(s.lr) && s.lr > 0 ? Math.min(999, s.lr) : 0, rv: rv } };
  }

  /* ---- battle effects (read from a pal or a card; adults only) ---- */
  function hpPct(x) { return has(x, 'hardened') ? DEFS.hardened.hpPct : 0; }
  function lowHpDodge(x) { return has(x, 'comeback') ? DEFS.comeback.lowHpDodge : 0; }
  function rivalVs(x) { var r = ids(x).filter(function (s) { return s.indexOf('rival.') === 0; })[0]; return r ? r.slice(6) : null; }
  function trainXp(p, xp) { return has(p, 'humble') ? Math.round(xp * (1 + DEFS.humble.trainPct / 100)) : xp; }

  /* ---- earning: call after a real (non-practice) adult battle with a result. Returns the new trait or null. ---- */
  function add(p, t) {
    if (list(p).length >= MAX || list(p).some(function (o) { return o.id === t.id; })) return null;
    p.traits = list(p).concat([t]);
    return t;
  }
  function afterBattle(p, B, won) {
    if (!p || p.stage !== 'adult' || !B || B.fled) return null;
    var c = cleanPal(p); p.traits = c.traits; p.tstat = c.tstat;
    var S = p.tstat, got = null, opp = B.opp || {};
    if (won) {
      S.lr = 0;
      if (B.meta && B.meta.kind === 'friend' && typeof opp.id === 'string' && ID_RE.test(opp.id)) {
        S.rv[opp.id] = (S.rv[opp.id] || 0) + 1;
        var keys = Object.keys(S.rv); if (keys.length > 20) delete S.rv[keys[0]];
        if (S.rv[opp.id] >= NEED.rivalWins) got = got || add(p, { id: 'rival', at: p.clock, vs: opp.id, vsName: String(opp.name || 'a friend').replace(/[^A-Za-z0-9 '\-]/g, '').slice(0, 12) });
      }
      var me = B.f && B.f[0];
      if (me && me.maxHp > 0 && me.hp > 0 && me.hp <= me.maxHp * DEFS.comeback.lowHp) got = got || add(p, { id: 'comeback', at: p.clock });
      if ((p.wins | 0) >= NEED.wins) got = got || add(p, { id: 'hardened', at: p.clock });
    } else {
      S.lr = (S.lr | 0) + 1;
      if (S.lr >= NEED.lossRun) got = got || add(p, { id: 'humble', at: p.clock });
    }
    return got;
  }
  /* a new egg's traits from its parents (pals or friend cards): their non-rival traits, parent A first, at most INHERIT_MAX */
  function inherit(a, b) {
    var out = [];
    [a, b].forEach(function (par) {
      ids(par).forEach(function (s) {
        var id = s.split('.')[0];
        if (id === 'rival' || out.length >= INHERIT_MAX || out.some(function (o) { return o.id === id; })) return;
        out.push({ id: id, at: 0, inh: true });
      });
    });
    return out;
  }
  function label(t) { var d = DEFS[t.id]; return d ? d.name + (t.id === 'rival' && t.vsName ? ' (vs ' + t.vsName + ')' : '') : ''; }

  PP.Traits = { MAX: MAX, INHERIT_MAX: INHERIT_MAX, DEFS: DEFS, ORDER: ORDER, NEED: NEED, list: list, has: has, ids: ids, cleanIds: cleanIds, cleanPal: cleanPal,
    hpPct: hpPct, lowHpDodge: lowHpDodge, rivalVs: rivalVs, trainXp: trainXp, afterBattle: afterBattle, inherit: inherit, label: label };
})(typeof window !== 'undefined' ? window : globalThis);
