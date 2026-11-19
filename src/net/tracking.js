// Anonymous stats and playtest activity: matches reported to the server, this device's events.
import { dropParam, reloadOnce, startLink } from './platform.js';
import { playerName } from '../core/match.js';
import { matchStats } from '../core/stats.js';
import { other } from '../core/util.js';
import { connectQuiet, loggedIn, unverified } from './accounts.js';
import { call, configured, fb } from './connect.js';
import { isMM } from './matchmaking.js';
import { setupTypes } from '../ui/screens/setup.js';
import { state } from '../ui/app.js';
import { APP_VERSION, KEY } from '../ui/config.js';

// ----- anonymous game stats: local matches are reported to the server's `track` function (online
// matches are counted by the server itself). Only a random id this browser made up goes with them
// (or the account, when logged in): never a name. Kept and sent again until the server has them (the outbox below). -----
function devId() {
  try {
    let id = localStorage.getItem(KEY + '.dev');
    if (!id || !/^[-\w]{8,48}$/.test(id)) { id = 'd' + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(KEY + '.dev', id); }
    return id;
  } catch (e) { return null; }
}
// Every report is a signed-in call (the server takes nothing without a login: a guest signs in anonymously). The first
// report loads the SDK quietly; reports made before it is here wait for it (a few at most), and go if it never comes.
const pending = [];
let connecting = false;
function send(name, data) {
  if (!configured() || (window.TTT_FIREBASE && window.TTT_FIREBASE.uid)) return;   // (the friend-game tests run without functions)
  if (fb && fb.fns && fb.uid) { call(name, data).catch(() => {}); return; }
  if (pending.length < 40) pending.push([name, data]);
  if (connecting) return;
  connecting = true;
  connectQuiet().then(ok => {
    connecting = false;
    const list = pending.splice(0);
    if (ok && fb && fb.fns) for (const [n, d] of list) call(n, d).catch(() => {});   // (no connection: the reports are dropped; stats are never worth an error)
  }).catch(() => { connecting = false; pending.length = 0; });
}
// The stats reports (a local match's start and end, with every square it played) go through an outbox kept on this
// phone until the server has them: sent at once when it can be, else kept and sent again: on the next report, a
// return to the page, the network coming back, the next app open, and every so often while some wait. A report is
// dropped only when the server refuses it as malformed, or after a week. The server counts each match's start and
// end once (functions/index.js track, claimMatch), so a report sent again never counts twice.
const OUT_KEY = KEY + '.outbox', OUT_MAX = 60, OUT_AGE = 7 * 86400000, OUT_RETRY = [5000, 15000, 30000, 60000, 300000];
let outMem = [], outBusy = false, outTimer = null, outFails = 0;
export function outbox(list) {
  if (list === undefined) {
    try { const v = JSON.parse(localStorage.getItem(OUT_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return outMem.slice(); }
  }
  outMem = list.slice(-OUT_MAX);
  try { if (outMem.length) localStorage.setItem(OUT_KEY, JSON.stringify(outMem)); else localStorage.removeItem(OUT_KEY); } catch (e) { /* no storage: kept for this visit */ }
  return outMem;
}
const outDrop = k => outbox(outbox().filter(r => r.k !== k));
const outOff = () => !configured() || !!(window.TTT_FIREBASE && window.TTT_FIREBASE.uid);   // (the friend-game tests run without functions)
export function track(data) {
  if (outOff()) return;
  data.dev = devId();
  outbox(outbox().concat([{ k: 'r' + randHex(8), name: 'track', data, at: Date.now() }]));
  flushOutbox();
}
function outLater() {
  clearTimeout(outTimer);
  outTimer = setTimeout(() => { outTimer = null; flushOutbox(); }, OUT_RETRY[Math.min(outFails++, OUT_RETRY.length - 1)]);
}
export async function flushOutbox() {
  if (outBusy || outOff()) return;
  const now = Date.now();
  if (outbox().some(r => !(now - r.at < OUT_AGE))) outbox(outbox().filter(r => now - r.at < OUT_AGE));
  if (!outbox().length) { outFails = 0; return; }
  outBusy = true;
  try {
    if (!(fb && fb.fns && fb.uid) && !((await connectQuiet()) && fb && fb.fns && fb.uid)) { outLater(); return; }   // (no connection yet: later)
    for (let r = outbox()[0]; r; r = outbox()[0]) {               // the oldest first; one put in meanwhile goes too
      try { await call(r.name, r.data); }
      catch (e) {
        if (!/invalid-argument/.test(String(e && e.code))) { outLater(); return; }   // offline, refused for now (too many, not signed in yet): kept for later
      }
      outDrop(r.k);                                               // the server has it (or refused it for good: never sent again)
    }
    outFails = 0; clearTimeout(outTimer); outTimer = null;        // all sent: no retry waiting
  } catch (e) { outLater(); } finally { outBusy = false; }
}
const localMode = () => (state.sc ? 'chaos' : state.cpu === 'XO' ? 'cvc' : state.cpu ? 'cpu' : 'local');   // (Super Chaos: a mode of its own)
// A practice match (How to Play's Practice, state.practice) is never counted: no start or end report, no local record or
// history (reportLocal), no playtest event (devMatch).
// Against the computer, the side this phone's player has (so the admin's page can say who won); on one phone, both: none.
const humanSide = () => (localMode() === 'cpu' ? (state.cpu === 'X' ? 'O' : 'X') : undefined);
// ---------- the match's facts the page alone knows (December 2026: the match data; functions/statsRules.js factSetup) ----------
// A local match's setup, sent with its start: the games its checklist offered (av) and left out (ex), the nine dealt (b), the
// computer's level, the first mover, and the match it is a rematch of (rp: its row id, from the result screen's Rematch).
let rematchOf = null;
export function noteRematch() { rematchOf = state.stats && state.stats.id && !state.online ? 'l_' + state.stats.id : null; }
function localSetup() {
  const games = Array.isArray(state.games) ? state.games : [];
  let av = games;
  try { if (!state.starter) av = [...new Set(setupTypes().concat(games))]; } catch (e) { /* (the checklist's list unknown: the match's own) */ }
  const su = { av, ex: av.filter(t => !games.includes(t)), b: (state.squares || []).map(q => q && q.mini && q.mini.type), f1: state.turn, lv: state.cpu ? state.cpuLevel || 'normal' : undefined, rp: rematchOf || undefined };
  rematchOf = null;
  return su;
}
// The "?" opened inside a square during a match (ui/input.js, never the first visit's own): counted for the play under way there,
// by the side tapping (online this phone's; against the computer its player's; on one phone the side to move). At the match's end
// each play's taps ride its line (hX, hO: a local match's report) or this phone's end event (hp, online: the server keeps the plays).
let helps = [];
export function noteHelp() {
  if (state.screen !== 'mini' || state.zoom == null || state.winner || state.practice || !Array.isArray(state.squares)) return;
  const sq = state.squares[state.zoom];
  if (!sq || !sq.mini || sq.owner) return;
  const side = state.online ? state.online.me : humanSide() || state.turn;
  helps.push({ i: state.zoom, t: sq.mini.type, k: Number.isInteger(sq.k) ? sq.k : null, side, g: matchKeyNow() });
}
const matchKeyNow = () => (state.online ? 'm' + (state.online.game || '') : state.stats ? 'l' + state.stats.id : '');
// Each tap to its play: the play with its pick number, else (tapped before its first move) the first play of that game begun in that
// square after the taps. { k: { X, O } }.
export function helpByPlay(squares, g) {
  const out = {}, mine = helps.filter(h => h.g === g);
  for (const h of mine) {
    const play = squares.find(e => e.k === h.k && Number.isInteger(h.k)) || squares.filter(e => e.i === h.i && e.t === h.t && Number.isInteger(e.k)).sort((a, b) => a.k - b.k)[0];
    if (!play || (h.side !== 'X' && h.side !== 'O')) continue;
    const r = (out[play.k] = out[play.k] || { X: 0, O: 0 }); r[h.side]++;
  }
  return out;
}
// The square on this phone's screen when it left the match (-1: the board), noted as it goes (net/room.js quitMatch).
let leftOn = null;
export function noteLeave() { leftOn = { g: matchKeyNow(), sq: state.screen === 'mini' && Number.isInteger(state.zoom) ? state.zoom : -1 }; }
const leftAt = g => (leftOn && leftOn.g === g ? leftOn.sq : undefined);
export function trackStart() {
  if (state.online || state.practice) return;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(10)), b => b.toString(16).padStart(2, '0')).join('');
  state.stats = { id, mode: localMode(), sent: false };
  helps = [];
  track({ ev: 'start', mode: state.stats.mode, id, side: humanSide(), setup: localSetup() });
}
function endReport(reason) {
  const s = state.stats, m = matchStats(state), g = 'l' + s.id;
  const hp = helpByPlay(m.squares, g);
  for (const e of m.squares) { const h = hp[e.k]; if (h) { if (h.X) e.hX = h.X; if (h.O) e.hO = h.O; } }
  track(Object.assign({ ev: 'end', mode: s.mode, id: s.id, side: humanSide(), turns: m.turns, winner: reason ? null : m.winner, reason: reason || m.reason, sc: m.sc, squares: m.squares },
    m.mp ? { mp: m.mp, mpn: m.mpn } : {}, m.tmo ? { tmo: m.tmo } : {}, leftAt(g) !== undefined ? { ab: leftAt(g) } : {}));
  helps = helps.filter(h => h.g !== g);
}
export function trackEnd() {
  const s = state.stats;
  if (!s || s.sent || !state.winner || state.online || state.practice) return;
  s.sent = true;
  endReport(null);
}
// A local match left part way with no loss to record (a guest: net/room.js quitMatch): its end all the same, 'left' (abandoned),
// so it is not left "unfinished", with the square on screen.
export function trackLeft() {
  const s = state.stats;
  if (!s || s.sent || state.winner || state.online || state.practice || !Array.isArray(state.squares)) return;
  s.sent = true;
  endReport('left');
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
  try { v = new URL(startLink(), 'https://tictacchaos.com/').searchParams.get('t'); } catch (e) { return; }
  if (v == null) return;
  const tag = String(v).trim().toLowerCase();
  if (TAG_RE.test(tag)) {
    devTagNow = tag;
    try { if (!TAG_RE.test(localStorage.getItem(TAG_KEY) || '')) localStorage.setItem(TAG_KEY, tag); } catch (e) { /* no storage: for this visit only */ }
  }
  dropParam('t');
}
function devEvent(data) {
  if (!configured() || (window.TTT_FIREBASE && window.TTT_FIREBASE.uid)) return;   // (the friend-game tests run without functions)
  data.dev = devIdAny();
  data.v = APP_VERSION;                                         // (the match logs: which version each phone ran)
  const side = state.online ? state.online.me : null;
  if (side === 'X' || side === 'O') data.s = side;
  const tag = testerTag();
  if (tag) data.tag = tag;
  devLast = Date.now();
  try { send('devlog', data); } catch (e) { /* never worth an error */ }
}
export const devOpen = () => devEvent({ ev: 'open', o: 'o' + randHex(8) });
// Something went wrong on this phone (a move that would not save): kept with the device's events for the
// admin's playtest page, with the match it was in. Never more than a short line; never a name.
export const devErrors = [];                                    // the last errors logged (the tests read them; capped)
export function devError(kind, msg) {
  devErrors.push(`${kind}: ${msg}`); if (devErrors.length > 50) devErrors.shift();
  const m = devMatch() || {};
  devEvent(Object.assign({ ev: 'error', o: 'o' + randHex(8), msg: String(kind + ': ' + msg).slice(0, 160) }, m.g ? { g: m.g, mode: m.mode } : {}));
}
// The match on show here, by a key that stays the same across reloads (the server keeps each start and
// end once): a Find Match game, a friend match, or a local one.
function devMatch() {
  if (!Array.isArray(state.squares) || state.squares.length !== 9 || state.practice) return null;
  const o = state.online;
  if (o) {
    return isMM() && o.game ? { g: 'm' + o.game, mode: o.room ? 'friend' : 'match' } : null;   // (a friend room's match: the server's game, logged under its id)
  }
  if (!['board', 'mini', 'win', 'review', 'review-mini'].includes(state.screen)) return null;
  return state.stats && state.stats.id ? { g: 'l' + state.stats.id, mode: state.stats.mode } : null;
}
// The phone's sound (audio/sound.js: SND.report): its state changing, a new context, a failure. Kept with
// the device's events and, in a match, in the match's log. At most 60 a visit (a phone left flapping).
let audioSent = 0;
export function devAudio(msg) {
  if (++audioSent > 60) return;
  const m = devMatch() || {};
  devEvent(Object.assign({ ev: 'audio', o: 'a' + randHex(8), msg: String(msg).slice(0, 160) }, m.g ? { g: m.g, mode: m.mode } : {}));
}
// The match's log (functions/matchLogRules.js): what only this phone knows (a match against the computer,
// a move the record refused). e: { k: kind, ...short fields }. Fire and forget.
export function matchLog(e) {
  const m = devMatch();
  if (m && /^[-\w]{4,60}$/.test(m.g)) devEvent({ ev: 'mlog', o: 'l' + randHex(8), g: m.g, mode: m.mode, e });
}
// "Report a problem": the match flagged for the admin's inspector, the moment stamped in its log, with the
// player's note (at most 140 characters). Only where there is a match on show.
// "Report a problem" (ui/report.js): from the in-game menu (the match flagged in its log) or from Settings anywhere. The
// server's `report` keeps it and alerts the admin; true only once it answered ok, so "Thanks" is never shown for a
// report that did not arrive (no connection, refused, too many in a minute).
const REPORT_WHERE = { board: 'board', mini: 'mini', win: 'win', review: 'review', 'review-mini': 'review', menu: 'menu', howto: 'howto', profile: 'profile', setup: 'setup', join: 'join', find: 'find' };
export const reportWhere = () => REPORT_WHERE[state.screen] || (/^(login|signup|verify|username|account|gate)/.test(String(state.screen)) ? 'account' : 'other');
export const reportMatch = () => devMatch();
export async function sendReport(note, where) {
  if (!configured()) return false;
  const dev = devIdAny();
  if (!dev) return false;
  const m = devMatch(), side = state.online ? state.online.me : null;
  const data = { dev, o: 'r' + randHex(8), note: String(note || '').trim().slice(0, 140), where: where || reportWhere(), v: APP_VERSION };
  if (m && /^[-\w]{4,60}$/.test(m.g)) { data.g = m.g; data.mode = m.mode; }
  if (side === 'X' || side === 'O') data.s = side;
  try {
    if (!(fb && fb.fns && fb.uid) && !(await connectQuiet())) return false;
    const r = await call('report', data);
    return !!(r && r.ok);
  } catch (e) { return false; }
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
  const extra = {};
  if (state.online) {                                             // (online the server keeps the plays: this phone's taps and where it left, by the play's pick number)
    const hp = helpByPlay(matchStats(state).squares, matchKeyNow()), side = state.online.me;
    const s = Object.entries(hp).filter(([, v]) => v[side]).map(([k, v]) => `${k}:${v[side]}`).slice(0, 40).join(',');
    if (s) extra.hp = s;
    if (quit && leftAt(matchKeyNow()) !== undefined) extra.ab = leftAt(matchKeyNow());
  }
  devEvent(Object.assign({ ev: quit ? 'leave' : 'finish', mode: m.mode, g: m.g }, extra));
}
// Still playing: every 10 minutes while a match is under way on screen, so a long match stays one session.
// The first-run funnel and the growth events (December 2026; functions/statsRules.js growthMarks): a funnel step once per
// device (tap: the first square opened on the board; move: the first move made in a mini-game; claim: the first square
// claimed in a match on screen), kept here so it is sent once; an event (a rematch, a share, an invite sent by its channel,
// a join link opened, a room joined, a first match from an invite finished) each time.
const FUNNEL_KEY = KEY + '.funnel';
export function devStep(step) {
  let f = {};
  try { f = JSON.parse(localStorage.getItem(FUNNEL_KEY) || '{}') || {}; } catch (e) { f = {}; }
  if (f[step]) return false;
  f[step] = 1;
  try { localStorage.setItem(FUNNEL_KEY, JSON.stringify(f)); } catch (e) { /* no storage: the server keeps it once anyway (its key) */ }
  devEvent({ ev: 'step', step });
  return true;
}
const inviteDoneSeen = new Set();
export function devAct(act, ch) {
  if (act === 'invite-done') { if (inviteDoneSeen.has(ch)) return; inviteDoneSeen.add(ch); ch = undefined; }   // (once per room this visit: its first match finished)
  devEvent(Object.assign({ ev: 'act', act, o: randHex(8) }, ch ? { ch } : {}));
}
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
  if (state.online || state.practice || !state.winner || !loggedIn() || window.TTT_FIREBASE && window.TTT_FIREBASE.uid) return;
  if (!state.stats || state.stats.rec || state.stats.mode === 'cvc' || state.stats.mode === 'chaos') return;      // local matches only (started here), once each (Super Chaos: counted in the game stats only, for now)
  state.stats.rec = true;
  const side = state.setup.human === 'O' ? 'O' : 'X', opp = other(side);
  const final = { squares: state.squares, winner: state.winner, winLine: state.winLine, winReason: state.winReason, resigned: state.resigned || null, counts: state.counts, moves: state.moves, games: state.games, names: { X: playerName(state, 'X'), O: playerName(state, 'O') } };
  pendingLocal(pendingLocal().concat([JSON.parse(JSON.stringify({ id: state.stats.id, side, opponent: { name: playerName(state, opp), cpu: !!(state.cpu && state.cpu.includes(opp)) }, final }))]));
  flushLocal();
}
export async function flushLocal() {
  if (flushingLocal || !loggedIn() || !fb || !fb.fns || unverified()) return;   // (an email not yet proved: the server would refuse; kept for later)
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
// Every uncaught error and rejected promise on the page (December 2026: the launch's error rate): to the device's log as a
// devError ('js' or 'promise', its message and where), each distinct one once a visit and at most ERR_MAX a visit, so a
// loop that throws every frame cannot flood the log. The server counts them per day and build (statsRules.js
// healthUpdates: the admin's Overview error rate).
const ERR_MAX = 20, errSeen = new Set();
export function catchError(kind, msg, where) {
  const line = `${String(msg || 'unknown').slice(0, 110)}${where ? ' @' + where : ''}`;
  if (errSeen.has(line) || errSeen.size >= ERR_MAX) return false;
  errSeen.add(line);
  try { devError(kind, line); } catch (e) { /* (never an error from the catcher itself) */ }
  return true;
}
function errWhere(f, l) { if (!f) return ''; const s = String(f).replace(/^.*\/(?=[^/]+$)/, ''); return `${s}:${l || 0}`; }
// A dynamic import that failed because its hashed file is gone (the message differs by browser): the page reloads once for the
// new build (platform.js reloadOnce, loop-guarded) after the device's log has the 'chunk' error; a second one in a row is logged
// as 'chunk2' and left. The server keeps earlier builds' files 7 days (scripts/build-site.js retainBuilds), so this is the rare case.
export const isChunkError = msg => /dynamically imported module|importing a module script failed|failed to fetch.*module/i.test(String(msg || ''));
export function chunkFailed(msg, reload = reloadOnce) {
  if (!isChunkError(msg)) return false;
  try { devError('chunk', String(msg).slice(0, 110)); } catch (e) { /* (kept) */ }
  setTimeout(() => { if (!reload()) { try { devError('chunk2', 'not reloaded again'); } catch (e) { /* (kept) */ } } }, 600);   // (the log call is on its way first)
  return true;
}
export function catchErrors(win) {
  win.addEventListener('error', e => { if (e && (e.error || e.message)) catchError('js', (e.error && e.error.message) || e.message, errWhere(e.filename, e.lineno)); });
  win.addEventListener('unhandledrejection', e => { const r = e && e.reason, m = r && r.message ? r.message : String(r); if (chunkFailed(m)) return; catchError('promise', m); });
}
export function init() {
  catchErrors(window);
  document.addEventListener('visibilitychange', () => {   // back after half an hour away: a new visit
    if (document.visibilityState === 'visible' && devLast && Date.now() - devLast > 30 * 60000) devOpen();
    if (document.visibilityState === 'visible') flushOutbox();   // reports still waiting go now
  });
  window.addEventListener('online', () => flushOutbox());
  if (outbox().length) setTimeout(flushOutbox, 3000);          // reports left from before (the page closed, offline): sent once the page has started
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setDevLast(v) { devLast = v; }
