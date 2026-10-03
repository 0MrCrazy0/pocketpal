/* PocketPal - LCD menu overlays. A tiny screen stack: each screen is a function
 * returning { title, html, items, back }. Items are tappable buttons; A/B/C also work:
 * A = next item, B = choose, C = back. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var D = PP.DATA, S = PP.Sprites, G = PP.Game;
  var el = null, stack = [], cursor = 0, cur = null;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function App() { return PP.App; }
  function st() { return PP.App.state; }
  function pet() { return G.active(st()); }
  /* n = size in LCD pixels (scales with the screen). cls: 'sil' (silhouette) | 'dim' */
  function thumb(species, stageKey, pose, n, cls) { return '<span class="thumb' + (cls ? ' ' + cls : '') + '" style="' + S.cssU(species, stageKey, pose || 'idle', 0, n || 20) + '"></span>'; }
  function hearts(n) { var s = ''; for (var i = 0; i < 4; i++) s += i < n ? '\u2665' : '\u2661'; return '<span class="hearts">' + s + '</span>'; }
  function bar(v, max, label) { var pct = Math.max(0, Math.min(100, Math.round(v / max * 100))); return '<span class="bar" role="img" aria-label="' + esc(label || '') + ' ' + pct + '%"><i style="width:' + pct + '%"></i></span>'; }
  function hm(min) { min = Math.max(0, Math.round(min)); var h = Math.floor(min / 60), m = min % 60; return h >= 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h + 'h ' + m + 'm'; }
  function clockMode() { return (st() && st().settings.clock) || '12'; }
  function tHM(minOfDay) { return PP.Time.hm(minOfDay, clockMode()); }
  function tDate(ms) { return PP.Time.dateTime(ms, clockMode(), Date.now()); }
  function schedText(s) { return tHM(s.bed) + ' \u2013 ' + tHM(s.wake); }
  var DEX_ADULTS = D.SPECIES.length * D.FORMS.length, DEX_ALL = D.SPECIES.length * PP.Collection.KEYS.length;   // 24 / 42 (1.9.7)
  var FORM_LABEL = { bad: 'Scrappy', good: 'Solid', perfect: 'Champion', secret: 'Secret' };

  /* ------------------------------------------------------------ framework */
  function init() { el = document.getElementById('overlay'); }
  function isOpen() { return stack.length > 0; }
  function open(screen) { stack = [screen]; cursor = 0; render(); }
  function push(screen, start) { if (stack.length) stack[stack.length - 1].cursor = cursor; stack.push(screen); cursor = start || 0; render(); }
  function replace(screen) { stack[stack.length - 1] = screen; cursor = 0; render(); }
  function pop() {
    stack.pop();
    if (!stack.length) return close();
    cursor = stack[stack.length - 1].cursor || 0; render();
  }
  function close() {
    stack = []; cur = null; clearHighlight();
    if (el) { el.hidden = true; el.innerHTML = ''; }
    if (PP.Shells && PP.App && PP.App.state) PP.Shells.apply(st().settings.shell);   // end any shell preview
    if (App()) App().onMenuClosed();
  }
  function clearHighlight() { Array.prototype.forEach.call(document.querySelectorAll('.hl'), function (x) { x.classList.remove('hl'); }); }
  function refresh() { if (stack.length) render(true); }

  /* Layout: title / ONE scrolling area (text + list) / optional detail line / key hint.
   * Short button rows (<= 3 plain items after some text) are pinned under the scroll
   * area so "Next / Back" can never scroll out of sight. A bobbing "more" arrow shows
   * whenever there is more to scroll to. */
  function itemHtml(it, i) {
    return '<button type="button" class="mi' + (i === cursor ? ' sel' : '') + (it.disabled ? ' off' : '') + (it.cls ? ' ' + it.cls : '') + '" data-i="' + i + '"' +
      (it.disabled ? ' aria-disabled="true"' : '') + '>' + (it.icon || '') + '<span class="lbl">' + (it.labelHtml || esc(it.label)) +
      (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span>' + (it.right ? '<span class="r">' + esc(it.right) + '</span>' : '') + '</button>';
  }
  function render(keepScroll) {
    var screen = stack[stack.length - 1];
    var oldMain = el && el.querySelector('.ov-main'), oldTop = keepScroll && oldMain ? oldMain.scrollTop : 0;
    cur = screen();
    if (!cur) return close();
    clearHighlight();
    var items = cur.items || [];
    if (cursor >= items.length) cursor = Math.max(0, items.length - 1);
    var h = '<div class="ov-head"><h2 id="ovTitle">' + esc(cur.title) + '</h2></div><div class="ov-main">';
    if (cur.html) h += '<div class="ov-body">' + cur.html + '</div>';
    var compact = !!cur.html && items.length && items.length <= 3 && !cur.tiers && !items.some(function (it) { return it.sub || it.icon || it.cell; });
    var list = '<div class="ov-items' + (cur.grid ? ' grid' : '') + (compact ? ' compact' : '') + '">';
    var lastTier = null, inCells = false;
    items.forEach(function (it, i) {
      if (cur.tiers && it.tier !== lastTier) {
        if (lastTier !== null) list += '</div>';
        list += it.tier ? '<div class="sk-row"><span class="sk-t">' + esc(cur.tiers[it.tier]) + '</span>' : '<div class="sk-row end">';
        lastTier = it.tier;
      }
      if (it.cell && !inCells) { list += '<div class="dex-grid">'; inCells = true; }
      if (!it.cell && inCells) { list += '</div>'; inCells = false; }
      list += itemHtml(it, i);
    });
    if (inCells) list += '</div>';
    if (cur.tiers && lastTier !== null) list += '</div>';
    list += '</div>';
    if (!compact) h += list;
    h += '</div>' + (compact ? list : '') + (cur.detail ? '<div class="ov-detail" aria-live="polite">' + cur.detail(cursor) + '</div>' : '') +
      '<div class="ov-hint"><span class="ov-hint-t">' + esc(cur.hint || 'A next \u00b7 B choose \u00b7 C back') + '</span><span class="ov-more" hidden>\u25bc more</span></div>';
    el.innerHTML = h; el.hidden = false;
    Array.prototype.forEach.call(el.querySelectorAll('.mi'), function (b) {
      b.addEventListener('click', function (ev) { ev.stopPropagation(); PP.Audio.unlock(); cursor = +b.dataset.i; pick(); });
    });
    var main = el.querySelector('.ov-main');
    main.addEventListener('scroll', updateMore);
    if (oldTop) main.scrollTop = oldTop;
    if (cur.onRender) cur.onRender(el);
    if (cur.highlight) cur.highlight.forEach(function (q) { Array.prototype.forEach.call(document.querySelectorAll(q), function (x) { x.classList.add('hl'); }); });
    var sel = el.querySelector('.mi.sel');
    if (sel && cursor > 0 && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
    updateMore();
  }
  function updateMore() {
    if (!el) return;
    var main = el.querySelector('.ov-main'), more = el.querySelector('.ov-more');
    if (!main || !more) return;
    more.hidden = !(main.scrollHeight - main.scrollTop - main.clientHeight > 2);
  }
  function pick() {
    var it = (cur.items || [])[cursor];
    if (!it) return;
    if (it.disabled && /tired/i.test(it.reason || '') && pet()) { App().refuseTired(); return; }   // 1.8.3: no menu - the pal shakes its head and yawns
    if (it.disabled) { PP.Audio.play('no'); App().toast(it.reason || 'Not now'); return; }
    PP.Audio.play('ok');
    it.act();
  }
  function input(btn) {
    if (!cur) return;
    var n = (cur.items || []).length;
    var focused = document.activeElement;
    if (btn === 'A' || btn === 'PREV') {
      if (!n) return;
      cursor = (cursor + (btn === 'A' ? 1 : -1) + n) % n; PP.Audio.play('move');
      Array.prototype.forEach.call(el.querySelectorAll('.mi'), function (b, i) { b.classList.toggle('sel', i === cursor); if (i === cursor && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' }); });
      var det = el.querySelector('.ov-detail'); if (det && cur.detail) det.innerHTML = cur.detail(cursor);
      if (cur.onCursor) cur.onCursor(cursor);
      updateMore();
    } else if (btn === 'B') pick();
    else if (btn === 'C') { PP.Audio.play('back'); if (cur.back) cur.back(); else pop(); }
    if (focused && focused.blur && focused.tagName === 'BUTTON') focused.blur();
  }

  /* ------------------------------------------------------------ screens */
  function mainMenu() {
    var c = PP.Collection.counts(st());
    return { title: 'MENU', items: [
      { label: 'Status', sub: 'Needs, stats, care report', act: function () { push(statusScreen(0)); } },
      dailyItem(),
      { label: 'Skills', sub: 'Skill tree (adults)', act: function () { push(skillsScreen); } },
      { label: 'Paldex', sub: c.adults + '/' + DEX_ADULTS + ' adult forms \u00b7 ' + c.total + '/' + DEX_ALL + ' in all', right: c.adults + '/' + DEX_ADULTS, act: function () { push(paldexScreen(0)); } },
      { label: 'Shell colour', sub: 'Repaint your handheld', act: openShells },
      { label: 'Pal Store', sub: 'Treats, boosts, colours, extra slots', right: PP.Shop.coins(st()) + 'c', act: function () { push(storeScreen); } },
      { label: 'Bag', sub: 'Items you bought', right: String(PP.Shop.owned(st()).reduce(function (n, id) { return n + PP.Shop.count(st(), id); }, 0)), act: function () { push(bagScreen); } },
      { label: 'Pal Box', sub: 'Your ' + st().slots.length + ' slots, new egg', act: function () { push(palBox); } },
      { label: 'Breeding', sub: 'Make an egg with a mate', act: function () { push(breedScreen); } },
      { label: 'Album', sub: 'Every pal you raised + family trees', act: function () { push(albumScreen); } },
      { label: 'Settings', sub: 'Sound, alerts, save transfer', act: function () { push(settingsScreen); } },
      { label: 'Guide', sub: 'Buttons, icons and the goal', act: function () { push(guideScreen(0)); } },
      { label: 'How to play', sub: 'All the rules on one page', act: function () { push(helpScreen); } },
      { label: 'Screen icons', sub: 'What every status-strip icon means', act: function () { push(iconsScreen); } },
      { label: 'About', sub: 'Version ' + D.VERSION + ', privacy', act: function () { push(aboutScreen); } }
    ] };
  }

  /* ------------------------------------------------------------ 1.9.0 daily goals */
  function dailyItem() {
    var d = PP.Daily.today(st(), G.now(st())), n = d ? d.goals.filter(function (g) { return g.done; }).length : 0;
    return { label: 'Daily goals', sub: d ? n + '/3 done' + (d.streak > 1 ? ' \u00b7 ' + d.streak + '-day streak' : '') + (d.event ? ' \u00b7 ' + PP.Daily.EVENTS[d.event].name : '') : 'Start once your egg hatches',
      right: d ? n + '/3' : '', act: function () { push(dailyScreen); } };
  }
  function dailyScreen() {
    var s = st(), t = G.now(s), d = PP.Daily.today(s, t), D9 = PP.Daily;
    var h = '';
    if (!d) h = '<p class="tip">Daily goals start when your pal has hatched. Check back soon!</p>';
    else {
      h += '<ul class="goals">' + d.goals.map(function (g) {
        return '<li class="' + (g.done ? 'done' : '') + '"><span class="gk" aria-hidden="true">' + (g.done ? '\u2714' : '\u25cb') + '</span>' + esc(D9.text(g)) +
          (g.need > 1 ? ' <small>' + g.n + '/' + g.need + '</small>' : '') + '<span class="r">+' + D9.GOAL_COINS + 'c</span></li>';
      }).join('') + '</ul>';
      var nb = D9.ALL_BONUS + 2 * Math.min((d.lastAll === d.day - 1 ? d.streak : 0), 5) + (pet() && pet().hard ? D9.HARD_BONUS : 0);
      h += '<p class="tip">' + (d.allPaid ? 'All done today! Streak: <b>' + d.streak + '</b> day' + (d.streak === 1 ? '' : 's') + '.' : 'Finish all three for <b>+' + nb + 'c</b>' + (d.streak ? ' (streak ' + d.streak + ')' : '') + '.') + ' New goals tomorrow.</p>';
      if (d.event) h += '<p class="rare"><b>' + esc(D9.EVENTS[d.event].name) + '</b> ' + esc(D9.EVENTS[d.event].text) + (d.event === 'visitor' && d.eventUsed ? ' (done)' : '') + '</p>';
    }
    var cur = D9.seasonsAt(t);
    h += '<p class="tip">Seasonal shells: ' + D9.SEASONS.map(function (se) {
      var have = PP.Collection.shellStatus(s, se.id).ok;
      return '<b>' + esc(se.name) + '</b> ' + (have ? '\u2714' : Math.min(D9.SEASON_DAYS, D9.seasonDays(s, se.id)) + '/' + D9.SEASON_DAYS + (cur.indexOf(se.id) >= 0 ? ' (now!)' : ' (' + esc(se.window) + ')'));
    }).join(' \u00b7 ') + '. Finish all 3 goals on ' + D9.SEASON_DAYS + ' days in the season.</p>';
    var items = [];
    if (d && D9.visitorReady(s, t)) items.push({ label: 'Battle the visitor', sub: 'One try today \u00b7 win for +' + D9.VISITOR_BONUS + ' coins', disabled: !!G.canBattle(pet()), reason: G.canBattle(pet()), act: function () { close(); App().startVisitor(); } });
    items.push({ label: 'Back', act: pop });
    return { title: 'DAILY GOALS', html: h, items: items, live: true };
  }

  /* ------------------------------------------------------------ Paldex */
  var DEX_TAG = { baby: 'Baby', child: 'Child', teen: 'Teen', bad: 'Scrappy', good: 'Solid', perfect: 'Champion', secret: 'Secret' };
  function nextDexReward(s) {
    var c = PP.Collection.counts(s), best = null;
    D.SHELLS.forEach(function (sh) { if (sh.unlock && sh.unlock.dex && c.adults < sh.unlock.dex && (!best || sh.unlock.dex < best.unlock.dex)) best = sh; });
    return best ? 'Next reward: ' + best.name + ' shell at ' + best.unlock.dex + ' adult forms' : 'All Paldex shell rewards earned!';
  }
  function paldexScreen(si) {
    return function () {
      var s = st(), sp = D.SPECIES[(si + D.SPECIES.length) % D.SPECIES.length], c = PP.Collection.counts(s);
      var keys = PP.Collection.KEYS;
      var items = keys.map(function (k) {
        var e = PP.Collection.get(s, sp, k) || {}, raised = !!e.r, seen = !!e.s;
        var skey = D.FORMS.indexOf(k) >= 0 ? 'adult_' + k : k;
        return { cell: true, cls: 'dex', icon: thumb(sp, skey, 'idle', 17, raised ? '' : seen ? 'dim' : k === 'secret' ? 'sil secret' : 'sil'),
          label: raised || seen ? D.NAMES[sp][k] : '???', sub: raised ? DEX_TAG[k] : seen ? 'seen' : DEX_TAG[k],
          act: function () { push(dexEntry(sp, k)); } };
      });
      items.push({ label: '\u25b6 Next animal', act: function () { replace(paldexScreen(si + 1)); } });
      items.push({ label: '\u25c0 Previous animal', act: function () { replace(paldexScreen(si - 1)); } });
      items.push({ label: 'Back', act: pop });
      return { title: 'PALDEX \u00b7 ' + D.SPECIES_INFO[sp].label.toUpperCase() + ' ' + c.perSpecies[sp] + '/' + keys.length,
        html: '<div class="dex-sum"><span>Adults <b>' + c.adults + '/' + D.SPECIES.length * D.FORMS.length + '</b></span><span>All <b>' + c.total + '/' + D.SPECIES.length * keys.length + '</b></span></div><p class="tip">' + esc(nextDexReward(s)) + '</p>',
        items: items, detail: function (i) {
          var k = keys[i]; if (!k) return i === keys.length ? 'Show the next animal' : i === keys.length + 1 ? 'Show the previous animal' : 'Back to the menu';
          var e = PP.Collection.get(s, sp, k) || {};
          return '<b>' + esc(e.r || e.s ? D.NAMES[sp][k] : '???') + '</b> \u00b7 ' + DEX_TAG[k] + (e.r ? ' \u00b7 <i>raised</i>' : e.s ? ' \u00b7 <i>seen in battle</i>' : '') + '<br>' + esc(PP.Collection.hint(sp, k));
        } };
    };
  }
  function dexMemorial(sp, k) {
    var lost = st().album.filter(function (e) { return e.hard && (e.fate === 'dead' || e.fate === 'gone') && e.species === sp && (e.stage === 'adult' ? e.form : e.stage) === k; });
    return lost.length ? '<p class="memorial-note">\u2020 In memory: ' + lost.slice(-3).map(function (e) { return esc(e.name); }).join(', ') + ' (hard mode)</p>' : '';
  }
  function dexEntry(sp, k) {
    return function () {
      var e = PP.Collection.get(st(), sp, k) || {}, known = e.r || e.s;
      var skey = D.FORMS.indexOf(k) >= 0 ? 'adult_' + k : k;
      return { title: known ? D.NAMES[sp][k].toUpperCase() : '???', html: '<div class="vs">' + thumb(sp, skey, known ? 'happy' : 'idle', 40, e.r ? '' : e.s ? 'dim' : k === 'secret' ? 'sil secret' : 'sil') + '</div>' +
        '<p><b>' + esc(D.SPECIES_INFO[sp].label) + ' \u00b7 ' + DEX_TAG[k] + '</b>' + (e.r ? ' \u00b7 raised ' + new Date(e.r).toLocaleDateString() : e.s ? ' \u00b7 seen, not raised yet' : ' \u00b7 not found yet') + '</p>' +
        '<p class="tip">How to get it: ' + esc(PP.Collection.hint(sp, k)) + '</p>' + dexMemorial(sp, k), items: [{ label: 'Back', act: pop }] };
    };
  }

  /* ------------------------------------------------------------ shell colours */
  function openShells() { push(shellScreen, Math.max(0, D.SHELLS.findIndex(function (sh) { return sh.id === st().settings.shell; }))); }
  function shellScreen() {
    var s = st();
    var items = D.SHELLS.map(function (sh) {
      var status = PP.Collection.shellStatus(s, sh.id), on = s.settings.shell === sh.id;
      return { icon: '<span class="swatch" style="' + PP.Shells.swatchStyle(sh) + '"></span>', label: sh.name + (sh.finish ? ' \u2605' : ''),
        sub: sh.unlock ? (status.ok ? 'Special finish - unlocked!' : 'LOCKED: ' + status.need + (status.goal > 1 ? ' (' + status.have + '/' + status.goal + ')' : ''))
          : sh.price ? (status.ok ? 'Bought in the Pal Store' : 'Pal Store colour - ' + sh.price + ' coins') : 'Free colour',
        right: on ? '\u2713' : status.ok ? '' : 'LOCK', cls: status.ok ? '' : 'lock',
        act: function () {
          if (!status.ok) { PP.Audio.play('no'); App().toast('Locked - ' + status.need); return; }
          s.settings.shell = sh.id; PP.Shells.apply(sh.id); App().save(); App().toast(sh.name + ' shell on!'); refresh();
        } };
    });
    items.push({ label: 'Back', act: function () { PP.Shells.apply(s.settings.shell); pop(); } });
    return { title: 'SHELL COLOUR', items: items,
      onRender: function () { PP.Shells.apply((D.SHELLS[cursor] || {}).id || s.settings.shell); },
      onCursor: function (i) { var sh = D.SHELLS[i]; PP.Shells.apply(sh ? sh.id : s.settings.shell); },
      back: function () { PP.Shells.apply(s.settings.shell); pop(); },
      detail: function (i) {
        var sh = D.SHELLS[i]; if (!sh) return 'Back (keeps ' + esc(PP.Collection.shell(s.settings.shell).name) + ')';
        var stt = PP.Collection.shellStatus(s, sh.id);
        return 'Preview: <b>' + esc(sh.name) + '</b>' + (stt.ok ? ' \u00b7 B to use it' : '<br><i>' + esc(stt.need) + '</i>');
      } };
  }


  /* ------------------------------------------------------------ 1.9.2 screen icons legend
   * Every icon in the home status strip, drawn with the SAME pixel glyphs as the LCD (PP.Render.MINI + the LCD font),
   * so the legend always matches the screen. Used by the guide, How to play, MENU > Screen icons and Status. */
  var STRIP_LEGEND = [
    { row: 1, parts: [['food'], ['hearts', 3]], name: 'Hunger', text: '4 hearts. Feed a meal when they run low. The picture is your pal\'s own food: meat (lion, wolf), fish (croc, eagle), honey (bear) or fruit (elephant).' },
    { row: 1, parts: [['smile'], ['hearts', 2]], name: 'Happiness', text: '4 hearts. Play a game or give a snack.' },
    { row: 1, parts: [['bolt'], ['pips', 3]], name: 'Energy', text: '4 pips, 25% each. They blink when your pal is tired.' },
    { row: 1, parts: [['text', 'TEEN 3D']], name: 'Stage + age', text: 'H = hours, D = days old.' },
    { row: 2, parts: [['flag'], ['bar', 60]], name: 'Discipline', text: 'The bar fills when you scold a tantrum or praise good behaviour.' },
    { row: 2, parts: [['dtext', 'WT'], ['text', 'OK']], name: 'Weight', text: 'WT + LO (underweight: feed meals), OK (fine) or HI (overweight: fewer snacks, more play).' },
    { row: 2, parts: [['sick']], name: 'Sick', text: 'The skull: give medicine.' },
    { row: 2, parts: [['poop'], ['text', '2']], name: 'Poop + count', text: 'Clean it up. It flashes at 2 or more.' },
    { row: 2, parts: [['attn']], name: 'Call (!)', text: 'Flashing: your pal needs you. Answer within 30 minutes.' },
    { row: 2, parts: [['text', 'ZZ']], name: 'Asleep', text: 'Turn the lights off.' },
    { row: 2, parts: [['moon']], name: 'Night', text: 'It is bedtime - your pal will fall asleep soon.' },
    { row: 2, parts: [['tired']], name: 'Tired (Zz)', text: 'Low energy: lights off for a nap, or feed it.' }
  ];
  var iconCache = {};
  function stripIcon(parts) {
    var key = JSON.stringify(parts);
    if (iconCache[key]) return iconCache[key];
    var R = PP.Render, M = R && R.MINI, Fo = PP.Font, ink = '#0f380f', dark = '#306230';
    if (!M || typeof document === 'undefined') return '';
    var w = 1;
    parts.forEach(function (q) { w += (q[0] === 'hearts' ? 23 : q[0] === 'pips' ? 19 : q[0] === 'bar' ? 24 : q[0] === 'text' || q[0] === 'dtext' ? Fo.width(q[1]) : M[q[0]][0].length) + 2; });
    // 1.9.8: drawn on a x5 canvas with the strip's own x5 glyphs (PP.Render.mini), exactly like the LCD
    var D = R.DPR || 5, cv = document.createElement('canvas'); cv.width = w * D; cv.height = 9 * D;
    var c = cv.getContext('2d'); c.setTransform(D, 0, 0, D, 0, 0); c.fillStyle = '#9bbc0f'; c.fillRect(0, 0, w, 9);
    function glyph(rows, x, y, col) {
      if (R.mini) return R.mini(c, rows, x, y, col);
      c.fillStyle = col; rows.forEach(function (r, ry) { for (var rx = 0; rx < r.length; rx++) if (r[rx] === '#') c.fillRect(x + rx, y + ry, 1, 1); });
    }
    var x = 1;
    parts.forEach(function (q) {
      var k = q[0];
      if (k === 'hearts') { for (var i = 0; i < 4; i++) glyph(i < q[1] ? M.heart : M.empty, x + i * 6, 2, i < q[1] ? ink : dark); x += 25; }
      else if (k === 'pips') { for (var j = 0; j < 4; j++) { c.fillStyle = j < q[1] ? ink : dark; if (j < q[1]) c.fillRect(x + j * 5, 2, 4, 5); else { c.fillRect(x + j * 5, 2, 4, 1); c.fillRect(x + j * 5, 6, 4, 1); c.fillRect(x + j * 5, 2, 1, 5); c.fillRect(x + j * 5 + 3, 2, 1, 5); } } x += 21; }
      else if (k === 'bar') { c.fillStyle = ink; c.fillRect(x, 2, 24, 1); c.fillRect(x, 6, 24, 1); c.fillRect(x, 2, 1, 5); c.fillRect(x + 23, 2, 1, 5); c.fillRect(x + 1, 3, Math.round(22 * q[1] / 100), 3); x += 26; }
      else if (k === 'text' || k === 'dtext') { Fo.draw(c, q[1], x, 1, k === 'dtext' ? dark : ink); x += Fo.width(q[1]) + 2; }
      else { glyph(M[k], x, 1 + (k === 'poop' ? 2 : 0), ink); x += M[k][0].length + 2; }
    });
    return (iconCache[key] = '<img class="sicon" alt="" src="' + cv.toDataURL() + '" style="width:calc(var(--u) * ' + (w * 1.5) + ');height:calc(var(--u) * 13.5)">');
  }
  /* 1.9.9: the active pal's food (D.DIET); meat when there is no pal yet. */
  function myFood() { var p = PP.App && PP.App.state && PP.Game.active(PP.App.state); return D.foodOf(p ? p.species : ''); }
  function legendHtml() {
    return [1, 2].map(function (row) {
      return '<p><b>Row ' + row + (row === 1 ? ' (always there)' : ' (discipline + weight, then only what applies right now)') + '</b></p><ul class="glist legend">' +
        STRIP_LEGEND.filter(function (e) { return e.row === row; }).map(function (e) { return '<li>' + stripIcon(e.parts[0][0] === 'food' ? [[myFood().glyph]].concat(e.parts.slice(1)) : e.parts) + '<span><b>' + esc(e.name) + ':</b> ' + esc(e.text) + '</span></li>'; }).join('') + '</ul>';
    }).join('');
  }
  function iconsScreen() {
    return { title: 'SCREEN ICONS', html: '<p>The two short rows under the clock on the home screen:</p>' + legendHtml(), items: [{ label: 'Back', act: pop }] };
  }

  /* ------------------------------------------------------------ first-run guide */
  var GUIDE = [
    { t: 'WELCOME TO POCKETPAL', h: function () {
      return '<div class="guide-art">' + ['egg', 'baby', 'teen', 'adult_perfect'].map(function (k) { return thumb('lion', k, 'idle', 22); }).join('') + '</div>' +
        '<p>Hatch an egg and look after your pal. It grows from <b>egg \u2192 baby \u2192 child \u2192 teen \u2192 adult</b> in about 4 days of real time.</p>' +
        '<p><b>The goal:</b> how well you care decides which of <b>3 adult forms</b> it becomes. Then battle, learn skills and breed!</p>'; } },
    { t: 'THE THREE BUTTONS', hl: ['.btns'], h: function () {
      return '<ul class="glist"><li><span class="gbtn">A</span><span><b>A = next.</b> Moves to the next icon or menu item.</span></li>' +
        '<li><span class="gbtn b">B</span><span><b>B = choose.</b> Opens the icon or picks the item.</span></li>' +
        '<li><span class="gbtn c">C</span><span><b>C = back.</b> Closes menus. In battle: auto-fight.</span></li></ul>' +
        '<p class="tip">You can also tap icons and menu items. Keyboard: A S D, arrows, Enter, Esc.</p>'; } },
    { t: 'CARE ICONS 1/2', hl: ['.icons .icon:nth-child(1)', '.icons .icon:nth-child(2)', '.icons .icon:nth-child(3)', '.icons .icon:nth-child(4)'], h: function () {
      return '<ul class="glist"><li><span class="gicon" style="--i:0"></span><span><b>Status / menu:</b> hunger, happiness, care score, everything else.</span></li>' +
        '<li><span class="gicon" style="--i:' + myFood().icon + '"></span><span><b>Feed:</b> meals fill hunger, snacks add happiness (not too many!).</span></li>' +
        '<li><span class="gicon" style="--i:2"></span><span><b>Train &amp; play:</b> mini-games for happiness, discipline and XP.</span></li>' +
        '<li><span class="gicon" style="--i:3"></span><span><b>Clean:</b> flush the poop away.</span></li></ul>'; } },
    { t: 'CARE ICONS 2/2', hl: ['.icons .icon:nth-child(5)', '.icons .icon:nth-child(6)', '.icons .icon:nth-child(7)', '.icons .icon:nth-child(8)'], h: function () {
      return '<ul class="glist"><li><span class="gicon" style="--i:4"></span><span><b>Medicine:</b> when the skull shows, your pal is sick.</span></li>' +
        '<li><span class="gicon" style="--i:5"></span><span><b>Lights:</b> switch off when it falls asleep. Droopy eyes, yawning, blinking energy pips and <b>Zz</b> in the strip = tired: lights off for a quick <b>nap</b> (+1 energy every 2 min), or feed it.</span></li>' +
        '<li><span class="gicon" style="--i:6"></span><span><b>Battle:</b> arena and friend battles (adults).</span></li>' +
        '<li><span class="gicon" style="--i:7"></span><span><b>Discipline:</b> Scold a tantrum, or Praise after training / a refused meal.</span></li></ul>'; } },
    { t: 'SCREEN ICONS', h: function () { return legendHtml() + '<p class="tip">See them again any time: MENU \u25b8 Screen icons.</p>'; } },
    { t: 'WHEN YOUR PAL CALLS', h: function () {
      return '<p>A flashing <b>!</b> in the status strip means your pal needs you. A speech bubble shows <b>what</b> it wants, the matching icon glows, and it beeps (if sound is on).</p>' +
        '<p>Answer within <b>30 minutes</b>. An ignored call, overfeeding, poop left 2 h or lights left on count as <b>care mistakes</b>.</p>'; } },
    { t: 'GROWING UP', h: function () {
      return '<div class="guide-art">' + ['adult_bad', 'adult_good', 'adult_perfect'].map(function (k) { return thumb('wolf', k, 'idle', 26); }).join('') + '</div>' +
        '<p><b>Scrappy</b> (poor care) \u00b7 <b>Solid</b> (good care) \u00b7 <b>Champion</b> (max 2 mistakes, happy, disciplined, trained).</p>' +
        '<p class="tip">Status shows your care score and which form you are on track for.</p>'; } },
    { t: 'ADULT LIFE', hl: ['#menuBtn'], h: function () {
      return '<p><b>Battle</b> the 12-cup arena (3 foes a cup, then a post-game Myth Cup) or friends (battle codes). <b>Run</b> escapes a quick battle; in the arena or a friend battle it is a forfeit. Wins give XP and skill points for your animal\'s <b>skill tree</b>.</p>' +
        '<p><b>Breed</b> two adults of the same animal (male + female) for a new generation. Fill the <b>Paldex</b> and win cups to unlock special <b>shell colours</b>.</p>' +
        '<p class="tip">The MENU button (top right) opens everything.</p>'; } },
    { t: 'READY?', h: function () {
      return '<p>Time keeps running when the app is closed, but fairly: a night away or a day at work can never kill your pal.</p>' +
        '<p>Battles, training and a daily visit earn <b>coins</b> for treats, boosts, colours and extra Pal Box slots in the <b>Pal Store</b>. Basic care is always free.</p>' +
        '<p>You can open this guide again from <b>MENU \u25b8 Guide</b>. Have fun!</p>'; } }
  ];
  function guideScreen(page) {
    return function () {
      var g = GUIDE[page], last = page === GUIDE.length - 1;
      function finish() { st().settings.guideSeen = true; App().save(); close(); if (App().afterGuide) App().afterGuide(); }
      var items = [{ label: last ? 'Start playing!' : 'Next \u25b6', act: function () { if (last) finish(); else replace(guideScreen(page + 1)); } }];
      if (page > 0) items.push({ label: '\u25c0 Back', act: function () { replace(guideScreen(page - 1)); } });
      if (!last) items.push({ label: 'Skip', act: finish });
      return { title: g.t + ' (' + (page + 1) + '/' + GUIDE.length + ')', html: g.h(), items: items, highlight: g.hl, back: finish, hint: 'B next \u00b7 A move \u00b7 C skip' };
    };
  }

  function statusScreen(page) {
    return function () {
      var p = pet();
      if (!p) return { title: 'STATUS', html: '<p>No pal yet.</p>', items: [{ label: 'Back', act: pop }] };
      var pages = p.stage === 'adult' ? ['care', 'battle', 'genes'] : ['care', 'report', 'genes'];
      var pg = pages[page % pages.length], h = '';
      var top = '<div class="st-top">' + thumb(p.species, S.stageKeyOf(p), PP.Care.moodPose(p), 26) + '<div><b>' + esc(p.name) + '</b> ' + (p.sex === 'M' ? '\u2642' : '\u2640') +
        '<br>' + esc(PP.Pet.formName(p)) + ' \u00b7 ' + esc(p.stage === 'adult' ? FORM_LABEL[p.form] + ' adult' : p.stage) + '<br>Gen ' + p.gen + ' \u00b7 Age ' + PP.Pet.ageDays(p) + 'd</div></div>';
      if (pg === 'care') {
        var next = PP.Evolution.minutesToNextStage(p);
        h = top + '<table class="kv">' +
          '<tr><td>Hunger</td><td>' + hearts(p.hunger) + '</td></tr>' +
          '<tr><td>Happy</td><td>' + hearts(p.happy) + '</td></tr>' +
          '<tr><td>Energy</td><td>' + bar(p.energy, 100, 'Energy') + '</td></tr>' +
          '<tr><td>Discipline</td><td>' + bar(p.discipline, 100, 'Discipline') + ' ' + Math.round(p.discipline) + '%</td></tr>' +
          '<tr><td>Health</td><td>' + bar(p.health, 100, 'Health') + (p.sick ? ' SICK' : '') + '</td></tr>' +
          '<tr title="Status strip: WT + LO / OK / HI. All icons: MENU \u25b8 Screen icons"><td>Weight</td><td>' + p.weight + 'g' + (PP.Care.isOverweight(p) ? ' (heavy, strip: HI)' : PP.Care.isUnderweight(p) ? ' (skinny, strip: LO)' : ' (strip: OK)') + '</td></tr>' +
          (next != null && p.stage !== 'egg' ? '<tr><td>Grows in</td><td>' + hm(next) + '</td></tr>' : '') +
          (p.stage !== 'egg' ? '<tr><td>Sleeps</td><td>' + schedText(PP.Sleep.of(p)) + (p.sched ? '' : ' (default)') + '</td></tr>' : '') +
          '<tr><td>Status</td><td>' + (p.fate ? esc(p.fateCause || p.fate) : p.asleep ? (p.sleepKind === 'nap' ? 'Napping' : 'Asleep') + (p.lights ? ' (lights ON!)' : '') : p.fake ? 'Tantrum!' : 'Awake') + '</td></tr>' +
          '</table>';
      } else if (pg === 'report') {
        var f = PP.Evolution.forecast(p), score = PP.Evolution.careScore(p);
        h = '<table class="kv"><tr><td>Care mistakes</td><td>' + p.mistakes + '</td></tr>' +
          '<tr><td>Care score</td><td>' + score + '</td></tr>' +
          '<tr><td>Trainings</td><td>' + p.evo.trainings + (p.evo.best ? ' \u00b7 best streak ' + p.evo.best + ' day' + (p.evo.best > 1 ? 's' : '') : '') + '</td></tr>' +
          (f ? '<tr><td>On track for</td><td><b>' + FORM_LABEL[f] + '</b> (' + esc(D.NAMES[p.species][f]) + ')</td></tr>' : '') +
          '</table><p class="tip">Champion: \u2264' + D.EVO.perfect.maxMistakes + ' mistakes, score \u2265' + D.EVO.perfect.minScore + ', discipline \u2265' + D.EVO.perfect.minDiscipline +
          '%. Solid: score \u2265' + D.EVO.good.minScore + '. A secret form needs Champion care plus something special - see the Paldex.</p>' +
          recentMistakes(p);
      } else if (pg === 'battle') {
        var bs = PP.Stats.battleStats(p), cap = PP.Stats.levelCap(p.form), need = D.LEVEL.xpNeed(p.level);
        h = '<table class="kv"><tr><td>Level</td><td>' + p.level + ' / ' + cap + '</td></tr>' +
          '<tr><td>XP</td><td>' + (p.level >= cap ? 'MAX' : bar(p.xp, need, 'XP') + ' ' + p.xp + '/' + need) + '</td></tr>' +
          '<tr><td>HP / ATK</td><td>' + bs.hp + ' / ' + bs.atk + '</td></tr>' +
          '<tr><td>DEF / SPD</td><td>' + bs.def + ' / ' + bs.spd + '</td></tr>' +
          '<tr><td>Battle Power</td><td><b>' + PP.Stats.bp(bs) + '</b></td></tr>' +
          '<tr><td>Skill points</td><td>' + p.sp + '</td></tr>' +
          '<tr><td>Wins / losses</td><td>' + p.wins + ' / ' + p.losses + '</td></tr>' +
          '<tr><td>Care mistakes</td><td>' + p.totalMistakes + ' (life)</td></tr></table>' +
          (bs.notes.length ? '<p class="tip">Condition: ' + esc(bs.notes.join(', ')) + '</p>' : '');
      } else {
        var g = p.genes, word = function (v) { return v >= 2 ? 'great' : v === 1 ? 'good' : v === 0 ? 'normal' : v === -1 ? 'weak' : 'poor'; };
        h = '<p>Hidden genes (a vet\'s guess):</p><table class="kv">' +
          '<tr><td>Vitality</td><td>' + word(g.hp) + '</td></tr><tr><td>Strength</td><td>' + word(g.atk) + '</td></tr>' +
          '<tr><td>Toughness</td><td>' + word(g.def) + '</td></tr><tr><td>Speed</td><td>' + word(g.spd) + '</td></tr>' +
          '<tr><td>Appetite</td><td>' + (g.appetite > 1.03 ? 'big eater' : g.appetite < 0.97 ? 'small eater' : 'normal') + '</td></tr>' +
          '<tr><td>Constitution</td><td>' + (g.hardy > 0.66 ? 'hardy' : g.hardy < 0.33 ? 'delicate' : 'normal') + '</td></tr>' +
          '<tr><td>Temper</td><td>' + (g.temper > 0.66 ? 'fiery' : g.temper < 0.33 ? 'calm' : 'normal') + '</td></tr>' +
          '<tr><td>Parents</td><td>' + (p.parents && p.parents.length ? esc(p.parents.map(function (q) { return q.name; }).join(' + ')) : 'wild egg') + '</td></tr>' +
          (p.inheritedSkills && p.inheritedSkills.length ? '<tr><td>Inherited</td><td>' + esc(p.inheritedSkills.map(function (id) { return PP.Skills.find(p.species, id).name; }).join(', ')) + '</td></tr>' : '') +
          '</table>';
      }
      return { title: 'STATUS ' + (page % pages.length + 1) + '/' + pages.length, html: h, live: true, items: [
        { label: 'Next page \u25b6', act: function () { replace(statusScreen(page + 1)); } },
        { label: 'Sleep schedule', disabled: p.stage === 'egg' || !!p.fate, reason: p.fate ? 'No pal' : 'Eggs do not have a bedtime yet', act: function () { push(sleepScreen()); } },
        { label: 'Back', act: pop }
      ] };
    };
  }

  function itemRow(id, sub) {
    var it = D.ITEMS[id];
    return { label: it.name, sub: sub || it.desc, right: 'x' + PP.Shop.count(st(), id), act: function () { App().useItem(id); } };
  }
  function feedMenu() {
    var p = pet();
    var items = [
      { label: 'Meal: ' + D.foodOf(p && p.species).name, sub: 'Hunger +1, weight +1g (free)', act: function () { App().doAct('meal'); } },   // 1.9.9: per diet
      { label: 'Snack', sub: 'Happy +1, weight +2g. More than 3 in 3h = care mistake', act: function () { App().doAct('snack'); } }
    ].concat(PP.Shop.owned(st(), ['food', 'energy']).map(function (id) { return itemRow(id); }));
    return { title: 'FEED', html: p ? '<p>Hunger ' + hearts(p.hunger) + ' \u00b7 Happy ' + hearts(p.happy) + ' \u00b7 Energy ' + Math.round(p.energy) + '%</p>' : '', live: true, items: items };
  }
  function medMenu() {
    var p = pet();
    return { title: 'MEDICINE', html: '<p>' + (p && p.sick ? 'Your pal is sick.' : 'Your pal is healthy - medicine now would upset it.') + '</p>', items: [
      { label: 'Medicine', sub: 'Free. Babies/children: 1 dose, teens/adults: 2', act: function () { App().doAct('medicine'); } }
    ].concat(PP.Shop.owned(st(), ['med']).map(function (id) { return itemRow(id); })) };
  }

  /* ------------------------------------------------------------ Pal Store */
  function coinLine() { return '<p class="coins">\u25c9 <b>' + PP.Shop.coins(st()) + '</b> coins</p>'; }
  function buyRow(id) {
    var it = D.ITEMS[id], c = PP.Shop.coins(st());
    return { label: it.name, sub: it.desc, right: it.price + 'c', cls: c < it.price ? 'lock' : '', act: function () {
      var r = PP.Shop.buy(st(), id); App().toast(r.msg); PP.Audio.play(r.ok ? 'eat' : 'no'); if (r.ok) App().save(); refresh();
    } };
  }
  function storeScreen() {
    var w = PP.Shop.wallet(st()), E = D.ECONOMY;
    return { title: 'PAL STORE', html: coinLine() + '<p class="tip">Earn coins by battling (' + E.battleWin(1) + '-' + E.battleWin(38) + '+ a win), training (' + E.trainWin + '), cup clears and the daily bonus. Basic care is always free.</p>', items: [
      { label: 'Food & care', sub: 'Cake, feast, energy tonic, super medicine', act: function () { push(storeList('care')); } },
      { label: 'Boosts', sub: 'Tiny permanent stat boosts (max 4 per pal)', act: function () { push(storeList('boost')); } },
      { label: 'Shell colours', sub: 'Extra colours to buy (finishes are earned)', act: function () { push(storeShells); } },
      { label: 'Pal Box slots', sub: 'Room for more pals: ' + st().slots.length + '/' + D.BOX.max, right: PP.Shop.nextSlotPrice(st()) != null ? PP.Shop.nextSlotPrice(st()) + 'c' : 'MAX', act: function () { push(palBox); } },
      { label: 'Revive a pal', sub: 'Bring back a pal that died or ran away', right: G.lostPals(st()).length ? G.lostPals(st()).length + '' : '-', act: function () { push(reviveScreen); } },
      { label: 'My bag', sub: 'Use what you bought', act: function () { push(bagScreen); } },
      { label: 'Back', act: pop }
    ], detail: function () { return 'Today: ' + (w.earned || 0) + '/' + E.dailyCap + ' coins from battles and training \u00b7 streak ' + (w.streak || 0); } };
  }
  function storeList(kind) {
    return function () {
      var ids = Object.keys(D.ITEMS).filter(function (id) { return kind === 'boost' ? D.ITEMS[id].kind === 'boost' : D.ITEMS[id].kind !== 'boost'; });
      var p = pet(), b = PP.Shop.boosts(p);
      var extra = kind === 'boost' && p ? '<p class="tip">' + esc(p.name) + ': HP +' + b.hp * D.BOOST.pct + '% \u00b7 ATK +' + b.atk * D.BOOST.pct + '% \u00b7 DEF +' + b.def * D.BOOST.pct + '% \u00b7 SPD +' + b.spd * D.BOOST.pct + '% (' + PP.Shop.boostTotal(p) + '/' + D.BOOST.total + ' used). Boosts never change the adult form.</p>' : '';
      return { title: kind === 'boost' ? 'STORE \u00b7 BOOSTS' : 'STORE \u00b7 FOOD & CARE', html: coinLine() + extra,
        items: ids.map(buyRow).concat([{ label: 'Back', act: pop }]),
        detail: function (i) { var id = ids[i]; return id ? 'In your bag: ' + PP.Shop.count(st(), id) : 'Back to the store'; } };
    };
  }
  function storeShells() {
    var s = st(), list = D.SHELLS.filter(function (sh) { return sh.price; });
    var items = list.map(function (sh) {
      var own = PP.Collection.shellStatus(s, sh.id).ok;
      return { icon: '<span class="swatch" style="' + PP.Shells.swatchStyle(sh) + '"></span>', label: sh.name, sub: own ? 'Owned - pick it in Shell colour' : 'Plain colour', right: own ? '\u2713' : sh.price + 'c',
        act: function () {
          if (own) { s.settings.shell = sh.id; PP.Shells.apply(sh.id); App().save(); App().toast(sh.name + ' shell on!'); refresh(); return; }
          var r = PP.Shop.buyShell(s, sh.id); PP.Audio.play(r.ok ? 'level' : 'no'); App().toast(r.msg);
          if (r.ok) { s.settings.shell = sh.id; PP.Shells.apply(sh.id); App().save(); }
          refresh();
        } };
    });
    items.push({ label: 'Back', act: function () { PP.Shells.apply(s.settings.shell); pop(); } });
    return { title: 'STORE \u00b7 SHELLS', html: coinLine(), items: items,
      onCursor: function (i) { PP.Shells.apply(list[i] ? list[i].id : s.settings.shell); },
      back: function () { PP.Shells.apply(s.settings.shell); pop(); },
      detail: function (i) { return list[i] ? 'Preview: <b>' + esc(list[i].name) + '</b>' : 'Gold, Silver, Glitter and Crystal can only be earned.'; } };
  }
  function bagScreen() {
    var ids = PP.Shop.owned(st());
    return { title: 'BAG', html: coinLine() + (ids.length ? '' : '<p class="tip">Empty. Visit the Pal Store (MENU \u25b8 Pal Store).</p>'),
      items: ids.map(function (id) { return itemRow(id); }).concat([{ label: 'Pal Store', act: function () { replace(storeScreen); } }, { label: 'Back', act: pop }]) };
  }

  function trainMenu() {
    var p = pet(), R = D.RULES;
    var a = p ? PP.Care.canExercise(p, 'train') : { ok: false, msg: 'No pal' }, b = p ? PP.Care.canExercise(p, 'game') : a;
    return { title: 'TRAIN & PLAY', html: p ? '<p>Energy ' + bar(p.energy, 100, 'Energy') + ' ' + Math.round(p.energy) + '</p>' : '', items: [
      { label: 'Power Training', sub: '-' + R.costs.train + ' energy. Win: happy +1, discipline +3%' + (p && p.stage === 'adult' ? ', XP' : ''), disabled: !a.ok, reason: a.msg,
        act: function () { close(); App().startMini('train'); } },
      { label: 'Left or Right?', sub: '-' + R.costs.game + ' energy. Watch the eyes. Win: happy +2', disabled: !b.ok, reason: b.msg, act: function () { close(); App().startMini('game'); } },
      { label: 'Memory', sub: '-' + R.costs.game + ' energy. Repeat the looks: A = left, B = right. Win: happy +2', disabled: !b.ok, reason: b.msg, act: function () { close(); App().startMini('memory'); } },
      { label: 'Match', sub: '-' + R.costs.game + ' energy. Remember the 4 pairs, 3 misses ends it. Win: happy +2', disabled: !b.ok, reason: b.msg, act: function () { close(); App().startMini('match'); } },
      { label: 'Training dummy', sub: '-' + R.costs.train + ' energy. Practice every unlocked attack', disabled: !a.ok, reason: a.msg,
        act: function () { close(); App().startMini('dummy'); } }
    ] };
  }

  function discMenu() {
    return { title: 'DISCIPLINE', html: '<p class="tip">Scold a tantrum. Praise after training or a refused meal.</p>', items: [
      { label: 'Scold', sub: 'Tantrum: +25% discipline. Wrong time: happy -1', act: function () { close(); App().doAct('scold'); } },
      { label: 'Praise', sub: 'Earned praise: +12% discipline and happy. Empty praise spoils a little.', act: function () { close(); App().doAct('praise'); } }
    ] };
  }

  function battleMenu() {
    var p = pet(), why = G.canBattle(p);
    var items = [
      { label: 'Arena', sub: 'Computer ladder: ' + D.ARENA_MAIN + ' cups + a post-game cup', disabled: !!why, reason: why, act: function () { push(arenaScreen); } },
      { label: 'Friend battle', sub: 'Fight a pal from a battle code', disabled: !!why, reason: why, act: function () { push(friendsScreen); } },
      { label: 'Live battle', sub: 'Room code: pick moves with a friend in real time', disabled: !!why, reason: why, act: function () { push(PP.LiveUI.liveScreen); } },
      { label: 'My battle code', sub: 'Share your pal', disabled: !p || p.stage !== 'adult', reason: 'Only adults have a battle card', act: function () { push(myCodeScreen); } },
      { label: 'Add friend code', sub: 'Paste a code (battle or breed)', act: function () { push(addCodeScreen); } }
    ];
    if (PP.Daily.visitorReady(st(), G.now(st()))) items.unshift({ label: 'Visitor!', sub: 'A wild pal came by: one try today, +' + PP.Daily.VISITOR_BONUS + ' coins for a win', right: 'NEW', disabled: !!why, reason: why, act: function () { close(); App().startVisitor(); } });
    return { title: 'BATTLE', html: why ? '<p class="tip">' + esc(why) + '</p>' : '', items: items };
  }
  /* 1.8.4: per-cup progress. A star only for a cup really won (state.arena.cups[i].won). */
  var ROLE = { challenger: 'Challenger', rival: 'Rival', boss: 'Cup boss' };
  function cupLevels(cup) { var l = cup.foes.map(function (f) { return f[2]; }); return Math.min.apply(null, l) + '-' + Math.max.apply(null, l); }
  function arenaScreen() {
    var s = st(), p = pet(), A = PP.Arena, note = s.arena.note === 'reset';
    var items = D.ARENA.map(function (cup, i) {
      var status = A.status(s, i), rec = s.arena.cups[i] || A.blankRecord(i), n = cup.foes.length;
      var cur = A.runOf(s), run = cur && cur.cup === i ? cur.foe : 0, prog;
      if (status === 'locked') prog = cup.post ? 'for Arena Champions' : 'win the ' + D.ARENA[i - 1].name + ' first';
      else if (status === 'cleared') prog = 'cleared \u00b7 ' + rec.wins + ' W / ' + rec.losses + ' L';
      else if (run) prog = 'run on: foe ' + (run + 1) + ' of ' + n;
      else prog = rec.best ? 'best ' + rec.best + ' of ' + n : 'open';
      return { label: cup.name, sub: 'Lv ' + cupLevels(cup) + ' \u00b7 ' + n + ' foes \u00b7 ' + prog,
        right: status === 'cleared' ? '\u2605' : status === 'locked' ? 'LOCK' : run ? (run + 1) + '/' + n : 'OPEN',
        disabled: status === 'locked', reason: cup.post ? 'Win all ' + D.ARENA_MAIN + ' main cups first' : 'Win the ' + (D.ARENA[i - 1] || {}).name + ' first',
        act: function () { push(arenaPreview(i)); } };
    });
    if (note) { s.arena.note = null; App().save(); }   // the migration note shows once
    return { title: 'ARENA' + (s.arena.champion ? ' \u2605 CHAMPION' : ''), html: (p ? '<p>Your BP: <b>' + PP.Stats.bp(PP.Stats.battleStats(p)) + '</b> \u00b7 cups won <b>' + A.mainWon(s) + '/' + D.ARENA_MAIN + '</b></p>' : '') +
      '<p class="tip">Each cup: beat its foes in a row (a loss or a forfeit ends the run). \u2605 = cup won.</p>' +
      (note ? '<p class="tip">Your old save had no per-cup record, so cup stars start fresh. Your open cups stay open - win a cup to earn its star.</p>' : ''), items: items };
  }
  /* The cup screen: its foes (beaten ones ticked) and the next fight. */
  function arenaPreview(rank) {
    return function () {
      var s = st(), p = pet(), A = PP.Arena, cup = D.ARENA[rank], rec = s.arena.cups[rank] || A.blankRecord(rank);
      var next = A.nextFoe(s, rank), opp = A.foe(rank, next), of = PP.Battle.fighter(opp), mine = p ? PP.Battle.fighter(p) : null;
      var cur = A.runOf(s), other = cur && cur.cup !== rank ? D.ARENA[cur.cup].name : null;
      var list = '<ul class="foes">' + cup.foes.map(function (f, j) {
        var c = A.foe(rank, j), mark = rec.beat[j] ? '<b class="ok" role="img" aria-label="beaten">\u2713</b>' : '<b class="no" role="img" aria-label="not beaten yet">\u00b7</b>';
        return '<li class="' + (j === next ? 'nextfoe' : '') + '">' + mark + thumb(c.species, 'adult_' + c.form, 'idle', 12) +
          '<span><b>' + esc(c.name) + '</b> \u00b7 ' + ROLE[c.role] + (j === next ? ' \u25c2 next' : '') + '<br>' + esc(D.NAMES[c.species][c.form]) + ' (' + FORM_LABEL[c.form] + ') Lv ' + c.level + ' \u00b7 BP ' + PP.Battle.fighter(c).bp + '</span></li>';
      }).join('') + '</ul>';
      var why = G.canBattle(p);
      return { title: cup.name.toUpperCase() + (rec.won ? ' \u2605' : ''), html:
        '<div class="vs">' + (p ? thumb(p.species, S.stageKeyOf(p), 'idle', 30) : '') + '<b>VS</b><span class="flip">' + thumb(opp.species, 'adult_' + opp.form, 'angry', 30) + '</span></div>' +
        '<p><b>' + esc(opp.name) + '</b> the ' + esc(D.NAMES[opp.species][opp.form]) + ' \u00b7 foe ' + (next + 1) + '/' + cup.foes.length + '<br>Lv ' + opp.level + ' \u00b7 BP ' + of.bp + (mine ? ' (you: ' + mine.bp + ')' : '') + '</p>' +
        list + '<p class="tip">' + (rec.won ? 'Cleared - rematches still pay XP and coins.' : 'Clear it: +' + D.ECONOMY.cupClear(rank + 1) + ' coins' + (cup.post ? ' +' + D.ECONOMY.myth : '') + ' (first time).') +
        (rec.best && !rec.won ? ' Best run: ' + rec.best + '/' + cup.foes.length + '.' : '') + (other ? ' Starting here ends your ' + esc(other) + ' run.' : '') + '</p>',
        items: [
          { label: 'FIGHT!', sub: next ? 'Continue the run' : 'Start a run', disabled: !!why, reason: why, act: function () { close(); App().startArena(rank); } },
          { label: 'Back', act: pop }
        ] };
    };
  }
  function cardLabel(c) { return D.NAMES[c.species][c.form] + ' Lv' + c.level + ' ' + (c.sex === 'M' ? '\u2642' : '\u2640'); }
  function friendsScreen() {
    var s = st();
    var items = s.friends.map(function (c, i) {
      return { icon: thumb(c.species, 'adult_' + c.form, 'idle', 15), label: c.name, sub: cardLabel(c) + ' \u00b7 BP ' + PP.Battle.fighter(c).bp, act: function () { push(friendMenu(i)); } };
    });
    items.push({ label: '+ Add a code', act: function () { push(addCodeScreen); } });
    return { title: 'FRIENDS', html: s.friends.length ? '' : '<p class="tip">No friend codes yet. Ask a friend for their battle code (Battle \u25b8 My battle code) and paste it here.</p>', items: items };
  }
  function friendMenu(i) {
    return function () {
      var c = st().friends[i]; if (!c) return null;
      return { title: c.name.toUpperCase(), html: '<p>' + esc(cardLabel(c)) + '</p>', items: [
        { label: 'Battle!', disabled: !!G.canBattle(pet()), reason: G.canBattle(pet()), act: function () { close(); App().startFriend(c); } },
        { label: 'Remove', act: function () { st().friends.splice(i, 1); App().save(); pop(); } },
        { label: 'Back', act: pop }
      ] };
    };
  }
  function myCodeScreen() {
    var p = pet(), code = PP.Cards.encode(p);
    return { title: 'MY BATTLE CODE', html: '<p>Send this to a friend. It works offline: the whole battle card is inside the code, with a checksum.</p><textarea class="code" readonly rows="4" aria-label="Your battle code">' + esc(code) + '</textarea>',
      items: [
        { label: 'Copy code', act: function () { copyText(code); } },
        { label: 'Back', act: pop }
      ].concat(navigator.share ? [{ label: 'Share\u2026', act: function () { navigator.share({ title: 'PocketPal battle code', text: code }).catch(function () {}); } }] : []) };
  }
  function copyText(text) {
    function fallback() {
      var ta = el.querySelector('textarea.code');
      if (ta) { ta.focus(); ta.select(); try { document.execCommand('copy'); App().toast('Copied!'); } catch (e) { App().toast('Select the text and copy it'); } }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { App().toast('Copied!'); }, fallback);
    else fallback();
  }
  function addCodeScreen() {
    return { title: 'ADD FRIEND CODE', html: '<p>Paste a PocketPal battle code:</p><textarea id="codeIn" class="code" rows="4" placeholder="Battle code" aria-label="Friend code"></textarea>',
      items: [
        { label: 'Add', act: function () {
          var v = (document.getElementById('codeIn') || {}).value || '';
          var r = G.addFriend(st(), v);
          App().toast(r.msg); if (r.ok) { App().save(); pop(); }
        } },
        { label: 'Cancel', act: pop }
      ] };
  }

  function skillsScreen() {
    var p = pet();
    if (!p) return { title: 'SKILLS', html: '<p>No pal.</p>', items: [{ label: 'Back', act: pop }] };
    var tree = PP.Skills.tree(p.species), adult = p.stage === 'adult';
    var items = tree.map(function (s) {
      var learned = (p.skills || []).indexOf(s.id) >= 0, why = PP.Skills.blockReason(p, s.id);
      var tag = learned ? '\u2713' : !why ? s.cost + 'SP' : '\u2022';
      return { label: s.name, tier: s.tier, right: tag, cls: 'node' + (learned ? ' got' : !why ? ' can' : ''), disabled: learned || !!why, reason: learned ? 'Already learned' : why,
        act: function () { push(confirmScreen('Learn ' + s.name + '?', s.desc + ' (costs ' + s.cost + ' SP)', function () {
          var r = PP.Skills.learn(p, s.id); App().toast(r.msg); if (r.ok) { PP.Audio.play('level'); App().save(); } pop();
        })); } };
    });
    items.push({ label: 'Back', tier: 0, act: pop });
    function detail(i) {
      var s = tree[i]; if (!s) return 'Back to the menu';
      var learned = (p.skills || []).indexOf(s.id) >= 0, why = PP.Skills.blockReason(p, s.id);
      var m = s.kind === 'move' ? D.MOVES[s.move] : null;
      return '<b>' + esc(s.name) + '</b> \u00b7 ' + (s.kind === 'move' ? 'MOVE' + (m.power ? ' PWR ' + m.power : '') : 'PASSIVE') + ' \u00b7 ' + s.cost + ' SP<br>' + esc(s.desc) +
        '<br><i>' + (learned ? 'Learned' + ((p.innate || []).indexOf(s.id) >= 0 ? ' (inherited)' : '') : why ? esc(why) : 'Ready - press B to learn') + '</i>';
    }
    return { title: D.SPECIES_INFO[p.species].flavour.toUpperCase() + ' SKILL TREE \u00b7 ' + (adult ? p.sp + ' SP' : 'LOCKED'),
      html: adult ? '' : '<p class="tip">Skills unlock when your pal becomes an adult. Preview:</p>',
      tiers: { 1: 'T1 Lv1', 2: 'T2 Lv5', 3: 'T3 Lv12', 4: 'ULT Lv25' }, detail: detail, items: items };
  }
  function confirmScreen(title, text, yes) {
    return function () { return { title: title, html: '<p>' + esc(text) + '</p>', items: [{ label: 'Yes', act: yes }, { label: 'No', act: pop }] }; };
  }

  function slotLine(p) {
    if (!p) return 'empty';
    return PP.Pet.formName(p) + ' \u00b7 ' + (p.stage === 'adult' ? FORM_LABEL[p.form] + ' Lv' + p.level : p.stage) + (p.hard ? ' \u00b7 HARD' : '') + (p.golden ? ' \u00b7 golden' : '') + (p.fate ? ' \u00b7 ' + (p.fate === 'dead' ? 'R.I.P.' : 'gone') : '');
  }
  function palBox() {
    var s = st();
    var items = s.slots.map(function (p, i) {
      if (!p) return { label: 'Slot ' + (i + 1) + ': empty', sub: 'Start a new egg here', act: function () { push(speciesPicker(function (sp) { var r = G.startEgg(s, sp, Date.now()); App().toast(r.ok ? 'New ' + D.SPECIES_INFO[sp].label + ' egg!' : r.msg); App().save(); close(); })); } };
      return { icon: thumb(p.species, S.stageKeyOf(p), p.fate ? 'faint' : 'idle', 15), label: (i === s.active ? '\u25b6 ' : '') + p.name + ' ' + (p.sex === 'M' ? '\u2642' : '\u2640'),
        sub: slotLine(p) + (i === s.active ? ' \u00b7 out now' : ' \u00b7 resting (time frozen)'), act: function () { push(slotMenu(i)); } };
    });
    var price = PP.Shop.nextSlotPrice(s);
    for (var j = s.slots.length; j < D.BOX.max; j++) {
      var pr = D.BOX.prices[j - D.BOX.start], next = j === s.slots.length;
      items.push({ label: 'Slot ' + (j + 1) + ': locked', sub: next ? 'Buy this slot for ' + pr + ' coins' : 'Unlock slot ' + j + ' first', right: pr + 'c', cls: 'lock',
        disabled: !next, reason: 'Buy the slots in order', act: function () {
          push(confirmScreen('Buy slot ' + (s.slots.length + 1) + '?', 'Costs ' + price + ' coins. You have ' + PP.Shop.coins(s) + '.', function () {
            var r = PP.Shop.buySlot(s); App().toast(r.msg); PP.Audio.play(r.ok ? 'level' : 'no'); if (r.ok) App().save(); pop();
          }));
        } });
    }
    return { title: 'PAL BOX (' + s.slots.filter(Boolean).length + '/' + s.slots.length + ')', html: '<p class="tip">Only the pal that is out lives in real time. Pals in the box are frozen. \u25c9 ' + PP.Shop.coins(s) + ' coins</p>', items: items };
  }
  function slotMenu(i) {
    return function () {
      var s = st(), p = s.slots[i]; if (!p) return null;
      var items = [];
      if (i !== s.active && !p.fate) items.push({ label: 'Take out', sub: 'Switch to this pal', act: function () { var r = G.setActive(s, i, Date.now()); App().toast(r.msg); App().resetWalker(); App().save(); close(); } });
      if (p.fate && p.fate !== 'released' && !p.hard) items.push({ label: 'Revive', sub: 'Costs ' + G.reviveCost(p) + ' coins', right: G.reviveCost(p) + 'c', act: function () {
        push(confirmScreen('Revive ' + p.name + '?', 'Costs ' + G.reviveCost(p) + ' coins. You have ' + PP.Shop.coins(s) + '.', function () {
          var r = G.revive(s, { slot: i, now: Date.now() }); App().toast(r.msg); PP.Audio.play(r.ok ? 'level' : 'no'); if (r.ok) { App().resetWalker(); App().save(); } pop();
        }));
      } });
      items.push({ label: p.fate ? 'Clear slot' : 'Release', sub: p.fate ? 'Moves to the album' : 'Say goodbye (kept in the album)', act: function () {
        push(confirmScreen(p.fate ? 'Clear slot?' : 'Release ' + p.name + '?', p.fate ? 'Their memory stays in the album.' : 'This cannot be undone.', function () { var r = G.release(s, i); App().toast(r.msg); App().save(); stack.length = 1; replace(palBox); }));
      } });
      items.push({ label: 'Back', act: pop });
      return { title: p.name.toUpperCase(), html: '<div class="st-top">' + thumb(p.species, S.stageKeyOf(p), 'idle', 26) + '<div>' + esc(slotLine(p)) + '<br>Gen ' + p.gen + ' \u00b7 ' + (p.sex === 'M' ? 'male' : 'female') + '</div></div>', items: items };
    };
  }
  function speciesPicker(onPick, title) {
    return function () {
      var hard = !!st().settings.hardNext;
      var items = D.SPECIES.map(function (sp) {
        var info = D.SPECIES_INFO[sp];
        return { icon: thumb(sp, 'adult_good', 'idle', 20), label: info.label, sub: info.blurb, act: function () { onPick(sp); } };
      });
      items.push({ label: 'Surprise me', sub: 'Random egg', act: function () { onPick(D.SPECIES[Math.floor(Math.random() * D.SPECIES.length)]); } });
      items.push({ label: 'Mode: ' + (hard ? 'HARD' : 'Normal'), right: hard ? 'HARD' : 'NORMAL', sub: hard ? 'Harsh rules, no revives. Tap for normal mode' : 'Tap to try hard mode (for experts)', cls: hard ? 'hardsel' : '',
        act: function () { toggleHard(); } });
      return { title: (title || 'CHOOSE AN EGG') + (hard ? ' \u00b7 HARD' : ''), html: hard ? '<p class="tip warn">Hard mode is ON for this egg.</p>' : '', items: items };
    };
  }
  /* 1.9.0 hard mode: confirm with a clear warning before switching it on (new eggs only). */
  var HARD_TEXT = 'Hard mode is for experts. A hard-mode pal: dies after 12 awake hours starving or 24 hours sick, ' +
    'runs away after 6 care mistakes in 24 hours, gets no first-day grace, and can NEVER be revived. ' +
    'Its memory stays in your Album. In return it earns 25% more coins from play and +5 on daily goals. Only NEW eggs are affected.';
  function hardWarning() {
    return { title: 'HARD MODE?', html: '<p class="warn"><b>\u26a0 Warning</b></p><p>' + esc(HARD_TEXT) + '</p>', items: [
      { label: 'Yes, hard mode for new eggs', act: function () { st().settings.hardNext = true; App().save(); App().toast('Hard mode ON for new eggs'); pop(); } },
      { label: 'No, keep normal', act: pop }] };
  }
  function toggleHard() {
    var s = st();
    if (s.settings.hardNext) { s.settings.hardNext = false; App().save(); App().toast('Normal mode for new eggs'); refresh(); }
    else push(hardWarning);
  }

  function breedScreen() {
    var p = pet();
    var intro = '<p class="tip">Two adults of the <b>same species</b>, one male and one female, healthy and rested (24h between clutches). The egg blends both parents\' genes and may inherit one skill from each.</p>';
    if (!p || p.stage !== 'adult') return { title: 'BREEDING', html: intro + '<p>Your pal must be an adult first.</p>', items: [{ label: 'Back', act: pop }] };
    var list = G.mates(st());
    var items = list.map(function (m) {
      var c = m.pal, form = c.stage === 'adult' || c.form ? c.form : null;
      return { icon: thumb(c.species, c.stage && c.stage !== 'adult' ? c.stage : 'adult_' + (form || 'good'), 'idle', 15),
        label: c.name + ' ' + (c.sex === 'M' ? '\u2642' : '\u2640'), sub: (m.kind === 'friend' ? 'Friend code \u00b7 ' : 'Pal Box \u00b7 ') + (m.check.ok ? 'Ready!' : m.check.reason),
        disabled: !m.check.ok, reason: m.check.reason, act: function () {
          push(confirmScreen('Breed with ' + c.name + '?', 'An egg will appear in a free Pal Box slot.', function () {
            var r = G.breedWith(st(), c, Date.now());
            App().toast(r.msg); if (r.ok) { PP.Audio.play('hatch'); App().save(); close(); } else pop();
          }));
        } };
    });
    if (!items.length) intro += '<p>No possible mates yet. Raise another ' + esc(D.SPECIES_INFO[p.species].label) + ' in the Pal Box, or add a friend\'s code.</p>';
    items.push({ label: '+ Add friend code', act: function () { push(addCodeScreen); } });
    items.push({ label: 'Back', act: pop });
    return { title: 'BREEDING', html: intro, items: items };
  }

  function reviveScreen() {
    var s = st(), list = G.lostPals(s);
    var items = list.map(function (row) {
      var p = row.pet, sk = p.stage === 'adult' ? 'adult_' + (p.form || 'good') : p.stage;
      return { icon: thumb(p.species, sk, 'faint', 15), label: row.name, sub: (p.fateCause || p.fate || 'lost') + ' · revive for ' + row.cost + 'c', right: row.cost + 'c',
        act: function () {
          push(confirmScreen('Revive ' + row.name + '?', 'Costs ' + row.cost + ' coins. You have ' + PP.Shop.coins(s) + '.', function () {
            var r = G.revive(s, row.kind === 'slot' ? { slot: row.slot, now: Date.now() } : { albumId: row.albumId, now: Date.now() });
            App().toast(r.msg); PP.Audio.play(r.ok ? 'level' : 'no'); if (r.ok) { App().resetWalker(); App().save(); } stack.length = 1; replace(palBox);
          }));
        } };
    });
    if (!items.length) items.push({ label: 'No lost pals', sub: 'RIP pals show up here after they die or run away', disabled: true });
    items.push({ label: 'Back', act: pop });
    return { title: 'REVIVE', html: coinLine() + '<p class="tip">A Life Charm from the store of memories. Price grows with generation and level.</p>', items: items };
  }
  function albumScreen() {
    var s = st(), list = s.album.slice().reverse();
    var items = list.map(function (e) {
      var sk = e.stage === 'adult' ? 'adult_' + (e.form || 'good') : (e.stage || 'baby');
      return { icon: thumb(e.species, sk, e.fate === 'dead' ? 'faint' : 'idle', 15), label: e.name + ' ' + (e.sex === 'M' ? '\u2642' : '\u2640') + ' G' + e.gen,
        sub: D.NAMES[e.species][e.stage === 'adult' ? e.form : e.stage] + (e.level ? ' Lv' + e.level : '') + (e.fate ? ' \u00b7 ' + e.fate : '') + (e.hard && (e.fate === 'dead' || e.fate === 'gone') ? ' \u00b7 \u2020 in memoriam (hard mode)' : e.hard ? ' \u00b7 HARD' : '') + (e.golden ? ' \u00b7 golden' : ''),
        cls: e.hard && (e.fate === 'dead' || e.fate === 'gone') ? 'memorial' : '', act: function () { push(treeScreen(e.id)); } };
    });
    items.push({ label: 'Back', act: pop });
    return { title: 'ALBUM (' + list.length + ')', html: list.length ? '' : '<p class="tip">Pals appear here once they hatch.</p>', items: items };
  }
  function treeScreen(id) {
    return function () {
      var s = st(), e = G.albumFind(s, id) || s.slots.filter(Boolean).find(function (p) { return p.id === id; });
      if (!e) return null;
      var t = G.familyTree(s, e);
      function nodeHtml(n) {
        if (!n) return '<div class="tn unknown">?</div>';
        var sk = n.form ? 'adult_' + n.form : 'baby';
        return '<div class="tn">' + (n.species ? thumb(n.species, sk, 'idle', 15) : '') + '<span>' + esc(n.name || '?') + (n.sex ? (n.sex === 'M' ? ' \u2642' : ' \u2640') : '') + '</span></div>';
      }
      var h = '<div class="tree">';
      var ps = t.parents || [];
      if (ps.length) {
        h += '<div class="tlabel">Grandparents</div><div class="trow gp">';
        ps.forEach(function (pp) { (pp && pp.parents && pp.parents.length ? pp.parents : [null, null]).forEach(function (g) { h += nodeHtml(g); }); });
        h += '</div><div class="tlabel">Parents</div><div class="trow">' + ps.map(nodeHtml).join('') + '</div>';
      } else h += '<p class="tip">Wild egg - no known parents.</p>';
      h += '<div class="trow me">' + nodeHtml(t) + '</div></div>';
      if (e.hard && (e.fate === 'dead' || e.fate === 'gone')) h += '<p class="memorial-note">\u2020 In memory of <b>' + esc(e.name) + '</b>, raised in hard mode' + (e.days != null ? ' for ' + e.days + ' day' + (e.days === 1 ? '' : 's') : '') + ' (' + esc(e.cause || e.fate) + '). Hard-mode pals cannot be revived.</p>';
      return { title: 'FAMILY OF ' + String(e.name).toUpperCase(), html: h, items: [{ label: 'Back', act: pop }] };
    };
  }

  function recentMistakes(p) {
    if (!p.mistakeLog.length) return '';
    var log = p.mistakeLog.slice(-4), at = (p.mistakeAt || []).slice(-log.length);
    return '<p class="tip">Recent mistakes:</p><ul class="away">' + log.map(function (m, i) {
      return '<li>' + (at[i] ? esc(tDate(at[i])) + ': ' : '') + esc(m) + '</li>';
    }).join('') + '</ul>';
  }
  /* ------------------------------------------------------------ sleep schedule */
  var STAGE_WORD = { baby: 'babies', child: 'children', teen: 'teens', adult: 'adults' };
  function sleepScreen() {
    var p = pet(), orig = PP.Sleep.of(p), draft = { bed: orig.bed, wake: orig.wake }, step = 30;
    function norm(m) { return ((m % 1440) + 1440) % 1440; }
    function nudge(k, d) { return function () { draft[k] = norm(draft[k] + d * step); refresh(); }; }
    return function () {
      p = pet();
      if (!p || p.fate || p.stage === 'egg') return { title: 'SLEEP', html: '<p>No pal to put to bed.</p>', items: [{ label: 'Back', act: pop }] };
      var lim = PP.Sleep.limits(p.stage), len = PP.Sleep.lengthMin(draft), err = PP.Sleep.check(draft, p.stage);
      var def = PP.Sleep.defaultFor(p.stage), changed = !PP.Sleep.same(draft, PP.Sleep.of(p));
      var h = '<p><b>' + esc(p.name) + '</b>\'s bedtime</p><table class="kv">' +
        '<tr><td>Bedtime</td><td><b>' + tHM(draft.bed) + '</b></td></tr>' +
        '<tr><td>Wakes</td><td><b>' + tHM(draft.wake) + '</b></td></tr>' +
        '<tr><td>Sleep</td><td>' + PP.Time.duration(len) + (err ? ' \u2716' : ' \u2714') + '</td></tr></table>' +
        '<p class="tip" aria-live="polite">' + (err ? esc(err) : 'Good for ' + STAGE_WORD[p.stage] + ' (' + lim.min / 60 + '\u2013' + lim.max / 60 + 'h).') +
        ' Default: ' + schedText(def) + '.</p>';
      return { title: 'SLEEP SCHEDULE', html: h, live: false, items: [
        { label: 'Bedtime later', right: '+' + step + 'm', act: nudge('bed', 1) },
        { label: 'Bedtime earlier', right: '-' + step + 'm', act: nudge('bed', -1) },
        { label: 'Wake later', right: '+' + step + 'm', act: nudge('wake', 1) },
        { label: 'Wake earlier', right: '-' + step + 'm', act: nudge('wake', -1) },
        { label: 'Step', right: step + ' min', sub: 'Change times in 15 or 30-minute steps', act: function () { step = step === 30 ? 15 : 30; refresh(); } },
        { label: 'Use stage default', sub: schedText(def), act: function () { draft = { bed: def.bed, wake: def.wake }; refresh(); } },
        { label: 'Save', disabled: !!err || !changed, reason: err || 'Nothing changed', act: function () {
          var r = PP.Sleep.set(p, draft);
          if (!r.ok) { App().toast(r.msg); return; }
          App().save(); App().toast(p.name + ' sleeps ' + schedText(r.sched)); pop();
        } },
        { label: 'Cancel', act: pop }
      ] };
    };
  }
  function settingsScreen() {
    var s = st(), p = pet();
    var canNotify = typeof Notification !== 'undefined';
    return { title: 'SETTINGS', items: [
      { label: 'Sound', right: s.settings.sound ? 'ON' : 'OFF', sub: 'Beeps, calls and music', act: function () { s.settings.sound = !s.settings.sound; PP.Audio.setEnabled(s.settings.sound); App().updateSoundBtn(); App().save(); refresh(); } },
      { label: 'Music', right: s.settings.music !== false ? 'ON' : 'OFF', sub: 'Jingles for hatching, growing up, wins and goals (needs Sound)', act: function () { s.settings.music = s.settings.music === false; PP.Audio.setMusic(s.settings.music); App().save(); refresh(); if (s.settings.music) PP.Audio.play('goal'); } },
      { label: 'Morning report', right: s.settings.reportCard !== false ? 'ON' : 'OFF', sub: 'A care report card when your pal wakes up', act: function () { s.settings.reportCard = s.settings.reportCard === false; App().save(); refresh(); } },
      { label: 'Tips', right: s.settings.hints !== false ? 'ON' : 'OFF', sub: 'Short hints for young pals', act: function () { s.settings.hints = s.settings.hints === false; App().save(); refresh(); } },
      { label: 'Show tips again', sub: 'Bring back every beginner tip', act: function () { PP.Hints.reset(s); s.settings.hints = true; App().save(); App().toast('Tips will show again'); refresh(); } },
      { label: 'Hard mode', right: s.settings.hardNext ? 'ON' : 'OFF', sub: 'For new eggs only. Harsh rules, no revives', act: toggleHard },
      { label: 'Cloud save', right: s.settings.cloud ? 'ON' : 'OFF', sub: 'Encrypted copy on your worker (optional)', act: function () { push(cloudScreen); } },
      { label: 'Backup', sub: s.backup && s.backup.lastExport ? 'Last backup ' + tDate(s.backup.lastExport) : 'No backup yet: download one', act: function () { push(backupReminder); } },
      { label: 'Clock', right: s.settings.clock === '24' ? '24-hour' : '12-hour', sub: 'Show times as ' + (s.settings.clock === '24' ? '21:30' : '9:30 pm'),
        act: function () { s.settings.clock = s.settings.clock === '24' ? '12' : '24'; App().save(); refresh(); } },
      { label: 'Sleep schedule', sub: p && p.stage !== 'egg' && !p.fate ? p.name + ': ' + schedText(PP.Sleep.of(p)) : 'Bedtime and wake time for your pal',
        disabled: !p || !!p.fate || p.stage === 'egg', reason: p && p.stage === 'egg' ? 'Eggs do not have a bedtime yet' : 'No pal', act: function () { push(sleepScreen()); } },
      { label: 'Shell colour', sub: 'Repaint your handheld', right: PP.Collection.shell(s.settings.shell).name, act: openShells },
      { label: 'Care alerts', right: s.settings.alerts ? 'ON' : 'OFF', sub: canNotify ? (s.settings.alerts ? 'Next alert: ' + nextAlertText() : 'Bell on the shell. Pick which reminders you get') : 'Needs https + notifications',
        disabled: !canNotify, reason: 'Notifications are not supported here', act: function () { push(alertsScreen); } },
      { label: 'Guide', sub: 'Show the first-run walkthrough again', act: function () { push(guideScreen(0)); } },
      { label: 'About', sub: 'Version ' + D.VERSION + ', privacy', act: function () { push(aboutScreen); } },
      App().testAllowed && { label: 'Test mode', right: s.settings.test ? 'ON' : 'OFF', sub: 'Dev panel: speed up time, jump stages', act: function () { App().setTestMode(!s.settings.test); refresh(); } },
      { label: 'Rename pal', disabled: !p || !!p.fate, reason: 'No pal', act: function () { push(renameScreen); } },
      { label: 'Save transfer', sub: 'Move your game to another device', act: function () { push(transferScreen); } },
      { label: 'Reset everything', sub: 'Deletes all pals', act: function () { push(confirmScreen('Delete ALL pals?', 'Your whole PocketPal save will be wiped.', function () {
        replace(confirmScreen('Really sure?', 'There is no undo.', function () { App().resetAll(); close(); }));
      })); } },
      { label: 'Back', act: pop }
    ].filter(Boolean) };
  }
  /* 1.9.7 smarter reminders: the Next alert line, one switch per alert type and honest limits. */
  function nextAlertText() {
    var s = st();
    if (!s.settings.alerts) return 'alerts are off';
    return PP.Reminders.describe(PP.Reminders.next(s, Date.now()), clockMode(), Date.now());
  }
  function alertsScreen() {
    var s = st(), types = s.settings.alertTypes = PP.Reminders.clean(s.settings.alertTypes);
    var m = PP.Net && PP.Net.mode ? PP.Net.mode() : 'none';
    var how = { push: 'Push from your worker', trigger: 'On this device (scheduled)', sync: 'On this device (background sync, coarse)', open: 'Only while the game is open', none: 'Not available here' }[m];
    var html = '<p class="next-alert" id="nextAlert"><b>Next alert:</b> ' + esc(nextAlertText()) + '</p>' +
      '<p class="tip">Delivery: ' + esc(how) + '</p>' +
      '<ul class="away alert-limits">' + (PP.Net && PP.Net.limits ? PP.Net.limits() : []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    var items = [{ label: 'Alerts', right: s.settings.alerts ? 'ON' : 'OFF', sub: 'Same as the bell on the shell',
      act: function () { if (PP.Net && PP.Net.setAlerts) PP.Net.setAlerts(!s.settings.alerts); else App().toggleNotify(); refresh(); } }];
    PP.Reminders.TYPES.forEach(function (t) {
      items.push({ label: t.label, right: types[t.id] ? 'ON' : 'OFF', sub: t.text, cls: 'alert-type',
        act: function () { types[t.id] = !types[t.id]; App().save(); if (PP.Net) PP.Net.scheduleAlert(s); refresh(); } });
    });
    items.push({ label: 'Back', act: pop });
    return { title: 'CARE ALERTS', html: html, items: items, live: true };
  }
  function aboutScreen() {
    var saving = App().storageMode === 'local' ? 'Saved in this browser only' : 'OFF - storage is blocked here, progress ends with this tab';
    var online = 'Battle codes work offline on this device. Live battles, cloud save and care alerts use your own worker, only when you use them.';
    return { title: 'ABOUT', html: '<p><b>PocketPal</b> v' + esc(D.VERSION) + '</p>' +
      '<ul class="away"><li>Saving: ' + esc(saving) + '</li><li>Online: ' + esc(online) + '</li><li>No accounts, ads, tracking or cookies</li>' +
      '<li>Works offline once loaded over http(s)</li></ul><p class="tip">Move your pals to another device with Settings \u25b8 Save transfer.</p>',
      items: [{ label: 'Back', act: pop }] };
  }
  function renameScreen() {
    var p = pet();
    return { title: 'RENAME', html: '<input id="nameIn" maxlength="12" value="' + esc(p.name) + '" aria-label="New name" autocomplete="off">', items: [
      { label: 'Save name', act: function () { var v = PP.Pet.cleanName((document.getElementById('nameIn') || {}).value); if (!v) { App().toast('Letters and numbers only'); return; } p.name = v; G.albumUpsert(st(), p); App().save(); App().toast('Hello, ' + v + '!'); pop(); } },
      { label: 'Cancel', act: pop }
    ] };
  }
  /* ------------------------------------------------------------ save transfer */
  function transferScreen() {
    return { title: 'SAVE TRANSFER', html: '<p class="tip">Move your whole game (pals, album, Paldex, shells, settings) to another phone or computer.</p>', items: [
      { label: 'Export save code', sub: 'Copy a code, paste it on the other device', act: function () { push(exportScreen); } },
      { label: 'Import save code', sub: 'Paste a code from another device', act: function () { push(importScreen); } },
      { label: 'Save to a file', sub: 'Download the code as a .txt file', act: function () { downloadCode(); } },
      { label: 'Download .json backup', sub: 'The plain save file (Load from a file reads it back)', act: function () { downloadJson(); } },
      { label: 'Load from a file', sub: 'Pick a saved .txt file', act: function () { pickFile(); } },
      { label: 'Back', act: pop }
    ] };
  }
  function downloadCode() {
    var code = PP.Save.exportCode(st(), Date.now());
    try {
      var a = document.createElement('a'), d = new Date();
      a.href = URL.createObjectURL(new Blob([code + '\n'], { type: 'text/plain' }));
      a.download = 'pocketpal-save-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.txt';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      App().toast('Save file downloaded'); App().markExported();
    } catch (e) { App().toast('Download not possible here - use Export save code'); }
  }
  function downloadJson() {
    var json = PP.Save.serialize(st(), Date.now());
    try {
      var a = document.createElement('a'), d = new Date();
      a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      a.download = 'pocketpal-backup-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.json';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      App().toast('Backup downloaded'); App().markExported();
    } catch (e) { App().toast('Download not possible here - use Copy code'); }
  }
  /* 1.9.0 gentle backup reminder (after 7 days without an export) */
  function backupReminder() {
    var s = st(), last = s.backup && s.backup.lastExport;
    return { title: 'BACK UP YOUR PALS?', html: '<p>' + (last ? 'Your last backup was ' + esc(tDate(last)) + '.' : 'You have not made a backup yet.') +
      ' Your pals live only in this browser. If it clears its storage, they are gone.</p><p class="tip">A backup is one small file or code. Keep it somewhere safe (email it to yourself, or a cloud drive).</p>',
      items: [
        { label: 'Download .json file', act: function () { downloadJson(); close(); } },
        { label: 'Copy save code', act: function () { var code = PP.Save.exportCode(st(), Date.now()); copyText(code); App().markExported(); close(); } },
        { label: 'Later', sub: 'Remind me in 3 days', act: function () { s.backup = s.backup || {}; s.backup.snoozeUntil = Date.now() + 3 * 864e5; App().save(); close(); } }
      ] };
  }
  /* 1.9.0 cloud save (opt-in, end-to-end encrypted, your own worker) */
  function cloudScreen() {
    var s = st(), C = PP.CloudSync, stt = C.status(), avail = C.available();
    var h = '<p class="tip">An <b>encrypted</b> copy of your save on your PocketPal worker. Only your <b>recovery code</b> (and passphrase, if you set one) can open it: the server never sees your pals.</p>';
    if (!avail) h += '<p class="warn">Cloud save needs the online game (https) and a worker URL in js/config.js.</p>';
    var items = [];
    if (stt.on && s.settings.cloud) {
      h += '<ul class="away"><li>Status: <b>ON</b>' + (stt.hasPass ? ' \u00b7 with passphrase' : '') + '</li><li>Last upload: ' + (stt.lastUp ? esc(tDate(stt.lastUp)) : 'not yet') + '</li>' +
        (stt.lastErr ? '<li>Last problem: ' + esc(stt.lastErr) + ' (it will retry)</li>' : '') + '<li>Uploads by itself at most every 30 minutes.</li></ul>';
      items.push({ label: 'Upload now', disabled: !avail, reason: 'Offline or no worker', act: function () {
        App().toast('Uploading...');
        C.upload(s).then(function () { App().toast('Cloud save updated'); refresh(); }, function (e) { App().toast('Cloud save: ' + e.message); refresh(); });
      } });
      items.push({ label: 'Show recovery code', sub: 'You need it to restore on another device', act: function () { push(cloudCodeScreen(stt.code, false)); } });
    } else {
      items.push({ label: 'Turn on cloud save', sub: 'Makes a recovery code for you', disabled: !avail, reason: 'Needs the online game and a worker', act: function () { push(cloudEnable); } });
    }
    items.push({ label: 'Restore from cloud', sub: 'Enter a recovery code', disabled: !avail, reason: 'Offline or no worker', act: function () { push(cloudRestore); } });
    if (stt.on) {
      items.push({ label: 'Delete cloud copy', sub: 'Removes it from the server', act: function () { push(confirmScreen('Delete cloud copy?', 'The encrypted copy on the server is deleted. Your game on this device stays.', function () {
        C.remove().then(function () { C.forget(); s.settings.cloud = false; App().save(); App().toast('Cloud copy deleted'); pop(); refresh(); }, function (e) { App().toast('Could not delete: ' + e.message); pop(); });
      })); } });
      items.push({ label: 'Turn off on this device', sub: 'Stops uploads and forgets the code here', act: function () { push(confirmScreen('Turn cloud save off?', 'This device forgets the recovery code and stops uploading. The cloud copy stays until it expires (400 days) unless you delete it first.', function () { C.forget(); s.settings.cloud = false; App().save(); pop(); refresh(); })); } });
    }
    items.push({ label: 'Back', act: pop });
    return { title: 'CLOUD SAVE', html: h, items: items };
  }
  function cloudEnable() {
    return { title: 'CLOUD SAVE: TURN ON', html: '<p>Optional passphrase (adds a second lock; you will need it to restore):</p><input id="cloudPass" type="password" maxlength="64" autocomplete="new-password" aria-label="Optional passphrase">' +
      '<p class="tip">Next you get a recovery code. It is shown once here (and again in this menu on this device). Write it down: without it nobody can restore the cloud copy, not even the server owner.</p>', live: false, items: [
      { label: 'Make my code', act: function () {
        var pass = (document.getElementById('cloudPass') || {}).value || '', s = st();
        var code = PP.CloudSync.enable(pass); s.settings.cloud = true; App().save();
        PP.CloudSync.upload(s).then(function () { App().toast('First cloud save uploaded'); }, function (e) { App().toast('Cloud save: ' + e.message + ' (will retry)'); });
        replace(cloudCodeScreen(code, true));
      } },
      { label: 'Cancel', act: pop }] };
  }
  function cloudCodeScreen(code, fresh) {
    return function () {
      return { title: 'YOUR RECOVERY CODE', html: (fresh ? '<p class="warn"><b>Write this down now.</b></p>' : '') + '<p class="rcode" aria-label="Recovery code">' + esc(code) + '</p>' +
        '<textarea class="code" readonly rows="1" aria-label="Recovery code to copy">' + esc(code) + '</textarea><p class="tip">Use it in Settings \u25b8 Cloud save \u25b8 Restore on any device. Keep it private: anyone with it (and your passphrase) can read your save.</p>',
        items: [{ label: 'Copy code', act: function () { copyText(code); } }, { label: 'Done', act: pop }] };
    };
  }
  function cloudRestore() {
    return { title: 'RESTORE FROM CLOUD', html: '<p>Recovery code:</p><input id="cloudCode" maxlength="40" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Recovery code" placeholder="XXXX-XXXX-...">' +
      '<p>Passphrase (if you set one):</p><input id="cloudPass2" type="password" maxlength="64" autocomplete="current-password" aria-label="Passphrase">', live: false, items: [
      { label: 'Find my save', act: function () {
        var code = (document.getElementById('cloudCode') || {}).value || '', pass = (document.getElementById('cloudPass2') || {}).value || '';
        App().toast('Looking...');
        PP.CloudSync.download(code, pass).then(function (r) {
          if (!r.ok) { App().toast(r.error); return; }
          push(importConfirm(r, function () { PP.CloudSync.setCreds({ code: PP.Cloud.format(code), pass: pass, lastUp: Date.now() }); st().settings.cloud = true; App().save(); }));
        }, function (e) { PP.Audio.play('no'); App().toast(e.message); });
      } },
      { label: 'Cancel', act: pop }] };
  }
  function pickFile() {
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.json,text/plain,application/json';
    inp.addEventListener('change', function () {
      var f = inp.files && inp.files[0]; if (!f) return;
      if (f.size > 2e6) { App().toast('That file is too big to be a save'); return; }
      var rd = new FileReader();
      rd.onload = function () { checkImport(String(rd.result || '')); };
      rd.onerror = function () { App().toast('Could not read that file'); };
      rd.readAsText(f);
    });
    inp.click();
  }
  function exportScreen() {
    var code = PP.Save.exportCode(st(), Date.now()), m = /^PP2SAVE-(\d+)-(\d+)-([0-9a-f]{8})-/.exec(code);
    return { title: 'EXPORT SAVE CODE', html: '<p>Copy this code and paste it into <b>Import save code</b> on your other device. Checksum <b>' + m[3].toUpperCase() + '</b> \u00b7 ' + code.length + ' characters.</p>' +
      '<textarea class="code" readonly rows="4" aria-label="Save code">' + esc(code) + '</textarea>', items: [
      { label: 'Copy', act: function () { copyText(code); App().markExported(); } }, { label: 'File', act: downloadCode }, { label: 'Back', act: pop }] };
  }
  function importScreen() {
    return { title: 'IMPORT SAVE CODE', html: '<p>Paste a save code from another PocketPal device. You will see what is inside before anything changes.</p><textarea id="saveIn" class="code" rows="4" aria-label="Save code to import" placeholder="PP2SAVE-1-..."></textarea>', items: [
      { label: 'Check', act: function () { checkImport((document.getElementById('saveIn') || {}).value || ''); } },
      { label: 'Cancel', act: pop }] };
  }
  function checkImport(text) {
    var r = PP.Save.importCode(text, Date.now());
    if (!r.ok) { PP.Audio.play('no'); App().toast(r.error); return; }
    push(importConfirm(r));
  }
  function importConfirm(r, after) {
    return function () {
      var mine = st().slots.filter(Boolean).length, info = r.info;
      return { title: 'REPLACE YOUR GAME?', html: '<p>The code is valid. It contains:</p><ul class="away">' +
        (info.pals.length ? info.pals.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') : '<li>No pals yet</li>') +
        '<li>' + info.album + ' album entries \u00b7 ' + info.dex + '/' + DEX_ADULTS + ' Paldex adults</li>' + (info.savedAt ? '<li>Saved ' + esc(tDate(info.savedAt)) + '</li>' : '') + '</ul>' +
        '<p class="tip">This REPLACES your current game (' + mine + ' pal' + (mine === 1 ? '' : 's') + '). A copy of it is kept in case you change your mind.</p>',
        items: [
          { label: 'Yes, replace', act: function () { App().importState(r.state); if (after) after(); App().toast('Save imported - welcome back!'); close(); } },
          { label: 'Cancel', act: pop }] };
    };
  }
  function helpScreen() {
    return { title: 'HOW TO PLAY', html:
      '<p><b>A</b> picks an icon / next item, <b>B</b> chooses, <b>C</b> goes back. You can also tap the icons and menu items. Keys: A S D (or arrows, Enter, Esc).</p>' +
      '<p>Feed meals when hunger drops, play or snack for happiness, clean poop, give medicine when sick (teens/adults need 2 doses), and turn the lights off when your pal falls asleep.</p>' +
      '<p>A call you ignore for 30 min is a <b>care mistake</b>. So are overfed snacks, leaving poop 2h, sickness 3h, or lights on 1h after bedtime.</p>' +
      '<p>Tantrums: sometimes your pal calls for no reason. Scold during a tantrum for +25% discipline. Praise after training or a refused meal.</p>' +
      '<p>Egg 5 min \u2192 Baby 2h \u2192 Child 36h \u2192 Teen 60h \u2192 Adult (~4 days). Few mistakes, good mood, discipline and training give a Champion. Adults battle, level up, learn skills and breed.</p>' +
      '<p>When the <b>!</b> flashes (status strip, row 2), your pal needs something: the bubble next to it shows what.</p>' +
      '<p><b>The sky shows your pal\u2019s mood:</b> sunny when it is very happy and well cared for (a rainbow if it was raining just before), clouds when it is okay, grey then rain when it is sad or hungry, drizzle when it is sick, and a storm with lightning when it is badly neglected. Snowy days still come now and then.</p>' +
      '<p>Lights: turn them off when your pal falls asleep. Lights on wakes a nap, or wakes it after its wake time. In sleep hours it stays asleep until its wake time.</p>' +
      '<p>Paldex: raise all 18 adult forms. Milestones and arena cups unlock special shell colours (MENU \u25b8 Shell colour).</p><p><b>Screen icons</b></p>' + legendHtml(), items: [{ label: 'Open the guide', act: function () { replace(guideScreen(0)); } }, { label: 'Back', act: pop }] };
  }

  /* 1.9.1 morning report card */
  function reportCard(card) {
    return function () {
      var p = pet(), s = st(), d = PP.Daily.today(s, PP.Game.now(s));
      var goals = d && d.goals && d.goals.length ? '<li>Today\u2019s goals: ' + d.goals.map(function (g) { return esc(PP.Daily.text(g)) + (g.done ? ' \u2713' : ''); }).join(' \u00b7 ') + '</li>' : '';
      return { title: PP.Time.greeting(PP.Time.minuteOfDay(PP.Game.now(s))).toUpperCase() + '!', html: (p ? '<div class="vs">' + thumb(p.species, S.stageKeyOf(p), 'happy', 30) + '</div>' : '') +
        '<p class="grade">Night grade: <b>' + card.grade + '</b> \u2013 ' + esc(card.note) + '</p><ul class="away">' +
        '<li>Slept ' + card.hours + ' h</li><li>Lights off ' + card.darkPct + '% of the night</li>' +
        '<li>' + (card.mistakes ? card.mistakes + ' care mistake' + (card.mistakes === 1 ? '' : 's') + ' overnight' : 'No care mistakes overnight') + '</li>' + goals + '</ul>',
        items: [{ label: 'OK', act: close }] };
    };
  }
  function awaySummary(info) {
    return function () {
      var lines = info.lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('');
      var since = info.since ? ' (since ' + esc(tDate(info.since)) + ')' : '';
      return { title: 'WHILE YOU WERE AWAY', html: '<p>You were gone ' + PP.Time.duration(info.minutes) + since + '.</p><ul class="away">' + lines + '</ul>', items: [{ label: 'OK', act: close }] };
    };
  }
  function battleResult(out, B) {
    return function () {
      var p = pet(), won = out.won, A = PP.Arena, rank = B && B.meta ? B.meta.rank : 0, h, title = 'BATTLE OVER';
      var celebrate = out.firstClear ? (out.myth ? 'MYTH CUP CLEARED!' : out.cup.toUpperCase() + ' CLEARED!') : null;
      if (out.fled) {   // 1.8.4 run / forfeit
        title = out.fled === 'escaped' ? 'GOT AWAY' : 'FORFEIT';
        h = '<div class="vs">' + thumb(p.species, S.stageKeyOf(p), out.fled === 'escaped' ? 'idle' : 'sad', 30) + '</div><ul class="away">' +
          (out.fled === 'escaped' ? '<li>' + esc(p.name) + ' ran away safely.</li>' : out.kind === 'arena' ? '<li>The ' + esc(out.cup) + ' run is over - it counts as a loss.</li><li>No injury.</li>' : '<li>You forfeited - it counts as a loss.</li>') +
          '<li>No XP or coins. Half the battle energy came back (+' + Math.floor(D.RULES.costs.battle / 2) + ').</li></ul>';
      } else {
        h = (celebrate ? '<div class="cupclear" role="status">\u2605 ' + esc(celebrate) + ' \u2605</div>' : '') +
          '<div class="vs">' + thumb(p.species, S.stageKeyOf(p), won ? 'happy' : 'sad', 30) + '</div><p><b>' + (won ? 'VICTORY!' : 'Defeat...') + '</b></p><ul class="away">' +
          (out.kind === 'arena' ? '<li>' + esc(out.cup) + ': foe ' + out.foe + '/' + out.foes + (won ? (out.cleared ? ' - cup ' + (out.firstClear ? 'cleared!' : 'cleared again') : ' beaten') : ' - run over') + '</li>' : '') +
          '<li>+' + out.xp + ' XP' + (out.levels ? ' \u00b7 LEVEL UP \u2192 Lv ' + p.level + ' (+' + out.levels + ' SP)' : '') + '</li>' +
          '<li>Happy ' + (won ? '+1' : '-1') + ', weight -1g</li>' +
          (out.unlocked ? '<li>Unlocked: <b>' + esc(out.unlocked) + '</b></li>' : '') +
          (out.shells && out.shells.length ? '<li>New shell colour: <b>' + esc(out.shells.join(', ')) + '</b>!</li>' : '') +
          (out.coins ? '<li>+' + out.coins + ' coins' + (out.capped ? ' (daily battle coin cap reached)' : '') + '</li>' : out.capped ? '<li>Daily coin cap reached - more tomorrow</li>' : '') +
          (out.visitor ? '<li>You beat the visitor! +' + PP.Daily.VISITOR_BONUS + ' bonus coins</li>' : '') +
          (out.injured ? '<li>Got hurt and is now sick! Give medicine.</li>' : '') + '</ul>';
      }
      var nextFoe = out.kind === 'arena' && won && !out.cleared && !out.fled;
      function ok() { close(); if (celebrate) App().celebrate(celebrate); }
      return { title: title, html: h, items: [
        out.levels && p.sp ? { label: 'Spend skill points', act: function () { replace(skillsScreen); if (celebrate) App().celebrate(celebrate); } } : null,
        nextFoe ? { label: 'Next foe (' + out.next + '/' + out.foes + ')', sub: A.foe(rank, out.next - 1).name + ' \u00b7 ' + ROLE[A.foe(rank, out.next - 1).role], disabled: !!G.canBattle(p), reason: G.canBattle(p),
          act: function () { close(); App().startArena(rank); } } : null,
        { label: 'OK', act: ok }].filter(Boolean) };
    };
  }
  function fateScreen() {
    var s = st(), p = pet();
    if (!p || !p.fate) return null;
    var others = s.slots.map(function (q, i) { return { q: q, i: i }; }).filter(function (o) { return o.q && !o.q.fate; });
    var items = others.map(function (o) { return { icon: thumb(o.q.species, S.stageKeyOf(o.q), 'idle', 15), label: 'Take out ' + o.q.name, sub: slotLine(o.q), act: function () { G.setActive(s, o.i, Date.now()); App().resetWalker(); App().save(); close(); } }; });
    items.push({ label: 'Start a new egg', sub: p.name + ' moves to the album', act: function () {
      push(speciesPicker(function (sp) { G.release(s, s.active); var r = G.startEgg(s, sp, Date.now()); if (r.ok) G.setActive(s, r.slot, Date.now()); App().resetWalker(); App().save(); close(); }));
    } });
    return { title: p.fate === 'dead' ? 'GOODBYE, ' + p.name.toUpperCase() : p.name.toUpperCase() + ' LEFT', html: '<p>' + (p.fate === 'dead' ? esc(p.name) + ' passed away (' + esc(p.fateCause || '') + ').' : esc(p.name) + ' ran away after being unhappy and undisciplined for too long.') + '</p><p class="tip">' + (p.hard ? 'This was a hard-mode pal: it cannot be revived, but its memory stays in your Album.' : 'Care mistakes are counted, but pals only die or leave after long neglect.') + '</p>', items: items };
  }

  PP.UI = { init: init, open: open, push: push, pop: pop, close: close, replace: replace, refresh: refresh, isOpen: isOpen, input: input,
    top: function () { return cur; },
    screens: { mainMenu: mainMenu, aboutScreen: aboutScreen, alertsScreen: alertsScreen, statusScreen: statusScreen, feedMenu: feedMenu, trainMenu: trainMenu, discMenu: discMenu, battleMenu: battleMenu, arenaScreen: arenaScreen,
      skillsScreen: skillsScreen, palBox: palBox, breedScreen: breedScreen, albumScreen: albumScreen, settingsScreen: settingsScreen, helpScreen: helpScreen,
      speciesPicker: speciesPicker, awaySummary: awaySummary, reportCard: reportCard, battleResult: battleResult, fateScreen: fateScreen, confirmScreen: confirmScreen, addCodeScreen: addCodeScreen, myCodeScreen: myCodeScreen,
      arenaPreview: arenaPreview, friendsScreen: friendsScreen, friendMenu: friendMenu, slotMenu: slotMenu, treeScreen: treeScreen,
      renameScreen: renameScreen, sleepScreen: sleepScreen, exportScreen: exportScreen, importScreen: importScreen,
      storeScreen: storeScreen, storeFood: storeList('care'), storeBoosts: storeList('boost'), storeShells: storeShells, bagScreen: bagScreen, medMenu: medMenu,
      paldexScreen: paldexScreen, dexEntry: dexEntry, dailyScreen: dailyScreen, backupReminder: backupReminder, cloudScreen: cloudScreen, cloudRestore: cloudRestore, hardWarning: hardWarning, shellScreen: shellScreen, guideScreen: guideScreen, iconsScreen: iconsScreen, STRIP_LEGEND: STRIP_LEGEND, transferScreen: transferScreen, importConfirm: importConfirm },
    GUIDE_PAGES: GUIDE.length,
    esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
