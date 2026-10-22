// Friend games: the room (host and guest), presence, the match as the database holds it, and the
// opponent's moves played back on this phone.
import { restrictGames } from '../core/games.js';
import { NAME_MAX, playerName } from '../core/match.js';
import { upgradeMini } from '../core/minis.js';
import { MATCH_FIELDS, applyOnlineResign, newOnlineMatch, packMatch, parseMatch, resignLocal } from '../core/records.js';
import { armClock, newTimer, normTimer } from '../core/timer.js';
import { other } from '../core/util.js';
import { echoPinned } from '../games/echo/view.js';
import { oddPinned } from '../games/oddone/view.js';
import { TYPES } from '../games/index.js';
import { SND, matchEndSound } from '../audio/sound.js';
import { connectQuiet, loggedIn } from './accounts.js';
import { connectFirebase, connected, fb, serverNow } from './connect.js';
import { isMM, listenGame, onGameValue, resignMM } from './matchmaking.js';
import { scFollow } from './chaos.js';
import { predicted, setPredicted, showNotice } from './moves.js';
import { listenReacts, stopReacts } from './reactions.js';
import { scMode, visibleTypes } from './releases.js';
import { reportLocal, trackEnd } from './tracking.js';
import {
  NAV_SCREENS, RNG, SPOT_MS, commit, cpuPlan, cpuTimer, flashTimer, holdTimer, menuNote, menuOpen, menuStep,
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
import { cpuTurn, playFlash } from '../ui/turns.js';

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';   // no I or O: they look like 1 and 0
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;           // rooms older than this are deleted when a new one is created
const REPLAY_MAX = 6;                              // at most this many missed moves are played back after a time away
export let net = { status: 'idle', msg: '' };             // 'idle' | 'connecting' | 'waiting' | 'connected' | 'error'
export let room = null, pendingRoom = null, roomUnsub = null, presUnsub = null;   // the room as last read; one that arrived mid-playback
export let presence = null;
export let presentingSeq = null;                          // the move being played back here right now
export let moveWait = null, moveTimer = null, timeoutBusy = false, joinCode = '', joinName = '', nameTimer = null, awayNote = '', awayTimer = null;

export function roomCode() { let c = ''; for (let i = 0; i < 5; i++) c += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]; return c; }
export function validCode(c) { return typeof c === 'string' && /^[ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/.test(c); }   // no constants: load() calls this before they exist
function newId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
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
function roomLink() { return location.origin + location.pathname + '?room=' + state.online.code; }
export function roomRef(path) { return fb.m.ref(fb.db, 'rooms/' + state.online.code + (path ? '/' + path : '')); }
function presRef(side) { return fb.m.ref(fb.db, isMM() ? `gpresence/${state.online.game}/${side}` : `presence/${state.online.code}/${side}`); }
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
}
function resync() {
  if (!fb || !state.online) return;
  if (isMM()) fb.m.get(fb.m.ref(fb.db, `games/${state.online.game}/pub`)).then(s => onGameValue(s.val())).catch(() => {});
  else fb.m.get(roomRef()).then(s => onRoomValue(s.val())).catch(() => {});
}
function listenRoom(code) {
  stopListening();
  roomUnsub = fb.m.onValue(fb.m.ref(fb.db, 'rooms/' + code), s => onRoomValue(s.val()), () => { setNet('error', 'Lost access to this room.'); commit(); });
  presUnsub = fb.m.onValue(fb.m.ref(fb.db, 'presence/' + code), s => { presence = s.val(); noteNet(); if (state.online) render(); });
  listenReacts(code);
}
export function stopListening() {
  if (roomUnsub) roomUnsub();
  if (presUnsub) presUnsub();
  stopReacts();
  roomUnsub = presUnsub = null; room = pendingRoom = null; presence = null;
}

// ---------- the host: opens a room, shares its code, sets the match up, starts it ----------
export async function hostRoom(code, resume) {
  if (!resume) {
    if (state.setup.hostPick !== 'random') state.setup.hostPick = state.setup.human === 'O' ? 'O' : 'X';
    state.stats = null;                         // an online match: never recorded as a local one
    state.online = { role: 'host', code: code || roomCode(), me: state.setup.human === 'O' ? 'O' : 'X', joined: false, shownSeq: null, matchId: null, chaos: scMode() }; state.sc = null;   // (the room's mode: this device's choice to begin with)
    state.setup.mode = 'online'; state.screen = 'setup';
    state.setup.timer = normTimer(state.setup.timer);           // an older 30 s or 3 min choice: 1 minute
  }
  setNet('connecting', resume ? `Reopening room ${state.online.code}…` : 'Opening the room…');
  commit();
  if (!(await connectFirebase()) || !isHost()) return;
  const o = state.online, { m, db, uid } = fb;
  if (!resume) {
    try {
      await cleanupRooms();
      for (let tries = 0; tries < 5; tries++) {                   // a code already in use (rare) gets another
        const snap = await m.get(m.ref(db, 'rooms/' + o.code));
        if (!snap.exists()) break;
        o.code = roomCode();
      }
      const name = String(state.setup.names[o.me] || '').trim().slice(0, NAME_MAX) || o.me;
      await m.set(m.ref(db, 'rooms/' + o.code), {
        created: m.serverTimestamp(), host: uid, status: 'lobby',
        players: { [o.me]: { uid, name, joined: m.serverTimestamp() } },
        setup: { games: restrictGames(Object.assign({}, state.setup.games), visibleTypes()), timer: state.setup.timer || 0, hostSide: o.me, hostPick: state.setup.hostPick === 'random' ? 'random' : o.me, chaos: !!o.chaos },
      });
      if (state.online !== o) { closeSeat(o.code, o.me, true); return; }   // went back while the room was opening
    } catch (e) {
      if (state.online !== o) return;
      setNet('error', "Couldn't open a room. Check your internet connection (switching to Wi-Fi helps) and try again."); commit(); return;
    }
  }
  if (!isHost()) return;
  listenRoom(o.code);
  presenceUp();
  setNet('waiting', 'Waiting for friend…'); commit();
}
// Rooms nobody can still be playing in (older than a day) are removed when a new one is opened.
async function cleanupRooms() {
  const { m, db } = fb;
  try {
    const q = m.query(m.ref(db, 'rooms'), m.orderByChild('created'), m.endAt(serverNow() - ROOM_TTL_MS), m.limitToFirst(30));
    const snap = await m.get(q);
    const jobs = [];
    snap.forEach(ch => { jobs.push(m.remove(m.ref(db, 'rooms/' + ch.key)).then(() => Promise.all([m.remove(m.ref(db, 'presence/' + ch.key)), m.remove(m.ref(db, 'reacts/' + ch.key))])).catch(() => {})); });
    await Promise.all(jobs);
  } catch (e) { /* best effort: the rules only let stale rooms go */ }
}
function guestName() { return state.online && state.online.me ? playerName(state, other(state.online.me)) : ''; }
function roomSetup(players, setup) {
  const p = players || (room && room.players) || {}, s = setup || (room && room.setup) || {};
  return { names: { X: p.X ? p.X.name : 'X', O: p.O ? p.O.name : 'O' }, games: restrictGames(Object.assign({}, s.games || state.setup.games), visibleTypes()), timer: normTimer(s.timer), chaos: !!s.chaos };   // (chaos: a Super Chaos match, simultaneous rounds)
}
// Who plays which side in a match, kept with the match itself (the room's seats can swap for the next one).
function seatsOf(players) { const seat = q => ({ uid: (q && q.uid) || null, name: String((q && q.name) || '').slice(0, NAME_MAX) }); return { X: seat(players.X), O: seat(players.O) }; }
// The host's Random: the seats for the next match, drawn afresh (the host's seat swapped over half the time).
function drawSeats(players, host) {
  const hostSide = players.X && players.X.uid === host ? 'X' : 'O', want = RNG() < 0.5 ? 'X' : 'O';
  return want === hostSide ? { players, hostSide } : { players: { X: players.O, O: players.X }, hostSide: want };
}
export async function dbSetup(patch) {
  if (!fb || !isHost()) return;
  try { await fb.m.update(roomRef('setup'), patch); } catch (e) { /* the next change tries again */ }
}
export function dbName(name) {
  if (!fb || !state.online || !state.online.me) return;
  clearTimeout(nameTimer);
  nameTimer = setTimeout(() => { nameTimer = null; flushName(name); }, 300);
}
export function flushName(name) {                                       // written to whichever seat is ours by then
  const o = state.online;
  if (!fb || !o || !o.me || !room || !room.players || !room.players[o.me] || room.players[o.me].uid !== fb.uid) return;
  fb.m.update(roomRef('players/' + o.me), { name: String(name || '').trim().slice(0, NAME_MAX) || o.me }).catch(() => {});
}
// The host takes the other side: its seat (and its friend's, if there is one) move over.
export async function hostSide(side) {
  const o = state.online, was = o.me;
  if (!fb || !isHost() || side === was) return;
  const name = String(state.setup.names[was] || '').trim().slice(0, NAME_MAX) || side;   // the name typed so far goes with the seat
  clearTimeout(nameTimer); nameTimer = null;
  try {
    await fb.m.runTransaction(roomRef('players'), p => {
      if (!p) return p;
      if (!p[was] || p[was].uid !== fb.uid) return;             // not our seat any more
      const next = { [side]: Object.assign({}, p[was], { name }) };
      if (p[side] && p[side].uid) next[was] = p[side];
      return next;
    });
    await fb.m.update(roomRef('setup'), { hostSide: side });
  } catch (e) { return; }
}
export async function startOnline() {
  const o = state.online;
  if (!fb || !isHost() || !room || !o.joined || !connected) return;
  const random = room.setup && room.setup.hostPick === 'random';
  const seats = random ? drawSeats(room.players, fb.uid) : { players: room.players, hostSide: o.me };
  const fresh = newOnlineMatch(roomSetup(seats.players), RNG, newId(), serverNow());
  if (!fresh) return;
  armClock(fresh.state, [], serverNow());
  const up = { status: 'playing', match: Object.assign(packMatch(fresh), { seats: seatsOf(seats.players) }), left: null };
  if (seats.hostSide !== o.me) Object.assign(up, { players: seats.players, 'setup/hostSide': seats.hostSide });   // Random put the host on the other side
  try { await fb.m.update(roomRef(), up); }
  catch (e) { setNet('error', "Couldn't start the match. Check your connection and try again."); commit(); }
}

// ---------- the guest: joins with the code (or the shared link) and takes the free seat ----------
// A Super Chaos match from Find Match: the room the server opened for the pair, both seated and the match on;
// this phone takes its seat there (as a player coming back to it) and plays it as a friend room.
export function enterRoomMM(code) {
  if (state.online && state.online.code === code && state.online.joined) return;   // (in it already)
  stopListening();
  state.stats = null;
  state.online = { role: 'guest', code, me: null, name: '', joined: false, shownSeq: null, matchId: null, mmRoom: true }; state.sc = null;
  state.setup.mode = 'online'; state.screen = 'join';
  return joinRoom(code, '', true);
}
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
  const o = state.online, { m, db, uid } = fb;
  try {
    const snap = await m.get(m.ref(db, 'rooms/' + o.code));
    const r = snap.val();
    if (state.online !== o) return;                               // went back meanwhile: nothing to show
    if (!r || !r.players) { setNet('error', `No game with the code ${o.code} is open. Check the code with the host.`); commit(); return; }
    if (!resume && Number(r.created) < Date.now() - 24 * 3600 * 1000) { setNet('error', `The game ${o.code} has expired. Ask the host for a new code.`); commit(); return; }
    const mine = ['X', 'O'].find(s => r.players[s] && r.players[s].uid === uid);
    if (mine) {                                                   // our seat from before: back into it
      o.me = mine;
      if (!resume && o.name) await m.update(m.ref(db, `rooms/${o.code}/players/${mine}`), { name: o.name });
    } else {
      const free = ['X', 'O'].find(s => !r.players[s]);
      if (!free) { setNet('error', 'That room is full: two players are in it already.'); commit(); return; }
      if (r.status !== 'lobby') { setNet('error', 'That match has already started without you.'); commit(); return; }
      const nm = String(o.name || (resume && r.players[free] && r.players[free].name) || '').trim().slice(0, NAME_MAX) || 'Friend';
      await m.set(m.ref(db, `rooms/${o.code}/players/${free}`), { uid, name: nm, joined: m.serverTimestamp() });   // the rules let only an empty seat be taken
      o.me = free;
      if (state.online !== o) { closeSeat(o.code, free, false); return; }   // went back while joining
    }
  } catch (e) {
    if (state.online !== o) return;
    setNet('error', e && /PERMISSION_DENIED|permission/i.test(String(e.code || e.message)) ? 'That room is full: two players are in it already.' : 'No connection. Check your internet (switching to Wi-Fi helps) and try again.');
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
  room = r;
  if (!r || !r.players) { setMenuNote('The room was closed.'); leaveRoom(true); return; }
  const mine = ['X', 'O'].find(s => r.players[s] && r.players[s].uid === fb.uid);
  if (!mine) { setMenuNote('You are no longer in that room.'); leaveRoom(true); return; }
  if (o.me !== mine) { const old = o.me; o.me = mine; if (old) presenceDown(old); presenceUp(); if (isHost()) state.setup.human = mine; }
  if (r.left && r.left.side !== o.me) { setMenuNote(`${String(r.left.name || other(o.me)).slice(0, NAME_MAX)} left the match`); leaveRoom(true); return; }
  for (const s of ['X', 'O']) state.setup.names[s] = r.players[s] ? String(r.players[s].name || s).slice(0, NAME_MAX) : s;
  if (r.setup) {
    if (r.setup.games) state.setup.games = Object.assign({}, state.setup.games, r.setup.games);
    state.setup.timer = normTimer(r.setup.timer);
    o.chaos = !!r.setup.chaos;                                    // (the room's Super Chaos switch)
  }
  const wasJoined = o.joined;
  o.joined = !!(r.players.X && r.players.X.uid && r.players.O && r.players.O.uid);
  if (wasJoined === false && o.joined) SND.play('join');
  if (r.status === 'playing' && r.match) {
    if (net.status !== 'connected') setNet('connected', '');
    if (presenting()) { pendingRoom = r; return; }               // a move is still playing out here: afterwards
    applyMatch(r);
  } else {                                                        // the lobby
    if (isHost()) setNet(o.joined ? 'connected' : 'waiting', o.joined ? '' : 'Waiting for friend…');
    else if (net.status !== 'error') setNet('connected', '');
    const screen = isHost() ? 'setup' : 'join';
    if (state.screen !== screen) state.screen = screen;
    save(); render();
  }
}
export function presenting() { return !!(state.flash || state.done || state.spot || presentingSeq != null || stampLeft() > 0); }   // (presentingSeq covers a replay's inputs playing before the move)
// A square's stamp still playing on the board (ms left): the next move played back waits for it.
function stampLeft() { const at = state.stamp != null ? fxAt('stamp', state.stampId) : null; return at == null ? 0 : Math.max(0, STAMP_MS - (performance.now() - at)); }
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
function takeFields(st) {
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
  if (pickKey() != null && pickKey() !== pick0) { startFx('pick', pickKey()); SND.play('flipUp'); }   // a Memory card just turned up (on the other phone, or this one's own pick coming back)
  if (live && state.winner && !state.flash) SND.play(matchEndSound());   // the match ended while this phone was on the board (not on a reload)
  state.flash = null; state.done = null; state.spot = null;
  o.shownSeq = st.seq;
  if (state.winner) { if (!['review', 'review-mini'].concat(NAV_SCREENS).includes(state.screen)) state.screen = 'win'; }   // looking back over the final board, or at a profile: stay there
  else if (!['board', 'mini'].includes(state.screen)) state.screen = 'board';
  if (!state.winner && state.lock != null && state.turn === o.me) { state.screen = 'mini'; state.zoom = state.lock; }   // our bonus move
  if (state.screen === 'mini' && state.zoom == null) state.screen = 'board';
  save(); render();
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
    const start = () => repStart({ sq: e.square, by: e.by, type: f.type, mini: mini0 ? mini0.mini : state.squares[e.square].mini, move: f.m, list: mini0 ? f.rep : null, timeout: !!f.timeout,
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
  }, SPOT_MS));
}
function moveLabel(f) { return f.timeout ? `${playerName(state, f.by)} ran out of time — random move` : `${playerName(state, f.by)} plays here`; }
// Rematch: the same choice of sides as before. X or O stay as they were; with the host's Random the sides
// are drawn again. The whole room changes at once (the seats may swap), once, whoever taps first.
export async function rematchOnline() {
  if (!fb || !room || !state.winner || !connected) return;
  try {
    await fb.m.runTransaction(roomRef(), r => {
      if (!r) return r;                                           // not in the cache yet: retried with the server's value
      const rec = parseMatch(r.match);
      if (!rec || !rec.state.winner || !r.players || !r.players.X || !r.players.O) return;   // the other player already started it
      const seats = r.setup && r.setup.hostPick === 'random' ? drawSeats(r.players, r.host) : { players: r.players, hostSide: r.players.X.uid === r.host ? 'X' : 'O' };
      const fresh = newOnlineMatch(roomSetup(seats.players, r.setup), RNG, newId(), serverNow());
      if (!fresh) return;
      armClock(fresh.state, [], serverNow());
      return Object.assign({}, r, { players: seats.players, setup: Object.assign({}, r.setup, { hostSide: seats.hostSide }), match: Object.assign(packMatch(fresh), { seats: seatsOf(seats.players) }), left: null });
    }, { applyLocally: false });
  } catch (e) { /* the button stays */ }
}
// Leaving through the menu: the other player is told and sent to the main menu too.
export function leaveRoom(silent) {
  const o = state.online;
  if (fb && o && o.kind === 'mm' && o.me) presenceDown(o.me);
  if (fb && o && o.code) {
    if (!silent && o.me && room && !room.left) {
      const ref = roomRef(), left = { side: o.me, name: playerName(state, o.me), at: fb.m.serverTimestamp() };
      const resign = room.status === 'playing' && room.match && !state.winner
        ? fb.m.runTransaction(fb.m.ref(fb.db, `rooms/${o.code}/match`), cur => {      // a match under way: it ends as a loss for the one leaving
          const rec = parseMatch(cur);
          if (!rec) return cur;
          const r = applyOnlineResign(rec, o.me);
          return r.ok ? Object.assign(packMatch(r.rec), cur.seats ? { seats: cur.seats } : {}) : undefined;
        }, { applyLocally: false }).catch(() => {})
        : Promise.resolve();
      resign.then(() => fb.m.update(ref, { left })).catch(() => {});
    }
    if (o.me) presenceDown(o.me);
  }
  stopListening();
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
  if (room && room.status === 'playing') { leaveRoom(); return; }   // a match is on: leaving it tells the other player
  const host = o.role === 'host';
  if (fb && o.code && o.me) closeSeat(o.code, o.me, host);
  stopListening();
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
  if (state.online) return room ? !!(room.status === 'playing' && room.match) : !!state.online.matchId;   // (a match seen here before the room loads again)
  return loggedIn();
}
export function quitMatch() {
  if (isMM()) { resignMM(); return; }
  if (state.online) { leaveRoom(false); return; }
  if (leaveLoses() && resignLocal(state, state.setup.human === 'O' ? 'O' : 'X')) { trackEnd(); reportLocal(); }   // a loss for player 1, recorded
  clearTimeout(cpuTimer); setCpuTimer(null); setCpuPlan(null);
  clearTimeout(spotTimer); setSpotTimer(null);
  clearTimeout(flashTimer); setFlashTimer(null);
  clearTimeout(holdTimer); setHoldTimer(null); repStop();
  setMenuOpen(false); setMenuStep('main');
  state.flash = null; state.done = null; state.spot = null; state.lock = null;
  state.screen = 'menu'; state.zoom = null; state.confirm = null;
  commit();
}
export async function shareRoom() {
  const url = roomLink(), text = `Join my Tic Tac Chaos game: room ${state.online.code}`;
  try {
    if (navigator.share) { await navigator.share({ title: 'Tic Tac Chaos', text, url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  let note = 'Link copied';
  try { await navigator.clipboard.writeText(url); } catch (e) { note = url; }
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
      listenGame(o.game); presenceUp();
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
export function setNameTimer(v) { nameTimer = v; }
export function assignNet(v) { net = v; }
export function setPendingRoom(v) { pendingRoom = v; }
export function setPresUnsub(v) { presUnsub = v; }
export function setPresence(v) { presence = v; }
export function setPresentingSeq(v) { presentingSeq = v; }
export function setRoom(v) { room = v; }
export function setRoomUnsub(v) { roomUnsub = v; }
export function setTimeoutBusy(v) { timeoutBusy = v; }
