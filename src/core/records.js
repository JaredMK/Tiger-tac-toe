// Online match records: what the shared database holds (the public state, the secrets kept apart), moves
// settled on the record, timeouts, resigning.
import { endFlash, playMove, timeoutMove } from './board.js';
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
export const MATCH_FIELDS = ['id', 'seq', 'recent', 'games', 'squares', 'turn', 'lock', 'moves', 'winner', 'winLine', 'winReason', 'resigned', 'counts', 'lastSquare', 'lastBy', 'pick', 'pickSq', 'timer', 'sqlog'];
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
export function newOnlineMatch(setup, rng, id) {
  const st = newState(rng);
  st.setup = Object.assign(defaultSetup(), setup || {}, { mode: 'online' });
  if (setup && setup.games) st.setup.games = Object.assign({}, st.setup.games, setup.games);
  if (!startMatch(st, rng)) return null;
  st.id = id; st.seq = 0; st.recent = [];
  return matchRecord(st);
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
