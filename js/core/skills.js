/* PocketPal 2 - skill trees (pure). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var D = PP.DATA;

  function tree(species) { return D.SKILLS[species] || []; }
  function find(species, id) {
    var t = tree(species);
    for (var i = 0; i < t.length; i++) if (t[i].id === id) return t[i];
    return null;
  }
  /* Why a skill cannot be learned right now (or null if it can). */
  function blockReason(p, id) {
    var s = find(p.species, id);
    if (!s) return 'Unknown skill';
    if (p.stage !== 'adult') return 'Adults only';
    if ((p.skills || []).indexOf(id) >= 0) return 'Already learned';
    if (p.level < s.level) return 'Needs Lv ' + s.level;
    if (s.req.length && !s.req.some(function (r) { return p.skills.indexOf(r) >= 0; })) {
      return 'Learn ' + s.req.map(function (r) { return find(p.species, r).name; }).join(' or ') + ' first';
    }
    if ((p.sp || 0) < s.cost) return 'Needs ' + s.cost + ' SP';
    return null;
  }
  function canLearn(p, id) { return blockReason(p, id) === null; }
  function learn(p, id) {
    var why = blockReason(p, id);
    if (why) return { ok: false, msg: why };
    var s = find(p.species, id);
    p.sp -= s.cost;
    p.skills.push(id);
    return { ok: true, msg: 'Learned ' + s.name + '!' };
  }
  /* Battle move list: species moves first, then learned move-skills (max 8 = whole tree). */
  function moveList(species, skills) {
    var m = D.SPECIES_INFO[species].moves.slice();
    (skills || []).forEach(function (id) {
      var s = find(species, id);
      if (s && s.kind === 'move' && m.indexOf(s.move) < 0) m.push(s.move);
    });
    return m.slice(0, 8);
  }
  /* Validate a skill list for a given level (used for battle codes and saves). */
  function validSet(species, level, skills, innate) {
    if (!Array.isArray(skills)) return false;
    var have = [], spent = 0;
    innate = Array.isArray(innate) ? innate : [];
    if (innate.length > 2) return false;
    for (var n = 0; n < innate.length; n++) {
      var si = find(species, innate[n]);
      if (!si || si.tier > 3 || skills.indexOf(innate[n]) < 0 || have.indexOf(si.id) >= 0) return false;
      have.push(si.id);
    }
    // order by tier so prerequisites can be checked
    var list = skills.filter(function (id) { return innate.indexOf(id) < 0; }).map(function (id) { return find(species, id); });
    if (list.some(function (s) { return !s; })) return false;
    list.sort(function (a, b) { return a.tier - b.tier; });
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (have.indexOf(s.id) >= 0) return false;
      if (level < s.level) return false;
      if (s.req.length && !s.req.some(function (r) { return have.indexOf(r) >= 0; })) return false;
      have.push(s.id); spent += s.cost;
    }
    return spent <= PP.Stats.totalSpForLevel(level);
  }
  /* Computer players / test mode: spend all SP following a sensible plan. */
  function autoLearn(p, rng) {
    var t = tree(p.species).slice().sort(function (a, b) { return a.tier - b.tier || (rng ? rng() - 0.5 : 0); });
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < t.length; i++) {
        if (canLearn(p, t[i].id)) { learn(p, t[i].id); changed = true; break; }
      }
    }
  }

  PP.Skills = { tree: tree, find: find, blockReason: blockReason, canLearn: canLearn, learn: learn, moveList: moveList, validSet: validSet, autoLearn: autoLearn };
})(typeof window !== 'undefined' ? window : globalThis);
