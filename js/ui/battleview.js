/* PocketPal - battle screen: plays the engine's event list as LCD animations and
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
      waiting: false, auto: !!(opts && opts.auto), cursor: 0, done: false,
      run: null, gone: false, confirm: false, ccur: 0,    // 1.8.4: run-away animation, forfeit confirm
      pending: false,                                     // 1.9.7 live: our pick is sent, waiting for the other player
      ghost: [B.f[0].hp, B.f[1].hp],                       // 2.1.0: the lagging 'chip damage' part of the HP bar
      shake: 0, shakeAmp: 0, burst: null, cheer: 0, t00: null, endFx: null
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
        impact(e.who, t, e.crit);                       // 2.1.0: screen shake + impact burst + the crowd reacts
        if (e.crit) bv.msg += ' CRITICAL HIT!';
        PP.Audio.play(e.crit ? 'crit' : 'hit'); dur = 560; break;
      case 'miss':
        bv.msg = nm(e.who) + ' missed!'; addFloat(1 - e.who, 'MISS', t); PP.Audio.play('miss'); dur = 560; break;
      case 'faint':
        bv.down[e.who] = true; bv.pose[e.who] = 'faint'; bv.msg = nm(e.who) + ' fainted!'; bv.cheer = t; dur = 1000; break;
      case 'recoil':
        bv.pose[e.who] = 'hurt'; bv.hurt = e.who; tweenHp(e.who, e.hp, t); addFloat(e.who, '-' + e.dmg, t); impact(e.who, t, false);
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
      case 'flee':   // 1.8.4: the pal turns round and runs off (or tries to and comes back)
        bv.run = { ok: e.ok, t0: t };
        bv.pose[0] = 'walk';
        bv.msg = e.forfeit ? nm(0) + (bv.B.meta && bv.B.meta.kind === 'arena' ? ' gives up the cup run!' : ' forfeits the battle!') :
          e.ok ? nm(0) + ' ran away!' : nm(0) + " couldn't get away!";
        PP.Audio.play(e.ok ? 'move' : 'no'); dur = e.ok ? 1100 : 900; break;
      case 'end':
        var won = e.winner === 0;
        if (e.live === 'desync' || e.live === 'closed') { bv.msg = e.live === 'closed' ? 'The room closed - battle cancelled, no result.' : 'Out of sync - battle cancelled, no result. Use battle codes instead.'; PP.Audio.play('no'); dur = 2200; break; }
        if (e.live === 'left' || e.live === 'timeout') {
          bv.msg = nm(1) + (e.live === 'left' ? ' left the battle' : ' ran out of time') + ' - YOU WIN!'; bv.pose[0] = 'happy'; bv.endFx = { won: true, t0: t }; PP.Audio.play('win'); dur = 2000; break;
        }
        if (e.live === 'lost-time') { bv.msg = 'You ran out of time - it counts as a loss.'; bv.pose[1] = 'happy'; bv.endFx = { won: false, t0: t }; PP.Audio.play('lose'); dur = 2000; break; }
        if (e.fled === 'escaped') { bv.msg = 'Got away safely! (no XP or coins)'; PP.Audio.play('ok'); dur = 1300; break; }
        if (e.fled === 'forfeit') { bv.msg = 'FORFEIT - it counts as a loss. No XP or coins.'; bv.pose[1] = 'happy'; bv.endFx = { won: false, t0: t, forfeit: true }; PP.Audio.play('lose'); dur = 1500; break; }
        bv.msg = (e.timeout ? 'Time up! ' : '') + (won ? 'YOU WIN!' : 'YOU LOSE...');
        bv.pose[e.winner] = 'happy'; bv.endFx = { won: won, t0: t }; bv.cheer = t;   // 2.1.0: victory / defeat presentation
        PP.Audio.play(won ? 'win' : 'lose'); dur = 1700; break;
    }
    bv.dur = dur * speedK();
  }
  function tweenHp(i, to, t) { bv.hpFrom[i] = bv.hp[i]; bv.hpTo[i] = to; bv.hpT0 = t; if (to > bv.ghost[i]) bv.ghost[i] = to; }
  function impact(i, t, crit) { bv.shake = t; bv.shakeAmp = crit ? 3 : 1.6; bv.burst = { who: i, t0: t, crit: !!crit }; bv.cheer = t; }
  function petX(i) { return i === 0 ? 6 : W - PS - 6; }
  function addFloat(i, text, t) { bv.floats.push({ text: text, x: petX(i) + PS / 2, y: TOP + 30, t0: t }); }
  function addFx(i, name, t, dur) { bv.fx.push({ name: name, x: petX(i) + PS / 2 - 16, y: TOP + 28, t0: t, dur: dur }); }

  function update(t) {
    if (!bv || bv.done) return;
    for (var i = 0; i < 2; i++) {
      var k = Math.min(1, (t - bv.hpT0) / 300);
      bv.hp[i] = Math.round(bv.hpFrom[i] + (bv.hpTo[i] - bv.hpFrom[i]) * k);
      if (bv.ghost[i] > bv.hp[i] && t - bv.hpT0 > 450) bv.ghost[i] = Math.max(bv.hp[i], bv.ghost[i] - Math.max(0.6, bv.B.f[i].maxHp / 90));   // 2.1.0 chip damage drains after the hit
      if (bv.ghost[i] < bv.hp[i]) bv.ghost[i] = bv.hp[i];
    }
    if (bv.pending) { if (bv.opts.live && bv.opts.live.status) bv.msg = bv.opts.live.status(); return; }
    if (bv.waiting) { if (bv.opts.live && bv.opts.live.menuStatus) { var ms = bv.opts.live.menuStatus(); if (ms && ms !== bv.lastMs) { bv.lastMs = ms; bv.msg = ms; showMenu(); } } return; }
    if (bv.cur && t - bv.t0 < bv.dur) return;
    if (bv.queue.length) { begin(bv.queue.shift(), t); return; }
    bv.cur = null;
    if (bv.B.over) { finish(); return; }
    if (bv.auto) { choose(null, t); return; }
    bv.waiting = true; bv.msg = 'What will ' + nm(0) + ' do?'; bv.lastMs = null;
    if (bv.opts.live && bv.opts.live.onMenu) bv.opts.live.onMenu();
    if (bv.auto && bv.opts.live) { choose(null, t); return; }
    showMenu();
  }
  function choose(moveId, t) {
    if (moveId === 'flee' && PP.Battle.forfeits(bv.B) && !bv.confirm) { bv.confirm = true; bv.ccur = 0; PP.Audio.play('move'); showMenu(); return; }
    bv.confirm = false;
    bv.waiting = false; hideMenu();
    if (bv.opts.live) {                                  // 1.9.7: live - send the pick, the turn plays when both are in
      if (moveId === 'flee') { inject(bv.opts.live.forfeit()); return; }
      bv.pending = true; bv.msg = 'Sent! Waiting for ' + nm(1) + '...';
      var mine = bv;
      bv.opts.live.submit(moveId, function (events) {
        if (bv !== mine || bv.done) return;
        bv.pending = false; inject(events);
      });
      return;
    }
    bv.queue = PP.Battle.turn(bv.B, moveId, null);
    begin(bv.queue.shift(), t || performance.now());
  }
  /* 1.9.7 live: play events that came from outside (a resolved turn, a forfeit, a timeout, a desync). */
  function inject(events) {
    if (!bv || bv.done || !events || !events.length) return;
    bv.waiting = false; bv.pending = false; bv.confirm = false; hideMenu();
    bv.queue = bv.queue.concat(events);
    if (!bv.cur || performance.now() - bv.t0 >= bv.dur) begin(bv.queue.shift(), performance.now());
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
    }).concat([fleeItem()]);
  }
  /* 1.8.4: Run (quick battles, with the escape chance) or Forfeit (arena / friend). */
  function fleeItem() {
    if (PP.Battle.forfeits(bv.B)) return { id: 'flee', name: 'Forfeit', ok: true, tag: 'GIVE UP', flee: true };
    return { id: 'flee', name: 'Run', ok: true, tag: Math.round(PP.Battle.fleeChance(bv.B) * 100) + '%', flee: true };
  }
  function confirmText() {
    var m = bv.B.meta || {};
    return m.kind === 'arena' ? 'Give up the ' + D.ARENA[m.rank].name + ' run? It counts as a loss (no injury).' : 'Forfeit this battle? It counts as a loss.';
  }
  function showMenu() {
    if (!menuEl) return;
    if (bv.confirm) {
      menuEl.innerHTML = '<div class="bm-q">' + esc(confirmText()) + '</div><div class="bm-grid">' +
        '<button class="bm' + (bv.ccur === 0 ? ' sel' : '') + '" data-c="0">Keep fighting<small>NO</small></button>' +
        '<button class="bm' + (bv.ccur === 1 ? ' sel' : '') + '" data-c="1">Forfeit<small>YES</small></button></div>';
      menuEl.hidden = false;
      Array.prototype.forEach.call(menuEl.querySelectorAll('button'), function (b) {
        b.addEventListener('click', function (ev) { ev.stopPropagation(); PP.Audio.unlock(); confirmPick(b.dataset.c === '1'); });
      });
      return;
    }
    var list = menuMoves();
    if (!list[bv.cursor] || !list[bv.cursor].ok) bv.cursor = Math.max(0, list.findIndex(function (m) { return m.ok; }));
    var h = '<div class="bm-q">' + esc(bv.msg) + '</div><div class="bm-grid' + (list.length + 1 > 6 ? ' rows3' : '') + '">';
    list.forEach(function (m, i) {
      h += '<button class="bm' + (m.flee ? ' flee' : '') + (i === bv.cursor ? ' sel' : '') + '" data-i="' + i + '"' + (m.ok ? '' : ' disabled') + '>' + esc(m.name) + '<small>' + m.tag + '</small></button>';
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
  function confirmPick(yes) {
    if (yes) { PP.Audio.play('ok'); choose('flee'); }
    else { bv.confirm = false; PP.Audio.play('move'); showMenu(); }
  }
  function hideMenu() { if (menuEl) { menuEl.hidden = true; menuEl.innerHTML = ''; } }

  function input(btn) {
    if (!bv || bv.done || bv.pending) return;
    if (!bv.waiting) {
      if (btn === 'C') bv.auto = true;          // C: let the pal fight on its own
      else if (btn === 'A') bv.auto = false;    // A: take control back at the next turn
      if ((btn === 'B' || btn === 'C') && bv.cur) bv.dur = Math.min(bv.dur, performance.now() - bv.t0 + 120); // skip ahead
      return;
    }
    if (bv.confirm) {             // A / PREV: switch NO <-> YES, B: pick, C: back to the moves
      if (btn === 'A' || btn === 'PREV') { bv.ccur = 1 - bv.ccur; PP.Audio.play('move'); showMenu(); }
      else if (btn === 'B') confirmPick(bv.ccur === 1);
      else if (btn === 'C') confirmPick(false);
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
  /* 2.1.0: a clearer HP bar - framed, 10 % tick marks, the 'chip damage' just taken drains away in DARK after the hit,
   * and the bar blinks when HP is low (under 25 %). Drawn on the x5 backing store (0.2 px detail). */
  function hpBar(ctx, x, y, w, hp, max, ghost, t) {
    var h = 7;
    ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.lite; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    var iw = w - 2, fw = q5(iw * Math.max(0, hp) / max), gw = q5(iw * Math.max(0, ghost == null ? hp : ghost) / max);
    if (gw > fw) { ctx.fillStyle = C.mid; ctx.fillRect(x + 1 + fw, y + 1, gw - fw, h - 2); }
    var low = hp / max < 0.25, blink = low && t != null && Math.floor(t / 260) % 2 === 0;
    ctx.fillStyle = blink ? C.dark : C.ink; ctx.fillRect(x + 1, y + 1, fw, h - 2);
    if (fw > 2) { ctx.fillStyle = low ? C.mid : C.dark; ctx.fillRect(x + 1, y + 1, fw, 0.8); }          // a lit top edge on the fill
    ctx.fillStyle = C.ink;
    for (var k = 1; k < 10; k++) { var tx = q5(x + 1 + iw * k / 10); if (tx > x + 1 + fw) ctx.fillRect(tx - 0.2, y + h - 2.4, 0.4, 1.4); else { ctx.fillStyle = C.lite; ctx.fillRect(tx - 0.2, y + h - 2.4, 0.4, 1.4); ctx.fillStyle = C.ink; } }
  }
  function kindOf() { var m = bv.B.meta || {}; return m.kind || 'quick'; }
  function q5(v) { return Math.round(v * 5) / 5; }   // snap to the x5 backing-store grid: no anti-aliased (off-palette) edges
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  /* backdrop per battle kind: the arena stadium (crowd, cup pennants, spotlights), a friend's park, the wild meadow.
   * The still parts are painted once into an offscreen x5 canvas per kind (fshape scanlines are too slow every frame);
   * only the crowd, pennants, clouds and grass move. 4 tones only, no alpha. */
  var bgCache = {}, stamps = null;
  function offscreen(w, h) {
    if (typeof document === 'undefined' || !document.createElement) return null;
    var c = document.createElement('canvas'); c.width = Math.round(w * 5); c.height = Math.round(h * 5);
    var x = c.getContext && c.getContext('2d'); if (!x) return null;
    x.setTransform(5, 0, 0, 5, 0, 0); x.imageSmoothingEnabled = false; return { c: c, x: x };
  }
  function stillLayer(ctx, kind) {
    var R = PP.Render, G = TOP + PS - 2, fs = R && R.fshape;
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 160);
    if (kind === 'arena') {
      ctx.fillStyle = C.lite; ctx.fillRect(0, 24, W, 44);                 // the stand
      ctx.fillStyle = C.mid; for (var r = 0; r < 3; r++) ctx.fillRect(0, 35 + r * 11, W, 0.6);   // seat rows
      ctx.fillStyle = C.ink; ctx.fillRect(0, 24, W, 0.6);                   // pennant rope
      ctx.fillStyle = C.ink; ctx.fillRect(0, 66, W, 1.2);                   // the barrier
      ctx.fillStyle = C.mid; ctx.fillRect(0, 67.2, W, 2.4);
      ctx.fillStyle = C.ink; ctx.fillRect(0, 69.6, W, 0.6);
      if (fs) {                                                             // dithered spotlight cones on the floor
        ctx.fillStyle = C.lite;
        fs(ctx, 0, 70.2, 80, G - 1, function (u, v) { var k = (v - 70) / (G - 70); return u > 16 + k * 4 && u < 24 + k * 44 && ((Math.round(u * 5) + Math.round(v * 5)) % 4 === 0); });
        fs(ctx, W - 80, 70.2, W, G - 1, function (u, v) { var k = (v - 70) / (G - 70); return u < W - 16 - k * 4 && u > W - 24 - k * 44 && ((Math.round(u * 5) + Math.round(v * 5)) % 4 === 0); });
      }
    } else if (kind === 'friend') {
      ctx.fillStyle = C.mid;
      if (fs) fs(ctx, 0, 52, W, G, function (u, v) { return v > 74 - 14 * Math.sin(u / 34) - 6 * Math.sin(u / 13 + 1); });
      [[10, 58, 1], [W - 12, 54, 1.15], [W / 2 + 4, 52, 0.7]].forEach(function (tr) {   // small trees far away on the hills
        var x = tr[0], y = tr[1], k = tr[2];
        ctx.fillStyle = C.dark; ctx.fillRect(x - 0.6 * k, y, 1.2 * k, 7 * k);
        if (fs) fs(ctx, x - 6 * k, y - 11 * k, x + 6 * k, y + 2 * k, function (u, v) { return R.inDisc(u, v, x, y - 5 * k, 5 * k) || R.inDisc(u, v, x - 3 * k, y - 1 * k, 3.2 * k) || R.inDisc(u, v, x + 3 * k, y - 1 * k, 3.2 * k); });
        ctx.fillStyle = C.lite; if (fs) fs(ctx, x - 4 * k, y - 9 * k, x, y - 4 * k, function (u, v) { return R.inDisc(u, v, x - 1.8 * k, y - 6.6 * k, 1.6 * k); });
      });
    } else {
      ctx.fillStyle = C.mid;
      if (fs) fs(ctx, 0, 60, W, G, function (u, v) { return v > 84 - 8 * Math.sin(u / 22) - 4 * Math.sin(u / 9 + 2); });
    }
    ctx.fillStyle = C.mid; ctx.fillRect(0, G - 1, W, 3);                 // the stage floor
    ctx.fillStyle = C.dark; ctx.fillRect(0, G + 2, W, 0.6);
    if (kind === 'arena') { ctx.fillStyle = C.dark; for (var l = -6; l <= 6; l++) ctx.fillRect(W / 2 + l * 18 - 0.2, G - 1, 0.4, 3); }
  }
  function headStamps() {
    if (stamps !== null) return stamps;
    var R = PP.Render; stamps = false;
    if (!R || !R.fshape) return stamps;
    var out = {};
    [C.mid, C.dark].forEach(function (col) {
      var o = offscreen(6, 9); if (!o) return;
      o.x.fillStyle = col;
      R.fshape(o.x, 0, 0, 6, 9, function (u, v) { return R.inDisc(u, v, 3, 2.6, 2.2) || (v > 4.2 && Math.abs(u - 3) < 2.8); });
      out[col] = o.c;
    });
    if (out[C.mid] && out[C.dark]) stamps = out;
    return stamps;
  }
  function backdrop(ctx, t) {
    var R = PP.Render, kind = kindOf(), G = TOP + PS - 2, fs = R && R.fshape;
    if (!(kind in bgCache)) { var o = offscreen(W, 160); if (o) stillLayer(o.x, kind); bgCache[kind] = o ? o.c : null; }
    if (bgCache[kind]) ctx.drawImage(bgCache[kind], 0, 0, W, 160); else stillLayer(ctx, kind);
    if (kind === 'arena') {
      var hype = bv.cheer ? Math.max(0, 1 - (t - bv.cheer) / 900) : 0, st = headStamps();
      for (var row = 0; row < 3; row++) {
        var y0 = 28 + row * 11, col = row === 1 ? C.mid : C.dark;
        for (var j = 0; j < 30; j++) {
          var hx = 3.6 + j * 7.2 + (row % 2) * 3.6, ph = rnd(j * 3 + row);
          var hy = y0 + Math.sin(t / 380 + ph * 6.28) * 0.6 - hype * (ph > 0.4 ? 2.4 : 1.0) * Math.abs(Math.sin(t / 90 + ph * 6));
          if (st) ctx.drawImage(st[col], q5(hx - 3), q5(hy - 2.6), 6, 9);
          else { ctx.fillStyle = col; ctx.fillRect(hx - 2, hy - 2, 4, 7); }
          if (hype > 0.3 && ph > 0.7) { ctx.fillStyle = col; ctx.fillRect(q5(hx - 3.4), q5(hy - 3 - hype * 2), 0.8, 3); ctx.fillRect(q5(hx + 2.6), q5(hy - 3 - hype * 2), 0.8, 3); }   // arms up
        }
      }
      ctx.fillStyle = C.ink; ctx.fillRect(0, 66, W, 1.2); ctx.fillStyle = C.mid; ctx.fillRect(0, 67.2, W, 2.4); ctx.fillStyle = C.ink; ctx.fillRect(0, 69.6, W, 0.6);   // the barrier in front of the crowd
      for (var p = 0; p < 12; p++) {                                         // cup pennants on the rope
        var px = 9 + p * 18, sw = Math.sin(t / 500 + p) * 0.8;
        ctx.fillStyle = p % 2 ? C.dark : C.ink;
        if (fs) fs(ctx, px - 4, 24.6, px + 5, 31, function (u, v) { var d = (v - 24.6) / 6; return Math.abs(u - px - sw * d) < 3.6 * (1 - d); });
      }
    } else if (kind === 'friend' && fs) {
      ctx.fillStyle = C.lite;
      for (var c2 = 0; c2 < 3; c2++) {
        var cx = q5(((c2 * 83 + t / 120) % (W + 60)) - 30), cy = 34 + c2 * 7;
        fs(ctx, cx - 12, cy - 6, cx + 12, cy + 4, function (u, v) { return v < cy + 3.6 && (R.inDisc(u, v, cx, cy, 5) || R.inDisc(u, v, cx - 6.5, cy + 1.5, 3.6) || R.inDisc(u, v, cx + 6.5, cy + 1.5, 3.8)); });
      }
    } else if (kind !== 'friend') {
      ctx.fillStyle = C.dark;
      for (var g = 0; g < 14; g++) {
        var gx = 6 + g * 15.4 + rnd(g) * 6, sway = q5(Math.sin(t / 600 + g) * 0.8);
        ctx.fillRect(q5(gx) + sway, G - 6, 0.6, 5); ctx.fillRect(q5(gx + 1.4) + sway, G - 4.4, 0.6, 3.4); ctx.fillRect(q5(gx - 1.4) + sway, G - 3.6, 0.6, 2.6);
      }
    }
  }
  function shadow(ctx, x, w) {
    var R = PP.Render, G = TOP + PS - 2; ctx.fillStyle = C.dark;
    if (R && R.fshape) R.fshape(ctx, x - w, G - 1.4, x + w, G + 1.6, function (u, v) { return ((u - x) * (u - x)) / (w * w) + ((v - G - 0.1) * (v - G - 0.1)) / 2.0 <= 1; });
  }
  /* the cup / battle banner: shown big during the intro and at the end; in between, a small marker between the HP bars
   * (arena: one pip per cup foe - filled = beaten, ringed = this one; live/friend/visitor: a short tag) */
  function bannerText() {
    var m = bv.B.meta || {};
    if (m.kind === 'arena' && D.ARENA[m.rank]) return D.ARENA[m.rank].name.toUpperCase() + '  FOE ' + ((m.foe | 0) + 1) + '/' + foeTotal(m);
    if (m.live) return 'LIVE BATTLE';
    if (m.kind === 'friend') return 'FRIEND BATTLE';
    if (m.kind === 'visitor') return 'VISITOR';
    return null;
  }
  function foeTotal(m) { return PP.Arena && PP.Arena.foeCount ? PP.Arena.foeCount(m.rank) : D.ARENA[m.rank].foes.length; }
  function banner(ctx, t) {
    var m = bv.B.meta || {}, R = PP.Render, intro = bv.cur && bv.cur.t === 'intro';
    if (m.kind === 'arena' && D.ARENA[m.rank]) {
      var n = foeTotal(m), cx0 = W / 2 - (n - 1) * 3.5;
      for (var i = 0; i < n; i++) {
        var px = cx0 + i * 7, py = 12.5, done = i < (m.foe | 0), now = i === (m.foe | 0);
        ctx.fillStyle = C.ink;
        if (R && R.fshape) {
          R.fshape(ctx, px - 3, py - 3, px + 3, py + 3, function (u, v) { var d = (u - px) * (u - px) + (v - py) * (v - py); return done ? d <= 6.25 : d <= 6.25 && d >= 2.6; });
          if (now && Math.floor(t / 400) % 2) R.fshape(ctx, px - 1, py - 1, px + 1, py + 1, function (u, v) { return R.inDisc(u, v, px, py, 0.9); });
        } else ctx.fillRect(px - 2, py - 2, 4, 4);
      }
    } else {
      var tag = m.live ? 'LIVE' : m.kind === 'friend' ? 'PAL' : m.kind === 'visitor' ? 'VISIT' : null;
      if (tag) F.draw(ctx, tag, W / 2, 9, C.dark, 1, 'center');
    }
    var txt = bannerText();
    if (!txt || !intro) return;
    var w = F.width(txt, 1) + 10, x = q5((W - w) / 2), y = 28;
    ctx.fillStyle = C.ink; ctx.fillRect(x, y, w, 10);
    ctx.fillStyle = C.lite; ctx.fillRect(x + 0.8, y + 0.8, w - 1.6, 8.4);
    ctx.fillStyle = C.ink; ctx.fillRect(x - 3, y + 2, 3, 6); ctx.fillRect(x + w, y + 2, 3, 6);      // ribbon tails
    ctx.fillStyle = C.bg; ctx.fillRect(x - 3, y + 4.4, 1.4, 1.2); ctx.fillRect(x + w + 1.6, y + 4.4, 1.4, 1.2);
    F.draw(ctx, txt, W / 2, y + 2, C.ink, 1, 'center');
  }
  function burstFx(ctx, t) {
    var b = bv.burst; if (!b) return;
    var k = (t - b.t0) / 260; if (k >= 1) { bv.burst = null; return; }
    var cx = petX(b.who) + PS / 2, cy = TOP + 44, n = b.crit ? 12 : 8, r0 = 8 + k * 10, len = (b.crit ? 9 : 6) * (1 - k);
    ctx.fillStyle = k < 0.5 ? C.ink : C.dark;
    for (var i = 0; i < n; i++) {
      var a = i / n * Math.PI * 2 + (b.crit ? 0.2 : 0);
      for (var s = 0; s < len; s += 0.4) ctx.fillRect(q5(cx + Math.cos(a) * (r0 + s) - 0.4), q5(cy + Math.sin(a) * (r0 + s) - 0.4), 0.8, 0.8);
    }
  }
  function introFx(ctx, t) {
    var e = bv.cur; if (!e || e.t !== 'intro') return 1;
    var k = Math.min(1, (t - bv.t0) / (bv.dur || 1600));
    // name plate sweeps in from the right, 'VS' pops
    var f = bv.B.f[1], plate = f.name.toUpperCase() + '  LV' + f.level, w = F.width(plate, 1) + 14;
    var px = q5(W - w - 4 + Math.max(0, 1 - k * 3) * (w + 10)), py = 74;
    ctx.fillStyle = C.ink; ctx.fillRect(px, py, w, 12);
    ctx.fillStyle = C.dark; ctx.fillRect(px + 1, py + 1, w - 2, 10);
    F.draw(ctx, plate, px + w / 2, py + 3, C.lite, 1, 'center');
    if (k > 0.25 && k < 0.95) {
      var sc = k < 0.35 ? 3 : 2;
      ctx.fillStyle = C.lite; ctx.fillRect(W / 2 - 13, 44, 26, 18);
      ctx.fillStyle = C.ink; ctx.fillRect(W / 2 - 13, 44, 26, 1); ctx.fillRect(W / 2 - 13, 61, 26, 1);
      F.draw(ctx, 'VS', W / 2, sc === 3 ? 46 : 48, C.ink, sc, 'center');
    }
    return Math.min(1, k * 2.5);                      // slide-in progress for the pals
  }
  function endFx(ctx, t) {
    var e = bv.endFx; if (!e) return;
    var k = Math.min(1, (t - e.t0) / 500), txt = e.won ? 'VICTORY!' : (e.forfeit ? 'FORFEIT' : 'DEFEAT');
    if (e.won) {                                      // confetti in all four tones
      var cols = [C.ink, C.dark, C.lite, C.mid];
      for (var i = 0; i < 40; i++) {
        var x = rnd(i) * W, sp = 18 + rnd(i + 99) * 24, y = 20 + ((t - e.t0) / 1000 * sp + rnd(i + 7) * 90) % 92;
        ctx.fillStyle = cols[i % 4]; ctx.fillRect(q5(x + Math.sin(t / 200 + i) * 2), q5(y), 1.4, i % 3 ? 1 : 1.6);
      }
    } else {                                          // grey drizzle
      ctx.fillStyle = C.dark;
      for (var j = 0; j < 26; j++) { var rx = rnd(j) * W, ry = 22 + ((t - e.t0) / 9 + rnd(j + 3) * 90) % 88; ctx.fillRect(q5(rx), q5(ry), 0.4, 3); }
    }
    // 2.2.0: the banner sits over the LOSER's half, so it never covers the winner's head (centred, it hid the face of
    // whichever pal had won - both heads face the middle of the arena)
    var sc = 2, w = F.width(txt, sc) + 16, wi = e.won ? 0 : 1;
    var x0 = q5(Math.max(2, Math.min(W - w - 2, (wi === 0 ? W * 0.75 : W * 0.25) - w / 2))), y0 = q5(40 - (1 - k) * 30);
    e.rect = [x0, y0, w, 22]; e.winner = wi;
    ctx.fillStyle = C.ink; ctx.fillRect(x0, y0, w, 22);
    ctx.fillStyle = e.won ? C.lite : C.mid; ctx.fillRect(x0 + 1.2, y0 + 1.2, w - 2.4, 19.6);
    F.draw(ctx, txt, x0 + w / 2, y0 + 4, C.ink, sc, 'center');
  }
  function draw(ctx, t) {
    if (!bv) return;
    update(t);
    var B = bv.B;
    var sk = bv.shake && t - bv.shake < 220 ? bv.shakeAmp * (1 - (t - bv.shake) / 220) : 0;
    var sx = sk ? Math.round(Math.sin(t / 16) * sk * 5) / 5 : 0, sy = sk ? Math.round(Math.cos(t / 21) * sk * 2.5) / 5 : 0;
    ctx.save(); ctx.translate(sx, sy);
    backdrop(ctx, t);
    var slide = introFx(ctx, t);
    for (var i = 0; i < 2; i++) {
      var f = B.f[i], x = petX(i), off = 0, k = bv.cur ? (t - bv.t0) / bv.dur : 1;
      if (slide < 1) off = (1 - slide) * (PS + 10) * (i === 0 ? -1 : 1);
      if (bv.lunge === i && k < 1) off = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 26 * (i === 0 ? 1 : -1);
      var hide = false, flipMe = i === 1;
      if (i === 0 && bv.run) {      // 1.8.4 flee: turn round and run off to the left (or a few steps and back)
        var rk = Math.min(1, (t - bv.run.t0) / (bv.run.ok ? 900 : 700));
        flipMe = bv.run.ok || rk < 0.8;
        off = bv.run.ok ? -rk * (PS + 12) : -Math.sin(rk * Math.PI) * 18;
        if (bv.run.ok && rk >= 1) bv.gone = true;
        if (!bv.run.ok && rk >= 1) bv.run = null;
      }
      if (i === 0 && bv.gone) hide = true;
      if (bv.hurt === i && k < 0.6) { off += (Math.floor((t - bv.t0) / 60) % 2 ? 2 : -2); hide = Math.floor((t - bv.t0) / 90) % 3 === 2; }
      if (!hide && !bv.down[i]) shadow(ctx, x + off + PS / 2, 22);
      if (!hide) S.draw(ctx, f.species, 'adult_' + f.form, i === 0 && bv.run ? 'walk' : bv.pose[i], Math.floor(t / (i === 0 && bv.run ? 140 : 280)), x + off, TOP, 3, flipMe);
    }
    burstFx(ctx, t);
    bv.fx = bv.fx.filter(function (e) { return t - e.t0 < e.dur; });
    bv.fx.forEach(function (e) { S.drawFx(ctx, e.name, q5(e.x), q5(e.y - (t - e.t0) / 40), 2); });
    endFx(ctx, t);
    ctx.restore();
    // HUD (does not shake): name panels + HP bars, then the cup banner
    for (var h = 0; h < 2; h++) {
      var ff = B.f[h], label = ff.name.toUpperCase() + ' L' + ff.level;
      ctx.fillStyle = C.bg; ctx.fillRect(h === 0 ? 0 : W - 96, 0, 96, 24);
      if (h === 0) { F.draw(ctx, label, 2, 1, C.ink); hpBar(ctx, 2, 9, 90, bv.hp[0], ff.maxHp, bv.ghost[0], t); }
      else { F.draw(ctx, label, W - 2, 1, C.ink, 1, 'right'); hpBar(ctx, W - 92, 9, 90, bv.hp[1], ff.maxHp, bv.ghost[1], t); }
    }
    F.draw(ctx, 'HP ' + bv.hp[0] + '/' + B.f[0].maxHp, 2, 17, C.dark);
    F.draw(ctx, 'HP ' + bv.hp[1] + '/' + B.f[1].maxHp, W - 2, 17, C.dark, 1, 'right');
    banner(ctx, t);
    bv.floats = bv.floats.filter(function (e) { return t - e.t0 < 800; });
    bv.floats.forEach(function (e) {
      var yy = q5(e.y - (t - e.t0) / 40), ex = q5(e.x);
      var fw = F.width(e.text, 2), fx = q5(ex - fw / 2);
      ctx.fillStyle = C.ink; ctx.fillRect(fx - 3, yy - 3, fw + 6, 20);
      ctx.fillStyle = C.lite; ctx.fillRect(fx - 2, yy - 2, fw + 4, 18);
      F.draw(ctx, e.text, ex, yy, C.ink, 2, 'center');
    });
    // message box
    ctx.fillStyle = C.ink; ctx.fillRect(0, BOX, W, 160 - BOX);
    ctx.fillStyle = C.lite; ctx.fillRect(2, BOX + 2, W - 4, 160 - BOX - 4);
    ctx.fillStyle = C.mid; ctx.fillRect(2, BOX + 2, W - 4, 0.8);
    F.wrap(bv.msg, 34).slice(0, 4).forEach(function (line, n) { F.draw(ctx, line, 6, BOX + 7 + n * 10, C.ink); });
    if (bv.waiting && Math.floor(t / 400) % 2) { ctx.fillStyle = C.ink; ctx.fillRect(W - 10, 160 - 9, 4, 1); ctx.fillRect(W - 9.4, 160 - 8, 2.8, 1); ctx.fillRect(W - 8.8, 160 - 7, 1.6, 1); }   // 'your turn' cursor
    if (bv.auto && !B.over) F.draw(ctx, 'AUTO', W - 6, 160 - 12, C.dark, 1, 'right');
  }
  function abort() { if (bv) { bv.done = true; } hideMenu(); bv = null; }

  PP.BattleView = { start: start, draw: draw, input: input, active: active, abort: abort, inject: inject, _state: function () { return bv; }, _geom: { W: W, PS: PS, TOP: TOP, petX: petX } };
})(typeof window !== 'undefined' ? window : globalThis);
