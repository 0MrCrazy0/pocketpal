/* PocketPal - live friend battles (1.9.7, pure part).
 * Both games build the SAME canonical battle: host = fighter 0, guest = fighter 1, seed from the
 * room (a rematch derives a new one), both cards with no care condition (neither side can see the
 * other's hunger). Each turn both picks go through the worker; every game then runs
 * PP.Battle.turn(B, hostPick, guestPick) itself, so the engine stays the only source of truth.
 * A checksum of the battle state is sent with every pick; if the two games ever disagree the
 * battle stops with no result (a desync), instead of each player seeing a different fight.
 * The guest plays through a mirrored VIEW (its own pal on the left, events swapped). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util;

  function seedFor(seed, round) { return round ? U.hash(seed >>> 0, 'rematch', round) >>> 0 : seed >>> 0; }
  function create(hostCard, guestCard, seed, round) {
    var B = PP.Battle.create(hostCard, guestCard, seedFor(seed, round), { a: { noCondition: true }, b: { noCondition: true } });
    B.meta = { kind: 'friend', live: true, round: round || 0 };
    return B;
  }
  /* Everything that decides the next turn, hashed (32-bit). */
  function sum(B) {
    return U.hash(JSON.stringify([B.turn, B.rng, !!B.over, B.winner, B.f.map(function (x) {
      return [x.hp, x.cds, x.used, x.buffs.map(function (b) { return [b.key, b.stat, b.mult, b.turns]; }), !!x.stunned, x.stunGuard, x.bleed, x.evade, x.evadeTurns, !!x.skip];
    })])) >>> 0;
  }
  function idx(side) { return side === 'g' ? 1 : 0; }
  /* A pick is fine if it is AUTO (null) or a move this fighter can use right now. */
  function validMove(B, side, mv) {
    if (mv === null) return true;
    return typeof mv === 'string' && PP.Battle.available(B.f[idx(side)]).indexOf(mv) >= 0;
  }
  function mapEvents(ev, side) {
    if (side !== 'g') return ev;
    return ev.map(function (e) {
      var o = Object.assign({}, e);
      if (typeof o.who === 'number') o.who = 1 - o.who;
      if (typeof o.winner === 'number') o.winner = 1 - o.winner;
      return o;
    });
  }
  /* Resolve one turn with both picks; returns the events as this player sees them. */
  function resolve(B, hostMv, guestMv, side) { return mapEvents(PP.Battle.turn(B, hostMv, guestMv), side); }
  /* The battle as one player sees it: f[0] is always YOUR pal; over / winner follow the canonical battle. */
  function view(B, side) {
    if (side !== 'g') { B.side = 'h'; return B; }
    var v = { canon: B, side: 'g', meta: B.meta, opp: null, paid: false, fled: null };
    Object.defineProperty(v, 'f', { get: function () { return [B.f[1], B.f[0]]; } });
    Object.defineProperty(v, 'over', { get: function () { return B.over; } });
    Object.defineProperty(v, 'turn', { get: function () { return B.turn; } });
    Object.defineProperty(v, 'winner', { get: function () { return B.winner == null ? null : 1 - B.winner; } });
    return v;
  }
  function canon(v) { return v.canon || v; }
  /* End the battle outside the engine: the other player left / ran out of time, or you forfeit. */
  function endBy(v, how, youWin) {
    var B = canon(v), me = idx(v.side);
    B.over = true; B.winner = youWin ? me : 1 - me; B.ended = how;
    if (how === 'forfeit' && !youWin) v.fled = 'forfeit';
    var ev = { t: 'end', winner: youWin ? 0 : 1, live: how };
    if (v.fled) ev.fled = 'forfeit';
    return [ev];
  }
  /* Both cards must pass the full battle-code check on THIS device too. */
  function checkCards(hostCode, guestCode) {
    var h = PP.Cards.decode(hostCode), g = PP.Cards.decode(guestCode);
    if (!h.ok) return { ok: false, error: 'Host pal: ' + h.error };
    if (!g.ok) return { ok: false, error: 'Guest pal: ' + g.error };
    return { ok: true, host: h.card, guest: g.card };
  }
  function validRoom(c) { return typeof c === 'string' && /^[A-HJ-NP-Z]{4}$/.test(c.toUpperCase()); }

  PP.Live = { seedFor: seedFor, create: create, sum: sum, validMove: validMove, mapEvents: mapEvents, resolve: resolve, view: view, canon: canon,
    endBy: endBy, checkCards: checkCards, validRoom: validRoom, idx: idx };
})(typeof window !== 'undefined' ? window : globalThis);
