// The connection: the Firebase project's config, the SDK fetched on first use, the server's time and
// its callable functions.
import { needVerify, onAuthUser, redirectPending, setVerifySince } from './accounts.js';
import { setFindOn } from './matchmaking.js';
import { NATIVE, clientInfo } from './platform.js';
import { setReleases } from './releases.js';
import { presenceUp, setNet } from './room.js';
import { commit, state } from '../ui/app.js';
import { render } from '../ui/render.js';
import { mustUpdate } from '../ui/update.js';
import { noteNet } from '../ui/turnbar.js';
import { tick } from '../ui/clock.js';

/* ===================== Online play (Firebase Realtime Database) =====================
 * Neither phone is the server. A room lives at /rooms/CODE in the database; both players read and
 * write it, and the database is the source of truth. A move is a transaction: it checks that it is
 * that player's turn and that the move is legal, applies it (the moving phone makes the random choices)
 * and passes the turn, all at once. Each phone then plays the move back on its own screen (the square
 * lit up on the board, the zoom, the animation), and a phone that was away plays back what it missed
 * from the record's last few moves. Hidden values live in the room's separate `secrets` node and are
 * never rendered before they are revealed. Presence uses onDisconnect; the turn clock is a server-time
 * deadline that either phone may call when it passes.
 */
// ---------- the Firebase project: production or staging, by the page's address (src/env.js, window.TTC_ENV) ----------
export const FIREBASE_CONFIG = (typeof window !== 'undefined' && window.TTC_ENV && window.TTC_ENV.config) || { apiKey: 'PASTE_', databaseURL: 'PASTE_' };
const FIREBASE_VERSION = '11.10.0';
// The SDK is fetched only when online play is chosen: from Google's CDN, or (the app: scripts/build-app.js) from its own copy (<meta name="ttc-sdk">).
const sdkMeta = typeof document !== 'undefined' && document.querySelector ? document.querySelector('meta[name="ttc-sdk"]') : null;
export const FIREBASE_CDN = sdkMeta && typeof sdkMeta.content === 'string' && sdkMeta.content ? new URL(sdkMeta.content, document.baseURI).href : `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;
export { FIREBASE_VERSION };
export const NET_MS = { connect: 12000, move: 8000, call: 20000 };   // (a server call can wait for a cold start)
export let fb = null, fbLoad = null;                      // the SDK: { m: database module, db, uid }
export let connected = false;
let serverOffset = 0;
export function configured() { const c = window.TTT_FIREBASE && window.TTT_FIREBASE.config || FIREBASE_CONFIG; return !!(c && c.apiKey && c.databaseURL && !/PASTE_/.test(c.apiKey + c.databaseURL)); }
export function serverNow() { return Date.now() + serverOffset; }

// ----- the SDK: fetched from Google's CDN only when online play is chosen, then an anonymous sign-in -----
export function loadFirebase() {
  if (fb) return Promise.resolve(fb);
  if (fbLoad) return fbLoad;
  fbLoad = (async () => {
    const hook = window.TTT_FIREBASE || null;              // the tests: local emulators (the friend-game tests: also a fixed user id, no accounts)
    const base = (hook && hook.cdn) || FIREBASE_CDN;
    const mock = !!(hook && hook.uid);
    const [appM, m, authM, fnM] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-database.js'),
      mock ? null : import(base + 'firebase-auth.js'), mock ? null : import(base + 'firebase-functions.js')]);
    const app = appM.initializeApp((hook && hook.config) || FIREBASE_CONFIG);
    await appCheck(app, base, hook);                        // (App Check first: every request after it carries the token)
    const db = m.getDatabase(app);
    if (hook && hook.emulator) m.connectDatabaseEmulator(db, hook.emulator.host, hook.emulator.port, mock ? { mockUserToken: { sub: hook.uid, user_id: hook.uid } } : undefined);
    const f = { m, db, uid: mock ? hook.uid : null, authM, fnM, auth: null, fns: null };
    if (!mock) {
      f.auth = authM.getAuth(app);
      if (hook && hook.auth) authM.connectAuthEmulator(f.auth, hook.auth, { disableWarnings: true });
      f.fns = fnM.getFunctions(app, 'us-central1');
      if (hook && hook.functions) fnM.connectFunctionsEmulator(f.fns, hook.functions.host, hook.functions.port);
      await f.auth.authStateReady();                        // the account from before, if this browser logged in
      if (redirectPending()) {                              // back from Google's sign-in page: finish that sign-in first
        try { await authM.getRedirectResult(f.auth); } catch (e) { f.redirectError = e; }
      }
      if (!f.auth.currentUser) await authM.signInAnonymously(f.auth);   // no account: a guest, which is all a friend game needs
      f.uid = f.auth.currentUser.uid;
    }
    fb = f;
    m.onValue(m.ref(db, '.info/serverTimeOffset'), s => { serverOffset = s.val() || 0; });
    m.onValue(m.ref(db, '.info/connected'), s => onConnected(!!s.val()));
    m.onValue(m.ref(db, 'features/findMatch'), s => setFindOn(s.val() === true), () => {});
    m.onValue(m.ref(db, 'config/verify/since'), s => setVerifySince(s.val()), () => {});   // (email verification's cutoff: accounts made before it are grandfathered, accounts.js)
    m.onValue(m.ref(db, 'releases'), s => setReleases(s.val() || {}), () => {});
    if (!mock) { onAuthUser(f.auth.currentUser); authM.onAuthStateChanged(f.auth, u => onAuthUser(u)); }
    return fb;
  })().catch(e => { fbLoad = null; throw e; });
  return fbLoad;
}
export async function connectFirebase() {
  if (!configured()) { setNet('error', 'Online play is not set up on this copy of the game: it needs a Firebase project (see the README, "Setting up Firebase").'); commit(); return false; }
  try {
    await Promise.race([loadFirebase(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_MS.connect))]);
    return true;
  } catch (e) {
    setNet('error', 'Online play needs an internet connection. Check it (switching to Wi-Fi helps) and try again.'); commit(); return false;
  }
}
export function onConnected(on) {
  connected = on; noteNet();
  if (on && state.online && state.online.me) presenceUp();
  if (on) lostClear(); else lostWatch();
  if (state.online) render();
}
// The connection lost during an online match: after NET_LOST.afterMs without it (a blip never shows), the banner
// "Connection lost — reconnecting…" (ui/turnbar.js netInfo, over the board and the mini-game), and the SDK's socket
// bounced every NET_LOST.retryMs until it is back (and the moment the page comes back into view: init below). The
// banner goes the moment .info/connected says so again.
export const NET_LOST = { afterMs: 3000, retryMs: 10000 };
export let netLost = false;
let lostTimer = null, retryTimer = null;
function lostWatch() {
  if (lostTimer || retryTimer) return;
  lostTimer = setTimeout(() => {
    lostTimer = null;
    if (connected) return;
    netLost = true; noteNet();
    if (state.online) { render(); bounce(); }                   // (outside a match the SDK's own retries do: nothing to show, nothing to force)
    retryTimer = setInterval(() => { if (connected) lostClear(); else if (state.online) bounce(); }, NET_LOST.retryMs);
  }, NET_LOST.afterMs);
}
function lostClear() {
  clearTimeout(lostTimer); clearInterval(retryTimer); lostTimer = retryTimer = null;
  if (!netLost) return;
  netLost = false; noteNet();
}
// Back in front (the app from the background, a tab shown again): the socket is bounced at once in an online match (it
// may be dead without the SDK's knowing: a fresh connection reads the record afresh; net/room.js then resyncs the
// record on the same event), and whenever the connection is down; then a tick of the clock (ui/clock.js: a deadline
// passed meanwhile is called in).
export function init() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !fb) return;
    if (state.online || !connected) bounce();
    tick();
  });
}
// A read past the SDK's connection (plain HTTP, this account's token): what the database holds now, even while the
// SDK's socket is dead without its knowing (it notices only after its keepalive fails, a minute or so). null: no answer.
export async function restGet(path, ms) {
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const q = [hook && hook.emulator ? `ns=${c.projectId}-default-rtdb` : null];
  if (fb && fb.auth && fb.auth.currentUser) q.push('auth=' + encodeURIComponent(await fb.auth.currentUser.getIdToken()));
  const url = (hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}` : c.databaseURL) + `/${path}.json?` + q.filter(Boolean).join('&');
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(ms || 4000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
// The SDK's connection dropped and made again: a dead socket is let go (its listeners read the database afresh;
// a write sent on it is given up, and the caller sends it again).
export let bounces = 0;                                   // (how many times: the tests)
export function bounce() {
  if (!fb) return;
  bounces++;
  try { fb.m.goOffline(fb.db); fb.m.goOnline(fb.db); } catch (e) { /* (the SDK comes back by itself) */ }
}
// App Check: the page proves it is a real copy of the site (reCAPTCHA Enterprise, invisible) and every database and
// function request carries the token; the server refuses requests without one once enforcement is on (functions:
// TTC_APPCHECK; the database: the console). Off where the project has no key yet (src/env.js appCheckKey), and
// never in the tests or the emulators. On localhost a debug token is used (the console lists it to allow).
async function appCheck(app, base, hook) {
  const key = window.TTC_ENV && window.TTC_ENV.appCheckKey;
  if (!key || hook) return;
  try {
    if (!NATIVE && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;   // (the app's own address is localhost too: it proves itself natively, docs/ios-plan.md)
    const ac = await import(base + 'firebase-app-check.js');
    ac.initializeAppCheck(app, { provider: new ac.ReCaptchaEnterpriseProvider(key), isTokenAutoRefreshEnabled: true });
  } catch (e) { console.warn('[App Check] not started', e && e.message); }
}
// Every server call says which client sent it (its version and platform: core/client.js), for what the server may deal it and whether it must update first.
export function call(name, data) {
  return fb.fnM.httpsCallable(fb.fns, name)(Object.assign({}, data || {}, { client: clientInfo() })).then(r => r.data, e => {
    if (e && e.details && e.details.update === true) { mustUpdate(); render(); }   // too old for the server: "Please update" (ui/update.js)
    if (e && e.details && e.details.verify === true) needVerify();                 // an email not yet proved: "Verify your email" (net/accounts.js)
    throw e;
  });
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setCall(v) { call = v; }
export function setConnected(v) { connected = v; }
export function setFb(v) { fb = v; }   // (the tests: a stand-in SDK)
