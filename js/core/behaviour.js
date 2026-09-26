/* PocketPal 2 - idle behaviour + face animation timing (pure, testable).
 * The renderer asks: "the pal is standing around - what does it do next?" and
 * "which frame of the blink / chew cycle is it on?". */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};

  /* Things a pal does between walks. dur in ms; frameMs = how fast its 4 frames step. */
  var ACTS = {
    stand:   { pose: 'idle',    dur: [1500, 3500], frameMs: 500 },
    look:    { pose: 'look',    dur: [2000, 2800], frameMs: 700 },  // back, forward, up, down
    sit:     { pose: 'sit',     dur: [3500, 7000], frameMs: 0 },    // frames 3 (half) and 1 (closed) used as its blink
    yawn:    { pose: 'yawn',    dur: [1400, 1600], frameMs: 700 },
    scratch: { pose: 'scratch', dur: [1200, 1800], frameMs: 160 },
    bored:   { pose: 'bored',   dur: [2400, 3200], frameMs: 1200 },
    dance:   { pose: 'dance',   dur: [1800, 2600], frameMs: 260 },
    quirk:   { pose: 'quirk',   dur: [1200, 1600], frameMs: 320 },  // species habit: mane shake, howl, belly scratch, jaw snap, wing stretch, trunk spray
    sleepy:  { pose: 'sleepy',  dur: [2400, 3600], frameMs: 600 }   // nodding off
  };

  /* Weighted choice that reacts to mood: tired pals yawn and sit, sad pals mope,
   * very happy pals dance. r1, r2 in [0,1). */
  function pickIdle(p, r1, r2) {
    var e = p ? p.energy : 80, hap = p ? p.happy : 2, young = p && p.stage === 'baby';
    var w = {
      stand: 4, look: 3, sit: e < 40 ? 4 : 2, yawn: e < 35 ? 3 : 0.6, scratch: young ? 0.5 : 1.2,
      bored: hap <= 1 ? 3 : 0.4, dance: hap >= 4 ? 1.2 : 0, quirk: young ? 0.8 : 1.4, sleepy: e < 30 ? 2.5 : 0
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

  PP.Behave = { ACTS: ACTS, pickIdle: pickIdle, nextBlinkGap: nextBlinkGap, blinkFrame: blinkFrame, eatFrame: eatFrame, BLINK_MS: 230 };
})(typeof window !== 'undefined' ? window : globalThis);
