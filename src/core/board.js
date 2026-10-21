// The main board and the turn flow: a move played (playMove), the result shown and cleared (endFlash),
// leaving a square, timeouts, and the match won or drawn (mainResult).
import { chaosPlay } from './chaos.js';
import { dealable, pickReset } from './match.js';
import { anyMove, applyMove, canMove, newMini, randomLegalMove } from './minis.js';
import { needRng, randInt } from './random.js';
import { repMove, repNorm } from './replay.js';
import { other } from './util.js';
import { ATT_TYPES } from '../games/shared/attention.js';
import { FINGER_TYPES } from '../games/shared/finger.js';
import { RUN_TYPES, runLog } from '../games/shared/runner.js';
import { markCoins } from '../games/coins/rules.js';
import { triviaDeal } from '../games/trivia/rules.js';
import { TYPES, rulesOf } from '../games/index.js';

export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
// The player to move ran out of time. A second timeout in a row loses the match; otherwise a random
// legal move is made for them (Risky Rolls: one roll, then a bank if it did not bust; Hangman: one letter and
// the turn ends even if it hits; Wordle: a random word from the dictionary; Blackjack: stand, dealing first
// if no hand is in play, and again on any new hand a push brings; Ride the Bus: one random guess, and the
// turn ends; Roulette: a random group).
export function timeoutMove(state, rng) {
  rng = needRng(rng);
  const p = state.turn, t = state.timer;
  if (state.winner || state.flash || state.done) return { ok: false, reason: 'busy' };
  t.timeouts[p] += 1; t.streak[p] += 1;
  if (t.streak[p] >= 2) {
    state.winner = other(p); state.winLine = null; state.winReason = 'timeout'; state.counts = null;
    state.lock = null; state.done = null; state.flash = null; state.spot = null; t.deadline = null;
    state.screen = 'win'; state.zoom = null;
    return { ok: true, lost: p };
  }
  const open = state.lock != null ? [state.lock] : state.squares.map((sq, i) => (sq.owner || !canMove(sq.mini, p) ? -1 : i)).filter(i => i >= 0);
  const i = open[randInt(rng, open.length)], mini = state.squares[i].mini;
  const m = mini.type === 'pig' ? (mini.turn && mini.turn.by === p ? 'bank' : 'roll') : mini.type === 'bj' ? 'auto' : randomLegalMove(mini, p, rng);   // Blackjack: stand (dealt first if need be) on every hand until one is won or lost; Roulette: a random group; Echo, Trivia, Odd One Out: a failed attempt or a wrong answer; Cup Pong: a random throw
  const r = playMove(state, i, m, rng, { forced: true, noAgain: mini.type === 'hangman' || mini.type === 'bs' || mini.type === 'bus' });   // a timed-out shot fires once; a timed-out guess ends the turn
  if (!r.ok) return r;
  t.bankNext = state.lock === i && mini.type === 'pig' && m === 'roll';   // the roll kept the turn: bank it next
  return { ok: true, square: i, move: m };
}
export function lineOpen(squares, p) { return LINES.some(line => line.every(k => squares[k].owner !== other(p))); }
export function mainResult(squares) {
  for (const line of LINES) {
    const o = squares[line[0]].owner;
    if (o && o === squares[line[1]].owner && o === squares[line[2]].owner) return { winner: o, line, reason: 'line' };
  }
  if (!lineOpen(squares, 'X') && !lineOpen(squares, 'O')) {
    const x = squares.filter(s => s.owner === 'X').length, o = squares.filter(s => s.owner === 'O').length;
    return { winner: 'draw', line: null, reason: 'blocked', counts: { X: x, O: o } };
  }
  return null;
}
// The old rule, for checking results reported from before the change: most squares on a full board.
export function majorityResult(squares) {
  if (!squares.every(s => s.owner) || LINES.some(l => l.every(k => squares[k].owner === squares[l[0]].owner))) return null;
  const x = squares.filter(s => s.owner === 'X').length;
  return { winner: x > 9 - x ? 'X' : 'O', line: null, reason: 'majority', counts: { X: x, O: 9 - x } };
}

// A full move: the player to move makes move m in square i. On success state.flash
// describes the result; the UI animates it, then calls endFlash, which leaves the result on
// show in the mini-game (state.done). The turn passes only when the player heads back to the
// board (leaveSquare), unless the mini-game grants the same player another move at once
// (flash.kind === 'again'). A square where neither player has a legal move resets like a draw,
// and a player with no legal move anywhere on the board is skipped (flash.pass) so the match
// never freezes.
export function playMove(state, i, m, rng, opts) {
  if (state.sc) return chaosPlay(state, i, m, rng, opts);   // Super Chaos: a move in a simultaneous round (core/chaos.js; in a friend room too, on this phone's own copy)
  rng = needRng(rng); opts = opts || {};
  if (state.winner) return { ok: false, reason: 'over' };
  if (state.flash) return { ok: false, reason: 'busy' };
  if (state.done) return { ok: false, reason: 'done' };          // one move per visit: head back to the board first
  if (state.lock != null && state.lock !== i) return { ok: false, reason: 'locked' };
  const sq = state.squares[i];
  if (!sq) return { ok: false, reason: 'bad' };
  if (sq.owner) return { ok: false, reason: 'claimed' };
  const p = state.turn;
  const range = sq.mini.type === 'hilo' ? [sq.mini.lo, sq.mini.hi] : null;   // the range before the guess, for the UI
  const bjFrom = sq.mini.type === 'bj' && sq.mini.hand ? sq.mini.hand.cards.length : 0;   // Blackjack: the player's cards before (0: this move deals)
  const bonus = state.lock === i && !(sq.mini.type === 'trivia' && sq.mini.fresh === p) && !ATT_TYPES.includes(sq.mini.type) && !FINGER_TYPES.includes(sq.mini.type);   // a bonus move within the same turn (Hangman, Risky Rolls); the hold of a Trivia reveal or an attention game's Start is not one
  const res = applyMove(sq.mini, p, m, rng);
  if (!res.ok) return res;
  const mini = sq.mini;
  if (mini.type === 'trivia' && res.outcome === 'continue') triviaDeal(state, sq, rng);   // a new question once the last was answered right (before the square is judged stuck), from the match's unasked ones
  if (!sq.mv) sq.mv = { X: 0, O: 0 };
  if (!bonus) sq.mv[p] += 1;                                    // turns each side has spent in this mini-game (for the stats)
  if (!Array.isArray(state.sqlog)) state.sqlog = [];
  let outcome = res.outcome, note = res.note || null;
  if (outcome === 'continue' && !canMove(mini, 'X') && !canMove(mini, 'O')) { outcome = 'draw'; note = 'stuck'; }
  const again = !!res.again && !opts.noAgain;                   // a timed-out player's lucky letter does not earn another go
  const flash = {
    kind: outcome === 'win' ? 'claim' : outcome === 'draw' ? 'draw' : again ? 'again' : 'move',
    by: p, next: p, square: i, type: mini.type, note, pass: null, timeout: !!opts.forced,
  };
  const game = rulesOf(mini.type);
  if (game.moveFlash) game.moveFlash(m, p, range, bjFrom, mini, flash);
  const sm = repMove(m), rep = repNorm(opts.rep);                 // the replay: the move (small enough to ride) and the mover's inputs before it (core/replay.js)
  if (sm !== undefined) flash.m = sm;
  if (rep) flash.rep = rep;
  if (outcome === 'win') {
    const w = res.winner || p;                   // a mini-game may hand the square to the other player
    sq.owner = w;
    state.sqlog.push(Object.assign({ t: mini.type, end: 'won', w, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(mini.type) ? runLog(mini) : {}));   // (a runner: its runs and crashes, for the tuning)
    mini.winCells = res.cells || null;
    flash.winner = w; flash.counts = res.counts || null;
    const mr = mainResult(state.squares);
    if (mr) {
      state.winner = mr.winner; state.winLine = mr.line; state.winReason = mr.reason; state.counts = mr.counts || null;
      flash.kind = 'match';
    }
  } else if (outcome === 'draw') {
    flash.drawn = mini;                          // keep the full board for the result overlay
    flash.counts = res.counts || null;
    const dealt = (state.games || []).filter(t => TYPES.includes(t) && dealable(t));      // an older match's list may name a game no longer dealt
    const pool = dealt.length ? dealt : TYPES.filter(t => dealable(t));
    state.sqlog.push(Object.assign({ t: mini.type, end: 'draw', w: null, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(mini.type) ? runLog(mini) : {}));
    sq.mv = { X: 0, O: 0 };
    sq.mini = newMini(pickReset(state, pool, rng, i), rng); // the square resets with a new mini-game from this match's list (one not used yet first)
    if (sq.mini.type === 'trivia') triviaDeal(state, sq, rng);
    flash.newType = sq.mini.type;
  }
  if (!opts.forced && state.timer) state.timer.streak[p] = 0;   // a move made in time
  if (again) {
    state.lock = i;
  } else {
    state.lock = null;
    let next = other(p);
    if (!state.winner && !anyMove(state, next) && anyMove(state, p)) { flash.pass = next; next = p; }
    flash.next = next;                           // who takes over once the phone goes back to the board
    if (!state.winner) markCoins(state, next, rng);   // their turn is about to start: the coins their flips would turn
    if (!state.winner) state.done = flash;       // the move is made; the turn itself passes in leaveSquare
  }
  state.draft = ''; state.pick = null; state.sel = [];
  state.moves += 1; state.lastSquare = i; state.lastBy = p;
  state.flash = flash;
  return { ok: true, flash };
}

// The result overlay is over: the win screen if the match is decided; the same mini-game if the
// mover goes again (bonus move) or if `hold` asks for the result to stay a moment longer (Memory's
// cards turning back over); otherwise straight back to the board, where the turn passes.
export function endFlash(state, hold) {
  if (!state.flash) return false;
  const f = state.flash;
  state.flash = null;
  if (f.recap && state.sc) { if (!f.recapMore) { state.screen = 'board'; state.zoom = null; } return true; }   // Super Chaos: a square's round result, shown in the recap (ui/chaos.js goes on from there; recapMore: another step of the same move follows in the pop-up)
  if (state.sc && f.phys && f.phys.locked && !state.winner) { state.done = null; state.screen = 'mini'; state.zoom = f.square; return true; }   // Super Chaos's Mini Golf: the shot locked in, the player stays at the hole: both shots play out here once the round ends
  if (state.winner) { state.screen = 'win'; state.zoom = null; state.done = null; }
  else if (f.kind === 'again') { state.screen = 'mini'; state.zoom = state.lock; }
  else if (hold && state.done) { state.screen = 'mini'; state.zoom = f.square; }
  else leaveSquare(state);
  return true;
}

// Back to the board. This is where the turn passes: the mover keeps the turn indicator while the
// result is on show, and the next player takes over as the board comes back. Just looking at a
// square passes nothing. Refused while a result is still playing out, while a bonus move is owed,
// or once the match is over.
export function leaveSquare(state) {
  if (state.flash || state.lock != null || state.winner) return false;
  const d = state.done;
  state.stamp = null;
  if (d && state.sc) state.done = null;                         // Super Chaos: the move is in; nothing passes until the round ends
  else if (d) {
    state.turn = d.next;
    state.stamp = d.kind === 'claim' ? d.square : null;
    state.stampId = d.kind === 'claim' ? `${state.id || 'm'}:${state.moves}` : null;  // this claim's stamp: it plays once, whatever re-renders follow
    state.done = null;
  }
  state.screen = 'board'; state.zoom = null; state.draft = ''; state.pick = null; state.sel = []; state.notice = null;
  return true;
}
