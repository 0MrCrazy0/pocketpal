/* PocketPal - idle behaviour + face animation timing (pure, testable).
 * The renderer asks: "the pal is standing around - what does it do next?" and
 * "which frame of the blink / chew cycle is it on?". */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};

  /* Things a pal does between walks. dur in ms; frameMs = how fast its 4 frames step. */
  var ACTS = {
    stand:   { pose: 'idle',    dur: [1500, 3500], frameMs: 500 },
    look:    { pose: 'look',    dur: [2000, 2800], frameMs: 700 },  // side-profile head tilt: up, ahead, down, ahead (1.9.4)
    sit:     { pose: 'sit',     dur: [3500, 7000], frameMs: 0 },    // frames 3 (half) and 1 (closed) used as its blink
    yawn:    { pose: 'yawn',    dur: [1400, 1600], frameMs: 700 },
    scratch: { pose: 'scratch', dur: [1200, 1800], frameMs: 160 },
    bored:   { pose: 'bored',   dur: [2400, 3200], frameMs: 1200 },
    dance:   { pose: 'dance',   dur: [1800, 2600], frameMs: 260 },
    quirk:   { pose: 'quirk',   dur: [1200, 1600], frameMs: 320 },  // species habit: mane shake, howl, belly scratch, jaw snap, wing stretch, trunk spray
    sleepy:  { pose: 'sleepy',  dur: [2400, 3600], frameMs: 600 },  // nodding off
    droop:   { pose: 'bored',   dur: [2400, 3600], frameMs: 1200 }  // 1.8.3: tired - stands with heavy, half-shut eyes
  };

  /* Weighted choice that reacts to mood: tired pals yawn and sit, sad pals mope,
   * very happy pals dance. r1, r2 in [0,1). */
  function pickIdle(p, r1, r2) {
    var e = p ? p.energy : 80, hap = p ? p.happy : 2, young = p && p.stage === 'baby';
    var tired = e < ((PP.DATA && PP.DATA.RULES && PP.DATA.RULES.tiredEnergy) || 30);
    var w = tired ? {     // 1.8.3: a tired pal droops, yawns and nods off instead of standing around bright-eyed
      stand: 0, look: 0.6, sit: 3, yawn: 4, scratch: 0.3, bored: 0, dance: 0, quirk: 0.3, sleepy: 4, droop: 4
    } : {
      stand: 4, look: 3, sit: e < 40 ? 4 : 2, yawn: e < 35 ? 3 : 0.6, scratch: young ? 0.5 : 1.2,
      bored: hap <= 1 ? 3 : 0.4, dance: hap >= 4 ? 1.2 : 0, quirk: young ? 0.8 : 1.4, sleepy: 0, droop: 0
    };
    var total = 0, k;
    for (k in w) total += w[k];
    var x = r1 * total;
    for (k in w) { x -= w[k]; if (x < 0) break; }
    var a = ACTS[k];
    return { kind: k, pose: a.pose, frameMs: a.frameMs, dur: Math.round(a.dur[0] + (a.dur[1] - a.dur[0]) * (r2 || 0)) };
  }

  /* Blinks: every 2-6 s, a 3-step blink (half, closed, half) lasting ~230 ms. */
  var BLINK = [70, 90, 70];
  function nextBlinkGap(r) { return 2000 + r * 4000; }
  /* Returns the blink frame (0 = half, 1 = closed) for `since` ms after a blink started, or -1 when done. */
  function blinkFrame(since) {
    if (since < 0) return -1;
    if (since < BLINK[0]) return 0;
    if (since < BLINK[0] + BLINK[1]) return 1;
    if (since < BLINK[0] + BLINK[1] + BLINK[2]) return 0;
    return -1;
  }

  /* Eating: bite (eat 0), swallow (eat 1), chew, chew... -> [pose, frame] */
  var EAT = [['eat', 0], ['eat', 1], ['chew', 0], ['chew', 1], ['chew', 0], ['chew', 1]];
  function eatFrame(elapsed, stepMs) {
    var i = Math.floor(Math.max(0, elapsed) / (stepMs || 220));
    return EAT[i < 2 ? i : 2 + ((i - 2) % 4)];
  }

  /* ---- 1.9.1 mood weather. The sky on the home screen follows how the pal is doing:
   *   very happy + well cared for -> sunny (a clear starry sky at night; a rainbow just after rain)
   *   okay -> the day's own weather, softened: clear with a couple of clouds, or cloudy
   *   sad or hungry -> grey clouds, then rain as it gets worse;  sick -> drizzle
   *   really neglected (empty hearts AND mess or sickness) -> a storm with lightning
   * Snow keeps its old 1.9.0 rule (the day's roll); only a darker mood replaces it.
   * `base` is that day's roll: 'clear' | 'rain' | 'snow'. Pure, so it is unit-tested. */
  var WET = { rain: 1, drizzle: 1, storm: 1 };
  function gloom(p) {
    var n = 0;
    if (p.hunger <= 0) n += 2; else if (p.hunger === 1) n += 1;
    if (p.happy <= 0) n += 2; else if (p.happy === 1) n += 1;
    if (p.poop >= 2) n += 1;
    if (p.poop >= 4) n += 1;
    if (p.sick) n += 2;
    return n;
  }
  function weather(p, base) {
    base = base || 'clear';
    var calm = base === 'snow' ? 'snow' : base === 'rain' ? 'cloudy' : 'clear';
    if (!p || p.fate || p.stage === 'egg') return calm;
    var g = gloom(p);
    if (g >= 6) return 'storm';
    if (p.sick) return 'drizzle';
    if (g >= 4) return 'rain';
    if (g >= 2) return 'grey';
    if (base !== 'snow' && p.happy >= 4 && p.hunger >= 3 && p.poop === 0 && !p.fake) return 'sunny';
    return calm;
  }
  /* A rainbow shows for a while when the sky turns sunny soon after it was wet.
   * memo = {} kept by the renderer; t in ms. Returns true while the rainbow is up. */
  var RAINBOW_GAP = 10 * 60e3, RAINBOW_MS = 90e3;
  function rainbow(memo, w, t) {
    if (WET[w]) { memo.wetAt = t; memo.bowAt = null; return false; }
    if (w !== 'sunny') { if (memo.bowAt != null) memo.bowAt = null; return false; }
    if (memo.bowAt == null && memo.wetAt != null && t - memo.wetAt <= RAINBOW_GAP) { memo.bowAt = t; memo.wetAt = null; }
    return memo.bowAt != null && t - memo.bowAt < RAINBOW_MS;
  }
  /* How the pal reacts to its sky now and then (none with reduced motion or while busy). */
  function weatherReaction(w) {
    return w === 'rain' || w === 'storm' || w === 'drizzle' ? 'shiver' : w === 'sunny' ? 'hop' : w === 'snow' ? 'shiver' : null;
  }

  /* ---- 1.9.1 morning report card: rep = { mins, dark, lit, mistakes } from the night's sleep. */
  function reportCard(rep) {
    if (!rep || !(rep.mins > 0)) return null;
    var darkPct = Math.round(100 * (rep.dark || 0) / rep.mins), m = rep.mistakes || 0;
    var grade = m === 0 && darkPct >= 90 ? 'A' : m === 0 && darkPct >= 50 ? 'B' : m <= 1 ? 'C' : 'D';
    var note = { A: 'Perfect night!', B: 'Good night - lights off sooner next time.', C: 'A rough night.', D: 'A bad night - check on your pal more.' }[grade];
    return { hours: Math.round(rep.mins / 6) / 10, darkPct: darkPct, mistakes: m, grade: grade, note: note };
  }

  PP.Behave = { weather: weather, gloom: gloom, rainbow: rainbow, weatherReaction: weatherReaction, reportCard: reportCard, WET: WET, RAINBOW_MS: RAINBOW_MS,
    ACTS: ACTS, pickIdle: pickIdle, nextBlinkGap: nextBlinkGap, blinkFrame: blinkFrame, eatFrame: eatFrame, BLINK_MS: 230 };
})(typeof window !== 'undefined' ? window : globalThis);
