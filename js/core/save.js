/* PocketPal 2 - saving (pure; storage is injected so Node tests can use a fake).
 * - New save keys (PocketPal 1 saves are never read or touched).
 * - Versioned schema: { schema, savedAt, state }.
 * - A backup copy is refreshed at most every 10 minutes and after every good load.
 * - If the main save cannot be read, the raw text is kept under the "corrupt" key
 *   and the backup is used; if that fails too, a fresh game starts. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;

  var KEY = 'pocketpal2.rewrite.save';
  var BACKUP_KEY = 'pocketpal2.rewrite.backup';
  var CORRUPT_KEY = 'pocketpal2.rewrite.corrupt';
  var SCHEMA = 4;
  var MIGRATIONS = {
    /* 1 -> 2: Paldex, shell colours, first-run guide flag, notification opt-in. */
    1: function (st) {
      st = st || {};
      st.dex = {}; st.unlocks = [];
      st.settings = st.settings || {};
      st.settings.shell = 'pink'; st.settings.guideSeen = true; st.settings.notify = false; // existing players skip the guide
      PP.Collection.syncFromState(st);
      PP.Collection.checkUnlocks(st);
      return st;
    },
    /* 2 -> 3: Pal Store wallet + bag. Everyone starts with the welcome coins. */
    2: function (st) {
      st = st || {};
      st.wallet = { coins: D.ECONOMY.startCoins, day: null, earned: 0, lastDaily: null, streak: 0, mistakesAt: null };
      st.inv = {};
      return st;
    },
    /* 3 -> 4: 12/24-hour clock (from the browser locale); per-pal sleep schedules start on the stage defaults. */
    3: function (st) {
      st = st || {};
      st.settings = st.settings || {};
      st.settings.clock = PP.Time.defaultClock();
      (st.slots || []).forEach(function (p) { if (p && typeof p === 'object') { p.sched = null; p.schedAt = null; } });
      return st;
    }
  };

  /* Pal Box size: the saved number of unlocked slots (4..12), but NEVER smaller than
   * what is needed to keep every pal. Pals sitting past the unlocked count (a corrupt
   * or edited save) move into free unlocked slots, or the box grows to fit them. */
  function sanitizeSlots(s) {
    var raw = Array.isArray(s.slots) ? s.slots.slice(0, D.BOX.max * 2).map(sanitizePet) : [];
    var size = U.int(s.boxSize != null ? s.boxSize : raw.length, D.BOX.start, D.BOX.start, D.BOX.max);
    var slots = raw.slice(0, size), extra = [], active = U.int(s.active, 0, 0, raw.length ? raw.length - 1 : 0), newActive = null;
    while (slots.length < size) slots.push(null);
    raw.slice(size).forEach(function (p, j) { if (p) extra.push({ p: p, from: size + j }); });
    extra.forEach(function (x) {
      var i = slots.indexOf(null);
      if (i < 0 && slots.length < D.BOX.max) { slots.push(null); i = slots.length - 1; }
      if (i < 0) return;                          // more than 12 pals: impossible in play, drop the overflow
      slots[i] = x.p;
      if (x.from === active) newActive = i;
    });
    if (newActive == null) newActive = active < slots.length ? active : 0;
    return { slots: slots, active: newActive };
  }

  function cleanRef(r, depth) {
    if (!r || typeof r !== 'object') return null;
    var o = { id: String(r.id || '').slice(0, 40), name: PP.Pet.cleanName(r.name) || '?',
      species: D.SPECIES.indexOf(r.species) >= 0 ? r.species : null, form: D.FORMS.indexOf(r.form) >= 0 ? r.form : null,
      sex: r.sex === 'F' ? 'F' : r.sex === 'M' ? 'M' : null, gen: U.int(r.gen, 1, 1, 999) };
    if (depth < 1) o.parents = Array.isArray(r.parents) ? r.parents.slice(0, 2).map(function (g) { return cleanRef(g, depth + 1); }) : [];
    return o;
  }

  function sanitizePet(p) {
    if (!p || typeof p !== 'object') return null;
    if (D.SPECIES.indexOf(p.species) < 0) return null;
    if (D.STAGES.indexOf(p.stage) < 0) return null;
    if (typeof p.id !== 'string' || !p.id) return null;
    var base = PP.Pet.createEgg({ species: p.species, seed: p.seed, now: U.num(p.createdAt, Date.now()) });
    var out = Object.assign(base, p);
    out.seed = (U.int(p.seed, base.seed) >>> 0) || 1;
    out.name = PP.Pet.cleanName(p.name) || base.name;
    out.sex = p.sex === 'F' ? 'F' : 'M';
    out.genes = PP.Pet.sanitizeGenes(p.genes);
    out.form = out.stage === 'adult' ? (D.FORMS.indexOf(p.form) >= 0 ? p.form : 'good') : null;
    ['hunger', 'happy'].forEach(function (k) { out[k] = U.int(p[k], 2, 0, 4); });
    out.poop = U.int(p.poop, 0, 0, 4);
    out.energy = U.num(p.energy, 80, 0, 100);
    out.health = U.num(p.health, 100, 0, 100);
    out.discipline = U.num(p.discipline, 0, 0, 100);
    out.weight = U.num(p.weight, 5, 1, 999);
    out.clock = U.int(p.clock, 0, 0); out.ageMin = U.int(p.ageMin, 0, 0); out.stageMin = U.int(p.stageMin, 0, 0);
    out.lastTickAt = U.num(p.lastTickAt, Date.now());
    out.mistakes = U.int(p.mistakes, 0, 0, 999); out.totalMistakes = U.int(p.totalMistakes, 0, 0, 99999);
    out.acc = { hunger: U.num(p.acc && p.acc.hunger, 0, 0, 1), happy: U.num(p.acc && p.acc.happy, 0, 0, 1), poop: U.num(p.acc && p.acc.poop, 0, 0, 1) };
    out.evo = { moodSum: U.num(p.evo && p.evo.moodSum, 0, 0), moodN: U.int(p.evo && p.evo.moodN, 0, 0), trainings: U.int(p.evo && p.evo.trainings, 0, 0) };
    out.need = (p.need && typeof p.need === 'object') ? p.need : {};
    out.snacks = Array.isArray(p.snacks) ? p.snacks.filter(Number.isFinite).slice(-10) : [];
    out.mistakeLog = Array.isArray(p.mistakeLog) ? p.mistakeLog.map(String).slice(-12) : [];
    var at = Array.isArray(p.mistakeAt) ? p.mistakeAt.map(function (v) { return U.num(v, 0, 0); }) : [];
    while (at.length < out.mistakeLog.length) at.unshift(0);
    out.mistakeAt = out.mistakeLog.length ? at.slice(-out.mistakeLog.length) : [];
    out.sched = out.stage === 'egg' ? null : PP.Sleep.clean(p.sched, out.stage);
    out.schedAt = Number.isFinite(p.schedAt) ? Math.round(p.schedAt) : null;
    out.dayMin = Number.isFinite(p.dayMin) ? U.int(p.dayMin, 0, 0, 1439) : null;
    out.holdTo = Number.isFinite(p.holdTo) ? U.int(p.holdTo, 0, 0, 1439) : null;
    out.sick = !!p.sick; out.asleep = !!p.asleep; out.lights = p.lights !== false;
    out.fake = p.fake && Number.isFinite(p.fake.until) ? { until: p.fake.until } : null;
    if (out.stage === 'adult') {
      var cap = PP.Stats.levelCap(out.form);
      out.level = U.int(p.level, 1, 1, cap); out.xp = U.int(p.xp, 0, 0); out.sp = U.int(p.sp, 0, 0, 99);
      out.innate = Array.isArray(p.innate) ? p.innate.filter(function (id) { return PP.Skills.find(out.species, id); }).slice(0, 2) : [];
      out.skills = Array.isArray(p.skills) ? p.skills.filter(function (id, i, a) { return PP.Skills.find(out.species, id) && a.indexOf(id) === i; }) : [];
      if (!PP.Skills.validSet(out.species, out.level, out.skills, out.innate)) {
        // refund an impossible skill set rather than crash
        out.sp = PP.Stats.totalSpForLevel(out.level); out.skills = out.innate.slice();
      }
    }
    out.inheritedSkills = Array.isArray(p.inheritedSkills) ? p.inheritedSkills.filter(function (id) { return PP.Skills.find(out.species, id); }).slice(0, 2) : [];
    out.fate = (p.fate === 'dead' || p.fate === 'gone' || p.fate === 'released') ? p.fate : null;
    out.parents = Array.isArray(p.parents) && p.parents.length ? p.parents.slice(0, 2).map(function (r) { return cleanRef(r, 0); }) : null;
    out.boost = PP.Shop.cleanBoost(p.boost);
    return out;
  }

  function sanitizeState(s, now) {
    var fresh = PP.Game.newState(now || Date.now());
    if (!s || typeof s !== 'object') return fresh;
    var out = Object.assign(fresh, s);
    out.schema = SCHEMA;
    var box = sanitizeSlots(s);
    out.slots = box.slots; out.active = box.active; out.boxSize = out.slots.length;
    out.wallet = PP.Shop.cleanWallet(s.wallet);
    out.inv = PP.Shop.cleanInv(s.inv);
    out.album = Array.isArray(s.album) ? s.album.filter(function (a) { return a && typeof a.id === 'string' && D.SPECIES.indexOf(a.species) >= 0; }).slice(-200) : [];
    out.friends = Array.isArray(s.friends) ? s.friends.filter(function (c) { return !PP.Cards.validateCard(c); }).slice(0, 12) : [];
    out.arena = { rank: U.int(s.arena && s.arena.rank, 0, 0, D.ARENA.length - 1), attempt: U.int(s.arena && s.arena.attempt, 0, 0), champion: !!(s.arena && s.arena.champion) };
    out.dex = {};
    if (s.dex && typeof s.dex === 'object') Object.keys(s.dex).forEach(function (k) {
      var m = /^([a-z]+):([a-z]+)$/.exec(k), v = s.dex[k];
      if (!m || D.SPECIES.indexOf(m[1]) < 0 || PP.Collection.KEYS.indexOf(m[2]) < 0 || !v || typeof v !== 'object') return;
      var e = {}; if (Number.isFinite(v.r) && v.r > 0) e.r = v.r; if (Number.isFinite(v.s) && v.s > 0) e.s = v.s;
      if (e.r || e.s) out.dex[k] = e;
    });
    out.unlocks = Array.isArray(s.unlocks) ? s.unlocks.filter(function (id, i, a) { var sh = PP.Collection.shell(id); return sh && (sh.unlock || sh.price) && a.indexOf(id) === i; }) : [];
    var st = s.settings || {};
    var shell = PP.Collection.shell(st.shell) && PP.Collection.shellStatus(out, st.shell).ok ? st.shell : 'pink';
    out.settings = { sound: st.sound !== false, test: !!st.test, speed: U.num(st.speed, 1, 1, 3600), alerts: !!st.alerts,
      notify: !!st.notify, shell: shell, guideSeen: !!st.guideSeen, clock: st.clock === '12' || st.clock === '24' ? st.clock : PP.Time.defaultClock() };
    out.timeOffset = U.num(s.timeOffset, 0);
    out.lastSeenAt = U.num(s.lastSeenAt, now || Date.now());
    return out;
  }

  function serialize(state, now) {
    return JSON.stringify({ schema: SCHEMA, savedAt: now || Date.now(), state: state });
  }
  function parse(raw, now) {
    if (typeof raw !== 'string' || !raw) return { ok: false, error: 'empty' };
    var obj;
    try { obj = JSON.parse(raw); } catch (e) { return { ok: false, error: 'not JSON' }; }
    if (!obj || typeof obj !== 'object' || typeof obj.schema !== 'number' || !obj.state) return { ok: false, error: 'not a PocketPal 2 save' };
    if (obj.schema > SCHEMA) return { ok: false, error: 'made by a newer version' };
    var st = obj.state;
    for (var v = obj.schema; v < SCHEMA; v++) {
      if (!MIGRATIONS[v]) return { ok: false, error: 'no migration from ' + v };
      st = MIGRATIONS[v](st);
    }
    try { return { ok: true, state: sanitizeState(st, now) }; } catch (e) { return { ok: false, error: 'invalid data' }; }
  }

  /* ---------------------------------------------------------------- transfer codes
   * A save you can copy to another device:  PP2SAVE-1-<length>-<checksum>-<base64url JSON>
   * 1 = code format version (the save's own schema number is inside the JSON).
   * The checksum (FNV-1a 32-bit over the JSON) catches typos and half-copied codes. */
  var CODE_PREFIX = 'PP2SAVE', CODE_VERSION = 1;
  function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; }
  function b64enc(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64dec(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }
  function exportCode(state, now) {
    var json = serialize(state, now);
    var hex = ('0000000' + fnv(json).toString(16)).slice(-8);
    return CODE_PREFIX + '-' + CODE_VERSION + '-' + json.length + '-' + hex + '-' + b64enc(json);
  }
  function summary(state, savedAt) {
    var pals = state.slots.filter(Boolean).map(function (p) { return p.name + ' (' + PP.Pet.formName(p) + ')'; });
    return { pals: pals, album: state.album.length, savedAt: savedAt || null, dex: PP.Collection.counts(state).adults };
  }
  /* Accepts a transfer code (or a raw exported JSON save). Never throws. */
  function importCode(text, now) {
    var t = String(text == null ? '' : text).replace(/\s+/g, '');
    if (!t) return { ok: false, error: 'Paste a save code first' };
    if (t.charAt(0) === '{') {
      var raw = parse(String(text).trim(), now);
      if (!raw.ok) return { ok: false, error: 'Not a valid save (' + raw.error + ')' };
      return { ok: true, state: raw.state, info: summary(raw.state, null) };
    }
    var m = /^PP2SAVE-(\d+)-(\d+)-([0-9a-f]{8})-([A-Za-z0-9_-]+)$/.exec(t);
    if (!m) return { ok: false, error: t.indexOf(CODE_PREFIX) === 0 ? 'Code looks cut off or changed' : 'Not a PocketPal 2 save code' };
    if (+m[1] > CODE_VERSION) return { ok: false, error: 'Code made by a newer version of PocketPal 2' };
    var json;
    try { json = b64dec(m[4]); } catch (e) { return { ok: false, error: 'Code is damaged (bad characters)' }; }
    if (json.length !== +m[2] || ('0000000' + fnv(json).toString(16)).slice(-8) !== m[3]) return { ok: false, error: 'Code is damaged or incomplete (checksum mismatch)' };
    var r = parse(json, now);
    if (!r.ok) return { ok: false, error: 'Save inside the code is not valid (' + r.error + ')' };
    var savedAt = null; try { savedAt = JSON.parse(json).savedAt || null; } catch (e) {}
    return { ok: true, state: r.state, info: summary(r.state, savedAt) };
  }

  function safeGet(storage, k) { try { return storage.getItem(k); } catch (e) { return null; } }
  function safeSet(storage, k, v) { try { storage.setItem(k, v); return true; } catch (e) { return false; } }

  /* Returns { state, status: 'new'|'ok'|'backup'|'reset', message } */
  function load(storage, now) {
    now = now || Date.now();
    var raw = safeGet(storage, KEY);
    if (raw) {
      var r = parse(raw, now);
      if (r.ok) { safeSet(storage, BACKUP_KEY, raw); return { state: r.state, status: 'ok', message: '' }; }
      safeSet(storage, CORRUPT_KEY, raw);
    }
    var braw = safeGet(storage, BACKUP_KEY);
    if (braw) {
      var b = parse(braw, now);
      if (b.ok) return { state: b.state, status: 'backup', message: raw ? 'Save was damaged - restored the backup copy.' : 'Restored from backup.' };
    }
    return { state: PP.Game.newState(now), status: raw ? 'reset' : 'new',
      message: raw ? 'Save could not be read. A copy was kept; starting fresh.' : '' };
  }
  function save(storage, state, now) {
    now = now || Date.now();
    state.lastSeenAt = now;
    var json = serialize(state, now);
    var ok = safeSet(storage, KEY, json);
    if (!ok) {   // storage full: free the spare copies (corrupt text, pre-import copy, backup) and try once more
      try { storage.removeItem(CORRUPT_KEY); storage.removeItem(KEY + '.preimport'); storage.removeItem(BACKUP_KEY); } catch (e) {}
      state._backupAt = 0;
      ok = safeSet(storage, KEY, json);
    }
    if (ok && (!state._backupAt || now - state._backupAt > 10 * U.MIN)) {
      state._backupAt = now;
      safeSet(storage, BACKUP_KEY, serialize(state, now));
    }
    return ok;
  }
  function wipe(storage) {
    try { storage.removeItem(KEY); storage.removeItem(BACKUP_KEY); } catch (e) {}
  }

  PP.Save = { KEY: KEY, BACKUP_KEY: BACKUP_KEY, CORRUPT_KEY: CORRUPT_KEY, SCHEMA: SCHEMA,
    load: load, save: save, parse: parse, serialize: serialize, sanitizeState: sanitizeState, sanitizePet: sanitizePet, wipe: wipe,
    exportCode: exportCode, importCode: importCode, checksum: fnv };
})(typeof window !== 'undefined' ? window : globalThis);
