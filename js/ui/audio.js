/* PocketPal - little square-wave bleeps (WebAudio). Mobile browsers only allow
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
  function tone(freq, dur, when, type, vol) {
    if (!enabled || !ctx || ctx.state !== 'running' || !freq) return;
    var t = ctx.currentTime + (when || 0);
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square'; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol == null ? 1 : vol, t); g.gain.exponentialRampToValueAtTime(0.01, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.02);
  }
  function seq(notes, step, type) { notes.forEach(function (f, i) { if (f) tone(f, step * 0.9, i * step, type); }); }
  var SFX = {
    move: function () { tone(880, 0.04); },
    lookL: function () { tone(523, 0.16, 0, 'triangle'); },   // Memory: low beep = left
    lookR: function () { tone(1047, 0.16, 0, 'triangle'); },  // high beep = right
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
  /* 1.9.0 music: short two-voice jingles (square lead + triangle bass) for the big moments.
   * They play only when BOTH Sound and Music are on; with Music off the old single bleeps play. */
  var N = {};
  'C D E F G A B'.split(' ').forEach(function (n, i) {
    var semi = [0, 2, 4, 5, 7, 9, 11][i];
    for (var o = 2; o <= 7; o++) { N[n + o] = 440 * Math.pow(2, (semi + (o - 4) * 12 - 9) / 12); N[n + '#' + o] = N[n + o] * Math.pow(2, 1 / 12); }
  });
  function voice(str, step, type, vol) {
    var t = 0;
    str.split(' ').forEach(function (tok) {
      var m = /^([A-G]#?\d|-)(\*(\d+))?$/.exec(tok); if (!m) return;
      var len = (+m[3] || 1) * step;
      if (m[1] !== '-') tone(N[m[1]], len * 0.92, t, type, vol);
      t += len;
    });
    return t;
  }
  var JINGLES = {
    hatch:   { step: 0.09, lead: 'C5 E5 G5 C6*2 - G5 C6*3', bass: 'C3*4 G3*4 C3*3' },
    evolve:  { step: 0.08, lead: 'G4 A4 B4 D5 G5*2 F#5 G5 A5 B5*2 D6*4', bass: 'G2*4 D3*4 G3*4 G2*4' },
    win:     { step: 0.1,  lead: 'E5 G5 C6*2 G5 C6 E6*4', bass: 'C3*2 G3*2 C3*2 C4*4' },
    cup:     { step: 0.11, lead: 'C5 C5 G5*2 F5 E5 D5 C6*2 - B5 C6*4', bass: 'C3*4 F3*4 G3*4 C3*4' },
    lose:    { step: 0.16, lead: 'G4 F#4 F4 E4*3', bass: 'C3*3 B2*3' },
    level:   { step: 0.08, lead: 'A4 C#5 E5 A5*3', bass: 'A2*3 E3*3' },
    goal:    { step: 0.07, lead: 'E5 G5 B5*2', bass: 'E3*2 B3*2' },
    allgoals:{ step: 0.08, lead: 'C5 E5 G5 E5 G5 C6*3 D6 E6*4', bass: 'C3*4 G3*4 C4*4' },
    rare:    { step: 0.09, lead: 'B5 - F#5 - B5 D6 F#6*4', bass: 'B2*4 F#3*4' },
    gameover:{ step: 0.22, lead: 'E4 D4 C4 B3 A3*4', bass: 'A2*4 E2*4' }
  };
  var music = true;
  function jingle(name) {
    var j = JINGLES[name]; if (!j) return false;
    voice(j.lead, j.step, 'square', 1); voice(j.bass, j.step, 'triangle', 0.7);
    return true;
  }
  var log = [];
  function play(name) {
    log.push(name); if (log.length > 30) log.shift();
    try {
      if (music && JINGLES[name] && enabled && ctx && ctx.state === 'running') { jingle(name); return; }
      if (SFX[name]) SFX[name]();
      else if (JINGLES[name]) SFX[{ cup: 'win', goal: 'ok', allgoals: 'happy', rare: 'level', gameover: 'die' }[name] || 'ok']();
    } catch (e) { /* ignore */ }
  }
  function setEnabled(v) { enabled = !!v; }
  function setMusic(v) { music = !!v; }
  PP.Audio = { unlock: unlock, play: play, setEnabled: setEnabled, setMusic: setMusic, isEnabled: function () { return enabled; }, musicOn: function () { return music; },
    JINGLES: JINGLES, log: log };
})(typeof window !== 'undefined' ? window : globalThis);
