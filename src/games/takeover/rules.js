// Takeover: the rules (pure: no page, no clock; the server runs the same code).
import { other } from '../../core/util.js';

// Takeover: a 5x5 board, empty to begin with. A move takes an empty cell and the cells above, below,
// left and right of it, the other player's included. Once no cell is empty, most cells wins (25: no tie).
export const TAKE = { n: 5 };
export const takeNear = i => { const n = TAKE.n, r = Math.floor(i / n), c = i % n, out = [i]; if (r > 0) out.push(i - n); if (r < n - 1) out.push(i + n); if (c > 0) out.push(i - 1); if (c < n - 1) out.push(i + 1); return out; };
export const takeCount = (cells, p) => cells.filter(c => c === p).length;
export function takeApply(cells, i, p) { const out = cells.slice(); for (const k of takeNear(i)) out[k] = p; return out; }
// The computer, two moves deep: the cell that leaves it furthest ahead after the other player's best reply.
export function takeSearch(cells, me, rng) {
  const o = other(me), net = c => takeCount(c, me) - takeCount(c, o);
  let best = null;
  for (let i = 0; i < cells.length; i++) {
    if (cells[i]) continue;
    const a = takeApply(cells, i, me);
    let worst = Infinity;
    if (!a.includes(null)) worst = net(a) > 0 ? 100 + net(a) : -100 + net(a);   // the board full: won or lost
    else for (let j = 0; j < a.length; j++) { if (a[j]) continue; const b = takeApply(a, j, o); const v = b.includes(null) ? net(b) : net(b) > 0 ? 100 + net(b) : -100 + net(b); if (v < worst) worst = v; }
    const v = worst + (rng ? rng() * 0.01 : 0);                  // (a hair of chance between equals)
    if (!best || v > best.v) best = { i, v, after: a };
  }
  return best;
}
export function create(type, rng) {
  return { type, cells: new Array(TAKE.n * TAKE.n).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {   // an empty cell, and the cells around it, the other player's too
  if (!Number.isInteger(m) || m < 0 || m >= mini.cells.length || mini.cells[m]) return { ok: false, reason: 'bad' };
  const o = other(p), took = [], flipped = [];
  for (const k of takeNear(m)) { if (mini.cells[k] === o) flipped.push(k); else if (!mini.cells[k]) took.push(k); mini.cells[k] = p; }
  mini.last = { by: p, at: m, took, flipped };
  if (mini.cells.includes(null)) return { ok: true, outcome: 'continue', note: flipped.length ? 'flip' : 'take' };
  const x = takeCount(mini.cells, 'X'), y = takeCount(mini.cells, 'O');
  return { ok: true, outcome: 'win', note: 'full', winner: x > y ? 'X' : 'O', counts: { X: x, O: y } };
}
export function publicView(mini) {
  return { type: 'takeover', cells: mini.cells.slice() };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(mini.cells, c => !c));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last; flash.take = { at: l.at, took: l.took.slice(), flipped: l.flipped.slice(), counts: { X: takeCount(mini.cells, 'X'), O: takeCount(mini.cells, 'O') } }; return;
}
export function flashMs(f, winLen, won) {
  return TAKEOVER_MS.place + TAKEOVER_MS.flip + (won ? 900 : 0);
}
// Takeover: the cell pops in, then its neighbours turn over; Flood: the blob changes colour, then the cells
// it grabs fill in wave by wave out from it.
export const TAKEOVER_MS = { place: 280, flip: 520 };
