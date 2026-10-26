// Find Match: the queue, the search, and a matchmaking game read live (its moves go to the server).
import { SND } from '../audio/sound.js';
import { acct, connectQuiet, loggedIn, needAccount } from './accounts.js';
import { call, fb } from './connect.js';
import { listenReacts } from './reactions.js';
import {
  applyMatch, awayNote, leaveRoom, moveTimer, moveWait, net, pendingRoom, presUnsub, presence, presenceUp,
  presenting, presentingSeq, room, roomUnsub, setAwayNote, setMoveWait, setNet, setPendingRoom, setPresUnsub,
  setPresence, setPresentingSeq, setRoom, setRoomUnsub, setTimeoutBusy, stopListening, stopLobby, takeFields, tellLeft, timeoutBusy, listenLobby, closeSeat
} from './room.js';
import {
  app, commit, flashTimer, holdTimer, menuNote, menuOpen, menuStep, save, setFlashTimer, setHoldTimer, setMenuNote,
  setMenuOpen, setMenuStep, setSpotTimer, spotTimer, state
} from '../ui/app.js';
import { setTimeoutTry, timeoutTry } from '../ui/clock.js';
import { KEY } from '../ui/config.js';
import { lackedTypes } from '../core/client.js';
import { parseMatch } from '../core/records.js';
import { clientInfo } from './platform.js';
import { newTimer } from '../core/timer.js';
import { render } from '../ui/render.js';
import { noteNet } from '../ui/turnbar.js';

export let search = { on: false, found: false, since: 0, msg: '' }, searchTimer = null, searchBusy = false;
// Find Match is on only while the admin page has it on (features/findMatch); off until the database says otherwise.
export let findOn = (() => { try { return localStorage.getItem(KEY + '.find') === 'on'; } catch (e) { return false; } })();
export function setFindOn(on) {
  if (on === findOn) return;
  findOn = on;
  try { localStorage.setItem(KEY + '.find', on ? 'on' : 'off'); } catch (e) { /* no storage: read again next visit */ }
  if (!on && search.on) { cancelSearch(); return; }   // switched off mid-search: out of the queue, back to the main menu
  render();
}
export function isMM() { return !!(state.online && state.online.kind === 'mm'); }

/* ----- Find Match: a queue on the server; the phone checks in every few seconds while it waits ----- */
export async function openFind() {
  if (activeElsewhere()) { enterMatched(acct.active); return; }   // back to the match in progress
  if (!findOn) { state.screen = 'menu'; commit(); return; }   // switched off: the greyed button on the main menu
  if (!(await needAccount('find'))) return;
  search.msg = ''; search.found = false;
  state.screen = 'find'; commit();
  startSearch();                                // straight into searching: nothing to choose
}
export function startSearch() {
  if (search.on || !loggedIn()) return;
  search.on = true; search.found = false; search.since = Date.now(); search.msg = '';   // (the searching screen is silent: only "found" sounds, when the match starts)
  render();
  searchTick();
}
async function searchTick() {
  clearTimeout(searchTimer); searchTimer = null;
  if (!search.on) return;
  if (!searchBusy) {
    searchBusy = true;
    try {
      const r = await call('findMatch', {});                     // Find Match is Classic: one queue, run by the server
      searchBusy = false;
      if (search.on && r.status === 'matched') { enterMatched(r); return; }
      search.msg = '';
    } catch (e) {
      searchBusy = false;
      if (e && e.details && e.details.off) { stopSearch(); setFindOn(false); state.screen = 'menu'; commit(); return; }   // switched off: already out of the queue
      search.msg = e && /precondition|invalid-argument|unauthenticated/.test(String(e.code)) ? String(e.message) : 'Connection trouble: still trying…';
    }
  }
  if (search.on) { render(); searchTimer = setTimeout(searchTick, 3000); }
}
export async function cancelSearch() {
  if (!search.on) return;
  stopSearch();
  state.screen = 'menu'; commit();              // back to the main menu
  try { const r = await call('cancelSearch', {}); if (r.status === 'matched') enterMatched(r); }   // paired just before Cancel: the game is on
  catch (e) { /* a searcher who stops checking in is dropped from the queue anyway */ }
}
export function stopSearch() { search.on = false; clearTimeout(searchTimer); searchTimer = null; }
export function findAgain() {                          // the results screen: another game
  if (!findOn) return;
  leaveRoom(true);
  state.screen = 'find'; commit();
  startSearch();
}

// Paired: into the server's game (a Classic match the server runs: functions/index.js changeGame).
export function enterMatched(a) { enterGame(a.game, a.side); }
// A match of this player's in progress that this phone is not showing.
export function activeElsewhere() {
  const a = acct.active;
  return !!(a && a.game) && !(isMM() && state.online.game === a.game);
}
/* ----- a matchmaking game: the public game read live, moves sent to the server ----- */
export function enterGame(id, side) {
  holdResume(null);                                // (in a match now: nothing held for the menu's Resume)
  if (search.on || search.found) SND.play('found');
  stopSearch();
  if (isMM() && state.online.game === id) return;
  if (state.online) { stopListening(); stopLobby(); }
  clearTimeout(spotTimer); setSpotTimer(null); clearTimeout(flashTimer); setFlashTimer(null); clearTimeout(holdTimer); setHoldTimer(null);
  clearTimeout(moveTimer); setMoveWait(null); setPresentingSeq(null); setAwayNote('');
  state.stats = null;                         // an online match: never recorded as a local one
  state.online = { kind: 'mm', game: id, me: side, joined: true, shownSeq: null, matchId: null }; state.sc = null;
  state.setup.mode = 'online'; state.cpu = null; setMenuOpen(false); setMenuStep('main');
  state.flash = null; state.done = null; state.spot = null; state.lock = null; state.zoom = null;
  search.found = true;
  state.screen = 'find';                          // "Match found", until the game arrives
  setNet('connecting', 'Loading the match…');
  commit();
  listenGame(id);
  presenceUp();
}
/* ----- a fresh visit: the main menu, an online match in progress held for its "Resume match" button ----- */
// A page load always opens the main menu (main.js boot); a match of this phone's still being played online is
// never entered by itself but held here (kept on the device: a second reload still finds it) for the menu's
// Resume match, which goes back into it from the server's record as Find Match does (enterGame).
const RESUME_KEY = KEY + '.resume';
const resumeOk = r => !!(r && typeof r.game === 'string' && /^[-\w]{8,40}$/.test(r.game) && (r.me === 'X' || r.me === 'O') && (r.room == null || /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(r.room)));   // (a room's code as room.js validCode has it: read at load, so not from room.js, which imports this module)
export let resumable = (() => { try { const r = JSON.parse(localStorage.getItem(RESUME_KEY) || 'null'); return resumeOk(r) ? r : null; } catch (e) { return null; } })();
export function holdResume(o) {
  const r = o ? { game: o.game, me: o.me, room: o.room || null } : null;
  resumable = resumeOk(r) ? r : null;
  try { if (resumable) localStorage.setItem(RESUME_KEY, JSON.stringify(resumable)); else localStorage.removeItem(RESUME_KEY); } catch (e) { /* this visit only */ }
}
// The held match still being played? (Over meanwhile, or gone: the button goes.) Asked once the page is signed in.
export async function checkResume() {
  const r = resumable;
  if (!r) return;
  if (!(await connectQuiet())) return;                 // (offline: the button stays; a tap tries again)
  try {
    const s = (await fb.m.get(fb.m.ref(fb.db, `games/${r.game}/pub/status`))).val();
    if (resumable === r && s !== 'playing') { holdResume(null); render(); }
  } catch (e) { /* (not readable: left as it is) */ }
}
export async function resumeMatch() {
  const r = resumable;
  if (!r || resumeBusy) return;
  resumeBusy = true; setMenuNote(''); render();
  const ok = await connectQuiet();
  resumeBusy = false;
  if (resumable !== r || state.screen !== 'menu') return;
  if (!ok) { setMenuNote('Online play needs an internet connection. Check it and try again.'); render(); return; }
  enterGame(r.game, r.me);
  if (r.room) { state.online.room = r.room; state.online.code = r.room; listenLobby(r.room); }   // (a friend room's match: its room too, for the rematch and who left; its code, so leaving tells the room: tellLeft)
  state.screen = 'board'; commit();
}
export let resumeBusy = false;
// A fresh visit (main.js boot, no join link) opens the main menu: no other screen is restored from the saved state.
// An online match still in progress is held for Resume match, never entered by itself; a friend room's lobby left
// behind lets go of its seat; a local match is left as it was (a new one is set up from Play Local).
export function freshVisit() {
  const o = state.online;
  if (o && isMM() && !state.winner) holdResume(o);
  else if (o && !isMM() && /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(o.code || '') && o.me) connectQuiet().then(ok => { if (ok) closeSeat(o.code, o.me, o.role === 'host'); }).catch(() => {});
  if (o) { state.online = null; state.sc = null; state.setup.mode = 'two'; state.timer = newTimer(0); }
  state.flash = null; state.done = null; state.spot = null; state.zoom = null; state.confirm = null; state.notice = null;
  state.screen = 'menu';
}
export function listenGame(id) {
  stopListening();
  scSide = null; scPub = null;
  setRoomUnsub(fb.m.onValue(fb.m.ref(fb.db, `games/${id}/pub`), s => onGameValue(s.val()), () => { setNet('error', 'Lost access to this match.'); commit(); }));
  const off = fb.m.onValue(fb.m.ref(fb.db, `games/${id}/sides/${state.online.me}`), s => {   // (a Super Chaos match: this side's own node, read with the game; let go once this phone has left it)
    if (!state.online || state.online.kind !== 'mm' || state.online.game !== id) { off(); return; }
    scSide = s.val() ? JSON.parse(s.val()) : null; if (scPub) onGameValue(scPub);
  }, () => {});
  setPresUnsub(fb.m.onValue(fb.m.ref(fb.db, `gpresence/${id}`), s => { setPresence(s.val()); noteNet(); if (state.online) render(); }));
  listenReacts(id);
}
// A match holding a mini-game this client lacks (core/client.js lackedTypes: unknown to it, or newer than it), which only a
// client older than it was can meet (the app reinstalled older, an old page from a cache), on every way in (Find Match's
// pairing, a room's match, the menu's Resume match, a reload) and every change after: the record is taken as it is (so the
// clock and the result are known), but nothing of it is played back or drawn (its view could not draw that game); the page
// shows the stale screen (ui/screens/stale.js: Update, or Leave match by the usual resignation, never by itself).
function staleEnter(pub) {
  const o = state.online, rec = parseMatch({ state: pub.state });
  if (!rec || !lackedTypes(clientInfo(), rec.state).length) return false;
  setRoom({ kind: 'mm', status: pub.status, players: pub.players, match: { state: pub.state }, setup: { timer: pub.timer, chaos: !!pub.chaos }, pub });
  for (const s of ['X', 'O']) state.setup.names[s] = String(pub.players[s].name || s);
  o.mode = pub.mode; o.queue = pub.queue; o.introFor = o.game; o.chaos = !!pub.chaos;
  if (net.status !== 'connected') setNet('connected', '');
  takeFields(rec.state); o.shownSeq = rec.state.seq; o.matchId = rec.state.id;
  state.flash = null; state.done = null; state.spot = null; state.lock = null; state.zoom = null; state.screen = 'board'; search.found = false;
  setMenuOpen(false); setMenuStep('main');
  save(); render();
  return true;
}
// A Super Chaos match: the public state with this side's own move (or its progress) merged in from its own
// node (both are written together; the node still on its way: wait for it).
let scSide = null, scPub = null;
function scMerged(pub, me) {
  const st = JSON.parse(pub.state);
  st.sc.moves = Object.assign({}, st.sc.moves);
  const node = scSide && scSide.round === st.sc.round ? scSide : null;
  if (st.sc.moves[me] && !(node && node.me)) return null;
  st.sc.moves[me] = node && node.me ? node.me : false;
  if (node && node.prog) st.scProg = node.prog;
  return st;
}
export function onGameValue(pub) {
  const o = state.online;
  if (!o || o.kind !== 'mm' || !fb) return;
  if (!pub || !pub.players) { setMenuNote('That match is over.'); leaveRoom(true); return; }
  if (staleEnter(pub)) return;                                    // a mini-game this version lacks: the stale screen, never the match
  let stateJson = pub.state;
  if (pub.chaos) { scPub = pub; const st = scMerged(pub, o.me); if (!st) return; stateJson = JSON.stringify(st); o.chaos = true; }
  setRoom({ kind: 'mm', status: 'playing', players: pub.players, match: { state: stateJson }, setup: { timer: pub.timer, chaos: !!pub.chaos }, pub });
  for (const s of ['X', 'O']) state.setup.names[s] = String(pub.players[s].name || s);
  state.setup.timer = pub.timer;
  o.mode = pub.mode; o.queue = pub.queue;
  if (net.status !== 'connected') setNet('connected', '');
  if (state.screen === 'find') { state.screen = 'board'; search.found = false; }
  if (o.introFor !== o.game) {                                    // a fresh game (Find Match's, or a friend room's match or rematch): who plays whom first
    o.introFor = o.game;
    let st0 = null; try { st0 = JSON.parse(pub.state); } catch (e) { /* shown as it comes */ }
    if (st0 && !st0.seq && !st0.moves && !st0.winner && !(st0.sc && st0.sc.round > 1)) showIntro(pub);
  }
  if (presenting()) { setPendingRoom(room); return; }
  applyMatch(room);
}
// The side reveal that opens every match (Find Match, a friend room's, Play Computer's, Same phone's): who is X and who
// is O, "You" on this phone's side (none on a shared phone), about 3 seconds (or until tapped), then the board. Find
// Match's shows the players' records. Online, the server starts the first turn's clock late enough for it; the
// computer waits for it (ui/turns.js scheduleCpu, then afterIntro).
export let mmIntro = null, introTimer = null;
const INTRO_MS = 3000;
let afterIntro = null;
export function onIntroClosed(f) { afterIntro = f; }               // (input.js: the computer's turn, once the intro is gone)
function showIntro(pub) {
  const friend = pub.mode === 'friend', players = {};
  for (const s of ['X', 'O']) { const p = pub.players[s] || {}; players[s] = friend ? { name: p.name } : p; }   // (a friend room's match: no Find Match record)
  showSides(players, state.online.me);
}
export function showSides(players, me) {
  mmIntro = { players, me: me || null };
  clearTimeout(introTimer); introTimer = setTimeout(closeIntro, INTRO_MS);
}
export function closeIntro() {
  clearTimeout(introTimer); introTimer = null;
  if (!mmIntro) return;
  mmIntro = null;
  const el = app.querySelector('.vsintro'); if (el) el.remove();
  if (afterIntro) afterIntro();
}
// The clock ran out on a matchmaking game: ask the server, which checks the deadline itself.
export async function fireTimeoutMM(seq, deadline) {
  const key = state.online.game + ':' + seq + ':' + deadline;
  if (timeoutTry.key === key && Date.now() - timeoutTry.at < 2000) return;
  setTimeoutTry({ key, at: Date.now() });
  setTimeoutBusy(true);
  try { await call('timeout', { game: state.online.game }); } catch (e) { /* the next tick tries again */ }
  setTimeoutBusy(false);
}
// Leaving a matchmaking game through the menu: a resignation, which loses the match.
export async function resignMM() {
  const id = state.online.game, over = !!state.winner, friend = !!state.online.room;
  setMenuOpen(false); setMenuStep('main');
  if (over) { leaveRoom(true); return; }
  setMoveWait(Date.now()); render();
  try {
    await call('resign', { game: id });                          // the record comes back with the loss: its summary shows first (the win screen), then the main menu
    if (friend) await tellLeft().catch(() => {});                // (a friend room: marked left, so the other phone offers no rematch)
    setMoveWait(null); render();
  } catch (e) {                                                   // not reached: the clock runs out for this side; the main menu now
    setMoveWait(null);
    setMenuNote('You left the match: it counts as a loss.');
    leaveRoom(true);
  }
}
