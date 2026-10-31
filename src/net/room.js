// Friend games: the room (host and guest: the lobby on the database, opened and joined through the server), presence,
// the match as the server runs it (a games/{id} match like Find Match's: net/matchmaking.js reads it, the moves go to
// the server), and the opponent's moves played back on this phone.
import { copyText, shareText, siteUrl } from './platform.js';
import { restrictGames } from '../core/games.js';
import { NAME_MAX, playerName } from '../core/match.js';
import { upgradeMini } from '../core/minis.js';
import { MATCH_FIELDS, packMatch, parseMatch, resignLocal } from '../core/records.js';
import { ANIM, newTimer, normTimer, replaySpeed, speedMode } from '../core/timer.js';
import { other } from '../core/util.js';
import { echoPinned } from '../games/echo/view.js';
import { oddPinned } from '../games/oddone/view.js';
import { TYPES } from '../games/index.js';
import { SND, matchEndSound } from '../audio/sound.js';
import { acct, connectQuiet, loggedIn, setAfterLogin } from './accounts.js';
import { call, connectFirebase, connected, fb, serverNow } from './connect.js';
import { isMM, listenGame, onGameValue, resignMM } from './matchmaking.js';
import { scFollow } from './chaos.js';
import { predicted, setPredicted, showNotice } from './moves.js';
import { listenReacts, stopReacts } from './reactions.js';
import { scMode, visibleTypes } from './releases.js';
import { reportLocal, trackEnd } from './tracking.js';
import {
  NAV_SCREENS, spotMs, commit, cpuPlan, cpuTimer, flashTimer, holdTimer, menuNote, menuOpen, menuStep,
  pickKey, save, setCpuPlan, setCpuTimer, setFlashTimer, setHoldTimer, setMenuNote, setMenuOpen, setMenuStep,
  setSpotTimer, spotTimer, state
} from '../ui/app.js';
import { attPinned } from '../ui/attention.js';
import { scWaiting } from '../ui/chaos.js';
import { STAMP_MS } from '../ui/board.js';
import { KEY } from '../ui/config.js';
import { fingPinned } from '../ui/finger.js';
import { fxAt, startFx } from '../ui/fx.js';
import { render } from '../ui/render.js';
import { repStart, repStop } from '../ui/replay.js';
import { noteNet } from '../ui/turnbar.js';
import { cpuTurn, playFlash, turnAlert } from '../ui/turns.js';

const REPLAY_MAX = 6;                              // at most this many missed moves are played back after a time away
export let net = { status: 'idle', msg: '' };             // 'idle' | 'connecting' | 'waiting' | 'connected' | 'error'
export let room = null, pendingRoom = null, roomUnsub = null, presUnsub = null;   // the room (the lobby, then the match the server runs for it) as last read; one that arrived mid-playback
export let lobby = null, lobbyUnsub = null;        // a friend room's own node (rooms/{code}: the seats, the setup, the match's id, the rematch flags, who left), kept while the match plays
export let presence = null;
export let presentingSeq = null;                          // the move being played back here right now
export let moveWait = null, moveTimer = null, timeoutBusy = false, joinCode = '', joinName = '', awayNote = '', awayTimer = null;

export function validCode(c) { return typeof c === 'string' && /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(c); }   // no constants: load() calls this before they exist
export function online() { return state.online || null; }
export function isHost() { return !!state.online && state.online.role === 'host'; }     // the host set the room up; in the match both phones are equal
function isGuest() { return !!state.online && state.online.role === 'guest'; }
// the side played at this phone: our own side online, the person's side against the computer, null when both play here
export function mySide() { return state.online ? state.online.me : state.cpu && state.cpu.length === 1 ? other(state.cpu) : null; }   // a match the computer plays both sides of has no side here
export function remoteTurn() { return !!state.online && !state.winner && state.turn !== state.online.me; }
// nothing to tap: the computer or the other player is on the move, a move of ours is still being written, or the line is down
export function blocked() { return cpuTurn() || remoteTurn() || !!moveWait || (!!state.online && !connected) || scWaiting(); }   // (Super Chaos: the move is in for this round)
export function pinned() { return echoPinned() || oddPinned() || attPinned() || fingPinned(); }   // an attempt under way that the player has started (Echo's pattern played, Odd One Out's grid revealed): they stay in the square until it goes in
export function lockMine() { return state.lock != null && (mySide() == null || state.turn === mySide()); }
export function setNet(status, msg) { net = { status, msg: msg || '' }; noteNet(); }
function roomLink() { return siteUrl() + '?room=' + state.online.code; }   // (the site's address wherever the game runs: net/platform.js; the app's opens the app again, a Universal Link)
export function roomRef(path) { return fb.m.ref(fb.db, 'rooms/' + state.online.code + (path ? '/' + path : '')); }
function presRef(side) { return fb.m.ref(fb.db, isMM() ? `gpresence/${state.online.game}/${side}` : `presence/${state.online.code}/${side}`); }
const inRoomGame = () => !!(state.online && state.online.kind === 'mm' && state.online.room);   // a friend room's match (the server runs it, as Find Match's)
export { packMatch, parseMatch };                                 // (core/records.js: the record as the database holds it)
// ----- presence: this phone's seat says whether it is online and whether the app is in front -----
export function presenceUp() {
  const o = state.online;
  if (!fb || !o || !o.me || !(o.code || o.game)) return;
  const r = presRef(o.me);
  fb.m.onDisconnect(r).update({ online: false, at: fb.m.serverTimestamp() }).catch(() => {});
  fb.m.update(r, { online: true, away: document.visibilityState === 'hidden', at: fb.m.serverTimestamp() }).catch(() => {});
}
function presenceDown(side) {
  if (!fb || !state.online || !side) return;
  const r = presRef(side);
  fb.m.onDisconnect(r).cancel().catch(() => {});
  fb.m.remove(r).catch(() => {});
  if (inRoomGame()) { const l = fb.m.ref(fb.db, `presence/${state.online.room}/${side}`); fb.m.onDisconnect(l).cancel().catch(() => {}); fb.m.remove(l).catch(() => {}); }   // (the lobby's seat too)
}
function resync() {
  if (!fb || !state.online) return;
  if (isMM()) fb.m.get(fb.m.ref(fb.db, `games/${state.online.game}/pub`)).then(s => onGameValue(s.val())).catch(() => {});
  else fb.m.get(roomRef()).then(s => onRoomValue(s.val())).catch(() => {});
}
// The room's own node, read while this phone is in the room: the lobby, and through the match (its id, the rematch flags,
// who left). Only its two players may read it: a read refused means the room is gone (the host closed it, or it expired).
export function listenLobby(code) {
  stopLobby();
  lobbyUnsub = fb.m.onValue(fb.m.ref(fb.db, 'rooms/' + code), s => onRoomValue(s.val()), () => { if (isMM()) { lobby = null; render(); } else { setMenuNote('The room was closed.'); leaveRoom(true); } });
}
export function stopLobby() { if (lobbyUnsub) lobbyUnsub(); lobbyUnsub = null; lobby = null; }
function listenRoom(code) {
  stopListening();
  listenLobby(code);
  presUnsub = fb.m.onValue(fb.m.ref(fb.db, 'presence/' + code), s => { presence = s.val(); noteNet(); if (state.online) render(); });
  listenReacts(code);
}
export function stopListening() {                                 // (the match's listeners; the room's own node stays until the room is left: stopLobby)
  if (roomUnsub) roomUnsub();
  if (presUnsub) presUnsub();
  stopReacts();
  roomUnsub = presUnsub = null; room = pendingRoom = null; presence = null;
}

// ---------- the host: opens a room (the server picks its code), shares it, sets the match up, starts it ----------
export async function hostRoom(code, resume) {
  if (!resume) {
    state.setup.hostPick = 'random';            // the host is Player 1, the friend Player 2: X and O are drawn when each match starts (the server's startRoom)
    state.stats = null;                         // an online match: never recorded as a local one
    state.online = { role: 'host', code: '', me: 'X', joined: false, shownSeq: null, matchId: null, chaos: scMode() }; state.sc = null;   // (the room's mode: this device's choice to begin with; the code comes from the server)
    state.setup.mode = 'online'; state.screen = 'setup';
    state.setup.timer = normTimer(state.setup.timer);           // an older 1 or 3 minute choice: 30 seconds
  }
  setNet('connecting', resume ? `Reopening room ${state.online.code}…` : 'Opening the room…');
  commit();
  if (!(await connectFirebase()) || !isHost()) return;
  const o = state.online;
  if (!resume) {
    try {
      const name = String((acct.profile && acct.profile.username) || '').slice(0, NAME_MAX) || 'Player 1';   // (hosting needs an account: always its username; the server holds to it too)
      state.setup.names[o.me] = name;
      const r = await call('openRoom', { name, side: o.me, setup: { games: restrictGames(Object.assign({}, state.setup.games), visibleTypes()), timer: state.setup.timer || 0, hostPick: 'random', chaos: !!o.chaos } });
      if (state.online !== o) { if (r && r.ok) closeSeat(r.code, r.side, true); return; }   // went back while the room was opening
      if (!r || !r.ok) throw new Error('refused');
      o.code = r.code; o.me = r.side;
    } catch (e) {
      if (state.online !== o) return;
      if (e && e.details && e.details.verify) { state.online = null; state.setup.mode = 'two'; setNet('idle', ''); setAfterLogin('host'); commit(); return; }   // an email not yet proved: "Verify your email" is up (connect.js call); the room opens once it is
      setNet('error', e && /permission/i.test(String(e.code)) ? String(e.message) : "Couldn't open a room. Check your internet connection (switching to Wi-Fi helps) and try again."); commit(); return;
    }
  }
  if (!isHost() || !validCode(o.code)) return;
  listenRoom(o.code);
  presenceUp();
  setNet('waiting', 'Waiting for friend…'); commit();
}
function guestName() { return state.online && state.online.me ? playerName(state, other(state.online.me)) : ''; }
export async function dbSetup(patch) {
  if (!fb || !isHost() || !validCode(state.online.code)) return;
  try { await fb.m.update(roomRef('setup'), patch); } catch (e) { /* the next change tries again */ }
}
// Start: the server makes the match (a games/{id} match, as Find Match's) and points the room at it; both phones follow it there.
let startBusy = false;
export async function startOnline() {
  const o = state.online;
  if (!fb || !isHost() || !lobby || !o.joined || !connected || startBusy) return;
  startBusy = true;
  try {
    const r = await call('startRoom', { code: o.code });
    if (!r.ok && state.online === o) setNet('error', r.reason === 'games' ? 'No mini-game can be dealt with these settings. Turn some on.' : "Couldn't start the match. Try again.");
  } catch (e) { if (state.online === o) setNet('error', "Couldn't start the match. Check your connection and try again."); }
  startBusy = false;
  if (state.online === o) commit();
}

// ---------- the guest: joins with the code (or the shared link) and takes the free seat ----------
export async function joinRoom(code, name, resume) {
  if (!resume) {
    code = String(code || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (!validCode(code)) { setNet('error', 'Enter the 5-letter room code.'); render(); return; }
    try { localStorage.setItem(KEY + '.name', name); } catch (e) { /* no storage */ }
    state.stats = null;                         // an online match: never recorded as a local one
    state.online = { role: 'guest', code, me: null, name, joined: false, shownSeq: null, matchId: null }; state.sc = null;
    state.setup.mode = 'online'; state.screen = 'join';
  }
  setNet('connecting', resume ? 'Reconnecting…' : 'Connecting…');
  commit();
  if (!(await connectFirebase()) || !isGuest()) return;
  const o = state.online;
  try {
    const r = await call('joinRoom', Object.assign({ code: o.code }, resume ? {} : { name: String(o.name || '').trim().slice(0, NAME_MAX) || 'Friend' }));   // the server seats this phone (the free seat, or its own from before)
    if (state.online !== o) { if (r && r.ok && !resume) closeSeat(o.code, r.side, false); return; }   // went back while joining
    if (!r || !r.ok) {
      const why = r && r.reason;
      setNet('error', why === 'full' ? 'That room is full: two players are in it already.' : why === 'started' ? 'That match has already started without you.'
        : why === 'expired' ? `The game ${o.code} has expired. Ask the host for a new code.` : `No game with the code ${o.code} is open. Check the code with the host.`);
      commit(); return;
    }
    o.me = r.side;
  } catch (e) {
    if (state.online !== o) return;
    setNet('error', e && /permission/i.test(String(e.code)) ? String(e.message) : 'No connection. Check your internet (switching to Wi-Fi helps) and try again.');
    commit(); return;
  }
  if (!isGuest()) return;
  o.joined = true;
  listenRoom(o.code);
  presenceUp();
  setNet('connected', ''); commit();
}

// ---------- the room as the database holds it: every change lands here ----------
function onRoomValue(r) {
  const o = state.online;
  if (!o || !fb) return;
  lobby = r;
  if (!r || !r.players) { setMenuNote('The room was closed.'); leaveRoom(true); return; }
  const mine = ['X', 'O'].find(s => r.players[s] && r.players[s].uid === fb.uid);
  if (!mine) { setMenuNote('You are no longer in that room.'); leaveRoom(true); return; }
  const inGame = o.kind === 'mm' && !!o.game && o.game === r.game;   // this phone is in the match the room points at
  if (o.me !== mine) { const old = o.me; o.me = mine; if (!inGame) { if (old) presenceDown(old); presenceUp(); } if (isHost()) state.setup.human = mine; }
  if (r.left && r.left.side !== o.me && !(inGame && state.winner)) { setMenuNote(`${String(r.left.name || other(o.me)).slice(0, NAME_MAX)} left the match`); leaveRoom(true); return; }   // (a finished match stays on show: the win screen says they left)
  if (!inGame) for (const s of ['X', 'O']) state.setup.names[s] = r.players[s] ? String(r.players[s].name || s).slice(0, NAME_MAX) : s;   // (in the match the names are the game's)
  if (r.setup) {
    if (r.setup.games && !inGame) state.setup.games = Object.assign({}, state.setup.games, r.setup.games);
    if (!inGame) state.setup.timer = normTimer(r.setup.timer);
    o.chaos = !!r.setup.chaos;                                    // (the room's Super Chaos switch)
  }
  const wasJoined = o.joined;
  o.joined = !!(r.players.X && r.players.X.uid && r.players.O && r.players.O.uid);
  if (r.rematch && r.rematch.X && r.rematch.O && !r.left && inGame && state.winner) rematchStart();   // both want a rematch: the server starts it (either phone asks; it makes one match)
  if (wasJoined === false && o.joined && !inGame) SND.play('join');
  if (r.game && (r.status === 'playing' || r.status === 'over')) {   // the match (the server runs it): into it, or the rematch's new one
    if (!inGame) enterRoomGame(r.game, mine); else render();
    return;
  }
  // the lobby
  room = r;
  if (isHost()) setNet(o.joined ? 'connected' : 'waiting', o.joined ? '' : 'Waiting for friend…');
  else if (net.status !== 'error') setNet('connected', '');
  const screen = isHost() ? 'setup' : 'join';
  if (state.screen !== screen) state.screen = screen;
  save(); render();
}
// The room's match: the same listeners and calls as a Find Match game (net/matchmaking.js), this phone's seat kept.
function enterRoomGame(id, mine) {
  const o = state.online;
  clearTimeout(spotTimer); setSpotTimer(null); clearTimeout(flashTimer); setFlashTimer(null); clearTimeout(holdTimer); setHoldTimer(null);
  clearTimeout(moveTimer); moveWait = null; presentingSeq = null; awayNote = ''; repStop();
  state.stats = null;
  Object.assign(o, { kind: 'mm', game: id, me: mine, joined: true, shownSeq: null, matchId: null, room: o.code }); state.sc = null;
  state.setup.mode = 'online'; state.cpu = null; setMenuOpen(false); setMenuStep('main');
  state.flash = null; state.done = null; state.spot = null; state.lock = null; state.zoom = null; state.winner = null; state.endPick = null;
  state.screen = 'board';
  setNet('connecting', 'Loading the match…');
  commit();
  listenGame(id);                                                 // (the match's listeners; the room's own node stays listened to)
  presenceUp();
}
// The room's match is over (the result on show, a rematch possible).
const matchOver = r => !!(r && r.game && isMM() && state.online.game === r.game && state.winner);
export function presenting() { return !!(state.flash || state.done || state.spot || presentingSeq != null || stampLeft() > 0); }   // (presentingSeq covers a replay's inputs playing before the move)
// A square's stamp still playing on the board (ms left): the next move played back waits for it.
function stampLeft() { const at = state.stamp != null ? fxAt('stamp', state.stampId) : null; return at == null ? 0 : Math.max(0, (speedMode() ? STAMP_MS * 0.6 : STAMP_MS) / ANIM.speed - (performance.now() - at)); }   // (Speed: the next move's glow starts as the stamp settles, not after it)
let pendingTimer = null;
// The match as the record has it: moves not yet seen here are played back first, one at a time.
export function applyMatch(r) {
  const o = state.online, rec = parseMatch(r.match);
  if (!rec) return;
  const st = rec.state;
  if (st.sc && st.sc.online) { scFollow(rec); return; }          // Super Chaos: both move at once (net/chaos.js)
  if (predicted && st.seq >= predicted.seq) {     // the server has the move that was shown here: confirmed (shown already) or corrected
    if (JSON.stringify(st.squares) === predicted.squares) o.shownSeq = Math.max(o.shownSeq || 0, predicted.seq);
    setPredicted(null);
  }
  if (o.matchId !== st.id) { o.matchId = st.id; o.shownSeq = st.seq; presentingSeq = null; moveWait = null; state.endPick = null; }   // a new match: nothing to play back
  if (o.shownSeq == null) o.shownSeq = st.seq;
  let missed = (st.recent || []).filter(e => e.seq > o.shownSeq).sort((a, b) => a.seq - b.seq);
  const skipped = Math.max(0, st.seq - o.shownSeq - Math.min(missed.length, REPLAY_MAX));
  if (missed.length > REPLAY_MAX) missed = missed.slice(-REPLAY_MAX);
  if (skipped > 0) { o.shownSeq = missed.length ? missed[0].seq - 1 : st.seq; sayAway(`${skipped} move${skipped === 1 ? '' : 's'} happened while you were away`); }
  if (missed.length) { presentEntry(st, missed[0], missed.slice(1)); return; }
  showLatest(st);
}
function sayAway(text) {
  awayNote = text; noteNet(); render();
  clearTimeout(awayTimer); awayTimer = setTimeout(() => { awayNote = ''; noteNet(); render(); }, 5000);
}
export function takeFields(st) {
  for (const k of MATCH_FIELDS) {
    if (k === 'recent') continue;
    state[k] = st[k] === undefined ? (k === 'games' ? TYPES.slice() : k === 'timer' ? newTimer(0) : null) : JSON.parse(JSON.stringify(st[k]));
  }
  if (!Array.isArray(state.games) || !state.games.length) state.games = TYPES.slice();
  if (Array.isArray(state.squares)) state.squares.forEach(sq => upgradeMini(sq.mini));
  state.cpu = null; state.confirm = null; state.sel = [];
}
export function showLatest(st) {
  const o = state.online, pick0 = pickKey(), live = ['board', 'mini'].includes(state.screen);
  repStop();
  takeFields(st);
  if (pickKey() != null && pickKey() !== pick0) { startFx('pick', pickKey()); SND.play('flipUp'); }   // a Find the Pair card just turned up (on the other phone, or this one's own pick coming back)
  if (live && state.winner && !state.flash) SND.play(matchEndSound());   // the match ended while this phone was on the board (not on a reload)
  state.flash = null; state.done = null; state.spot = null;
  o.shownSeq = st.seq;
  if (state.winner) { if (!['review', 'review-mini'].concat(NAV_SCREENS).includes(state.screen)) state.screen = 'win'; }   // looking back over the final board, or at a profile: stay there
  else if (!['board', 'mini'].includes(state.screen)) state.screen = 'board';
  if (!state.winner && state.lock != null && state.turn === o.me) { state.screen = 'mini'; state.zoom = state.lock; }   // our bonus move
  if (state.screen === 'mini' && state.zoom == null) state.screen = 'board';
  sayMissed(st);
  turnAlert();                                                    // (the turn come round here without a replay: a missed turn, a move while away)
  save(); render();
}
// A turn's time ran out (core/board.js timeoutMove): both phones say so once (the record's timer.miss).
let missSeen = null;                                              // `${match}:${n}`: the last one seen here
function sayMissed(st) {
  const m = st.timer && st.timer.miss, key = `${st.id}:${m ? m.n : 0}`, seen = missSeen;
  missSeen = key;
  if (!m || key === seen || !seen || seen.split(':')[0] !== String(st.id)) return;   // (the first look at a match: what is there already is not news)
  if (m.kind === 'closed') return;                                 // (a move under way, ended: its entry plays back with the words)
  const who = state.online.me === m.by ? 'You' : playerName(state, m.by);
  sayAway(m.kind === 'missed' ? `${who} ran out of time · turn missed` : `${who} ran out of time · turn over`);   // (the match's note line, as for moves made while away)
}
// One move from the record, played back as a phone that watched it live would see it, in order: the
// square lit up on the board as it was before the move (unclaimed, not yet filled in), the zoom and the
// move, then back to the board, where a square won stamps in. Squares that moves still to play back will
// change show what they were until their turn comes (a phone catching up plays them one by one).
export function presentEntry(st, e, rest) {
  const o = state.online, view = state.squares;                 // this phone's board, as it last showed it
  const clone = x => JSON.parse(JSON.stringify(x));
  takeFields(st);
  for (const k of new Set((rest || []).map(x => x.square))) {
    if (k === e.square) continue;
    const next = rest.find(x => x.square === k), was = next.before || (view && view[k]);
    if (was) state.squares[k] = clone(was);
  }
  const before = e.before || (view && view[e.square]) || null;
  state.squares[e.square] = clone(e.after);
  state.turn = e.by; state.lock = e.kind === 'again' ? e.square : null;
  state.moves = e.moves; state.lastSquare = e.square; state.lastBy = e.by;
  const over = e.kind === 'match';
  state.winner = over ? st.winner || e.winner : null;           // (the match's result: a square won can also leave a draw)
  if (!over) { state.winLine = null; state.winReason = null; state.counts = null; }
  const f = Object.assign({}, e); delete f.after; delete f.seq; delete f.moves; delete f.before;
  const done = !over && e.kind !== 'again' ? f : null;
  state.spot = null; state.stamp = null;
  presentingSeq = e.seq;
  if (e.by === o.me && !e.timeout) { state.flash = f; state.done = done; state.screen = 'mini'; state.zoom = e.square; state.draft = ''; state.notice = null; playFlash(); }
  else {
    // The other player's move: the square as it was until their inputs have played (ui/replay.js), then the
    // square as the move left it and the move's own animation.
    const mini0 = before ? clone(before) : null;
    if (mini0) state.squares[e.square] = clone(mini0);
    const start = () => repStart({ sq: e.square, by: e.by, type: f.type, mini: mini0 ? mini0.mini : state.squares[e.square].mini, move: f.m, list: mini0 ? f.rep : null, timeout: !!f.timeout, speed: replaySpeed(),
      onMove: () => { state.squares[e.square] = clone(e.after); state.flash = f; state.done = done; state.draft = ''; state.notice = null; playFlash(); save(); render(); } });
    showRemoteMove(e.square, moveLabel(e), mini0, start);
  }
  save(); render();
}
// After a result has played out here: the move counts as seen, and the record is looked at again.
export function applyPending() {
  clearTimeout(pendingTimer); pendingTimer = null;
  if (!state.online) return;
  if (presentingSeq != null) { state.online.shownSeq = Math.max(state.online.shownSeq || 0, presentingSeq); presentingSeq = null; save(); }   // seen: never played back again
  const wait = stampLeft();
  if (wait > 0) { pendingTimer = setTimeout(applyPending, wait + 30); return; }   // a square just won stamps in first, then the next move
  const r = pendingRoom || room; pendingRoom = null;
  if (r && !presenting()) { if (r.kind === 'mm') onGameValue(r.pub); else onRoomValue(r); }
}
// A move by the other player (or a timed-out one): the board first, with the square lit up and a
// label (and drawn as it was before the move), then the zoom and the move's animation. The flash is
// already set; it only starts as the mini-game comes into view (playFlash), not while the square glows.
function showRemoteMove(i, label, before, start) {
  clearTimeout(spotTimer); setSpotTimer(null);
  if (state.screen === 'mini' && state.zoom === i && !state.spot) { state.draft = ''; state.notice = null; start(); return; }   // already looking at this square (a bonus move, or a watcher): it plays right here
  state.spot = { square: i, by: state.turn, label, before: before || null };
  startFx('spot', state.spot); SND.play('spot');
  state.screen = 'board'; state.zoom = null; state.draft = ''; state.notice = null;
  setSpotTimer(setTimeout(() => {
    setSpotTimer(null);
    if (!state.spot) return;
    const sq = state.spot.square;
    state.spot = null;
    state.screen = 'mini'; state.zoom = sq;
    start();
    save(); render();
  }, spotMs()));
}
function moveLabel(f) { return f.timeout ? `${playerName(state, f.by)} ran out of time` : `${playerName(state, f.by)} plays here`; }
// Rematch: both players have to want it. A tap puts this side's flag on the room (rooms/{code}/rematch/{side}); the
// other phone shows "[name] wants a rematch" under its Rematch button, and the requester waits ("Waiting for
// [name]…", Cancel takes the flag off). Once both flags are in, the server starts the next match (startRoom, asked
// for by either phone: it makes one match, the same choice of sides as before; the host's Random is drawn again).
export async function rematchOnline() {
  const o = state.online;
  if (!fb || !lobby || !state.winner || !connected || !o || !o.me || !validCode(o.code) || lobby.left) return;
  if (lobby.rematch && lobby.rematch[o.me]) return;             // asked already: waiting
  try { await fb.m.set(roomRef('rematch/' + o.me), fb.m.serverTimestamp()); } catch (e) { /* the button stays */ }
}
export async function rematchCancel() {
  const o = state.online;
  if (!fb || !o || !o.me || !validCode(o.code)) return;
  try { await fb.m.remove(roomRef('rematch/' + o.me)); } catch (e) { /* the flag stays; the next tap tries again */ }
}
let rematchBusy = false;
async function rematchStart() {
  const o = state.online;
  if (!fb || !o || !validCode(o.code) || !connected || rematchBusy) return;
  rematchBusy = true;
  try { await call('startRoom', { code: o.code }); } catch (e) { /* the flags stay: the next room value tries again */ }
  rematchBusy = false;
}
// The database side of leaving a friend room: a match under way ends as a loss for the one leaving (the server's
// resign), then the room is marked left (the other phone shows the result, with no rematch).
export function tellLeft() {
  const o = state.online;
  if (!fb || !o || !validCode(o.code) || !o.me || !lobby || lobby.left) return Promise.resolve();
  const code = o.code, left = { side: o.me, name: playerName(state, o.me), at: fb.m.serverTimestamp() };
  const resign = o.kind === 'mm' && o.game && !state.winner ? call('resign', { game: o.game }).catch(() => {}) : Promise.resolve();   // a match under way: it ends as a loss for the one leaving
  return resign.then(() => fb.m.set(fb.m.ref(fb.db, `rooms/${code}/left`), left));
}
// Leaving a friend match under way through the menu: it ends as a loss for this side (the server's record), and this phone
// stays for the result (the loss screen, from the record as it comes back) before the main menu; the other phone
// sees the win screen. A phone that cannot reach the server goes straight to the menu.
export function leaveMatch() {
  const o = state.online;
  setMenuOpen(false); setMenuStep('main'); state.confirm = null;
  if (!fb || !o || !validCode(o.code) || !lobby) { leaveRoom(false); return; }
  if (state.winner || o.kind !== 'mm' || !o.game) { leaveRoom(false); return; }   // over already (or no match yet): the main menu
  moveWait = Date.now(); render();
  tellLeft().then(() => { moveWait = null; render(); }).catch(() => { moveWait = null; if (state.online && state.online.code === o.code) { setMenuNote('You left the match: it counts as a loss.'); leaveRoom(true); } });
}
// Leaving through the menu or from the result: the other player is told (a match under way is lost) and this phone
// goes to the main menu.
export function leaveRoom(silent) {
  const o = state.online;
  if (fb && o && o.me) presenceDown(o.me);
  if (fb && o && validCode(o.code) && !silent) tellLeft().catch(() => {});
  stopListening(); stopLobby();
  clearTimeout(spotTimer); setSpotTimer(null);
  clearTimeout(flashTimer); setFlashTimer(null);
  clearTimeout(holdTimer); setHoldTimer(null);
  clearTimeout(moveTimer); moveWait = null; presentingSeq = null; awayNote = ''; repStop();
  state.online = null;
  setNet('idle', '');
  setMenuOpen(false); setMenuStep('main');
  state.screen = 'menu'; state.confirm = null; state.setup.mode = 'two'; state.spot = null; state.flash = null; state.done = null; state.lock = null;
  state.timer = newTimer(0);
  commit();
}
// Back out of a lobby, before the match starts. The host closes the room: it is deleted, so the code
// stops working and a friend already in it is told. A guest gives up the seat and the host's room
// stays open for them to try again. Either way this phone lets go of the room and goes back one
// screen: the host to Play Online, the guest to the join form (name and code still filled in).
export function leaveLobby() {
  const o = state.online;
  if (!o) return;
  if (o.kind === 'mm' && o.game) { leaveRoom(); return; }           // a match is on: leaving it tells the other player
  const host = o.role === 'host';
  if (fb && validCode(o.code) && o.me) closeSeat(o.code, o.me, host);
  stopListening(); stopLobby();
  clearTimeout(moveTimer); moveWait = null; presentingSeq = null; awayNote = '';
  state.online = null;
  setNet('idle', '');
  state.screen = host ? 'friend' : 'join'; state.setup.mode = 'two'; state.notice = null; state.timer = newTimer(0);
  commit();
}
// The database side of leaving a lobby: this phone's presence first (the rules want the seat still
// ours for that), then the seat or, for the host, the whole room and both presence entries.
export function closeSeat(code, side, host) {
  const { m, db } = fb, pres = s => m.ref(db, `presence/${code}/${s}`);
  m.onDisconnect(pres(side)).cancel().catch(() => {});
  m.remove(pres(side)).catch(() => {})
    .then(() => m.remove(m.ref(db, host ? `rooms/${code}` : `rooms/${code}/players/${side}`)))
    .then(() => host ? Promise.all(['X', 'O'].map(s => m.remove(pres(s)).catch(() => {}))) : null)
    .catch(() => {});
}
// Leave whatever match is on (the in-game menu's Main menu): online that tells the other player too.
// Whether leaving the match now counts as a loss: any online match under way, or a local one while logged in.
export function leaveLoses() {
  if (state.winner) return false;
  if (isMM()) return true;
  if (state.online) return false;                                 // (a lobby: nothing to lose)
  return loggedIn();
}
export function quitMatch() {
  if (isMM()) { if (state.online.room) leaveMatch(); else resignMM(); return; }   // (a friend room's match: the loss, then the room marked left)
  if (state.online) { leaveLobby(); return; }
  let lost = false;
  if (leaveLoses() && resignLocal(state, state.setup.human === 'O' ? 'O' : 'X')) { trackEnd(); reportLocal(); lost = true; }   // a loss for player 1, recorded
  clearTimeout(cpuTimer); setCpuTimer(null); setCpuPlan(null);
  clearTimeout(spotTimer); setSpotTimer(null);
  clearTimeout(flashTimer); setFlashTimer(null);
  clearTimeout(holdTimer); setHoldTimer(null); repStop();
  setMenuOpen(false); setMenuStep('main');
  state.flash = null; state.done = null; state.spot = null; state.lock = null;
  state.screen = lost ? 'win' : 'menu'; state.zoom = null; state.confirm = null;   // a loss that counts: its summary first, then the main menu
  if (lost) state.endPick = null;
  commit();
}
// The invite: one text holding everything, the room's code and the link (which carries the code too), e.g.
// "Join my Tic Tac Chaos game! Code: ABCDE https://tictacchaos.com/?room=ABCDE". It is shared as that text alone, with no
// separate url field (iMessage drops the text when a url comes with it). The link joins at once; the code goes in the Join screen.
export function inviteText(code, url) { return `Join my Tic Tac Chaos game! Code: ${code} ${url}`; }
export async function shareRoom() {
  const text = inviteText(state.online.code, roomLink());
  try { if (await shareText(text)) return; }                      // (the share sheet: the app's or the browser's, net/platform.js)
  catch (e) { if (e && (e.name === 'AbortError' || /cancel/i.test(String(e.message || '')))) return; }
  await copyInvite();                                              // (no share sheet here: the invite is copied instead)
}
// Copy invite: the same text, on the clipboard.
export async function copyInvite() {
  const text = inviteText(state.online.code, roomLink());
  let note = 'Invite copied';
  try { await copyText(text); } catch (e) { note = text; }
  showNotice(note, 1800);
}
// Back after a reload or a time away: the same room and seat, from localStorage.
export function resumeOnline() {
  if (!state.online) return;
  if (isMM()) {
    const o = state.online;
    setNet('connecting', 'Reconnecting…'); render();
    connectQuiet().then(ok => {
      if (!isMM() || state.online !== o) return;
      if (!ok) { setNet('error', 'Online play needs an internet connection. Check it and try again.'); commit(); return; }
      listenGame(o.game); if (validCode(o.room)) listenLobby(o.room); presenceUp();   // (a friend room's match: its room too, for the rematch and who left)
    });
    return;
  }
  if (state.online.role === 'host') hostRoom(state.online.code, true);
  else joinRoom(null, null, true);
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  document.addEventListener('visibilitychange', () => {
    const o = state.online;
    if (!fb || !o || !o.me || !(o.code || o.game)) return;
    fb.m.update(presRef(o.me), { online: true, away: document.visibilityState === 'hidden', at: fb.m.serverTimestamp() }).catch(() => {});
    if (document.visibilityState === 'visible') resync();   // back in front: whatever happened meanwhile
  });
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setAwayNote(v) { awayNote = v; }
export function setJoinCode(v) { joinCode = v; }
export function setJoinName(v) { joinName = v; }
export function setMoveTimer(v) { moveTimer = v; }
export function setMoveWait(v) { moveWait = v; }
export function assignNet(v) { net = v; }
export function setPendingRoom(v) { pendingRoom = v; }
export function setPresUnsub(v) { presUnsub = v; }
export function setPresence(v) { presence = v; }
export function setPresentingSeq(v) { presentingSeq = v; }
export function setRoom(v) { room = v; }
export function setRoomUnsub(v) { roomUnsub = v; }
export function setTimeoutBusy(v) { timeoutBusy = v; }
