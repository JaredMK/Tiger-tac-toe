// "Create an account" after a match (December 2026): to a guest alone (net/tracking.js isGuest), on the results screen
// under Rematch, never mid-match. First after their 2nd finished match on this device, then after every 3rd (5th, 8th…:
// `due`), at most once a session (sessionStorage, so a reload in the same tab does not ask again), and never in the browser
// checks and smokes (ui/onboard.js quiet). It shows their own numbers from what this device keeps (tracking.js
// guestRecord: "You're 3–1 vs the computer."), one panel into the existing sign-up (the login screen: Create account,
// Google, Apple) and Not now. Its events go to the device's log for the admin's Growth page (devAct: acct-shown, acct-no,
// acct-tap; acct-made from accounts.js saveUsername), and a sign-up from here carries this device's guest matches over.
import { devAct, guestCount, guestRecord, guestTapped, isGuest } from '../net/tracking.js';
import { KEY } from './config.js';
import { obState } from './onboard.js';
import { panel } from './comic.js';

const SESSION_KEY = KEY + '.askedThisSession';
// The match just over, as the results screen names it (ui/render.js counts it once by this key).
export const endKey = st => (st.id || 'm') + ':' + st.moves + ':' + st.winner;
export const due = n => n === 2 || (n > 2 && (n - 2) % 3 === 0);
let askFor = null;                                    // the match (its key) the prompt is on, until Not now or a tap
let askedHere = false;                                // (no session storage: once this visit)
const askedSession = () => { if (askedHere) return true; try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch (e) { return false; } };
const markSession = () => { askedHere = true; try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) { /* this visit only */ } };
// A match finished (from the results screen's render, once per match: its key): counted for a guest, and the prompt set up
// on it when it is due.
export function askMatchDone(key) {
  const n = guestCount(key);
  if (!n || obState.quiet || !due(n) || askedSession()) return;
  askFor = key; markSession();
  devAct('acct-shown');
}
export const askShowing = key => askFor != null && askFor === key && isGuest();
// The line of their numbers.
export function askLine(r = guestRecord()) {
  const games = r.w + r.l + r.d;
  if (games) return `You're ${r.w}–${r.l}${r.d ? '–' + r.d : ''} vs the computer.`;
  const n = Math.max(r.n, r.all);
  return `You've finished ${n} match${n === 1 ? '' : 'es'}.`;
}
export function askHtml(key) {
  if (!askShowing(key)) return '';
  return `<div class="acctask" role="region" aria-label="Create an account"><p><b>${askLine()}</b> Create an account to keep your stats.</p>
    <div class="askrow">${panel('acct-ask', 'Create account', { cls: 'g', k: 9 })}<button class="link asknot" data-act="acct-not">Not now</button></div></div>`;
}
// Not now: gone for this match (and this session). Create account: on to the sign-up, remembered for the account it makes.
export function askAct(act) {
  if (act === 'acct-not') { askFor = null; devAct('acct-no'); return 'stay'; }
  if (act === 'acct-ask') { askFor = null; devAct('acct-tap'); guestTapped(); return 'login'; }
  return null;
}
