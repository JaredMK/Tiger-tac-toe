// The connection: the Firebase project's config, the SDK fetched on first use, the server's time and
// its callable functions.
import { onAuthUser, redirectPending } from './accounts.js';
import { setFindOn } from './matchmaking.js';
import { setReleases } from './releases.js';
import { presenceUp, setNet } from './room.js';
import { commit, state } from '../ui/app.js';
import { render } from '../ui/render.js';
import { noteNet } from '../ui/turnbar.js';

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
export const FIREBASE_CDN = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/`;   // the SDK is fetched only when online play is chosen
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
function onConnected(on) {
  connected = on; noteNet();
  if (on && state.online && state.online.me) presenceUp();
  if (state.online) render();
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
export function bounce() {
  if (!fb) return;
  try { fb.m.goOffline(fb.db); fb.m.goOnline(fb.db); } catch (e) { /* (the SDK comes back by itself) */ }
}
export function call(name, data) { return fb.fnM.httpsCallable(fb.fns, name)(data || {}).then(r => r.data); }

// Setters for the names other modules reassign (an imported name is read-only there).
export function setCall(v) { call = v; }
export function setConnected(v) { connected = v; }
