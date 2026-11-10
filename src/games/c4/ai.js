// Four in a Row: the computer's play.
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { lineNeeds, pickValued, slip, windowsOf } from '../shared/lines.js';
import { C4, c4Drop, c4Hard, c4Moves, c4Playable } from './rules.js';
import { C4_BOOK } from './table.js';

// ---- Hard, four in a row on the 7x6 board: a deeper search that knows the game's tactics ----
// The full game is solved in the literature (the first player wins from the middle column) but not within a table
// a page can carry or a search a move can run: about 4.5 million million positions. So Hard searches as far as
// its time allows, exact wherever the search reaches the end of the game (the last dozen or more moves, and every
// forced line before), by its judgement elsewhere. Over the search of before (rules.js c4Hard: the board as bytes,
// every window's count of each side's pieces kept as pieces go in and out, a table of positions), this one:
//  - keeps, for every empty cell, the windows that are one piece short there for each side (a "threat"), so a
//    win in one, a loss in two (two threats to answer, or every move setting up the cell above), a forced answer
//    (searched on at no cost in depth) and a move that hands over the cell above are seen at once, at every node
//    and before the judgement at the search's rim;
//  - judges the rim with the threats that will decide the endgame as the columns fill: with an even number of
//    cells left, the side to move comes to the cells of the first, third and fifth rows, the other side to the
//    second, fourth and sixth, so a threat counts for much on its owner's rows and for little elsewhere;
//  - searches the best move so far with the full window and the rest with a null window (again in full only when
//    one beats it), the table's move first, then the moves that have cut off most, the middle before the sides;
//  - has no depth limit: C4_DEEP.nodes positions without a clock, the time with one.
// The values are those of before: C4_DEEP.win less the plies to the winning piece, so a sooner win is better.
export const C4_DEEP = { nodes: 45000, win: 10000, own: 110, off: 20, pair: 150 };
const W = 7, H = 6, NC = W * H, K4 = 4;
const WIN4 = windowsOf(W, H, K4), NW = WIN4.length;
const WCELL = Int8Array.from(WIN4.flat());                      // window w's cells: WCELL[4w .. 4w + 3]
const AT = new Int32Array(NC + 1), OF = (() => { const per = Array.from({ length: NC }, () => []); WIN4.forEach((w, i) => { for (const k of w) per[k].push(i); }); const of = []; for (let k = 0; k < NC; k++) { AT[k] = of.length; for (const i of per[k]) of.push(i); } AT[NC] = of.length; return Int16Array.from(of); })();
const W8 = [0, 1, 10, 60, 300];
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const ZOB = (() => { let s = 0x6a09e667 >>> 0; const t = new Uint32Array(NC * 4); for (let i = 0; i < t.length; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; t[i] = s; } return t; })();
const TT_BITS = 18, TT_N = 1 << TT_BITS;
let TT = null;
// Every column's value for me: the best one exact (from the deepest round completed), the others at most a point
// below it; { moves: [{ i, v }], depth, nodes }.
export function c4Deep(cells, me, until = null, cap = C4_DEEP) {
  if (!TT) TT = { key: new Float64Array(TT_N), v: new Int16Array(TT_N), d: new Int8Array(TT_N), f: new Int8Array(TT_N), m: new Int8Array(TT_N) };
  const WIN = cap.win, key = TT.key, tv = TT.v, td = TT.d, tf = TT.f, tm = TT.m;
  const b = new Uint8Array(NC), fill = new Uint8Array(W), cnt = [null, new Uint8Array(NW), new Uint8Array(NW)], thr = [null, new Uint8Array(NC), new Uint8Array(NC)];
  const hist = [null, new Int32Array(NC), new Int32Array(NC)], MV = Array.from({ length: NC + 2 }, () => new Int8Array(W)), RANK = Array.from({ length: NC + 2 }, () => new Int32Array(W));
  let h1 = 0, h2 = 0, filled = 0, score = 0, nodes = 0, stop = false, won = false, nthr = 0;   // (nthr: the threats on the board, both sides': none, nothing to look for)
  const more = (ts, k) => { if (ts[k]++ === 0) nthr++; }, less = (ts, k) => { if (--ts[k] === 0) nthr--; };
  const hole = w => { for (let j = 4 * w; j < 4 * w + 4; j++) if (!b[WCELL[j]]) return WCELL[j]; return -1; };   // the window's empty cell
  // a piece of s into cell k (b[k] already s) or out of it (b[k] still s): the hashes, the window counts, the
  // running judgement, the threats (a window with three of one side and its last cell empty: that cell)
  const put = (k, s, dir) => {
    const t = 3 - s, cs = cnt[s], ct = cnt[t], ts = thr[s], tt = thr[t], sg = s === 1 ? 1 : -1;
    h1 ^= ZOB[4 * k + s - 1]; h2 ^= ZOB[4 * k + s + 1];
    for (let i = AT[k], e = AT[k + 1]; i < e; i++) {
      const w = OF[i], m0 = cs[w], o0 = ct[w], m1 = m0 + dir;
      cs[w] = m1;
      if (o0) {                                                  // the other side's window: spoiled by the first piece in it, theirs again when it leaves
        if (m0 + m1 === 1) { score -= sg * W8[o0] * -dir; if (o0 === 3) { if (dir > 0) less(tt, k); else more(tt, k); } }
        continue;
      }
      score += sg * (W8[m1] - W8[m0]);
      if (dir > 0) { if (m1 === 4) { won = true; less(ts, k); } else if (m1 === 3) more(ts, hole(w)); }
      else if (m0 === 4) more(ts, k); else if (m0 === 3) less(ts, hole(w));   // (the piece leaving is still on the board: not the hole)
    }
    if (k % W === 3) score += sg * 3 * dir;
  };
  for (let k = NC - 1; k >= 0; k--) { const c = cells[k]; if (!c) continue; const s = c === me ? 1 : 2; b[k] = s; fill[k % W]++; filled++; put(k, s, 1); }
  won = false;
  td.fill(-1);
  const drop = (col, s) => { const k = (H - 1 - fill[col]) * W + col; b[k] = s; fill[col]++; filled++; put(k, s, 1); return k; };
  const lift = (col, k, s) => { put(k, s, -1); b[k] = 0; fill[col]--; filled--; won = false; };
  // the rim: the windows' running sum for s, and the threats above the cells in reach by whose rows they are on
  const judge = s => {
    const t = 3 - s, A = filled & 1 ? t : s, B = 3 - A, ta = thr[A], tb = thr[B];   // A: the side that comes to the first, third and fifth rows
    let v = 0;
    if (nthr) for (let c = 0; c < W; c++) {
      let wa = 1, wb = 1, pa = false, pb = false;
      for (let h = fill[c] + 1; h < H; h++) {
        const k = (H - 1 - h) * W + c, a = ta[k] > 0, o = tb[k] > 0;
        if (a) { v += wa * (h & 1 ? cap.off : cap.own); if (pa) v += cap.pair; wb *= 0.4; }
        if (o) { v -= wb * (h & 1 ? cap.own : cap.off); if (pb) v -= cap.pair; wa *= 0.4; }
        pa = a; pb = o;
      }
    }
    return (s === 1 ? score : -score) + (A === s ? v : -v) | 0;
  };
  const search = (s, depth, alpha, beta, ply) => {   // the value for s, s to move
    if ((++nodes & 255) === 0 && (until ? until() <= 0 : nodes > cap.nodes)) { stop = true; return 0; }
    const t = 3 - s, ts = thr[s], tt = thr[t];
    let must = -1, n = 0;
    if (nthr) for (let c = 0; c < W; c++) {
      if (fill[c] >= H) continue;
      const k = (H - 1 - fill[c]) * W + c;
      if (ts[k]) return WIN - ply;                               // a win in one
      if (tt[k]) { n++; must = c; }
    }
    if (n > 1) return ply + 1 - WIN;                             // two cells to answer: lost in two
    if (n === 1) {                                               // one: the answer is forced (searched on, no depth spent)
      const k = drop(must, s), v = filled === NC ? 0 : -search(t, depth, -beta, -alpha, ply + 1);
      lift(must, k, s);
      return v;
    }
    const kk = h1 * 1048576 + (h2 & 0xfffff), x = ((h1 ^ h2) >>> 0) & (TT_N - 1), hit = key[x] === kk && td[x] >= 0;
    let first = -1;
    if (hit) {
      if (td[x] >= depth) {
        const v = tv[x], f = tf[x];
        if (f === 0) return v;
        if (f === 1) { if (v > alpha) alpha = v; } else if (v < beta) beta = v;
        if (alpha >= beta) return v;
      }
      first = tm[x];
    }
    if (depth <= 0) return judge(s);
    // the moves: not one that sets up the other side's win in the cell above; the table's first, then by their record
    const mv = MV[ply], hs = hist[s], rank = RANK[ply];
    let m = 0;
    for (let i = 0; i < W; i++) {
      const c = ORDER[i];
      if (fill[c] >= H) continue;
      const k = (H - 1 - fill[c]) * W + c;
      if (fill[c] < H - 1 && tt[k - W]) continue;
      const g = c === first ? 2147483647 : hs[k];
      let q = m++;
      while (q > 0 && rank[q - 1] < g) { mv[q] = mv[q - 1]; rank[q] = rank[q - 1]; q--; }
      mv[q] = c; rank[q] = g;
    }
    if (!m) return ply + 1 - WIN;                                // every move hands over the cell above
    const a0 = alpha;
    let best = -Infinity, bm = -1;
    for (let i = 0; i < m; i++) {
      const c = mv[i], k = drop(c, s);
      let v;
      if (filled === NC) v = 0;
      else if (i === 0) v = -search(t, depth - 1, -beta, -alpha, ply + 1);
      else { v = -search(t, depth - 1, -alpha - 1, -alpha, ply + 1); if (v > alpha && v < beta && !stop) v = -search(t, depth - 1, -beta, -alpha, ply + 1); }
      lift(c, k, s);
      if (stop) return 0;
      if (v > best) { best = v; bm = c; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) { hs[k] += depth * depth; break; }
    }
    key[x] = kk; tv[x] = best; td[x] = depth; tf[x] = best <= a0 ? 2 : best >= beta ? 1 : 0; tm[x] = bm;
    return best;
  };
  const cols = ORDER.filter(c => fill[c] < H);
  if (!cols.length) return { moves: [], depth: 0, nodes };
  let out = cols.map(c => ({ i: c, v: 0 })), depth = 0;
  for (let d = 1; d <= NC - filled && !stop; d++) {
    const res = [], top = out[0].i;
    let alpha = -Infinity, bi = -1;
    for (let i = -1; i < cols.length; i++) {
      const col = i < 0 ? top : cols[i];
      if (i >= 0 && col === top) continue;
      const k = drop(col, 1);
      let v;
      if (won) v = WIN - 1; else if (filled === NC) v = 0;
      else if (alpha === -Infinity) v = -search(2, d - 1, -Infinity, Infinity, 1);
      else { v = -search(2, d - 1, -alpha - 1, -alpha, 1); if (v > alpha && !stop) v = -search(2, d - 1, -Infinity, -alpha, 1); }
      lift(col, k, 1);
      if (stop) break;
      if (v > alpha) { alpha = v; bi = res.length; } else v = Math.min(v, alpha - 1);
      res.push({ i: col, v });
    }
    if (stop) break;
    if (bi > 0) res.unshift(res.splice(bi, 1)[0]);
    out = res; depth = d;
    if (Math.abs(out[0].v) >= WIN - NC) break;                   // decided: no round deeper changes it
  }
  return { moves: out, depth, nodes };
}

// ---- the opening book ----
// The first moves are where the search sees least of what matters (its rim is far from the end of the game), so
// they come from a table (table.js, written by tests/sim/c4-table.js): the move of this same search run some forty
// times longer, for every position Hard can meet in its first C4_BOOK_PLIES plies when it follows the table and
// the other side plays anything, moving first or second. A position is the mover's pieces and the other side's
// (two masks, base 36), the board or its mirror image, whichever has the smaller key.
export const C4_BOOK_PLIES = 6;
export function c4Key(cells, me) {   // { key, flip: the mirror image taken }
  let a = 0, b = 0, ma = 0, mb = 0;
  for (let k = 0; k < NC; k++) {
    const c = cells[k];
    if (!c) continue;
    const m = k - k % W + (W - 1 - k % W);
    if (c === me) { a += 2 ** k; ma += 2 ** m; } else { b += 2 ** k; mb += 2 ** m; }
  }
  const flip = ma < a || (ma === a && mb < b);
  return { key: (flip ? ma : a).toString(36) + '.' + (flip ? mb : b).toString(36), flip };
}
let BOOK = null;
export function c4Book(cells, me) {   // the table's column, or -1
  if (!BOOK) { BOOK = new Map(); for (const e of C4_BOOK.split(' ')) { if (!e) continue; const [k, c] = e.split('='); BOOK.set(k, Number(c)); } }
  const k = c4Key(cells, me), c = BOOK.get(k.key);
  return c === undefined ? -1 : k.flip ? W - 1 - c : c;
}

// What Hard has worked out about a position, for needs(): kept by the position object itself (the `after` best
// returns), so the other levels' reckoning of a square is untouched.
const KNOWN = new WeakMap();
const SURE = 12;                                                 // (the loser's count against the winner's: a 12 in 13 chance by winChance)
export function needs(pm, p) {
  const k = KNOWN.get(pm);
  if (k) return k[p];
  return lineNeeds(pm.cells, C4.cols, C4.rows, tune(pm).k, p, c4Playable(pm.cells));
}
export function best(pm, me, rng, style, ctx) {
  const t = tune(pm), hard = !!(ctx && ctx.level === 'hard'), deep = hard && t.k === K4 && pm.cells.length === NC;
  const booked = deep && pm.cells.filter(Boolean).length <= C4_BOOK_PLIES ? c4Book(pm.cells, me) : -1;   // (the empty board: the middle, the one opening that wins the solved game)
  const moves = booked >= 0 ? ORDER.filter(c => !pm.cells[c]).map(c => ({ i: c, v: c === booked ? 1 : 0 })) : deep ? c4Deep(pm.cells, me, ctx.until).moves : hard ? c4Hard(pm.cells, me, t.k, ctx.until).moves : c4Moves(pm.cells, me, t.depth, t.k);   // (Hard: the deep search, as the time allows)
  const b = pickValued(pm, me, slip(pm, moves, rng), c4Drop);
  if (deep && !b.win && Math.abs(b.v) >= C4_DEEP.win - NC) {    // a forced line found: the winner's own pieces still to play, the other side far more
    const plies = C4_DEEP.win - Math.abs(b.v), w = b.v > 0 ? me : other(me), mine = Math.max(0.5, b.v > 0 ? (plies - 1) / 2 : plies / 2);
    KNOWN.set(b.after, { [w]: mine, [other(w)]: mine * SURE });
  }
  return b;
}
