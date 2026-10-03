/* PocketPal — optional online features.
 * Game play works fully offline. This only talks to YOUR Cloudflare worker: for closed-app
 * care reminders when the player turns Care alerts ON (bell / Settings), for the optional
 * encrypted cloud save, and (1.9.7) for LIVE friend battles in a room. Battle codes (pasted
 * snapshots) still never use the network. */
(function (root) {
  var PP = root.PP = root.PP || {};
  PP.CONFIG = {
    /* Your live worker (see DEPLOY.md). Leave '' to switch care pings, cloud save and live battles off.
     * (Optional liveUrl: a different worker for live battles only.) */
    relayUrl: 'https://pocketpal.crzymn05.workers.dev',
    /* Uncompressed P-256 VAPID public key (must match the worker env var). */
    vapidPublicKey: 'BN-qf4WEpplazcI2S5o_Kd9ELGih3LArb873Rs9p37k7Y_aLvyzeoQ8PHAd1Y7ay2hQqaL2KDbezDjgsmuLyDAk'
  };
})(typeof window !== 'undefined' ? window : globalThis);
