/* PocketPal - computer arena (pure).
 * 1.8.4: every cup is a run of fixed foes (challenger, rival trainer, cup boss; the post-game
 * Myth Cup has 4). Foes are the same for everyone - species, form, level and name come from
 * DATA.ARENA, genes and skills from a fixed seed - so the cup screen can list them and tick
 * off the ones you have beaten. Per-cup records live in state.arena.cups (see record()). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;
  var GENE_K = ['hp', 'atk', 'def', 'spd'];

  function cup(rank) { return D.ARENA[U.clamp(rank | 0, 0, D.ARENA.length - 1)]; }
  function foeCount(rank) { return cup(rank).foes.length; }
  /* The foe's battle card. `rank` = cup index (0-based), `idx` = foe index in the cup. */
  function foe(rank, idx) {
    rank = U.clamp(rank | 0, 0, D.ARENA.length - 1);
    var c = D.ARENA[rank], f = c.foes[U.clamp(idx | 0, 0, c.foes.length - 1)];
    idx = c.foes.indexOf(f);
    var rng = U.makeRng(U.hash('arena-foe', rank, idx));
    var level = U.clamp(f[2], 1, PP.Stats.levelCap(f[1]));
    /* Genes are a fixed build per role (shuffled by the foe's seed), so the level curve - not lucky
     * dice - sets the difficulty: challenger / rival = one +1 and one -1 (an average pal), cup boss =
     * +1 +1 -1 (the Myth Cup boss: +2 +1 +1); the two warm-up cups are a notch weaker. */
    var easy = rank < 2;   // Sprout and Pebble are the warm-up: a fresh Lv 1 Scrappy pal can win them
    var build = f[3] === 'boss' ? (c.post ? [2, 1, 1, 0] : easy ? [0, 0, -1, -1] : [1, 1, 0, -1]) : easy ? [0, -1, -1, -1] : [1, -1, 0, 0], order = GENE_K.slice(), genes = {};
    for (var i = order.length - 1; i > 0; i--) { var j = rng.int(0, i), tmp = order[i]; order[i] = order[j]; order[j] = tmp; }
    order.forEach(function (k, n) { genes[k] = build[n]; });
    var card = { id: 'cpu' + rank + 'x' + idx, name: f[4] || PP.Pet.randomName(rng), species: f[0], sex: rng.chance(0.5) ? 'M' : 'F',
      form: f[1], level: level, genes: genes, skills: [], innate: [], gen: 1, stage: 'adult', sp: PP.Stats.totalSpForLevel(level) };
    PP.Skills.autoLearn(card, rng);
    delete card.sp;
    card.cup = c.name; card.rank = rank; card.foe = idx; card.role = f[3];
    return card;
  }
  /* Old API (quick battles, older tests): a foe of the cup, picked by `attempt`. */
  function opponent(rank, attempt) { return foe(rank, Math.abs(attempt | 0) % foeCount(rank)); }

  function blankRecord(rank) { return { won: false, best: 0, beat: cup(rank).foes.map(function () { return false; }), wins: 0, losses: 0 }; }
  function record(state, rank) {
    var a = state.arena;
    if (!Array.isArray(a.cups)) a.cups = [];
    if (!a.cups[rank]) a.cups[rank] = blankRecord(rank);
    return a.cups[rank];
  }
  function cleanRecord(r, rank) {
    var b = blankRecord(rank);
    if (!r || typeof r !== 'object') return b;
    b.won = r.won === true;
    b.beat = b.beat.map(function (x, i) { return !!(Array.isArray(r.beat) && r.beat[i] === true); });
    b.best = U.int(r.best, 0, 0, b.beat.length);
    if (b.won) b.best = b.beat.length;
    b.wins = U.int(r.wins, 0, 0); b.losses = U.int(r.losses, 0, 0);
    return b;
  }
  function won(state, rank) { var c = state.arena && state.arena.cups && state.arena.cups[rank]; return !!(c && c.won); }
  /* Cups won among the 12 main cups (the post-game cup does not count toward Champion). */
  function mainWon(state, upTo) {
    var n = 0, lim = Math.min(upTo || D.ARENA_MAIN, D.ARENA_MAIN);
    for (var i = 0; i < lim; i++) if (won(state, i)) n++;
    return n;
  }
  /* 'locked' | 'open' | 'cleared' */
  function status(state, rank) {
    if (won(state, rank)) return 'cleared';
    if (D.ARENA[rank].post) return state.arena.champion ? 'open' : 'locked';
    return rank <= state.arena.rank ? 'open' : 'locked';
  }
  /* The run in progress for the pal that is out (a run belongs to the pal that started it). */
  function runOf(state) {
    var r = state.arena && state.arena.run, p = PP.Game && PP.Game.active ? PP.Game.active(state) : null;
    return r && (!r.pal || (p && p.id === r.pal)) ? r : null;
  }
  /* Which foe is next in this cup: the current run's position, or 0 for a fresh run. */
  function nextFoe(state, rank) { var r = runOf(state); return r && r.cup === rank ? r.foe : 0; }

  /* Sanitise / migrate state.arena (any shape) -> the 1.8.4 shape. Stars are only kept when a
   * per-cup record says so - an old rank number alone never awards a star. */
  function clean(a, proven) {
    a = a && typeof a === 'object' ? a : {};
    var out = { rank: U.int(a.rank, 0, 0, D.ARENA_MAIN - 1), attempt: U.int(a.attempt, 0, 0), champion: false, cups: [], run: null, note: a.note === 'reset' ? 'reset' : null };
    for (var i = 0; i < D.ARENA.length; i++) out.cups.push(cleanRecord(Array.isArray(a.cups) ? a.cups[i] : (proven && proven[i] ? { won: true, beat: cup(i).foes.map(function () { return true; }) } : null), i));
    // a won cup always opens the next one
    for (var j = 0; j < D.ARENA_MAIN; j++) if (out.cups[j].won) out.rank = Math.max(out.rank, Math.min(j + 1, D.ARENA_MAIN - 1));
    out.champion = mainWon({ arena: out }) === D.ARENA_MAIN;
    if (a.run && typeof a.run === 'object') {
      var rc = U.int(a.run.cup, -1, -1, D.ARENA.length - 1), rf = U.int(a.run.foe, 0, 0);
      if (rc >= 0 && rf > 0 && rf < foeCount(rc) && status({ arena: out }, rc) !== 'locked') out.run = { cup: rc, foe: rf, pal: typeof a.run.pal === 'string' ? a.run.pal.slice(0, 40) : null };
    }
    return out;
  }
  /* 4 -> 5 migration: an old save only has { rank, champion }. The rank could have come from the
   * test panel's "Unlock arena", so it is only trusted as wins when test mode is off and the pals'
   * recorded battle wins are enough to have climbed that far (1 win per cup). Otherwise no stars
   * are given (the cups stay open) and the arena screen explains it once. */
  function migrate(st) {
    var a = st.arena || {}, rank = U.int(a.rank, 0, 0, D.ARENA_MAIN - 1), champ = !!a.champion;
    var wins = {}, total = 0;
    (st.album || []).concat(st.slots || []).forEach(function (p) { if (p && p.id) wins[p.id] = Math.max(wins[p.id] || 0, U.int(p.wins, 0, 0)); });
    Object.keys(wins).forEach(function (k) { total += wins[k]; });
    var cleared = rank + (champ ? 1 : 0);
    var trusted = cleared > 0 && !(st.settings && st.settings.test) && total >= cleared;
    var proven = [];
    if (trusted) { for (var i = 0; i < rank; i++) proven[i] = true; if (champ) proven[D.ARENA_MAIN - 1] = true; }
    var out = clean({ rank: rank, attempt: a.attempt }, proven);
    if (cleared > 0 && !trusted) out.note = 'reset';
    return out;
  }

  PP.Arena = { cups: D.ARENA, foe: foe, opponent: opponent, foeCount: foeCount, record: record, won: won, mainWon: mainWon, status: status,
    nextFoe: nextFoe, runOf: runOf, clean: clean, migrate: migrate, blankRecord: blankRecord };
})(typeof window !== 'undefined' ? window : globalThis);
