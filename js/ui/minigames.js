/* PocketPal 2 - training mini-games. Success/fail only; Care.exercise() pays the reward. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var S = PP.Sprites, F = PP.Font, D = PP.DATA;
  var W = 216, PS = 80;
  var C = { ink: '#0f380f', dark: '#306230', mid: '#8bac0f', bg: '#9bbc0f', lite: 'rgb(206,224,110)' };
  var g = null;

  function moveNames(p) {
    if (!p || p.stage !== 'adult') return ['Play Tumble'];
    return PP.Skills.moveList(p.species, p.skills).map(function (id) {
      return (D.MOVES[id] && D.MOVES[id].name) || id;
    });
  }
  function start(kind, pet, onDone) {
    var speedByStage = { baby: 0.55, child: 0.75, teen: 0.95, adult: 1.15 };
    var moves = moveNames(pet);
    g = { kind: kind, pet: pet, onDone: onDone, round: 0, score: 0, phase: 'play', t0: performance.now(),
      pos: 0, dir: 1, speed: speedByStage[pet.stage] || 0.9, zone: newZone(), last: 0, answer: 0, pick: 0,
      moves: moves, moveI: 0 };
  }
  function newZone() { var c = 0.25 + Math.random() * 0.5; return [c - 0.11, c + 0.11]; }
  function timed() { return g.kind === 'train' || g.kind === 'dummy'; }
  function rounds() { return g.kind === 'game' ? 5 : 3; }
  function need() { return g.kind === 'game' ? 3 : 2; }
  function active() { return !!g; }
  function curMove() { return g.moves[g.moveI % g.moves.length]; }

  function input(btn) {
    if (!g) return;
    if (btn === 'C' && g.phase === 'play') { var cb = g.onDone; g = null; cb(null); return; }
    if (g.phase !== 'play') return;
    var t = performance.now();
    if (timed()) {
      if (btn !== 'B' && btn !== 'A') return;
      g.last = g.pos >= g.zone[0] && g.pos <= g.zone[1] ? 1 : -1;
    } else {
      if (btn !== 'A' && btn !== 'B' && btn !== 'PREV') return;
      g.pick = btn === 'B' ? 1 : -1;
      g.answer = Math.random() < 0.5 ? -1 : 1;
      g.last = g.pick === g.answer ? 1 : -1;
    }
    if (g.last > 0) { g.score++; PP.Audio.play(g.kind === 'dummy' ? 'hit' : 'ok'); }
    else PP.Audio.play('no');
    g.phase = 'show'; g.t0 = t;
  }
  function tap(fracX) {
    if (!g) return;
    if (timed()) input('B');
    else input(fracX < 0.5 ? 'A' : 'B');
  }

  function step(t) {
    if (g.phase === 'play' && timed()) {
      var dt = Math.min(50, t - (g.lastT || t)); g.pos += g.dir * g.speed * dt / 1000;
      if (g.pos > 1) { g.pos = 1; g.dir = -1; } if (g.pos < 0) { g.pos = 0; g.dir = 1; }
    }
    g.lastT = t;
    if (g.phase === 'show' && t - g.t0 > (g.kind === 'dummy' ? 1100 : 900)) {
      g.round++;
      if (g.kind === 'dummy') g.moveI++;
      if (g.round >= rounds()) { g.phase = 'done'; g.t0 = t; PP.Audio.play(g.score >= need() ? 'happy' : 'sad'); }
      else { g.phase = 'play'; g.zone = newZone(); g.last = 0; g.pos = 0; g.dir = 1; }
    }
    if (g.phase === 'done' && t - g.t0 > 1400) { var cb = g.onDone, ok = g.score >= need(); g = null; cb(ok); }
  }

  function dummySack(ctx, x, y, hit) {
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 14, y + 8, 20, 28);
    ctx.fillRect(x + 20, y + 36, 8, 10);
    ctx.fillStyle = hit ? C.mid : C.lite;
    ctx.fillRect(x + 16, y + 10, 16, 24);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 20, y + 16, 3, 3);
    ctx.fillRect(x + 27, y + 16, 3, 3);
    ctx.fillRect(x + 22, y + 24, 8, 2);
  }

  function meter(ctx) {
    var bx = 18, bw = W - 36, by = 124;
    ctx.fillStyle = C.ink; ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
    ctx.fillStyle = C.lite; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = C.mid; ctx.fillRect(bx + Math.round(g.zone[0] * bw), by, Math.round((g.zone[1] - g.zone[0]) * bw), 10);
    var mx = bx + Math.round(g.pos * bw);
    ctx.fillStyle = C.ink; ctx.fillRect(mx - 1, by - 5, 3, 20);
  }

  function draw(ctx, t) {
    if (!g) return;
    step(t); if (!g) return;
    var p = g.pet, sk = S.stageKeyOf(p);
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, 160);
    var title = g.kind === 'train' ? 'POWER TRAINING' : g.kind === 'dummy' ? 'TRAINING DUMMY' : 'LEFT OR RIGHT?';
    F.draw(ctx, title, W / 2, 3, C.ink, 1, 'center');
    F.draw(ctx, 'ROUND ' + Math.min(rounds(), g.round + 1) + '/' + rounds() + '   SCORE ' + g.score, W / 2, 13, C.dark, 1, 'center');
    var done = g.phase === 'done', good = g.score >= need();
    if (g.kind === 'train') {
      var pose = g.phase === 'show' ? (g.last > 0 ? 'attack' : 'sad') : done ? (good ? 'happy' : 'sad') : 'idle';
      S.draw(ctx, p.species, sk, pose, Math.floor(t / 250), (W - PS) / 2, 28, 2.5);
      meter(ctx);
      F.draw(ctx, done ? (good ? 'GREAT TRAINING!' : 'KEEP PRACTISING') : g.phase === 'show' ? (g.last > 0 ? 'POW! HIT!' : 'MISSED') : 'PRESS B IN THE ZONE',
        W / 2, 146, C.ink, 1, 'center');
    } else if (g.kind === 'dummy') {
      var hit = g.phase === 'show' && g.last > 0;
      var dpose = g.phase === 'show' ? (hit ? 'attack' : 'sad') : done ? (good ? 'happy' : 'sad') : 'idle';
      S.draw(ctx, p.species, sk, dpose, Math.floor(t / 180), 8, 28, 2.4);
      dummySack(ctx, 148, 48, hit || (done && good));
      if (hit) S.drawFx(ctx, 'spark', 160, 40, 2);
      F.draw(ctx, curMove().toUpperCase(), W / 2, 112, C.ink, 1, 'center');
      meter(ctx);
      F.draw(ctx, done ? (good ? 'DUMMY DOWN!' : 'TRY THOSE MOVES AGAIN') : g.phase === 'show' ? (hit ? 'HIT! ' + curMove().toUpperCase() : 'WHIFF') : 'TIME THE HIT - SEE YOUR MOVES',
        W / 2, 146, C.ink, 1, 'center');
    } else {
      var face = g.phase === 'play' ? (Math.floor(t / 450) % 2 ? 1 : -1) : g.answer;
      var pose2 = g.phase === 'play' ? 'look' : g.phase === 'show' ? (g.last > 0 ? 'happy' : 'sad') : (good ? 'happy' : 'sad');
      S.draw(ctx, p.species, sk, pose2, g.phase === 'play' ? (face < 0 ? 0 : 1) : Math.floor(t / 300), (W - PS) / 2, 30, 2.5, face < 0);
      F.draw(ctx, '\u25c0 A', 10, 80, g.phase === 'show' && g.pick < 0 ? C.ink : C.dark, 2);
      F.draw(ctx, 'B \u25b6', W - 10, 80, g.phase === 'show' && g.pick > 0 ? C.ink : C.dark, 2, 'right');
      F.draw(ctx, done ? (good ? 'YOU WIN!' : 'BETTER LUCK NEXT TIME') : g.phase === 'show' ? (g.last > 0 ? 'CORRECT!' : 'WRONG WAY') : 'WHICH WAY WILL IT LOOK?',
        W / 2, 140, C.ink, 1, 'center');
    }
    if (g.phase === 'play') F.draw(ctx, 'C: QUIT', W - 3, 152, C.dark, 1, 'right');
  }
  PP.Mini = { start: start, draw: draw, input: input, tap: tap, active: active, abort: function () { g = null; } };
})(typeof window !== 'undefined' ? window : globalThis);
