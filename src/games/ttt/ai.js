// Tic-Tac-Toe: the computer's play.
import { LINES } from '../../core/board.js';
import { randInt } from '../../core/random.js';
import { other } from '../../core/util.js';
import { lineNeeds, pickValued, slip } from '../shared/lines.js';
import { tttMinimax, tttOpen } from './rules.js';

// ---- Hard: the solved game, and among equal moves the one a player who can go wrong is likeliest to go wrong against ----
// tttMinimax (rules.js) is already the whole game with the players moving in turn: a win as soon as possible, else
// the draw, else the loss as late as possible. Between two perfect players every square is a draw (and a drawn
// square resets to a new game: nothing gained by either), so what is left to play for is the other side's
// mistakes. tttTrap(cells, p) is what a position is worth to p, the side that has just moved, when the other
// side answers at random and p goes on playing perfect moves, choosing among them by this same measure: its
// chance of the square less the other side's. Hard takes the perfect move with the highest trap value: on the
// empty board a corner (seven of the eight answers lose; the middle draws) rather than the middle (four lose).
// The square ends as the rules end it: three in a row, a full board, or no line left open to either side.
const MEMO = new Map();
const lineOf = (cells, p) => LINES.some(l => cells[l[0]] === p && cells[l[1]] === p && cells[l[2]] === p);
const ended = cells => cells.every(Boolean) || (!tttOpen(cells, 'X') && !tttOpen(cells, 'O'));
// { v: the best move's value for the side to move as tttMinimax counts it (10 a win now, 8 a win with its next
// mark, 0 the draw, -9 a loss to the next mark...), t: the best trap value among the moves of that value }
const step = v => (v > 0 ? 1 - v : v < 0 ? -1 - v : 0);          // a position's value seen from the move before it
function moveValues(cells, p) {   // every empty cell: { i, v, t } (cells restored)
  const o = other(p), out = [];
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    cells[i] = p;
    if (lineOf(cells, p)) out.push({ i, v: 10, t: 1 });
    else if (ended(cells)) out.push({ i, v: 0, t: 0 });
    else out.push({ i, v: step(solve(cells, o).v), t: trapAfter(cells, p) });
    cells[i] = null;
  }
  return out;
}
function solve(cells, p) {
  const key = cells.map(c => c || '.').join('') + p;
  const hit = MEMO.get(key);
  if (hit) return hit;
  const opts = moveValues(cells, p), v = Math.max(...opts.map(x => x.v)), out = { v, t: Math.max(...opts.filter(x => x.v === v).map(x => x.t)) };
  MEMO.set(key, out);
  return out;
}
function trapAfter(cells, p) {   // p has just moved; the other side answers at random
  const o = other(p);
  let sum = 0, n = 0;
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    n++;
    cells[i] = o;
    if (lineOf(cells, o)) sum -= 1; else if (!ended(cells)) sum += solve(cells, p).t;
    cells[i] = null;
  }
  return n ? sum / n : 0;
}
export function tttTrap(cells, p) { return trapAfter(cells.slice(), p); }

// What Hard has worked out about a position, for needs(): kept by the position object itself (the `after` best
// returns), so the other levels' reckoning of a square is untouched.
const KNOWN = new WeakMap();
const SURE = 12;                                                 // (the loser's count against the winner's: a 12 in 13 chance by winChance)
export function needs(pm, p) {
  const k = KNOWN.get(pm);
  if (k) return k[p];
  return lineNeeds(pm.cells, 3, 3, 3, p);
}
export function best(pm, me, rng, style, ctx) {
  if (!(ctx && ctx.level === 'hard')) return pickValued(pm, me, slip(pm, tttMinimax(pm.cells, me), rng), (cells, i) => i);
  const moves = slip(pm, moveValues(pm.cells.slice(), me), rng);   // (the same values as tttMinimax, kept from call to call)
  if (moves.length < 2) return pickValued(pm, me, moves, (cells, i) => i);
  const top = Math.max(...moves.map(m => m.v)), bt = Math.max(...moves.filter(m => m.v === top).map(m => m.t)), pool = moves.filter(m => m.v === top && m.t > bt - 1e-9);
  const b = pickValued(pm, me, pool, (cells, i) => i), same = pool.filter(m => pickValued(pm, me, [m], (cells, i) => i).h === b.h);
  const pick = same.length > 1 ? pickValued(pm, me, [same[randInt(rng, same.length)]], (cells, i) => i) : b;   // (between moves alike in every way, e.g. the four corners: any)
  if (!pick.win && top !== 0 && !ended(pick.after.cells)) {       // a forced line: the winner's own marks still to place, the other side far more
    const w = top > 0 ? me : other(me), mine = Math.max(0.5, top > 0 ? (10 - top) / 2 : (11 + top) / 2);
    KNOWN.set(pick.after, { [w]: mine, [other(w)]: mine * SURE });
  }
  return pick;
}
