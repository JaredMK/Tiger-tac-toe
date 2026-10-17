// Tic-Tac-Toe: the rules (pure: no page, no clock; the server runs the same code).
import { LINES } from '../../core/board.js';
import { other } from '../../core/util.js';
import { findRun } from '../shared/lines.js';

export function create(type, rng) {
  return { type, cells: new Array(9).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!idx(9)) return { ok: false, reason: 'bad' };
  if (mini.cells[m]) return { ok: false, reason: 'taken' };
  mini.cells[m] = p; mini.last = m;
  const run = findRun(mini.cells, 3, 3, 3, p);
  if (run) return { ok: true, outcome: 'win', cells: run };
  if (mini.cells.every(Boolean)) return { ok: true, outcome: 'draw' };
  if (!tttOpen(mini.cells, 'X') && !tttOpen(mini.cells, 'O')) return { ok: true, outcome: 'draw', note: 'blocked' };   // nobody can make three in a row now: a draw, as if the board were full
  return { ok: true, outcome: 'continue' };
}
export function publicView(mini) {
  return { type: mini.type, cells: mini.cells.slice() };
}

// ---- tactics inside one square: the best local move, from public information ----
// Each returns { move, win?, after?, q?, shared? }: `after` is the position after a move whose result is
// certain (and `win` whether it claims the square); `q` is the chance a chancy move claims it at once;
// `shared` marks games where every clue helps the other player just as much.
export function tttMinimax(cells, me) {   // every move's value for me, from full minimax (alternating play within the square)
  const memo = new Map();
  const search = (p, depth) => {                    // best value for p, p to move
    const key = cells.map(c => c || '.').join('') + p;
    if (memo.has(key)) return memo.get(key);
    let best = -Infinity, any = false;
    for (let i = 0; i < 9; i++) {
      if (cells[i]) continue;
      any = true;
      cells[i] = p;
      const v = findRun(cells, 3, 3, 3, p) ? 10 - depth : cells.every(Boolean) ? 0 : -search(other(p), depth + 1);
      cells[i] = null;
      if (v > best) best = v;
    }
    if (!any) best = 0;
    memo.set(key, best);
    return best;
  };
  const out = [];
  for (let i = 0; i < 9; i++) {
    if (cells[i]) continue;
    cells[i] = me;
    const v = findRun(cells, 3, 3, 3, me) ? 10 : cells.every(Boolean) ? 0 : -search(other(me), 1);
    cells[i] = null;
    out.push({ i, v });
  }
  return out;
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.cells, c => !c));
}

// Main-board result: three claimed squares in a row wins. Once neither player can still make a line
// (every line holds a square of each), the match is a draw there and then (winner 'draw', reason
// 'blocked'): nobody has to play out squares that cannot change the result. (Matches from before this
// rule could end on 'majority': most squares once all nine were claimed. A full board with no line is
// now always a draw, since by then no line was open to anyone.)
// A tic-tac-toe line p can still complete: none of its cells holds the other player's mark. (Moves in a
// square need not alternate, a player can play the same square turn after turn, so no count of moves matters.)
export function tttOpen(cells, p) { return LINES.some(line => line.every(k => cells[k] !== other(p))); }
export function flashMs(f, winLen, won) {
  return won ? 950 : 450;
}
