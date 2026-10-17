// Shelves: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { other } from '../../core/util.js';
import { PLACE_MS, randomEmpty } from '../shared/placement.js';

// Shelves: 7 shelves of 3 spots. A move puts your mark on an open spot; then a grey mark lands on a random
// open spot (drawn as the move is made). Once every spot is filled, each player scores the shelves they
// are on (up to 7); higher wins, and a tie goes to the player who did not open the square (the first mover
// otherwise wins 99.6% of the squares a tie does not reset; this way, 51.7% to 48.3% between the
// computer players, solved exactly). A square from before (6 shelves, ties reset) plays on as it was.
export const SHELF = { n: 7, per: 3 };
export const shelfOn = (cells, p) => { let n = 0; for (let s = 0; s * SHELF.per < cells.length; s++) if (cells.slice(s * SHELF.per, s * SHELF.per + SHELF.per).includes(p)) n++; return n; };
// The computer: a shelf it is not on yet, more so one the other player is missing too, and one nearly full.
export function shelfPick(pm, me, rng) {
  const o = other(me), c = pm.cells;
  let best = null;
  for (let i = 0; i < c.length; i++) {
    if (c[i]) continue;
    const s = Math.floor(i / SHELF.per), row = c.slice(s * SHELF.per, s * SHELF.per + SHELF.per);
    const mineOn = row.includes(me), theirsOn = row.includes(o), filled = row.filter(Boolean).length;
    let v = mineOn ? 0 : 10 + (theirsOn ? 0 : 5) + 3 * filled;
    if (mineOn && !theirsOn && filled === SHELF.per - 1) v += 6;   // the last spot on a shelf they are missing: theirs no more
    v += rng ? rng() * 0.5 : 0;
    if (!best || v > best.v) best = { i, v };
  }
  return best;
}
export function create(type, rng) {
  return { type, cells: new Array(SHELF.n * SHELF.per).fill(null), first: null, last: null };   // first: who opened the square (a tie goes to the other player)
}
export function apply(mini, p, m, rng, idx) {   // a spot; then a grey mark on a random open one; once full, most shelves
  if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m]) return { ok: false, reason: 'bad' };
  mini.cells[m] = p;
  if (mini.first === null) mini.first = p;                 // (a square from before has no first: its ties reset)
  const g = randomEmpty(mini.cells, needRng(rng));
  if (g != null) mini.cells[g] = 'G';
  mini.last = { by: p, at: m, grey: g };
  if (mini.cells.includes(null)) return { ok: true, outcome: 'continue', note: 'mark' };
  const x = shelfOn(mini.cells, 'X'), y = shelfOn(mini.cells, 'O');
  if (x === y && mini.first) return { ok: true, outcome: 'win', note: 'tiebreak', winner: other(mini.first), counts: { X: x, O: y } };
  if (x === y) return { ok: true, outcome: 'draw', note: 'tie' };
  return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
}
export function publicView(mini) {
  return { type: 'shelves', cells: mini.cells.slice() };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.cells, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.shelf = { at: l.at, grey: l.grey, on: { X: shelfOn(mini.cells, 'X'), O: shelfOn(mini.cells, 'O') } }; return;
}
export function flashMs(f, winLen, won) {
  return PLACE_MS.mark + (f.shelf && f.shelf.grey != null ? PLACE_MS.drop : 0) + PLACE_MS.hold + (won ? 600 : 0);
}
