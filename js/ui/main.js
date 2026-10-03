/* PocketPal - app shell: boot, main loop, event handling, saving.
 * Wires the pure core (js/core) to the screen (js/ui). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var G = PP.Game, D = PP.DATA, R = PP.Render, UI = PP.UI;
  var ICONS = ['status', 'feed', 'train', 'clean', 'med', 'lights', 'battle', 'disc'];
  var storageMode = 'local';
  var storage = (function () {
    try { var s = root.localStorage, k = 'pocketpal2.rewrite.probe'; s.setItem(k, '1'); s.removeItem(k); return s; }
    catch (e) { storageMode = 'memory'; return memoryStorage(); }
  })();
  function memoryStorage() { var m = {}; return { getItem: function (k) { return k in m ? m[k] : null; }, setItem: function (k, v) { m[k] = String(v); }, removeItem: function (k) { delete m[k]; } }; }

  var App = PP.App = {
    state: null, scene: 'home', anim: null, cut: null, cutQueue: [], walker: null, iconSel: -1,
    lastUpdateReal: 0, lastSaveReal: 0, toasts: [], toastUntil: 0
  };

  /* ------------------------------------------------------------ helpers */
  function spriteKey(k) { return D.FORMS.indexOf(k) >= 0 ? 'adult_' + k : k; }
  /* Saving. A tab that lost the "tab lock" to a newer tab never saves (it would overwrite
   * the newer tab's progress). A failed write (storage full) warns once per session. */
  App.storageMode = storageMode;
  App.save = function () {
    if (App.passive || !App.state) return;
    App.state.lastSeenAt = Date.now();
    var ok = PP.Save.save(storage, App.state, Date.now());
    App.lastSaveReal = Date.now();
    if (!ok && !App.saveWarned) { App.saveWarned = true; App.toast('Could not save - browser storage is full. Free some space or export a backup (Settings > Save transfer).'); }
    if (ok) App.saveWarned = false;
  };

  /* ------------------------------------------------------------ one tab at a time
   * The newest tab wins: it announces itself (BroadcastChannel + a localStorage key for
   * browsers without it); any older tab goes passive (no sim, no saves) and offers
   * "Play here", which reloads it from the latest save and takes the lock back. */
  var TAB_KEY = 'pocketpal2.rewrite.tab', TAB_ID = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  var chan = null;
  function claimTab() {
    App.passive = false;
    if (chan) { try { chan.postMessage({ t: 'claim', id: TAB_ID }); } catch (e) { /* closed */ } }
    try { storage.setItem(TAB_KEY, TAB_ID + ':' + Date.now()); } catch (e) { /* storage off: channel only */ }
  }
  function goPassive() {
    if (App.passive) return;
    App.passive = true;
    if (UI.isOpen()) UI.close();
    var el = document.getElementById('tabLock'); if (el) el.hidden = false;
    var b = document.getElementById('tabLockBtn'); if (b) b.focus();
  }
  function initTabLock() {
    if (root.BroadcastChannel) {
      try { chan = new root.BroadcastChannel('pocketpal2'); chan.onmessage = function (e) { if (e.data && e.data.t === 'claim' && e.data.id !== TAB_ID) goPassive(); }; } catch (e) { chan = null; }
    }
    root.addEventListener('storage', function (e) {
      if (e.key === TAB_KEY && e.newValue && e.newValue.split(':')[0] !== TAB_ID) goPassive();
    });
    var btn = document.getElementById('tabLockBtn');
    if (btn) btn.addEventListener('click', function () { root.location.reload(); });
    claimTab();
  }

  /* ------------------------------------------------------------ service worker updates
   * A new version installs in the background and waits; we show "Update ready" and only
   * switch (skipWaiting + reload) when the player taps it, so a game is never swapped mid-play. */
  function initServiceWorker() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(root.location.protocol)) return;
    var reloading = false;
    function offer(worker) {
      if (!worker || !navigator.serviceWorker.controller) return;   // first install: nothing to update
      var bar = document.getElementById('updateBar'); if (!bar) return;
      bar.hidden = false;
      bar.onclick = function () { bar.hidden = true; App.updateRequested = true; worker.postMessage({ type: 'skipWaiting' }); };
    }
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloading || !App.updateRequested) return;
      reloading = true; App.save(); root.location.reload();
    });
    root.addEventListener('load', function () {
      navigator.serviceWorker.register('service-worker.js').then(function (reg) {
        if (reg.waiting) offer(reg.waiting);
        reg.addEventListener('updatefound', function () {
          var w = reg.installing; if (!w) return;
          w.addEventListener('statechange', function () { if (w.state === 'installed') offer(w); });
        });
      }).catch(function () { /* offline cache is optional */ });
    });
  }
  /* Toasts are short-lived: anything still queued after TOAST_TTL is stale (e.g. an
   * "egg is warming up" note that waited behind a cut-scene) and is dropped. */
  var TOAST_TTL = 6000;
  App.toast = function (msg) {
    if (!msg) return;
    msg = String(msg);
    if (App.toasts.length && App.toasts[App.toasts.length - 1].msg === msg) return;
    App.toasts.push({ msg: msg, at: Date.now() }); if (App.toasts.length > 4) App.toasts.shift();
  };
  App.clearToasts = function () { App.toasts = []; App.toastUntil = 0; var el = document.getElementById('toast'); if (el) el.hidden = true; };
  function pumpToasts(now) {
    var el = document.getElementById('toast');
    if (now < App.toastUntil) return;
    if (App.cut || App.scene === 'battle') { if (!el.hidden) el.hidden = true; return; } // keep the stage clear
    var t = Date.now();
    while (App.toasts.length && t - App.toasts[0].at > TOAST_TTL) App.toasts.shift();
    if (!App.toasts.length) { if (!el.hidden) el.hidden = true; return; }
    el.textContent = App.toasts.shift().msg; el.hidden = false;
    App.toastUntil = now + (App.toasts.length > 1 ? 1300 : 2000);
  }
  App.resetWalker = function () { App.walker = null; App.anim = null; };
  App.updateSoundBtn = function () {
    var b = document.getElementById('soundBtn');
    if (b) { var on = App.state.settings.sound; b.textContent = on ? '\u266a ON' : '\u266a OFF'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  };
  App.updateBellBtn = function () {
    var b = document.getElementById('bellBtn');
    if (!b || !App.state) return;
    var on = !!App.state.settings.alerts;
    b.textContent = on ? '\uD83D\uDD14 ON' : '\uD83D\uDD15 OFF';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.setAttribute('aria-label', on ? 'Care alerts on' : 'Care alerts off');
  };
  /* Test panel: tap C 10 times quickly, then enter the admin password (js/ui/admin.js keeps
   * only a salted hash). ?test=1 is disabled. */
  App.testAllowed = false;
  App.setTestMode = function (on) {
    if (on && !App.testAllowed) return;
    App.state.settings.test = !!on;
    if (!on) App.state.settings.speed = 1;
    document.getElementById('testBtn').hidden = !on;
    if (on) PP.TestPanel.show(); else PP.TestPanel.hide();
    App.save();
  };
  App.toggleTestPanel = function (forceOn) {
    if (!App.testAllowed) return;
    if (!App.state.settings.test || forceOn) { App.setTestMode(true); App.toast('Test mode ON'); return; }
    if (PP.TestPanel.visible()) PP.TestPanel.hide(); else PP.TestPanel.show();
  };
  App.replaceState = function (s) { App.state = s; App.resetWalker(); App.clearToasts(); App.cutQueue = []; App.cut = null; App.lastUpdateReal = Date.now(); lastNeeds = ''; App.save(); applySettings(); refreshIcons(); };
  /* Import from a save code: keep the old save one step back, just in case. */
  App.importState = function (s) {
    try { storage.setItem(PP.Save.KEY + '.preimport', PP.Save.serialize(App.state)); } catch (e) { /* storage full: import anyway */ }
    App.replaceState(s);
  };
  App.toggleNotify = function () {
    var st = App.state;
    if (st.settings.notify) { st.settings.notify = false; App.save(); UI.refresh(); App.toast('Background alerts off'); return; }
    if (typeof Notification === 'undefined') { App.toast('Notifications are not supported here'); return; }
    function on(perm) {
      if (perm === 'granted') { st.settings.notify = true; App.toast('Alerts on while this tab is open in the background'); }
      else App.toast(perm === 'denied' ? 'Notifications are blocked in your browser settings' : 'Alerts stay off');
      App.save(); UI.refresh();
    }
    if (Notification.permission === 'granted') on('granted');
    else { try { var pr = Notification.requestPermission(on); if (pr && pr.then) pr.then(on); } catch (e) { on('denied'); } }
  };
  App.resetAll = function () { PP.Save.wipe(storage); App.state = G.newState(Date.now()); App.resetWalker(); App.save(); applySettings(); App.toast('Fresh start!'); setTimeout(firstEgg, 50); };
  function applySettings() {
    PP.Audio.setEnabled(App.state.settings.sound); PP.Audio.setMusic(App.state.settings.music !== false); App.updateSoundBtn(); App.updateBellBtn();
    PP.Shells.apply(App.state.settings.shell);
    document.getElementById('testBtn').hidden = !(App.testAllowed && App.state.settings.test);
  }
  function timeAt(ms) { return PP.Time.dateTime(ms, App.state.settings.clock, Date.now()); }

  /* ------------------------------------------------------------ events from the simulation */
  var CALL_TEXT = { hunger: 'is hungry!', happy: 'is sad - play with it!', sick: 'is sick! Give medicine', lights: 'is sleeping - turn the lights off!' };
  App.handleEvents = function (evs, offline) {
    var p = G.active(App.state); if (!p || !evs.length) return;
    var info = { lines: [], minutes: 0 }, poops = 0, mistakes = [], lastGrow = null, died = null, rare = null, woke = null;
    function line(e, text) { info.lines.push(e.at ? timeAt(e.at) + ': ' + text : text); }
    evs.forEach(function (e) {
      switch (e.t) {
        case 'hatch': lastGrow = { kind: 'hatch' }; PP.Audio.play('hatch'); line(e, 'Your egg hatched into ' + D.NAMES[p.species].baby + '!' + (p.golden ? ' It sparkles with gold!' : '')); break;
        case 'evolve': lastGrow = { kind: 'evolve', from: e.from, to: e.to }; line(e, 'Grew into ' + D.NAMES[p.species][e.to] + '!'); break;
        case 'poop': poops++; break;   // the attention call (checkAttention) beeps for it
        case 'call': if (!offline) App.toast(p.name + ' ' + (e.fake ? 'is calling you...?' : CALL_TEXT[e.need] || 'needs you!')); break;
        case 'daily': App.toast('Daily bonus: +' + e.coins + ' coins' + (e.streak > 1 ? ' (' + e.streak + '-day streak)' : '') + (e.care ? ' incl. care bonus' : '')); break;
        case 'unlock': PP.Audio.play('level'); App.toast('New shell colour unlocked: ' + e.name + '! (MENU \u25b8 Shell colour)'); info.lines.push('Unlocked the ' + e.name + ' shell'); break;
        case 'sick': line(e, 'Got sick'); if (!offline) App.toast(p.name + ' got sick!'); break;
        case 'sleep': if (!offline) { App.toast(p.name + ' fell asleep. Lights off!'); PP.Audio.play('lullaby'); } woke = null; break;
        case 'wake': if (e.from === 'night') woke = e; break;
        case 'mistake': mistakes.push(e); if (!offline) App.toast('Care mistake: ' + e.why); break;
        case 'died': died = e; line(e, p.name + ' passed away (' + e.cause + ')'); break;
        case 'ranaway': died = e; line(e, p.name + ' ran away...'); break;
        case 'caughtUp': info.minutes = e.minutes; info.since = Date.now() - e.minutes * 60000; break;
        case 'schedFit': App.toast(p.name + ' now sleeps ' + PP.Time.hm(e.bed, App.state.settings.clock) + ' \u2013 ' + PP.Time.hm(e.wake, App.state.settings.clock)); line(e, 'New bedtime for a ' + p.stage + ': ' + PP.Time.hm(e.bed, App.state.settings.clock)); break;
        case 'clockBack': App.toast('Your device clock went back in time. ' + p.name + ' has re-synced.'); break;
        case 'dailyGoals': App.toast("Today's goals: " + e.goals.join(' \u00b7 ') + ' (MENU \u25b8 Daily goals)'); line(e, 'New daily goals'); break;
        case 'rare': rare = e; line(e, e.name + ' ' + e.text); break;
        case 'goldenEgg': App.toast('A golden egg is waiting in Pal Box slot ' + (e.slot + 1) + '!'); break;
        case 'dailyClockBack': App.toast("The clock went back: today's goals stay as they were."); break;
      }
    });
    if (lastGrow && lastGrow.kind === 'hatch' && !lastGrow.done) queueCut({ kind: 'hatch', species: p.species, name: p.name });
    if (lastGrow && lastGrow.kind === 'evolve') App.playEvolve(p, spriteKey(lastGrow.from), spriteKey(lastGrow.to));
    if (rare) { PP.Audio.play('rare'); App.toast(rare.name + ' ' + rare.text); }
    if (died) {
      PP.Audio.play(died.hard || p.hard ? 'gameover' : 'die');
      if (died.t === 'died') queueCut({ kind: 'die', species: p.species, key: PP.Sprites.stageKeyOf(p), title: 'R.I.P. ' + p.name.toUpperCase() });
      App.pendingFate = true;
    }
    if (woke && !died) {
      if (offline) line(woke, p.name + ' woke up');
      App.morning(woke.report, offline);
    }
    if (offline) {
      if (poops) info.lines.push('Pooped ' + poops + 'x');
      if (mistakes.length > 3) info.lines.push(mistakes.length + ' care mistakes: ' + mistakes.map(function (m) { return m.why; }).join(', '));
      else mistakes.forEach(function (m) { line(m, 'Care mistake: ' + m.why); });
      if (!info.lines.length) info.lines.push('All quiet. ' + p.name + ' was fine.');
      if (info.minutes >= 10) App.awayInfo = info;
    }
    App.save();
  };
  function queueCut(c) { App.cutQueue.push(c); }
  /* 1.9.1 good morning: yawn-and-stretch animation + jingle while you watch, and the night's
   * report card (shown once the screen is free, after any 'while you were away' summary). */
  App.morning = function (report, offline) {
    if (!offline) { App.anim = { kind: 'wake', t0: performance.now(), dur: 2800 }; PP.Audio.play('morning'); }
    var card = PP.Behave.reportCard(report);
    if (card && App.state.settings.reportCard !== false) App.reportInfo = card;
  };
  App.playEvolve = function (p, fromKey, toKey) {
    var stageName = toKey.indexOf('adult_') === 0 ? D.NAMES[p.species][toKey.slice(6)] : D.NAMES[p.species][toKey];
    var sub = toKey.indexOf('adult_') === 0 ? { adult_bad: 'Scrappy form', adult_good: 'Solid form', adult_perfect: 'Champion form!', adult_secret: 'SECRET FORM!' }[toKey] : toKey;
    queueCut({ kind: 'evolve', species: p.species, fromKey: fromKey, toKey: toKey, name: stageName, sub: sub, secret: toKey === 'adult_secret' });
    PP.Audio.play('evolve');
  };

  /* ------------------------------------------------------------ simulation updates */
  function updateSim(force) {
    if (App.passive) return;   // another tab owns the game
    var now = Date.now(), gap = now - (App.lastUpdateReal || now);
    var offline = gap > 60 * 1000; // app was closed / in the background: mercy rules apply
    var ev = G.update(App.state, now, { offline: offline });
    App.lastUpdateReal = now;
    if (ev.length) App.handleEvents(ev, offline);
    if (force || ev.length) refreshIcons();
    if (offline) lastNeeds = (function () { var p = G.active(App.state); return p ? PP.Care.attention(p).join(',') : ''; })(); // no beep storm on return
    checkAttention();
  }
  function refreshIcons() {
    var p = G.active(App.state), n = p && !p.fate ? PP.Care.realNeeds(p) : {};
    var need = { feed: n.hunger, train: n.happy, clean: n.poop, med: n.sick, lights: n.lights || (p && p.asleep && p.lights), disc: p && !!p.fake };
    Array.prototype.forEach.call(document.querySelectorAll('.icon'), function (el, i) {
      el.classList.toggle('need', !!need[ICONS[i]]);
      el.classList.toggle('on', i === App.iconSel);
      el.setAttribute('aria-pressed', i === App.iconSel ? 'true' : 'false');
    });
  }
  App.refreshIcons = refreshIcons;

  /* ------------------------------------------------------------ attention calls
   * The ! on the LCD is drawn by render.js from Care.attention(). Here: beep when a
   * NEW need appears, remind every few minutes while it stays, and (opt-in) show a
   * browser notification if the tab is in the background. */
  var lastNeeds = '', lastBeep = 0, REMIND_MS = 5 * 60 * 1000;
  var NEED_TEXT = { sick: 'is sick!', hunger: 'is hungry!', happy: 'is sad and wants to play', lights: 'fell asleep - turn the lights off', poop: 'made a mess - time to clean', tantrum: 'is throwing a tantrum' };
  function checkAttention() {
    var p = G.active(App.state);
    var needs = p && !p.fate ? PP.Care.attention(p) : [];
    var key = needs.join(','), t = Date.now();
    var fresh = needs.filter(function (n) { return lastNeeds.split(',').indexOf(n) < 0; });
    lastNeeds = key;
    if (!needs.length) return;
    if (fresh.length || t - lastBeep > REMIND_MS) {
      lastBeep = t;
      if (App.scene === 'home' && !App.cut) PP.Audio.play('call');
      if (document.hidden && fresh.length) notify(p, fresh[0]);
    }
  }
  App.checkAttention = checkAttention;
  function notify(p, need) {
    var s = App.state.settings;
    if (!s.notify || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try { var n = new Notification('PocketPal', { body: p.name + ' ' + (NEED_TEXT[need] || 'needs you!'), tag: 'pp2-call', icon: 'icon-192.png' }); n.onclick = function () { root.focus(); n.close(); }; } catch (e) { /* some browsers only allow SW notifications */ }
  }

  /* ------------------------------------------------------------ actions */
  App.doAct = function (action) {
    var p = G.active(App.state);
    var r = G.act(App.state, action);
    if (action === 'lights' && r.asleepUntil != null) r.msg = p.name + ' is asleep until ' + PP.Time.hm(r.asleepUntil, App.state.settings.clock) + '. Lights off lets it rest.';
    App.toast(r.msg);
    UI.close();
    var now = performance.now();
    if (r.ok || r.anim) {
      var kind = r.anim || 'happy', dur = 1500;
      if (action === 'clean' && r.ok) { kind = 'clean'; dur = 1400; }
      if (action === 'medicine' && r.ok) kind = 'med';
      if (action === 'lights') kind = null;
      if (action === 'scold') kind = r.ok ? 'scold' : 'sad';
      if (action === 'praise') kind = 'happy';
      if (kind) App.anim = { kind: kind, pose: kind === 'med' ? (p.sick ? 'sick' : 'happy') : kind === 'scold' ? 'sad' : null, food: action, t0: now, dur: dur };
    }
    if (action === 'lights' && r.woke) {          // 1.9.1: lights on woke it up
      if (r.from === 'night') App.morning(r.report, false);
      else { App.anim = { kind: 'wake', t0: now, dur: 2200 }; PP.Audio.play('happy'); }
    } else if (action === 'lights' && r.asleepUntil != null) {
      App.anim = { kind: 'stillAsleep', t0: now, dur: 3000, text: 'ASLEEP TILL ' + PP.Time.hm(r.asleepUntil, App.state.settings.clock, { lcd: true }) };
      PP.Audio.play('ok');
    } else PP.Audio.play(!r.ok ? 'no' : r.anim === 'eat' ? 'eat' : action === 'clean' || r.anim === 'happy' ? 'happy' : action === 'lights' ? 'ok' : 'sad');
    refreshIcons(); checkAttention(); App.save();
  };
  /* Items from the Pal Store bag (Feed / Medicine menus and the Bag). */
  App.useItem = function (id) {
    var r = PP.Shop.use(App.state, id), it = D.ITEMS[id];
    App.toast(r.msg);
    if (r.ok || r.anim) {
      UI.close();
      var kind = r.anim || 'happy';
      App.anim = { kind: kind, pose: kind === 'refuse' ? 'refuse' : null, food: it && it.kind === 'food' ? (id === 'cake' ? 'snack' : 'meal') : id, t0: performance.now(), dur: kind === 'eat' ? 1800 : 1500 };
    }
    PP.Audio.play(!r.ok ? 'no' : r.anim === 'eat' ? 'eat' : 'happy');
    refreshIcons(); checkAttention(); App.save();
    if (!r.ok) UI.refresh();
  };
  /* 1.8.3: too tired to train / play / battle - no menu: the pal shakes its head and yawns,
   * with a one-line 'TOO TIRED...' on the LCD. The player naps it (lights) or feeds it. */
  App.refuseTired = function () {
    UI.close();
    App.anim = { kind: 'tired', t0: performance.now(), dur: 2200 };
    PP.Audio.play('no');
  };
  App.startMini = function (kind) {
    var p = G.active(App.state);
    App.scene = 'mini';
    PP.Mini.start(kind, p, function (success) {
      App.scene = 'home';
      if (success !== null) PP.Hints.learn(App.state, kind === 'dummy' ? 'train' : kind);
      if (success === null) { App.toast('Quit - no energy used'); return; }
      var r = G.exercise(App.state, kind === 'dummy' ? 'train' : kind, success);
      App.toast(r.msg);
      App.anim = { kind: success ? 'dance' : 'sad', t0: performance.now(), dur: success ? 2100 : 1500 };
      if (/LEVEL UP/.test(r.msg)) PP.Audio.play('level');
      App.save(); refreshIcons();
    });
  };
  function beginBattle(r, title) {
    if (!r.ok) { if (/tired/i.test(r.msg || '')) { App.refuseTired(); return; } App.toast(r.msg); PP.Audio.play('no'); return; }
    UI.close();
    App.scene = 'battle';
    PP.BattleView.start(r.battle, { title: title, onEnd: function (B) {
      var out = G.finishBattle(App.state, B);
      App.scene = 'home'; App.save(); refreshIcons();
      if (out && (out.levels || out.firstClear || (out.shells && out.shells.length))) PP.Audio.play('level');
      if (out) UI.open(UI.screens.battleResult(out, B));
    } });
    App.save();
  }
  function rndSeed() { return (Math.random() * 4294967296) >>> 0; }
  App.startArena = function (rank) { beginBattle(G.startArena(App.state, rank, rndSeed()), D.ARENA[rank].name.toUpperCase()); };
  App.startFriend = function (card, title) { beginBattle(G.startFriend(App.state, card, rndSeed()), title || 'FRIEND'); };
  /* 1.8.4: cup-cleared celebration on the LCD (after the result screen closes) */
  App.celebrate = function (text) { App.anim = { kind: 'cup', t0: performance.now(), dur: 3600, text: text }; PP.Audio.play('cup'); };
  App.startQuick = function (card, title) { beginBattle(G.startQuick(App.state, card, rndSeed()), title || 'SPAR'); };
  App.startVisitor = function () { beginBattle(G.startVisitor(App.state, rndSeed()), 'VISITOR'); };

  App.afterGuide = function () { if (!G.active(App.state)) setTimeout(firstEgg, 150); };
  App.firstEgg = function () { firstEgg(); };
  function firstEgg() {
    UI.open(UI.screens.speciesPicker(function (sp) {
      var r = G.startEgg(App.state, sp, Date.now());
      if (r.ok) { G.setActive(App.state, r.slot, Date.now()); App.toast('Your ' + D.SPECIES_INFO[sp].label + ' egg is warming up...'); }
      App.resetWalker(); App.save(); UI.close();
    }, 'CHOOSE YOUR EGG'));
  }
  function homeB() {
    var p = G.active(App.state);
    if (!p) { firstEgg(); return true; }
    if (p.fate) { UI.open(UI.screens.fateScreen); return true; }
    return false;
  }
  function activateIcon(i) {
    var p = G.active(App.state), name = ICONS[i];
    if (name !== 'status' && homeB()) return;
    if (name !== 'status' && p.stage === 'egg') { App.toast('Still an egg - wait for it to hatch'); PP.Audio.play('no'); return; }
    PP.Audio.play('ok');
    switch (name) {
      case 'status': UI.open(UI.screens.mainMenu); break;
      case 'feed': UI.open(UI.screens.feedMenu); break;
      case 'train': UI.open(UI.screens.trainMenu); break;
      case 'clean': App.doAct('clean'); break;
      case 'med': if (PP.Shop.owned(App.state, ['med']).length) UI.open(UI.screens.medMenu); else App.doAct('medicine'); break;
      case 'lights': App.doAct('lights'); break;
      case 'battle': UI.open(UI.screens.battleMenu); break;
      case 'disc': UI.open(UI.screens.discMenu); break;
    }
  }

  /* ------------------------------------------------------------ input */
  App.input = function (btn) {
    if (App.cut) { if (btn === 'B' || btn === 'C') App.cut.t0 -= 60000; return; }
    if (UI.isOpen()) { UI.input(btn); return; }
    if (App.scene === 'battle') { PP.BattleView.input(btn); return; }
    if (App.scene === 'mini') { PP.Mini.input(btn); return; }
    if (btn === 'A') { App.iconSel = (App.iconSel + 1) % ICONS.length; PP.Audio.play('move'); }
    else if (btn === 'PREV') { App.iconSel = (App.iconSel + ICONS.length - 1) % ICONS.length; PP.Audio.play('move'); }
    else if (btn === 'B') { if (App.iconSel >= 0) activateIcon(App.iconSel); else if (!homeB()) activateIcon(0); }
    else if (btn === 'C') { App.iconSel = -1; PP.Audio.play('back'); }
    refreshIcons();
  };
  App.iconTap = function (i) {
    if (App.cut || App.scene !== 'home') return;
    if (UI.isOpen()) UI.close();
    App.iconSel = i; refreshIcons(); activateIcon(i);
  };
  App.lcdTap = function (fx, fy) {
    if (App.cut) { App.cut.t0 -= 60000; return; }
    if (UI.isOpen()) return;
    if (App.scene === 'mini') { PP.Mini.tap(fx, fy); return; }
    if (App.scene === 'home') homeB();
  };
  App.onMenuClosed = function () { if (PP.Admin) PP.Admin.onMenuClosed(); refreshIcons(); };

  /* ------------------------------------------------------------ main loop */
  var lastFrame = 0, lastSim = 0, lastLive = 0;
  function frame(tNow) {
    root.requestAnimationFrame(frame);
    var dt = lastFrame ? tNow - lastFrame : 16; lastFrame = tNow;
    if (dt > 1000) dt = 16;
    var s = App.state, speed = s.settings.test ? s.settings.speed || 1 : 1;
    if (speed > 1) s.timeOffset += dt * (speed - 1);
    if (speed > 1 || tNow - lastSim > 1000) { lastSim = tNow; updateSim(); }
    if (tNow - lastLive > 1000) {
      lastLive = tNow;
      var top = UI.top(); if (UI.isOpen() && top && top.live && !document.activeElement.matches('input,textarea')) UI.refresh();
      PP.TestPanel.update(); refreshIcons();
      if (Date.now() - App.lastSaveReal > 10000) { App.save(); if (PP.CloudSync && !App.passive) PP.CloudSync.auto(App.state); }
      pumpDaily(); updateHint(); favicon();
      if (App.scene === 'home' && !App.cut && !UI.isOpen() && !App.awayInfo && !App.pendingFate && backupDue()) { App.state.backup.snoozeUntil = Date.now() + 3 * 864e5; UI.open(UI.screens.backupReminder); }
    }
    var ctx = App.ctx;
    ctx.setTransform(R.DPR || 1, 0, 0, R.DPR || 1, 0, 0);   // 1.9.4: draw in LCD pixels on the x5 backing store
    ctx.imageSmoothingEnabled = false;
    if (!App.cut && App.cutQueue.length) { App.cut = App.cutQueue.shift(); App.cut.t0 = tNow; UI.close(); App.clearToasts(); }
    if (App.cut) {
      R.drawCut(ctx, App, tNow);
      if (tNow - App.cut.t0 > R.cutDuration(App.cut)) App.cut = null;
    } else if (App.scene === 'battle') PP.BattleView.draw(ctx, tNow);
    else if (App.scene === 'mini') PP.Mini.draw(ctx, tNow);
    else {
      R.drawHome(ctx, App, tNow, dt);
      if (App.awayInfo && !UI.isOpen()) { UI.open(UI.screens.awaySummary(App.awayInfo)); App.awayInfo = null; }
      else if (App.pendingFate && !UI.isOpen()) { App.pendingFate = false; UI.open(UI.screens.fateScreen); }
      else if (App.reportInfo && !UI.isOpen() && !App.anim && !App.cutQueue.length) { UI.open(UI.screens.reportCard(App.reportInfo)); App.reportInfo = null; }
    }
    pumpToasts(tNow);
  }

  /* 1.9.0 daily goal / bonus notes from the core (PP.Daily) -> toasts + jingles */
  function pumpDaily() {
    PP.Daily.drain().forEach(function (n) {
      if (n.t === 'goal') { App.toast('Goal done: ' + n.text + ' +' + n.coins + 'c'); PP.Audio.play('goal'); }
      if (n.t === 'allGoals') {
        App.toast('All daily goals done! +' + n.coins + 'c' + (n.streak > 1 ? ' (' + n.streak + '-day streak)' : ''));
        (n.shells || []).forEach(function (nm) { App.toast('New shell colour unlocked: ' + nm + '!'); });
        PP.Audio.play('allgoals');
      }
    });
  }
  /* 1.9.0 first-time hint bar (DOM, over the name row) */
  var hintId = null;
  function updateHint() {
    var el = document.getElementById('hint'); if (!el || !App.state) return;
    var p = G.active(App.state);
    var h = App.scene === 'home' && !App.cut && !UI.isOpen() && !App.passive ? PP.Hints.next(App.state, p) : null;
    if (!h) { if (!el.hidden) el.hidden = true; hintId = null; return; }
    if (h.id !== hintId) { hintId = h.id; el.querySelector('.hint-text').textContent = h.text; }
    if (el.hidden) el.hidden = false;
  }
  App.updateHint = updateHint;
  /* 1.9.3 live tab icon: the active pal (static icon fallback) */
  function favicon() { if (PP.Favicon) PP.Favicon.update(App.passive ? null : G.active(App.state), PP.Collection.shell(App.state.settings.shell)); }
  App.favicon = favicon;
  /* 1.9.0 backup reminder: a week without an export (and not snoozed) */
  function backupDue() {
    var st = App.state, b = st.backup || (st.backup = { lastExport: null, since: Date.now(), snoozeUntil: null });
    if (!G.active(st) || st.settings.cloud) return false;
    var base = b.lastExport || b.since || st.createdAt || Date.now(), now = Date.now();
    return now - base > 7 * 864e5 && now > (b.snoozeUntil || 0);
  }
  App.markExported = function () { App.state.backup = App.state.backup || {}; App.state.backup.lastExport = Date.now(); App.save(); };

  /* Everything inside the LCD is sized in LCD pixels: --u = LCD width / 216. */
  function fitLcd() {
    var lcd = document.querySelector('.lcd'); if (!lcd) return;
    var u = lcd.clientWidth / R.W;
    if (u > 0 && Math.abs(u - (fitLcd.u || 0)) > 0.001) { fitLcd.u = u; lcd.style.setProperty('--u', u.toFixed(4) + 'px'); if (UI.isOpen()) UI.refresh(); if (PP.BattleView.layout) PP.BattleView.layout(); }
  }
  App.fitLcd = fitLcd;
  function boot() {
    var cv = document.getElementById('lcd');
    cv.width = R.W * (R.DPR || 1); cv.height = R.H * (R.DPR || 1);   // 1.9.4: x5 backing store (80 px sprites)
    App.canvas = cv; App.ctx = cv.getContext('2d');
    UI.init(); PP.Input.init();
    fitLcd();
    initTabLock();
    var loaded = PP.Save.load(storage, Date.now());
    App.state = loaded.state;
    if (!App.testAllowed) { App.state.settings.test = false; App.state.settings.speed = 1; }
    if (!App.state.settings.test) App.state.timeOffset = 0;
    applySettings();
    if (loaded.message) App.toast(loaded.message);
    if (storageMode !== 'local') App.toast('Saving is off in this browser (private mode or storage blocked) - progress lasts until you close this tab.');
    App.lastUpdateReal = App.state.lastSeenAt || Date.now();
    PP.Sprites.load(function () {});
    updateSim(true);
    if (App.state.settings.test) PP.TestPanel.show();
    var noGuide = /[?&]guide=0\b/.test(root.location.search);
    if (!App.state.settings.guideSeen && !noGuide) setTimeout(function () { UI.open(UI.screens.guideScreen(0)); }, 300);
    else if (!G.active(App.state)) setTimeout(firstEgg, 300);
    // background ticks: keep the sim (and opt-in alerts) going while the tab is hidden
    setInterval(function () { if (document.hidden) { updateSim(); favicon(); } }, 30000);
    document.getElementById('soundBtn').addEventListener('click', function () {
      PP.Audio.unlock(); App.state.settings.sound = !App.state.settings.sound; PP.Audio.setEnabled(App.state.settings.sound); App.updateSoundBtn(); App.updateBellBtn(); App.save(); PP.Audio.play('ok');
    });
    document.getElementById('testBtn').addEventListener('click', function () { App.toggleTestPanel(); });
    var hintX = document.getElementById('hintClose');
    if (hintX) hintX.addEventListener('click', function (ev) { ev.stopPropagation(); if (hintId) { PP.Hints.dismiss(App.state, hintId); App.save(); } updateHint(); });
    document.getElementById('menuBtn').addEventListener('click', function () { PP.Audio.unlock(); if (App.scene === 'home' && !App.cut) { UI.open(UI.screens.mainMenu); } });
    document.getElementById('bellBtn').addEventListener('click', function () {
      PP.Audio.unlock();
      if (PP.Net && PP.Net.setAlerts) PP.Net.setAlerts(!App.state.settings.alerts);
      else App.toast('Alerts need the live https game');
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { App.save(); if (PP.Net) PP.Net.scheduleAlert(App.state); }
      else { updateSim(true); }
    });
    root.addEventListener('pagehide', function () { App.save(); if (PP.Net) PP.Net.scheduleAlert(App.state); });
    root.addEventListener('resize', fitLcd);
    if (root.ResizeObserver) new root.ResizeObserver(fitLcd).observe(document.querySelector('.lcd'));
    root.requestAnimationFrame(frame);
    initServiceWorker();
    if (navigator.serviceWorker) navigator.serviceWorker.ready.then(function () { if (PP.Net) PP.Net.scheduleAlert(App.state); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(typeof window !== 'undefined' ? window : globalThis);
