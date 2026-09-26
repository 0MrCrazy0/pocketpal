/* PocketPal 2 - battle codes (pure).
 * A battle code carries a pal's "battle card" so friends can fight (or breed with)
 * it completely offline:   PP2-<base64url JSON>-<4 char checksum>
 * Everything is re-validated on import and stats are recomputed locally, so an
 * edited code cannot create an impossible pal. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var U = PP.util, D = PP.DATA;
  var B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  var MAX_LEN = 700;

  function b64enc(str) {
    var out = '', i;
    for (i = 0; i < str.length; i += 3) {
      var a = str.charCodeAt(i), b = str.charCodeAt(i + 1), c = str.charCodeAt(i + 2);
      var n = (a << 16) | ((b || 0) << 8) | (c || 0);
      out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < str.length ? B64[(n >> 6) & 63] : '') + (i + 2 < str.length ? B64[n & 63] : '');
    }
    return out;
  }
  function b64dec(s) {
    var out = '', buf = 0, bits = 0;
    for (var i = 0; i < s.length; i++) {
      var v = B64.indexOf(s[i]);
      if (v < 0) throw new Error('bad char');
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out += String.fromCharCode((buf >> bits) & 255); }
    }
    return out;
  }
  function checksum(s) { return ('0000' + (U.hash('pp2card', s) % 1679616).toString(36)).slice(-4); }

  function cardFromPet(p) {
    return { id: p.id, name: p.name, species: p.species, sex: p.sex, form: p.form, level: p.level,
      genes: { hp: p.genes.hp, atk: p.genes.atk, def: p.genes.def, spd: p.genes.spd },
      skills: (p.skills || []).slice(), innate: (p.innate || []).slice(), gen: p.gen || 1, stage: 'adult',
      boost: PP.Shop ? PP.Shop.boosts(p) : undefined };
  }
  function encode(p) {
    if (!p || p.stage !== 'adult') return null;
    var c = cardFromPet(p), tree = PP.Skills.tree(c.species).map(function (s) { return s.id; });
    var payload = { v: 1, i: c.id, n: c.name, s: D.SPECIES.indexOf(c.species), x: c.sex, f: D.FORMS.indexOf(c.form), l: c.level,
      g: [c.genes.hp, c.genes.atk, c.genes.def, c.genes.spd],
      k: c.skills.map(function (id) { return tree.indexOf(id); }), in: c.innate.map(function (id) { return tree.indexOf(id); }), gen: c.gen };
    if (c.boost && PP.Shop.boostTotal(c)) payload.b = [c.boost.hp, c.boost.atk, c.boost.def, c.boost.spd];   // Pal Store boosts (optional, capped)
    var json = JSON.stringify(payload);
    return 'PP2-' + b64enc(json) + '-' + checksum(json);
  }
  function fail(e) { return { ok: false, error: e }; }
  function validateCard(c) {
    if (!c || typeof c !== 'object') return 'Not a card';
    if (D.SPECIES.indexOf(c.species) < 0) return 'Unknown species';
    if (D.FORMS.indexOf(c.form) < 0) return 'Unknown form';
    if (c.sex !== 'M' && c.sex !== 'F') return 'Bad sex';
    if (!(c.level >= 1 && c.level <= PP.Stats.levelCap(c.form) && Math.floor(c.level) === c.level)) return 'Level not possible for this form';
    var g = c.genes || {};
    var gk = ['hp', 'atk', 'def', 'spd'];
    for (var i = 0; i < gk.length; i++) if (!(Number.isInteger(g[gk[i]]) && g[gk[i]] >= -3 && g[gk[i]] <= 3)) return 'Bad genes';
    if (!PP.Skills.validSet(c.species, c.level, c.skills, c.innate)) return 'Impossible skill set';
    if (!(Number.isInteger(c.gen) && c.gen >= 1 && c.gen <= 999)) return 'Bad generation';
    if (typeof c.id !== 'string' || !/^[a-z0-9]{4,16}$/.test(c.id)) return 'Bad id';
    if (c.boost != null) {
      var b = c.boost, cb = PP.Shop.cleanBoost(b);
      for (var j = 0; j < gk.length; j++) if (b[gk[j]] !== cb[gk[j]]) return 'Boosts over the Pal Store cap';
    }
    return null;
  }
  function decode(code) {
    if (typeof code !== 'string') return fail('No code');
    code = code.replace(/\s+/g, '');
    if (code.length > MAX_LEN) return fail('Code too long');
    var m = /^PP2-([A-Za-z0-9_-]+)-([0-9a-z]{4})$/.exec(code);
    if (!m) return fail('Not a PocketPal 2 battle code');
    var json;
    try { json = b64dec(m[1]); } catch (e) { return fail('Code is damaged'); }
    if (checksum(json) !== m[2]) return fail('Code is damaged (checksum)');
    var p;
    try { p = JSON.parse(json); } catch (e) { return fail('Code is damaged'); }
    if (!p || p.v !== 1) return fail('Unsupported code version');
    var species = D.SPECIES[p.s];
    if (!species) return fail('Unknown species');
    var tree = PP.Skills.tree(species).map(function (s) { return s.id; });
    function ids(a) { return Array.isArray(a) ? a.map(function (i) { return tree[i]; }) : null; }
    var card = { id: String(p.i || ''), name: PP.Pet.cleanName(p.n) || 'Friend', species: species, sex: p.x, form: D.FORMS[p.f], level: p.l,
      genes: { hp: Array.isArray(p.g) ? p.g[0] : null, atk: Array.isArray(p.g) ? p.g[1] : null, def: Array.isArray(p.g) ? p.g[2] : null, spd: Array.isArray(p.g) ? p.g[3] : null },
      skills: ids(p.k), innate: ids(p.in) || [], gen: p.gen, stage: 'adult' };
    if (p.b != null) {
      if (!Array.isArray(p.b) || p.b.length !== 4) return fail('Bad boosts');
      card.boost = { hp: p.b[0], atk: p.b[1], def: p.b[2], spd: p.b[3] };
    }
    if (card.skills && card.skills.some(function (s) { return !s; })) return fail('Impossible skill set');
    if (card.innate.some(function (s) { return !s; })) return fail('Impossible skill set');
    var err = validateCard(card);
    if (err) return fail(err);
    return { ok: true, card: card };
  }

  PP.Cards = { encode: encode, decode: decode, validateCard: validateCard, cardFromPet: cardFromPet, _b64enc: b64enc, _b64dec: b64dec };
})(typeof window !== 'undefined' ? window : globalThis);
