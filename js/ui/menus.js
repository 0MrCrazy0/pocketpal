/* PocketPal 2 - LCD menu overlays. A tiny screen stack: each screen is a function
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
  var FORM_LABEL = { bad: 'Scrappy', good: 'Solid', perfect: 'Champion' };

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
      { label: 'Skills', sub: 'Skill tree (adults)', act: function () { push(skillsScreen); } },
      { label: 'Paldex', sub: c.adults + '/18 adult forms \u00b7 ' + c.total + '/36 in all', right: c.adults + '/18', act: function () { push(paldexScreen(0)); } },
      { label: 'Shell colour', sub: 'Repaint your handheld', act: openShells },
      { label: 'Pal Store', sub: 'Treats, boosts, colours, extra slots', right: PP.Shop.coins(st()) + 'c', act: function () { push(storeScreen); } },
      { label: 'Bag', sub: 'Items you bought', right: String(PP.Shop.owned(st()).reduce(function (n, id) { return n + PP.Shop.count(st(), id); }, 0)), act: function () { push(bagScreen); } },
      { label: 'Pal Box', sub: 'Your ' + st().slots.length + ' slots, new egg', act: function () { push(palBox); } },
      { label: 'Breeding', sub: 'Make an egg with a mate', act: function () { push(breedScreen); } },
      { label: 'Album', sub: 'Every pal you raised + family trees', act: function () { push(albumScreen); } },
      { label: 'Settings', sub: 'Sound, alerts, save transfer', act: function () { push(settingsScreen); } },
      { label: 'Guide', sub: 'Buttons, icons and the goal', act: function () { push(guideScreen(0)); } },
      { label: 'How to play', sub: 'All the rules on one page', act: function () { push(helpScreen); } },
      { label: 'About', sub: 'Version ' + D.VERSION + ', privacy', act: function () { push(aboutScreen); } }
    ] };
  }

  /* ------------------------------------------------------------ Paldex */
  var DEX_TAG = { baby: 'Baby', child: 'Child', teen: 'Teen', bad: 'Scrappy', good: 'Solid', perfect: 'Champion' };
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
        var skey = k === 'bad' || k === 'good' || k === 'perfect' ? 'adult_' + k : k;
        return { cell: true, cls: 'dex', icon: thumb(sp, skey, 'idle', 17, raised ? '' : seen ? 'dim' : 'sil'),
          label: raised || seen ? D.NAMES[sp][k] : '???', sub: raised ? DEX_TAG[k] : seen ? 'seen' : DEX_TAG[k],
          act: function () { push(dexEntry(sp, k)); } };
      });
      items.push({ label: '\u25b6 Next animal', act: function () { replace(paldexScreen(si + 1)); } });
      items.push({ label: '\u25c0 Previous animal', act: function () { replace(paldexScreen(si - 1)); } });
      items.push({ label: 'Back', act: pop });
      return { title: 'PALDEX \u00b7 ' + D.SPECIES_INFO[sp].label.toUpperCase() + ' ' + c.perSpecies[sp] + '/6',
        html: '<div class="dex-sum"><span>Adults <b>' + c.adults + '/18</b></span><span>All <b>' + c.total + '/36</b></span></div><p class="tip">' + esc(nextDexReward(s)) + '</p>',
        items: items, detail: function (i) {
          var k = keys[i]; if (!k) return i === keys.length ? 'Show the next animal' : i === keys.length + 1 ? 'Show the previous animal' : 'Back to the menu';
          var e = PP.Collection.get(s, sp, k) || {};
          return '<b>' + esc(e.r || e.s ? D.NAMES[sp][k] : '???') + '</b> \u00b7 ' + DEX_TAG[k] + (e.r ? ' \u00b7 <i>raised</i>' : e.s ? ' \u00b7 <i>seen in battle</i>' : '') + '<br>' + esc(PP.Collection.hint(sp, k));
        } };
    };
  }
  function dexEntry(sp, k) {
    return function () {
      var e = PP.Collection.get(st(), sp, k) || {}, known = e.r || e.s;
      var skey = k === 'bad' || k === 'good' || k === 'perfect' ? 'adult_' + k : k;
      return { title: known ? D.NAMES[sp][k].toUpperCase() : '???', html: '<div class="vs">' + thumb(sp, skey, known ? 'happy' : 'idle', 40, e.r ? '' : e.s ? 'dim' : 'sil') + '</div>' +
        '<p><b>' + esc(D.SPECIES_INFO[sp].label) + ' \u00b7 ' + DEX_TAG[k] + '</b>' + (e.r ? ' \u00b7 raised ' + new Date(e.r).toLocaleDateString() : e.s ? ' \u00b7 seen, not raised yet' : ' \u00b7 not found yet') + '</p>' +
        '<p class="tip">How to get it: ' + esc(PP.Collection.hint(sp, k)) + '</p>', items: [{ label: 'Back', act: pop }] };
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

  /* ------------------------------------------------------------ first-run guide */
  var GUIDE = [
    { t: 'WELCOME TO POCKETPAL 2', h: function () {
      return '<div class="guide-art">' + ['egg', 'baby', 'teen', 'adult_perfect'].map(function (k) { return thumb('lion', k, 'idle', 22); }).join('') + '</div>' +
        '<p>Hatch an egg and look after your pal. It grows from <b>egg \u2192 baby \u2192 child \u2192 teen \u2192 adult</b> in about 4 days of real time.</p>' +
        '<p><b>The goal:</b> how well you care decides which of <b>3 adult forms</b> it becomes. Then battle, learn skills and breed!</p>'; } },
    { t: 'THE THREE BUTTONS', hl: ['.btns'], h: function () {
      return '<ul class="glist"><li><span class="gbtn">A</span><span><b>A = next.</b> Moves to the next icon or menu item.</span></li>' +
        '<li><span class="gbtn b">B</span><span><b>B = choose.</b> Opens the icon or picks the item.</span></li>' +
        '<li><span class="gbtn c">C</span><span><b>C = back.</b> Closes menus. In battle: auto-fight.</span></li></ul>' +
        '<p class="tip">You can also tap icons and menu items. Keyboard: A S D, arrows, Enter, Esc.</p>'; } },
    { t: 'CARE ICONS 1/2', hl: ['.icon[style="--i:0"]', '.icon[style="--i:1"]', '.icon[style="--i:2"]', '.icon[style="--i:3"]'], h: function () {
      return '<ul class="glist"><li><span class="gicon" style="--i:0"></span><span><b>Status / menu:</b> hunger, happiness, care score, everything else.</span></li>' +
        '<li><span class="gicon" style="--i:1"></span><span><b>Feed:</b> meals fill hunger, snacks add happiness (not too many!).</span></li>' +
        '<li><span class="gicon" style="--i:2"></span><span><b>Train &amp; play:</b> mini-games for happiness, discipline and XP.</span></li>' +
        '<li><span class="gicon" style="--i:3"></span><span><b>Clean:</b> flush the poop away.</span></li></ul>'; } },
    { t: 'CARE ICONS 2/2', hl: ['.icon[style="--i:4"]', '.icon[style="--i:5"]', '.icon[style="--i:6"]', '.icon[style="--i:7"]'], h: function () {
      return '<ul class="glist"><li><span class="gicon" style="--i:4"></span><span><b>Medicine:</b> when the skull shows, your pal is sick.</span></li>' +
        '<li><span class="gicon" style="--i:5"></span><span><b>Lights:</b> switch off when it falls asleep.</span></li>' +
        '<li><span class="gicon" style="--i:6"></span><span><b>Battle:</b> arena and friend battles (adults).</span></li>' +
        '<li><span class="gicon" style="--i:7"></span><span><b>Discipline:</b> Scold a tantrum, or Praise after training / a refused meal.</span></li></ul>'; } },
    { t: 'WHEN YOUR PAL CALLS', h: function () {
      return '<p>A flashing <b>!</b> in the top-right corner means your pal needs you. A speech bubble shows <b>what</b> it wants, the matching icon glows, and it beeps (if sound is on).</p>' +
        '<p>Answer within <b>30 minutes</b>. An ignored call, overfeeding, poop left 2 h or lights left on count as <b>care mistakes</b>.</p>'; } },
    { t: 'GROWING UP', h: function () {
      return '<div class="guide-art">' + ['adult_bad', 'adult_good', 'adult_perfect'].map(function (k) { return thumb('wolf', k, 'idle', 26); }).join('') + '</div>' +
        '<p><b>Scrappy</b> (poor care) \u00b7 <b>Solid</b> (good care) \u00b7 <b>Champion</b> (max 2 mistakes, happy, disciplined, trained).</p>' +
        '<p class="tip">Status shows your care score and which form you are on track for.</p>'; } },
    { t: 'ADULT LIFE', hl: ['#menuBtn'], h: function () {
      return '<p><b>Battle</b> the 12-cup arena or friends (battle codes). Wins give XP and skill points for your animal\'s <b>skill tree</b>.</p>' +
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
          '<tr><td>Weight</td><td>' + p.weight + 'g' + (PP.Care.isOverweight(p) ? ' (heavy)' : PP.Care.isUnderweight(p) ? ' (skinny)' : '') + '</td></tr>' +
          (next != null && p.stage !== 'egg' ? '<tr><td>Grows in</td><td>' + hm(next) + '</td></tr>' : '') +
          (p.stage !== 'egg' ? '<tr><td>Sleeps</td><td>' + schedText(PP.Sleep.of(p)) + (p.sched ? '' : ' (default)') + '</td></tr>' : '') +
          '<tr><td>Status</td><td>' + (p.fate ? esc(p.fateCause || p.fate) : p.asleep ? (p.sleepKind === 'nap' ? 'Napping' : 'Asleep') + (p.lights ? ' (lights ON!)' : '') : p.fake ? 'Tantrum!' : 'Awake') + '</td></tr>' +
          '</table>';
      } else if (pg === 'report') {
        var f = PP.Evolution.forecast(p), score = PP.Evolution.careScore(p);
        h = '<table class="kv"><tr><td>Care mistakes</td><td>' + p.mistakes + '</td></tr>' +
          '<tr><td>Care score</td><td>' + score + '</td></tr>' +
          '<tr><td>Trainings</td><td>' + p.evo.trainings + '</td></tr>' +
          (f ? '<tr><td>On track for</td><td><b>' + FORM_LABEL[f] + '</b> (' + esc(D.NAMES[p.species][f]) + ')</td></tr>' : '') +
          '</table><p class="tip">Champion: \u2264' + D.EVO.perfect.maxMistakes + ' mistakes, score \u2265' + D.EVO.perfect.minScore + ', discipline \u2265' + D.EVO.perfect.minDiscipline +
          '%. Solid: score \u2265' + D.EVO.good.minScore + '.</p>' +
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
      { label: 'Meal', sub: 'Hunger +1, weight +1g (free)', act: function () { App().doAct('meal'); } },
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
      { label: 'Left or Right?', sub: '-' + R.costs.game + ' energy. Win: happy +2', disabled: !b.ok, reason: b.msg, act: function () { close(); App().startMini('game'); } },
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
      { label: 'Arena', sub: 'Computer ladder, 12 cups', disabled: !!why, reason: why, act: function () { push(arenaScreen); } },
      { label: 'Friend battle', sub: 'Fight a pal from a battle code', disabled: !!why, reason: why, act: function () { push(friendsScreen); } },
      { label: 'My battle code', sub: 'Share your pal', disabled: !p || p.stage !== 'adult', reason: 'Only adults have a battle card', act: function () { push(myCodeScreen); } },
      { label: 'Add friend code', sub: 'Paste a code (battle or breed)', act: function () { push(addCodeScreen); } }
    ];
    if (PP.Net && PP.Net.enabled()) items.push({ label: 'Online code relay', sub: 'Short codes via your server', act: function () { push(PP.Net.screen()); } });
    return { title: 'BATTLE', html: why ? '<p class="tip">' + esc(why) + '</p>' : '', items: items };
  }
  function arenaScreen() {
    var s = st(), p = pet();
    var items = D.ARENA.map(function (cup, i) {
      var won = i < s.arena.rank || (i === D.ARENA.length - 1 && s.arena.champion);
      var locked = i > s.arena.rank;
      return { label: cup.name, sub: 'Lv ~' + cup.lv + ' \u00b7 ' + FORM_LABEL[cup.form] + ' foes', right: won ? '\u2605' : locked ? 'LOCK' : 'NEXT',
        disabled: locked, reason: 'Win the ' + (D.ARENA[i - 1] || {}).name + ' first', act: function () { push(arenaPreview(i)); } };
    });
    return { title: 'ARENA' + (s.arena.champion ? ' \u2605 CHAMPION' : ''), html: p ? '<p>Your BP: <b>' + PP.Stats.bp(PP.Stats.battleStats(p)) + '</b></p>' : '', items: items };
  }
  function arenaPreview(rank) {
    return function () {
      var s = st(), p = pet(), opp = PP.Arena.opponent(rank, s.arena.attempt, s.seed), of = PP.Battle.fighter(opp);
      var mine = PP.Battle.fighter(p);
      return { title: D.ARENA[rank].name.toUpperCase(), html:
        '<div class="vs">' + thumb(p.species, S.stageKeyOf(p), 'idle', 30) + '<b>VS</b><span class="flip">' + thumb(opp.species, 'adult_' + opp.form, 'angry', 30) + '</span></div>' +
        '<p><b>' + esc(opp.name) + '</b> the ' + esc(D.NAMES[opp.species][opp.form]) + '<br>Lv ' + opp.level + ' \u00b7 BP ' + of.bp + ' (you: ' + mine.bp + ')</p>',
        items: [
          { label: 'FIGHT!', act: function () { close(); App().startArena(rank); } },
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
      ].concat(navigator.share ? [{ label: 'Share\u2026', act: function () { navigator.share({ title: 'PocketPal 2 battle code', text: code }).catch(function () {}); } }] : []) };
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
    return { title: 'ADD FRIEND CODE', html: '<p>Paste a PocketPal 2 battle code:</p><textarea id="codeIn" class="code" rows="4" placeholder="PP2-..." aria-label="Friend code"></textarea>',
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
    return PP.Pet.formName(p) + ' \u00b7 ' + (p.stage === 'adult' ? FORM_LABEL[p.form] + ' Lv' + p.level : p.stage) + (p.fate ? ' \u00b7 ' + (p.fate === 'dead' ? 'R.I.P.' : 'gone') : '');
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
      if (p.fate && p.fate !== 'released') items.push({ label: 'Revive', sub: 'Costs ' + G.reviveCost(p) + ' coins', right: G.reviveCost(p) + 'c', act: function () {
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
      var items = D.SPECIES.map(function (sp) {
        var info = D.SPECIES_INFO[sp];
        return { icon: thumb(sp, 'adult_good', 'idle', 20), label: info.label, sub: info.blurb, act: function () { onPick(sp); } };
      });
      items.push({ label: 'Surprise me', sub: 'Random egg', act: function () { onPick(D.SPECIES[Math.floor(Math.random() * D.SPECIES.length)]); } });
      return { title: title || 'CHOOSE AN EGG', items: items };
    };
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
        sub: D.NAMES[e.species][e.stage === 'adult' ? e.form : e.stage] + (e.level ? ' Lv' + e.level : '') + (e.fate ? ' \u00b7 ' + e.fate : ''), act: function () { push(treeScreen(e.id)); } };
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
      { label: 'Clock', right: s.settings.clock === '24' ? '24-hour' : '12-hour', sub: 'Show times as ' + (s.settings.clock === '24' ? '21:30' : '9:30 pm'),
        act: function () { s.settings.clock = s.settings.clock === '24' ? '12' : '24'; App().save(); refresh(); } },
      { label: 'Sleep schedule', sub: p && p.stage !== 'egg' && !p.fate ? p.name + ': ' + schedText(PP.Sleep.of(p)) : 'Bedtime and wake time for your pal',
        disabled: !p || !!p.fate || p.stage === 'egg', reason: p && p.stage === 'egg' ? 'Eggs do not have a bedtime yet' : 'No pal', act: function () { push(sleepScreen()); } },
      { label: 'Shell colour', sub: 'Repaint your handheld', right: PP.Collection.shell(s.settings.shell).name, act: openShells },
      { label: 'Background alerts', right: s.settings.notify ? 'ON' : 'OFF', sub: canNotify ? 'Notify me when my pal calls while this tab is in the background' : 'Not supported by this browser',
        disabled: !canNotify, reason: 'Notifications are not supported here', act: function () { App().toggleNotify(); } },
      { label: 'Guide', sub: 'Show the first-run walkthrough again', act: function () { push(guideScreen(0)); } },
      { label: 'About', sub: 'Version ' + D.VERSION + ', privacy', act: function () { push(aboutScreen); } },
      App().testAllowed && { label: 'Test mode', right: s.settings.test ? 'ON' : 'OFF', sub: 'Dev panel: speed up time, jump stages', act: function () { App().setTestMode(!s.settings.test); refresh(); } },
      { label: 'Rename pal', disabled: !p || !!p.fate, reason: 'No pal', act: function () { push(renameScreen); } },
      { label: 'Save transfer', sub: 'Move your game to another device', act: function () { push(transferScreen); } },
      { label: 'Reset everything', sub: 'Deletes all pals', act: function () { push(confirmScreen('Delete ALL pals?', 'Your whole PocketPal 2 save will be wiped.', function () {
        replace(confirmScreen('Really sure?', 'There is no undo.', function () { App().resetAll(); close(); }));
      })); } },
      { label: 'Back', act: pop }
    ].filter(Boolean) };
  }
  function aboutScreen() {
    var saving = App().storageMode === 'local' ? 'Saved in this browser only' : 'OFF - storage is blocked here, progress ends with this tab';
    var online = PP.Net && PP.Net.enabled() ? 'Optional code relay is set up by this site' : 'None - everything runs on your device';
    return { title: 'ABOUT', html: '<p><b>PocketPal 2</b> v' + esc(D.VERSION) + '</p>' +
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
      { label: 'Load from a file', sub: 'Pick a saved .txt file', act: function () { pickFile(); } },
      { label: 'Back', act: pop }
    ] };
  }
  function downloadCode() {
    var code = PP.Save.exportCode(st(), Date.now());
    try {
      var a = document.createElement('a'), d = new Date();
      a.href = URL.createObjectURL(new Blob([code + '\n'], { type: 'text/plain' }));
      a.download = 'pocketpal2-save-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '.txt';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      App().toast('Save file downloaded');
    } catch (e) { App().toast('Download not possible here - use Export save code'); }
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
      { label: 'Copy', act: function () { copyText(code); } }, { label: 'File', act: downloadCode }, { label: 'Back', act: pop }] };
  }
  function importScreen() {
    return { title: 'IMPORT SAVE CODE', html: '<p>Paste a save code (starts with PP2SAVE-). You will see what is inside before anything changes.</p><textarea id="saveIn" class="code" rows="4" aria-label="Save code to import" placeholder="PP2SAVE-1-..."></textarea>', items: [
      { label: 'Check', act: function () { checkImport((document.getElementById('saveIn') || {}).value || ''); } },
      { label: 'Cancel', act: pop }] };
  }
  function checkImport(text) {
    var r = PP.Save.importCode(text, Date.now());
    if (!r.ok) { PP.Audio.play('no'); App().toast(r.error); return; }
    push(importConfirm(r));
  }
  function importConfirm(r) {
    return function () {
      var mine = st().slots.filter(Boolean).length, info = r.info;
      return { title: 'REPLACE YOUR GAME?', html: '<p>The code is valid. It contains:</p><ul class="away">' +
        (info.pals.length ? info.pals.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') : '<li>No pals yet</li>') +
        '<li>' + info.album + ' album entries \u00b7 ' + info.dex + '/18 Paldex adults</li>' + (info.savedAt ? '<li>Saved ' + esc(tDate(info.savedAt)) + '</li>' : '') + '</ul>' +
        '<p class="tip">This REPLACES your current game (' + mine + ' pal' + (mine === 1 ? '' : 's') + '). A copy of it is kept in case you change your mind.</p>',
        items: [
          { label: 'Yes, replace', act: function () { App().importState(r.state); App().toast('Save imported - welcome back!'); close(); } },
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
      '<p>When the <b>!</b> flashes (top right), your pal needs something: the bubble next to it shows what.</p>' +
      '<p>Paldex: raise all 18 adult forms. Milestones and arena cups unlock special shell colours (MENU \u25b8 Shell colour).</p>', items: [{ label: 'Open the guide', act: function () { replace(guideScreen(0)); } }, { label: 'Back', act: pop }] };
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
      var p = pet(), won = out.won;
      var h = '<div class="vs">' + thumb(p.species, S.stageKeyOf(p), won ? 'happy' : 'sad', 30) + '</div><p><b>' + (won ? 'VICTORY!' : 'Defeat...') + '</b></p><ul class="away">' +
        '<li>+' + out.xp + ' XP' + (out.levels ? ' \u00b7 LEVEL UP \u2192 Lv ' + p.level + ' (+' + out.levels + ' SP)' : '') + '</li>' +
        '<li>Happy ' + (won ? '+1' : '-1') + ', weight -1g</li>' +
        (out.unlocked ? '<li>Unlocked: <b>' + esc(out.unlocked) + '</b></li>' : '') +
        (out.shells && out.shells.length ? '<li>New shell colour: <b>' + esc(out.shells.join(', ')) + '</b>!</li>' : '') +
        (out.coins ? '<li>+' + out.coins + ' coins' + (out.capped ? ' (daily battle coin cap reached)' : '') + '</li>' : out.capped ? '<li>Daily coin cap reached - more tomorrow</li>' : '') +
        (out.injured ? '<li>Got hurt and is now sick! Give medicine.</li>' : '') + '</ul>';
      return { title: 'BATTLE OVER', html: h, items: [
        out.levels && p.sp ? { label: 'Spend skill points', act: function () { replace(skillsScreen); } } : null,
        { label: 'OK', act: close }].filter(Boolean) };
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
    return { title: p.fate === 'dead' ? 'GOODBYE, ' + p.name.toUpperCase() : p.name.toUpperCase() + ' LEFT', html: '<p>' + (p.fate === 'dead' ? esc(p.name) + ' passed away (' + esc(p.fateCause || '') + ').' : esc(p.name) + ' ran away after being unhappy and undisciplined for too long.') + '</p><p class="tip">Care mistakes are counted, but pals only die or leave after long neglect.</p>', items: items };
  }

  PP.UI = { init: init, open: open, push: push, pop: pop, close: close, replace: replace, refresh: refresh, isOpen: isOpen, input: input,
    top: function () { return cur; },
    screens: { mainMenu: mainMenu, aboutScreen: aboutScreen, statusScreen: statusScreen, feedMenu: feedMenu, trainMenu: trainMenu, discMenu: discMenu, battleMenu: battleMenu, arenaScreen: arenaScreen,
      skillsScreen: skillsScreen, palBox: palBox, breedScreen: breedScreen, albumScreen: albumScreen, settingsScreen: settingsScreen, helpScreen: helpScreen,
      speciesPicker: speciesPicker, awaySummary: awaySummary, battleResult: battleResult, fateScreen: fateScreen, confirmScreen: confirmScreen, addCodeScreen: addCodeScreen, myCodeScreen: myCodeScreen,
      arenaPreview: arenaPreview, friendsScreen: friendsScreen, friendMenu: friendMenu, slotMenu: slotMenu, treeScreen: treeScreen,
      renameScreen: renameScreen, sleepScreen: sleepScreen, exportScreen: exportScreen, importScreen: importScreen,
      storeScreen: storeScreen, storeFood: storeList('care'), storeBoosts: storeList('boost'), storeShells: storeShells, bagScreen: bagScreen, medMenu: medMenu,
      paldexScreen: paldexScreen, dexEntry: dexEntry, shellScreen: shellScreen, guideScreen: guideScreen, transferScreen: transferScreen, importConfirm: importConfirm },
    GUIDE_PAGES: GUIDE.length,
    esc: esc };
})(typeof window !== 'undefined' ? window : globalThis);
