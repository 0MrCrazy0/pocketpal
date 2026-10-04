/* PocketPal - training mini-games. Success/fail only; Care.exercise() pays the reward. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var S = PP.Sprites, F = PP.Font, D = PP.DATA;
  // 1.8.3: sprites are drawn at whole-pixel sizes only. 1.9.4: 80-px cells on the x5 backing store: scale 3 = 96 LCD px (6x), 1.5 = 48 LCD px (3x)
  var W = 216, PS = 96, BIG = 3;
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
      pos: 0, dir: 1, speed0: speedByStage[pet.stage] || 0.9, zone: null, last: 0, answer: 0, pick: 0,
      moves: moves, moveI: 0, combo: 0, best: 0, points: 0, hits: [], hitT: -1e9 };
    g.speed = sliderSpeed(kind, g.speed0, 0); g.zone = newZone();
    if (kind === 'memory') seqStart(now());
    if (kind === 'match') { memDeal(g); g.phase = 'preview'; g.t0 = now(); }
    if (kind === 'game') armTimer(now());
  }
  /* 2.3.1: the Training dummy's zone narrows a little with every hit in a row (min DUMMY.minZone) */
  function zoneHalf() { return g && g.kind === 'dummy' ? Math.max(DUMMY.minZone, DUMMY.zone - DUMMY.shrink * (g.combo || 0)) / 2 : 0.11; }
  function newZone() { var h = zoneHalf(), c = 0.25 + Math.random() * 0.5; return [c - h, c + h]; }
  /* 2.3.1: the slider ('stop in the zone') speeds up every round, capped */
  var SLIDE = { train: { step: 0.2, capX: 1.5 }, dummy: { step: 0.12, capX: 1.5 }, abs: 1.75 };
  function sliderSpeed(kind, base, round) {
    var k = SLIDE[kind]; if (!k) return base;
    return Math.min(base * (1 + k.step * round), base * k.capX, SLIDE.abs);
  }
  /* 2.3.1 Training dummy: 5 swings, 3 hits knock it down (3 of 5 - about as hard as the old 2 of 3; the reward is still
   * just win / lose through Care.exercise, so stat gains are unchanged). A hit in the middle of the zone is PERFECT
   * (more points, a bigger burst); hits in a row build a COMBO for points and narrow the zone a little. */
  var DUMMY = { swings: 5, hp: 3, zone: 0.22, shrink: 0.02, minZone: 0.16, perfect: 0.035, pts: 10, perfectPts: 20, comboPts: 5 };
  /* 2.3.1: an LCD countdown for picking an answer in Left or Right? (per round) and Memory (per press). It starts
   * generous and shrinks a little each round down to a floor; hard-mode pals get less time. A timeout is a miss. The
   * clock only runs while the game is on screen (paused while the app is hidden). */
  var TIMER = { game: { start: 5000, step: 400, floor: 2500 }, memory: { start: 4000, step: 400, floor: 2400 }, hardX: 0.7, hardFloorX: 0.8 };
  function timeFor(kind, round, hard) {
    var k = TIMER[kind]; if (!k) return 0;
    var floor = hard ? Math.round(k.floor * TIMER.hardFloorX) : k.floor;
    var ms = k.start * (hard ? TIMER.hardX : 1) - k.step * round;
    return Math.max(floor, Math.round(ms));
  }
  function armTimer(t) { g.tMax = g.tLeft = timeFor(g.kind, g.kind === 'memory' ? g.score : g.round, !!(g.pet && g.pet.hard)); g.tickS = Math.ceil(g.tLeft / 1000); g.timedOut = false; g.lastT = t; }
  function runTimer(t) {
    if (!g.tMax || g.phase !== 'play') return false;
    var dt = Math.max(0, Math.min(250, t - (g.lastT == null ? t : g.lastT)));
    g.tLeft -= dt;
    var sec = Math.ceil(Math.max(0, g.tLeft) / 1000);
    if (sec < g.tickS) { g.tickS = sec; if (sec > 0 && sec <= 2) PP.Audio.play('move'); }
    if (g.tLeft > 0) return false;
    g.tLeft = 0; g.timedOut = true; g.last = -1; g.pick = 0; g.phase = 'show'; g.t0 = t; g.echoT = -1e9; PP.Audio.play('no');
    if (g.kind === 'game' && !g.answer) g.answer = Math.random() < 0.5 ? -1 : 1;
    return true;
  }
  function pause(on) {
    if (!g) return;
    var t = now();
    if (on && !g.paused) { g.paused = true; g.pausedAt = t; }
    else if (!on && g.paused) { var d = t - g.pausedAt; g.paused = false; g.t0 += d; if (g.playT0 != null) g.playT0 += d; g.hitT += d; g.lastT = t; }
  }
  function timed() { return g.kind === 'train' || g.kind === 'dummy'; }
  /* Match (1.8.2): ONE deal of 8 cards (4 pairs). All cards show face-up for MATCH_PREVIEW_MS, then flip down.
   * Find all 4 pairs before the 3rd miss. Simulated (work/matchsim.js): random clicker wins ~7%, a player who
   * remembers what they saw wins 98-100%. */
  var MEM_CARDS = 8, MEM_PAIRS = 4, MEM_MISSES = 3, MATCH_PREVIEW_MS = 1800;
  /* Memory (1.8.1): Simon-style. The pal looks LEFT or RIGHT in a sequence; repeat it.
   * Round 1 is 3 looks, each round adds one (3, 4, 5). Clear 3 rounds to win; one wrong look ends the game. */
  var SEQ = { start: 3, rounds: 3, onMs: 650, gapMs: 300, leadMs: 700, echoMs: 260 };
  function rounds() { return g.kind === 'match' ? MEM_PAIRS : g.kind === 'memory' ? SEQ.rounds : g.kind === 'game' ? 5 : g.kind === 'dummy' ? DUMMY.swings : 3; }
  // 1.8.2: Left or Right needs 4 of 5 (was 3 of 5 = a coin flip for a random presser: 50% -> 19%; watching the eyes still wins every time)
  function need() { return g.kind === 'match' ? MEM_PAIRS : g.kind === 'memory' ? SEQ.rounds : g.kind === 'game' ? 4 : g.kind === 'dummy' ? DUMMY.hp : 2; }
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
    // 1.9.9: C also quits while a result shows (after a flip / a hit): it used to be swallowed there for ~1 s
    if (btn === 'C' && (g.phase === 'play' || g.phase === 'show' || (g.kind === 'memory' && g.phase === 'watch') || (g.kind === 'match' && g.phase === 'preview'))) { var cb = g.onDone; g = null; cb(null); return; }
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
    if (g.kind === 'dummy') {
      g.perfect = g.last > 0 && Math.abs(g.pos - (g.zone[0] + g.zone[1]) / 2) <= DUMMY.perfect;
      if (g.last > 0) {
        g.combo++; g.best = Math.max(g.best, g.combo); g.hitT = t;
        g.points += (g.perfect ? DUMMY.perfectPts : DUMMY.pts) + DUMMY.comboPts * (g.combo - 1);
        g.hits.push([Math.random(), Math.random()]);          // a stitched patch where it was hit
      } else g.combo = 0;
    }
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
    if (r === 'ok') armTimer(t);                        // 2.3.1: the countdown is per press
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
      if (i >= g.seq.length) { g.phase = 'play'; g.pos = 0; g.echo = 0; g.playT0 = t; armTimer(t); }
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
      : g.phase === 'show' ? (g.last > 0 ? 'ROUND CLEAR!' : g.timedOut ? 'TOO SLOW!' : 'WRONG WAY!')
      : 'YOUR TURN! ' + g.pos + '/' + n;
    F.draw(ctx, msg, W / 2, 130, C.ink, 1, 'center');
    drawTimer(ctx, t, 141);
  }

  function step(t) {
    if (g.paused) { g.lastT = t; return; }
    runTimer(t);
    if (g.kind === 'match' && g.phase === 'preview' && t - g.t0 >= MATCH_PREVIEW_MS) { g.phase = 'play'; g.t0 = t; PP.Audio.play('move'); }
    if (g.kind === 'memory') {
      seqStep(t); g.lastT = t;
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
      } else {
        g.round++; over = g.round >= rounds();
        if (g.kind === 'dummy') over = over || g.score >= DUMMY.hp || g.score + (DUMMY.swings - g.round) < DUMMY.hp;   // down, or it can no longer be won
      }
      if (g.kind === 'dummy') g.moveI++;
      if (over) { g.phase = 'done'; g.t0 = t; PP.Audio.play(g.score >= need() ? 'happy' : 'sad'); }
      else {
        g.phase = 'play'; g.zone = newZone(); g.last = 0; g.pos = 0; g.dir = 1; g.answer = 0; g.pick = 0; g.playT0 = t; g.perfect = false;
        g.speed = sliderSpeed(g.kind, g.speed0, g.round);
        if (g.kind === 'game') armTimer(t);
      }
    }
    if (g.phase === 'done' && t - g.t0 > 1400) { var cb = g.onDone, ok = g.score >= need(); g = null; cb(ok); }
  }


  /* 1.8.3: only poses whose eyes are OPEN in every frame of every stage (tests/minigames.test.js checks the
   * sprite-faces fixture). 1.8.2 used happy / sleep / eat / dance, whose closed or ^-shaped eyes looked like a line or a dot. */
  var MEM_POSES = ['idle', 'surprised', 'angry', 'sad', 'attack'];
  /* 1.9.9: at card size the five poses looked almost the same (the young elephant's idle and attack were
   * pixel-for-pixel alike), so pairs could not be told apart even in the preview. Every pose now carries its own big
   * mood symbol (a heart, a '!', an anger mark, a sweat drop, a spark). The pal is drawn smaller under it, clipped
   * to the card. */
  var MEM_BADGE = { idle: 'heart', surprised: 'call', angry: 'anger', sad: 'sweat', attack: 'spark' }, CARD_PAL = 1;
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
      if (sel) { ctx.fillStyle = C.ink; ctx.fillRect(cx + 3, cy + CARD_H + 1, CARD_W - 6, 2); }   // cursor (A / arrow keys move it, B flips): 1.9.9 under the card, clear of the pal
      var show = g.matched[i] || g.open.indexOf(i) >= 0 || done || g.phase === 'preview';
      if (show) {
        ctx.save(); ctx.beginPath(); ctx.rect(cx + 2, cy + 2, CARD_W - 4, CARD_H - 4); ctx.clip();   // never over the card frame
        S.drawFx(ctx, MEM_BADGE[g.cards[i]], cx + 3, cy + 3, 1.5);                                   // 24 px mood symbol, top left
        S.draw(ctx, p.species, sk, g.cards[i], Math.floor(t / 300), cx + CARD_W - 2 - 32 * CARD_PAL, cy + CARD_H - 2 - 32 * CARD_PAL, CARD_PAL);
        ctx.restore();
      } else F.draw(ctx, '?', cx + CARD_W / 2, cy + 17, C.dark, 3, 'center');
    }
    var left = g.phase === 'preview' ? Math.max(0, Math.ceil((MATCH_PREVIEW_MS - (t - g.t0)) / 1000)) : 0;
    F.draw(ctx, done ? (good ? 'NICE MEMORY!' : 'TRY AGAIN') : g.phase === 'preview' ? 'REMEMBER THEM! ' + left
      : g.phase === 'show' ? (g.last > 0 ? 'MATCH!' : 'NO MATCH') : 'FIND THE ' + MEM_PAIRS + ' PAIRS',
      W / 2, 143, C.ink, 1, 'center');
  }

  /* 2.3.1 Training dummy: a stitched training bag on a post. It WOBBLES on its post after a hit (a damped sway), flashes
   * dark for a moment, sheds a puff of stuffing, and keeps a stitched patch for every hit it took. */
  function dummySack(ctx, x, y, t) {
    var R = PP.Render, sx = x + 24, top = y + 8, bot = y + 36, H = bot - top + 10;
    var el = t - g.hitT, hit = el >= 0 && el < 900, flash = el >= 0 && el < 110;
    var sway = hit ? Math.sin(el / 70) * 5 * Math.exp(-el / 380) : 0;
    var sh = function (v) { return sway * Math.max(0, (bot + 2 - v)) / H; };          // leans from the post's top
    var sack = function (u, v) { return R.inCap(u - sh(v), v, sx, top + 9, sx, bot - 8, 9.6); };
    var inner = function (u, v) { return R.inCap(u - sh(v), v, sx, top + 9, sx, bot - 8, 8.2); };
    ctx.fillStyle = C.ink;
    R.fshape(ctx, sx - 3, bot - 2, sx + 3, y + 46, function (u, v) { return Math.abs(u - sx) <= 2.4 && v <= y + 46; });         // the post
    R.fshape(ctx, sx - 9, y + 44, sx + 9, y + 47, function (u, v) { return R.inCap(u, v, sx - 7, y + 45.5, sx + 7, y + 45.5, 1.4); });   // its foot
    R.fshape(ctx, sx - 17, top - 1, sx + 17, bot + 2, sack);
    ctx.fillStyle = flash ? C.dark : C.lite; R.fshape(ctx, sx - 16, top, sx + 16, bot + 1, inner);
    // straw tufts on top, a rope belt and a target on the belly
    ctx.fillStyle = C.ink;
    R.fshape(ctx, sx - 8, top - 5, sx + 8, top + 1, function (u, v) { var o = sh(v); return R.inCap(u - o, v, sx - 3, top - 3.6, sx - 1, top, .7) || R.inCap(u - o, v, sx + .5, top - 4.4, sx + .5, top, .7) || R.inCap(u - o, v, sx + 3.6, top - 3.4, sx + 1.8, top, .7); });
    R.fshape(ctx, sx - 16, top + 8, sx + 16, top + 15, function (u, v) { var o = sh(v); return R.inDisc(u - o, v, sx - 3.6, top + 11, 1.7) || R.inDisc(u - o, v, sx + 3.6, top + 11, 1.7); });   // button eyes
    ctx.fillStyle = flash ? C.lite : C.dark;
    R.fshape(ctx, sx - 16, top + 17, sx + 16, bot - 2, function (u, v) { var d = Math.hypot(u - sh(v) - sx, v - (top + 22)); return inner(u, v) && (Math.abs(d - 4.4) < .7 || d < 1.4); });   // the target
    ctx.fillStyle = C.ink;
    R.fshape(ctx, sx - 16, bot - 8, sx + 16, bot - 4, function (u, v) { return inner(u, v) && Math.abs(v - (bot - 6)) < .8; });   // the rope belt
    // a stitched X patch for every hit taken
    for (var k = 0; k < g.hits.length && k < DUMMY.swings; k++) {
      var px = sx - 5 + g.hits[k][0] * 10, py = top + 3 + g.hits[k][1] * 4 + (k % 2) * 13;
      R.fshape(ctx, px - 3, py - 3, px + 3, py + 3, function (u, v) { var o = sh(v), a = u - o - px, b = v - py; return inner(u, v) && Math.abs(a) < 2.2 && Math.abs(b) < 2.2 && (Math.abs(a - b) < .55 || Math.abs(a + b) < .55); });
    }
    // a puff of stuffing flying off the far side
    if (el >= 0 && el < 450) {
      var q = el / 450;
      for (var n = 0; n < 5; n++) {
        var ang = -1.1 + n * 0.45, r = 8 + q * 14, fx = sx + 6 + Math.cos(ang) * r, fy = top + 14 + Math.sin(ang) * r + q * q * 8;
        ctx.fillStyle = n % 2 ? C.ink : C.dark; ctx.fillRect(Math.round(fx), Math.round(fy), 2, 2);
      }
    }
  }
  /* the dummy's HP: one heart per hit it can take */
  function dummyHp(ctx, x, y) {
    for (var i = 0; i < DUMMY.hp; i++) S.drawFx(ctx, i < DUMMY.hp - g.score ? 'heart' : 'heart_empty', x + i * 11, y, 0.5);
  }

  /* 2.3.1: the LCD countdown - a draining bar with the seconds left (it blinks in the last second) */
  function drawTimer(ctx, t, y) {
    if (!g.tMax || (g.phase !== 'play' && !(g.phase === 'show' && g.timedOut))) return;
    var w = 92, x = (W - w) / 2 + 9, f = Math.max(0, Math.min(1, g.tLeft / g.tMax)), sec = Math.ceil(g.tLeft / 1000);
    ctx.fillStyle = C.ink; ctx.fillRect(x - 1, y - 1, w + 2, 7);
    ctx.fillStyle = C.lite; ctx.fillRect(x, y, w, 5);
    if (!(sec <= 1 && Math.floor(t / 160) % 2 && g.phase === 'play')) { ctx.fillStyle = f < 0.3 ? C.ink : C.dark; ctx.fillRect(x, y, Math.round(f * w), 5); }
    F.draw(ctx, String(sec), x - 5, y - 1, C.ink, 1, 'right');
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
    else if (g.kind === 'dummy') F.draw(ctx, 'SWING ' + Math.min(rounds(), g.round + 1) + '/' + rounds() + '   PTS ' + g.points, W / 2, 13, C.dark, 1, 'center');
    else F.draw(ctx, 'ROUND ' + Math.min(rounds(), g.round + 1) + '/' + rounds() + '   SCORE ' + g.score, W / 2, 13, C.dark, 1, 'center');
    var done = g.phase === 'done', good = g.score >= need();
    if (g.kind === 'train') {
      var pose = g.phase === 'show' ? (g.last > 0 ? 'attack' : 'sad') : done ? (good ? 'happy' : 'sad') : 'idle';
      S.draw(ctx, p.species, sk, pose, Math.floor(t / 250), (W - PS) / 2, 21, BIG);
      meter(ctx);
      F.draw(ctx, done ? (good ? 'GREAT TRAINING!' : 'KEEP PRACTISING') : g.phase === 'show' ? (g.last > 0 ? 'POW! HIT!' : 'MISSED') : 'PRESS B IN THE ZONE',
        W / 2, 146, C.ink, 1, 'center');
    } else if (g.kind === 'dummy') {
      var hit = g.phase === 'show' && g.last > 0, hel = t - g.hitT;
      var dpose = g.phase === 'show' ? (hit ? 'attack' : 'sad') : done ? (good ? 'happy' : 'sad') : 'idle';
      var lunge = hit && hel < 260 ? Math.round(6 * Math.sin(Math.PI * hel / 260)) : 0;   // 2.3.1: the pal lunges into the hit
      S.draw(ctx, p.species, sk, dpose, Math.floor(t / 180), 4 + lunge, 19, BIG);
      dummySack(ctx, 148, 48, t);
      if (hit && hel < 700) S.drawFx(ctx, g.perfect ? 'spark2' : 'spark', g.perfect ? 152 : 158, g.perfect ? 34 : 40, 2);
      dummyHp(ctx, 156, 23);
      F.draw(ctx, curMove().toUpperCase(), 160, 100, C.ink, 1, 'center');   // under the sack, clear of the 96-px pal
      if (g.combo > 1 && !done) F.draw(ctx, 'COMBO X' + g.combo, 160, 109, C.dark, 1, 'center');
      meter(ctx);
      F.draw(ctx, done ? (good ? 'DUMMY DOWN! ' + g.points + ' PTS' : 'TRY THOSE MOVES AGAIN') : g.phase === 'show' ? (hit ? (g.perfect ? 'PERFECT! ' : 'HIT! ') + curMove().toUpperCase() : 'WHIFF') : 'MIDDLE = PERFECT!',
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
      F.draw(ctx, done ? (good ? 'YOU WIN!' : 'BETTER LUCK NEXT TIME') : g.phase === 'show' ? (g.last > 0 ? 'CORRECT!' : g.timedOut ? 'TOO SLOW!' : 'WRONG WAY') : 'WATCH THE EYES',
        W / 2, 140, C.ink, 1, 'center');
      drawTimer(ctx, t, 127);
    }
    if (g.phase === 'play' || g.phase === 'show' || (g.kind === 'memory' && g.phase === 'watch') || (g.kind === 'match' && g.phase === 'preview')) F.draw(ctx, 'C: QUIT', W - 3, 152, C.dark, 1, 'right');
    if (g.phase === 'play' && g.kind === 'match') F.draw(ctx, 'A: MOVE  B: FLIP', 3, 152, C.dark, 1);
    if (g.phase === 'play' && g.kind === 'memory') F.draw(ctx, 'A: \u25c0  B: \u25b6', 3, 152, C.dark, 1);
  }
  PP.Mini = { start: start, draw: draw, input: input, tap: tap, active: active, abort: function () { g = null; },
    need: function (kind) { var k = g; g = { kind: kind }; var n = need(); g = k; return n; },
    SEQ: SEQ, MATCH: { cards: MEM_CARDS, pairs: MEM_PAIRS, misses: MEM_MISSES, previewMs: MATCH_PREVIEW_MS, poses: MEM_POSES, badges: MEM_BADGE, cardScale: CARD_PAL, badgeScale: 1.5 }, SCALE: BIG, seqNew: seqNew, seqGrow: seqGrow, seqPress: seqPress,
    TIMER: TIMER, timeFor: timeFor, SLIDE: SLIDE, sliderSpeed: sliderSpeed, DUMMY: DUMMY, pause: pause,
    _state: function () { return g; }, _step: function (t) { if (g) step(t); }, _clock: function (fn) { now = fn || function () { return performance.now(); }; } };   // read-only peek for the browser tests
})(typeof window !== 'undefined' ? window : globalThis);
