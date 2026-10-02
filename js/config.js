/* PocketPal — optional online features.
 * Game play works fully offline. This only talks to YOUR Cloudflare worker, and only
 * for closed-app care pings when the player turns Care alerts ON (bell / Settings).
 * Friend battles never use the network (battle codes are pasted snapshots). */
(function (root) {
  var PP = root.PP = root.PP || {};
  PP.CONFIG = {
    /* Your live worker (see DEPLOY.md). Leave '' to switch care pings off entirely. */
    relayUrl: 'https://pocketpal.crzymn05.workers.dev',
    /* Uncompressed P-256 VAPID public key (must match the worker env var). */
    vapidPublicKey: 'BN-qf4WEpplazcI2S5o_Kd9ELGih3LArb873Rs9p37k7Y_aLvyzeoQ8PHAd1Y7ay2hQqaL2KDbezDjgsmuLyDAk'
  };
})(typeof window !== 'undefined' ? window : globalThis);
