// Accounts: signing in (Google, email), the username, the account kept on this phone.
import { NET_MS, call, configured, fb, loadFirebase } from './connect.js';
import { enterMatched, search, startSearch, stopSearch } from './matchmaking.js';
import { hostRoom } from './room.js';
import { flushLocal, track } from './tracking.js';
import { commit, save, state } from '../ui/app.js';
import { KEY } from '../ui/config.js';
import { render } from '../ui/render.js';
import { openProfile, prof, setProf } from '../ui/screens/profile.js';

export let acct = { user: null, profile: null, active: null, ready: false };   // the logged-in player (user null: a guest)
let acctUnsubs = [];
export let afterLogin = null;                       // where to go once logged in and named: 'find', 'profile' or 'host'
export let loginMsg = null, loginBusy = false, loginMail = '', loginPass = '', unameMsg = null, unameDraft = '';
const ACCT_KEY = KEY + '.acct';

export function loggedIn() { return !!(acct.user && acct.profile && acct.profile.username); }
function rememberAccount(on) { try { if (on) localStorage.setItem(ACCT_KEY, '1'); else localStorage.removeItem(ACCT_KEY); } catch (e) { /* no storage */ } }
export function hadAccount() { try { return localStorage.getItem(ACCT_KEY) === '1'; } catch (e) { return false; } }
// A Google sign-in that left the page (a redirect, when the browser would not open the sign-in window):
// where the player was heading, kept until the page is back and the sign-in is finished.
const LOGIN_KEY = KEY + '.login';
function loginPending(v) {
  try {
    if (v === undefined) return localStorage.getItem(LOGIN_KEY);
    if (v) localStorage.setItem(LOGIN_KEY, v); else localStorage.removeItem(LOGIN_KEY);
  } catch (e) { /* no storage */ }
  return null;
}
export function redirectPending() {
  if (loginPending()) return true;
  try { return Object.keys(sessionStorage).some(k => k.startsWith('firebase:pendingRedirect')); } catch (e) { return false; }
}
// The page is back from a redirect sign-in (or a sign-in finished while it was away): the menu, logged
// in, or the username to pick first. Never the login buttons again unless the sign-in failed.
export let loginFinishing = false;
export function finishLogin() {
  const go = loginPending();
  loginPending(null);
  if (fb && fb.redirectError) {
    const msg = authError(fb.redirectError);
    fb.redirectError = null;
    if (msg && !(acct.user)) { loginMsg = msg; state.screen = 'login'; save(); return; }
  }
  if (!go || !acct.user) return;
  afterLogin = ['find', 'profile', 'host'].includes(go) ? go : null;
  loginFinishing = true;
  if (state.screen !== 'username') state.screen = 'login';   // shows "Logging you in…" until the profile is in
  afterAccount();
  save();
}
// The SDK and a session, without any error on screen: the account screens say what went wrong themselves.
export async function connectQuiet() {
  if (!configured()) return false;
  try { await Promise.race([loadFirebase(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_MS.connect))]); return !!(fb && fb.auth); }
  catch (e) { return false; }
}

// The signed-in user changed (or the page started): follow their profile and their matchmaking game.
export function onAuthUser(u) {
  if (!fb || !fb.auth) return;
  if (!u) { fb.authM.signInAnonymously(fb.auth).catch(() => {}); return; }   // logged out: a guest again, for friend games
  fb.uid = u.uid;
  const uid = u.isAnonymous ? null : u.uid;
  if ((acct.user ? acct.user.uid : null) === uid && (acct.ready || uid)) return;
  for (const off of acctUnsubs) off();
  acctUnsubs = [];
  acct = { user: uid ? { uid, email: u.email || '' } : null, profile: null, active: null, ready: !uid, admin: false };
  rememberAccount(!!uid);
  if (uid) { const me = acct; u.getIdTokenResult(true).then(r => { if (acct === me && r && r.claims && r.claims.admin === true) { me.admin = true; render(); } }).catch(() => {}); }   // the admin flag: admin-only games show
  if (uid) track({ ev: 'login' });                     // a login (or a returning one) for the stats
  if (!uid && (state.screen === 'login' || state.screen === 'username')) return;   // a guest session starting: nothing on these screens changes
  if (uid) {
    acctUnsubs.push(fb.m.onValue(fb.m.ref(fb.db, 'users/' + uid), s => { acct.profile = s.val(); acct.ready = true; afterAccount(); render(); }, () => {}));
    acctUnsubs.push(fb.m.onValue(fb.m.ref(fb.db, 'active/' + uid), s => { acct.active = s.val(); onActive(); render(); }, () => {}));
  }
  render();
}
// Logged in: a username first if there is none yet, then wherever the player was heading.
export function afterAccount() {
  if (!acct.user || !acct.ready) return;
  if (loggedIn()) flushLocal();                                 // local matches still waiting to be recorded
  if (!acct.profile || !acct.profile.username) { if (state.screen === 'login') { state.screen = 'username'; unameMsg = null; loginFinishing = false; save(); } return; }
  if (state.screen !== 'login' && state.screen !== 'username') return;
  loginFinishing = false;
  const go = afterLogin; afterLogin = null;
  if (go === 'profile') { openProfile(acct.user.uid, 'menu'); return; }
  if (go === 'host') { hostRoom(null, false); return; }       // logged in on the way to hosting: the room opens at once
  state.screen = go === 'find' ? 'find' : 'menu';
  save();
  if (go === 'find') startSearch();             // logged in on the way to Find Match: searching at once
}
// The server made a game for this player while searching: straight into it.
function onActive() {
  const a = acct.active;
  if (a && (a.game || a.room) && (search.on || search.found)) enterMatched(a);
}
// Find Match, a profile, hosting a friend game: these need an account (and a username). Otherwise the login screen.
export async function needAccount(next) {
  afterLogin = next;
  if (loggedIn()) return true;
  loginMsg = null;
  state.screen = acct.user && acct.ready ? 'username' : 'login';
  commit();
  if (!(await connectQuiet())) { loginMsg = { text: 'No connection. Check your internet and try again.' }; render(); }
  else if (loggedIn()) { afterAccount(); return false; }
  return false;
}
function authError(e) {
  const c = String((e && e.code) || '');
  if (/popup-closed|cancelled-popup/.test(c)) return null;
  if (/popup-blocked/.test(c)) return { text: 'Your browser blocked the sign-in window. Allow pop-ups for this site and try again.' };
  if (/invalid-email/.test(c)) return { text: "That email address doesn't look right." };
  if (/user-not-found|wrong-password|invalid-credential|invalid-login/.test(c)) return { text: 'Wrong email or password.' };
  if (/email-already-in-use/.test(c)) return { text: 'There is already an account with that email: log in instead.' };
  if (/weak-password/.test(c)) return { text: 'Use a password of at least 6 characters.' };
  if (/missing-password/.test(c)) return { text: 'Enter a password.' };
  if (/too-many-requests/.test(c)) return { text: 'Too many tries. Wait a minute, then try again.' };
  if (/network/.test(c)) return { text: 'No connection. Check your internet and try again.' };
  if (/account-exists-with-different-credential/.test(c)) return { text: 'That email already has an account with another way of logging in.' };
  return { text: "Couldn't log in. Try again." };
}
export async function loginWith(how) {
  if (loginBusy) return;
  const mailEl = document.getElementById('lemail'), passEl = document.getElementById('lpass');
  if (mailEl) loginMail = mailEl.value.trim();
  if (passEl) loginPass = passEl.value;
  if (how !== 'google') {
    if (!loginMail) { loginMsg = { text: 'Enter your email address.' }; render(); return; }
    if (!loginPass) { loginMsg = { text: 'Enter a password.' }; render(); return; }
  }
  loginBusy = true; loginMsg = null; render();
  try {
    if (!(await connectQuiet())) throw { code: 'auth/network-request-failed' };
    const A = fb.authM;
    const popup = (window.TTT_FIREBASE && window.TTT_FIREBASE.popup) || A.signInWithPopup;   // (the tests: Google through the emulator, without its popup page)
    if (how === 'google') {
      try { await popup(fb.auth, new A.GoogleAuthProvider()); }
      catch (e) {
        if (!/popup-blocked|operation-not-supported|web-storage-unsupported/.test(String(e && e.code))) throw e;
        loginPending(afterLogin || 'menu');                     // no sign-in window here: the whole page goes to Google and comes back
        save();
        await ((window.TTT_FIREBASE && window.TTT_FIREBASE.redirect) || A.signInWithRedirect)(fb.auth, new A.GoogleAuthProvider());   // (the tests: the emulator's sign-in, then a reload)
        return;
      }
      onAuthUser(fb.auth.currentUser);                          // signed in: on to the username or the menu, without waiting for the event
    }
    else if (how === 'create') await A.createUserWithEmailAndPassword(fb.auth, loginMail, loginPass);
    else await A.signInWithEmailAndPassword(fb.auth, loginMail, loginPass);
    loginPass = '';
  } catch (e) { loginMsg = authError(e); }
  loginBusy = false; render();
}
export async function loginReset() {
  const mailEl = document.getElementById('lemail');
  if (mailEl) loginMail = mailEl.value.trim();
  if (!loginMail) { loginMsg = { text: 'Enter your email address above, then tap Forgot password.' }; render(); return; }
  loginBusy = true; render();
  const sent = { ok: true, text: `If there is an account for ${loginMail}, an email with a link to reset the password is on its way.` };
  try {
    if (!(await connectQuiet())) throw { code: 'auth/network-request-failed' };
    await fb.authM.sendPasswordResetEmail(fb.auth, loginMail);
    loginMsg = sent;
  } catch (e) { loginMsg = /invalid-email|network|too-many/.test(String(e && e.code)) ? authError(e) : sent; }   // (never says whether an account exists)
  loginBusy = false; render();
}
export async function saveUsername() {
  const el = document.getElementById('uname');
  unameDraft = el ? el.value.trim() : unameDraft;
  if (!/^[A-Za-z0-9_]{3,16}$/.test(unameDraft)) { unameMsg = '3 to 16 letters, numbers or underscores.'; render(); return; }
  loginBusy = true; unameMsg = null; render();
  try {
    const r = await call('claimUsername', { username: unameDraft });
    if (!r.ok) unameMsg = r.reason;
  } catch (e) { unameMsg = "Couldn't save it. Check your connection and try again."; }
  loginBusy = false; render();                   // once saved, the profile arrives and the screen moves on
}
export async function logout() {
  stopSearch();
  if (fb && fb.auth) await fb.authM.signOut(fb.auth).catch(() => {});
  rememberAccount(false);
  loginFinishing = false; loginPending(null);
  acct = { user: null, profile: null, active: null, ready: true };
  setProf(null); state.screen = 'menu'; commit();
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setAcct(v) { acct = v; }
export function setAfterLogin(v) { afterLogin = v; }
export function setLoginMail(v) { loginMail = v; }
export function setLoginMsg(v) { loginMsg = v; }
export function setLoginPass(v) { loginPass = v; }
export function setUnameDraft(v) { unameDraft = v; }
