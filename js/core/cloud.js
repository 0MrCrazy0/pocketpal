/* PocketPal 1.9.0 - cloud save crypto (no DOM; uses Web Crypto, so it also runs in Node 20).
 *
 * Opt-in and end-to-end encrypted:
 *  - The game makes a random RECOVERY CODE (128 bits, shown once, like "K7QM-2D9X-...").
 *  - id    = SHA-256("pp-cloud-id:" + code)    -> where the blob is filed on the server
 *  - token = SHA-256("pp-cloud-token:" + code) -> proves you may overwrite / delete it
 *            (the server only keeps SHA-256 of the token)
 *  - key   = PBKDF2-SHA-256(code + optional passphrase, random salt, 150 000 rounds) -> AES-GCM-256
 *  The server never sees the code, the passphrase, the key or the plain save. Lose the code
 *  (and the passphrase, if you set one) and the cloud copy cannot be opened by anyone. */
(function (root) {
  'use strict';
  var PP = root.PP = root.PP || {};
  var ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   // no 0/O, 1/I/L
  var ROUNDS = 150000;
  function subtle() { var c = root.crypto || (typeof globalThis !== 'undefined' && globalThis.crypto); if (!c || !c.subtle) throw new Error('This browser has no Web Crypto'); return c; }
  function enc(s) { return new TextEncoder().encode(s); }
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function b64u(buf) { var s = '', b = new Uint8Array(buf); for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function unb64u(s) { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; var bin = atob(s), out = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; }
  function rand(n) { var a = new Uint8Array(n); subtle().getRandomValues(a); return a; }

  /* 26 symbols from a 31-letter alphabet (~128 bits), shown in groups of 4. */
  function newCode() {
    var r = rand(26), s = '';
    for (var i = 0; i < 26; i++) s += ALPHA[r[i] % ALPHA.length];   // tiny modulo bias, still > 125 bits
    return format(s);
  }
  function normalize(code) {
    return String(code || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  }
  function format(code) { return normalize(code).replace(/(.{4})(?=.)/g, '$1-'); }
  function valid(code) {
    var n = normalize(code);
    if (n.length !== 26) return false;
    for (var i = 0; i < n.length; i++) if (ALPHA.indexOf(n[i]) < 0) return false;
    return true;
  }
  function sha(s) { return subtle().subtle.digest('SHA-256', enc(s)).then(hex); }
  function ids(code) {
    var n = normalize(code);
    return Promise.all([sha('pp-cloud-id:' + n), sha('pp-cloud-token:' + n)]).then(function (r) { return { id: r[0], token: r[1] }; });
  }
  function deriveKey(code, pass, salt) {
    var c = subtle().subtle;
    return c.importKey('raw', enc(normalize(code) + '\n' + String(pass || '')), 'PBKDF2', false, ['deriveKey']).then(function (base) {
      return c.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt, iterations: ROUNDS }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    });
  }
  /* -> { v, salt, iv, ct, at } (all base64url) */
  function encrypt(text, code, pass, now) {
    var salt = rand(16), iv = rand(12);
    return deriveKey(code, pass, salt).then(function (key) {
      return subtle().subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, enc(text));
    }).then(function (ct) { return { v: 1, salt: b64u(salt), iv: b64u(iv), ct: b64u(ct), at: now || Date.now() }; });
  }
  /* Rejects with Error('wrong code or passphrase') when the key does not fit. */
  function decrypt(blob, code, pass) {
    if (!blob || blob.v !== 1) return Promise.reject(new Error('not a PocketPal cloud save'));
    return deriveKey(code, pass, unb64u(blob.salt)).then(function (key) {
      return subtle().subtle.decrypt({ name: 'AES-GCM', iv: unb64u(blob.iv) }, key, unb64u(blob.ct));
    }).then(function (pt) { return new TextDecoder().decode(pt); }, function () { throw new Error('wrong code or passphrase'); });
  }
  PP.Cloud = { newCode: newCode, normalize: normalize, format: format, valid: valid, ids: ids, encrypt: encrypt, decrypt: decrypt, ROUNDS: ROUNDS };
})(typeof window !== 'undefined' ? window : globalThis);
