/* PocketPal - training mini-games. Success/fail only; Care.exercise() pays the reward. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var S = PP.Sprites, F = PP.Font, D = PP.DATA;
  // 1.8.3: sprites are drawn at whole-pixel sizes only. 1.9.4: 80-px cells on the x5 backing store: scale 3 = 96 LCD px (6x), 1.5 = 48 LCD px (3x)
  var W = 216, PS = 96, BIG = 3, CARD = 1.5;
  var C = { ink: '#0f380f', dark: '#306230', mid: '#8bac0f', bg: '#9bbc0f', lite: 'rgb(206,224,110)' };
  var g = null;
  var now = function () { return performance.now(); };   // swappable clock for the Node tests

  function moveNames(p) {
    if (!p || p.stage !== 'adult') return ['Play Tumble'];
    return PP.Skills.moveList(p.species, p.skills).map(function (id) {
      return (D.MOVES[id] && D.MOVES[id].name) || id;
    });
  }
  function start(kind, pet, onDone) {
    var speedByStage = { baby: 0.55, child: 0.75, teen: 0.95, adult: 1.15 };
    var moves = moveNames(pet);
    g = { kind: kind, pet: pet, onDone: onDone, round: 0, score: 0, phase: 'play', t0: now(),
      pos: 0, dir: 1, speed: speedByStage[pet.stage] || 0.9, zone: newZone(), last: 0, answer: 0, pick: 0,
      moves: moves, moveI: 0 };
    if (kind === 'memory') seqStart(now());
    if (kind === 'match') { memDeal(g); g.phase = 'preview'; g.t0 = now(); }
  }
  function newZone() { var c = 0.25 + Math.random() * 0.5; return [c - 0.11, c + 0.11]; }
  function timed() { return g.kind === 'train' || g.kind === 'dummy'; }
  /* Match (1.8.2): ONE deal of 8 cards (4 pairs). All cards show face-up for MATCH_PREVIEW_MS, then flip down.
   * Find all 4 pairs before the 3rd miss. Simulated (work/matchsim.js): random clicker wins ~7%, a player who
   * remembers what they saw wins 98-100%. */
  var MEM_CARDS = 8, MEM_PAIRS = 4, MEM_MISSES = 3, MATCH_PREVIEW_MS = 1800;
  /* Memory (1.8.1): Simon-style. The pal looks LEFT or RIGHT in a sequence; repeat it.
   * Round 1 is 3 looks, each round adds one (3, 4, 5). Clear 3 rounds to win; one wrong look ends the game. */
  var SEQ = { start: 3, rounds: 3, onMs: 650, gapMs: 300, leadMs: 700, echoMs: 260 };
  function rounds() { return g.kind === 'match' ? MEM_PAIRS : g.kind === 'memory' ? SEQ.rounds : g.kind === 'game' ? 5 : 3; }
  // 1.8.2: Left or Right needs 4 of 5 (was 3 of 5 = a coin flip for a random presser: 50% -> 19%; watching the eyes still wins every time)
  function need() { return g.kind === 'match' ? MEM_PAIRS : g.kind === 'memory' ? SEQ.rounds : g.kind === 'game' ? 4 : 2; }
  /* Pure sequence logic (also used by the Node tests): */
  function seqNew(rng) { var r = rng || Math.random, out = []; for (var i = 0; i < SEQ.start; i++) out.push(r() < 0.5 ? -1 : 1); return out; }
  function seqGrow(seq, rng) { var r = rng || Math.random; return seq.concat([r() < 0.5 ? -1 : 1]); }
  /* One press: returns 'ok' (keep going), 'round' (sequence finished), or 'miss'. */
  function seqPress(st, dir) {
    if (dir !== st.seq[st.pos]) return 'miss';
    st.pos++;
    return st.pos >= st.seq.length ? 'round' : 'ok';
  }
  function active() { return !!g; }
  function curMove() { return g.moves[g.moveI % g.moves.length]; }

  function input(btn) {
    if (!g) return;
    if (btn === 'C' && (g.phase === 'play' || (g.kind === 'memory' && g.phase === 'watch') || (g.kind === 'match' && g.phase === 'preview'))) { var cb = g.onDone; g = null; cb(null); return; }
    if (g.phase !== 'play') return;
    var t = now();
    if (g.kind === 'memory') { if (btn === 'A' || btn === 'PREV' || btn === 'LEFT') seqInput(-1); else if (btn === 'B' || btn === 'RIGHT') seqInput(1); return; }
    if (g.kind === 'match') {
      if (!g.cards) memDeal(g);
      if (btn === 'RIGHT') btn = 'A';
      if (btn === 'LEFT') btn = 'PREV';
      if (btn === 'A' || btn === 'PREV') { g.slot = ((g.slot || 0) + (btn === 'PREV' ? MEM_CARDS - 1 : 1)) % MEM_CARDS; PP.Audio.play('move'); return; }
      if (btn === 'B') { memTap(g.slot || 0); return; }
      return;
    }
    if (btn === 'LEFT') btn = timed() ? 'A' : 'PREV';
    if (btn === 'RIGHT') btn = timed() ? 'A' : 'B';
    if (timed()) {
      if (btn !== 'B' && btn !== 'A') return;
      g.last = g.pos >= g.zone[0] && g.pos <= g.zone[1] ? 1 : -1;
    } else {
      if (btn !== 'A' && btn !== 'B' && btn !== 'PREV') return;
      g.pick = btn === 'B' ? 1 : -1;
      if (!g.answer) g.answer = Math.random() < 0.5 ? -1 : 1;
      g.last = g.pick === g.answer ? 1 : -1;
    }
    if (g.last > 0) { g.score++; PP.Audio.play(g.kind === 'dummy' ? 'hit' : 'ok'); }
    else PP.Audio.play('no');
    g.phase = 'show'; g.t0 = t;
  }
  function tap(fracX, fracY) {
    if (!g) return;
    if (g.kind === 'memory') { seqInput(fracX < 0.5 ? -1 : 1); return; }
    if (g.kind === 'match') {
      if (!g.cards) memDeal(g);
      var i = memCardAt(fracX * W, (fracY == null ? 0.3 : fracY) * 160);
      if (i >= 0) { g.slot = i; memTap(i); }
      return;
    }
    if (timed()) input('B');
    else input(fracX < 0.5 ? 'A' : 'B');
  }

  /* ---- Memory (sequence) ---- */
  function seqStart(t) { g.seq = seqNew(); g.phase = 'watch'; g.t0 = t; g.cue = -1; g.seen = 0; g.pos = 0; g.echo = 0; }
  function seqInput(dir) {
    if (!g || g.phase !== 'play' || !g.seq) return;
    var t = now();
    g.echo = dir; g.echoT = t;                          // the pal turns the way you pressed
    var r = seqPress(g, dir);
    PP.Audio.play(dir < 0 ? 'lookL' : 'lookR');
    if (r === 'miss') { g.last = -1; g.phase = 'show'; g.t0 = t; PP.Audio.play('no'); }
    else if (r === 'round') { g.score++; g.last = 1; g.phase = 'show'; g.t0 = t; PP.Audio.play('ok'); }
  }
  function seqStep(t) {
    if (!g.seq) seqStart(t);
    if (g.phase === 'watch') {
      var e = t - g.t0 - SEQ.leadMs, slot = SEQ.onMs + SEQ.gapMs;
      var i = e < 0 ? -1 : Math.floor(e / slot), on = e >= 0 && (e % slot) < SEQ.onMs;
      var cue = i >= 0 && i < g.seq.length && on ? i : -1;
      if (cue >= 0 && cue !== g.cue) PP.Audio.play(g.seq[cue] < 0 ? 'lookL' : 'lookR');
      g.cue = cue; if (cue >= 0) g.seen = Math.max(g.seen || 0, cue + 1);
      if (i >= g.seq.length) { g.phase = 'play'; g.pos = 0; g.echo = 0; g.playT0 = t; }
      return true;
    }
    if (g.phase === 'show' && t - g.t0 > 900) {
      g.round = g.score;
      if (g.last < 0 || g.score >= SEQ.rounds) { g.phase = 'done'; g.t0 = t; PP.Audio.play(g.score >= need() ? 'happy' : 'sad'); }
      else { g.seq = seqGrow(g.seq); g.phase = 'watch'; g.t0 = t; g.cue = -1; g.seen = 0; g.pos = 0; g.echo = 0; g.last = 0; }
    }
    return false;
  }
  function drawSeq(ctx, t, p, sk, done, good) {
    var dir = 0, pose = 'sit', fr = 0;
    if (g.phase === 'watch' && g.cue >= 0) dir = g.seq[g.cue];
    else if ((g.phase === 'play' || g.phase === 'show') && g.echo && t - g.echoT < 450) dir = g.echo;
    if (dir) { pose = 'look'; fr = 1; }
    if (g.phase === 'show' && t - g.echoT >= 450) { pose = g.last > 0 ? 'happy' : 'sad'; fr = Math.floor(t / 300); }
    if (done) { pose = good ? 'happy' : 'sad'; fr = Math.floor(t / 300); }
    S.draw(ctx, p.species, sk, pose, fr, (W - PS) / 2, 21, BIG, dir < 0);
    // arrow cue on the side the pal looks (filled = now), and the two answer buttons
    var lOn = dir < 0, rOn = dir > 0;
    F.draw(ctx, '\u25c0', 22, 66, lOn ? C.ink : C.mid, lOn ? 4 : 2, 'center');
    F.draw(ctx, '\u25b6', W - 22, 66, rOn ? C.ink : C.mid, rOn ? 4 : 2, 'center');
    // progress pips: one per look in this round
    var n = g.seq.length, x0 = W / 2 - n * 5;
    for (var i = 0; i < n; i++) {
      var filled = g.phase === 'watch' ? i < (g.seen || 0) : i < g.pos;
      ctx.fillStyle = C.ink; ctx.fillRect(x0 + i * 10, 118, 8, 6);
      ctx.fillStyle = filled ? C.dark : C.lite; ctx.fillRect(x0 + i * 10 + 1, 119, 6, 4);
    }
    var msg = done ? (good ? 'GREAT MEMORY!' : 'OOPS - TRY AGAIN')
      : g.phase === 'watch' ? 'WATCH...'
      : g.phase === 'show' ? (g.last > 0 ? 'ROUND CLEAR!' : 'WRONG WAY!')
      : 'YOUR TURN! ' + g.pos + '/' + n;
    F.draw(ctx, msg, W / 2, 132, C.ink, 1, 'center');
  }

  function step(t) {
    if (g.kind === 'match' && g.phase === 'preview' && t - g.t0 >= MATCH_PREVIEW_MS) { g.phase = 'play'; g.t0 = t; PP.Audio.play('move'); }
    if (g.kind === 'memory') {
      seqStep(t);
      if (g.phase === 'done' && t - g.t0 > 1400) { var cb0 = g.onDone, ok0 = g.score >= need(); g = null; cb0(ok0); }
      return;
    }
    if (g.phase === 'play' && timed()) {
      var dt = Math.min(50, t - (g.lastT || t)); g.pos += g.dir * g.speed * dt / 1000;
      if (g.pos > 1) { g.pos = 1; g.dir = -1; } if (g.pos < 0) { g.pos = 0; g.dir = 1; }
    }
    g.lastT = t;
    if (g.phase === 'show' && t - g.t0 > (g.kind === 'dummy' ? 1100 : 900)) {
      var over;
      if (g.kind === 'match') {
        g.open = [];
        g.round = g.score;                                   // pairs found so far
        over = g.score >= MEM_PAIRS || g.misses >= MEM_MISSES;
      } else { g.round++; over = g.round >= rounds(); }
      if (g.kind === 'dummy') g.moveI++;
      if (over) { g.phase = 'done'; g.t0 = t; PP.Audio.play(g.score >= need() ? 'happy' : 'sad'); }
      else { g.phase = 'play'; g.zone = newZone(); g.last = 0; g.pos = 0; g.dir = 1; g.answer = 0; g.pick = 0; g.playT0 = t; }
    }
    if (g.phase === 'done' && t - g.t0 > 1400) { var cb = g.onDone, ok = g.score >= need(); g = null; cb(ok); }
  }


  /* 1.8.3: only poses whose eyes are OPEN in every frame of every stage (tests/minigames.test.js checks the
   * sprite-faces fixture). 1.8.2 used happy / sleep / eat / dance, whose closed or ^-shaped eyes looked like a line or a dot. */
  var MEM_POSES = ['idle', 'surprised', 'angry', 'sad', 'attack'];
  var CARD_W = 50, CARD_H = 54, CARD_X0 = 2, CARD_DX = 54, CARD_Y0 = 24, CARD_DY = 58, CARD_COLS = 4;
  function memDeal(g) {
    var bag = MEM_POSES.slice(), cards = [];
    for (var k = 0; k < MEM_PAIRS; k++) { var po = bag.splice(Math.floor(Math.random() * bag.length), 1)[0]; cards.push(po, po); }
    for (var i = cards.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)); var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
    }
    g.cards = cards; g.open = []; g.matched = cards.map(function () { return 0; }); g.misses = 0; g.slot = 0;
  }
  function cardXY(i) { return [CARD_X0 + (i % CARD_COLS) * CARD_DX, CARD_Y0 + Math.floor(i / CARD_COLS) * CARD_DY]; }
  function memCardAt(x, y) {
    for (var i = 0; i < MEM_CARDS; i++) { var c = cardXY(i); if (x >= c[0] && x < c[0] + CARD_W && y >= c[1] && y < c[1] + CARD_H) return i; }
    return -1;
  }
  function memTap(i) {
    if (!g || g.kind !== 'match' || g.phase !== 'play') return;
    if (!g.cards) memDeal(g);
    if (i < 0 || i >= MEM_CARDS || g.matched[i] || g.open.indexOf(i) >= 0) return;
    if (g.open.length >= 2) return;
    g.open.push(i);
    if (g.open.length === 2) {
      g.last = g.cards[g.open[0]] === g.cards[g.open[1]] ? 1 : -1;
      if (g.last > 0) { g.matched[g.open[0]] = g.matched[g.open[1]] = 1; g.score++; PP.Audio.play('ok'); }
      else { g.misses++; PP.Audio.play('no'); }
      g.phase = 'show'; g.t0 = now();
    } else PP.Audio.play('move');
  }
  function drawMemory(ctx, t, p, sk, done, good) {
    if (!g.cards) memDeal(g);
    for (var i = 0; i < MEM_CARDS; i++) {
      var c = cardXY(i), cx = c[0], cy = c[1];
      var sel = !done && g.phase === 'play' && (g.slot || 0) === i;
      ctx.fillStyle = C.ink; ctx.fillRect(cx, cy, CARD_W, CARD_H);
      ctx.fillStyle = g.matched[i] ? C.mid : C.lite; ctx.fillRect(cx + 2, cy + 2, CARD_W - 4, CARD_H - 4);
      if (sel) { ctx.fillStyle = C.ink; ctx.fillRect(cx + 3, cy + CARD_H - 6, CARD_W - 6, 2); }   // cursor (A / arrow keys move it, B flips)
      var show = g.matched[i] || g.open.indexOf(i) >= 0 || done || g.phase === 'preview';
      if (show) S.draw(ctx, p.species, sk, g.cards[i], Math.floor(t / 300), cx + 1, cy + 2, CARD);   // 1:1 pixels, open-eye poses
      else F.draw(ctx, '?', cx + CARD_W / 2, cy + 17, C.dark, 3, 'center');
    }
    var left = g.phase === 'preview' ? Math.max(0, Math.ceil((MATCH_PREVIEW_MS - (t - g.t0)) / 1000)) : 0;
    F.draw(ctx, done ? (good ? 'NICE MEMORY!' : 'TRY AGAIN') : g.phase === 'preview' ? 'REMEMBER THEM! ' + left
      : g.phase === 'show' ? (g.last > 0 ? 'MATCH!' : 'NO MATCH') : 'FIND THE ' + MEM_PAIRS + ' PAIRS',
      W / 2, 143, C.ink, 1, 'center');
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
    var title = g.kind === 'train' ? 'POWER TRAINING' : g.kind === 'dummy' ? 'TRAINING DUMMY' : g.kind === 'memory' ? 'MEMORY' : g.kind === 'match' ? 'MATCH' : 'LEFT OR RIGHT?';
    F.draw(ctx, title, W / 2, 3, C.ink, 1, 'center');
    if (g.kind === 'memory') F.draw(ctx, 'ROUND ' + Math.min(SEQ.rounds, g.score + 1) + '/' + SEQ.rounds + '   LENGTH ' + (g.seq ? g.seq.length : SEQ.start), W / 2, 13, C.dark, 1, 'center');
    else if (g.kind === 'match') F.draw(ctx, 'PAIRS ' + g.score + '/' + MEM_PAIRS + '   MISSES ' + (g.misses || 0) + '/' + MEM_MISSES, W / 2, 13, C.dark, 1, 'center');
    else F.draw(ctx, 'ROUND ' + Math.min(rounds(), g.round + 1) + '/' + rounds() + '   SCORE ' + g.score, W / 2, 13, C.dark, 1, 'center');
    var done = g.phase === 'done', good = g.score >= need();
    if (g.kind === 'train') {
      var pose = g.phase === 'show' ? (g.last > 0 ? 'attack' : 'sad') : done ? (good ? 'happy' : 'sad') : 'idle';
      S.draw(ctx, p.species, sk, pose, Math.floor(t / 250), (W - PS) / 2, 21, BIG);
      meter(ctx);
      F.draw(ctx, done ? (good ? 'GREAT TRAINING!' : 'KEEP PRACTISING') : g.phase === 'show' ? (g.last > 0 ? 'POW! HIT!' : 'MISSED') : 'PRESS B IN THE ZONE',
        W / 2, 146, C.ink, 1, 'center');
    } else if (g.kind === 'dummy') {
      var hit = g.phase === 'show' && g.last > 0;
      var dpose = g.phase === 'show' ? (hit ? 'attack' : 'sad') : done ? (good ? 'happy' : 'sad') : 'idle';
      S.draw(ctx, p.species, sk, dpose, Math.floor(t / 180), 4, 19, BIG);
      dummySack(ctx, 148, 48, hit || (done && good));
      if (hit) S.drawFx(ctx, 'spark', 160, 40, 2);
      F.draw(ctx, curMove().toUpperCase(), 160, 100, C.ink, 1, 'center');   // under the sack, clear of the 96-px pal
      meter(ctx);
      F.draw(ctx, done ? (good ? 'DUMMY DOWN!' : 'TRY THOSE MOVES AGAIN') : g.phase === 'show' ? (hit ? 'HIT! ' + curMove().toUpperCase() : 'WHIFF') : 'TIME THE HIT - SEE YOUR MOVES',
        W / 2, 146, C.ink, 1, 'center');
    } else if (g.kind === 'memory') {
      drawSeq(ctx, t, p, sk, done, good);
    } else if (g.kind === 'match') {
      drawMemory(ctx, t, p, sk, done, good);
    } else {
      if (g.phase === 'play' && !g.answer) g.answer = Math.random() < 0.5 ? -1 : 1;
      var glance = g.phase === 'play' ? g.answer : (g.phase === 'show' ? g.answer : 1);
      var pose2 = g.phase === 'play' ? 'look' : g.phase === 'show' ? (g.last > 0 ? 'happy' : 'sad') : (good ? 'happy' : 'sad');
      S.draw(ctx, p.species, sk, pose2, g.phase === 'play' ? 1 : Math.floor(t / 300), (W - PS) / 2, 22, BIG, g.phase === 'play' && glance < 0);   // 1.9.4: side profile only - the pal turns its whole body to face the way
      F.draw(ctx, '\u25c0 A', 10, 80, g.phase === 'show' && g.pick < 0 ? C.ink : C.dark, 2);
      F.draw(ctx, 'B \u25b6', W - 10, 80, g.phase === 'show' && g.pick > 0 ? C.ink : C.dark, 2, 'right');
      F.draw(ctx, done ? (good ? 'YOU WIN!' : 'BETTER LUCK NEXT TIME') : g.phase === 'show' ? (g.last > 0 ? 'CORRECT!' : 'WRONG WAY') : 'WATCH THE EYES',
        W / 2, 140, C.ink, 1, 'center');
    }
    if (g.phase === 'play' || (g.kind === 'memory' && g.phase === 'watch') || (g.kind === 'match' && g.phase === 'preview')) F.draw(ctx, 'C: QUIT', W - 3, 152, C.dark, 1, 'right');
    if (g.phase === 'play' && g.kind === 'match') F.draw(ctx, 'A: MOVE  B: FLIP', 3, 152, C.dark, 1);
    if (g.phase === 'play' && g.kind === 'memory') F.draw(ctx, 'A: \u25c0  B: \u25b6', 3, 152, C.dark, 1);
  }
  PP.Mini = { start: start, draw: draw, input: input, tap: tap, active: active, abort: function () { g = null; },
    need: function (kind) { var k = g; g = { kind: kind }; var n = need(); g = k; return n; },
    SEQ: SEQ, MATCH: { cards: MEM_CARDS, pairs: MEM_PAIRS, misses: MEM_MISSES, previewMs: MATCH_PREVIEW_MS, poses: MEM_POSES, cardScale: CARD }, SCALE: BIG, seqNew: seqNew, seqGrow: seqGrow, seqPress: seqPress,
    _state: function () { return g; }, _step: function (t) { if (g) step(t); }, _clock: function (fn) { now = fn || function () { return performance.now(); }; } };   // read-only peek for the browser tests
})(typeof window !== 'undefined' ? window : globalThis);
