/* PocketPal - growth & evolution (pure). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;

  /* Care score used when a teen becomes an adult:
   *   100 - 5 x mistakes + 10 x (average mood - 2.5) + 0.25 x (discipline - 50)
   *   + trainings (max 12) + spirit gene (-2..+2)
   * average mood = mean of (hunger + happy) / 2 hearts over every awake minute since hatching. */
  function careScore(p) {
    var mood = p.evo && p.evo.moodN ? p.evo.moodSum / p.evo.moodN : 2.5;
    var s = 100 - D.EVO.mistakePenalty * p.mistakes + 10 * (mood - 2.5) + 0.25 * (p.discipline - 50) +
      Math.min(12, (p.evo && p.evo.trainings) || 0) + ((p.genes && p.genes.spirit) || 0);
    return Math.round(s * 10) / 10;
  }
  /* 1.9.7: the species' secret condition (on top of Champion care). Deterministic: only
   * fields saved on the pal itself are read, so the same save always gives the same form. */
  function secretMet(p, score) {
    var S = D.SECRET[p.species]; if (!S) return false;
    var ok = function (f) { return f === 'perfect' || f === 'secret'; };
    switch (S.rule) {
      case 'hard': return !!p.hard;
      case 'myth': return !!p.myth;
      case 'streak': return ((p.evo && p.evo.best) || 0) >= S.days;
      case 'gen': return (p.gen || 1) >= S.gen;
      case 'parents': return !!(p.parents && p.parents.length === 2 && p.parents.every(function (q) { return q && ok(q.form); }));
      case 'flawless': return (p.totalMistakes || 0) === 0 && p.discipline >= S.discipline && (score == null ? careScore(p) : score) >= S.score;
    }
    return false;
  }
  function championMet(p, s) { var E = D.EVO; return p.mistakes <= E.perfect.maxMistakes && s >= E.perfect.minScore && p.discipline >= E.perfect.minDiscipline; }
  /* 2.4.0: style points of a child / teen -> { power, swift, guard, total, lead, why }. lead = the style form it would
   * take with good care (null = balanced / too little training = the classic Solid form). Deterministic (saved fields only). */
  function style(p) {
    var S = D.STYLE, e = (p && p.evo) || {}, v = e.sty || {};
    var o = { power: U.int(v.power, 0, 0), swift: U.int(v.swift, 0, 0), guard: U.int(v.guard, 0, 0) };
    var played = o.power + o.swift + o.guard;
    o.calm = !!p && (p.discipline || 0) >= S.guardDisc && (p.mistakes || 0) <= S.guardMistakes && played > 0;
    if (o.calm) o.guard += Math.round(played * S.guardCare);       // a very well-behaved youth leans Sturdy
    o.total = o.power + o.swift + o.guard;
    var rank = D.STYLE_FORMS.slice().sort(function (a, b) { return o[b] - o[a] || D.STYLE_FORMS.indexOf(a) - D.STYLE_FORMS.indexOf(b); });
    var top = rank[0], second = o[rank[1]];
    o.lead = o[top] >= S.minPts && o[top] >= S.minShare * o.total && o[top] - second >= S.minLead ? top : null;
    o.top = o.total ? top : null;
    return o;
  }
  function adultForm(p) {
    var s = careScore(p), E = D.EVO;
    if (championMet(p, s) && secretMet(p, s)) return 'secret';
    if (championMet(p, s)) return 'perfect';
    if (s >= E.good.minScore) return style(p).lead || 'good';
    return 'bad';
  }
  /* 2.4.0: one plain-English line for Status: what the young pal's life is pointing to (never names the secret). */
  function hint(p) {
    if (!p || p.stage === 'adult' || p.stage === 'egg' || p.fate) return null;
    var f = forecast(p), st = style(p), lab = function (k) { return D.FORM_INFO[k].label; };
    if (f === 'bad') return 'Care is slipping: fewer mistakes and more love lead to a stronger adult.';
    if (f === 'perfect') return 'Champion care! Keep mistakes at 2 or fewer and discipline at 50%+.';
    if (D.STYLE_FORMS.indexOf(f) >= 0) return 'Good care + ' + (f === 'power' ? 'lots of Power Training' : f === 'swift' ? 'lots of Memory' : st.calm ? 'great manners' : 'lots of Match') + ' = leaning ' + lab(f) + '.';
    if (!st.total) return 'Good care. Power Training, Memory or Match can shape its adult form.';
    return 'Good care, balanced training = ' + lab('good') + '. Train one way more to lean ' + lab(st.top) + '.';
  }
  /* What the pal is currently on track for (shown as a hint in Status). */
  function forecast(p) {
    if (p.stage === 'adult' || p.stage === 'egg') return null;
    var f = adultForm(p);
    return f === 'secret' ? 'perfect' : f;           // the secret stays a surprise until the cut-scene
  }

  function advance(p) {
    var order = D.STAGES;
    var i = order.indexOf(p.stage);
    if (i < 0 || i >= order.length - 1) return;
    var oldBase = D.CARE[p.stage] ? D.CARE[p.stage].weight : 5;
    p.stage = order[i + 1];
    p.stageMin = 0;
    var newBase = D.CARE[p.stage].weight;
    p.weight = Math.max(newBase, p.weight + (newBase - oldBase));
    if (p.stage === 'child') p.str = 0;   // 2.6.1 audit: a new child starts at Strength 0 (was missing until its first training)
    if (p.stage === 'teen') p.str = Math.floor((p.str || 0) * D.JUNIOR.str.teenKeep);   // 2.6.0: a new teen keeps half
    if (p.stage === 'adult') { becomeAdult(p); delete p.str; delete p.strDay; }
  }
  function becomeAdult(p, form) {
    p.stage = 'adult';
    p.form = form || adultForm(p);
    p.level = 1; p.xp = 0; p.sp = 1;
    p.skills = []; p.innate = [];
    // up to 2 skills inherited from the parents are known from birth, free of SP
    // (any non-ultimate skill; level and prerequisites are waived for them)
    (p.inheritedSkills || []).forEach(function (id) {
      var sk = PP.Skills.find(p.species, id);
      if (sk && sk.tier <= 3 && p.innate.length < 2 && p.skills.indexOf(id) < 0) { p.skills.push(id); p.innate.push(id); }
    });
    p.adultAt = p.clock;
    // 2.4.92: XP banked from junior battles / training is paid in now (capped: at most a level-4 adult)
    var bank = Math.min(p.jxp || 0, (D.JUNIOR && D.JUNIOR.bankCap) || 0);
    p.jxp = 0;
    if (bank > 0) { p.carriedXp = bank; PP.Stats.addXp(p, bank); }
  }
  /* Test mode helper: jump straight to a stage/form. */
  function forceStage(p, stage, form) {
    if (D.STAGES.indexOf(stage) < 0) return;
    p._fromStage = p.stage;
    p.fate = null;
    if (stage === 'adult') {
      p.stageMin = 0;
      p.weight = Math.max(p.weight, D.CARE.adult.weight);
      becomeAdult(p, D.FORMS.indexOf(form) >= 0 ? form : 'good');
    } else {
      p.stage = stage; p.form = null; p.stageMin = 0;
      if (stage !== 'egg') p.weight = D.CARE[stage].weight;
      if (stage !== 'egg' && !p.hatchedAt) p.hatchedAt = p.lastTickAt;
    }
    var cum = { egg: 0, baby: 0, child: D.STAGE_MIN.baby, teen: D.STAGE_MIN.baby + D.STAGE_MIN.child,
      adult: D.STAGE_MIN.baby + D.STAGE_MIN.child + D.STAGE_MIN.teen };
    p.ageMin = Math.max(p.ageMin, cum[stage]);
    // 2.6.1 admin audit: a jump follows the real growing rules - Strength 0..40 for a child / teen (half kept by a new
    // teen), none for an adult; the Legend marks always end (a fresh adult starts at adult day 0)
    var was = p._fromStage;
    if (stage === 'child' || stage === 'teen') { p.str = stage === 'teen' && was === 'child' ? Math.floor((p.str || 0) * D.JUNIOR.str.teenKeep) : (was === stage ? (p.str || 0) : 0); }
    else { delete p.str; delete p.strDay; }
    delete p.legend; delete p.legendBredAt; delete p.lovedAt; delete p._fromStage;
  }
  function minutesToNextStage(p) {
    if (!D.STAGE_MIN[p.stage]) return null;
    return Math.max(0, D.STAGE_MIN[p.stage] - p.stageMin);
  }
  /* 2.5.2: a rough, kid-friendly duration: '15 min', '~3 hrs', '~2 days' (hours up to 2 days, then days, rounded). */
  function aboutText(min) {
    min = Math.max(0, Math.round(min));
    if (min < 60) return Math.max(1, min) + ' min';
    if (min < 48 * 60) { var h = Math.round(min / 60); return '~' + h + (h === 1 ? ' hr' : ' hrs'); }
    var d = Math.round(min / 1440 * 2) / 2; return '~' + d + ' days';
  }
  /* 2.5.2: when the pal grows up, by the real rule: its stage clock runs every minute (asleep or awake, not in the Pal
   * Box), and once it is full the pal grows up at the next minute it is AWAKE (stepMinute) - a pal that is due in the
   * night grows up when it wakes. An egg hatches in its first minutes, asleep or not. */
  function growText(p) {
    if (!p || p.fate) return '';
    if (p.stage === 'adult') return 'Fully grown';
    var left = minutesToNextStage(p); if (left == null) return '';
    if (p.stage === 'egg') return left > 0 ? 'Hatches in ' + aboutText(left) : 'Hatching now!';
    if (left > 0) return 'Grows up in ' + aboutText(left) + (p.asleep ? ' (counts while asleep)' : '');
    return p.asleep ? 'Ready - grows up when it wakes' : 'Growing up now!';
  }

  /* 1.9.7: training streak for the eagle's secret: consecutive pet-days with 6+ trainings while a child/teen. */
  function noteTraining(p) {
    if (p.stage !== 'child' && p.stage !== 'teen') return;
    var day = Math.floor((p.clock || 0) / 1440), e = p.evo, need = D.SECRET.eagle.perDay;
    if (e.tday === day) return;                      // today already counts
    if (!p.trainDay || p.trainDay.d !== day || p.trainDay.n < need) return;   // a streak day = 6+ trainings that pet-day
    e.streak = e.tday === day - 1 ? (e.streak || 0) + 1 : 1;
    e.tday = day; e.best = Math.max(e.best || 0, e.streak);
  }

  /* 2.4.0: a finished child / teen training or mini-game adds its style points (mini = the exact game played). */
  /* 2.6.0 STRENGTH: add points (child / teen only, capped); returns what was really added */
  function addStr(p, n) {
    if (!p || (p.stage !== 'child' && p.stage !== 'teen')) return 0;
    var S = D.JUNIOR.str, before = p.str || 0;
    p.str = Math.min(S.cap, Math.round((before + Math.max(0, n)) * 2) / 2);
    return p.str - before;
  }
  /* battle Strength with a daily taper: the first `full` battles of the pet-day count in full, the next `half` half, then 0 */
  function battleStr(p, won) {
    var S = D.JUNIOR.str, day = Math.floor((p.clock || 0) / 1440);
    if (!p.strDay || p.strDay.d !== day) p.strDay = { d: day, n: 0 };
    p.strDay.n++;
    var k = p.strDay.n <= S.full ? 1 : p.strDay.n <= S.full + S.half ? 0.5 : 0;
    return addStr(p, S.battle[won ? 0 : 1] * k);
  }
  function noteStyle(p, mini, success) {
    if (!p || (p.stage !== 'child' && p.stage !== 'teen') || !p.evo) return;
    var r = D.STYLE.pts[mini]; if (!r) return;
    var v = p.evo.sty || (p.evo.sty = { power: 0, swift: 0, guard: 0 });
    if (!(p.trainDay && p.trainDay.n > D.RULES.trainDayFull)) addStr(p, D.JUNIOR.str.train[success ? 0 : 1]);   // 2.6.0 Strength (within the daily full trainings)
    v[r[2]] = Math.min(9999, (v[r[2]] || 0) + (success ? r[0] : r[1]));
  }
  PP.Evolution = { careScore: careScore, adultForm: adultForm, style: style, hint: hint, noteStyle: noteStyle, addStr: addStr, battleStr: battleStr, secretMet: secretMet, championMet: championMet, noteTraining: noteTraining, forecast: forecast, advance: advance,
    becomeAdult: becomeAdult, forceStage: forceStage, minutesToNextStage: minutesToNextStage, growText: growText, aboutText: aboutText };
})(typeof window !== 'undefined' ? window : globalThis);
