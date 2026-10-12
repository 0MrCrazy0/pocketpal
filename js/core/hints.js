/* PocketPal 1.9.0 - gentle first-time hints (pure, no DOM).
 * While a pal is young (egg, baby, child) the home screen shows ONE short tip for
 * whatever it needs right now, until the player has done that thing once (or
 * dismissed the tip). Hints can be switched off in Settings. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};

  /* Most urgent first. test(p) -> is this topic relevant right now? */
  var TOPICS = [
    { id: 'egg', text: 'Your egg is warming up. It hatches in a few minutes!', test: function (p) { return p.stage === 'egg'; } },
    { id: 'sick', text: 'Your pal is sick: open Care and give Medicine.', test: function (p) { return p.sick; } },
    { id: 'hungry', text: 'Tummy rumbling! Open Care and feed a Meal.', test: function (p) { return !p.asleep && p.hunger <= 1; } },
    { id: 'lights', text: 'Bedtime! Turn the Lights off so it sleeps well.', test: function (p) { return p.asleep && p.sleepKind === 'night' && p.lights; } },
    { id: 'poop', text: 'Oops, a mess. Use Clean before it makes your pal ill.', test: function (p) { return p.poop > 0; } },
    { id: 'tantrum', text: 'A tantrum! Nothing is wrong: Scold it to teach discipline.', test: function (p) { return !!p.fake; } },
    { id: 'play', text: 'Feeling low? Play a game to cheer your pal up.', test: function (p) { return !p.asleep && p.happy <= 1; } },
    { id: 'tired', text: 'Sleepy... let it nap: turn the Lights off for a while.', test: function (p) { return PP.Care.isTired(p); } },
    { id: 'train', text: 'Try Train: it builds discipline and makes stronger adults.', test: function (p) { return !p.asleep && p.stage !== 'baby' && p.ageMin > 30; } },
    { id: 'praise', text: 'Good deed! Praise your pal now for extra discipline.', test: function (p) { return PP.Care.praiseOpen(p) && p.stage !== 'baby'; } },
    { id: 'status', text: 'Check Status any time to see hearts, energy and care mistakes.', test: function (p) { return p.ageMin > 10; } }
  ];
  /* Which action marks a topic as learned. */
  var LEARN = { meal: ['hungry'], snack: ['play'], clean: ['poop'], medicine: ['sick'], lights: ['lights', 'tired'], scold: ['tantrum'],
    praise: ['praise'], game: ['play'], train: ['train'], status: ['status'], hatch: ['egg'] };
  var YOUNG = ['egg', 'baby', 'child'];

  function ensure(state) {
    if (!state.hints || typeof state.hints !== 'object' || !state.hints.done) state.hints = { done: {} };
    return state.hints;
  }
  function enabled(state) { return !state.settings || state.settings.hints !== false; }
  function next(state, p) {
    if (!enabled(state) || !p || p.fate || YOUNG.indexOf(p.stage) < 0) return null;
    var h = ensure(state);
    for (var i = 0; i < TOPICS.length; i++) {
      var t = TOPICS[i];
      if (!h.done[t.id] && t.test(p)) return { id: t.id, text: t.text };
    }
    return null;
  }
  function learn(state, action) {
    var h = ensure(state);
    (LEARN[action] || []).forEach(function (id) { h.done[id] = true; });
  }
  function dismiss(state, id) { ensure(state).done[id] = true; }
  function reset(state) { state.hints = { done: {} }; }
  function clean(h) {
    var o = { done: {} };
    if (h && h.done && typeof h.done === 'object') TOPICS.forEach(function (t) { if (h.done[t.id]) o.done[t.id] = true; });
    return o;
  }
  PP.Hints = { TOPICS: TOPICS, LEARN: LEARN, next: next, learn: learn, dismiss: dismiss, reset: reset, clean: clean, enabled: enabled };
})(typeof window !== 'undefined' ? window : globalThis);
