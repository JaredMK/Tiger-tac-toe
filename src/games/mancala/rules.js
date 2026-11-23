// Mancala Race: the rules (pure: no page, no clock; the server runs the same code).
// One board: `pits[p][i]` the seeds in p's pit i (i counts towards p's bank: pit n-1 is the one beside it), `bank[p]`.
// A move is one of the mover's pits that holds seeds (its number): its seeds are sown one at a time: on along the
// mover's side, into the mover's bank, then along the other side from its far end (never into the other bank), and
// round again. Last seed in the mover's bank: the same player goes again (`again`, the `extra` setting). Last seed in
// a pit of the mover's that was empty, with seeds opposite: that seed and the ones opposite go to the mover's bank
// (the `capture` setting). The first to bank `target` takes the square: looked at first, on the move's own sowing.
// Then, once a move leaves either side with no seeds (`v: 2`), the square ends in that same move: every seed still in
// a pit goes to the bank of that pit's owner (the sweep: `last.sw` the seeds each pit held, `last.fin` the banks after
// it) and the higher bank takes the square, level banks a draw (the square resets). A deal never leaves a side empty
// (every pit gets a seed at least); a square found so anyway is over at its first move, the move 'end', by the sweep.
// A square dealt before (no `v: 2`) plays on under its old rule: a player with nothing to sow on their turn ends it
// (the move 'end'): whoever has banked more takes the square, level a draw.
import { needRng, randInt } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

// ms: the seeds lifted into the hand, each seed carried on and dropped, a capture (the hand scoops its own seed, crosses
// to the opposite pit, scoops those, carries them to the bank), the opposite pit's scoop within it, the result; and
// for a square ended by an empty side: the beat before the sweep, the hand from one swept pit to the next, the last
// pit to the bank (the seeds poured in), the count (both banks from 0 to their totals, the higher taking `count`), the
// beat from the count to the verdict.
export const MANC = { lift: 260, sow: 170, cap: 720, scoop: 240, hold: 420, beat: 320, sweep: 170, pour: 380, count: 1000, say: 160 };
export function mancCfg(mini) { const t = tune(mini); return { target: t.target, extra: t.extra !== 'off', capture: t.capture !== 'off', cross: t.cross !== 'off', sweep: (mini.v || 1) >= 2 }; }
// The deal: `seeds` in each pit on average, the pits uneven when `mix` is on (each pit one seed either way of the
// average at random, the two sides the same, pit for pit, and the total as it would be; never a pit under one seed):
// from a level, even start the same game was played every time and the first mover took every square.
export function create(type, rng) {
  const t = tuneLive(type), r = needRng(rng), n = t.pits, row = new Array(n).fill(Math.max(1, t.seeds));
  if (t.mix !== 'off') for (let k = 0; k < n * 2; k++) { const a = randInt(r, n), b = randInt(r, n); if (a !== b && row[a] > Math.max(1, t.seeds - 1) && row[b] < t.seeds + 1) { row[a]--; row[b]++; } }
  return { type, v: 2, pits: { X: row.slice(), O: row.slice() }, bank: { X: 0, O: 0 }, last: null };
}
const other = p => (p === 'X' ? 'O' : 'X');
const sum = a => a.reduce((s, v) => s + v, 0);
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
// Either side with no seeds: the square is over (`v: 2`).
export const mancOut = pits => pits.X.every(v => !v) || pits.O.every(v => !v);
// The banks once every seed still in a pit has gone to its owner's (the sweep), or null while both sides have seeds.
export const mancFinal = (pits, bank) => (mancOut(pits) ? { X: bank.X + sum(pits.X), O: bank.O + sum(pits.O) } : null);
export const mancMoves = (mini, p) => ((mini.v || 1) >= 2 && mancOut(mini.pits) ? [] : mini.pits[p].map((v, i) => (v > 0 ? i : -1)).filter(i => i >= 0));
// The sweep: the seeds left go to their owners' banks (noted on the move: `sw`, `fin`), the higher bank takes the square.
function sweepEnd(mini) {
  const sw = { X: mini.pits.X.slice(), O: mini.pits.O.slice() }, fin = mancFinal(mini.pits, mini.bank);
  mini.bank = fin; mini.pits = { X: sw.X.map(() => 0), O: sw.O.map(() => 0) };
  Object.assign(mini.last, { again: false, sw, fin: { X: fin.X, O: fin.O } });
  if (fin.X === fin.O) return { ok: true, outcome: 'draw', note: 'tie' };
  return { ok: true, outcome: 'win', winner: fin.X > fin.O ? 'X' : 'O', note: 'swept' };
}
export function apply(mini, p, m, rng, idx) {
  const c = mancCfg(mini), moves = mancMoves(mini, p);
  if (m === 'end') {
    if (c.sweep) {                                               // (only a square found with a side already empty: no deal makes one)
      if (!mancOut(mini.pits)) return { ok: false, reason: 'canmove' };
      mini.last = { by: p };
      return sweepEnd(mini);
    }
    if (moves.length) return { ok: false, reason: 'canmove' };
    mini.last = { by: p, end: true };
    if (mini.bank.X === mini.bank.O) return { ok: true, outcome: 'draw', note: 'tie' };
    return { ok: true, outcome: 'win', winner: mini.bank.X > mini.bank.O ? 'X' : 'O', note: 'out' };
  }
  if (!moves.includes(m)) return { ok: false, reason: 'bad' };
  const from = { X: mini.bank.X, O: mini.bank.O }, n = mini.pits[p][m], r = mancSow(mini.pits, mini.bank, p, m, c);
  mini.pits = r.pits; mini.bank = r.bank;
  mini.last = { by: p, i: m, n, path: r.path, cap: r.cap, again: r.again, from: from[p], to: r.bank[p] };
  if (mini.bank[p] >= c.target) { mini.last.again = false; return { ok: true, outcome: 'win', note: 'won' }; }   // (a win never goes again: its last seed in the bank is the winning one)
  if (c.sweep && mancOut(mini.pits)) return sweepEnd(mini);
  return r.again ? { ok: true, outcome: 'continue', note: 'again', again: true } : { ok: true, outcome: 'continue', note: r.cap ? 'capture' : 'sow' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return { type: 'mancala', v: mini.v, pits: { X: mini.pits.X.slice(), O: mini.pits.O.slice() }, bank: { X: mini.bank.X, O: mini.bank.O }, last: mini.last ? JSON.parse(JSON.stringify(mini.last)) : null }; }
export function randomMove(mini, p, rng, from, empties) { const mv = mancMoves(mini, p); return mv.length ? from(mv) : 'end'; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.mc = JSON.parse(JSON.stringify(mini.last)); }
// A move's moments (ms from its start), from its flash alone: `sow` the sowing's end (and its capture's); for a square
// ended by an empty side, the sweep: `side` the side whose seeds are swept (none: nothing left on either), `ks` its pits
// with seeds in the order the hand takes them (along the side towards its bank), `scoop` when each is scooped, `drop`
// when they pour into the bank; `count` when both banks start counting up from 0 (the higher for MANC.count, the lower
// for its share of it: `cms`), `say` the verdict; `end` the last of them.
export function mancTimes(l) {
  const sow = l.path ? MANC.lift + l.path.length * MANC.sow + (l.cap ? MANC.cap : 0) : 0;
  if (!l.sw) return { sow, end: l.end ? 200 : sow };
  const side = ['X', 'O'].find(s => l.sw[s].some(v => v > 0)) || null, ks = side ? l.sw[side].map((v, i) => (v > 0 ? i : -1)).filter(i => i >= 0) : [];
  const t1 = sow + MANC.beat, scoop = ks.map((i, k) => t1 + k * MANC.sweep), drop = side ? t1 + (ks.length - 1) * MANC.sweep + MANC.pour : null;
  const count = drop != null ? drop + MANC.beat : t1, hi = Math.max(l.fin.X, l.fin.O, 1);
  const cms = { X: Math.round(MANC.count * l.fin.X / hi), O: Math.round(MANC.count * l.fin.O / hi) }, say = count + MANC.count + MANC.say;
  return { sow, side, ks, scoop, drop, count, cms, say, end: say };
}
export const mancMs = l => mancTimes(l).end;
export function flashMs(f, winLen, won) { const l = f.mc; return (l ? mancMs(l) : 300) + (l && l.again ? 80 : MANC.hold) + (won ? 400 : 0); }
