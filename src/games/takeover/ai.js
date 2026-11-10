// Takeover: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { takeApply, takeCount, takeHard, takeSearch } from './rules.js';
import { TAKE_BOOK } from './table.js';

// ---- Hard on the 5x5 board: the game solved ----
// 25 cells, so each side's cells are one 32-bit mask and a move is two mask operations; the board is full within
// a dozen moves, and with 25 cells there is no tie. takeSolve is the exact result with the players moving in turn
// (1: the side to move takes the square, -1: it loses it), a plain depth-first search with a table; the whole game
// from the empty board is a few hundred thousand positions, any position with two moves played a few ms. The table
// holds exact results only, so it is kept between calls (the answer never depends on what was asked before).
// The first move and the answer to a lone first move come from the book (table.js, written by
// tests/sim/takeover-table.js with this same code: takeRoot).
const N5 = 25, FULL = (1 << N5) - 1;
const MASK = (() => { const m = new Int32Array(N5); for (let i = 0; i < N5; i++) { const r = (i / 5) | 0, c = i % 5; let x = 1 << i; if (r > 0) x |= 1 << (i - 5); if (r < 4) x |= 1 << (i + 5); if (c > 0) x |= 1 << (i - 1); if (c < 4) x |= 1 << (i + 1); m[i] = x; } return m; })();
const pc = x => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
const TT_BITS = 18;
let TK1 = null, TK2 = null, TV = null;
const ORD = Array.from({ length: N5 + 1 }, () => new Int32Array(N5));
function solve(me, opp, ply) {   // the side to move holds `me`: 1 it takes the square, -1 it loses it
  const occ = me | opp;
  if (occ === FULL) return pc(me) > 12 ? 1 : -1;
  const h = (Math.imul(me, 0x9e3779b1) ^ Math.imul(opp, 0x85ebca6b)) >>> (32 - TT_BITS);
  if (TK1[h] === me && TK2[h] === opp) return TV[h];
  const mv = ORD[ply];
  let emp = FULL & ~occ, k = 0;
  while (emp) {                                                  // the cells that take most first
    const b = emp & -emp, i = 31 - Math.clz32(b), m = MASK[i], x = (pc(m & ~occ) + 2 * pc(m & opp)) * 32 + i;
    emp ^= b;
    let q = k++;
    while (q > 0 && mv[q - 1] < x) { mv[q] = mv[q - 1]; q--; }
    mv[q] = x;
  }
  let res = -1;
  for (let j = 0; j < k; j++) { const m = MASK[mv[j] & 31]; if (solve(opp & ~m, me | m, ply + 1) < 0) { res = 1; break; } }
  TK1[h] = me; TK2[h] = opp; TV[h] = res;
  return res;
}
export function takeSolve(me, opp) {
  if (!TK1) { TK1 = new Int32Array(1 << TT_BITS).fill(-1); TK2 = new Int32Array(1 << TT_BITS); TV = new Int8Array(1 << TT_BITS); }
  return solve(me, opp, 0);
}
export const takeBits = (cells, p) => { let x = 0; for (let i = 0; i < N5; i++) if (cells[i] === p) x |= 1 << i; return x; };
// Every move of the side to move, judged: v (1 it wins the square with it, -1 it loses it against the best
// answers), lead (its cells less the other side's right after it) and, for a losing move, slips: the share of the
// other side's answers that throw the win away.
export function takeRoot(me, opp) {
  const out = [];
  let emp = FULL & ~(me | opp);
  while (emp) {
    const b = emp & -emp, i = 31 - Math.clz32(b), m = MASK[i], a = me | m, o = opp & ~m;
    emp ^= b;
    const v = (a | o) === FULL ? (pc(a) > 12 ? 1 : -1) : -takeSolve(o, a);
    let bad = 0, tot = 0;
    if (v < 0) {
      let e2 = FULL & ~(a | o);
      while (e2) { const b2 = e2 & -e2, m2 = MASK[31 - Math.clz32(b2)], o2 = o | m2, a2 = a & ~m2; e2 ^= b2; tot++; if (((a2 | o2) === FULL ? (pc(o2) > 12 ? 1 : -1) : -takeSolve(a2, o2)) < 0) bad++; }
    }
    out.push({ i, v, lead: pc(a) - pc(o), slips: tot ? bad / tot : 0 });
  }
  return out;
}
// The moves to choose between: the winning ones that leave it furthest ahead; with none, the losing ones the other
// side is likeliest to go wrong against (then furthest ahead).
export function takeBest(me, opp) {
  const all = takeRoot(me, opp), win = all.some(x => x.v > 0), pool = all.filter(x => (x.v > 0) === win);
  const key = x => (win ? x.lead : x.slips * 1000 + x.lead), top = Math.max(...pool.map(key));
  return { win, moves: pool.filter(x => key(x) === top).map(x => x.i) };
}
const stonesKey = (me, opp) => me + ':' + opp;
// What Hard has worked out about a position, for needs(): kept by the position object itself (the public view the
// square choice passes to best and then to needs, and the `after` best returns), so the other levels' reckoning
// of a square is untouched.
const KNOWN = new WeakMap();
const SURE = 12;                                                 // (the loser's count against the winner's: a 12 in 13 chance by winChance)
function settled(cells, winner) {   // the square is `winner`'s with the players moving in turn: its share of the moves that fill the board; the other side far more
  const e = cells.filter(c => !c).length, mine = Math.max(0.5, e / 4.5);
  return { [winner]: mine, [other(winner)]: mine * SURE };
}
function hard5(pm, me, rng) {
  const o = other(me), a = takeBits(pm.cells, me), b = takeBits(pm.cells, o), book = TAKE_BOOK[stonesKey(a, b)];
  const pick = book ? { win: !!book.w, moves: book.m } : takeBest(a, b);
  const i = pick.moves[pick.moves.length > 1 ? randInt(rng, pick.moves.length) : 0], after = takeApply(pm.cells, i, me);
  if (!book && takeSolve(b, a) < 0 === pick.win) KNOWN.set(pm, settled(pm.cells, pick.win ? me : o));   // (whoever moves next: the same side takes it)
  return { i, after, known: after.includes(null) ? settled(after, pick.win ? me : o) : null };
}

// The moves p still needs: from the lead and the moves left; where Hard has solved the position (KNOWN), from who
// takes the square.
export function needs(pm, p) {
  const k = KNOWN.get(pm);
  if (k) return k[p];
  const e = pm.cells.filter(c => !c).length; return e ? raceNeeds(takeCount(pm.cells, p) - takeCount(pm.cells, other(p)), e / 5, 3) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const t = tune(pm), e = pm.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0), hard = !!(ctx && ctx.level === 'hard');
  const slip = t.miss && rng() < t.miss / 100, i = slip ? e[randInt(rng, e.length)] : null;   // (the admin's settings: a mistake now and then, any empty cell)
  let b;
  if (slip) b = { i, after: takeApply(pm.cells, i, me) };
  else if (hard && pm.cells.length === N5) b = hard5(pm, me, rng);   // (Hard on 5x5: the solved game)
  else b = hard ? takeHard(pm.cells, me, ctx.until) : takeSearch(pm.cells, me, rng, t.depth);   // (Hard on 7x7: the deep search, as the time allows)
  const full = !b.after.includes(null), o = other(me), after = { type: 'takeover', cells: b.after };
  if (b.known) KNOWN.set(after, b.known);
  return { move: b.i, after, win: full && takeCount(b.after, me) > takeCount(b.after, o) };
}
