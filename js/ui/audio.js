/* PocketPal 2 - little square-wave bleeps (WebAudio). Mobile browsers only allow
 * sound after a user gesture, so the context is created/resumed on the first tap/key. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var ctx = null, enabled = true, master = null;

  function unlock() {
    try {
      if (!ctx) {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain(); master.gain.value = 0.08; master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
      // iOS: play a silent blip inside the gesture
      var o = ctx.createOscillator(), g = ctx.createGain(); g.gain.value = 0; o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + 0.01);
    } catch (e) { /* no audio - fine */ }
  }
  function tone(freq, dur, when, type) {
    if (!enabled || !ctx || ctx.state !== 'running') return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function seq(notes, step, type) { notes.forEach(function (f, i) { if (f) tone(f, step * 0.9, i * step, type); }); }
  var SFX = {
    move: function () { tone(880, 0.04); },
    ok: function () { tone(1320, 0.06); },
    back: function () { tone(440, 0.06); },
    no: function () { seq([220, 180], 0.08); },
    call: function () { seq([1568, 0, 1568, 0, 1568], 0.08); },
    eat: function () { seq([523, 659, 523, 659], 0.07); },
    happy: function () { seq([784, 988, 1175, 1568], 0.07); },
    sad: function () { seq([392, 330, 262], 0.12, 'triangle'); },
    poop: function () { seq([196, 147], 0.1, 'triangle'); },
    hit: function () { tone(160, 0.08, 0, 'sawtooth'); },
    crit: function () { seq([200, 120], 0.06, 'sawtooth'); },
    miss: function () { tone(1800, 0.05, 0, 'triangle'); },
    heal: function () { seq([660, 880, 1100], 0.06, 'triangle'); },
    win: function () { seq([523, 659, 784, 1047, 0, 1047], 0.1); },
    lose: function () { seq([392, 370, 349, 330], 0.16, 'triangle'); },
    evolve: function () { seq([523, 587, 659, 698, 784, 880, 988, 1047], 0.08); },
    hatch: function () { seq([784, 0, 784, 1047], 0.09); },
    level: function () { seq([880, 1109, 1319], 0.08); },
    die: function () { seq([330, 294, 262, 247, 220], 0.25, 'triangle'); }
  };
  function play(name) { try { if (SFX[name]) SFX[name](); } catch (e) { /* ignore */ } }
  function setEnabled(v) { enabled = !!v; }
  PP.Audio = { unlock: unlock, play: play, setEnabled: setEnabled, isEnabled: function () { return enabled; } };
})(typeof window !== 'undefined' ? window : globalThis);
