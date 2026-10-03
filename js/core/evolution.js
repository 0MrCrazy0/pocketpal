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
  function adultForm(p) {
    var s = careScore(p), E = D.EVO;
    if (championMet(p, s) && secretMet(p, s)) return 'secret';
    if (championMet(p, s)) return 'perfect';
    if (s >= E.good.minScore) return 'good';
    return 'bad';
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
    if (p.stage === 'adult') becomeAdult(p);
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
  }
  /* Test mode helper: jump straight to a stage/form. */
  function forceStage(p, stage, form) {
    if (D.STAGES.indexOf(stage) < 0) return;
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
  }
  function minutesToNextStage(p) {
    if (!D.STAGE_MIN[p.stage]) return null;
    return Math.max(0, D.STAGE_MIN[p.stage] - p.stageMin);
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

  PP.Evolution = { careScore: careScore, adultForm: adultForm, secretMet: secretMet, championMet: championMet, noteTraining: noteTraining, forecast: forecast, advance: advance,
    becomeAdult: becomeAdult, forceStage: forceStage, minutesToNextStage: minutesToNextStage };
})(typeof window !== 'undefined' ? window : globalThis);
