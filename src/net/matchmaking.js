// Find Match: the queue, the search, and a matchmaking game read live (its moves go to the server).
import { SND } from '../audio/sound.js';
import { acct, loggedIn, needAccount } from './accounts.js';
import { call, fb } from './connect.js';
import { listenReacts } from './reactions.js';
import {
  applyMatch, awayNote, leaveRoom, moveTimer, moveWait, net, pendingRoom, presUnsub, presence, presenceUp,
  presenting, presentingSeq, room, roomUnsub, setAwayNote, setMoveWait, setNet, setPendingRoom, setPresUnsub,
  setPresence, setPresentingSeq, setRoom, setRoomUnsub, setTimeoutBusy, stopListening, timeoutBusy
} from './room.js';
import {
  app, commit, flashTimer, holdTimer, menuNote, menuOpen, menuStep, setFlashTimer, setHoldTimer, setMenuNote,
  setMenuOpen, setMenuStep, setSpotTimer, spotTimer, state
} from '../ui/app.js';
import { setTimeoutTry, timeoutTry } from '../ui/clock.js';
import { KEY } from '../ui/config.js';
import { render } from '../ui/render.js';
import { noteNet } from '../ui/turnbar.js';

export let search = { on: false, found: false, since: 0, msg: '' }, searchTimer = null, searchBusy = false;
// Find Match is on only while the admin page has it on (features/findMatch); off until the database says otherwise.
export let findOn = (() => { try { return localStorage.getItem(KEY + '.find') === 'on'; } catch (e) { return false; } })();
export function setFindOn(on) {
  if (on === findOn) return;
  findOn = on;
  try { localStorage.setItem(KEY + '.find', on ? 'on' : 'off'); } catch (e) { /* no storage: read again next visit */ }
  if (!on && search.on) { cancelSearch(); return; }   // switched off mid-search: out of the queue, back to Play Online
  render();
}
export function isMM() { return !!(state.online && state.online.kind === 'mm'); }

/* ----- Find Match: a queue on the server; the phone checks in every few seconds while it waits ----- */
export async function openFind() {
  if (acct.active && acct.active.game && !(isMM() && state.online.game === acct.active.game)) { enterGame(acct.active.game, acct.active.side); return; }   // back to the match in progress
  if (!findOn) { state.screen = 'online'; commit(); return; }   // switched off: the greyed button on Play Online
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
      const r = await call('findMatch', {});                     // one queue, 1 minute a turn
      searchBusy = false;
      if (search.on && r.status === 'matched') { enterGame(r.game, r.side); return; }
      search.msg = '';
    } catch (e) {
      searchBusy = false;
      if (e && e.details && e.details.off) { stopSearch(); setFindOn(false); state.screen = 'online'; commit(); return; }   // switched off: already out of the queue
      search.msg = e && /precondition|invalid-argument|unauthenticated/.test(String(e.code)) ? String(e.message) : 'Connection trouble: still trying…';
    }
  }
  if (search.on) { render(); searchTimer = setTimeout(searchTick, 3000); }
}
export async function cancelSearch() {
  if (!search.on) return;
  stopSearch();
  state.screen = 'online'; commit();            // back to Play Online
  try { const r = await call('cancelSearch', {}); if (r.status === 'matched') enterGame(r.game, r.side); }   // paired just before Cancel: the game is on
  catch (e) { /* a searcher who stops checking in is dropped from the queue anyway */ }
}
export function stopSearch() { search.on = false; clearTimeout(searchTimer); searchTimer = null; }
export function findAgain() {                          // the results screen: another game
  if (!findOn) return;
  leaveRoom(true);
  state.screen = 'find'; commit();
  startSearch();
}

/* ----- a matchmaking game: the public game read live, moves sent to the server ----- */
export function enterGame(id, side) {
  if (search.on || search.found) SND.play('found');
  stopSearch();
  if (isMM() && state.online.game === id) return;
  if (state.online) stopListening();
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
export function listenGame(id) {
  stopListening();
  setRoomUnsub(fb.m.onValue(fb.m.ref(fb.db, `games/${id}/pub`), s => onGameValue(s.val()), () => { setNet('error', 'Lost access to this match.'); commit(); }));
  setPresUnsub(fb.m.onValue(fb.m.ref(fb.db, `gpresence/${id}`), s => { setPresence(s.val()); noteNet(); if (state.online) render(); }));
  listenReacts(id);
}
export function onGameValue(pub) {
  const o = state.online;
  if (!o || o.kind !== 'mm' || !fb) return;
  if (!pub || !pub.players) { setMenuNote('That match is over.'); leaveRoom(true); return; }
  setRoom({ kind: 'mm', status: 'playing', players: pub.players, match: { state: pub.state }, setup: { timer: pub.timer }, pub });
  for (const s of ['X', 'O']) state.setup.names[s] = String(pub.players[s].name || s);
  state.setup.timer = pub.timer;
  o.mode = pub.mode; o.queue = pub.queue;
  if (net.status !== 'connected') setNet('connected', '');
  if (state.screen === 'find') {
    state.screen = 'board'; search.found = false;
    let st0 = null; try { st0 = JSON.parse(pub.state); } catch (e) { /* shown as it comes */ }
    if (st0 && !st0.seq && !st0.moves && !st0.winner) showIntro(pub);   // a fresh game: who plays whom first
  }
  if (presenting()) { setPendingRoom(room); return; }
  applyMatch(room);
}
// The players' intro: both usernames with their records, about 3 seconds (or until tapped), then the
// board. The server starts the first turn's clock late enough for it.
export let mmIntro = null, introTimer = null;
const INTRO_MS = 3000;
function showIntro(pub) {
  mmIntro = { players: pub.players, me: state.online.me };
  clearTimeout(introTimer); introTimer = setTimeout(closeIntro, INTRO_MS);
}
export function closeIntro() {
  clearTimeout(introTimer); introTimer = null;
  if (!mmIntro) return;
  mmIntro = null;
  const el = app.querySelector('.vsintro'); if (el) el.remove();
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
  const id = state.online.game, over = !!state.winner;
  setMenuOpen(false); setMenuStep('main');
  if (!over) {
    setMoveWait(Date.now()); render();
    try { await call('resign', { game: id }); } catch (e) { /* and if not, the clock runs out for this side */ }
    setMoveWait(null);
    setMenuNote('You left the match: it counts as a loss.');
  }
  leaveRoom(true);
}
