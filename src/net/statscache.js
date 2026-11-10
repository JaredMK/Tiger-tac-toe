// The player's own stats kept on this device (November 2026): the last users/{uid} record, game history, local stats and
// Top opponents, so My Stats opens at once from them and updates in place when the fresh ones land (never a "Loading…"
// while a copy exists). Refreshed in the background: at app start (once the account is known), whenever the main menu
// is shown (at most once every few minutes) and after each match (the server's tally lags a moment: twice).
// One copy, for one account: another account, a sign-out or a deleted account drops it.
import { topOpponents } from '../core/stats.js';
import { KEY } from '../ui/config.js';
import { render } from '../ui/render.js';
import { prof } from '../ui/screens/profile.js';
import { acct, connectQuiet, loggedIn } from './accounts.js';
import { fb } from './connect.js';

const STATS_KEY = KEY + '.stats';
export const STATS_EVERY_MS = 4 * 60 * 1000;                     // the menu's refresh: at most this often (a match end refreshes at once)
const HIST_KEEP = 80;
let busy = false, dirty = false, lastTry = 0, lastMatch = null;

export function readStats(uid) {
  try {
    const v = JSON.parse(localStorage.getItem(STATS_KEY) || 'null');
    return v && v.uid === uid && v.user ? v : null;
  } catch (e) { return null; }
}
export function writeStats(uid, d) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify({ uid, at: Date.now(), user: d.user, hist: d.hist, local: d.local, opps: d.opps })); } catch (e) { /* no storage, or full: the next open fetches */ }
}
export function clearStats() { try { localStorage.removeItem(STATS_KEY); } catch (e) { /* no storage */ } dirty = false; }
// The player's own records from the server: users, history, local stats and history, the opponents' tally.
export async function fetchOwnStats(uid) {
  const m = fb.m, last50 = node => m.get(m.query(m.ref(fb.db, `${node}/${uid}`), m.orderByChild('date'), m.limitToLast(50)));
  const [u, h, ls, lh, os] = await Promise.all([m.get(m.ref(fb.db, 'users/' + uid)), last50('history'),
    m.get(m.ref(fb.db, 'localStats/' + uid)).catch(() => null), last50('localHistory').catch(() => null),
    m.get(m.ref(fb.db, 'oppStats/' + uid)).catch(() => null)]);
  const list = [];
  h.forEach(c => { list.push(Object.assign({ id: c.key }, c.val())); });
  if (lh) lh.forEach(c => { list.push(Object.assign({ id: c.key }, c.val())); });
  return { user: u.val(), opps: topOpponents(os ? os.val() : null, 3), local: ls ? ls.val() || {} : null, hist: list.sort((a, b) => b.date - a.date).slice(0, HIST_KEEP) };
}
// Fetch and keep them (no screen involved); an open My Stats takes them in place. force: not throttled (a match just ended).
export async function refreshStats(force) {
  if (busy || !loggedIn() || !acct.user) return false;
  const now = Date.now();
  if (!force && !dirty && now - lastTry < STATS_EVERY_MS) return false;
  busy = true; lastTry = now;
  const uid = acct.user.uid;
  try {
    if (!(await connectQuiet())) return false;
    const d = await fetchOwnStats(uid);
    if (!acct.user || acct.user.uid !== uid || !d.user) return false;
    dirty = false;
    writeStats(uid, d);
    applyToOpen(uid, d);
    return true;
  } catch (e) { return false; } finally { busy = false; }
}
function applyToOpen(uid, d) {
  if (!prof || prof.uid !== uid || !prof.own) return;
  prof.user = d.user; prof.opps = d.opps; prof.local = d.local; prof.hist = d.hist; prof.error = null;
  render();
}
// The main menu is on screen: refresh if it has been a few minutes (or a match has ended since).
export function menuShown() { setTimeout(() => { refreshStats(false); }, 0); }
// A match is over (the result screen shows): refresh now and again a moment later (the server's tally and history land after the end).
export function matchEnded(id) {
  if (id && id === lastMatch) return;
  lastMatch = id; dirty = true;
  setTimeout(() => refreshStats(true), 2500);
  setTimeout(() => refreshStats(true), 9000);
}
