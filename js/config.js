/* PocketPal 2 — optional online features.
 * Game play works fully offline. This only talks to YOUR Cloudflare worker
 * for short battle codes and closed-app care pings. */
(function (root) {
  var PP = root.PP = root.PP || {};
  PP.CONFIG = {
    /* Live worker that already answers /health as pocketpal2 */
    relayUrl: 'https://pocketpal.crzymn05.workers.dev',
    /* Uncompressed P-256 VAPID public key (must match the worker env var). */
    vapidPublicKey: 'BN-qf4WEpplazcI2S5o_Kd9ELGih3LArb873Rs9p37k7Y_aLvyzeoQ8PHAd1Y7ay2hQqaL2KDbezDjgsmuLyDAk'
  };
})(typeof window !== 'undefined' ? window : globalThis);
