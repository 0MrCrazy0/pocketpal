/* PocketPal 2 - developer / tester panel. Only available when the page is opened
 * after tapping C 10 times and entering the admin password. Then use the TEST
 * button, Settings > Test mode, or hold A + C for 3 seconds. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var G = PP.Game, D = PP.DATA, T = PP.Game.Test;
  var panel = null, info = null;

  function A() { return PP.App; }
  function st() { return PP.App.state; }
  function pet() { return G.active(st()); }
  function done(msg) { if (msg) A().toast(msg); A().save(); PP.UI.refresh(); update(); }

  var ROWS = [
    ['Speed', [['1x', function () { setSpeed(1); }], ['60x', function () { setSpeed(60); }], ['600x', function () { setSpeed(600); }]]],
    ['Time', [['+10m', function () { skip(10); }], ['+1h', function () { skip(60); }], ['+6h', function () { skip(360); }], ['+1 day', function () { skip(1440); }]]],
    ['Stage', [['Egg', function () { stage('egg'); }], ['Baby', function () { stage('baby'); }], ['Child', function () { stage('child'); }], ['Teen', function () { stage('teen'); }]]],
    ['Adult', [['Scrappy', function () { stage('adult', 'bad'); }], ['Solid', function () { stage('adult', 'good'); }], ['Champion', function () { stage('adult', 'perfect'); }]]],
    ['Needs', [['Fill all', function () { T.fill(st()); done('All needs filled'); }], ['Hungry', function () { var p = pet(); if (p) { p.hunger = 0; p.happy = Math.min(p.happy, 1); } done('Hungry'); }],
      ['Poop', function () { T.poop(st()); done('Poop!'); }], ['Sick', function () { T.sick(st()); done('Sick'); }], ['Tantrum', function () { T.fake(st()); done('Tantrum started'); }]]],
    ['Battle', [['+100 XP', function () { var n = T.xp(st(), 100); done('+100 XP' + (n ? ' (+' + n + ' Lv)' : '')); }], ['+1 Lv', function () { lvl(1); }], ['Max Lv', function () { lvl(99); }],
      ['+5 SP', function () { T.sp(st(), 5); done('+5 SP'); }]]],
    ['Extra', [['Spawn mate', function () { var r = T.mate(st(), Date.now()); done(r.msg); }], ['Quick battle', quickBattle], ['Unlock arena', function () { T.unlockArena(st()); done('All cups unlocked'); }],
      ['Full energy', function () { var p = pet(); if (p) p.energy = 100; done('Energy 100'); }],
      ['Revive RIP', function () { var r = T.revive(st()); done(r && r.msg ? r.msg : 'Nothing to revive'); }]]],
    ['Unlock', [['Champion (all cups)', function () { unlocked(T.champion(st()), 'Arena Champion!'); }], ['Fill Paldex', function () { unlocked(T.fillDex(st()), 'Paldex filled'); }],
      ['+500 coins', function () { T.coins(st(), 500); done('+500 coins (' + PP.Shop.coins(st()) + ')'); }]]]
  ];

  function unlocked(fresh, msg) {
    A().handleEvents(fresh.map(function (s) { return { t: 'unlock', shell: s.id, name: s.name }; }), false);
    done(msg + (fresh.length ? '' : ' (no new shells)'));
  }
  function setSpeed(n) { st().settings.speed = n; done('Time x' + n); }
  function skip(min) {
    var ev = T.skip(st(), min, Date.now());
    A().handleEvents(ev, false);
    done('Skipped ' + (min >= 60 ? min / 60 + 'h' : min + 'm'));
  }
  function stage(s, form) {
    var p = pet(); if (!p) { A().toast('No pal - start an egg first'); return; }
    if (p.fate) { A().toast('This pal is gone'); return; }
    var from = PP.Sprites.stageKeyOf(p);
    A().clearToasts();   // an old "egg is warming up" must not pop up after the jump
    var ev = T.stage(st(), s, form);
    var to = PP.Sprites.stageKeyOf(p);
    if (from !== to && s !== 'egg') A().playEvolve(p, from, to);
    if (ev.length) A().handleEvents(ev, false);
    done('Now: ' + PP.Pet.formName(p));
  }
  function lvl(n) {
    var p = pet(); if (!p || p.stage !== 'adult') { A().toast('Adults only'); return; }
    var got = 0;
    for (var i = 0; i < n; i++) { var need = D.LEVEL.xpNeed(p.level) - p.xp; var g = PP.Stats.addXp(p, need); if (!g) break; got += g; }
    done(got ? 'Level ' + p.level : 'Level cap reached (' + PP.Stats.levelCap(p.form) + ')');
  }
  function quickBattle() {
    var p = pet(); if (!p || p.stage !== 'adult') { A().toast('Adults only'); return; }
    var rank = 0;
    D.ARENA.forEach(function (c, i) { if (c.lv <= p.level) rank = i; });
    var opp = PP.Arena.opponent(rank, Math.floor(Math.random() * 1e6), st().seed);
    opp.name = 'Sparring';
    p.energy = Math.max(p.energy, D.RULES.costs.battle);
    p.asleep = false; p.sick = false;
    A().startFriend(opp, 'SPAR');
    update();
  }

  function build() {
    panel = document.createElement('section');
    panel.id = 'testpanel'; panel.setAttribute('aria-label', 'Test panel'); panel.hidden = true;
    var h = '<header><b>TEST PANEL</b><button type="button" class="tp-min" aria-label="Minimise test panel" aria-expanded="true">\u2013</button><button type="button" class="tp-x" aria-label="Close test panel">\u00d7</button></header><div class="tp-info"></div>';
    ROWS.forEach(function (row, r) {
      h += '<div class="tp-row"><span>' + row[0] + '</span>';
      row[1].forEach(function (b, i) { h += '<button type="button" data-r="' + r + '" data-i="' + i + '">' + b[0] + '</button>'; });
      h += '</div>';
    });
    panel.innerHTML = h;
    document.body.appendChild(panel);
    info = panel.querySelector('.tp-info');
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      e.stopPropagation();
      if (b.classList.contains('tp-x')) { hide(); return; }
      if (b.classList.contains('tp-min')) { var m = panel.classList.toggle('min'); b.textContent = m ? '+' : '\u2013'; b.setAttribute('aria-expanded', m ? 'false' : 'true'); b.setAttribute('aria-label', m ? 'Expand test panel' : 'Minimise test panel'); return; }
      var fn = ROWS[+b.dataset.r][1][+b.dataset.i][1];
      try { fn(); } catch (err) { A().toast('Test action failed: ' + err.message); }
    });
    panel.addEventListener('keydown', function (e) { e.stopPropagation(); });
  }
  function show() { if (!panel) build(); panel.hidden = false; document.body.classList.add('tp-open'); update(); }
  function hide() { if (panel) panel.hidden = true; document.body.classList.remove('tp-open'); }
  function visible() { return panel && !panel.hidden; }
  function update() {
    if (!visible()) return;
    var p = pet(), s = st();
    if (!p) { info.textContent = 'No pal'; return; }
    var t = p.name + ' \u00b7 ' + PP.Pet.formName(p) + ' \u00b7 ' + p.stage + (p.form ? '/' + p.form : '') + ' \u00b7 age ' + (p.ageMin / 60).toFixed(1) + 'h';
    var nx = PP.Evolution.minutesToNextStage(p);
    t += '\nmistakes ' + p.mistakes + ' (life ' + p.totalMistakes + ') \u00b7 score ' + PP.Evolution.careScore(p) + ' \u00b7 track ' + (PP.Evolution.forecast(p) || '-') + (nx != null ? ' \u00b7 next stage ' + nx + 'm' : '');
    t += '\nH' + p.hunger + ' J' + p.happy + ' E' + Math.round(p.energy) + ' D' + Math.round(p.discipline) + ' HP' + Math.round(p.health) + ' W' + p.weight + ' poop' + p.poop + (p.sick ? ' SICK' : '') + (p.asleep ? ' asleep' : '') + (p.lights ? '' : ' dark');
    if (p.stage === 'adult') t += '\nLv' + p.level + ' xp' + p.xp + ' sp' + p.sp + ' BP' + PP.Stats.bp(PP.Stats.battleStats(p)) + ' \u00b7 arena ' + D.ARENA[s.arena.rank].name;
    var need = PP.Care.attention(p);
    t += '\nspeed x' + s.settings.speed + ' \u00b7 attention ' + (need.length ? need.join(',') : '-') + ' \u00b7 dex ' + PP.Collection.counts(s).adults + '/18';
    info.textContent = t;
  }
  PP.TestPanel = { show: show, hide: hide, visible: visible, update: update };
})(typeof window !== 'undefined' ? window : globalThis);
