// Anonymous stats and playtest activity: matches reported to the server, this device's events.
import { playerName } from '../core/match.js';
import { matchStats } from '../core/stats.js';
import { other } from '../core/util.js';
import { loggedIn } from './accounts.js';
import { FIREBASE_CONFIG, call, configured, fb } from './connect.js';
import { isMM } from './matchmaking.js';
import { state } from '../ui/app.js';
import { KEY } from '../ui/config.js';

// ----- anonymous game stats: local matches are reported to the server's `track` function (online
// matches are counted by the server itself). Only a random id this browser made up goes with them
// (or the account, when logged in): never a name. Fire and forget: no answer is waited for. -----
function devId() {
  try {
    let id = localStorage.getItem(KEY + '.dev');
    if (!id || !/^[-\w]{8,48}$/.test(id)) { id = 'd' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(KEY + '.dev', id); }
    return id;
  } catch (e) { return null; }
}
function fnUrl(name) {
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  return hook && hook.functions ? `http://${hook.functions.host}:${hook.functions.port}/${c.projectId}/us-central1/${name}` : `https://us-central1-${c.projectId}.cloudfunctions.net/${name}`;
}
const trackUrl = () => fnUrl('track');
export function track(data) {
  if (!configured() || (window.TTT_FIREBASE && window.TTT_FIREBASE.uid)) return;   // (the friend-game tests run without functions)
  data.dev = devId();
  try {
    if (fb && fb.fns) { call('track', data).catch(() => {}); return; }       // the SDK is here: the call carries the account, if any
    fetch(trackUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }), keepalive: true }).catch(() => {});
  } catch (e) { /* stats are never worth an error */ }
}
const localMode = () => (state.cpu === 'XO' ? 'cvc' : state.cpu ? 'cpu' : 'local');
export function trackStart() {
  if (state.online) return;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2, '0')).join('');
  state.stats = { id, mode: localMode(), sent: false };
  track({ ev: 'start', mode: state.stats.mode, id });
}
export function trackEnd() {
  const s = state.stats;
  if (!s || s.sent || !state.winner || state.online) return;
  s.sent = true;
  const m = matchStats(state);
  track({ ev: 'end', mode: s.mode, id: s.id, turns: m.turns, winner: m.winner, reason: m.reason, squares: m.squares });
}
// ----- playtest activity, no account needed: this device's app opens and its matches (started, then
// finished or left), for the admin's playtest page. The device is the random id above, kept in this
// browser's storage (one for the visit when there is none); a tester tag from the link (?t=sam) is kept
// with it, the first one only. Nothing personal goes with them. Fire and forget, like the stats. -----
const TAG_KEY = KEY + '.tag', TAG_RE = /^[a-z0-9][a-z0-9_-]{0,23}$/;
export let devTemp = null, devTagNow = null, devLast = 0;
const randHex = k => Array.from(crypto.getRandomValues(new Uint8Array(k)), b => b.toString(16).padStart(2, '0')).join('');
export function devIdAny() { return devId() || devTemp || (devTemp = 'd' + randHex(12)); }
export function testerTag() {
  let t = null;
  try { t = localStorage.getItem(TAG_KEY); } catch (e) { /* no storage */ }
  return t && TAG_RE.test(t) ? t : devTagNow;
}
export function takeTag() {                                   // the link's ?t=: kept the first time (never replaced), then taken out of the address
  let v = null;
  try { v = new URLSearchParams(location.search).get('t'); } catch (e) { return; }
  if (v == null) return;
  const tag = String(v).trim().toLowerCase();
  if (TAG_RE.test(tag)) {
    devTagNow = tag;
    try { if (!TAG_RE.test(localStorage.getItem(TAG_KEY) || '')) localStorage.setItem(TAG_KEY, tag); } catch (e) { /* no storage: for this visit only */ }
  }
  try { const u = new URL(location.href); u.searchParams.delete('t'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } catch (e) { /* (kept) */ }
}
function devEvent(data) {
  if (!configured() || (window.TTT_FIREBASE && window.TTT_FIREBASE.uid)) return;   // (the friend-game tests run without functions)
  data.dev = devIdAny();
  const tag = testerTag();
  if (tag) data.tag = tag;
  devLast = Date.now();
  try {
    if (fb && fb.fns) { call('devlog', data).catch(() => {}); return; }      // the SDK is here: the call carries the account (its last activity)
    fetch(fnUrl('devlog'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data }), keepalive: true }).catch(() => {});
  } catch (e) { /* never worth an error */ }
}
export const devOpen = () => devEvent({ ev: 'open', o: 'o' + randHex(8) });
// The match on show here, by a key that stays the same across reloads (the server keeps each start and
// end once): a Find Match game, a friend match, or a local one.
function devMatch() {
  if (!Array.isArray(state.squares) || state.squares.length !== 9) return null;
  const o = state.online;
  if (o) {
    if (isMM()) return o.game ? { g: 'm' + o.game, mode: 'match' } : null;
    return o.matchId && o.code ? { g: 'f' + o.code + '_' + o.matchId, mode: 'friend' } : null;
  }
  if (!['board', 'mini', 'win', 'review', 'review-mini'].includes(state.screen)) return null;
  return state.stats && state.stats.id ? { g: 'l' + state.stats.id, mode: state.stats.mode } : null;
}
const devSent = new Set();
export function devWatch() {
  const m = devMatch();
  if (!m || !/^[-\w]{4,60}$/.test(m.g)) return;
  const k = (state.winner ? 'e' : 's') + m.g;
  if (devSent.has(k)) return;
  devSent.add(k);
  if (!state.winner) { devEvent({ ev: 'start', mode: m.mode, g: m.g }); return; }
  const quit = !!state.resigned && (state.online ? state.resigned === state.online.me : true);   // this phone left it (a local match is only ever left by player 1)
  devEvent({ ev: quit ? 'leave' : 'finish', mode: m.mode, g: m.g });
}
// Still playing: every 10 minutes while a match is under way on screen, so a long match stays one session.
export function devPulse() {
  if (document.visibilityState !== 'visible' || !devLast || Date.now() - devLast < 10 * 60000) return;
  const m = devMatch();
  if (m && !state.winner && /^[-\w]{4,60}$/.test(m.g)) devEvent({ ev: 'live', mode: m.mode, g: m.g, o: 'p' + randHex(8) });
}
// ----- a logged-in player's local matches (they are player 1): reported once each is over, won, lost or
// left, and kept on this phone until the server has it (offline, or the page closed in between) -----
const PEND_KEY = KEY + '.pendingLocal';
let flushingLocal = false;
export function pendingLocal(list) {
  try {
    if (list === undefined) { const v = JSON.parse(localStorage.getItem(PEND_KEY) || '[]'); return Array.isArray(v) ? v : []; }
    if (list.length) localStorage.setItem(PEND_KEY, JSON.stringify(list.slice(-20))); else localStorage.removeItem(PEND_KEY);
  } catch (e) { /* no storage */ }
  return [];
}
export function reportLocal() {
  if (state.online || !state.winner || !loggedIn() || window.TTT_FIREBASE && window.TTT_FIREBASE.uid) return;
  if (!state.stats || state.stats.rec || state.stats.mode === 'cvc') return;      // local matches only (started here), once each
  state.stats.rec = true;
  const side = state.setup.human === 'O' ? 'O' : 'X', opp = other(side);
  const final = { squares: state.squares, winner: state.winner, winLine: state.winLine, winReason: state.winReason, resigned: state.resigned || null, counts: state.counts, moves: state.moves, games: state.games, names: { X: playerName(state, 'X'), O: playerName(state, 'O') } };
  pendingLocal(pendingLocal().concat([JSON.parse(JSON.stringify({ id: state.stats.id, side, opponent: { name: playerName(state, opp), cpu: !!(state.cpu && state.cpu.includes(opp)) }, final }))]));
  flushLocal();
}
export async function flushLocal() {
  if (flushingLocal || !loggedIn() || !fb || !fb.fns) return;
  flushingLocal = true;
  try {
    for (const r of pendingLocal()) {
      try { await call('recordLocal', r); }
      catch (e) { if (!/invalid-argument|failed-precondition/.test(String(e && e.code))) break; }   // offline: kept for later; refused: dropped
      pendingLocal(pendingLocal().filter(x => x.id !== r.id));
    }
  } finally { flushingLocal = false; }
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  document.addEventListener('visibilitychange', () => {   // back after half an hour away: a new visit
    if (document.visibilityState === 'visible' && devLast && Date.now() - devLast > 30 * 60000) devOpen();
  });
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setDevLast(v) { devLast = v; }
