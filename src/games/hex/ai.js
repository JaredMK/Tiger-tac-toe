// Hex: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { pickValued, slip } from '../shared/lines.js';
import { HEX_HARD, HEX_OPEN, HEX_SWAP, hexCanSwap, hexDist, hexHard, hexMoves, hexSize, hexT } from './rules.js';
import { HEX_BOOK } from './table.js';

// ---- Hard on the 5x5 board: the game solved ----
// Each side's stones are one 32-bit mask (X joins the left and right edges, O the top and bottom). hexSolver is an
// exact search with the players moving in turn: who wins with `s` to move (Hex has no draw). What keeps it small:
//  - a table of positions with, for each, the winner and the cells the winner's play relies on (its carrier);
//  - the must-play rule: once a move is shown to lose, only the cells inside the carrier of the answer that beat it
//    can still be better (a stone outside it changes nothing of that answer), so the candidates shrink with every
//    refutation;
//  - a win seen without search: the side that has just moved is home when its chains and its two edges are linked
//    by pairs of empty cells, each pair used once (whichever cell of a pair the other side takes, it takes the
//    other); and a cell that completes the mover's chain;
//  - the order: the cells on both sides' shortest ways across first, then the other side's, then the mover's own,
//    the middle of the board before the rim.
// The 25 openings are about fifteen million positions of this search and the book's lines some three hundred
// million (tests/sim/hex-table.js: two minutes), far too many for a move's time, but from about five stones on a
// position is a few thousand. So: the book (table.js) holds the
// winner's move wherever the search would not finish within HEX_SOLVE.cap positions, along every line the other
// side can choose; from there the search finishes at the board. In a lost position Hard plays the move that leaves
// the other side the fewest winning answers (HEX_SOLVE.trap positions more), and where the search runs out (lines
// off the book: a player moving twice running), the deep search of before (hexHard).
// The solved openings: with X to open and no swap, X wins from HEX_WIN and loses from the other twelve cells. The
// swap here leaves the stone where it is and gives it to the other player, so O does well to take X's stone k only
// when an O stone there wins (k turned round the long diagonal is in HEX_WIN): the two cells in HEX_WIN whose
// turned cell is not (3 and 21: the second cell from the far corner of the first and last rows) win for the opener
// whatever the answer. Every other opening loses to the right choice.
export const HEX_SOLVE = { cap: 20000, trap: 20000, ahead: 5000, deep: 4000 };   // (deep: the deep search's positions after a search that ran out, without a clock)
export const HEX_WIN = [3, 4, 6, 7, 8, 11, 12, 13, 16, 17, 18, 20, 21];
const N = 5, HN = 25, FULL = (1 << HN) - 1;
const C0 = 0x108421, C4 = C0 << 4, R0 = 31, R4 = 31 << 20, NC0 = FULL & ~C0, NC4 = FULL & ~C4;
const START = [C0, R0], END = [C4, R4];                         // side 0: X (left to right); side 1: O (top to bottom)
const nb = s => (((s << 1) & NC0) | ((s >>> 1) & NC4) | (s << 5) | (s >>> 5) | ((s >>> 4) & NC0) | ((s << 4) & NC4)) & FULL;   // every neighbour of the cells in s
const fill = (seed, mask) => { let s = seed & mask; for (;;) { const t = (s | nb(s)) & mask; if (t === s) return s; s = t; } };
const far = i => { const dr = ((i / N) | 0) - 2, dc = i % N - 2; return Math.max(Math.abs(dr), Math.abs(dc), Math.abs(dr + dc)); };
const ORD = Array.from({ length: HN }, (_, i) => i).sort((x, y) => far(x) - far(y) || x - y).map(i => 1 << i);   // the middle first
const first = set => { for (let q = 0; q < HN; q++) if (set & ORD[q]) return ORD[q]; return 0; };
const cellOf = b => 31 - Math.clz32(b);
const RA = new Int32Array(HN + 2), RB = new Int32Array(HN + 2), GS = new Int32Array(16), GN = new Int32Array(16);
let pathOut = 0;
// The fewest stones side s still needs to join its edges (99: cut off; 0: joined); pathOut: the empty cells on a
// shortest way across.
function ways(own, emp, s) {
  const st = START[s], en = END[s];
  let reach = fill(st, own);
  pathOut = 0;
  if (reach & en) return 0;
  let front = (nb(reach) | st) & emp, seen = front, na = 0, D = 99;
  while (front) {
    RA[++na] = front;
    const grp = fill(nb(front) & own & ~reach, own & ~reach);
    reach |= grp;
    if ((front | grp) & en) { D = na; break; }
    const nxt = nb(front | grp) & emp & ~seen;
    seen |= nxt; front = nxt;
  }
  if (D === 99) return 99;
  reach = fill(en, own); front = (nb(reach) | en) & emp; seen = front;
  let nn = 0;
  while (front && nn < D) {
    RB[++nn] = front;
    const grp = fill(nb(front) & own & ~reach, own & ~reach);
    reach |= grp;
    const nxt = nb(front | grp) & emp & ~seen;
    seen |= nxt; front = nxt;
  }
  for (let d = 1; d <= D; d++) { const e = D + 1 - d; if (e <= nn) pathOut |= RA[d] & RB[e]; }
  return D;
}
// Side s home by pairs (the other side to move): the cells of the pairs used, or -1.
function paired(own, emp, s) {
  const st = START[s], en = END[s];
  let R = fill(st, own), NR = (nb(R) | st) & emp, used = 0, rest = own & ~R, ng = 0;
  if (R & en) return 0;
  while (rest) { const g = fill(rest & -rest, rest); rest &= ~g; GS[ng] = g; GN[ng] = nb(g) & emp; ng++; }
  let live = (1 << ng) - 1;
  for (;;) {
    const ce = NR & en & ~used;
    if (ce & (ce - 1)) { const b = ce & -ce, c2 = ce ^ b; return used | b | (c2 & -c2); }
    let any = false;
    for (let i = 0; i < ng; i++) {
      if (!(live & (1 << i))) continue;
      const c = NR & GN[i] & ~used;
      if (!(c & (c - 1))) continue;
      const b = c & -c, c2 = c ^ b;
      used |= b | (c2 & -c2); live &= ~(1 << i); R |= GS[i]; NR |= GN[i]; any = true;
      if (GS[i] & en) return used;
    }
    if (!any) return -1;
  }
}
export function hexSolver(bits) {
  const SZ = 1 << bits, K1 = new Int32Array(SZ).fill(-1), K2 = new Int32Array(SZ), V = new Int8Array(SZ), CR = new Int32Array(SZ);
  let nodes = 0, limit = Infinity, stop = false, car = 0;
  const solve = (X, O, s) => {   // 1: the side to move wins; -1: it loses; car: the winner's carrier
    if (++nodes > limit) { stop = true; return 0; }
    const own = s ? O : X, opp = s ? X : O, emp = FULL & ~(X | O);
    const k1 = X | (s << 25), h = (Math.imul(k1, 0x9e3779b1) ^ Math.imul(O, 0x85ebca6b)) >>> (32 - bits);
    if (K1[h] === k1 && K2[h] === O) { car = CR[h]; return V[h]; }
    let res = -1, rc = 0;
    const pw = paired(opp, emp, 1 - s);
    if (pw >= 0) rc = pw;
    else {
      const D = ways(own, emp, s), mine = pathOut;
      if (D === 1) { res = 1; rc = mine & -mine; }
      else {
        ways(opp, emp, 1 - s);
        const theirs = pathOut, p1 = mine & theirs, p2 = theirs & ~mine, p3 = mine & ~theirs;
        let must = emp, uni = 0;
        while (must) {
          const b = first((must & p1) || (must & p2) || (must & p3) || must);
          must ^= b;
          const v = s ? -solve(X, O | b, 0) : -solve(X | b, O, 1);
          if (stop) return 0;
          if (v > 0) { res = 1; rc = car | b; break; }
          uni |= car; must &= car;
        }
        if (res < 0) rc = uni;
      }
    }
    K1[h] = k1; K2[h] = O; V[h] = res; CR[h] = rc; car = rc;
    return res;
  };
  const after = (X, O, s, b) => (s ? -solve(X, O | b, 0) : -solve(X | b, O, 1));   // the mover's result with a stone on b
  return {
    start(cap) { K1.fill(-1); nodes = 0; limit = cap || Infinity; stop = false; },
    more(cap) { limit = nodes + cap; stop = false; },
    nodes: () => nodes,
    // who wins with s to move: 1 s, -1 the other side, 0 the search ran out
    value(X, O, s) { const v = solve(X, O, s); return stop ? 0 : v; },
    // the same with s's winning stone: { v, b } (b a bit, 0 without one)
    move(X, O, s) {
      const emp = FULL & ~(X | O), own = s ? O : X, opp = s ? X : O;
      if (paired(opp, emp, 1 - s) >= 0) return { v: -1, b: 0 };
      const D = ways(own, emp, s), mine = pathOut;
      if (D === 1) return { v: 1, b: first(mine) };
      ways(opp, emp, 1 - s);
      const theirs = pathOut, p1 = mine & theirs, p2 = theirs & ~mine, p3 = mine & ~theirs;
      let must = emp;
      while (must) {
        const b = first((must & p1) || (must & p2) || (must & p3) || must);
        must ^= b;
        const v = after(X, O, s, b);
        if (stop) return { v: 0, b: 0 };
        if (v > 0) return { v: 1, b };
        must &= car;
      }
      return { v: -1, b: 0 };
    },
    // a lost position: the stone that leaves the other side the fewest winning answers; { b, share } (the share of
    // its answers that lose), null when the search ran out
    trap(X, O, s) {
      let emp = FULL & ~(X | O), top = null;
      for (let q = 0; q < HN; q++) {
        const b = ORD[q];
        if (!(emp & b)) continue;
        const X2 = s ? X : X | b, O2 = s ? O | b : O;
        let rest = emp & ~b, bad = 0, tot = 0;
        while (rest) {
          const r = rest & -rest; rest ^= r; tot++;
          const v = s ? solve(X2 | r, O2, 1) : solve(X2, O2 | r, 0);   // me to move again after their answer r
          if (stop) return null;
          if (v > 0) bad++;
        }
        const share = tot ? bad / tot : 0;
        if (!top || share > top.share) top = { b, share };
      }
      return top;
    },
  };
}
let SOLVER = null;
const solver = () => SOLVER || (SOLVER = hexSolver(16));

// ---- the book ----
// A position as the mover sees it, the mover as X: O's view is the board turned round the long diagonal with the
// sides exchanged; then the smaller of the position and its half turn. key: the two masks as one number, base 36.
const TR = Int8Array.from({ length: HN }, (_, i) => hexT(i));
const turn = x => { let r = 0; while (x) { const b = x & -x; x ^= b; r |= 1 << TR[cellOf(b)]; } return r; };
const half = x => { let r = 0; while (x) { const b = x & -x; x ^= b; r |= 1 << (24 - cellOf(b)); } return r; };
export function hexKey(X, O) {   // the mover X: { key, h: the half turn taken, X, O: the masks as the key has them }
  const hx = half(X), ho = half(O), a = X * 33554432 + O, b = hx * 33554432 + ho, h = b < a;
  return { key: (h ? b : a).toString(36), h, X: h ? hx : X, O: h ? ho : O };
}
export function hexFrame(cells, me) {   // { X, O: the mover's stones and the other side's in the frame, key, back(cell): the frame's cell on the real board }
  let X = 0, O = 0;
  for (let i = 0; i < HN; i++) if (cells[i] === 'X') X |= 1 << i; else if (cells[i] === 'O') O |= 1 << i;
  const t = me === 'O';
  if (t) { const x = turn(O); O = turn(X); X = x; }
  const k = hexKey(X, O);
  return { X: k.X, O: k.O, key: k.key, back: c => { if (k.h) c = 24 - c; return t ? TR[c] : c; } };
}
let BOOK = null;
function book() {
  if (BOOK) return BOOK;
  BOOK = new Map();
  for (const e of HEX_BOOK.split(' ')) { if (!e) continue; const [k, m] = e.split('='); BOOK.set(k, m); }
  return BOOK;
}

// What Hard has worked out about a position, for needs(): kept by the position object itself (the public view the
// square choice passes to best and then to needs, and the `after` best returns), so the other levels' reckoning
// of a square is untouched.
const KNOWN = new WeakMap();
const SURE = 12;                                                 // (the loser's count against the winner's: a 12 in 13 chance by winChance)
function settled(cells, winner) {   // the square is `winner`'s with the players moving in turn: its stones still to place; the other side far more
  const mine = Math.max(0.5, Math.min(9, hexDist(cells, winner)));
  return { [winner]: mine, [other(winner)]: mine * SURE };
}
// Hard's move on 5x5: { move, win: true the square is won from here, false lost, null not known }, or null (the
// deep search then).
function hard5(pm, me, rng) {
  const f = hexFrame(pm.cells, me), o = other(me), stones = pm.cells.filter(Boolean).length, can = hexCanSwap(pm, me);
  if (!stones && pm.swap) return { move: f.back(rng() < 0.5 ? 3 : 21), win: true };   // the opening that wins whatever the answer
  const e = book().get(f.key);
  if (e) {                                                       // (a lone stone's entry: the swap where it is the move, then the stone to play when it cannot be taken)
    const part = e.split(','), use = part[0].slice(1) === 's' && !can ? part[1] : part[0];
    if (use) return use.slice(1) === 's' ? { move: 'swap', win: use[0] === 'w' } : { move: f.back(Number(use.slice(1))), win: use[0] === 'w' };
  }
  const S = solver(), X = f.X, O = f.O;                         // (the search in the frame too, the mover as X: the book counts on the very same search)
  S.start(HEX_SOLVE.cap);
  if (can && S.value(O, 0, 1) < 0) return { move: 'swap', win: true };   // (off the book: the stone taken if that wins)
  if (can) S.start(HEX_SOLVE.cap);
  const r = S.move(X, O, 0);
  if (r.v > 0) {
    S.more(HEX_SOLVE.ahead);                                     // the other side to move here instead: lost for it too? Then the square can wait
    if (S.value(X, O, 1) < 0) KNOWN.set(pm, settled(pm.cells, me));
    return { move: f.back(cellOf(r.b)), win: true };
  }
  if (r.v < 0) {
    KNOWN.set(pm, settled(pm.cells, o));                        // (lost with the move: lost without it)
    S.more(HEX_SOLVE.trap);
    const t = S.trap(X, O, 0);
    return t ? { move: f.back(cellOf(t.b)), win: false } : { move: null, win: false };
  }
  return null;
}

export function needs(pm, p) {
  const k = KNOWN.get(pm);
  if (k) return k[p];
  return hexDist(pm.cells, p);
}
function done(pm, me, m, win) {   // the move as the square choice wants it
  if (m === 'swap') { const k = pm.cells.findIndex(Boolean), sw = pm.cells.slice(); sw[k] = me; const after = { type: 'hex', cells: sw, swap: true }; if (win != null) KNOWN.set(after, settled(sw, win ? me : other(me))); return { move: 'swap', v: 0, h: 0, after, win: false }; }
  const b = pickValued(pm, me, [{ i: m, v: win ? HEX_HARD.win : win === false ? -HEX_HARD.win : 0 }], (cells, i) => i);
  if (win != null && !b.win) KNOWN.set(b.after, settled(b.after.cells, win ? me : other(me)));
  return b;
}
export function best(pm, me, rng, style, ctx) {
  const hard = !!(ctx && ctx.level === 'hard'), until = hard ? ctx.until : null, five = hexSize(pm.cells) === 5;
  if (hard && five) {                                            // Hard on 5x5: the solved game
    const miss = tune(pm).miss, empty = pm.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
    if (miss && rng() * 100 < miss) return done(pm, me, empty[randInt(rng, empty.length)], null);   // (the admin's mistake rate: any empty cell)
    const h = hard5(pm, me, rng);
    if (h && h.move != null) return done(pm, me, h.move, h.win);
    const moves = hexHard(pm.cells, me, until, until ? HEX_HARD : Object.assign({}, HEX_HARD, { nodes: HEX_SOLVE.deep })).moves, b = pickValued(pm, me, moves, (cells, i) => i);   // (not solved in the time: the deep search, as the time allows)
    if (h && !b.win) KNOWN.set(b.after, settled(b.after.cells, other(me)));
    return b;
  }
  // The swap rule, by the book (HEX_SWAP): the other side's first stone, alone in the square, taken when it is worth more
  // to them than playing on against it is to me (the admin's mistake rate: now and then it never thinks of it).
  if (five && hexCanSwap(pm, me) && !(slip(pm, [0, 1], rng).length === 1)) {
    const k = pm.cells.findIndex(Boolean);
    if (HEX_SWAP.includes(me === 'O' ? k : hexT(k))) { const sw = pm.cells.slice(); sw[k] = me; return { move: 'swap', v: 0, h: 0, after: { type: 'hex', cells: sw, swap: true }, win: false }; }
  }
  // The opening of a square with the swap rule: a stone from the book (HEX_OPEN), at random among them.
  if (five && pm.swap && !pm.cells.some(Boolean)) {
    const k = me === 'X' ? HEX_OPEN[randInt(rng, HEX_OPEN.length)] : hexT(HEX_OPEN[randInt(rng, HEX_OPEN.length)]), after = pm.cells.slice(); after[k] = me;
    return { move: k, v: 0, h: 0, after: { type: 'hex', cells: after, swap: true }, win: false };
  }
  const moves = hard ? hexHard(pm.cells, me, until).moves : hexMoves(pm.cells, me);   // (Hard: the deep search, as the time allows)
  return pickValued(pm, me, slip(pm, moves, rng), (cells, i) => i);
}
export { HEX_HARD };
