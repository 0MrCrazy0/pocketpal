/* PocketPal 2 - optional online features. Leave both empty to play fully offline
 * (the default). See README "Optional server" to deploy cloudflare-worker.js yourself. */
(function (root) {
  var PP = root.PP = root.PP || {};
  PP.CONFIG = {
    relayUrl: '',        // e.g. 'https://pocketpal2-relay.yourname.workers.dev' (no trailing slash)
    vapidPublicKey: ''   // public VAPID key for care-alert push notifications (optional)
  };
})(typeof window !== 'undefined' ? window : globalThis);
