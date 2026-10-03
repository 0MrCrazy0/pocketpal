/* PocketPal - live friend battles (1.9.7): rooms, lobby, polling and the battle controller.
 * The worker (cloudflare-worker.js, /room) only relays picks through KV; both games resolve every
 * turn with PP.Live / PP.Battle. Polling is short (1.2 s while waiting for a pick, 3 s otherwise)
 * and only reads, so a battle costs about 2 KV writes per turn. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var D = PP.DATA, G = PP.Game;
  var POLL_FAST = 1200, POLL_SLOW = 3000;
  var L = null;                                     // the current room session
  function cfg() { return PP.CONFIG || {}; }
  function App() { return PP.App; }
  function UI() { return PP.UI; }
  function st() { return App().state; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  /* https worker, or a local one (tests / your own machine) */
  function base() {
    var u = cfg().liveUrl || cfg().relayUrl || '';
    return /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u) ? u.replace(/\/+$/, '') : '';
  }
  function enabled() { return !!base() && typeof fetch === 'function'; }
  function call(path, body, method) {
    var o = { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json' } };
    if (L && L.token) o.headers['X-PP-Token'] = L.token;
    if (body) o.body = JSON.stringify(body);
    return fetch(base() + path, o).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; });
    });
  }
  function other(side) { return side === 'h' ? 'g' : 'h'; }
  function stopPoll() { if (L && L.timer) { clearTimeout(L.timer); L.timer = null; } }
  function poll(fn, ms) { stopPoll(); if (L) L.timer = setTimeout(function () { if (L) fn(); }, ms); }
  function getRoom() { return call('/room/' + L.room + '?side=' + L.side); }
  /* 404: the room expired (30 min without a write); 403: our seat was taken (two guests joined at once) */
  function gone(e) { return e && (e.status === 404 || e.status === 403); }
  function secs(ms) { return Math.max(0, Math.ceil(ms / 1000)); }

  /* ------------------------------------------------------------ rooms */
  function create() {
    var p = G.active(st()), why = G.canBattle(p);
    if (why) { App().toast(why); return; }
    var code = PP.Cards.encode(p);
    App().toast('Opening a room...');
    call('/room', { code: code }).then(function (j) {
      L = { room: j.room, side: 'h', token: j.token, seed: j.seed, hostCode: code, guestCode: null, round: 0, state: 'lobby', at: Date.now() };
      UI().push(lobbyScreen);
      lobbyTick();
    }).catch(function (e) { App().toast('Live battle: ' + e.message); });
  }
  function join(room) {
    room = String(room || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!PP.Live.validRoom(room)) { App().toast('A room code is 4 letters'); return; }
    var p = G.active(st()), why = G.canBattle(p);
    if (why) { App().toast(why); return; }
    var code = PP.Cards.encode(p);
    call('/room/' + room + '/join', { code: code }).then(function (j) {
      L = { room: room, side: 'g', token: j.token, seed: j.seed, hostCode: j.host, guestCode: code, round: 0, state: 'lobby', at: Date.now() };
      begin(0);
    }).catch(function (e) { App().toast('Live battle: ' + e.message); });
  }
  function lobbyTick() {
    if (!L || L.state !== 'lobby') return;
    getRoom().then(function (v) {
      if (!L || L.state !== 'lobby') return;
      L.last = v; L.error = null;
      if (v.guest) { L.guestCode = v.guest; begin(0); return; }
      lobbyText(); poll(lobbyTick, POLL_SLOW);
    }).catch(function (e) {
      if (!L) return;
      if (gone(e)) { App().toast('Room ' + L.room + ' has closed'); leave(true); UI().close(); return; }
      L.error = e.message; lobbyText(); poll(lobbyTick, POLL_SLOW * 2);
    });
  }
  function leave(quiet) {
    if (!L) return;
    var s = L; stopPoll(); L = null;
    if (s.token) call('/room/' + s.room + '/leave', { side: s.side, token: s.token }).catch(function () {});
    if (!quiet) App().toast('Left room ' + s.room);
  }
  /* the page is closing: tell the room (this counts as leaving = a forfeit in a battle) */
  function beacon() {
    if (!L || !L.token || !navigator.sendBeacon) return;
    try { navigator.sendBeacon(base() + '/room/' + L.room + '/leave', JSON.stringify({ side: L.side, token: L.token })); } catch (e) { /* closing anyway */ }
  }

  /* ------------------------------------------------------------ the battle */
  function begin(round) {
    var chk = PP.Live.checkCards(L.hostCode, L.guestCode);
    if (!chk.ok) { App().toast('Live battle stopped: ' + chk.error); leave(true); UI().close(); return; }
    var r = G.startLive(st(), chk.host, chk.guest, L.side, L.seed, round);
    if (!r.ok) { App().toast(r.msg); leave(true); UI().close(); return; }
    stopPoll();
    L.state = 'battle'; L.round = round; L.t = 0; L.B = r.battle; L.view = r.view; L.ended = false;
    L.oppName = (L.side === 'h' ? chk.guest : chk.host).name;
    UI().close();
    App().scene = 'battle';
    PP.BattleView.start(L.view, { title: 'LIVE ' + L.room, live: ctrl, onEnd: onEnd });
    App().save();
    menuWatch();
  }
  /* while you choose: watch for the other player leaving or your own pick timing out */
  function menuWatch() {
    if (!L || L.state !== 'battle' || L.waiting) return;
    getRoom().then(function (v) {
      if (!L || L.state !== 'battle' || L.waiting) return;
      L.last = v; L.skew = v.now - Date.now();
      var end = endingFrom(v);
      if (end) { finishWith(end); return; }
      poll(menuWatch, POLL_SLOW);
    }).catch(function (e) { if (gone(e)) { closed(); return; } poll(menuWatch, POLL_SLOW * 2); });
  }
  function endingFrom(v) {
    var o = v[other(L.side)];
    if (v.timeout === other(L.side)) return PP.Live.endBy(L.view, 'timeout', true);
    if (v.timeout === L.side) return PP.Live.endBy(L.view, 'lost-time', false);
    if (o && o.bye) return PP.Live.endBy(L.view, 'left', true);
    return null;
  }
  /* the room expired (30 min without a write) or vanished: cancel, no result */
  function closed() {
    var B = PP.Live.canon(L.view); B.over = true; B.ended = 'desync'; B.winner = null;
    var cb = L.waiting && L.cb; L.waiting = false; L.ended = true; stopPoll();
    var ev = [{ t: 'end', winner: -1, live: 'closed' }];
    if (cb) cb(ev); else PP.BattleView.inject(ev);
  }
  function finishWith(events) { L.ended = true; stopPoll(); L.waiting = false; PP.BattleView.inject(events); }
  var ctrl = {
    submit: function (mv, cb) {
      if (!L || L.state !== 'battle') return;
      if (!PP.Live.validMove(L.B, L.side, mv)) mv = null;
      L.t++; L.waiting = true; L.mySum = PP.Live.sum(L.B); L.myMv = mv; L.sentAt = Date.now(); L.cb = cb;
      stopPoll();
      call('/room/' + L.room + '/move', { side: L.side, token: L.token, r: L.round, t: L.t, mv: mv, sum: L.mySum })
        .then(function () { waitTick(); })
        .catch(function () { waitTick(); });            // e.g. "time up": the room state says what happened
    },
    forfeit: function () {
      var ev = PP.Live.endBy(L.view, 'forfeit', false);
      L.ended = true; L.forfeited = true; leave(true);
      return ev;
    },
    status: function () {
      if (!L) return '';
      var v = L.last, mine = v && v[L.side], left = mine && mine.t === L.t ? (v.turnMs - ((Date.now() + (L.skew || 0)) - mine.at)) : null;
      return 'Sent! Waiting for ' + String(L.oppName || 'your friend').toUpperCase() + '...' + (left != null && left < 60e3 ? ' (' + secs(left) + 's)' : '');
    },
    menuStatus: function () {
      if (!L || !L.last) return null;
      var o = L.last[other(L.side)];
      if (!o || o.r !== L.round || o.t <= L.t) return null;            // they have not picked yet: no clock on you
      var left = L.last.turnMs - ((Date.now() + (L.skew || 0)) - o.at);
      return 'Your pick! ' + secs(left) + 's left';
    },
    onMenu: function () { if (L && !L.ended) { L.waiting = false; menuWatch(); } }
  };
  function waitTick() {
    if (!L || L.state !== 'battle' || !L.waiting) return;
    getRoom().then(function (v) {
      if (!L || !L.waiting) return;
      L.last = v; L.skew = v.now - Date.now();
      var end = endingFrom(v);
      if (end) { L.waiting = false; L.ended = true; stopPoll(); L.cb(end); return; }
      var o = v[other(L.side)];
      if (o && o.r === L.round && o.t >= L.t && o.mv !== undefined) {
        L.waiting = false;
        var hostMv = L.side === 'h' ? L.myMv : o.mv, guestMv = L.side === 'h' ? o.mv : L.myMv;
        if (o.sum !== L.mySum || !PP.Live.validMove(L.B, other(L.side), o.mv)) {      // the two games disagree
          var B = PP.Live.canon(L.view); B.over = true; B.ended = 'desync'; B.winner = null;
          L.ended = true; stopPoll(); L.cb([{ t: 'end', winner: -1, live: 'desync' }]); return;
        }
        var ev = PP.Live.resolve(L.B, hostMv, guestMv, L.side);
        L.cb(ev); return;
      }
      poll(waitTick, POLL_FAST);
    }).catch(function (e) { if (gone(e)) { closed(); return; } poll(waitTick, POLL_FAST * 2); });
  }
  function onEnd(view) {
    var B = PP.Live.canon(view), s = L;
    stopPoll();
    App().scene = 'home';
    var out = B.ended === 'desync' ? null : G.finishBattle(st(), view);
    App().save();
    if (s) s.state = 'over';
    UI().open(resultScreen(out, view, s));
  }

  /* ------------------------------------------------------------ rematch */
  function rematch() {
    if (!L || L.state !== 'over') return;
    var why = G.canBattle(G.active(st()));
    if (why) { App().toast(why); return; }            // don't make the friend wait for a battle we cannot start
    var r = L.round + 1;
    L.state = 'rematch';
    call('/room/' + L.room + '/rematch', { side: L.side, token: L.token, r: r }).then(function () { rematchTick(r); })
      .catch(function (e) { App().toast('Rematch: ' + e.message); if (L) L.state = 'over'; });
    UI().refresh();
  }
  function rematchTick(r) {
    if (!L || L.state !== 'rematch') return;
    getRoom().then(function (v) {
      if (!L || L.state !== 'rematch') return;
      L.last = v;
      var o = v[other(L.side)];
      if (o.bye) { App().toast(String(L.oppName) + ' left the room'); leave(true); UI().close(); return; }
      if (o.rm === r || o.r === r) { begin(r); return; }
      poll(function () { rematchTick(r); }, POLL_SLOW);
    }).catch(function (e) {
      if (gone(e)) { App().toast('Room ' + L.room + ' has closed'); leave(true); UI().close(); return; }
      poll(function () { rematchTick(r); }, POLL_SLOW * 2);
    });
  }

  /* ------------------------------------------------------------ screens */
  function liveScreen() {
    var p = G.active(st()), why = G.canBattle(p), on = enabled();
    return { title: 'LIVE BATTLE', html: '<p>Battle a friend <b>live</b>: you both pick moves at the same time, turn by turn.</p>' +
      '<ul class="away live-limits"><li>Both of you need to be online. Your worker passes the picks on; each game plays the same turn itself.</li>' +
      '<li>' + Math.round(75) + ' s per pick. Leaving or running out of time counts as a loss.</li>' +
      '<li>Turns can lag if you are far apart (the worker\'s storage takes up to a minute to sync between regions).</li>' +
      '<li>No internet? Battle codes still work offline.</li></ul>' + (on ? '' : '<p class="tip">Live battles need your Cloudflare worker (see DEPLOY.md).</p>'),
      items: [
        { label: 'Create a room', sub: 'Get a 4-letter code for your friend', disabled: !on || !!why, reason: !on ? 'No worker configured' : why, act: create },
        { label: 'Join a room', sub: 'Type your friend\'s 4-letter code', disabled: !on || !!why, reason: !on ? 'No worker configured' : why, act: function () { UI().push(joinScreen); } },
        { label: 'Back', act: function () { UI().pop(); } }
      ] };
  }
  function joinScreen() {
    return { title: 'JOIN ROOM', html: '<p>Room code from your friend:</p><input id="roomIn" class="room-in" maxlength="4" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Room code" placeholder="ABCD">',
      items: [
        { label: 'Join', act: function () { join((document.getElementById('roomIn') || {}).value); } },
        { label: 'Back', act: function () { UI().pop(); } }
      ] };
  }
  function lobbyStatus(s) {
    var age = s.at ? Date.now() - s.at : 0;
    return s.error ? 'Connection trouble: ' + s.error + ' - retrying...' : 'Waiting for a friend... ' + Math.floor(age / 1000) + 's \u00b7 the room closes after 30 min.';
  }
  /* the lobby line ticks while we poll (the menu itself is not re-rendered) */
  function lobbyText() { var el = document.getElementById('lobbyStatus'); if (el && L) el.textContent = lobbyStatus(L); }
  function lobbyScreen() {
    var s = L || {};
    return { title: 'LIVE ROOM', live: true, html: '<div class="room-code" aria-label="Room code">' + esc(s.room || '----') + '</div>' +
      '<p>Tell your friend this code. They open <b>Battle \u25b8 Live battle \u25b8 Join a room</b>.</p>' +
      '<p class="tip" id="lobbyStatus">' + esc(lobbyStatus(s)) + '</p>',
      items: [{ label: 'Cancel', act: function () { leave(); UI().pop(); } }] };
  }
  function resultScreen(out, view, s) {
    return function () {
      var B = PP.Live.canon(view), title = 'LIVE BATTLE OVER', h;
      if (B.ended === 'desync') h = '<p><b>Out of sync.</b> The two games disagreed about the battle, so it was cancelled with no result.</p><p class="tip">Try again, or use battle codes.</p>';
      else {
        var how = { left: (s && s.oppName) + ' left', timeout: (s && s.oppName) + ' ran out of time', 'lost-time': 'You ran out of time', forfeit: 'You forfeited' }[B.ended] || '';
        h = '<p><b>' + (view.winner === 0 ? 'VICTORY!' : 'Defeat...') + '</b>' + (how ? ' \u00b7 ' + esc(how) : '') + '</p>' +
          (out ? '<ul class="away"><li>' + (out.fled ? 'No XP or coins' : '+' + out.xp + ' XP' + (out.levels ? ' \u00b7 LEVEL UP' : '')) + '</li>' + (out.coins ? '<li>+' + out.coins + ' coins</li>' : '') + '</ul>' : '');
      }
      var waiting = L && L.state === 'rematch';
      var canRematch = L && !L.forfeited && B.ended !== 'left' && B.ended !== 'timeout' && B.ended !== 'lost-time';
      var items = [];
      if (canRematch) items.push({ label: waiting ? 'Waiting for ' + L.oppName + '...' : 'Rematch', sub: 'Same room, new battle', disabled: waiting, reason: 'Asked - waiting for your friend', act: rematch });
      items.push({ label: 'Leave room', act: function () { leave(true); UI().close(); } });
      return { title: title, html: h + '<p class="tip">Room ' + esc(s ? s.room : '') + ' \u00b7 round ' + ((s ? s.round : 0) + 1) + '</p>', items: items, live: true };
    };
  }

  root.addEventListener && root.addEventListener('pagehide', beacon);
  PP.LiveUI = { enabled: enabled, liveScreen: liveScreen, joinScreen: joinScreen, create: create, join: join, leave: leave, rematch: rematch,
    _session: function () { return L; } };
})(typeof window !== 'undefined' ? window : globalThis);
