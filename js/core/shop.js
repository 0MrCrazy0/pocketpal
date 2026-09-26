/* PocketPal 2 - Pal Store: coins, inventory, items, Pal Box slots (pure, no DOM).
 * Money is for extras only. Basic care (meal, snack, medicine, clean) stays free,
 * boosts are small and hard-capped, and nothing here can change an adult form. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA, E = D.ECONOMY, R = D.RULES;

  function wallet(state) {
    if (!state.wallet || typeof state.wallet !== 'object') state.wallet = { coins: E.startCoins, day: null, earned: 0, lastDaily: null, streak: 0, mistakesAt: null };
    if (!state.inv || typeof state.inv !== 'object') state.inv = {};
    return state.wallet;
  }
  function coins(state) { return wallet(state).coins; }
  /* Game-day number in local time (test-mode time travel moves it too). */
  function dayOf(t) { var d = new Date(t); return Math.floor((t - d.getTimezoneOffset() * 60000) / 86400000); }

  function add(state, n) { var w = wallet(state); w.coins = U.clamp(Math.round(w.coins + n), 0, E.maxCoins); return w.coins; }
  /* Coins from battles/training respect a daily cap; bonuses don't (capped = false). */
  function earn(state, n, t, capped) {
    var w = wallet(state), day = dayOf(t);
    if (w.day !== day) { w.day = day; w.earned = 0; }
    var give = Math.max(0, Math.round(n));
    if (capped !== false) { give = Math.min(give, Math.max(0, E.dailyCap - w.earned)); w.earned += give; }
    add(state, give);
    return give;
  }

  /* Battle reward, from finishBattle's facts. */
  function battleCoins(won, oppLv, meta, cleared, champion) {
    if (!won) return { capped: E.battleLoss, bonus: 0 };
    var c = E.battleWin(oppLv || 1), bonus = 0;
    if (meta && meta.kind === 'arena') { c += E.arenaBonus(meta.rank || 0); if (cleared) bonus += E.cupClear((meta.rank || 0) + 1); }
    if (champion) bonus += E.champion;
    return { capped: c, bonus: bonus };
  }

  /* Once per game day: login bonus (+streak) and a care bonus if no new mistakes. */
  function claimDaily(state, t) {
    var w = wallet(state), day = dayOf(t);
    if (w.lastDaily === day) return null;
    w.streak = w.lastDaily === day - 1 ? w.streak + 1 : 1;
    var p = PP.Game.active(state), mist = p ? p.totalMistakes || 0 : null, care = 0;
    if (p && !p.fate && p.stage !== 'egg' && w.mistakesAt && w.mistakesAt.id === p.id && w.mistakesAt.n === mist) care = E.careBonus;
    w.lastDaily = day;
    w.mistakesAt = p ? { id: p.id, n: mist } : null;
    var base = E.daily(w.streak);
    add(state, base + care);
    return { coins: base + care, base: base, care: care, streak: w.streak };
  }

  /* ---------------------------------------------------------------- buying */
  function count(state, id) { wallet(state); return state.inv[id] || 0; }
  function buy(state, id) {
    var it = D.ITEMS[id]; if (!it) return { ok: false, msg: 'Unknown item' };
    var w = wallet(state);
    if (count(state, id) >= E.maxStack) return { ok: false, msg: 'Your bag is full of those' };
    if (w.coins < it.price) return { ok: false, msg: 'Not enough coins (' + it.price + ' needed)' };
    w.coins -= it.price; state.inv[id] = count(state, id) + 1;
    return { ok: true, msg: 'Bought ' + it.name + ' (-' + it.price + ' coins)' };
  }
  function buyShell(state, id) {
    var s = PP.Collection.shell(id);
    if (!s || !s.price) return { ok: false, msg: s && s.unlock ? 'Special finishes can only be earned' : 'Not for sale' };
    state.unlocks = state.unlocks || [];
    if (state.unlocks.indexOf(id) >= 0) return { ok: false, msg: 'You already own ' + s.name };
    var w = wallet(state);
    if (w.coins < s.price) return { ok: false, msg: 'Not enough coins (' + s.price + ' needed)' };
    w.coins -= s.price; state.unlocks.push(id);
    return { ok: true, msg: s.name + ' shell is yours!' };
  }

  /* ---------------------------------------------------------------- Pal Box slots */
  function boxSize(state) { return state.slots.length; }
  function nextSlotPrice(state) { var n = boxSize(state); return n >= D.BOX.max ? null : D.BOX.prices[n - D.BOX.start]; }
  function buySlot(state) {
    var price = nextSlotPrice(state);
    if (price == null) return { ok: false, msg: 'The Pal Box is already at its maximum (' + D.BOX.max + ')' };
    var w = wallet(state);
    if (w.coins < price) return { ok: false, msg: 'Not enough coins (' + price + ' needed)' };
    w.coins -= price; state.slots.push(null); state.boxSize = state.slots.length;
    return { ok: true, msg: 'Pal Box now has ' + state.slots.length + ' slots', size: state.slots.length };
  }

  /* ---------------------------------------------------------------- boosts */
  function boosts(p) {
    var b = (p && p.boost) || {};
    return { hp: b.hp | 0, atk: b.atk | 0, def: b.def | 0, spd: b.spd | 0 };
  }
  function boostTotal(p) { var b = boosts(p); return b.hp + b.atk + b.def + b.spd; }
  /* Percent bonus per stat for battle maths. */
  function boostPct(p) { var b = boosts(p), k = D.BOOST.pct; return { hp: b.hp * k, atk: b.atk * k, def: b.def * k, spd: b.spd * k }; }
  function cleanBoost(b) {
    var o = { hp: 0, atk: 0, def: 0, spd: 0 }, left = D.BOOST.total;
    if (!b || typeof b !== 'object') return o;
    ['hp', 'atk', 'def', 'spd'].forEach(function (k) { var v = Math.min(U.int(b[k], 0, 0, D.BOOST.perStat), left); o[k] = v; left -= v; });
    return o;
  }

  /* ---------------------------------------------------------------- using items */
  function res(ok, msg, anim) { return { ok: ok, msg: msg, anim: anim || null }; }
  function use(state, id) {
    var it = D.ITEMS[id], p = PP.Game.active(state);
    if (!it) return res(false, 'Unknown item');
    if (count(state, id) < 1) return res(false, 'You have no ' + it.name + ' - visit the Pal Store');
    if (!p || p.fate) return res(false, 'No pal');
    if (p.stage === 'egg') return res(false, 'Still an egg!');
    var r;
    if (id === 'cake') {
      if (p.asleep) return res(false, 'Zzz... asleep');
      r = PP.Care.feedSnack(p);                // same overfeeding rule as a free snack
      if (r.ok) { p.happy = Math.min(R.maxHearts, p.happy + 1); p.weight += 1; if (r.anim === 'happy') r = res(true, 'Berry Cake! Happy +2', 'eat'); }
    } else if (id === 'feast') {
      if (p.asleep) return res(false, 'Zzz... asleep');
      if (p.fake) return res(false, 'Tantrum! It refuses food', 'refuse');
      if (p.hunger >= R.maxHearts) return res(false, 'Full! It shakes its head', 'refuse');
      p.hunger = Math.min(R.maxHearts, p.hunger + 2); p.happy = Math.min(R.maxHearts, p.happy + 1);
      p.energy = Math.min(100, p.energy + 15); p.weight += 2;
      r = res(true, 'A feast! Hunger +2, happy +1', 'eat');
    } else if (id === 'tonic') {
      if (p.asleep) return res(false, 'Zzz... asleep');
      if (p.energy >= 100) return res(false, 'Already full of energy');
      p.energy = Math.min(100, p.energy + 50);
      r = res(true, 'Energy +50!', 'happy');
    } else if (id === 'remedy') {
      if (!p.sick) return res(false, "It isn't sick - saved for later");
      p.sick = false; p.sickDoses = 0; if (p.need) p.need.sick = null;
      p.health = Math.min(100, p.health + 20);
      r = res(true, 'Cured in one dose! Health +20', 'happy');
    } else if (it.kind === 'boost') {
      var b = boosts(p);
      if (b[it.stat] >= D.BOOST.perStat) return res(false, it.name + ' has no more effect on ' + p.name + ' (max ' + D.BOOST.perStat + ')');
      if (boostTotal(p) >= D.BOOST.total) return res(false, p.name + ' has had all the boosts it can take (' + D.BOOST.total + ')');
      b[it.stat]++; p.boost = b;
      r = res(true, it.stat.toUpperCase() + ' +' + D.BOOST.pct + '% for good!', 'happy');
    }
    if (r && r.ok) state.inv[id] = count(state, id) - 1;
    return r || res(false, 'Nothing happened');
  }
  function owned(state, kinds) {
    wallet(state);
    return Object.keys(D.ITEMS).filter(function (id) { return count(state, id) > 0 && (!kinds || kinds.indexOf(D.ITEMS[id].kind) >= 0); });
  }
  function cleanInv(inv) {
    var o = {};
    if (inv && typeof inv === 'object') Object.keys(inv).forEach(function (k) { if (D.ITEMS[k]) { var n = U.int(inv[k], 0, 0, E.maxStack); if (n) o[k] = n; } });
    return o;
  }
  function cleanWallet(w) {
    w = w && typeof w === 'object' ? w : {};
    var num = function (v) { return Number.isFinite(v) ? Math.round(v) : null; };
    return { coins: U.int(w.coins, E.startCoins, 0, E.maxCoins), day: num(w.day), earned: U.int(w.earned, 0, 0, E.dailyCap),
      lastDaily: num(w.lastDaily), streak: U.int(w.streak, 0, 0, 9999),
      mistakesAt: w.mistakesAt && typeof w.mistakesAt.id === 'string' ? { id: w.mistakesAt.id.slice(0, 40), n: U.int(w.mistakesAt.n, 0, 0) } : null };
  }

  PP.Shop = { wallet: wallet, coins: coins, dayOf: dayOf, add: add, earn: earn, battleCoins: battleCoins, claimDaily: claimDaily,
    count: count, buy: buy, buyShell: buyShell, use: use, owned: owned, boxSize: boxSize, nextSlotPrice: nextSlotPrice, buySlot: buySlot,
    boosts: boosts, boostTotal: boostTotal, boostPct: boostPct, cleanBoost: cleanBoost, cleanInv: cleanInv, cleanWallet: cleanWallet };
})(typeof window !== 'undefined' ? window : globalThis);
