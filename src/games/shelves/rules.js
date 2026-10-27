// Shelves: the rules (pure: no page, no clock; the server runs the same code).
import { needRng } from '../../core/random.js';
import { other } from '../../core/util.js';
import { PLACE_MS, randomEmpty } from '../shared/placement.js';
import { tune, tuneLive } from '../../core/tune.js';

// Shelves: 7 shelves of 3 spots. A move puts your mark on an open spot; then a grey mark lands on a random
// open spot (drawn as the move is made). Once every spot is filled, each player scores the shelves they
// are on (up to 7); higher wins, and a tie is a draw (the square resets: a tie never goes to either player).
// The first mover wins nearly every square that is not a draw (99.6% between the computer players, solved
// exactly), so Shelves stays Admin only until it is rebalanced.
export const SHELF = { n: 7, per: 3 };
// A square's own (the admin's settings: shelves, spots a shelf, the computer's mistakes; SHELF without a type).
// The shelves: from its cells.
export const shelfCfg = m => Object.assign({}, SHELF, tune(m));
export const shelfOn = (cells, p, per = SHELF.per) => { let n = 0; for (let s = 0; s * per < cells.length; s++) if (cells.slice(s * per, s * per + per).includes(p)) n++; return n; };
// The computer: a shelf it is not on yet, more so one the other player is missing too, and one nearly full.
export function shelfPick(pm, me, rng) {
  const o = other(me), c = pm.cells, per = shelfCfg(pm).per;
  let best = null;
  for (let i = 0; i < c.length; i++) {
    if (c[i]) continue;
    const s = Math.floor(i / per), row = c.slice(s * per, s * per + per);
    const mineOn = row.includes(me), theirsOn = row.includes(o), filled = row.filter(Boolean).length;
    let v = mineOn ? 0 : 10 + (theirsOn ? 0 : 5) + 3 * filled;
    if (mineOn && !theirsOn && filled === per - 1) v += 6;   // the last spot on a shelf they are missing: theirs no more
    v += rng ? rng() * 0.5 : 0;
    if (!best || v > best.v) best = { i, v };
  }
  return best;
}
export function create(type, rng) {
  const c = tuneLive(type);                                  // (the admin's settings: shelves, spots a shelf)
  return { type, cells: new Array(c.n * c.per).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {   // a spot; then a grey mark on a random open one; once full, most shelves
  if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m]) return { ok: false, reason: 'bad' };
  mini.cells[m] = p;
  const g = randomEmpty(mini.cells, needRng(rng));
  if (g != null) mini.cells[g] = 'G';
  mini.last = { by: p, at: m, grey: g };
  if (mini.cells.includes(null)) return { ok: true, outcome: 'continue', note: 'mark' };
  const per = shelfCfg(mini).per, x = shelfOn(mini.cells, 'X', per), y = shelfOn(mini.cells, 'O', per);
  if (x === y) return { ok: true, outcome: 'draw', note: 'tie', counts: { X: x, O: y } };
  return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
}
export function publicView(mini) {
  return { type: 'shelves', cells: mini.cells.slice() };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.cells, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last, per = shelfCfg(mini).per; flash.shelf = { at: l.at, grey: l.grey, on: { X: shelfOn(mini.cells, 'X', per), O: shelfOn(mini.cells, 'O', per) } }; return;
}
export function flashMs(f, winLen, won) {
  return PLACE_MS.mark + (f.shelf && f.shelf.grey != null ? PLACE_MS.drop : 0) + PLACE_MS.hold + (won ? 600 : 0);
}
