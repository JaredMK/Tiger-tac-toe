// Online match records: what the shared database holds (the public state, the secrets kept apart), moves
// settled on the record, timeouts, resigning.
import { endFlash, playMove, timeoutMove } from './board.js';
import { SC_ONLINE, chaosResolveOnline, scTimeoutMove, scTypes, startChaosOnline } from './chaos.js';
import { defaultSetup, newState, startMatch } from './match.js';
import { upgradeMini } from './minis.js';
import { newTimer } from './timer.js';
import { other } from './util.js';
import { attStart } from '../games/shared/attention.js';
import { PHYS_TYPES } from '../games/shared/physics.js';
import { triviaReveal } from '../games/trivia/rules.js';
import { TYPES, rulesOf } from '../games/index.js';

/* ===================== Online match records (what the shared database holds) =====================
 * Over the network a match is a record { state, secrets }: `state` is what either phone may render,
 * with the hidden values of unclaimed squares left out; `secrets` keeps those values, square by square.
 * To make a move the two are joined again, the usual move logic runs, the result is settled at once
 * (the turn passes here, not after an animation) and the record is split back. state.recent keeps the
 * last few moves, so a phone that was away can play back what it missed, one move at a time.
 */
export const RECENT_MAX = 8;
export const MATCH_FIELDS = ['id', 'seq', 'recent', 'games', 'squares', 'turn', 'lock', 'moves', 'winner', 'winLine', 'winReason', 'resigned', 'counts', 'lastSquare', 'lastBy', 'pick', 'pickSq', 'timer', 'sqlog', 'sc'];   // (sc: a Super Chaos match's round, the moves sent in, the last recap)
// The hidden part of a mini-game, or null when it has none.
export function secretOf(mini) {
  const game = rulesOf(mini.type);
  if (game.secret) return game.secret(mini);
  return null;
}
// Strip a mini-game's secret in place, leaving only what the board is allowed to show: the Hangman
// word as its pattern, the Treasure hunt's clues, the Memory cards that have been seen (or picked).
export function hideMini(m, k, st) {
  if (PHYS_TYPES.includes(m.type)) { if (m.last) delete m.last.rec; return; }   // nothing hidden; the recording rides the move's entry, not the square
  const game = rulesOf(m.type);
  if (game.hide) game.hide(m, k, st);
}
// The record of a match from a full state: the public state and the secrets, kept apart.
export function matchRecord(full) {
  const secrets = {};
  full.squares.forEach((sq, i) => { const s = secretOf(sq.mini); if (s) secrets[i] = s; });
  const state = {};
  for (const k of MATCH_FIELDS) if (full[k] !== undefined) state[k] = JSON.parse(JSON.stringify(full[k]));
  if (!Array.isArray(state.recent)) state.recent = [];
  if (!Number.isInteger(state.seq)) state.seq = 0;
  state.squares.forEach((sq, k) => { if (!sq.owner || PHYS_TYPES.includes(sq.mini.type)) hideMini(sq.mini, k, full); });
  return { state, secrets };
}
// A room's match as the database holds it: { state, secrets } as JSON strings (seats ride beside them).
export function parseMatch(v) {
  if (!v || typeof v.state !== 'string') return null;
  try {
    const st = JSON.parse(v.state);
    if (!st || !Array.isArray(st.squares) || st.squares.length !== 9 || !st.squares.every(q => q && q.mini && typeof q.mini.type === 'string')) return null;   // not a match: ignored (a refused write shows locally for a moment)
    return { state: st, secrets: v.secrets ? JSON.parse(v.secrets) : {} };
  } catch (e) { return null; }
}
export function packMatch(rec) { return { state: JSON.stringify(rec.state), secrets: JSON.stringify(rec.secrets || {}) }; }
// A change to the room's match as a database transaction makes it: fn gets the record and returns the new
// one, or nothing to leave it (then nothing is written, not even where no match is). The seats ride along.
export function matchTxn(fn) {
  return cur => {
    const rec = parseMatch(cur);
    if (!rec) return undefined;                                   // no match there (or not in the cache yet): nothing to apply, nothing written
    const out = fn(rec);
    return out ? Object.assign(packMatch(out), cur.seats ? { seats: cur.seats } : {}) : undefined;
  };
}
// The full state again, from a record: the secrets back in their squares, the screen-only fields blank.
export function fullState(rec) {
  const st = JSON.parse(JSON.stringify(rec.state));
  const secrets = rec.secrets || {};
  st.squares.forEach((sq, k) => {
    const s = secrets[k];
    if (s) Object.assign(sq.mini, JSON.parse(JSON.stringify(s)));
    if (sq.mini.type === 'hunt') delete sq.mini.clues;
    upgradeMini(sq.mini);
  });
  Object.assign(st, { flash: null, done: null, screen: 'board', zoom: null, draft: '', sel: [], notice: null, stamp: null, spot: null, cpu: null, online: null, confirm: null });
  if (!st.timer) st.timer = newTimer(0);
  if (!Array.isArray(st.recent)) st.recent = [];
  if (!Array.isArray(st.sqlog)) st.sqlog = [];
  if (!Array.isArray(st.games) || !st.games.length) st.games = TYPES.slice();
  return st;
}
// The move just made is settled: its result goes on the record as an entry for the phones to play
// back, and the turn passes at once (or the mover keeps it for a bonus move). The entry has the square
// as the move left it (after) and, when known, as it was before (before, from the record as it stood):
// a phone playing the move back shows the square as it was until the move plays there.
export function settle(full, before) {
  const f = full.flash, sq = full.squares[f.square];
  const after = JSON.parse(JSON.stringify(sq));
  if (!after.owner || PHYS_TYPES.includes(after.mini.type)) hideMini(after.mini, f.square, full);
  full.seq = (full.seq || 0) + 1;
  const entry = Object.assign(JSON.parse(JSON.stringify(f)), { seq: full.seq, moves: full.moves, after }, before ? { before: JSON.parse(JSON.stringify(before)) } : {});
  endFlash(full, false);
  full.recent = (full.recent || []).map(e => { const o = e.phys && e.phys.rec ? Object.assign({}, e, { phys: Object.assign({}, e.phys, { rec: null }) }) : e; if (o.rep) { const c = Object.assign({}, o); delete c.rep; return c; } return o; }).concat([entry]).slice(-RECENT_MAX);   // (a physics recording and a replay log ride only the latest entry: the record stays small)
  return entry;
}
// One move by `side`, applied to a record: { ok, rec, entries } or { ok: false, reason }.
export function applyOnlineMove(rec, side, i, m, rng, opts) {   // opts.rep: the mover's inputs before the move (core/replay.js), kept on the entry for the other phone's replay
  const full = fullState(rec);
  if (full.winner) return { ok: false, reason: 'over' };
  if (full.turn !== side) return { ok: false, reason: 'turn' };
  const r = playMove(full, i, m, rng, opts);
  if (!r.ok) return r;
  const entries = [settle(full, rec.state.squares && rec.state.squares[i])];
  return { ok: true, rec: matchRecord(full), entries };
}
// The player on the move ran out of time: a random move for them (Risky Rolls: a roll, then the bank), or
// the match lost on a second timeout in a row.
export function applyOnlineTimeout(rec, rng) {
  const full = fullState(rec);
  const r = timeoutMove(full, rng);
  if (!r.ok) return r;
  if (r.lost) return { ok: true, rec: matchRecord(full), entries: [], lost: r.lost };
  const entries = [settle(full, rec.state.squares && full.flash && rec.state.squares[full.flash.square])];
  if (full.timer.bankNext) {
    full.timer.bankNext = false;
    const t = full.lock != null ? full.squares[full.lock].mini.type : null;
    if (t === 'pig' || t === 'craps') {
      const b = playMove(full, full.lock, t === 'pig' ? 'bank' : 'stop', rng, { forced: true });
      if (b.ok) entries.push(settle(full, entries[0].after));
    }
  }
  return { ok: true, rec: matchRecord(full), entries };
}
// Trivia: the square's question turned up by the player to move, for both phones.
export function applyOnlineReveal(rec, side, i) {
  const full = fullState(rec);
  const r = triviaReveal(full, i, side);
  return r.ok ? { ok: true, rec: matchRecord(full) } : r;
}
// Headcount, Flash, Snapshot: Start holds the player to the square (the server too, online), so the
// round's answer, or a timeout counted as a wrong one, goes to that square.
export function applyOnlineStart(rec, side, i) {
  const full = fullState(rec);
  const r = attStart(full, i, side);
  return r.ok ? { ok: true, rec: matchRecord(full) } : r;
}
// Memory: the first card chosen is turned up for both phones (or turned back when tapped again).
export function applyOnlinePick(rec, side, i, card) {
  const full = fullState(rec);
  if (full.winner || full.turn !== side) return { ok: false, reason: 'turn' };
  const sq = full.squares[i];
  if (!sq || sq.owner || sq.mini.type !== 'memory') return { ok: false, reason: 'bad' };
  if (full.lock != null && full.lock !== i) return { ok: false, reason: 'locked' };
  if (card != null && !(Number.isInteger(card) && card >= 0 && card < 9)) return { ok: false, reason: 'bad' };
  const same = full.pickSq === i && full.pick === card;
  full.pick = card == null || same ? null : card;
  full.pickSq = full.pick == null ? null : i;
  return { ok: true, rec: matchRecord(full) };
}
// A fresh match for a room: the names, the mini-games and the time per turn from the lobby.
export function newOnlineMatch(setup, rng, id, now) {         // now: server time (a Super Chaos match's first round is timed from it)
  const st = newState(rng);
  st.setup = Object.assign(defaultSetup(), setup || {}, { mode: 'online' });
  if (setup && setup.games) st.setup.games = Object.assign({}, st.setup.games, setup.games);
  if (!startMatch(st, rng, st.setup.chaos ? scTypes() : null)) return null;
  if (st.setup.chaos) startChaosOnline(st, rng, now || 0);      // Super Chaos: simultaneous rounds (core/chaos.js)
  st.id = id; st.seq = 0; st.recent = [];
  return matchRecord(st);
}
// Super Chaos in a friend room (the record is the round's one truth: core/chaos.js). A player's move for this
// round, sent in once it is over on their phone (scMoveOf); the second one in settles the round on the record,
// with a shared start a moment ahead (now: server time). A move in after the deadline still counts while the
// round is unsettled (better the move made than the timeout rule's).
export function applyChaosSubmit(rec, side, mv, rng, now, lead) {
  const st = rec.state, sc = st.sc;
  if (!sc || !sc.online) return { ok: false, reason: 'bad' };
  if (st.winner) return { ok: false, reason: 'over' };
  if (side !== 'X' && side !== 'O' || !mv || mv.side !== side) return { ok: false, reason: 'bad' };
  if (mv.round !== sc.round) return { ok: false, reason: 'round' };
  if (sc.moves && sc.moves[side]) return { ok: false, reason: 'moved' };   // one move a round: a second is refused, whatever it holds
  if (sc.deadline == null) return { ok: false, reason: 'recap' };   // (the round has not begun: its recap is playing)
  const sq = Number.isInteger(mv.square) ? st.squares[mv.square] : null;   // the move must be in an open square of the game it says
  if (!sq || sq.owner || !mv.mini || mv.mini.type !== sq.mini.type || !Array.isArray(mv.steps)) return { ok: false, reason: 'bad' };
  const full = fullState(rec);
  full.sc.moves = Object.assign({}, full.sc.moves, { [side]: JSON.parse(JSON.stringify(mv)) });
  const both = full.sc.moves.X && full.sc.moves.O;
  const rc = both ? chaosResolveOnline(full, rng, now || 0, lead) : null;
  if (both && !rc) return { ok: false, reason: 'bad' };
  full.seq = (full.seq || 0) + 1;                                // (a change the phones notice)
  return { ok: true, rec: matchRecord(full), resolved: !!rc };
}
// The round's deadline has passed: the timeout rule's move for each side not in, and the round settles.
// Either phone may call it (the first to, past the deadline and the grace for the mover's own phone to send
// its timeout move); refused before then, or once the round is settled.
export function applyChaosDeadline(rec, now, rng) {
  const st = rec.state, sc = st.sc;
  if (!sc || !sc.online) return { ok: false, reason: 'bad' };
  if (st.winner) return { ok: false, reason: 'over' };
  if (sc.deadline == null) return { ok: false, reason: 'recap' };
  if (now < sc.deadline + SC_ONLINE.graceMs) return { ok: false, reason: 'early' };
  const full = fullState(rec);
  full.sc.moves = Object.assign({}, full.sc.moves);
  for (const side of ['X', 'O']) if (!full.sc.moves[side]) full.sc.moves[side] = scTimeoutMove(full, side, rng) || { round: sc.round, side, square: null, auto: true, timeout: true };
  const rc = chaosResolveOnline(full, rng, now);
  if (!rc) return { ok: false, reason: 'bad' };
  full.seq = (full.seq || 0) + 1;
  return { ok: true, rec: matchRecord(full), resolved: true };
}
// The recap is over on a phone: the next round begins on the record, its deadline from now (server time).
// The first phone through sets it; the other finds it set.
export function applyChaosBegin(rec, now) {
  const st = rec.state, sc = st.sc;
  if (!sc || !sc.online || st.winner) return { ok: false, reason: 'bad' };
  if (sc.deadline != null) return { ok: false, reason: 'begun' };
  const full = fullState(rec);
  full.sc.deadline = now + sc.limit * 1000;
  full.seq = (full.seq || 0) + 1;
  return { ok: true, rec: matchRecord(full) };
}
// A player gives up the match (leaving a matchmaking game through the menu): the other side wins.
export function applyOnlineResign(rec, side) {
  const full = fullState(rec);
  if (full.winner) return { ok: false, reason: 'over' };
  if (side !== 'X' && side !== 'O') return { ok: false, reason: 'bad' };
  full.winner = other(side); full.winLine = null; full.winReason = 'resign'; full.resigned = side;
  full.lock = null; full.pick = null; full.pickSq = null;
  if (full.timer) { full.timer.deadline = null; full.timer.for = null; }
  return { ok: true, rec: matchRecord(full) };
}

// A local match left through the menu: it ends as a loss for the side that left.
export function resignLocal(state, side) {
  if (state.winner || (side !== 'X' && side !== 'O')) return false;
  state.winner = other(side); state.winLine = null; state.winReason = 'resign'; state.resigned = side; state.counts = null;
  state.lock = null; state.flash = null; state.done = null; state.spot = null;
  return true;
}
