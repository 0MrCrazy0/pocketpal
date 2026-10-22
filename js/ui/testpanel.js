/* PocketPal - developer / tester panel. Only available when the page is opened
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
    ['Adult', [['Scrappy', function () { stage('adult', 'bad'); }], ['Solid', function () { stage('adult', 'good'); }], ['Champion', function () { stage('adult', 'perfect'); }], ['Secret', function () { stage('adult', 'secret'); }]]],
    ['Style', [['Mighty', function () { stage('adult', 'power'); }], ['Swift', function () { stage('adult', 'swift'); }], ['Sturdy', function () { stage('adult', 'guard'); }]]],   // 2.4.0
    ['Needs', [['Fill all', function () { T.fill(st()); done('All needs filled'); }], ['Hungry', function () { var p = pet(); if (p) { p.hunger = 0; p.happy = Math.min(p.happy, 1); } done(p && p.legend ? 'Hungry (a Legend is fed again next minute)' : 'Hungry'); }],
      ['Poop', function () { T.poop(st()); done('Poop!'); }], ['Sick', function () { T.sick(st()); done('Sick'); }], ['Tantrum', function () { T.fake(st()); done('Tantrum started'); }]]],
    ['Battle', [['+100 XP', function () { var n = T.xp(st(), 100); done('+100 XP' + (n ? ' (+' + n + ' Lv)' : '')); }], ['+1 Lv', function () { lvl(1); }], ['Max Lv', function () { lvl(99); }],
      ['+5 SP', function () { T.sp(st(), 5); done('+5 SP'); }]]],
    ['Extra', [['Spawn mate', function () { var r = T.mate(st(), Date.now()); done(r.msg); }], ['Quick battle', quickBattle], ['Unlock arena', function () { T.unlockArena(st()); done('All cups unlocked'); }],
      ['Full energy', function () { var p = pet(); if (p) p.energy = 100; done('Energy 100'); }],
      ['Revive RIP', function () { var r = T.revive(st()); done(r && r.msg ? r.msg : 'Nothing to revive'); }]]],
    // 2.4.0: seasonal events (Auto = the device date) and the wider world
    ['Event', [['Auto', function () { ev(null); }], ['Halloween', function () { ev('halloween'); }], ['Christmas', function () { ev('christmas'); }], ['Easter', function () { ev('easter'); }], ['Off', function () { ev('off'); }]]],
    ['Season', [['Auto', function () { se(null); }], ['Winter', function () { se('winter'); }], ['Spring', function () { se('spring'); }], ['Off', function () { se('off'); }]]],   // 2.5.0
    ['World', [['Trip ready', function () { var T9 = st().trips; T9.last = null; T9.n = 0; done('Trips ready'); }], ['All things', function () { Object.keys(PP.World.THINGS).forEach(function (id) { PP.World.give(st(), id, Date.now()); }); done('Every thing owned'); }],
      ['Legend now', function () { legendNow(); }],
      ['Gift in', function () { var r = PP.World.receive(st(), [{ g: 'treat', n: 'Tester', s: 1 }], G.now(st())); done(r.length ? 'Got a ' + r[0].name + (r[0].used ? '' : ' (note)') : 'No gift'); }]]],
    // 2.6.1: Legends, Strength (children / teens), adult care mistakes, the Hall of Fame
    ['Legend', [['Make Legend', legendNow], ['Lay egg', function () { var r = PP.World.breedLegend(st(), st().active, G.now(st())); done(r.msg); }],
      ['Not Legend', function () { var p = pet(); if (p && p.legend) { delete p.legend; p.stageMin = 0; done('Adult again (day 0)'); } else done('Not a Legend'); }]]],
    ['Str', [['0', function () { setStr(0); }], ['20', function () { setStr(20); }], ['40 (max)', function () { setStr(D.JUNIOR.str.cap); }]]],
    ['Care', [['0 adult', function () { setAdultMist(0); }], ['3 recent', function () { setAdultMist(3); }], ['6 recent', function () { setAdultMist(6); }], ['10 old', function () { setAdultMist(10, true); }]]],
    ['Hall', [['View', function () { A().clearToasts(); PP.UI.close(); PP.UI.open(PP.WorldUI.hallScreen); }], ['Clear', function () { var n = (st().hall || []).length; st().hall = []; done('Hall of Fame cleared (' + n + ')'); }]]],
    ['Unlock', [['Champion (all cups)', function () { unlocked(T.champion(st()), 'Arena Champion!'); }], ['Fill Paldex', function () { unlocked(T.fillDex(st()), 'Paldex filled'); }],
      ['+500 coins', function () { T.coins(st(), 500); done('+500 coins (' + PP.Shop.coins(st()) + ')'); }]]]
  ];

  function legendNow() {
    var p = pet(); if (!p || p.fate) { done('No pal'); return; }
    if (p.stage !== 'adult') { done('Adults only (use Adult first)'); return; }
    if (p.legend) { done(p.name + ' is already a Legend'); return; }
    p.stageMin = Math.max(p.stageMin, PP.World.elderAt(p) * 1440 - 1); p.lastTickAt = Math.min(p.lastTickAt, G.now(st()) - 60000);
    A().handleEvents(G.update(st()), false); done(p.legend ? null : 'Could not make a Legend');
  }
  function setStr(n) {
    var p = pet(); if (!p || (p.stage !== 'child' && p.stage !== 'teen')) { done('Children and teens only (adults have no Strength)'); return; }
    p.str = n; done('Strength ' + n + '/' + D.JUNIOR.str.cap);
  }
  function setAdultMist(n, old) {   // adult mistakes = lifetime - young ones; recent = the last 3 pet-days (battle form)
    var p = pet(); if (!p || p.stage !== 'adult') { done('Adults only'); return; }
    if (p.legend) { done('Legends make no care mistakes'); return; }
    var t = p.lastTickAt || G.now(st());
    p.totalMistakes = (p.mistakes || 0) + n;
    p.mistakeAt = []; for (var i = 0; i < n; i++) p.mistakeAt.push(old ? t - 5 * 1440 * 60000 - i : t - 60000 * (i + 1));
    p.mistakeLog = p.mistakeAt.map(function () { return 'Test panel'; });
    done(n + ' adult mistakes' + (old ? ' (older than 3 days)' : ' (recent)') + ' \u00b7 Legend at adult day ' + PP.World.elderAt(p));
  }
  function unlocked(fresh, msg) {
    A().handleEvents(fresh.map(function (s) { return { t: 'unlock', shell: s.id, name: s.name }; }), false);
    done(msg + (fresh.length ? '' : ' (no new shells)'));
  }
  function ev(k) { st().settings.eventForce = k; done('Event: ' + (k ? k : 'auto (device date)')); }
  function se(k) { st().settings.seasonForce = k; done('Season: ' + (k ? k : 'auto (date + hemisphere)')); }
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
    var opp = PP.Arena.opponent(rank, Math.floor(Math.random() * 1e6));
    opp.name = 'Sparring'; opp.id = 'spar' + rank;
    p.energy = Math.max(p.energy, D.RULES.costs.battle);
    p.asleep = false; p.sick = false;
    A().startQuick(opp, 'SPAR');
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
    if (p.stage === 'child' || p.stage === 'teen') t += '\nStrength ' + (p.str || 0) + '/' + D.JUNIOR.str.cap;
    if (p.stage === 'adult') t += '\n' + (p.legend ? 'LEGEND' : 'adult day ' + PP.World.adultDays(p) + ', Legend at ' + PP.World.elderAt(p)) + ' \u00b7 adult mistakes ' + PP.Stats.adultMistakes(p) + ' (' + PP.Stats.recentAdultMistakes(p) + ' in 3 days) \u00b7 hall ' + (s.hall || []).length;
    t += '\nmistakes ' + p.mistakes + ' (life ' + p.totalMistakes + ') \u00b7 score ' + PP.Evolution.careScore(p) + ' \u00b7 track ' + (PP.Evolution.forecast(p) || '-') + (nx != null ? ' \u00b7 next stage ' + nx + 'm' : '');
    t += '\nH' + p.hunger + ' J' + p.happy + ' E' + Math.round(p.energy) + ' D' + Math.round(p.discipline) + ' HP' + Math.round(p.health) + ' W' + p.weight + ' poop' + p.poop + (p.sick ? ' SICK' : '') + (p.asleep ? ' asleep' : '') + (p.lights ? '' : ' dark');
    if (p.stage === 'adult') t += '\nLv' + p.level + ' xp' + p.xp + ' sp' + p.sp + ' BP' + PP.Stats.bp(PP.Stats.battleStats(p)) + ' \u00b7 arena ' + PP.Arena.mainWon(s) + '/' + D.ARENA_MAIN + ' cups';
    var need = PP.Care.attention(p);
    t += '\nspeed x' + s.settings.speed + ' \u00b7 attention ' + (need.length ? need.join(',') : '-') + ' \u00b7 dex ' + PP.Collection.counts(s).adults + '/' + PP.DATA.SPECIES.length * PP.DATA.FORMS.length;
    info.textContent = t;
  }
  PP.TestPanel = { show: show, hide: hide, visible: visible, update: update };
})(typeof window !== 'undefined' ? window : globalThis);
