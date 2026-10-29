// Accounts: signing in (Google, Apple, email: net/auth.js for the providers), the username, the account kept on this phone.
import { PROVIDERS, providerSignIn, providerSignOut } from './auth.js';
import { NET_MS, call, configured, fb, loadFirebase, setConnectWhy } from './connect.js';
import { enterMatched, holdResume, search, startSearch, stopSearch } from './matchmaking.js';
import { hostRoom } from './room.js';
import { fetchReleases } from './releases.js';
import { flushLocal, pendingLocal, track } from './tracking.js';
import { commit, save, setMenuNote, state } from '../ui/app.js';
import { KEY } from '../ui/config.js';
import { ANIM } from '../core/timer.js';
import { setPace } from '../ui/pace.js';
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

/* ----- staging: only accounts on the admin's allowlist get in -----
 * On staging (src/env.js) the page shows nothing but this gate until the player has logged in with an account
 * on the allowlist (the admin page's Staging access, admin/staging/allow). The server checks the list and puts
 * a `staging` flag on the account (functions/index.js stagingAccess); staging's database rules and its server
 * calls refuse anyone without it, so the gate is not only on the page. The tests (window.TTT_FIREBASE) and a
 * page with no Firebase project set up have no gate. */
export const GATED = typeof window !== 'undefined' && !!(window.TTC_ENV && window.TTC_ENV.staging) && !window.TTT_FIREBASE;
export let gate = GATED ? 'checking' : 'ok';          // 'checking' | 'login' | 'verify' | 'denied' | 'offline' | 'ok'
export let gateEmail = '';
export function gateOn() { return GATED && configured() && gate !== 'ok'; }
function setGate(g) { if (gate !== g) { gate = g; render(); } }
let gateSeq = 0;
function gateUser(u) {
  const n = ++gateSeq;
  if (!u || u.isAnonymous) { gateEmail = ''; setGate('login'); return; }
  gateEmail = u.email || '';
  if (gate !== 'ok') setGate('checking');
  (async () => {
    const r = await u.getIdTokenResult();
    if (r.claims.admin === true || r.claims.staging === true) { if (n === gateSeq) setGate('ok'); return; }
    const res = await call('stagingAccess', {});
    if (n !== gateSeq) return;
    if (res && res.ok) {                                                            // the flag is on the account now: a fresh token, and the account's listeners again with it (no reload)
      await u.getIdToken(true);
      if (n !== gateSeq) return;
      onAuthUser(u, true); setGate('ok'); fetchReleases(); afterAccount(); commit();
      return;
    }
    setGate(res && res.reason === 'unverified' ? 'verify' : 'denied');
  })().catch(() => { if (n === gateSeq) setGate('offline'); });
}
// The gate's buttons: check again (after verifying the email, or a network failure), send the verification link again, log out.
export async function gateAct(act) {
  if (act === 'gate-out') { await logout(); gateEmail = ''; setGate('login'); return; }
  if (!(await connectQuiet())) { setGate('offline'); return; }
  const u = fb.auth.currentUser;
  if (act === 'gate-resend' && u && !u.isAnonymous) { await fb.authM.sendEmailVerification(u).catch(() => {}); loginMsg = { ok: true, text: 'Sent. Check your inbox.' }; render(); return; }
  if (u) await u.reload().catch(() => {});
  gateUser(fb.auth.currentUser);
}
// At the start, on staging: connect at once (the gate needs to know who this is).
export function gateStart() { if (gateOn()) connectQuiet().then(ok => { if (!ok) setGate('offline'); }); }
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
  try { await Promise.race([loadFirebase(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NET_MS.connect))]); setConnectWhy(''); return !!(fb && fb.auth); }
  catch (e) { setConnectWhy(String((e && (e.code || e.name)) || 'error') + ': ' + String((e && e.message) || e).slice(0, 160)); return false; }   // (what failed, shown small under "No connection": a phone with no developer tools can say why)
}

// The signed-in user changed (or the page started): follow their profile and their matchmaking game.
// again: listen afresh even to the same account (staging's gate, once its flag is on: the listeners refused before it).
export function onAuthUser(u, again) {
  if (!fb || !fb.auth) return;
  if (GATED && !again) gateUser(u);                   // staging: is this account on the allowlist?
  if (!u) { fb.authM.signInAnonymously(fb.auth).catch(() => {}); return; }   // logged out: a guest again, for friend games
  fb.uid = u.uid;
  const uid = u.isAnonymous ? null : u.uid;
  if (!again && (acct.user ? acct.user.uid : null) === uid && (acct.ready || uid)) return;
  for (const off of acctUnsubs) off();
  acctUnsubs = [];
  acct = { user: uid ? { uid, email: u.email || '' } : null, profile: null, active: null, ready: !uid, admin: false };
  rememberAccount(!!uid);
  if (uid) { const me = acct; u.getIdTokenResult(true).then(r => { if (acct === me && r && r.claims && r.claims.admin === true) { me.admin = true; render(); } }).catch(() => {}); }   // the admin flag: admin-only games show
  if (uid && !again) track({ ev: 'login' });                     // a login (or a returning one) for the stats
  if (!uid && (state.screen === 'login' || state.screen === 'username')) return;   // a guest session starting: nothing on these screens changes
  if (uid) {
    acctUnsubs.push(fb.m.onValue(fb.m.ref(fb.db, 'users/' + uid), s => { acct.profile = s.val(); acct.ready = true; afterAccount(); render(); }, () => {}));
    acctUnsubs.push(fb.m.onValue(fb.m.ref(fb.db, 'active/' + uid), s => { acct.active = s.val(); onActive(); render(); }, () => {}));
    acctUnsubs.push(fb.m.onValue(fb.m.ref(fb.db, `prefs/${uid}/anim`), s => { const v = s.val(); if (v === 'normal' || v === 'speed') { if (v !== ANIM.mode) setPace(v, true); } else saveAnimPref(ANIM.mode); }, () => {}));   // the Animation setting: the account's, else this device's put on it (ui/pace.js)
  }
  render();
}
// The player's Animation setting on the account (prefs/{uid}/anim, theirs alone: database.rules.json), when logged in.
export function saveAnimPref(mode) {
  if (!acct.user || !fb || !fb.m || !fb.db) return;
  fb.m.set(fb.m.ref(fb.db, `prefs/${acct.user.uid}/anim`), mode === 'speed' ? 'speed' : 'normal').catch(() => {});
}
// Logged in: a proved email first (an email-and-password account), a username if there is none yet, then wherever the
// player was heading.
export function afterAccount() {
  if (!acct.user || !acct.ready) return;
  if (unverified()) { if (['login', 'username'].includes(state.screen)) { state.screen = 'verify'; loginMsg = null; loginFinishing = false; save(); } return; }
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
  if (a && a.game && (search.on || search.found)) enterMatched(a);
}
// Find Match, a profile, hosting a friend game: these need an account (and a username). Otherwise the login screen.
export async function needAccount(next) {
  afterLogin = next;
  if (loggedIn()) return true;
  loginMsg = null;
  state.screen = acct.user && acct.ready ? (unverified() ? 'verify' : 'username') : 'login';
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
  if (/operation-not-allowed|unauthorized-domain|invalid-oauth/.test(c)) return { text: "That way of logging in isn't available yet. Use another." };
  if (/canceled|cancelled|1001/.test(c + ' ' + String((e && e.message) || ''))) return null;   // (the app's native sheet closed without signing in)
  return { text: "Couldn't log in. Try again." };
}
export async function loginWith(how) {
  if (loginBusy) return;
  const mailEl = document.getElementById('lemail'), passEl = document.getElementById('lpass');
  if (mailEl) loginMail = mailEl.value.trim();
  if (passEl) loginPass = passEl.value;
  if (!PROVIDERS.includes(how)) {
    if (!loginMail) { loginMsg = { text: 'Enter your email address.' }; render(); return; }
    if (!loginPass) { loginMsg = { text: 'Enter a password.' }; render(); return; }
  }
  loginBusy = true; loginMsg = null; render();
  try {
    if (!(await connectQuiet())) throw { code: 'auth/network-request-failed' };
    const A = fb.authM;
    if (PROVIDERS.includes(how)) {                              // Google or Apple: the provider's own sign-in (net/auth.js: the web's window, the app's native sheet)
      const r = await providerSignIn(fb, how, () => { loginPending(afterLogin || 'menu'); save(); });
      if (r === 'away') return;                                 // (the page is off to the provider; it comes back signed in)
      onAuthUser(fb.auth.currentUser);                          // signed in: on to the username or the menu, without waiting for the event
    }
    else if (how === 'create') { const c = await A.createUserWithEmailAndPassword(fb.auth, loginMail, loginPass); A.sendEmailVerification(c.user).catch(() => {}); }   // (the address is proved before Find Match, hosting or a username: "Verify your email" next)
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
  await providerSignOut();
  rememberAccount(false);
  loginFinishing = false; loginPending(null); verifyAsked = false;
  acct = { user: null, profile: null, active: null, ready: true };
  setProf(null); state.screen = 'menu'; commit();
}

/* ----- email verification: an email-and-password account proves its address first -----
 * Find Match, hosting and the username need a verified email (the server refuses an unproved one with { verify: true }:
 * functions/index.js needAccount); Google's and Apple's accounts are proved by the provider. The sign-up sends the link;
 * the "Verify your email" screen (ui/screens/account.js renderVerify) has Continue, Send the link again and Log out. */
export let verifyAsked = false;                     // the server refused a call until the email is proved
// This account still has to prove its address: an email-and-password account whose email is not verified, made after
// the cutoff (config/verify/since, as the server has it: functions/index.js grandfathered). An account from before it is
// grandfathered, treated as verified; with no cutoff set yet, every account is.
export let verifySince = null;
export function setVerifySince(v) { verifySince = Number.isFinite(v) ? v : null; }
export function grandfathered(u) {
  if (verifySince == null) return true;
  const made = Date.parse(u && u.metadata && u.metadata.creationTime);
  return Number.isFinite(made) && made < verifySince;
}
export function unverified() {
  const u = fb && fb.auth && fb.auth.currentUser;
  return !!(u && !u.isAnonymous && !u.emailVerified && (u.providerData || []).some(p => p && p.providerId === 'password') && !grandfathered(u));
}
export function verifyEmail() { const u = fb && fb.auth && fb.auth.currentUser; return (u && u.email) || (acct.user && acct.user.email) || ''; }
// The server refused a call until the email is proved (connect.js call): the verify screen, where the player was on
// their way into an account feature (never over a match or a game screen: a stray report from there changes nothing).
export function needVerify() {
  verifyAsked = true;
  if (!['login', 'username', 'find', 'friend', 'profile', 'menu', 'verify'].includes(state.screen) && !(state.screen === 'setup' && state.online && state.online.role === 'host')) return;
  if (state.screen !== 'verify') { state.screen = 'verify'; loginMsg = null; render(); }
}
// The verify screen's buttons: Continue (the account read afresh; verified, a fresh token, then on to wherever the player
// was heading: the username, Find Match, hosting, the menu), Send the link again.
export async function verifyAct(act) {
  if (loginBusy) return;
  if (!(await connectQuiet())) { loginMsg = { text: 'No connection. Check your internet and try again.' }; render(); return; }
  const u = fb.auth.currentUser;
  if (!u || u.isAnonymous) { state.screen = 'login'; commit(); return; }
  loginBusy = true; loginMsg = null; render();
  if (act === 'verify-resend') {
    try { await fb.authM.sendEmailVerification(u); loginMsg = { ok: true, text: 'Sent. Check your inbox.' }; }
    catch (e) { loginMsg = authError(e) || { text: "Couldn't send it. Try again in a minute." }; }
    loginBusy = false; render(); return;
  }
  try { await u.reload(); } catch (e) { /* (offline: the flag as it was) */ }
  loginBusy = false;
  if (!u.emailVerified) { loginMsg = { text: 'Not verified yet. Open the link in the email, then tap Continue.' }; render(); return; }
  await u.getIdToken(true).catch(() => {});                      // (the server reads the flag from the token)
  verifyAsked = false; loginFinishing = true; state.screen = 'login';   // "Logging you in…" until the profile says where next
  afterAccount(); commit();
}

/* ----- deleting the account (the profile's Delete account, after a Yes) -----
 * The server deletes every node of the account and the account itself (functions/index.js deleteAccount), refusing while
 * the player is in an online match. Then this phone forgets the account (signed out, nothing kept) and the main menu says so. */
export let delState = null;                         // null | 'ask' (the question is up) | 'busy' | { error }
export function askDelete() { delState = 'ask'; render(); }
export function cancelDelete() { if (delState !== 'busy') { delState = null; render(); } }
export async function deleteAccount() {
  if (delState === 'busy' || !acct.user) return;
  delState = 'busy'; render();
  try {
    if (!(await connectQuiet())) throw { code: 'auth/network-request-failed' };
    await call('deleteAccount', {});
  } catch (e) {
    const d = (e && e.details) || {};
    delState = { error: d.playing ? 'Finish or leave your match first.' : /network/.test(String(e && e.code)) ? 'No connection. Check your internet and try again.' : "Couldn't delete the account. Try again." };
    render(); return;
  }
  delState = null;
  pendingLocal([]); holdResume(null);                            // nothing of the account stays on this phone
  await logout();
  setMenuNote('Account deleted'); render();
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setAcct(v) { acct = v; }
export function setAfterLogin(v) { afterLogin = v; }
export function setLoginMail(v) { loginMail = v; }
export function setLoginMsg(v) { loginMsg = v; }
export function setLoginPass(v) { loginPass = v; }
export function setUnameDraft(v) { unameDraft = v; }
