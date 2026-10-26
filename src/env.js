/* Which Firebase project this page talks to, picked by the address it was opened at (a plain script, loaded
 * before the modules by index.html and admin.html: window.TTC_ENV).
 *   production: tictacchaos.com (www redirects there), and the production project's own Firebase addresses;
 *   staging:    staging.tictacchaos.com, and every other address (the staging project's Firebase addresses,
 *               localhost): a page that is not production never touches production's data.
 * On the two custom domains, Google sign-in goes through the page's own domain (/__/auth/handler, served by
 * Firebase Hosting), so it keeps working in browsers that block third-party cookies.
 * The web config is not a secret: it names the project; its security rules decide what anyone can do. */
(function () {
  var CONFIGS = {
    production: {
      apiKey: 'AIzaSyDnugsFX6N1chaeGHiKOfBiiUFTSYTX9SU',
      authDomain: 'tic-tac-chaos.firebaseapp.com',
      databaseURL: 'https://tic-tac-chaos-default-rtdb.firebaseio.com',
      projectId: 'tic-tac-chaos',
      appId: '1:475136918613:web:3e63ed7ceaf1e253ed40dc',
      appCheckKey: '',                              // reCAPTCHA Enterprise site key (Firebase console: App Check); empty: App Check off
    },
    staging: {                                      // the staging project's web app (Firebase console: Project settings, Your apps)
      apiKey: 'AIzaSyDVTEmY_gI1Rv-K1Kg7gG41OtHj_sEOsQ0',
      authDomain: 'tic-tac-chaos-staging.firebaseapp.com',
      databaseURL: 'https://tic-tac-chaos-staging-default-rtdb.firebaseio.com',
      projectId: 'tic-tac-chaos-staging',
      appId: '1:695949456928:web:0b6516fa9ed7ca92572e45',
      appCheckKey: '',
    },
  };
  var PRODUCTION_HOSTS = ['tictacchaos.com', 'www.tictacchaos.com', 'tic-tac-chaos.web.app', 'tic-tac-chaos.firebaseapp.com'];
  var OWN_AUTH_DOMAIN = ['tictacchaos.com', 'staging.tictacchaos.com'];
  // forced: the app's build names its project (a <meta name="ttc-env"> tag: the app's address, capacitor://localhost, says nothing).
  function pick(host, forced) {
    host = String(host || '').toLowerCase();
    var name = forced === 'production' || forced === 'staging' ? forced : PRODUCTION_HOSTS.indexOf(host) >= 0 ? 'production' : 'staging', config = {}, k;
    for (k in CONFIGS[name]) config[k] = CONFIGS[name][k];
    if (OWN_AUTH_DOMAIN.indexOf(host) >= 0) config.authDomain = host;
    var appCheckKey = config.appCheckKey || ''; delete config.appCheckKey;   // (App Check's key rides beside the web config, not in it)
    return { name: name, staging: name === 'staging', config: config, appCheckKey: appCheckKey };
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = { pick: pick, CONFIGS: CONFIGS, PRODUCTION_HOSTS: PRODUCTION_HOSTS }; return; }   // (the tests)
  var meta = document.querySelector('meta[name="ttc-env"]');
  var env = pick(location.hostname, meta && meta.getAttribute('content'));
  window.TTC_ENV = env;
  if (env.staging) {                                // a small badge in a corner, over everything, never in the way of a tap
    var badge = function () {
      if (document.getElementById('stagebadge')) return;
      var b = document.createElement('div');
      b.id = 'stagebadge'; b.textContent = 'STAGING'; b.setAttribute('aria-hidden', 'true');
      b.style.cssText = 'position:fixed;left:6px;bottom:calc(6px + env(safe-area-inset-bottom));z-index:9999;pointer-events:none;padding:2px 6px;border-radius:5px;background:#d9622b;color:#fff;font:700 10px/1.3 system-ui,sans-serif;letter-spacing:.08em;opacity:.85';
      document.body.appendChild(b);
    };
    if (document.body) badge(); else document.addEventListener('DOMContentLoaded', badge);
  }
})();
