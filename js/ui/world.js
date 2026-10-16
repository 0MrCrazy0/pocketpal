/* PocketPal 2.4.0 - menu screens for the wider world: Trips, Things (hats, toys, garden), Family (generations +
 * retiring), the Memory book, Gifts & visits. The rules live in js/core/world.js (PP.World); the pictures in
 * js/ui/worldart.js. Uses the menu kit from js/ui/menus.js (PP.UI.kit). */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var D = PP.DATA, G = PP.Game, W = PP.World;
  function K() { return PP.UI.kit; }
  function st() { return PP.App.state; }
  function pet() { return G.active(st()); }
  function App() { return PP.App; }
  function esc(s) { return K().esc(s); }
  function toast(m) { App().toast(m); }
  function now() { return G.now(st()); }
  function thingIcon(id, dim) { return '<img class="thing-ic' + (dim ? ' sil' : '') + '" alt="" src="' + PP.WorldArt.thumbUrl(id, 3) + '">'; }
  function where(id) {
    var t = W.thing(id);
    if (t.src === 'shop') return 'Pal Store, ' + t.price + 'c';
    if (t.src === 'trip') return (t.rare ? 'Rare find on a trip to the ' : 'Find it on a trip to the ') + W.PLACES[t.place].name;
    if (t.src === 'event') return W.EVENTS[t.event].name + ' event (limited)';
    return 'Passed on by a retiring pal';
  }

  /* ---------------------------------------------------------------- trips */
  function tripsScreen() {
    var s = st(), p = pet(), t = now(), T = s.trips, n = !PP.util.newDay(T.day, PP.Shop.dayOf(t)) ? T.n : 0, wait = W.nextTripIn(s, t);
    var items = Object.keys(W.PLACES).map(function (k) {
      var P = W.PLACES[k], why = W.canTrip(s, p, k, t);
      var finds = Object.keys(W.THINGS).filter(function (id) { return W.THINGS[id].src === 'trip' && W.THINGS[id].place === k; });
      var got = finds.filter(function (id) { return W.owns(s, id); }).length;
      return { icon: thingIcon(finds[0], !W.owns(s, finds[0])), label: P.name, sub: P.blurb + ' Found ' + got + '/' + finds.length + '.', right: P.energy + 'E',
        disabled: !!why, reason: why, act: function () { go(k); } };
    });
    items.push({ label: 'Back', act: K().pop });
    return { title: 'TRIPS', live: true, html: '<p class="tip">A day out with ' + esc(p ? p.name : 'your pal') + '! A trip uses energy, then your pal rests for ' + (W.TRIP.coolMin / 60) +
      ' hours. Up to ' + W.TRIP.perDay + ' trips a day. You may find things to keep, meet a wild pal (it goes in the Paldex) and earn a few coins.</p>' +
      '<p>Trips today: <b>' + n + '/' + W.TRIP.perDay + '</b>' + (wait > 0 ? ' \u00b7 next trip in <b>' + K().hm(wait / 60000) + '</b>' : '') + '</p>', items: items };
  }
  function go(k) {
    var s = st(), r = W.goTrip(s, k, now());
    if (!r.ok) { PP.Audio.play('no'); toast(r.msg); return; }
    var p = pet();
    App().save(); App().refreshIcons();
    PP.UI.close();
    App().playScene({ kind: 'trip', where: k, species: p.species, key: PP.Sprites.stageKeyOf(p), hat: W.shown(s, p).hat, found: r.found, met: r.met, coins: r.coins },
      function () { PP.Audio.play(r.found ? 'level' : 'happy'); PP.UI.open(tripResult(r)); });
  }
  function tripResult(r) {
    return function () {
      var P = W.PLACES[r.where], h = '<ul class="goals">';
      h += '<li class="done"><span class="gk">\u2665</span>Happy +1</li><li><span class="gk">\u25cb</span>Energy \u2212' + r.energy + '</li>';
      h += '<li><span class="gk">\u25c9</span>' + (r.coins ? '+' + r.coins + ' coins' : 'No coins (today\u2019s coin cap is reached)') + '</li>';
      if (r.found) h += '<li class="done">' + thingIcon(r.found) + ' Found the <b>' + esc(W.THINGS[r.found].name) + '</b>! Put it on in Things.</li>';
      if (r.met) h += '<li class="done"><span class="gk">\u2605</span>Met a wild <b>' + esc(r.met.name) + '</b> (added to the Paldex as seen)</li>';
      h += '</ul>';
      var items = [];
      if (r.found) items.push({ label: 'Open Things', act: function () { PP.UI.replace(thingsScreen(Math.max(0, W.KINDS.indexOf(W.THINGS[r.found].kind)))); } });
      items.push({ label: 'OK', act: K().close });
      return { title: P.name.toUpperCase() + ' TRIP', html: h, items: items };
    };
  }

  /* ---------------------------------------------------------------- things */
  var TABS = [['hat', 'Hats'], ['toy', 'Toys'], ['deco', 'Garden']];
  function thingsScreen(tab) {
    tab = ((tab | 0) + TABS.length) % TABS.length;
    return function () {
      var s = st(), p = pet(), kind = TABS[tab][0], sh = W.shown(s, p);
      var ids = Object.keys(W.THINGS).filter(function (id) { return W.THINGS[id].kind === kind && (W.THINGS[id].src !== 'heir' || W.owns(s, id)); });
      var got = ids.filter(function (id) { return W.owns(s, id); }).length;
      var items = ids.map(function (id) {
        var T = W.THINGS[id], own = W.owns(s, id), on = kind === 'hat' ? !!(p && p.hat === id) : s.things[kind] === id;
        return { icon: thingIcon(id, !own), label: own ? T.name : T.name + ' (not yet)', sub: own ? (on ? (kind === 'hat' ? 'Wearing it - tap to take off' : 'Out - tap to put away') : (kind === 'hat' ? 'Tap to wear' : 'Tap to put out')) : where(id),
          right: on ? '\u2714' : '', disabled: !own, reason: own ? null : where(id),
          act: function () {
            var s2 = st(), p2 = pet();
            if (kind === 'hat' && !p2) { PP.Audio.play('no'); toast('No pal to wear it'); return; }
            var on2 = kind === 'hat' ? !!(p2 && p2.hat === id) : s2.things[kind] === id;
            var r = on2 ? W.unequip(s2, p2, kind) : W.equip(s2, p2, id);
            PP.Audio.play(r.ok ? 'ok' : 'no'); toast(r.msg); if (r.ok) App().save(); K().refresh();
          } };
      });
      items.push({ label: '\u25b6 ' + TABS[(tab + 1) % 3][1], act: function () { PP.UI.replace(thingsScreen(tab + 1)); } });
      items.push({ label: 'Get more things', sub: 'Shop' + (W.eventNow(s, now()) ? ' + ' + W.EVENTS[W.eventNow(s, now())].name + ' items' : ''), act: function () { K().push(thingShop); } });
      items.push({ label: 'Back', act: K().pop });
      var note = kind === 'hat' ? (p ? esc(p.name) + ' wears: <b>' + esc(sh.hat ? W.THINGS[sh.hat].name : 'nothing') + '</b>. Each pal keeps its own hat (it comes off for sleep).' : 'Hats are for pals.')
        : 'Shows in the garden on the home screen, for every pal: <b>' + esc(sh[kind] ? W.THINGS[sh[kind]].name : 'nothing') + '</b>.';
      return { title: 'THINGS \u00b7 ' + TABS[tab][1].toUpperCase() + ' ' + got + '/' + ids.length, html: '<p class="tip">' + note + '</p>', items: items };
    };
  }
  function thingShop() {
    var s = st(), t = now(), ev = W.eventNow(s, t), items = [];
    if (ev) {
      var g = W.eventGift(s, t);
      items.push({ icon: thingIcon(g.id), label: W.THINGS[g.id].name + ' (free gift)', sub: W.EVENTS[ev].name + ' gift - one per year', right: g.claimed ? '\u2714' : 'FREE', disabled: g.claimed, reason: 'Already collected',
        act: function () { var r = W.claimEventGift(s, now()); PP.Audio.play(r.ok ? 'level' : 'no'); toast(r.msg); if (r.ok) App().save(); K().refresh(); } });
      W.eventShop(s, t).forEach(function (row) {
        items.push({ icon: thingIcon(row.id), label: W.THINGS[row.id].name, sub: W.EVENTS[ev].name + ' only', right: row.owned ? '\u2714' : row.price + 'c', disabled: row.owned, reason: 'You have it',
          act: function () { var r = W.buyEventThing(s, row.id, now()); PP.Audio.play(r.ok ? 'level' : 'no'); toast(r.msg); if (r.ok) App().save(); K().refresh(); } });
      });
    }
    Object.keys(W.THINGS).filter(function (id) { return W.THINGS[id].src === 'shop'; }).forEach(function (id) {
      var T = W.THINGS[id], own = W.owns(s, id);
      items.push({ icon: thingIcon(id), label: T.name, sub: { hat: 'Hat', toy: 'Toy', deco: 'Garden' }[T.kind], right: own ? '\u2714' : T.price + 'c', disabled: own, reason: 'You have it',
        act: function () { var r = W.buyThing(s, id, now()); PP.Audio.play(r.ok ? 'level' : 'no'); toast(r.msg); if (r.ok) App().save(); K().refresh(); } });
    });
    items.push({ label: 'Back', act: K().pop });
    return { title: 'GET THINGS', html: '<p class="coins">\u25c9 <b>' + PP.Shop.coins(s) + '</b> coins</p>' + (ev ? '<p class="rare"><b>' + esc(W.EVENTS[ev].name) + '!</b> ' + esc(W.EVENTS[ev].text) + '</p>' : '<p class="tip">Seasonal items come at Halloween, Christmas and Easter. Trips find the rest.</p>'), items: items };
  }

  /* ---------------------------------------------------------------- family + memory book */
  var TRAIT = { gene: 'a strong gene', skill: 'an innate skill', ribbon: 'the Family Ribbon' };
  function keyOf(e) { return e.stage === 'adult' ? 'adult_' + (e.form || 'good') : e.stage === 'egg' ? 'egg' : e.stage; }
  function familyScreen() {
    var s = st(), p = pet(), line = p ? W.familyLine(s, p, 8) : [];
    var h = '<div class="dex-sum"><span>This pal: gen <b>' + (p ? p.gen || 1 : 1) + '</b></span><span>Best gen <b>' + W.topGen(s) + '</b></span><span>Retired <b>' + (s.line.retired || 0) + '</b></span></div>';
    if (line.length) h += '<ol class="family-line">' + line.map(function (e) {
      return '<li>' + K().thumb(e.species, keyOf(e), 'idle', 14) + '<span><b>' + esc(e.name) + '</b> \u00b7 gen ' + e.gen + (e.fate === 'retired' ? ' \u00b7 retired' : e.fate ? ' \u00b7 ' + esc(e.fate) : '') +
        (e.trait ? '<br><small>passed on ' + TRAIT[e.trait] + '</small>' : '') + '</span></li>';
    }).join('') + '</ol>';
    else h += '<p class="tip">No pal yet.</p>';
    var items = [];
    if (p && !p.fate) {
      var why = W.canRetire(p);
      items.push({ label: 'Retire ' + p.name + '\u2026', sub: why || (W.isElder(p) ? 'An Elder - ready when you are' : 'Adult for ' + W.adultDays(p) + ' days'), disabled: !!why, reason: why, act: function () { K().push(retireScreen); } });
      items.push({ label: 'Memory book: ' + p.name, sub: (p.mem || []).length + ' memories', act: function () { K().push(memScreen(p.id)); } });
    }
    if (line.length > 1) items.push({ label: 'Family memory book', sub: line.length + ' generations', act: function () { K().push(familyBook); } });
    items.push({ label: 'Back', act: K().pop });
    return { title: 'FAMILY', html: h, items: items, detail: function () { return 'An adult can retire after ' + W.RETIRE.minDays + ' days (an Elder after ' + W.RETIRE.elderDays + '). It rests in the Album and leaves an heir egg with one family trait. Never forced.'; } };
  }
  function retireScreen() {
    var s = st(), p = pet(); if (!p || W.canRetire(p)) return null;
    var items = W.traitOptions(p).map(function (o) {
      return { label: o.label, sub: o.sub, disabled: !!o.disabled, reason: o.sub, act: function () {
        K().push(K().confirm('RETIRE ' + p.name.toUpperCase() + '?', p.name + ' will rest in the Album (with its memory book) and an heir egg, generation ' + ((p.gen || 1) + 1) + ', takes its place. ' +
          'The egg gets: ' + o.label + '.' + (p.hard ? ' The heir keeps hard mode.' : '') + ' This cannot be undone.', function () {
          var r = W.retire(s, s.slots.indexOf(p), o.k, now());
          PP.Audio.play(r.ok ? 'level' : 'no'); toast(r.msg);
          if (r.ok) { App().resetWalker(); App().save(); App().refreshIcons(); K().close(); } else K().pop();
        }));
      } };
    });
    items.push({ label: 'Not now', act: K().pop });
    return { title: 'PASS ON ONE TRAIT', html: '<p class="tip">Thank you, ' + esc(p.name) + '! Pick ONE thing for the heir egg:</p>', items: items };
  }
  var MEM_ICON = { hatch: '\u25ef', grow: '\u2191', adult: '\u2605', level: '\u2191', battle: '\u2694', cup: '\u2655', trip: '\u2302', find: '\u2726', gift: '\u2709', visit: '\u2665', egg: '\u25ef', retire: '\u263e', heir: '\u2740', event: '\u2744', note: '\u2022', revive: '\u2661', elder: '\u2605' };
  function memList(mem, max) {
    var list = (mem || []).slice().reverse().slice(0, max || 40);
    if (!list.length) return '<p class="tip">No memories yet - they fill in as you play: growing up, battles, trips, gifts and more.</p>';
    return '<ul class="mem">' + list.map(function (m) { return '<li><span class="mk" aria-hidden="true">' + (MEM_ICON[m.k] || '\u2022') + '</span>' + esc(m.t) + ' <small>' + esc(K().tDate(m.at)) + '</small></li>'; }).join('') + '</ul>';
  }
  /* by id: a pal in the box, or an album entry (a retired / lost pal keeps its book) */
  function memScreen(id) {
    return function () {
      var s = st(), p = s.slots.filter(function (q) { return q && q.id === id; })[0] || G.albumFind(s, id);
      if (!p) return null;
      return { title: 'MEMORIES \u00b7 ' + String(p.name).toUpperCase(), html: memList(p.mem), items: [{ label: 'Back', act: K().pop }] };
    };
  }
  function familyBook() {
    var s = st(), p = pet(), line = p ? W.familyLine(s, p, 8) : [];
    var h = line.map(function (e) { return '<h3 class="fam-h">' + esc(e.name) + ' \u00b7 gen ' + e.gen + '</h3>' + memList(e.mem, 6); }).join('');
    return { title: 'FAMILY MEMORIES', html: h, items: [{ label: 'Back', act: K().pop }] };
  }

  /* ---------------------------------------------------------------- gifts + visits */
  function online() { var c = PP.CONFIG || {}; return !!c.relayUrl && /^https:\/\//.test(c.relayUrl) && typeof fetch === 'function'; }
  function api(path, body) {
    return fetch(PP.CONFIG.relayUrl + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        if (r.status === 404) throw new Error('the online server needs its 2.4.0 update (DEPLOY.md)');   // an older worker has no gift mailbox yet
        return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status)); return j; });
      });
  }
  function hex(n) { var a = new Uint8Array(n); (root.crypto || root.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  /* the mailbox id is the first 16 hex of SHA-256('mb:' + key) (the worker computes the same) */
  function boxId(key) { return PP.Admin.sha256('mb:' + key).slice(0, 16); }
  function setupBox() {
    var M = W.mail(st()); if (M.box) return;
    try { M.key = hex(16); M.box = boxId(M.key); } catch (e) { toast('This browser cannot make a mailbox'); return; }
    App().save(); toast('Mailbox ready! Share your battle code again so friends can send gifts.'); K().refresh();
  }
  var busy = false, sending = false;   // a mailbox check / a gift on its way
  function checkBox(quiet) {
    var s = st(), M = W.mail(s);
    if (!M.key || !online() || busy) return;
    var key = M.key;
    busy = true; M.checkAt = Date.now();
    api('/gift/inbox', { key: key }).then(function (j) {
      busy = false;
      s = st(); if (W.mail(s).key !== key) return;   // the save was replaced meanwhile (reset / another save imported)
      var got = W.receive(s, j.gifts, now());
      App().save();
      if (got.length) { PP.Audio.play('level'); toast(got.map(function (g) { return g.who + ' sent a ' + g.name + (g.used ? '!' : ' (note)'); }).join(' \u00b7 ')); }
      else if (!quiet) toast('No new gifts');
      K().refresh();
    }).catch(function (e) { busy = false; if (!quiet) toast('Gifts: ' + e.message); });
  }
  function giftsScreen() {
    var s = st(), M = W.mail(s), on = online(), items = [];
    var h = on ? (M.box ? '<p class="tip">Your mailbox is ready. Friends who add your battle code from now on can send you gifts.</p>' : '<p class="tip">Set up a mailbox so friends can send you gifts. Then share your battle code again.</p>')
      : '<p class="tip">Sending gifts needs the game\u2019s online server (see DEPLOY.md). Visits work anywhere.</p>';
    if (on && !M.box) items.push({ label: 'Set up my mailbox', act: setupBox });
    if (on && M.box) items.push({ label: 'Check for gifts', sub: 'Up to ' + W.GIFT.usePerDay + ' gifts a day are used; the rest are kept as notes', act: function () { checkBox(false); } });
    s.friends.forEach(function (f, i) {
      items.push({ icon: K().thumb(f.species, 'adult_' + f.form, 'idle', 15), label: f.name, sub: f.mb ? 'Visit or send a gift' : 'Visit (gifts need their new battle code)', act: function () { K().push(friendWorld(i)); } });
    });
    if (!s.friends.length) h += '<p class="tip">No friends yet: add a friend\u2019s battle code in Battle \u25b8 Friends.</p>';
    var log = M.log.slice(-5).reverse();
    if (log.length) h += '<ul class="mem">' + log.map(function (e) { return '<li><span class="mk">\u2709</span>' + (e.dir === 'in' ? esc(e.who) + ' sent a ' + esc(W.GIFTS[e.g].name) + (e.used ? '' : ' (note)') : 'You sent ' + esc(e.who) + ' a ' + esc(W.GIFTS[e.g].name)) + '</li>'; }).join('') + '</ul>';
    items.push({ label: 'Back', act: K().pop });
    return { title: 'GIFTS & VISITS', html: h, items: items };
  }
  function friendWorld(i) {
    return function () {
      var s = st(), f = s.friends[i], p = pet(); if (!f) return null;
      var why = W.canVisit(s, p, f), items = [{ label: 'Visit ' + f.name, sub: 'Your pals play in the garden', disabled: !!why, reason: why, act: function () { visit(f); } }];
      Object.keys(W.GIFTS).forEach(function (g) {
        var G9 = W.GIFTS[g], no = !online() ? 'Needs the online server' : W.canSend(s, g, f, now());
        items.push({ label: 'Send a ' + G9.name, sub: G9.desc + (G9.item ? ' \u00b7 you have ' + PP.Shop.count(s, G9.item) : ''), disabled: !!no, reason: no, act: function () { send(f, g); } });
      });
      items.push({ label: 'Back', act: K().pop });
      return { title: f.name.toUpperCase(), html: '<p>' + esc(D.NAMES[f.species][f.form]) + ' Lv' + f.level + '</p>', items: items };
    };
  }
  function send(f, g) {
    var s = st(), p = pet(), why = W.canSend(s, g, f, now());
    if (why || sending) { toast(why || 'One moment...'); return; }
    sending = true;
    api('/gift', { to: f.mb, g: g, n: p && p.name ? p.name : 'Friend', s: Math.max(0, D.SPECIES.indexOf(p ? p.species : 'lion')) }).then(function () {
      sending = false; W.noteSent(s, g, f, now()); App().save(); PP.Audio.play('happy'); toast('Sent a ' + W.GIFTS[g].name + ' to ' + f.name + '!'); K().refresh();
    }).catch(function (e) { sending = false; PP.Audio.play('no'); toast('Gift not sent: ' + e.message); });
  }
  function visit(f) {
    var s = st(), r = W.visit(s, f, now());
    if (!r.ok) { toast(r.msg); return; }
    var p = pet();
    App().save(); PP.UI.close();
    App().playScene({ kind: 'visit', species: p.species, key: PP.Sprites.stageKeyOf(p), hat: W.shown(s, p).hat, fSpecies: f.species, fKey: 'adult_' + f.form, fName: f.name },
      function () { PP.Audio.play('happy'); toast(r.msg); });
  }

  /* ---------------------------------------------------------------- once a second (main loop) */
  var CHECK_MS = 30 * 60e3;
  function tick() {
    var A = App(); if (!A || !A.state || A.passive || A.cut || A.scene !== 'home') return;
    var s = A.state, t = now(), ev = W.eventNow(s, t), day = PP.Shop.dayOf(t), p = pet();
    if (ev && p && !p.fate && s.events.hello !== day) {
      s.events.hello = day;
      var g = W.eventGift(s, t);
      toast('Happy ' + W.EVENTS[ev].name + '! ' + (g && !g.claimed ? 'A free ' + W.THINGS[g.id].name + ' is waiting (MENU \u25b8 Things \u25b8 Get more things).' : 'Seasonal items are in Things.'));
    }
    var M = s.mail;
    if (M && M.key && online() && !(root.document && root.document.hidden) && Math.abs(Date.now() - (M.checkAt || 0)) > CHECK_MS) checkBox(true);   // abs: a clock that was ahead never stops the checks
  }

  PP.WorldUI = { tripsScreen: tripsScreen, tripResult: tripResult, thingsScreen: thingsScreen, thingShop: thingShop, familyScreen: familyScreen, retireScreen: retireScreen,
    memScreen: memScreen, familyBook: familyBook, giftsScreen: giftsScreen, friendWorld: friendWorld, tick: tick, boxId: boxId, checkBox: checkBox, setupBox: setupBox };
})(typeof window !== 'undefined' ? window : globalThis);
