/* PocketPal 2 - optional online features. Leave both empty to play fully offline
 * (the default). See README "Optional server" to deploy cloudflare-worker.js yourself. */
(function (root) {
  var PP = root.PP = root.PP || {};
  PP.CONFIG = {
    relayUrl: 'https://pocketpal.crzymn05.workers.dev',        // e.g. 'https://pocketpal2-relay.yourname.workers.dev' (no trailing slash)
    vapidPublicKey: 'f9100eb3886a40aa8a76d71cc308428b'   // public VAPID key for care-alert push notifications (optional)
  };
})(typeof window !== 'undefined' ? window : globalThis);
