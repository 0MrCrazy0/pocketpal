/* PocketPal - weekly lobby + friend QR codes (2.4.97).
 * Lobby: an opt-in "find friends" board on YOUR worker (POST /lobby/*), behind a parent switch (Settings, OFF by
 * default). Others see only your pal's name, animal, stage and level and a random handle; there is no chat. A friend
 * request or a challenge needs the other player to accept: only then are battle codes swapped (and a challenge comes
 * with a live room the accepting player opens). Seats and requests expire every Monday 00:00 UTC.
 * QR: your battle code as a QR code (PP.QR, no CDN) and a camera scanner where the browser has BarcodeDetector;
 * everywhere else you paste or type the code. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var D = PP.DATA, G = PP.Game;
  function App() { return PP.App; }
  function K() { return PP.UI.kit; }
  function st() { return App().state; }
  function pet() { return G.active(st()); }
  function esc(s) { return K().esc(s); }
  function toast(m) { App().toast(m); }
  function base() {
    var c = PP.CONFIG || {}, u = c.liveUrl || c.relayUrl || '';
    return /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(u) ? u.replace(/\/+$/, '') : '';
  }
  function enabled() { return !!base() && typeof fetch === 'function'; }
  function api(path, body) {
    return fetch(base() + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) {
      if (r.status === 404 && !/^\/lobby\/(ask|answer)$/.test(path)) throw new Error('the online server needs its 2.4.97 update (DEPLOY.md)');
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || ('HTTP ' + r.status)); e.status = r.status; throw e; } return j; });
    });
  }
  function week(ms) { return Math.floor((ms + 3 * 86400e3) / (7 * 86400e3)); }   // = the worker's lobbyWeek (Monday 00:00 UTC)
  function seat() { var L = st().lobby; return L && L.week === week(Date.now()) ? L : null; }
  function auth() { var L = seat(); return L ? { id: L.id, token: L.token } : null; }
  function stageText(e) { return e.st === 'adult' ? 'Lv' + e.l : e.st; }
  function animal(i) { var sp = D.SPECIES[i] || 'lion'; return sp.charAt(0).toUpperCase() + sp.slice(1); }
  function forbidden() {
    if (!st().settings.lobby) return 'A grown-up needs to switch on Settings \u25b8 Weekly lobby';
    if (!enabled()) return 'Needs the game\u2019s online server (see DEPLOY.md)';
    return null;
  }
  var busy = false, rooms = [];   // rooms = challenges that were accepted: [{ room, n, h }] (kept while the app is open)

  /* ---------------------------------------------------------------- the parent switch */
  function parentGate() {
    var a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
    return function () {
      return { title: 'FOR GROWN-UPS', html: '<p>The <b>weekly lobby</b> puts your pal on a public board on your game\u2019s server so other players can send a friend request or a battle challenge.</p>' +
        '<ul class="away"><li>Others see only the pal\u2019s name, animal and level, and a random handle like \u201cSunnyOtter42\u201d.</li><li>No chat and no personal information. Nothing is shared until <b>you</b> accept a request.</li><li>Everything is cleared every Monday.</li></ul>' +
        '<p>To switch it on, type the answer: <b>' + a + ' \u00d7 ' + b + '</b> =</p><input id="gateIn" class="room-in" inputmode="numeric" maxlength="3" autocomplete="off" aria-label="Answer">',
        items: [
          { label: 'Switch the lobby on', act: function () {
            var v = ((document.getElementById('gateIn') || {}).value || '').trim();
            if (+v !== a * b) { toast('That is not the answer'); PP.Audio.play('no'); return; }
            st().settings.lobby = true; App().save(); toast('Weekly lobby is on'); K().pop();
          } },
          { label: 'Cancel', act: K().pop }
        ] };
    };
  }
  function toggle() {
    var s = st();
    if (!s.settings.lobby) { K().push(parentGate()); return; }
    var a = auth();
    s.settings.lobby = false; s.lobby = null; App().save();
    if (a && enabled()) api('/lobby/leave', a).catch(function () {});
    toast('Weekly lobby is off'); K().refresh();
  }
  function settingsItem() {
    var on = !!st().settings.lobby;
    return { label: 'Weekly lobby', right: on ? 'ON' : 'OFF', sub: on ? 'Find friends: a public board (switch off to leave it)' : 'Parent switch: find friends on a public board', act: toggle };
  }

  /* ---------------------------------------------------------------- lobby screens */
  function join() {
    var p = pet(), why = forbidden() || (!p || p.fate || p.stage === 'egg' || p.stage === 'baby' ? 'Your pal needs to be a child, teen or adult' : null);
    if (why) { toast(why); return; }
    if (busy) return; busy = true;
    var L = seat(), body = { code: PP.Cards.encode(p) };
    if (L) { body.id = L.id; body.token = L.token; }
    api('/lobby/join', body).then(function (j) {
      busy = false; st().lobby = { id: j.id, token: j.token, handle: j.handle, week: j.week }; App().save();
      toast(L ? 'Your lobby card is up to date' : 'You are in this week\u2019s lobby as ' + j.handle); K().refresh();
    }).catch(function (e) { busy = false; toast('Lobby: ' + e.message); });
  }
  function leave() {
    var a = auth(); st().lobby = null; App().save(); K().refresh();
    if (a) api('/lobby/leave', a).then(function () { toast('You left the lobby'); }).catch(function () {});
  }
  function lobbyScreen() {
    var s = st(), p = pet(), L = seat(), why = forbidden();
    var mine = p && p.stage !== 'egg' ? esc(p.name) + ' the ' + esc(D.NAMES[p.species][PP.Sprites.stageKeyOf(p).replace('adult_', '')] || p.species) + (p.stage === 'adult' ? ' Lv' + p.level : ' (' + p.stage + ')') : 'your pal';
    var h = '<p>Find friends to battle and swap codes with. Each week starts a new board (Monday).</p>';
    var items = [];
    if (why) {
      h += '<p class="tip">' + esc(why) + '.</p>';
      if (!s.settings.lobby) items.push({ label: 'Grown-up: switch it on', act: function () { K().push(parentGate()); } });
    } else if (!L) {
      h += '<p>Others will see: <b>' + mine + '</b> and a random handle. No chat, no personal info.</p>';
      items.push({ label: 'Join this week\u2019s lobby', act: join });
    } else {
      h += '<p>You are <b>' + esc(L.handle) + '</b> \u00b7 ' + mine + '</p>';
      items.push({ label: 'Players this week', sub: 'Send a friend request or a challenge', act: function () { K().push(listScreen(null)); load(); } },
        { label: 'Requests', sub: 'Accept or say no thanks', right: rooms.length ? rooms.length + ' room' + (rooms.length > 1 ? 's' : '') : '', act: function () { K().push(inboxScreen(null)); inbox(); } },
        { label: 'Update my card', sub: 'After it levels up or grows', act: join },
        { label: 'Leave the lobby', act: leave });
    }
    items.push({ label: 'Back', act: K().pop });
    return { title: 'WEEKLY LOBBY', html: h, items: items };
  }
  function load() {
    api('/lobby/list', auth() || {}).then(function (j) { K().replace(listScreen(j.entries || [])); }).catch(function (e) { K().replace(listScreen({ error: e.message })); });
  }
  function listScreen(entries) {
    return function () {
      var items = [], h = '';
      if (!entries) h = '<p>Looking...</p>';
      else if (entries.error) h = '<p class="tip">' + esc(entries.error) + '</p>';
      else if (!entries.length) h = '<p class="tip">Nobody else is here yet this week. Try again later!</p>';
      else entries.forEach(function (e) {
        var sp = D.SPECIES[e.s] || 'lion';
        items.push({ icon: K().thumb(sp, e.st === 'adult' ? 'adult_good' : e.st, 'idle', 15), label: e.n + ' \u00b7 ' + animal(e.s) + ' ' + stageText(e), sub: e.h, act: function () { K().push(entryMenu(e)); } });
      });
      items.push({ label: 'Refresh', act: load }, { label: 'Back', act: K().pop });
      return { title: 'PLAYERS', html: h, items: items };
    };
  }
  function ask(e, kind) {
    var a = auth(); if (!a) { toast('Join the lobby again first'); return; }
    if (busy) return; busy = true;
    api('/lobby/ask', { id: a.id, token: a.token, to: e.id, kind: kind }).then(function (j) {
      busy = false; toast(j.unchanged ? 'Already sent - waiting for ' + e.h : (kind === 'friend' ? 'Friend request sent to ' : 'Challenge sent to ') + e.h); PP.Audio.play('happy');
    }).catch(function (err) { busy = false; toast('Lobby: ' + err.message); });
  }
  function entryMenu(e) {
    return function () {
      var p = pet(), adult = p && p.stage === 'adult', same = p && p.stage === e.st, why = G.canBattle(p);
      return { title: String(e.h).toUpperCase(), html: '<p><b>' + esc(e.n) + '</b> the ' + esc(animal(e.s)) + ' \u00b7 ' + esc(stageText(e)) + '</p><p class="tip">They need to accept. Codes are only swapped when they do.</p>',
        items: [
          { label: 'Send a friend request', sub: 'You both get each other\u2019s battle code', disabled: !adult || e.st !== 'adult', reason: 'Friend codes are for adult pals', act: function () { ask(e, 'friend'); } },
          { label: 'Challenge to a live battle', sub: 'If they accept, they open a room for you', disabled: !same || !!why, reason: !same ? 'Live battles need two pals of the same stage' : why, act: function () { ask(e, 'challenge'); } },
          { label: 'Back', act: K().pop }
        ] };
    };
  }
  function addCode(code, n) {
    var r = G.addFriend(st(), code);
    if (r.ok) { App().save(); return n + ' is now your friend!'; }
    return n + ': ' + r.msg;
  }
  function inbox() {
    var a = auth(); if (!a) { K().replace(inboxScreen({ error: 'Join the lobby again first' })); return; }
    api('/lobby/inbox', a).then(function (j) {
      var asks = [], said = [];
      (j.items || []).forEach(function (x) {
        if (x.k === 'ok' && x.kind === 'friend' && x.code) said.push(addCode(x.code, x.n || x.h));
        else if (x.k === 'ok' && x.kind === 'challenge' && /^[A-Z]{4}$/.test(x.room || '')) { rooms = rooms.filter(function (r) { return r.room !== x.room; }); rooms.unshift({ room: x.room, n: x.n, h: x.h }); if (x.code) addCode(x.code, x.n); }
        else if (x.k === 'no') said.push((x.h || 'They') + ' said no thanks');
        else if (x.k === 'friend' || x.k === 'challenge') asks.push(x);
      });
      if (said.length) toast(said.join(' \u00b7 '));
      K().replace(inboxScreen(asks));
    }).catch(function (e) { K().replace(inboxScreen({ error: e.message })); });
  }
  function answer(x, yes) {
    var a = auth(); if (!a || busy) return;
    var send = function (room) {
      busy = true;
      return api('/lobby/answer', { id: a.id, token: a.token, to: x.from, kind: x.k, yes: yes, room: room }).then(function (j) {
        busy = false;
        if (yes && j.code && x.k === 'friend') toast(addCode(j.code, x.n));
        else if (yes && j.code) addCode(j.code, x.n);
        if (!yes) toast('Said no thanks');
        if (!room) inbox();
      }).catch(function (e) { busy = false; toast('Lobby: ' + e.message); });
    };
    if (yes && x.k === 'challenge') {
      // open a live room first, then send its code with the yes; the room screen waits for them
      PP.LiveUI.create(function (room) { send(room); });
      return;
    }
    send();
  }
  function inboxScreen(asks) {
    return function () {
      var items = [], h = '';
      rooms.forEach(function (r) { items.push({ label: 'Join room ' + r.room, sub: (r.n || r.h) + ' accepted your challenge', act: function () { rooms = rooms.filter(function (q) { return q !== r; }); PP.LiveUI.join(r.room); } }); });
      if (!asks) h = '<p>Checking...</p>';
      else if (asks.error) h = '<p class="tip">' + esc(asks.error) + '</p>';
      else asks.forEach(function (x) {
        var what = x.k === 'friend' ? 'wants to be friends' : 'challenges you to a live battle';
        items.push({ label: (x.n || 'Pal') + ' \u00b7 ' + animal(x.s) + ' ' + stageText(x), sub: x.h + ' ' + what, act: function () { K().push(askMenu(x, what)); } });
      });
      if (asks && !asks.error && !asks.length && !rooms.length) h = '<p class="tip">No requests right now.</p>';
      items.push({ label: 'Refresh', act: inbox }, { label: 'Back', act: K().pop });
      return { title: 'REQUESTS', html: h, items: items };
    };
  }
  function askMenu(x, what) {
    return function () {
      var why = x.k === 'challenge' ? G.canBattle(pet()) : null;
      return { title: String(x.h).toUpperCase(), html: '<p><b>' + esc(x.n) + '</b> the ' + esc(animal(x.s)) + ' ' + esc(what) + '.</p>' + (x.k === 'friend' ? '<p class="tip">Yes: you both get each other\u2019s battle code.</p>' : '<p class="tip">Yes: a live room opens and they get its code.</p>'),
        items: [
          { label: 'Yes!', disabled: !!why, reason: why, act: function () { K().pop(); answer(x, true); } },
          { label: 'No thanks', act: function () { K().pop(); answer(x, false); } },
          { label: 'Back', act: K().pop }
        ] };
    };
  }

  /* ---------------------------------------------------------------- QR */
  function qrHtml(code) {
    try { return '<div class="qr-box">' + PP.QR.svg(code, 216) + '</div>'; } catch (e) { return ''; }
  }
  /* the whole QR on a white page (the LCD window is too small to scan from); a tap or Escape closes it */
  function showBig(code) {
    var old = document.getElementById('qrFull'); if (old) old.remove();
    var d = document.createElement('div'); d.id = 'qrFull'; d.className = 'qr-full'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', 'Battle code QR');
    var svg; try { svg = PP.QR.svg(code, 600); } catch (e) { toast('This code is too long for a QR'); return; }
    d.innerHTML = svg + '<p>Let your friend scan this: <b>Add friend code \u25b8 Scan a QR code</b>. Tap to close.</p>';
    var close = function () { d.remove(); document.removeEventListener('keydown', key, true); };
    var key = function (e) { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); close(); } };
    d.addEventListener('click', close); document.addEventListener('keydown', key, true);
    document.body.appendChild(d);
  }
  function canScan() { return typeof root.BarcodeDetector === 'function' && !!(root.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }
  function scanScreen() {
    var stream = null, done = false;
    function stop() { done = true; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    function found(text) {
      stop(); var r = G.addFriend(st(), text);
      toast(r.msg); PP.Audio.play(r.ok ? 'happy' : 'no'); if (r.ok) App().save();
      K().pop();
    }
    setTimeout(function () {
      var v = document.getElementById('qrVideo'); if (!v || done) return;
      var det; try { det = new root.BarcodeDetector({ formats: ['qr_code'] }); } catch (e) { toast('This browser cannot scan QR codes - type the code instead'); return; }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
        stream = s; v.srcObject = s; v.play().catch(function () {});
        (function tick() {
          if (done) return;
          if (!document.body.contains(v)) { stop(); return; }   // the screen was closed
          det.detect(v).then(function (codes) {
            var c = (codes || []).map(function (x) { return x.rawValue; }).filter(function (t) { return /^PP2-/.test(t || ''); })[0];
            if (c) found(c); else setTimeout(tick, 250);
          }).catch(function () { setTimeout(tick, 400); });
        })();
      }).catch(function () { toast('No camera (or no permission) - type the code instead'); });
    }, 60);
    return function () {
      return { title: 'SCAN A QR CODE', html: '<p>Point the camera at your friend\u2019s battle-code QR (Battle \u25b8 My battle code).</p><video id="qrVideo" class="qr-video" playsinline muted aria-label="Camera"></video>',
        items: [{ label: 'Type the code instead', act: function () { stop(); K().pop(); } }, { label: 'Cancel', act: function () { stop(); K().pop(); } }] };
    };
  }
  function scanItem() {
    var ok = canScan();
    return { label: 'Scan a QR code', sub: ok ? 'Use the camera' : 'Not in this browser: paste or type the code below', disabled: !ok, reason: 'This browser has no QR scanner - paste or type the code', act: function () { K().push(scanScreen()); } };
  }

  PP.LobbyUI = { enabled: enabled, week: week, seat: seat, lobbyScreen: lobbyScreen, settingsItem: settingsItem, parentGate: parentGate, qrHtml: qrHtml, showBig: showBig, canScan: canScan, scanItem: scanItem };
})(typeof window !== 'undefined' ? window : globalThis);
