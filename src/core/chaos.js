// Super Chaos: simultaneous play, in rounds (phase 1: against the computer). Each round both players choose
// any unclaimed square and make one move there (the game's normal move: one run, one hand, one guess...),
// at the same time; neither waits for the other. The round ends when both have made their move (or the
// round's time runs out: the game's timeout rule). Then the results resolve together: a square both won
// this round resets with a new random Super Chaos game; both completing three in a row is a draw; any
// other claim stands. Both may play in the same square in the same round.
//
// How a round runs here: state.squares is the human's view (the board at the round's start, plus their own
// move as they make it: playMove sends their move to chaosPlay). The computer's move is made at the round's
// start on its own copy of the board (scCpu), without seeing the human's choice, and kept apart (sc.cpu)
// until the recap. At the round's end chaosResolve merges each square played (each game's scMerge hook for
// what the two moves share: a guess history, a board, a question), then applies claims and resets.
//
// The games' hooks (rules.js): scCreate (a Super Chaos square, where it differs), scFork (a square as one
// player sees it), scApply (a move made differently), scAfter (a move's result as its player sees it until the
// round ends), scMerge (both moves together). A game without them keeps each player's progress apart already.
import { LINES, playMove } from './board.js';
import { cpuMove } from './ai.js';
import { dealable, pickType, startMatch } from './match.js';
import { applyMove, canMove, newMini, randomLegalMove } from './minis.js';
import { needRng, randInt } from './random.js';
import { other } from './util.js';
import { RUN_TYPES, runLog } from '../games/shared/runner.js';
import { triviaDeal } from '../games/trivia/rules.js';
import { GAMES, TYPES, rulesOf } from '../games/index.js';

export const SC = { roundS: 60 };   // the round's time, in seconds
// The games dealt in Super Chaos (meta.js: superChaos).
export const scTypes = () => TYPES.filter(t => GAMES[t].meta.superChaos);
export const isChaos = st => !!(st && st.sc);
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const isPer = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join() === 'O,X';   // a value each player has their own of
export const scHuman = st => (st.cpu && st.cpu.length === 1 ? other(st.cpu) : 'X');

// A new Super Chaos square of a type: the game's own Super Chaos form where it has one; a Trivia question
// dealt face up (both see it from the start).
export function scSquareMini(state, sq, type, rng) {
  const g = rulesOf(type);
  sq.mini = g.scCreate ? g.scCreate(type, rng) : newMini(type, rng);
  if (type === 'trivia') { triviaDeal(state, sq, rng); sq.mini.shown = true; }
  return sq.mini;
}
const project = (mini, p) => { const g = rulesOf(mini.type); if (g.scFork) g.scFork(mini, p); return mini; };

// A Super Chaos match from the setup screen: the ticked Super Chaos games only, the computer on one side.
export function startChaos(state, rng) {
  rng = needRng(rng);
  if (!startMatch(state, rng, scTypes())) return false;
  if (!state.cpu || state.cpu.length !== 1) { state.screen = 'setup'; return false; }   // (phase 1: against the computer only)
  for (const sq of state.squares) scSquareMini(state, sq, sq.mini.type, rng);
  state.turn = scHuman(state);
  state.sc = { round: 1, limit: SC.roundS, base: null, me: null, moved: null, cpu: null, recap: null };
  scBegin(state, rng);
  return true;
}
// A round begins: every square as the human sees it, the board kept as it stands (base), the computer's move.
export function scBegin(state, rng) {
  const sc = state.sc, me = scHuman(state);
  for (const sq of state.squares) if (!sq.owner) project(sq.mini, me);
  sc.base = state.squares.map(sq => clone(sq.mini));
  sc.me = null; sc.moved = null;
  state.turn = me; state.lock = null; state.done = null; state.flash = null;
  sc.cpu = state.winner ? null : scCpu(state, rng);
}

// The computer's move for this round, on its own copy of the board as it stood when the round began: the
// usual choice of square and the game's own tactics, played through to the end of the move (a Hangman
// letter that hits guesses on, a Risky Rolls turn rolls on until it banks). Kept hidden until the recap.
export function scCpu(state, rng, force) {   // force: { square, moves } to play instead (the tests)
  rng = needRng(rng);
  const sc = state.sc, cpu = state.cpu;
  const sh = {
    squares: state.squares.map((sq, i) => ({ owner: sq.owner, mini: project(clone(sc.base[i]), cpu), mv: { X: 0, O: 0 } })),
    turn: cpu, lock: null, winner: null, flash: null, done: null, timer: null, games: state.games, setup: state.setup,
    sqlog: [], moves: 0, sc: { round: sc.round, me: null, moved: null, cpu: null, recap: null, shadow: true },
  };
  const steps = [];
  const next = k => (force ? (k < force.moves.length ? { square: force.square, move: force.moves[k] } : null) : cpuMove(sh, rng));
  let plan = next(0);
  for (let guard = 0; plan && guard < 80 && !sh.sc.me; guard++) {
    let r = playMove(sh, plan.square, plan.move, rng);
    if (!r.ok) {                                                 // never expected: a random legal move there instead
      const m = randomLegalMove(sh.squares[plan.square].mini, cpu, rng);
      r = playMove(sh, plan.square, m, rng);
      if (!r.ok) break;
    }
    const f = Object.assign({}, r.flash); delete f.drawn;
    steps.push(clone(f));
    sh.flash = null; sh.done = null;
    if (!sh.sc.me) plan = next(guard + 1);
  }
  if (!sh.sc.me) return null;
  const i = sh.sc.me.square;
  return { side: cpu, square: i, mini: sh.squares[i].mini, out: sh.sc.me.out, win: sh.sc.me.win, steps };
}

// A move in a Super Chaos round (playMove hands it here): the player's own square, as they see it. One
// move a round: a move that goes on (a hit, a point standing) keeps the player in that square until it
// ends; then the move is in (sc.me) and nothing more is played until the next round. A square won here is
// only claimed at the round's end.
export function chaosPlay(state, i, m, rng, opts) {
  rng = needRng(rng); opts = opts || {};
  const sc = state.sc;
  if (state.winner) return { ok: false, reason: 'over' };
  if (state.flash) return { ok: false, reason: 'busy' };
  if (state.done) return { ok: false, reason: 'done' };
  if (sc.me || sc.recap) return { ok: false, reason: 'moved' };                       // one move a round
  if ((state.lock != null && state.lock !== i) || (sc.moved != null && sc.moved !== i)) return { ok: false, reason: 'locked' };
  const sq = state.squares[i];
  if (!sq) return { ok: false, reason: 'bad' };
  if (sq.owner) return { ok: false, reason: 'claimed' };
  const p = state.turn, mini = sq.mini, game = rulesOf(mini.type);
  if (!canMove(mini, p)) return { ok: false, reason: 'stuck' };
  const range = mini.type === 'hilo' ? [mini.lo, mini.hi] : null;
  const bjFrom = mini.type === 'bj' && mini.hand ? mini.hand.cards.length : 0;
  const before = game.scAfter ? clone(mini) : null;
  const res = game.scApply ? game.scApply(mini, p, m, rng) : applyMove(mini, p, m, rng);
  if (!res.ok) return res;
  if (game.scAfter) game.scAfter(mini, before, p, res);
  if (!sq.mv) sq.mv = { X: 0, O: 0 };
  if (sc.moved == null) sq.mv[p] += 1;                                                // a round's move counts once, however many steps it takes
  sc.moved = i;
  const win = res.outcome === 'win' && (res.winner || p) === p;
  const again = !!res.again && !opts.noAgain && res.outcome === 'continue';
  const flash = { kind: win ? 'claim' : again ? 'again' : 'move', by: p, next: p, square: i, type: mini.type, note: res.note || null, pass: null, timeout: !!opts.forced, sc: sc.round };
  if (game.moveFlash) game.moveFlash(m, p, range, bjFrom, mini, flash);
  if (win) { flash.winner = p; mini.winCells = res.cells || null; }
  if (again) state.lock = i;
  else { state.lock = null; sc.me = { square: i, out: res.outcome, win }; state.done = flash; }
  state.draft = ''; state.pick = null; state.sel = [];
  state.moves += 1; state.lastSquare = i; state.lastBy = p;
  state.flash = flash;
  return { ok: true, flash };
}

// The round's time ran out before the human's move was in: the game's timeout rule, as in a timed turn (a
// random legal move in a random open square, or in the square they are held to; Risky Rolls banks what it
// can, Craps stops, a Hangman, Battleship or Ride the Bus guess ends the move). Called again while a move
// goes on, until it is in. No match is lost for it.
export function chaosTimeout(state, rng) {
  rng = needRng(rng);
  const sc = state.sc, p = state.turn;
  if (!sc || state.winner || state.flash || state.done || sc.me || sc.recap) return { ok: false, reason: 'busy' };
  const held = state.lock != null ? state.lock : sc.moved;
  const open = held != null ? [held] : state.squares.map((sq, i) => (sq.owner || !canMove(sq.mini, p) ? -1 : i)).filter(i => i >= 0);
  if (!open.length) return { ok: false, reason: 'none' };
  const i = open[randInt(rng, open.length)], mini = state.squares[i].mini;
  const m = mini.type === 'pig' ? (mini.turn && mini.turn.by === p && mini.turn.pot ? 'bank' : 'roll') : mini.type === 'bj' ? 'auto' : randomLegalMove(mini, p, rng);
  const r = playMove(state, i, m, rng, { forced: true, noAgain: mini.type === 'hangman' || mini.type === 'bs' || mini.type === 'bus' });
  return r.ok ? { ok: true, square: i, move: m } : r;
}

// Both moves are in: the round resolves. Each square played merges the two moves (or takes the one), then
// claims and resets apply together, then the match's result. The recap (sc.recap) says what happened, for
// the screen: the computer's square and move, the squares claimed and reset, a Mini Golf replay.
export function chaosResolve(state, rng) {
  rng = needRng(rng);
  const sc = state.sc, me = scHuman(state), cpu = other(me);
  if (!sc || !sc.me || state.winner || sc.recap) return null;
  const moves = { [me]: sc.me };
  if (sc.cpu) moves[cpu] = sc.cpu;
  const recap = { round: sc.round, me: sc.me.square, cpu: sc.cpu ? { square: sc.cpu.square, steps: sc.cpu.steps, type: sc.cpu.mini.type } : null, view: {}, claims: [], resets: [], replay: null, result: null };
  const squares = [...new Set(Object.values(moves).map(x => x.square))];
  const wins = [];
  for (const i of squares) {
    const sq = state.squares[i], base = sc.base[i], forks = {}, own = { X: false, O: false };
    for (const p of ['X', 'O']) if (moves[p] && moves[p].square === i) { forks[p] = p === me ? sq.mini : moves[p].mini; own[p] = !!moves[p].win; }
    const played = ['X', 'O'].filter(p => forks[p]);           // (X's first in a shared history)
    let m;
    if (played.length === 1) m = clone(forks[played[0]]);
    else {
      m = clone(base);
      for (const p of played) for (const k of Object.keys(m)) if (isPer(m[k]) && forks[p][k] && typeof forks[p][k] === 'object' && p in forks[p][k]) m[k][p] = clone(forks[p][k][p]);
      if ('last' in m) m.last = clone(forks[cpu].last === undefined ? forks[me].last : forks[cpu].last);   // (the computer's: the move the recap shows)
    }
    delete m.winCells;
    const game = rulesOf(m.type);
    const out = (game.scMerge && game.scMerge(m, { base, forks, played, wins: own, me, cpu, rng })) || {};
    const win = out.win || own;
    const winners = played.filter(p => win[p]);
    if (sq.mv == null) sq.mv = { X: 0, O: 0 };
    if (forks[cpu]) sq.mv[cpu] += 1;
    if (out.replay) recap.replay = { square: i, type: m.type, last: clone(m.last), win: winners.slice() };
    const drew = played.some(p => moves[p].out === 'draw');
    project(m, me);
    recap.view[i] = clone(m);                                   // the square once both moves are in, before its claim or reset
    if (winners.length === 1 && !out.reset && !drew) {
      const w = winners[0];
      if (forks[w] && forks[w].winCells && !m.winCells) m.winCells = forks[w].winCells;
      sq.mini = m; wins.push([i, w]);
      recap.view[i] = clone(m);
    } else if (winners.length === 2 || out.reset || drew) {      // both won it (or a Hangman word only the two finished together): a new game
      state.sqlog.push(Object.assign({ t: m.type, end: 'draw', w: null, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(m.type) ? runLog(m) : {}));
      sq.mv = { X: 0, O: 0 };
      const pool = scPool(state);
      scSquareMini(state, sq, pickType(pool, rng), rng);
      project(sq.mini, me);
      recap.resets.push({ square: i, from: m.type, to: sq.mini.type, why: winners.length === 2 ? 'both' : out.note || 'draw' });
    } else {
      sq.mini = m;
      if (out.deal && m.type === 'trivia') { triviaDeal(state, sq, rng); sq.mini.shown = true; }
    }
  }
  for (const [i, w] of wins) {
    const sq = state.squares[i];
    sq.owner = w;
    state.sqlog.push(Object.assign({ t: sq.mini.type, end: 'won', w, X: sq.mv.X, O: sq.mv.O }, RUN_TYPES.includes(sq.mini.type) ? runLog(sq.mini) : {}));
    recap.claims.push({ square: i, by: w });
  }
  const mr = scMainResult(state.squares);
  if (mr) { state.winner = mr.winner; state.winLine = mr.line; state.winReason = mr.reason; state.counts = mr.counts || null; recap.result = mr; }
  state.lock = null; state.done = null; state.flash = null;
  state.lastSquare = recap.cpu ? recap.cpu.square : sc.me.square; state.lastBy = recap.cpu ? cpu : me;
  sc.recap = recap;
  return recap;
}
// The recap has been shown: the next round (unless the match is over).
export function chaosNext(state, rng) {
  const sc = state.sc;
  if (!sc || !sc.recap) return false;
  sc.recap = null;
  if (state.winner) { sc.cpu = null; return true; }
  sc.round += 1;
  scBegin(state, rng);
  return true;
}
// The games a reset may deal: this match's Super Chaos games that can be dealt now.
export function scPool(state) {
  const sct = scTypes(), dealt = (state.games || []).filter(t => sct.includes(t) && dealable(t));
  return dealt.length ? dealt : sct.filter(dealable);
}
// The match's result after a round: a line for one player wins; a line for each (completed in the same round)
// is a draw; and, as ever, a board where neither can make a line any more is a draw.
export function scMainResult(squares) {
  const line = p => LINES.find(l => l.every(k => squares[k].owner === p)) || null;
  const x = line('X'), o = line('O');
  const counts = () => ({ X: squares.filter(s => s.owner === 'X').length, O: squares.filter(s => s.owner === 'O').length });
  if (x && o) return { winner: 'draw', line: null, lines: [x, o], reason: 'both', counts: counts() };
  if (x || o) return { winner: x ? 'X' : 'O', line: x || o, reason: 'line' };
  const open = p => LINES.some(l => l.every(k => squares[k].owner !== other(p)));
  if (!open('X') && !open('O')) return { winner: 'draw', line: null, reason: 'blocked', counts: counts() };
  return null;
}
