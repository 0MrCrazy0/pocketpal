/* PocketPal 2.4.0 - the wider world (pure): collectibles (things), trips, seasonal events, the memory book,
 * generations (retiring a pal -> an heir egg with one inherited trait) and friend gifts / visits.
 * Everything here works on the saved state only (deterministic dice from PP.util.roll), so the same save
 * always gives the same result and Node tests can drive every rule. The UI lives in js/ui/world.js. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;
  var DAY = 86400e3;

  /* ------------------------------------------------------------------ collectibles
   * kind: hat (worn by a pal, drawn on its head), toy (on the floor, left), deco (in the garden, far left).
   * src: shop (price) | trip (place) | event (season) | heir (only from a retiring pal). rare: a rare trip find. */
  var THINGS = {
    bow:       { name: 'Red Bow',       kind: 'hat',  src: 'shop', price: 30 },
    bowtie:    { name: 'Bowtie',        kind: 'hat',  src: 'shop', price: 35 },
    cap:       { name: 'Sports Cap',    kind: 'hat',  src: 'shop', price: 45 },
    sunhat:    { name: 'Sun Hat',       kind: 'hat',  src: 'trip', place: 'beach' },
    leafcrown: { name: 'Leaf Crown',    kind: 'hat',  src: 'trip', place: 'forest' },
    crown:     { name: 'Tiny Crown',    kind: 'hat',  src: 'trip', place: 'town', rare: true },
    witch:     { name: 'Witch Hat',     kind: 'hat',  src: 'event', event: 'halloween' },
    santa:     { name: 'Santa Hat',     kind: 'hat',  src: 'event', event: 'christmas' },
    bunny:     { name: 'Bunny Ears',    kind: 'hat',  src: 'event', event: 'easter' },
    heirloom:  { name: 'Family Ribbon', kind: 'hat',  src: 'heir' },
    ball:      { name: 'Bouncy Ball',   kind: 'toy',  src: 'shop', price: 25 },
    blocks:    { name: 'Toy Blocks',    kind: 'toy',  src: 'shop', price: 35 },
    shell:     { name: 'Seashell',      kind: 'toy',  src: 'trip', place: 'beach' },
    pinecone:  { name: 'Pinecone',      kind: 'toy',  src: 'trip', place: 'forest' },
    robot:     { name: 'Wind-up Robot', kind: 'toy',  src: 'trip', place: 'town', rare: true },
    pumpkin:   { name: 'Jack-o-Lantern', kind: 'toy', src: 'event', event: 'halloween' },
    snowman:   { name: 'Little Snowman', kind: 'toy', src: 'event', event: 'christmas' },
    basket:    { name: 'Egg Basket',    kind: 'toy',  src: 'event', event: 'easter' },
    flowers:   { name: 'Flower Pot',    kind: 'deco', src: 'shop', price: 30 },
    sign:      { name: 'Signpost',      kind: 'deco', src: 'shop', price: 40 },
    sandcastle:{ name: 'Sandcastle',    kind: 'deco', src: 'trip', place: 'beach', rare: true },
    mushroom:  { name: 'Mushrooms',     kind: 'deco', src: 'trip', place: 'forest' },
    lamp:      { name: 'Street Lamp',   kind: 'deco', src: 'trip', place: 'town' },
    forestgem: { name: 'Mossy Stone',   kind: 'deco', src: 'trip', place: 'forest', rare: true },
    ghost:     { name: 'Friendly Ghost', kind: 'deco', src: 'event', event: 'halloween' },
    gifts:     { name: 'Gift Pile',     kind: 'deco', src: 'event', event: 'christmas' },
    eggs:      { name: 'Painted Eggs',  kind: 'deco', src: 'event', event: 'easter' }
  };
  var KINDS = ['hat', 'toy', 'deco'];
  function thing(id) { return Object.prototype.hasOwnProperty.call(THINGS, id) ? THINGS[id] : null; }
  function things(state) { return state.things || (state.things = { own: {}, toy: null, deco: null }); }
  function owns(state, id) { return !!(things(state).own[id]); }
  /* gain a thing; returns true if it is new (a duplicate is not kept: things are one of a kind) */
  function give(state, id, now) {
    if (!thing(id)) return false;
    var T = things(state); if (T.own[id]) return false;
    T.own[id] = Math.round(now || Date.now()) || 1;
    return true;
  }
  function ownedList(state, kind) { var T = things(state); return Object.keys(THINGS).filter(function (id) { return T.own[id] && (!kind || THINGS[id].kind === kind); }); }
  /* equip: a hat is worn by one pal (p.hat); the toy and the decoration belong to the room (every pal sees them) */
  function equip(state, p, id) {
    var t = id == null ? null : thing(id);
    if (id != null && (!t || !owns(state, id))) return { ok: false, msg: 'You do not have that' };
    if (t && t.kind === 'hat') { if (!p) return { ok: false, msg: 'No pal' }; p.hat = id; return { ok: true, msg: p.name + ' wears the ' + t.name }; }
    if (t) { things(state)[t.kind] = id; return { ok: true, msg: t.name + ' placed' }; }
    return { ok: false, msg: 'Nothing chosen' };
  }
  function unequip(state, p, kind) {
    if (kind === 'hat') { if (p) delete p.hat; return { ok: true, msg: 'Hat off' }; }
    if (kind === 'toy' || kind === 'deco') { things(state)[kind] = null; return { ok: true, msg: 'Put away' }; }
    return { ok: false, msg: '?' };
  }
  function buyThing(state, id, now) {
    var t = thing(id);
    if (!t || t.src !== 'shop') return { ok: false, msg: 'Not for sale' };
    if (owns(state, id)) return { ok: false, msg: 'You already have it' };
    if (PP.Shop.coins(state) < t.price) return { ok: false, msg: 'Need ' + t.price + ' coins' };
    PP.Shop.add(state, -t.price); give(state, id, now);
    return { ok: true, msg: 'Got the ' + t.name + '! (-' + t.price + 'c) Equip it in Things.' };
  }
  /* what the home screen shows (null = nothing) */
  function shown(state, p) {
    var T = things(state);
    var hat = p && p.hat && owns(state, p.hat) && THINGS[p.hat].kind === 'hat' ? p.hat : null;
    return { hat: hat, toy: T.toy && owns(state, T.toy) ? T.toy : null, deco: T.deco && owns(state, T.deco) ? T.deco : null };
  }
  function cleanThings(t) {
    var o = { own: {}, toy: null, deco: null };
    if (t && typeof t === 'object') {
      if (t.own && typeof t.own === 'object') Object.keys(t.own).forEach(function (id) { if (thing(id) && Number.isFinite(t.own[id]) && t.own[id] > 0) o.own[id] = Math.round(t.own[id]); });
      ['toy', 'deco'].forEach(function (k) { if (typeof t[k] === 'string' && o.own[t[k]] && THINGS[t[k]].kind === k) o[k] = t[k]; });
    }
    return o;
  }

  /* ------------------------------------------------------------------ seasonal events
   * Keyed to the device date (local time). Easter = the Western (Gregorian) Easter Sunday, computed. The admin panel can
   * force an event (or switch them off) for testing: settings.eventForce = 'off' | 'halloween' | 'christmas' | 'easter'. */
  var EVENTS = {
    halloween: { name: 'Halloween', text: 'Spooky season! Pumpkins in the garden and a Witch Hat to collect.', items: ['witch', 'pumpkin', 'ghost'] },
    christmas: { name: 'Christmas', text: 'Snowy days! A Santa Hat, a Little Snowman and a Gift Pile to collect.', items: ['santa', 'snowman', 'gifts'] },
    easter:    { name: 'Easter',    text: 'Spring is here! Bunny Ears, an Egg Basket and Painted Eggs to collect.', items: ['bunny', 'basket', 'eggs'] }
  };
  /* Anonymous Gregorian algorithm (Meeus / Jones / Butcher): month 3 or 4, day */
  function easterOf(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    var h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return { month: month, day: day };
  }
  function dayNum(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / DAY); }
  /* which event is on at this local date (no override): Halloween Oct 20 - Nov 1, Christmas Dec 10 - Dec 26,
   * Easter: Palm Sunday (-7 days) to Easter Monday (+1 day) */
  function eventOnDate(ms) {
    var dt = new Date(ms), y = dt.getFullYear(), m = dt.getMonth() + 1, d = dt.getDate(), n = dayNum(y, m, d);
    if (n >= dayNum(y, 10, 20) && n <= dayNum(y, 11, 1)) return 'halloween';
    if (n >= dayNum(y, 12, 10) && n <= dayNum(y, 12, 26)) return 'christmas';
    var e = easterOf(y), en = dayNum(y, e.month, e.day);
    if (n >= en - 7 && n <= en + 1) return 'easter';
    return null;
  }
  function eventNow(state, ms) {
    var f = state && state.settings && state.settings.eventForce;
    if (f === 'off') return null;
    if (f && EVENTS[f]) return f;
    return eventOnDate(ms);
  }
  /* the event's limited gift: the hat is free once per event per year (claimed from the Daily goals / Things screen);
   * the toy and the decoration are sold in the Pal Store only while the event is on */
  var EVENT_PRICE = 35;
  function eventKey(ev, ms) { return ev + '-' + new Date(ms).getFullYear(); }   // every event window sits inside one calendar year
  function eventGift(state, ms) {
    var ev = eventNow(state, ms); if (!ev) return null;
    var hat = EVENTS[ev].items[0], key = eventKey(ev, ms), got = (state.events && state.events.got) || {};
    return { ev: ev, id: hat, key: key, claimed: !!got[key] || owns(state, hat) };
  }
  function claimEventGift(state, ms) {
    var g = eventGift(state, ms);
    if (!g) return { ok: false, msg: 'No event right now' };
    if (g.claimed) return { ok: false, msg: 'Already collected' };
    state.events = state.events || { got: {} }; state.events.got = state.events.got || {};
    state.events.got[g.key] = Math.round(ms) || 1;
    give(state, g.id, ms);
    return { ok: true, id: g.id, msg: EVENTS[g.ev].name + ' gift: the ' + THINGS[g.id].name + '!' };
  }
  function eventShop(state, ms) {
    var ev = eventNow(state, ms); if (!ev) return [];
    return EVENTS[ev].items.slice(1).map(function (id) { return { id: id, price: EVENT_PRICE, owned: owns(state, id) }; });
  }
  function buyEventThing(state, id, ms) {
    var row = eventShop(state, ms).filter(function (r) { return r.id === id; })[0];
    if (!row) return { ok: false, msg: 'Only during its event' };
    if (row.owned) return { ok: false, msg: 'You already have it' };
    if (PP.Shop.coins(state) < row.price) return { ok: false, msg: 'Need ' + row.price + ' coins' };
    PP.Shop.add(state, -row.price); give(state, id, ms);
    return { ok: true, msg: 'Got the ' + THINGS[id].name + '! (-' + row.price + 'c)' };
  }

  /* ------------------------------------------------------------------ memory book
   * p.mem = [{ k: kind, at: ms, t: text }]. The first MEM_KEEP_FIRST milestones and the newest ones are kept (MEM_MAX
   * in all). Album entries keep a copy, so a retired / lost pal's book stays readable, and the family book walks the line. */
  var MEM_MAX = 40, MEM_KEEP_FIRST = 8, MEM_KINDS = ['hatch', 'grow', 'adult', 'level', 'battle', 'cup', 'trip', 'find', 'gift', 'visit', 'egg', 'retire', 'heir', 'event', 'note', 'revive', 'elder'];
  function remember(p, k, text, ms) {
    if (!p || MEM_KINDS.indexOf(k) < 0 || !text) return null;
    var m = p.mem || (p.mem = []);
    var e = { k: k, at: Math.round(ms || Date.now()), t: String(text).slice(0, 80) };
    var last = m[m.length - 1];
    if (last && last.k === e.k && last.t === e.t && Math.abs(last.at - e.at) < 60e3) return null;   // a double tap
    m.push(e);
    if (m.length > MEM_MAX) m.splice(MEM_KEEP_FIRST, m.length - MEM_MAX);
    return e;
  }
  function cleanMem(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (e) {
      if (e && typeof e === 'object' && MEM_KINDS.indexOf(e.k) >= 0 && typeof e.t === 'string' && Number.isFinite(e.at)) out.push({ k: e.k, at: Math.round(e.at), t: e.t.slice(0, 80) });
    });
    if (out.length > MEM_MAX) out.splice(MEM_KEEP_FIRST, out.length - MEM_MAX);
    return out;
  }
  /* the family book: this pal, then each first parent up the line (from the album), newest generation first */
  function familyLine(state, p, max) {
    var line = [], seen = {}, cur = p;
    max = max || 12;
    while (cur && line.length < max && !seen[cur.id]) {
      seen[cur.id] = true;
      var a = PP.Game.albumFind(state, cur.id);
      var src = cur.stage ? cur : (a || cur);
      line.push({ id: cur.id, name: src.name || cur.name, species: src.species || cur.species, form: src.form || cur.form || null, stage: src.stage || (a && a.stage) || 'adult',
        gen: src.gen || cur.gen || 1, fate: src.fate || (a && a.fate) || null, mem: (cur.mem || (a && a.mem) || []), trait: (src.heir && src.heir.trait) || (a && a.trait) || null });
      var par = (cur.parents && cur.parents.length ? cur.parents : (a && a.parents)) || [];
      var next = par.filter(Boolean)[0];
      cur = next ? (PP.Game.albumFind(state, next.id) || next) : null;
    }
    return line;
  }

  /* ------------------------------------------------------------------ generations
   * An adult can retire after RETIRE.minDays pet-days as an adult (an Elder from RETIRE.elderDays: a gentle nudge, never
   * forced). Retiring keeps the pal in the album (fate 'retired', its memory book too) and leaves an heir egg in its slot:
   * the same species, generation + 1, with ONE trait the player picks: a gene (the parent's best gene + 1, max 3), an
   * innate skill (one of the parent's skills, tier 1-3, known from birth) or the Family Ribbon (an heirloom hat). */
  var RETIRE = { minDays: 5, elderDays: 20 };
  function adultDays(p) { return p && p.stage === 'adult' ? Math.max(0, Math.floor((p.stageMin || 0) / 1440)) : 0; }   // stageMin keeps counting (pet minutes) once adult
  function isElder(p) { return !!p && !p.fate && adultDays(p) >= RETIRE.elderDays; }
  function canRetire(p) {
    if (!p || p.fate) return 'No pal';
    if (p.stage !== 'adult') return 'Only adults can retire';
    if (p.asleep) return 'It is asleep';
    var d = adultDays(p);
    if (d < RETIRE.minDays) return 'Too young to retire (adult for ' + d + '/' + RETIRE.minDays + ' days)';
    return null;
  }
  function bestGene(p) {
    var g = p.genes || {}, best = 'atk';
    ['hp', 'atk', 'def', 'spd'].forEach(function (k) { if ((g[k] || 0) > (g[best] || 0)) best = k; });
    return best;
  }
  function traitOptions(p) {
    var opts = [], gk = bestGene(p), GL = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD' };
    opts.push({ k: 'gene', v: gk, label: 'Strong ' + GL[gk], sub: 'The egg gets ' + GL[gk] + ' gene +' + Math.min(3, Math.max(0, (p.genes && p.genes[gk]) || 0) + 1) + ' or better' });
    var sk = (p.skills || []).map(function (id) { return PP.Skills.find(p.species, id); }).filter(function (s) { return s && s.tier <= 3; })
      .sort(function (a, b) { return b.tier - a.tier || (a.id < b.id ? -1 : 1); })[0];
    opts.push(sk ? { k: 'skill', v: sk.id, label: 'Innate ' + sk.name, sub: 'Known from birth when it grows up (free)' }
      : { k: 'skill', v: null, label: 'Innate skill', sub: 'Learn a skill first', disabled: true });
    opts.push({ k: 'ribbon', v: 'heirloom', label: 'Family Ribbon', sub: 'An heirloom hat the egg wears (cosmetic)' });
    return opts;
  }
  function retire(state, slot, traitK, ms) {
    var p = state.slots[slot], why = canRetire(p);
    if (why) return { ok: false, msg: why };
    var opt = traitOptions(p).filter(function (o) { return o.k === traitK && !o.disabled; })[0];
    if (!opt) return { ok: false, msg: 'Pick a trait' };
    var now = Math.round(ms || Date.now());
    remember(p, 'retire', 'Retired after ' + adultDays(p) + ' days as an adult, Lv' + p.level + ', ' + (p.wins || 0) + ' wins', now);
    p.fate = 'retired'; p.fateCause = 'retired';
    PP.Game.albumUpsert(state, p);
    var a = PP.Game.albumFind(state, p.id); if (a) a.trait = opt.k;
    var egg = PP.Pet.createEgg({ species: p.species, now: now, seed: U.hash(state.seed, 'heir', p.id, now), gen: Math.min(999, (p.gen || 1) + 1),
      parents: [PP.Breeding.parentRef(p)] });
    egg.heir = { from: p.id, name: p.name, trait: opt.k };
    if (opt.k === 'gene') { egg.genes[opt.v] = Math.min(3, Math.max(egg.genes[opt.v] || 0, (p.genes && p.genes[opt.v]) || 0) + 1); egg.heir.v = opt.v; }   // the parent's gene (or the egg's own, if better) + 1
    if (opt.k === 'skill') { egg.inheritedSkills = [opt.v].concat((egg.inheritedSkills || []).filter(function (x) { return x !== opt.v; })).slice(0, 2); egg.heir.v = opt.v; }
    if (opt.k === 'ribbon') { give(state, 'heirloom', now); egg.hat = 'heirloom'; }
    if (p.hard) egg.hard = true;
    remember(egg, 'heir', 'Laid by ' + p.name + ' (gen ' + (p.gen || 1) + ') as its heir: ' + opt.label, now);
    state.slots[slot] = egg;
    var L = state.line || (state.line = { top: 1, retired: 0 });
    L.retired = (L.retired || 0) + 1; L.top = Math.max(L.top || 1, egg.gen);
    return { ok: true, egg: egg, msg: p.name + ' retired. Its heir egg is here (generation ' + egg.gen + ')!' };
  }
  function topGen(state) {
    var g = (state.line && state.line.top) || 1;
    (state.slots || []).forEach(function (p) { if (p) g = Math.max(g, p.gen || 1); });
    (state.album || []).forEach(function (e) { if (e) g = Math.max(g, e.gen || 1); });
    return g;
  }

  /* ------------------------------------------------------------------ trips
   * A short day out with the active pal: costs energy, then a real-time cooldown (TRIP.coolMin) and at most TRIP.perDay a
   * game day, so trips cannot be spammed. Each trip: happy +1, a few coins (inside the daily coin cap), maybe a thing found
   * there (not owned yet; the rare one is rarer) and maybe a rare encounter (a wild pal of an adult form you have not
   * raised: it is marked as SEEN in the Paldex). Results come from the save's dice, so reloading cannot re-roll them. */
  var PLACES = {
    beach:  { name: 'Beach',  energy: 20, blurb: 'Sand, waves and seashells.', minStage: 'child' },
    forest: { name: 'Forest', energy: 25, blurb: 'Tall trees, mushrooms and pinecones.', minStage: 'child' },
    town:   { name: 'Town',   energy: 15, blurb: 'Shops, lamps and friendly faces.', minStage: 'child' }
  };
  var TRIP = { coolMin: 120, perDay: 3, findPct: 0.4, rarePct: 0.08, meetPct: 0.15, coins: [3, 8] };
  function trips(state) { return state.trips || (state.trips = { last: null, day: null, n: 0, count: 0, visits: {} }); }
  function tripDay(ms) { return PP.Shop.dayOf(ms); }
  function canTrip(state, p, where, ms) {
    var P = PLACES[where]; if (!P) return 'Unknown place';
    if (!p || p.fate) return 'No pal';
    if (p.stage === 'egg' || p.stage === 'baby') return 'Too little for trips (wait until it is a child)';
    if (p.asleep) return 'It is asleep';
    if (p.sick) return 'Too sick for a trip';
    if (p.fake) return 'Not during a tantrum';
    if (!p.lights) return 'Turn the lights on first';
    var T = trips(state), day = tripDay(ms);
    if (T.day === day && T.n >= TRIP.perDay) return 'That was ' + TRIP.perDay + ' trips today. More tomorrow!';
    var wait = nextTripIn(state, ms);
    if (wait > 0) return 'Resting after the last trip (' + Math.ceil(wait / 60e3) + ' min)';
    if (p.energy < P.energy) return 'Too tired... (needs ' + P.energy + ' energy)';
    return null;
  }
  /* a device clock moved backwards (or a test-panel time skip undone) restarts the rest from now: never longer than
   * TRIP.coolMin, never shorter than the rest left */
  function nextTripIn(state, ms) { var T = trips(state); return T.last == null ? 0 : Math.max(0, Math.min(T.last, ms) + TRIP.coolMin * 60e3 - ms); }
  function goTrip(state, where, ms) {
    var p = PP.Game.active(state), why = canTrip(state, p, where, ms);
    if (why) return { ok: false, msg: why };
    var P = PLACES[where], T = trips(state), day = tripDay(ms);
    var k = (T.count || 0) + 1, roll = function (tag) { return U.roll(state.seed, 'trip', k, where, tag); };
    p.energy = Math.max(0, p.energy - P.energy);
    p.happy = Math.min(D.RULES.maxHearts, p.happy + 1);
    if (T.day !== day) { T.day = day; T.n = 0; }
    T.n++; T.count = k; T.last = Math.round(ms);
    T.visits[where] = (T.visits[where] || 0) + 1;
    var out = { ok: true, where: where, happy: 1, energy: P.energy, coins: 0, found: null, met: null };
    var c = TRIP.coins[0] + Math.floor(roll('coins') * (TRIP.coins[1] - TRIP.coins[0] + 1));
    out.coins = PP.Shop.earn(state, c, ms);
    var here = Object.keys(THINGS).filter(function (id) { return THINGS[id].src === 'trip' && THINGS[id].place === where && !owns(state, id); });
    var common = here.filter(function (id) { return !THINGS[id].rare; }), rare = here.filter(function (id) { return THINGS[id].rare; });
    var r = roll('find');
    if (rare.length && r < TRIP.rarePct) out.found = rare[Math.floor(roll('which') * rare.length)];
    else if (common.length && r < TRIP.findPct) out.found = common[Math.floor(roll('which') * common.length)];
    if (out.found) give(state, out.found, ms);
    if (roll('meet') < TRIP.meetPct) {
      var miss = [];
      D.SPECIES.forEach(function (sp) { D.FORMS.forEach(function (f) { if (f === 'secret') return; var e = PP.Collection.get(state, sp, f); if (!e || (!e.r && !e.s)) miss.push([sp, f]); }); });
      var pick = miss.length ? miss[Math.floor(roll('who') * miss.length)] : null;
      if (pick) { out.met = { species: pick[0], form: pick[1], name: D.NAMES[pick[0]][pick[1]] }; PP.Collection.mark(state, pick[0], pick[1], 'seen', ms); }
    }
    var first = T.visits[where] === 1;
    remember(p, out.found ? 'find' : 'trip', (first ? 'First trip to the ' : 'A day at the ') + P.name + (out.found ? ' - found the ' + THINGS[out.found].name + '!' : '') + (out.met ? ' Met a wild ' + out.met.name + '.' : ''), ms);
    return out;
  }
  function cleanTrips(t) {
    var o = { last: null, day: null, n: 0, count: 0, visits: {} };
    if (t && typeof t === 'object') {
      if (Number.isFinite(t.last) && t.last > 0) o.last = Math.round(t.last);
      if (Number.isFinite(t.day)) o.day = Math.round(t.day);
      o.n = U.int(t.n, 0, 0, TRIP.perDay); o.count = U.int(t.count, 0, 0, 1e7);
      if (t.visits && typeof t.visits === 'object') Object.keys(PLACES).forEach(function (k) { var v = U.int(t.visits[k], 0, 0, 1e6); if (v) o.visits[k] = v; });
    }
    return o;
  }

  /* ------------------------------------------------------------------ friend gifts and visits
   * A mailbox lives on the optional worker (CODES KV, key mb:<id>). The player's battle code carries the mailbox id
   * (field mb, ignored by older games); only the device holding the secret key can open the box. Sending: a Treat
   * (free, GIFT.freePerDay a day) or a Berry Cake / Deluxe Feast moved out of your own bag (nothing is created, so two
   * devices cannot farm items). Receiving: at most GIFT.usePerDay gifts a day give their item / treat; extra ones are
   * kept as thank-you notes. Visits are local: your pal and a friend's pal meet in the garden (happy +1, once a day per
   * friend, at most VISIT.perDay bonuses a day). */
  var GIFTS = {
    treat: { name: 'Treat', free: true, desc: 'Happy +1 for their pal' },
    cake:  { name: 'Berry Cake', item: 'cake', desc: 'Goes into their Bag (from yours)' },
    feast: { name: 'Deluxe Feast', item: 'feast', desc: 'Goes into their Bag (from yours)' },
    tonic: { name: 'Energy Tonic', item: 'tonic', desc: 'Goes into their Bag (from yours)' },
    remedy: { name: 'Super Medicine', item: 'remedy', desc: 'Goes into their Bag (from yours)' }
  };
  var GIFT = { freePerDay: 3, sendPerDay: 5, usePerDay: 3, keepLog: 20 };
  var VISIT = { perDay: 2 };
  function mail(state) { return state.mail || (state.mail = { box: null, key: null, sent: { day: null, n: 0, free: 0 }, used: { day: null, n: 0 }, log: [], checkAt: null }); }
  var MBX = /^[0-9a-f]{16}$/, MKEY = /^[0-9a-f]{32}$/;
  function canSend(state, giftId, friend, ms) {
    var g = GIFTS[giftId]; if (!g) return 'Unknown gift';
    if (!friend || !MBX.test(friend.mb || '')) return 'This friend has no gift mailbox (ask for a new battle code from PocketPal 2.4.0+)';
    if (!MBX.test(mail(state).box || '')) return 'Set up your own mailbox first (Gifts > Mailbox)';
    var M = mail(state), day = tripDay(ms), s = M.sent.day === day ? M.sent : { n: 0, free: 0 };
    if (s.n >= GIFT.sendPerDay) return 'That is ' + GIFT.sendPerDay + ' gifts today - more tomorrow';
    if (g.free && s.free >= GIFT.freePerDay) return GIFT.freePerDay + ' free treats a day - send a cake or a feast, or wait until tomorrow';
    if (g.item && PP.Shop.count(state, g.item) < 1) return 'You have no ' + g.name + ' in your Bag';
    return null;
  }
  /* call after the worker accepted the gift: takes the item from the bag and counts it */
  function noteSent(state, giftId, friend, ms) {
    var M = mail(state), g = GIFTS[giftId], day = tripDay(ms);
    if (M.sent.day !== day) M.sent = { day: day, n: 0, free: 0 };
    M.sent.n++; if (g.free) M.sent.free++;
    if (g.item) { state.inv[g.item] = Math.max(0, (state.inv[g.item] || 0) - 1); if (!state.inv[g.item]) delete state.inv[g.item]; }   // moved out of the bag (not used on your pal)
    logMail(M, { dir: 'out', g: giftId, who: PP.Pet.cleanName(friend.name) || 'Friend', at: Math.round(ms) });
    var p = PP.Game.active(state); if (p) remember(p, 'gift', 'Sent a ' + g.name + ' to ' + (friend.name || 'a friend'), ms);
  }
  function logMail(M, e) { M.log.push(e); if (M.log.length > GIFT.keepLog) M.log.splice(0, M.log.length - GIFT.keepLog); }
  /* a gift that came from the worker: { g, n (sender name), s (species index), at } -> applied (or kept as a note) */
  function receive(state, list, ms) {
    var M = mail(state), day = tripDay(ms), out = [];
    if (M.used.day !== day) M.used = { day: day, n: 0 };
    (Array.isArray(list) ? list : []).slice(0, 10).forEach(function (raw) {
      if (!raw || typeof raw !== 'object' || !GIFTS[raw.g]) return;
      var g = GIFTS[raw.g], who = PP.Pet.cleanName(raw.n) || 'A friend', p = PP.Game.active(state), used = false;
      if (M.used.n < GIFT.usePerDay) {
        if (g.free && p && !p.fate && p.stage !== 'egg') { p.happy = Math.min(D.RULES.maxHearts, p.happy + 1); used = true; }
        else if (g.item && PP.Shop.count(state, g.item) < D.ECONOMY.maxStack) { state.inv[g.item] = (state.inv[g.item] || 0) + 1; used = true; }
        if (used) M.used.n++;
      }
      logMail(M, { dir: 'in', g: raw.g, who: who, at: Math.round(ms), used: used });
      if (p && !p.fate) remember(p, 'gift', who + ' sent a ' + g.name + (used ? '' : ' (a thank-you note)'), ms);
      out.push({ g: raw.g, who: who, used: used, name: g.name });
    });
    return out;
  }
  function visits(state) { return state.visits || (state.visits = { day: null, n: 0, met: {} }); }
  function canVisit(state, p, friend) {
    if (!p || p.fate || p.stage === 'egg') return 'No pal to take along';
    if (p.asleep) return 'It is asleep';
    if (!friend) return 'Pick a friend';
    return null;
  }
  function visit(state, friend, ms) {
    var p = PP.Game.active(state), why = canVisit(state, p, friend);
    if (why) return { ok: false, msg: why };
    var V = visits(state), day = tripDay(ms), key = String(friend.id || friend.name).slice(0, 20);
    if (V.day !== day) { V.day = day; V.n = 0; }
    var already = V.met[key] === day, bonus = !already && V.n < VISIT.perDay;
    if (bonus) { V.n++; p.happy = Math.min(D.RULES.maxHearts, p.happy + 1); }
    var firstEver = V.met[key] == null;
    V.met[key] = day;
    var keys = Object.keys(V.met); if (keys.length > 30) keys.sort(function (a, b) { return V.met[a] - V.met[b]; }).slice(0, keys.length - 30).forEach(function (k) { delete V.met[k]; });
    if (firstEver || bonus) remember(p, 'visit', (firstEver ? 'Met ' : 'Played with ') + (friend.name || 'a friend') + ' the ' + D.NAMES[friend.species][friend.form || 'good'], ms);
    return { ok: true, bonus: bonus, msg: bonus ? 'They had a great time! Happy +1' : already ? 'Fun visit (the happy bonus is once a day per friend)' : 'Fun visit (' + VISIT.perDay + ' happy bonuses a day)' };
  }
  function cleanMail(m) {
    var o = { box: null, key: null, sent: { day: null, n: 0, free: 0 }, used: { day: null, n: 0 }, log: [], checkAt: null };
    if (!m || typeof m !== 'object') return o;
    if (MBX.test(m.box || '') && MKEY.test(m.key || '')) { o.box = m.box; o.key = m.key; }
    if (m.sent && Number.isFinite(m.sent.day)) o.sent = { day: Math.round(m.sent.day), n: U.int(m.sent.n, 0, 0, 99), free: U.int(m.sent.free, 0, 0, 99) };
    if (m.used && Number.isFinite(m.used.day)) o.used = { day: Math.round(m.used.day), n: U.int(m.used.n, 0, 0, 99) };
    if (Array.isArray(m.log)) o.log = m.log.filter(function (e) { return e && GIFTS[e.g] && (e.dir === 'in' || e.dir === 'out') && Number.isFinite(e.at); })
      .slice(-GIFT.keepLog).map(function (e) { return { dir: e.dir, g: e.g, who: PP.Pet.cleanName(e.who) || 'Friend', at: Math.round(e.at), used: e.dir === 'in' ? !!e.used : undefined }; });
    if (Number.isFinite(m.checkAt)) o.checkAt = Math.round(m.checkAt);
    return o;
  }
  function cleanVisits(v) {
    var o = { day: null, n: 0, met: {} };
    if (!v || typeof v !== 'object') return o;
    if (Number.isFinite(v.day)) { o.day = Math.round(v.day); o.n = U.int(v.n, 0, 0, VISIT.perDay); }
    if (v.met && typeof v.met === 'object') Object.keys(v.met).slice(0, 30).forEach(function (k) { if (Number.isFinite(v.met[k])) o.met[String(k).slice(0, 20)] = Math.round(v.met[k]); });
    return o;
  }

  /* ------------------------------------------------------------------ Friends Cup (arena with friends' pals)
   * Your saved friends' battle pals as a mini cup: the FCUP.size most recently added (valid) friend pals, weakest first,
   * beaten in a row (a loss or a forfeit ends the run, like an arena cup). Each fight is a normal friend battle (same
   * XP and capped coins); winning the whole cup gives a bonus once a game day and counts in the trophy total. The run
   * belongs to the pal that started it and to that line-up (adding or removing a friend starts a new run). */
  var FCUP = { size: 3, min: 2, bonus: 20 };
  function fcup(state) { return state.fcup || (state.fcup = { run: null, wins: 0, day: null }); }
  function fcupFoes(state) {
    var list = (state.friends || []).filter(function (c) { return c && !PP.Cards.validateCard(c); }).slice(0, FCUP.size);
    return list.map(function (c) { return { c: c, bp: PP.Battle.fighter(c).bp }; })
      .sort(function (a, b) { return a.bp - b.bp || (a.c.id < b.c.id ? -1 : 1); }).map(function (x) { return x.c; });
  }
  /* where the run stands for the pal that is out: { foes, next, run } (next = index of the next foe) */
  function fcupStatus(state) {
    var foes = fcupFoes(state), F = fcup(state), p = PP.Game.active(state), ids = foes.map(function (c) { return c.id; }).join(',');
    var run = F.run && p && F.run.pal === p.id && F.run.ids === ids ? F.run : null;
    return { foes: foes, next: run ? run.foe : 0, run: run, ready: foes.length >= FCUP.min };
  }
  function canFcup(state) {
    var st0 = fcupStatus(state);
    if (!st0.ready) return 'Add ' + FCUP.min + ' or more friend codes first (Battle > Add friend code)';
    return PP.Game.canBattle(PP.Game.active(state));
  }
  function startFcup(state, seed) {
    var why = canFcup(state); if (why) return { ok: false, msg: why };
    var S = fcupStatus(state), i = S.next, c = S.foes[i];
    var r = PP.Game.startBattle(state, c, { kind: 'friend', fcup: true, foe: i, foes: S.foes.length }, seed);
    if (r.ok) fcup(state).run = { ids: S.foes.map(function (x) { return x.id; }).join(','), foe: i, pal: PP.Game.active(state).id };
    return r;
  }
  /* called by Game.finishBattle for a Friends Cup fight (out = the battle result, extended here) */
  function fcupResult(state, B, out, ms) {
    var F = fcup(state), m = B.meta || {}, p = PP.Game.active(state), n = m.foes | 0, i = m.foe | 0;
    out.fcup = true; out.foe = i + 1; out.foes = n;
    if (!out.won || out.fled || !F.run) { F.run = null; return out; }
    if (i + 1 < n) { F.run.foe = i + 1; out.next = i + 2; return out; }
    F.run = null; out.fcleared = true; F.wins = (F.wins || 0) + 1;
    var day = PP.Shop.dayOf(ms);
    if (F.day !== day) { F.day = day; out.fbonus = PP.Shop.earn(state, FCUP.bonus, ms, false); out.coins = (out.coins || 0) + out.fbonus; }
    if (p) remember(p, 'cup', 'Won the Friends Cup' + (F.wins > 1 ? ' (' + F.wins + ' times)' : '') + '!', ms);
    return out;
  }
  function cleanFcup(f) {
    var o = { run: null, wins: 0, day: null };
    if (!f || typeof f !== 'object') return o;
    o.wins = U.int(f.wins, 0, 0, 1e6);
    if (Number.isFinite(f.day)) o.day = Math.round(f.day);
    var r = f.run;
    if (r && typeof r === 'object' && typeof r.ids === 'string' && typeof r.pal === 'string') o.run = { ids: r.ids.slice(0, 200), foe: U.int(r.foe, 0, 0, FCUP.size - 1), pal: r.pal.slice(0, 40) };
    return o;
  }

  /* ------------------------------------------------------------------ state defaults / cleaning (save.js) */
  function defaults() {
    return { things: { own: {}, toy: null, deco: null }, trips: cleanTrips(null), mail: cleanMail(null), visits: cleanVisits(null), events: { got: {} }, line: { top: 1, retired: 0 }, fcup: cleanFcup(null) };
  }
  function cleanState(out, s) {
    out.things = cleanThings(s.things);
    out.trips = cleanTrips(s.trips);
    out.mail = cleanMail(s.mail);
    out.visits = cleanVisits(s.visits);
    out.fcup = cleanFcup(s.fcup);
    var ev = { got: {} };
    if (s.events && s.events.got && typeof s.events.got === 'object') Object.keys(s.events.got).forEach(function (k) { if (/^(halloween|christmas|easter)-\d{4}$/.test(k) && Number.isFinite(s.events.got[k])) ev.got[k] = Math.round(s.events.got[k]); });
    if (s.events && Number.isFinite(s.events.hello)) ev.hello = Math.round(s.events.hello);   // the day the event hello was shown
    out.events = ev;
    var L = s.line && typeof s.line === 'object' ? s.line : {};
    out.line = { top: U.int(L.top, 1, 1, 999), retired: U.int(L.retired, 0, 0, 1e6) };
    out.line.top = topGen(out);
    return out;
  }
  /* per pal (sanitizePet): memory book, worn hat, heir note */
  function cleanPet(out, p) {
    out.mem = cleanMem(p.mem);
    if (typeof p.hat === 'string' && thing(p.hat) && THINGS[p.hat].kind === 'hat') out.hat = p.hat; else delete out.hat;
    if (p.heir && typeof p.heir === 'object' && ['gene', 'skill', 'ribbon'].indexOf(p.heir.trait) >= 0) {
      out.heir = { from: String(p.heir.from || '').slice(0, 40), name: PP.Pet.cleanName(p.heir.name) || '?', trait: p.heir.trait };
      if (typeof p.heir.v === 'string') out.heir.v = p.heir.v.slice(0, 24);
    } else delete out.heir;
    if (p.elderSeen === true) out.elderSeen = true; else delete out.elderSeen;
    return out;
  }
  /* 7 -> 8 migration: the new parts start empty, nothing is lost; every pal's memory book starts with what the save
   * already knows about it */
  function migrate(st) {
    var d = defaults();
    Object.keys(d).forEach(function (k) { if (st[k] == null) st[k] = d[k]; });
    st.settings = st.settings || {};
    if (!('eventForce' in st.settings)) st.settings.eventForce = null;
    var seed = function (p) {
      if (!p || typeof p !== 'object' || Array.isArray(p.mem)) return;
      p.mem = [];
      var at = Number.isFinite(p.hatchedAt) ? p.hatchedAt : Number.isFinite(p.createdAt) ? p.createdAt : Date.now();
      if (p.stage && p.stage !== 'egg') p.mem.push({ k: 'hatch', at: Math.round(at), t: 'Hatched' + (p.gen > 1 ? ' (generation ' + p.gen + ')' : '') });
      if (p.stage === 'adult' && p.form && D.NAMES[p.species]) p.mem.push({ k: 'adult', at: Math.round(at), t: 'Grew up into ' + D.NAMES[p.species][p.form] });
      if (p.wins) p.mem.push({ k: 'battle', at: Math.round(Number.isFinite(p.lastTickAt) ? p.lastTickAt : at), t: (p.wins || 0) + ' battle wins so far' });
    };
    (st.slots || []).forEach(seed);
    (st.album || []).forEach(function (e) { if (e && !Array.isArray(e.mem)) e.mem = []; });
    var top = 1;
    (st.slots || []).concat(st.album || []).forEach(function (p) { if (p && Number.isFinite(p.gen)) top = Math.max(top, p.gen); });
    st.line = { top: Math.min(999, top), retired: 0 };
    return st;
  }

  PP.World = {
    THINGS: THINGS, KINDS: KINDS, thing: thing, owns: owns, give: give, ownedList: ownedList, equip: equip, unequip: unequip, buyThing: buyThing, shown: shown,
    EVENTS: EVENTS, easterOf: easterOf, eventOnDate: eventOnDate, eventNow: eventNow, eventGift: eventGift, claimEventGift: claimEventGift,
    eventShop: eventShop, buyEventThing: buyEventThing, EVENT_PRICE: EVENT_PRICE,
    MEM_MAX: MEM_MAX, remember: remember, cleanMem: cleanMem, familyLine: familyLine,
    RETIRE: RETIRE, adultDays: adultDays, isElder: isElder, canRetire: canRetire, traitOptions: traitOptions, retire: retire, topGen: topGen,
    PLACES: PLACES, TRIP: TRIP, canTrip: canTrip, goTrip: goTrip, nextTripIn: nextTripIn,
    GIFTS: GIFTS, GIFT: GIFT, VISIT: VISIT, mail: mail, canSend: canSend, noteSent: noteSent, receive: receive, visit: visit, canVisit: canVisit, MBX: MBX, MKEY: MKEY,
    FCUP: FCUP, fcupFoes: fcupFoes, fcupStatus: fcupStatus, canFcup: canFcup, startFcup: startFcup, fcupResult: fcupResult,
    defaults: defaults, cleanState: cleanState, cleanPet: cleanPet, migrate: migrate
  };
})(typeof window !== 'undefined' ? window : globalThis);
