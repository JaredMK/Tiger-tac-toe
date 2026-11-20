// Mancala Race: the rules (pure: no page, no clock; the server runs the same code).
// One board: `pits[p][i]` the seeds in p's pit i (i counts towards p's bank: pit n-1 is the one beside it), `bank[p]`.
// A move is one of the mover's pits that holds seeds (its number): its seeds are sown one at a time: on along the
// mover's side, into the mover's bank, then along the other side from its far end (never into the other bank), and
// round again. Last seed in the mover's bank: the same player goes again (`again`, the `extra` setting). Last seed in
// a pit of the mover's that was empty, with seeds opposite: that seed and the ones opposite go to the mover's bank
// (the `capture` setting). The first to bank `target` takes the square. A player with nothing to sow on their turn
// ends it (the move 'end'): whoever has banked more takes the square, level a draw: so a player alone always ends it.
import { needRng, randInt } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

export const MANC = { lift: 200, sow: 150, cap: 380, hold: 420 };  // ms: the seeds lifted, each seed dropped, a capture's sweep, the result
export function mancCfg(mini) { const t = tune(mini); return { target: t.target, extra: t.extra !== 'off', capture: t.capture !== 'off', cross: t.cross !== 'off' }; }
// The deal: `seeds` in each pit on average, the pits uneven when `mix` is on (each pit one seed either way of the
// average at random, the two sides the same, pit for pit, and the total as it would be): from a level, even start the
// same game was played every time and the first mover took every square.
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), n = t.pits, row = new Array(n).fill(t.seeds);
  if (t.mix !== 'off') for (let k = 0; k < n * 2; k++) { const a = randInt(r, n), b = randInt(r, n); if (a !== b && row[a] > Math.max(1, t.seeds - 1) && row[b] < t.seeds + 1) { row[a]--; row[b]++; } }
  return { type, v: 1, pits: { X: row.slice(), O: row.slice() }, bank: { X: 0, O: 0 }, last: null };
}
const other = p => (p === 'X' ? 'O' : 'X');
// A sowing worked out on copies: { pits, bank, path: [[side, pit | 'bank'], ...] (where each seed went), again, cap: { i, n } | null }.
export function mancSow(pits, bank, p, i, c) {
  const n = pits[p].length, o = other(p), P = { X: pits.X.slice(), O: pits.O.slice() }, B = { X: bank.X, O: bank.O }, path = [];
  let k = P[p][i], side = p, at = i; P[p][i] = 0;
  while (k > 0) {
    at++;
    if (side === p && at === n) { B[p]++; path.push([p, 'bank']); k--; if (k > 0) { side = c.cross ? o : p; at = -1; } continue; }   // (`cross` off: past the bank the seeds go round the mover's own side again, never onto the other)
    if (side === o && at === n) { side = p; at = -1; continue; }   // past the other side's end: back onto the mover's own (never the other bank)
    P[side][at]++; path.push([side, at]); k--;
  }
  const end = path[path.length - 1], again = c.extra && end[1] === 'bank';
  let cap = null;
  if (c.capture && end[0] === p && end[1] !== 'bank' && P[p][end[1]] === 1 && P[o][n - 1 - end[1]] > 0) { cap = { i: end[1], n: P[o][n - 1 - end[1]] + 1 }; B[p] += cap.n; P[p][end[1]] = 0; P[o][n - 1 - end[1]] = 0; }
  return { pits: P, bank: B, path, again, cap };
}
export const mancMoves = (mini, p) => mini.pits[p].map((v, i) => (v > 0 ? i : -1)).filter(i => i >= 0);
export function apply(mini, p, m, rng, idx) {
  const c = mancCfg(mini), moves = mancMoves(mini, p), o = other(p);
  if (m === 'end') {
    if (moves.length) return { ok: false, reason: 'canmove' };
    mini.last = { by: p, end: true };
    if (mini.bank.X === mini.bank.O) return { ok: true, outcome: 'draw', note: 'tie' };
    return { ok: true, outcome: 'win', winner: mini.bank.X > mini.bank.O ? 'X' : 'O', note: 'out' };
  }
  if (!moves.includes(m)) return { ok: false, reason: 'bad' };
  const from = { X: mini.bank.X, O: mini.bank.O }, n = mini.pits[p][m], r = mancSow(mini.pits, mini.bank, p, m, c);
  mini.pits = r.pits; mini.bank = r.bank;
  mini.last = { by: p, i: m, n, path: r.path, cap: r.cap, again: r.again, from: from[p], to: r.bank[p] };
  if (mini.bank[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  return r.again ? { ok: true, outcome: 'continue', note: 'again', again: true } : { ok: true, outcome: 'continue', note: r.cap ? 'capture' : 'sow' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return { type: 'mancala', v: mini.v, pits: { X: mini.pits.X.slice(), O: mini.pits.O.slice() }, bank: { X: mini.bank.X, O: mini.bank.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null }; }
export function randomMove(mini, p, rng, from, empties) { const mv = mancMoves(mini, p); return mv.length ? from(mv) : 'end'; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.mc = JSON.parse(JSON.stringify(mini.last)); }
export const mancMs = l => (l.end ? 200 : MANC.lift + l.path.length * MANC.sow + (l.cap ? MANC.cap : 0));
export function flashMs(f, winLen, won) { const l = f.mc; return (l ? mancMs(l) : 300) + (l && l.again ? 80 : MANC.hold) + (won ? 400 : 0); }
