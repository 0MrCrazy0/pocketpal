/* PocketPal 2 - battle screen: plays the engine's event list as LCD animations and
 * shows the move menu. All rules live in core/battle.js; this file only presents. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var S = PP.Sprites, F = PP.Font, D = PP.DATA;
  var W = 216, PS = 96, TOP = 14, BOX = 112;
  var C = { ink: '#0f380f', dark: '#306230', mid: '#8bac0f', bg: '#9bbc0f', lite: 'rgb(206,224,110)' };
  var STAT = { atk: 'ATK', def: 'DEF', spd: 'SPD' };
  var bv = null, menuEl = null;

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function nm(i) { return bv.B.f[i].name.toUpperCase(); }

  function start(B, opts) {
    menuEl = document.getElementById('bmenu');
    bv = {
      B: B, opts: opts || {}, queue: [{ t: 'intro' }], cur: null, t0: 0,
      hp: [B.f[0].hp, B.f[1].hp], hpFrom: [B.f[0].hp, B.f[1].hp], hpTo: [B.f[0].hp, B.f[1].hp], hpT0: 0,
      pose: ['idle', 'idle'], down: [false, false], lunge: -1, hurt: -1, msg: '', floats: [], fx: [],
      waiting: false, auto: !!(opts && opts.auto), cursor: 0, done: false
    };
    hideMenu();
  }
  function active() { return !!bv && !bv.done; }

  function speedK() { return bv.auto ? 0.6 : 1; }
  function begin(e, t) {
    var B = bv.B, dur = 600;
    bv.cur = e; bv.t0 = t; bv.lunge = -1; bv.hurt = -1;
    bv.pose = [bv.down[0] ? 'faint' : 'idle', bv.down[1] ? 'faint' : 'idle'];
    switch (e.t) {
      case 'intro':
        bv.msg = (bv.opts.title ? bv.opts.title + ': ' : '') + nm(1) + ' (LV' + B.f[1].level + ', BP ' + B.f[1].bp + ') wants to battle!';
        dur = 1600; break;
      case 'move':
        var m = D.MOVES[e.move];
        bv.msg = nm(e.who) + ' used ' + m.name.toUpperCase() + '!';
        bv.pose[e.who] = m.power > 0 ? 'attack' : 'happy';
        if (m.power > 0) bv.lunge = e.who;
        PP.Audio.play('move'); dur = 700; break;
      case 'hit':
        bv.pose[e.who] = 'hurt'; bv.hurt = e.who; tweenHp(e.who, e.hp, t);
        addFloat(e.who, '-' + e.dmg, t); addFx(e.who, e.crit ? 'spark2' : 'spark', t, 400);
        if (e.crit) bv.msg += ' CRITICAL HIT!';
        PP.Audio.play(e.crit ? 'crit' : 'hit'); dur = 560; break;
      case 'miss':
        bv.msg = nm(e.who) + ' missed!'; addFloat(1 - e.who, 'MISS', t); PP.Audio.play('miss'); dur = 560; break;
      case 'faint':
        bv.down[e.who] = true; bv.pose[e.who] = 'faint'; bv.msg = nm(e.who) + ' fainted!'; dur = 1000; break;
      case 'recoil':
        bv.pose[e.who] = 'hurt'; bv.hurt = e.who; tweenHp(e.who, e.hp, t); addFloat(e.who, '-' + e.dmg, t);
        bv.msg = nm(e.who) + ' is hurt by the impact!'; dur = 600; break;
      case 'heal':
        tweenHp(e.who, e.hp, t); addFloat(e.who, '+' + e.amt, t); addFx(e.who, 'heart', t, 600); bv.pose[e.who] = 'happy';
        bv.msg = nm(e.who) + ' recovered ' + e.amt + ' HP!'; PP.Audio.play('heal'); dur = 700; break;
      case 'buff':
        bv.msg = nm(e.who) + "'s " + STAT[e.stat] + (e.up ? ' rose!' : ' fell!');
        addFx(e.who, e.up ? 'star' : 'sweat', t, 600); bv.pose[e.who] = e.up ? 'happy' : 'sad'; dur = 650; break;
      case 'evade':
        bv.msg = nm(e.who) + ' is ready to dodge!'; addFx(e.who, 'bubble', t, 600); dur = 650; break;
      case 'bleedStart':
        bv.msg = nm(e.who) + ' is bleeding!'; dur = 600; break;
      case 'bleed':
        tweenHp(e.who, e.hp, t); addFloat(e.who, '-' + e.dmg, t); bv.pose[e.who] = 'hurt';
        bv.msg = nm(e.who) + ' is hurt by bleeding!'; dur = 600; break;
      case 'stun':
        bv.msg = nm(e.who) + ' is stunned!'; addFx(e.who, 'swirl', t, 700); dur = 700; break;
      case 'stunned':
        bv.msg = nm(e.who) + " is stunned and can't move!"; addFx(e.who, 'swirl', t, 700); bv.pose[e.who] = 'sad'; dur = 700; break;
      case 'rest':
        bv.msg = nm(e.who) + ' is hibernating...'; addFx(e.who, 'zzz', t, 700); bv.pose[e.who] = 'sleep'; dur = 700; break;
      case 'end':
        var won = e.winner === 0;
        bv.msg = (e.timeout ? 'Time up! ' : '') + (won ? 'YOU WIN!' : 'YOU LOSE...');
        bv.pose[e.winner] = 'happy';
        PP.Audio.play(won ? 'win' : 'lose'); dur = 1700; break;
    }
    bv.dur = dur * speedK();
  }
  function tweenHp(i, to, t) { bv.hpFrom[i] = bv.hp[i]; bv.hpTo[i] = to; bv.hpT0 = t; }
  function petX(i) { return i === 0 ? 6 : W - PS - 6; }
  function addFloat(i, text, t) { bv.floats.push({ text: text, x: petX(i) + PS / 2, y: TOP + 30, t0: t }); }
  function addFx(i, name, t, dur) { bv.fx.push({ name: name, x: petX(i) + PS / 2 - 16, y: TOP + 28, t0: t, dur: dur }); }

  function update(t) {
    if (!bv || bv.done) return;
    for (var i = 0; i < 2; i++) {
      var k = Math.min(1, (t - bv.hpT0) / 300);
      bv.hp[i] = Math.round(bv.hpFrom[i] + (bv.hpTo[i] - bv.hpFrom[i]) * k);
    }
    if (bv.waiting) return;
    if (bv.cur && t - bv.t0 < bv.dur) return;
    if (bv.queue.length) { begin(bv.queue.shift(), t); return; }
    bv.cur = null;
    if (bv.B.over) { finish(); return; }
    if (bv.auto) { choose(null, t); return; }
    bv.waiting = true; bv.msg = 'What will ' + nm(0) + ' do?';
    showMenu();
  }
  function choose(moveId, t) {
    bv.waiting = false; hideMenu();
    bv.queue = PP.Battle.turn(bv.B, moveId, null);
    begin(bv.queue.shift(), t || performance.now());
  }
  function finish() {
    bv.done = true; hideMenu();
    if (bv.opts.onEnd) bv.opts.onEnd(bv.B);
  }

  /* ------------------------------------------------------------ move menu (HTML, tappable) */
  function menuMoves() {
    var f = bv.B.f[0], ready = PP.Battle.available(f);
    return f.moves.map(function (id) {
      var m = D.MOVES[id], ok = ready.indexOf(id) >= 0, tag;
      if (!ok) tag = m.uses && (f.used[id] || 0) >= m.uses ? 'USED' : 'WAIT ' + f.cds[id];
      else tag = m.power > 0 ? 'PWR ' + m.power + (m.hits ? 'x' + m.hits[1] : '') : (m.fx && m.fx[0].t === 'heal' ? 'HEAL' : 'SUPPORT');
      return { id: id, name: m.name, ok: ok, tag: tag };
    });
  }
  function showMenu() {
    if (!menuEl) return;
    var list = menuMoves();
    if (!list[bv.cursor] || !list[bv.cursor].ok) bv.cursor = Math.max(0, list.findIndex(function (m) { return m.ok; }));
    var h = '<div class="bm-q">' + esc(bv.msg) + '</div><div class="bm-grid' + (list.length + 1 > 6 ? ' rows3' : '') + '">';
    list.forEach(function (m, i) {
      h += '<button class="bm' + (i === bv.cursor ? ' sel' : '') + '" data-i="' + i + '"' + (m.ok ? '' : ' disabled') + '>' + esc(m.name) + '<small>' + m.tag + '</small></button>';
    });
    h += '<button class="bm auto" data-auto="1">AUTO<small>C</small></button></div>';
    menuEl.innerHTML = h; menuEl.hidden = false;
    Array.prototype.forEach.call(menuEl.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation(); PP.Audio.unlock();
        if (b.dataset.auto) { bv.auto = true; PP.Audio.play('ok'); choose(null); return; }
        var m = list[+b.dataset.i]; if (m && m.ok) { PP.Audio.play('ok'); choose(m.id); }
      });
    });
  }
  function hideMenu() { if (menuEl) { menuEl.hidden = true; menuEl.innerHTML = ''; } }

  function input(btn) {
    if (!bv || bv.done) return;
    if (!bv.waiting) {
      if (btn === 'C') bv.auto = true;          // C: let the pal fight on its own
      else if (btn === 'A') bv.auto = false;    // A: take control back at the next turn
      if ((btn === 'B' || btn === 'C') && bv.cur) bv.dur = Math.min(bv.dur, performance.now() - bv.t0 + 120); // skip ahead
      return;
    }
    var list = menuMoves();
    if (btn === 'A' || btn === 'PREV') {
      var n = list.length, d = btn === 'A' ? 1 : -1;
      for (var k = 0; k < n; k++) { bv.cursor = (bv.cursor + d + n) % n; if (list[bv.cursor].ok) break; }
      PP.Audio.play('move'); showMenu();
    } else if (btn === 'B') {
      var m = list[bv.cursor]; if (m && m.ok) { PP.Audio.play('ok'); choose(m.id); }
    } else if (btn === 'C') { PP.Audio.play('ok'); choose(null); }
  }

  /* ------------------------------------------------------------ drawing */
  function hpBar(ctx, x, y, w, hp, max) {
    ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = C.lite; ctx.fillRect(x + 1, y + 1, w - 2, 4);
    var fw = Math.round((w - 2) * Math.max(0, hp) / max);
    ctx.fillStyle = hp / max < 0.25 ? C.dark : C.ink; ctx.fillRect(x + 1, y + 1, fw, 4);
  }
  function draw(ctx, t) {
    if (!bv) return;
    update(t);
    var B = bv.B;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 160);
    // ground
    ctx.fillStyle = C.mid; ctx.fillRect(0, TOP + PS - 2, W, 3);
    for (var i = 0; i < 2; i++) {
      var f = B.f[i], x = petX(i), off = 0, k = bv.cur ? (t - bv.t0) / bv.dur : 1;
      if (bv.lunge === i && k < 1) off = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 26 * (i === 0 ? 1 : -1);
      var hide = false;
      if (bv.hurt === i && k < 0.6) { off += (Math.floor((t - bv.t0) / 60) % 2 ? 2 : -2); hide = Math.floor((t - bv.t0) / 90) % 3 === 2; }
      if (!hide) S.draw(ctx, f.species, 'adult_' + f.form, bv.pose[i], Math.floor(t / 280), x + off, TOP, 3, i === 1);
      // name + hp
      var label = f.name.toUpperCase() + ' L' + f.level;
      if (i === 0) { F.draw(ctx, label, 2, 1, C.ink); hpBar(ctx, 2, 9, 90, bv.hp[0], f.maxHp); }
      else { F.draw(ctx, label, W - 2, 1, C.ink, 1, 'right'); hpBar(ctx, W - 92, 9, 90, bv.hp[1], f.maxHp); }
    }
    F.draw(ctx, bv.hp[0] + '/' + B.f[0].maxHp, 2, 17, C.dark);
    F.draw(ctx, bv.hp[1] + '/' + B.f[1].maxHp, W - 2, 17, C.dark, 1, 'right');
    bv.fx = bv.fx.filter(function (e) { return t - e.t0 < e.dur; });
    bv.fx.forEach(function (e) { S.drawFx(ctx, e.name, e.x, e.y - (t - e.t0) / 40, 2); });
    bv.floats = bv.floats.filter(function (e) { return t - e.t0 < 800; });
    bv.floats.forEach(function (e) {
      var yy = e.y - (t - e.t0) / 40;
      ctx.fillStyle = C.lite; ctx.fillRect(e.x - F.width(e.text, 2) / 2 - 2, yy - 2, F.width(e.text, 2) + 4, 18);
      F.draw(ctx, e.text, e.x, yy, C.ink, 2, 'center');
    });
    // message box
    ctx.fillStyle = C.ink; ctx.fillRect(0, BOX, W, 160 - BOX);
    ctx.fillStyle = C.lite; ctx.fillRect(2, BOX + 2, W - 4, 160 - BOX - 4);
    F.wrap(bv.msg, 34).slice(0, 4).forEach(function (line, n) { F.draw(ctx, line, 6, BOX + 7 + n * 10, C.ink); });
    if (bv.auto && !B.over) F.draw(ctx, 'AUTO', W - 6, 160 - 12, C.dark, 1, 'right');
  }
  function abort() { if (bv) { bv.done = true; } hideMenu(); bv = null; }

  PP.BattleView = { start: start, draw: draw, input: input, active: active, abort: abort, _state: function () { return bv; } };
})(typeof window !== 'undefined' ? window : globalThis);
