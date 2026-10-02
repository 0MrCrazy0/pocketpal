/* PocketPal - LCD renderer for the home screen and cut-scenes (hatch, evolve, death).
 * Canvas is 216x160 LCD pixels; pals are drawn at 3x (96px), FX at 2x. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var S = PP.Sprites, F = PP.Font;
  /* Home screen layout (LCD pixels). Everything keeps a safe margin from the LCD's
   * rounded edges: the bottom text ends 9 px above the bottom edge. */
  var W = 216, H = 160, PET = 3, PS = 32 * PET;
  /* 1.8.4: the status strip has two rows (strip, strip2); stripEnd = the first free row under it. */
  var L = { topText: 2, topLine: 11, strip: 14, strip2: 23, stripH: 7, stripEnd: 31, ground: 136, floorLine: 140, bottomText: 144, textH: 7 };
  var GROUND = L.ground;
  var C = { ink: '#0f380f', dark: '#306230', mid: '#8bac0f', bg: '#9bbc0f', lite: 'rgb(206,224,110)' };

  function clear(ctx, col) { ctx.fillStyle = col || C.bg; ctx.fillRect(0, 0, W, H); }
  function dotted(ctx, y) { ctx.fillStyle = C.dark; for (var x = 0; x < W; x += 2) ctx.fillRect(x, y, 1, 1); }
  function clockText(st) { return PP.Time.clock(Date.now(), st.settings.clock || PP.Time.defaultClock(), { lcd: true }); }

  function statusBar(ctx, app, t) {
    var st = app.state, p = PP.Game.active(st);
    F.draw(ctx, clockText(st), 3, L.topText, C.ink);
    if (p && p.stage !== 'egg' && !p.fate) {
      F.draw(ctx, PP.Pet.formName(p).toUpperCase(), W / 2 + 8, L.topText, C.ink, 1, 'center');
      if (st.settings.test && st.settings.speed > 1) F.draw(ctx, 'x' + st.settings.speed, p.hard ? W - 34 : W - 16, L.topText, C.dark, 1, 'right');
      if (p.hard) F.draw(ctx, 'HARD', W - 3, L.topText, C.ink, 1, 'right');   // 1.9.0 hard-mode badge
      // 1.8.4: the flashing "!" call moved into the status strip (row 2), next to the other "right now" icons
    }
    dotted(ctx, L.topLine);
  }

  /* ---- compact status strip under the clock (1.8.4: two rows)
   *  row 1: hunger hearts, happiness hearts, energy bolt + 4 pips, stage + age
   *  row 2: discipline flag + bar, weight (thin / fine / heavy), then only what applies now:
   *         sick, poop + count, ! needs attention, ZZ asleep (or moon at night), Zz tired */
  var MINI = {
    heart: ['.#.#.', '#####', '#####', '.###.', '..#..'],
    empty: ['.#.#.', '#.#.#', '#...#', '.#.#.', '..#..'],
    food:  ['...###.', '..#####', '..#####', '...###.', '..#....', '.#.....', '##.....'],
    smile: ['.#####.', '#.....#', '#.#.#.#', '#.....#', '#.#.#.#', '#..#..#', '.#####.'],
    poop:  ['...#...', '..##...', '.####..', '.#####.', '#######'],
    moon:  ['..###', '.##..', '##...', '##...', '##...', '.##..', '..###'],
    tired: ['####.....', '..#......', '.#..####.', '####..#..', '.....#...', '....####.', '.........'],  // 1.8.3: 'Zz' = low energy
    bolt:  ['...##', '..##.', '.##..', '#####', '..##.', '.##..', '##...'],                            // energy
    flag:  ['#......', '#####..', '######.', '#####..', '#......', '#......', '#......'],              // discipline
    wthin: ['..###..', '..#.#..', '..#.#..', '..#.#..', '..#.#..', '..#.#..', '..###..'],              // weight: thin
    wok:   ['.#####.', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '.#####.'],              // weight: fine
    wheavy:['..###..', '.#####.', '#######', '#######', '#######', '.#####.', '..###..'],              // weight: heavy
    sick:  ['.#####.', '#######', '##.#.##', '#######', '.#####.', '.#.#.#.', '.......'],              // sick (skull)
    attn:  ['##', '##', '##', '##', '..', '##', '##']                                                  // needs attention
  };
  function mini(ctx, rows, x, y, col) {
    ctx.fillStyle = col || C.ink;
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < rows[r].length; c++) if (rows[r].charCodeAt(c) === 35) ctx.fillRect(x + c, y + r, 1, 1);
  }
  function stageAge(p) {
    if (p.stage === 'egg') return 'EGG';
    var label = { baby: 'BABY', child: 'CHILD', teen: 'TEEN', adult: 'ADULT' }[p.stage] || '';
    var min = p.ageMin || 0, age = min < 1440 ? Math.max(0, Math.floor(min / 60)) + 'H' : Math.min(999, Math.floor(min / 1440)) + 'D';
    return label + ' ' + age;
  }
  /* The strip as boxes [kind, x, width] - also used by the layout audit to prove nothing overlaps. */
  function weightKind(p) { return PP.Care.isOverweight(p) ? 'wheavy' : PP.Care.isUnderweight(p) ? 'wthin' : 'wok'; }
  function energyPips(p) { return Math.max(0, Math.min(4, Math.ceil((p.energy || 0) / 25))); }
  function stripBoxes(p, night) {
    var b = [], y = L.strip, y2 = L.strip2;
    function row2(k, w, extra) { var q = { k: k, x: x2, w: w, y: y2 }; for (var e in extra || {}) q[e] = extra[e]; b.push(q); x2 += w + 3; return q; }
    var x2 = 52;
    if (p.stage !== 'egg') {
      b.push({ k: 'food', x: 3, w: 7 }, { k: 'hunger', x: 11, w: 23, n: p.hunger });
      b.push({ k: 'smile', x: 38, w: 7 }, { k: 'happy', x: 46, w: 23, n: p.happy });
      b.push({ k: 'bolt', x: 74, w: 5 }, { k: 'energy', x: 81, w: 19, n: energyPips(p) });
      b.push({ k: 'flag', x: 3, w: 7, y: y2 }, { k: 'discipline', x: 11, w: 24, y: y2, n: Math.max(0, Math.min(100, Math.round(p.discipline || 0))) });
      b.push({ k: weightKind(p), x: 40, w: 7, y: y2 });
      if (p.sick) row2('sick', 7);
      if (p.poop > 0) { row2('poop', 7); x2 -= 1; row2('poopN', F.width(String(p.poop)), { text: String(p.poop) }); }
      if (!p.fate && PP.Care.attention(p).length) row2('attn', 2);
      if (p.asleep) row2('zzz', F.width('ZZ'), { text: 'ZZ' });
      else if (night) row2('moon', 5);
      if (PP.Care.isTired(p)) row2('tired', 9);
    }
    var sa = stageAge(p), sw = F.width(sa);
    b.push({ k: 'stage', x: W - 3 - sw, w: sw, text: sa });
    b.forEach(function (q) { if (q.y == null) q.y = y; q.h = L.stripH; });
    return b;
  }
  function drawStrip(ctx, p, t) {
    var night = p.stage !== 'egg' && PP.Sleep.isNight(PP.Time.minuteOfDay(PP.Game.now(PP.App.state)), PP.Sleep.of(p));
    stripBoxes(p, night).forEach(function (q) {
      if (q.k === 'hunger' || q.k === 'happy') for (var i = 0; i < 4; i++) mini(ctx, i < q.n ? MINI.heart : MINI.empty, q.x + i * 6, q.y + 1, i < q.n ? C.ink : C.dark);
      else if (q.k === 'energy') for (var j = 0; j < 4; j++) {          // 4 pips, 25 energy each; they blink when tired
        var on = j < q.n, blink = PP.Care.isTired(p) && Math.floor(t / 500) % 2;
        ctx.fillStyle = on ? (blink ? C.dark : C.ink) : C.dark;
        if (on) ctx.fillRect(q.x + j * 5, q.y + 1, 4, 5);
        else { ctx.fillRect(q.x + j * 5, q.y + 1, 4, 1); ctx.fillRect(q.x + j * 5, q.y + 5, 4, 1); ctx.fillRect(q.x + j * 5, q.y + 1, 1, 5); ctx.fillRect(q.x + j * 5 + 3, q.y + 1, 1, 5); }
      } else if (q.k === 'discipline') {                                   // a small bar, 0-100 %
        ctx.fillStyle = C.ink; ctx.fillRect(q.x, q.y + 1, q.w, 1); ctx.fillRect(q.x, q.y + 5, q.w, 1); ctx.fillRect(q.x, q.y + 1, 1, 5); ctx.fillRect(q.x + q.w - 1, q.y + 1, 1, 5);
        ctx.fillRect(q.x + 1, q.y + 2, Math.round((q.w - 2) * q.n / 100), 3);
      } else if (q.k === 'attn') mini(ctx, MINI.attn, q.x, q.y, Math.floor(t / 400) % 2 ? C.dark : C.ink);
      else if (MINI[q.k]) mini(ctx, MINI[q.k], q.x, q.y + (q.k === 'poop' ? 2 : 0), (q.k === 'poop' && p.poop >= 2 || q.k === 'tired') && Math.floor(t / 500) % 2 ? C.dark : C.ink);
      else if (q.text) F.draw(ctx, q.text, q.x, q.y, q.k === 'stage' ? C.dark : C.ink);
    });
  }

  /* Tamagotchi-style attention icon: a flashing "!" box in the top-right corner. */
  function attentionIcon(ctx, x, y, t) {
    if (Math.floor(t / 400) % 2) { ctx.fillStyle = C.dark; ctx.fillRect(x, y + 1, 10, 9); return; }
    ctx.fillStyle = C.ink; ctx.fillRect(x, y + 1, 10, 9);
    ctx.fillStyle = C.lite; ctx.fillRect(x + 4, y + 2, 2, 4); ctx.fillRect(x + 4, y + 7, 2, 2);
  }
  var NEED_ICON = { hunger: 1, happy: 2, poop: 3, sick: 4, lights: 5, tantrum: 7 };
  /* Speech bubble next to the pal showing WHAT it wants (cycles through all needs). */
  function needBubble(ctx, needs, px, y, flip, t) {
    if (!needs.length || Math.floor(t / 500) % 4 === 3) return;
    var k = needs[Math.floor(t / 1500) % needs.length];
    var bx = flip ? px + 2 : px + PS - 24, by = Math.max(L.stripEnd + 2, y - 6);
    bx = Math.max(1, Math.min(W - 21, bx));
    ctx.fillStyle = C.ink; ctx.fillRect(bx, by, 20, 17); ctx.fillRect(bx + 1, by - 1, 18, 19);
    ctx.fillRect(flip ? bx + 14 : bx + 3, by + 18, 3, 3);   // tail
    S.drawIcon(ctx, NEED_ICON[k], bx + 4, by + 3, 1);
  }

  /* ------------------------------------------------------------ wandering */
  function walkerUpdate(app, p, dt, t) {
    var w = app.walker || (app.walker = { x: 50, dir: 1, tx: 50, until: 0 });
    var maxX = W - PS - (p.poop > 0 ? 38 : 4);
    if (w.x > maxX) w.x = maxX;
    var still = p.asleep || p.sick || app.anim || p.fate || p.stage === 'egg';
    if (still) return false;
    if (w.tx > maxX) w.tx = maxX;
    if (Math.abs(w.x - w.tx) < 0.5) {
      // arrived: do something (stand, look around, sit, yawn, scratch, mope, dance), then maybe another thing
      if (!w.arrived) { w.arrived = true; w.act = PP.Behave.pickIdle(p, Math.random(), Math.random()); w.act.t0 = t; w.until = t + w.act.dur; }
      if (t > w.until) {
        if (Math.random() < 0.35) { w.act = PP.Behave.pickIdle(p, Math.random(), Math.random()); w.act.t0 = t; w.until = t + w.act.dur; }
        else { w.tx = 4 + Math.random() * Math.max(1, maxX - 4); w.arrived = false; w.act = null; }
      }
      return false;
    }
    w.act = null;
    var step = Math.min(Math.abs(w.tx - w.x), Math.min(dt, 100) * (PP.Care.isTired(p) ? 0.009 : 0.018));   // tired pals plod
    w.dir = w.tx > w.x ? 1 : -1;
    w.x += step * w.dir;
    return true;
  }

  /* -> [pose, frame]. Face animation (blinks, chewing) and idle behaviours live here. */
  function petPose(p, app, moving, t) {
    if (app.anim) {
      var a = app.anim, el = t - a.t0;
      if (a.kind === 'eat') return PP.Behave.eatFrame(el, 220);
      if (a.kind === 'clean') return [el > a.dur * 0.6 ? 'happy' : el > a.dur * 0.25 ? 'surprised' : 'idle', Math.floor(t / 250)];
      if (a.kind === 'refuse') return ['refuse', Math.floor(el / 170)];
      if (a.kind === 'dance' || a.kind === 'cup') return ['dance', Math.floor(el / 260)];
      // 1.8.3 too tired to play: a slow head-shake, then a big yawn
      if (a.kind === 'tired') return el < 760 ? ['refuse', Math.floor(el / 190)] : ['yawn', el < 1500 ? 0 : 1];
      // medicine: a 'yuck' head-shake first, then relief (or still poorly)
      if (a.kind === 'med') return el < a.dur * 0.35 ? ['refuse', Math.floor(el / 150)] : [a.pose || 'happy', Math.floor(el / 250)];
      // scolded: flinch, then droop with a tear
      if (a.kind === 'scold') return el < 320 ? ['surprised', 1] : ['sad', 1 + Math.floor((el - 320) / 380) % 3];
      if (a.kind === 'sad') return el < 260 ? ['hurt', 1] : ['sad', Math.floor(el / 380)];
      if (a.kind === 'happy') return ['happy', Math.floor(el / 250)];
      if (a.kind === 'sick') return ['sick', Math.floor(el / 300)];
      return [a.pose || a.kind, Math.floor(t / 500)];
    }
    var m = PP.Care.moodPose(p);
    if (m !== 'idle') return [m, Math.floor(t / 500)];
    if (moving) return ['walk', Math.floor(t / 250)];
    var w = app.walker, act = w && w.act, pose = 'idle', frame = Math.floor(t / 500);
    if (act) { pose = act.pose; frame = act.frameMs ? Math.floor((t - act.t0) / act.frameMs) : 0; }
    if (pose === 'idle' && PP.Care.isTired(p)) return ['bored', Math.floor(t / 1200)];   // 1.8.3: heavy, half-shut eyes
    // natural blinking every 2-6 s while standing or sitting
    if (pose === 'idle' || pose === 'sit' || pose === 'look') {
      if (!w.blinkAt) w.blinkAt = t + PP.Behave.nextBlinkGap(Math.random());
      var bf = PP.Behave.blinkFrame(t - w.blinkAt);
      if (t - w.blinkAt > PP.Behave.BLINK_MS) w.blinkAt = t + PP.Behave.nextBlinkGap(Math.random());
      else if (bf >= 0) return pose === 'sit' ? ['sit', bf === 1 ? 1 : 3] : ['blink', bf];   // open > half > closed > half > open
    }
    return [pose, frame];
  }

  /* The egg always moves as ONE rigid piece: a gentle whole-sprite rock (1 px left/right),
   * and just before hatching a quick rock between properly rotated frames. */
  function drawEgg(ctx, species, t, fast, x, y) {
    var step = Math.floor(t / (fast ? 140 : 650)) % 4;
    if (fast) {
      var pose = step === 1 || step === 3 ? 'walk' : 'idle', f = step === 3 ? 0 : 1;
      S.draw(ctx, species, 'egg', pose, pose === 'walk' ? f : 0, x, y, PET);
    } else {
      var dx = step === 1 ? 1 : step === 3 ? -1 : 0;
      S.draw(ctx, species, 'egg', 'idle', 0, x + dx * PET, y, PET);
    }
  }

  /* ---- 1.9.0 home scene: time of day + the weather of the day, in light tones only so the
   * pal, text and icons keep full contrast. Static when the player prefers reduced motion. */
  var sceneForce = null;
  function reducedMotion() { try { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
  function sceneInfo(st) {
    if (sceneForce) return sceneForce;
    var now = PP.Game.now(st), d = new Date(now), h = d.getHours() + d.getMinutes() / 60;
    var phase = h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 17.5 ? 'day' : h >= 17.5 && h < 19.5 ? 'dusk' : 'night';
    var r = PP.util.roll(st.seed, PP.Shop.dayOf(now), 'weather');
    return { phase: phase, weather: r < 0.18 ? 'rain' : r < 0.26 ? 'snow' : 'clear' };
  }
  function hills(ctx) {
    var top = L.floorLine;
    ctx.fillStyle = C.lite;
    ctx.globalAlpha = 0.35;
    for (var x = 0; x < W; x++) {                       // two soft, wide hills on the horizon
      var hgt = Math.round(10 + 7 * Math.sin(x / 34 + 0.6) + 4 * Math.sin(x / 13 + 2));
      ctx.fillRect(x, top - hgt, 1, hgt);
    }
    ctx.globalAlpha = 1;
  }
  function drawScene(ctx, st, t) {
    var info = sceneInfo(st), top = L.stripEnd, bottom = L.floorLine, still = reducedMotion();
    var tt = still ? 0 : t;
    if (info.phase === 'dawn' || info.phase === 'dusk') {   // a glow low in the sky
      for (var i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(206,224,110,' + (0.10 + i * 0.06) + ')'; ctx.fillRect(0, bottom - 54 + i * 10, W, 10); }
      ctx.fillStyle = 'rgba(206,224,110,0.55)';
      var sx = info.phase === 'dawn' ? 30 : W - 42;
      for (var dy = -6; dy <= 0; dy++) { var hw = Math.round(Math.sqrt(36 - dy * dy)); ctx.fillRect(sx - hw, bottom - 20 + dy, hw * 2, 1); }
    } else if (info.phase === 'night') {
      ctx.fillStyle = 'rgba(48,98,48,0.16)'; ctx.fillRect(0, top, W, bottom - top);
      ctx.fillStyle = C.lite;
      for (var k = 0; k < 14; k++) {
        var stx = (k * 53 + 17) % (W - 8) + 4, sty = top + 4 + (k * 29) % 46;
        if (!still && (Math.floor(tt / 900) + k) % 5 === 0) continue;  // gentle twinkle
        ctx.fillRect(stx, sty, 1, 1);
      }
      ctx.fillStyle = 'rgba(206,224,110,0.9)';                          // crescent moon
      for (var my = -5; my <= 5; my++) for (var mx = -5; mx <= 5; mx++) {
        if (mx * mx + my * my <= 25 && (mx - 3) * (mx - 3) + (my + 1) * (my + 1) > 18) ctx.fillRect(W - 30 + mx, top + 12 + my, 1, 1);
      }
    } else {                                                             // day: two slow clouds
      ctx.fillStyle = 'rgba(206,224,110,0.6)';
      for (var c = 0; c < 2; c++) {
        var cxp = Math.round(((tt / 400 + c * 120) % (W + 40)) - 20), cyp = top + 8 + c * 14;
        ctx.fillRect(cxp, cyp, 18, 3); ctx.fillRect(cxp + 4, cyp - 2, 9, 2); ctx.fillRect(cxp + 2, cyp + 3, 14, 1);
      }
    }
    hills(ctx);
    if (info.weather === 'rain') {
      ctx.fillStyle = 'rgba(48,98,48,0.35)';
      for (var rI = 0; rI < 26; rI++) {
        var rx = (rI * 37 + Math.floor(tt / 30)) % W, ry = top + ((rI * 23 + Math.floor(tt / 12)) % (bottom - top - 4));
        ctx.fillRect(rx, ry, 1, 3);
      }
    } else if (info.weather === 'snow') {
      ctx.fillStyle = 'rgba(206,224,110,0.95)';
      for (var sI = 0; sI < 22; sI++) {
        var fx = (sI * 41 + Math.round(3 * Math.sin(tt / 900 + sI))) % W, fy = top + ((sI * 19 + Math.floor(tt / 60)) % (bottom - top - 2));
        ctx.fillRect(fx, fy, 2, 2);
      }
    }
  }
  /* small sparkle around a golden pal (cosmetic) */
  function goldSparkle(ctx, px, y, t) {
    var ph = Math.floor(t / 400) % 3, spots = [[8, 18], [PS - 14, 10], [PS - 6, 46], [4, 52]];
    ctx.fillStyle = C.lite;
    spots.forEach(function (q, i) {
      if ((i + ph) % 3 === 0) return;
      var x = px + q[0], yy = y + q[1];
      ctx.fillRect(x, yy - 2, 1, 5); ctx.fillRect(x - 2, yy, 5, 1);
    });
  }
  function drawHome(ctx, app, t, dt) {
    var st = app.state, p = PP.Game.active(st);
    clear(ctx);
    statusBar(ctx, app, t);
    if (!p) {
      F.draw(ctx, 'NO PAL YET', W / 2, 60, C.ink, 2, 'center');
      F.draw(ctx, 'PRESS B FOR AN EGG', W / 2, 90, C.dark, 1, 'center');
      return;
    }
    if (app.anim && t - app.anim.t0 > app.anim.dur) app.anim = null;
    var cx = (W - PS) / 2, y = GROUND - PS;
    if (!p.fate) drawScene(ctx, st, t);
    if (p.stage === 'egg') {
      var left = PP.Evolution.minutesToNextStage(p), fast = left <= 2;
      drawStrip(ctx, p, t);
      drawEgg(ctx, p.species, t, fast, cx, y);
      dotted(ctx, L.floorLine);
      F.draw(ctx, 'HATCHING IN ' + Math.max(1, left) + ' MIN', W / 2, L.bottomText, C.ink, 1, 'center');
      return;
    }
    if (p.fate) {
      if (p.fate === 'dead') {
        S.drawFx(ctx, 'tomb', W / 2 - 24, 52, 3);
        F.draw(ctx, 'R.I.P. ' + p.name.toUpperCase(), W / 2, 108, C.ink, 1, 'center');
        F.draw(ctx, (p.fateCause || '').toUpperCase(), W / 2, 120, C.dark, 1, 'center');
      } else {
        F.draw(ctx, p.name.toUpperCase(), W / 2, 46, C.ink, 2, 'center');
        F.draw(ctx, p.fateCause === 'ran away' ? 'RAN AWAY...' : 'IS GONE', W / 2, 70, C.ink, 1, 'center');
      }
      F.draw(ctx, 'PRESS B', W / 2, L.bottomText, C.dark, 1, 'center');
      return;
    }
    var moving = walkerUpdate(app, p, dt, t), w = app.walker;
    var pf = petPose(p, app, moving, t), pose = pf[0], frame = pf[1];
    var px = Math.round(w.x), flip = w.dir < 0;
    if (p.asleep || p.sick) flip = false;
    S.draw(ctx, p.species, S.stageKeyOf(p), pose, frame, px, y, PET, flip);
    if (p.golden && !p.asleep) goldSparkle(ctx, px, y, reducedMotion() ? 0 : t);

    // poop pile (bottom right)
    for (var i = 0; i < p.poop; i++) {
      S.drawFx(ctx, Math.floor(t / 500 + i) % 2 ? 'poop' : 'poop2', W - 36 + (i % 2) * 17, GROUND - 32 - Math.floor(i / 2) * 30, 2);
    }
    // mood FX
    var hx = px + (flip ? 4 : PS - 34), hy = y + 10;
    if (p.asleep) S.drawFx(ctx, Math.floor(t / 700) % 2 ? 'zzz' : 'zzz2', px + PS - 30, y - 4 + (Math.floor(t / 700) % 2) * 3, 2);
    else if (p.sick) S.drawFx(ctx, Math.floor(t / 600) % 2 ? 'skull' : 'germ', hx, hy - 12, 2);
    else if (p.fake && !app.anim) S.drawFx(ctx, 'anger', hx, hy - 10 + (Math.floor(t / 300) % 2), 2);
    else if (pose === 'sad' && !app.anim) S.drawFx(ctx, 'sweat', hx, hy, 2);
    if (!app.anim && p.lights) needBubble(ctx, PP.Care.attention(p).filter(function (k) { return k !== 'poop' || p.poop >= 1; }), px, y, flip, t);

    // action FX
    if (app.anim) drawAnimFx(ctx, app.anim, t, px, y, flip);

    dotted(ctx, L.floorLine);
    F.draw(ctx, p.name.toUpperCase() + ' ' + (p.sex === 'M' ? '\u2642' : '\u2640'), 3, L.bottomText, C.ink);
    if (p.stage === 'adult') F.draw(ctx, 'LV' + p.level, W - 3, L.bottomText, C.ink, 1, 'right');

    if (!p.lights) {   // lights off: the room goes dark, the status strip stays readable
      var top = L.stripEnd;
      ctx.fillStyle = 'rgba(15,56,15,0.82)'; ctx.fillRect(0, top, W, H - top);
      if (p.asleep) F.draw(ctx, 'Z z z', px + PS / 2, y + 20, C.mid, 1, 'center');
    }
    drawStrip(ctx, p, t);
  }

  function drawAnimFx(ctx, a, t, px, y, flip) {
    var k = (t - a.t0) / a.dur, fxX = flip ? px - 20 : px + PS - 12, fy = GROUND - 34;
    fxX = Math.max(0, Math.min(W - 32, fxX));
    if (a.kind === 'eat') {
      var food = a.food === 'snack' ? 'snack' : (k < 0.45 ? 'meal' : 'meal_bitten');
      if (k < 0.85) S.drawFx(ctx, a.food === 'snack' && k > 0.5 ? 'heart' : food, fxX, fy, 2);
    } else if (a.kind === 'happy') {
      for (var i = 0; i < 3; i++) {
        var hk = (k * 2 + i / 3) % 1;
        S.drawFx(ctx, i === 1 ? 'note' : 'heart', px + 10 + i * 28, y + 20 - hk * 40, 2);
      }
    } else if (a.kind === 'med') {
      S.drawFx(ctx, 'pill', fxX + (1 - Math.min(1, k * 2)) * 20 * (flip ? -1 : 1), fy - 20, 2);
    } else if (a.kind === 'angry' || a.kind === 'scold') {
      S.drawFx(ctx, 'anger', px + PS / 2 - 16, y + 4 + (Math.floor(t / 150) % 2) * 2, 2);
    } else if (a.kind === 'refuse') {
      S.drawFx(ctx, a.food === 'snack' ? 'snack' : 'meal', fxX, fy, 2);
    } else if (a.kind === 'tired') {     // one-line message on the LCD, gone with the animation
      S.drawFx(ctx, Math.floor(t / 500) % 2 ? 'zzz' : 'zzz2', px + (flip ? 4 : PS - 30), y - 2, 2);
      var msg = 'TOO TIRED...', mw = F.width(msg) + 6, my = L.stripEnd + 2;
      ctx.fillStyle = C.ink; ctx.fillRect((W - mw) / 2 - 1, my - 1, mw + 2, 11);
      ctx.fillStyle = C.lite || C.bg; ctx.fillRect((W - mw) / 2, my, mw, 9);
      F.draw(ctx, msg, W / 2, my + 1, C.ink, 1, 'center');
    } else if (a.kind === 'dance') {
      S.drawFx(ctx, 'note', px + (Math.floor(t / 260) % 2 ? 6 : PS - 30), y + 2 - k * 12, 2);
    } else if (a.kind === 'sad' || a.kind === 'no') {
      S.drawFx(ctx, 'sweat', px + (flip ? 8 : PS - 36), y + 18 + k * 8, 2);
    } else if (a.kind === 'clean') {
      var bx = W - k * 1.6 * W;
      var ct = L.stripEnd;
      ctx.fillStyle = C.ink; ctx.fillRect(Math.round(bx), ct, 4, L.floorLine - ct);
      ctx.fillStyle = C.dark; ctx.fillRect(Math.round(bx) + 5, ct, 2, L.floorLine - ct);
    } else if (a.kind === 'sick') {
      S.drawFx(ctx, 'germ', px + PS / 2, y + 6, 2);
    } else if (a.kind === 'level') {
      S.drawFx(ctx, 'star', px + PS / 2 - 16, y - 4 - k * 20, 2);
    } else if (a.kind === 'cup') {        // 1.8.4 cup-cleared celebration: stars burst round the pal + a banner
      for (var si = 0; si < 5; si++) {
        var ang = si / 5 * Math.PI * 2 + k * 5, rr = 20 + 26 * ((k * 3 + si / 5) % 1);
        S.drawFx(ctx, 'star', Math.round(px + PS / 2 - 8 + Math.cos(ang) * rr * 1.4), Math.round(y + PS / 2 - 18 + Math.sin(ang) * rr * 0.7), 1);
      }
      var cm = (a.text || 'CUP CLEARED!'), cw = F.width(cm) + 8, cy = L.stripEnd + 2;
      if (Math.floor(t / 300) % 4 !== 3 || k > 0.8) {
        ctx.fillStyle = C.ink; ctx.fillRect((W - cw) / 2 - 1, cy - 1, cw + 2, 11);
        ctx.fillStyle = C.lite || C.bg; ctx.fillRect((W - cw) / 2, cy, cw, 9);
        F.draw(ctx, cm, W / 2, cy + 1, C.ink, 1, 'center');
      }
    }
  }

  /* ------------------------------------------------------------ cut-scenes */
  function drawCut(ctx, app, t) {
    var c = app.cut, k = t - c.t0, cx = (W - PS) / 2, y = GROUND - PS - 6;
    clear(ctx);
    if (c.kind === 'evolve') {
      var swapAt = 2800;
      if (k < swapAt) {
        var period = Math.max(50, 420 - k * 0.14), showNew = Math.floor(k / period) % 2 === 1;
        S.draw(ctx, c.species, showNew ? c.toKey : c.fromKey, 'idle', 0, cx, y, PET);
        F.draw(ctx, 'WHAT?!', W / 2, 16, C.ink, 2, 'center');
        for (var i = 0; i < 6; i++) {
          var ang = k / 300 + i * Math.PI / 3, r = 70 - k / 60;
          S.drawFx(ctx, 'star', W / 2 - 8 + Math.cos(ang) * r, 90 + Math.sin(ang) * r * 0.6, 1);
        }
      } else {
        if (k < swapAt + 160) { clear(ctx, C.lite); return; }
        var kk = k - swapAt;   // reveal: jump for joy, then show off the species habit
        S.draw(ctx, c.species, c.toKey, kk < 1200 ? 'happy' : 'quirk', kk < 1200 ? Math.floor(k / 250) : Math.floor((kk - 1200) / 300), cx, y, PET);
        for (var j = 0; j < 8; j++) {
          var a2 = j * Math.PI / 4, r2 = 30 + (k - swapAt) / 25;
          if (r2 < 130) S.drawFx(ctx, j % 2 ? 'star' : 'spark', W / 2 - 8 + Math.cos(a2) * r2, 96 + Math.sin(a2) * r2 * 0.6, 1);
        }
        F.draw(ctx, 'EVOLVED INTO', W / 2, 6, C.ink, 1, 'center');
        F.draw(ctx, c.name.toUpperCase(), W / 2, 17, C.ink, 2, 'center');
        if (c.sub) F.draw(ctx, c.sub.toUpperCase(), W / 2, L.bottomText, C.dark, 1, 'center');
      }
    } else if (c.kind === 'hatch') {
      if (k < 1600) {
        if (k > 1000) S.draw(ctx, c.species, 'egg', 'happy', Math.floor(k / 150) % 2, cx, y + 6, PET);   // cracking
        else drawEgg(ctx, c.species, k, true, cx, y + 6);
        F.draw(ctx, '...!', W / 2, 20, C.ink, 2, 'center');
      } else if (k < 1760) { clear(ctx, C.lite); }
      else {
        S.draw(ctx, c.species, 'baby', 'happy', Math.floor(k / 250), cx, y + 6, PET);
        F.draw(ctx, 'HATCHED!', W / 2, 10, C.ink, 2, 'center');
        F.draw(ctx, c.name.toUpperCase() + ' THE ' + PP.DATA.NAMES[c.species].baby.toUpperCase(), W / 2, L.bottomText, C.dark, 1, 'center');
      }
    } else if (c.kind === 'die') {
      if (k < 1500) S.draw(ctx, c.species, c.key, 'faint', Math.floor(k / 400), cx, y + 6, PET);
      else S.drawFx(ctx, 'tomb', W / 2 - 24, 64, 3);
      F.draw(ctx, c.title, W / 2, 16, C.ink, 1, 'center');
    }
  }
  function cutDuration(c) { return c.kind === 'evolve' ? 5200 : c.kind === 'hatch' ? 3600 : 3200; }

  PP.Render = { W: W, H: H, GROUND: GROUND, PET: PET, C: C, LAYOUT: L, clear: clear, drawHome: drawHome, drawCut: drawCut, cutDuration: cutDuration,
    statusBar: statusBar, drawEgg: drawEgg, stripBoxes: stripBoxes, stageAge: stageAge, MINI: MINI,
    sceneInfo: sceneInfo, drawScene: drawScene, forceScene: function (v) { sceneForce = v || null; } };
})(typeof window !== 'undefined' ? window : globalThis);
