// Four in a Row: the rules (pure: no page, no clock; the server runs the same code).
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { findRun, windowsOf } from '../shared/lines.js';

export const C4 = { cols: 7, rows: 6, k: 4 };
export function create(type, rng) {
  return { type, cells: new Array(C4.cols * C4.rows).fill(null), last: null };
}
export function apply(mini, p, m, rng, idx) {
  if (!idx(C4.cols)) return { ok: false, reason: 'bad' };
  let at = -1;
  for (let r = C4.rows - 1; r >= 0; r--) {
    if (!mini.cells[r * C4.cols + m]) { at = r * C4.cols + m; break; }
  }
  if (at < 0) return { ok: false, reason: 'full' };
  mini.cells[at] = p; mini.last = at;
  const run = findRun(mini.cells, C4.cols, C4.rows, tune(mini).k, p);   // (its square's run length: TUNE)
  if (run) return { ok: true, outcome: 'win', cells: run };
  if (mini.cells.every(Boolean)) return { ok: true, outcome: 'draw' };
  return { ok: true, outcome: 'continue' };
}
export function publicView(mini) {
  return { type: mini.type, cells: mini.cells.slice() };
}
export function c4Playable(cells) { return k => k >= C4.cols * (C4.rows - 1) || !!cells[k + C4.cols]; }
export function c4Drop(cells, col) { for (let r = C4.rows - 1; r >= 0; r--) { const k = r * C4.cols + col; if (!cells[k]) return k; } return -1; }
export function c4Eval(cells, me, K = C4.k) {   // threats: open windows weighted by how full they are, plus the middle column
  const o = other(me), w8 = [0, 1, 10, 60, 300];
  let s = 0;
  for (const w of windowsOf(C4.cols, C4.rows, K)) {
    let m = 0, t = 0;
    for (const k of w) { if (cells[k] === me) m++; else if (cells[k] === o) t++; }
    if (m && !t) s += w8[m]; else if (t && !m) s -= w8[t];
  }
  const mid = Math.floor(C4.cols / 2);
  for (let r = 0; r < C4.rows; r++) { const c = cells[r * C4.cols + mid]; if (c === me) s += 3; else if (c === o) s -= 3; }
  return s;
}
export const C4_ORDER = [3, 2, 4, 1, 5, 0, 6];      // the middle columns first: alpha-beta cuts sooner
export function c4Search(cells, p, me, depth, alpha, beta, K = C4.k) {   // negamax with alpha-beta: the value for p, p to move
  let best = -Infinity, any = false;
  for (const col of C4_ORDER) {
    const k = c4Drop(cells, col);
    if (k < 0) continue;
    any = true;
    cells[k] = p;
    let v;
    if (findRun(cells, C4.cols, C4.rows, K, p)) v = 10000 + depth;
    else if (cells.every(Boolean)) v = 0;
    else if (depth === 0) v = p === me ? c4Eval(cells, me, K) : -c4Eval(cells, me, K);
    else v = -c4Search(cells, other(p), me, depth - 1, -beta, -alpha, K);
    cells[k] = null;
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return any ? best : 0;
}
export const C4_DEPTH = 5;            // plies searched (7 columns: deeper gets slow on a phone; TUNE's depth)
export function c4Moves(cells, me, depth = C4_DEPTH, K = C4.k) {
  const out = [];
  for (const col of C4_ORDER) {
    const k = c4Drop(cells, col);
    if (k < 0) continue;
    cells[k] = me;
    const v = findRun(cells, C4.cols, C4.rows, K, me) ? 10000 + depth : cells.every(Boolean) ? 0 : -c4Search(cells, other(me), me, depth - 1, -Infinity, Infinity, K);
    cells[k] = null;
    out.push({ i: col, v });
  }
  return out;
}
// ---- Hard: iterative deepening negamax with alpha-beta and a transposition table ----
// The board as bytes (0 empty, 1 the searcher, 2 the other side), every window's count of each side's
// pieces kept up to date as pieces go in and out (a win is a window full of one side; the eval, c4Eval's
// weights, is kept as a running sum), so a node costs almost nothing. Deeper each round until the time
// (until: the ms left, checked every 256 nodes) or, without a clock, C4_HARD.depth plies or C4_HARD.nodes
// nodes; the last round completed is the answer (a forced win or loss ends the rounds early). The table is
// a fixed array keyed by two hashes (Zobrist, from a fixed seed), emptied every call: bounded memory, the
// same answer every time.
export const C4_HARD = { depth: 9, nodes: 100000, win: 10000 };
const zob = (() => { let s = 0x9e3779b9 >>> 0; const t = new Uint32Array(C4.cols * C4.rows * 4); for (let i = 0; i < t.length; i++) { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; t[i] = s; } return t; })();
const W8 = [0, 1, 10, 60, 300, 1000], TT_BITS = 16, TT_N = 1 << TT_BITS;
const TT = { key: new Float64Array(TT_N), v: new Int32Array(TT_N), d: new Int8Array(TT_N), f: new Int8Array(TT_N), m: new Int8Array(TT_N) };
const GRID = {};
function c4Grid(K) {   // for K: every window's cells, and every cell's windows (flat, with offsets)
  if (GRID[K]) return GRID[K];
  const wins = windowsOf(C4.cols, C4.rows, K), N = C4.cols * C4.rows, per = Array.from({ length: N }, () => []);
  wins.forEach((w, i) => { for (const k of w) per[k].push(i); });
  const at = new Int32Array(N + 1), of = [];
  for (let k = 0; k < N; k++) { at[k] = of.length; for (const i of per[k]) of.push(i); }
  at[N] = of.length;
  return (GRID[K] = { n: wins.length, at, of: Int16Array.from(of) });
}
// Every column's value for me: the best one exact (from the deepest round completed), the others at most a
// point below it; { moves: [{ i, v }], depth, nodes }.
export function c4Hard(cells, me, K = C4.k, until = null, cap = C4_HARD) {
  const W = C4.cols, H = C4.rows, N = W * H, WIN = cap.win, mid = (W / 2) | 0, g = c4Grid(K), at = g.at, of = g.of;
  const b = new Uint8Array(N), fill = new Uint8Array(W), cnt = [null, new Uint8Array(g.n), new Uint8Array(g.n)];
  let h1 = 0, h2 = 0, filled = 0, score = 0, nodes = 0, stop = false, won = false;
  // a piece of s in or out of cell k: the hashes, the window counts, the running eval (a window gone full: won)
  const put = (k, s, dir) => {
    const t = 3 - s, cs = cnt[s], ct = cnt[t];
    h1 ^= zob[4 * k + s - 1]; h2 ^= zob[4 * k + s + 1];
    for (let i = at[k], e = at[k + 1]; i < e; i++) {
      const w = of[i], m0 = cs[w], o0 = ct[w], m1 = m0 + dir;
      cs[w] = m1;
      if (o0) { if (m0 + m1 === 1) score += (s === 1 ? 1 : -1) * W8[o0] * dir; continue; }   // the other side's window: spoiled by the first piece in it, theirs again when it leaves
      if (m1 === K) won = true;
      score += (s === 1 ? 1 : -1) * (W8[m1] - W8[m0]);
    }
    if (k % W === mid) score += (s === 1 ? 3 : -3) * dir;
  };
  for (let k = 0; k < N; k++) { const c = cells[k]; if (!c) continue; const s = c === me ? 1 : 2; b[k] = s; fill[k % W]++; filled++; put(k, s, 1); }
  won = false;
  TT.d.fill(-1);
  const drop = (col, s) => { const k = (H - 1 - fill[col]) * W + col; b[k] = s; fill[col]++; filled++; put(k, s, 1); return k; };
  const lift = (col, k, s) => { b[k] = 0; fill[col]--; filled--; put(k, s, -1); won = false; };
  const search = (s, depth, alpha, beta, ply) => {   // the value for s, s to move
    if ((++nodes & 255) === 0 && (until ? until() <= 0 : nodes > cap.nodes)) { stop = true; return 0; }
    if (filled === N) return 0;
    const key = h1 * 1048576 + (h2 & 0xfffff), x = ((h1 ^ h2) >>> 0) & (TT_N - 1), hit = TT.key[x] === key && TT.d[x] >= 0;
    let first = -1;
    if (hit) {
      if (TT.d[x] >= depth) {
        const v = TT.v[x], f = TT.f[x];
        if (f === 0) return v;
        if (f === 1) { if (v > alpha) alpha = v; } else if (v < beta) beta = v;
        if (alpha >= beta) return v;
      }
      first = TT.m[x];
    }
    if (depth === 0) return s === 1 ? score : -score;
    const a0 = alpha, t = 3 - s;
    let best = -Infinity, bm = -1;
    for (let i = -1; i < W; i++) {
      const col = i < 0 ? first : C4_ORDER[i];
      if (col < 0 || (i >= 0 && col === first) || fill[col] >= H) continue;
      const k = drop(col, s);
      const v = won ? WIN - ply : -search(t, depth - 1, -beta, -alpha, ply + 1);
      lift(col, k, s);
      if (stop) return 0;
      if (v > best) { best = v; bm = col; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    TT.key[x] = key; TT.v[x] = best; TT.d[x] = depth; TT.f[x] = best <= a0 ? 2 : best >= beta ? 1 : 0; TT.m[x] = bm;
    return best;
  };
  const cols = C4_ORDER.filter(c => fill[c] < H);
  if (!cols.length) return { moves: [], depth: 0, nodes };
  let out = cols.map(c => ({ i: c, v: 0 })), depth = 0;
  const max = until ? N - filled : Math.min(cap.depth, N - filled);
  for (let d = 1; d <= max && !stop; d++) {
    const res = [], top = out[0].i;
    let alpha = -Infinity, bi = -1;
    for (let i = -1; i < cols.length; i++) {
      const col = i < 0 ? top : cols[i];
      if (i >= 0 && col === top) continue;
      const k = drop(col, 1);
      let v = won ? WIN - 1 : filled === N ? 0 : -search(2, d - 1, -Infinity, -alpha, 1);
      lift(col, k, 1);
      if (stop) break;
      if (v > alpha) { alpha = v; bi = res.length; } else v = Math.min(v, alpha - 1);
      res.push({ i: col, v });
    }
    if (stop) break;
    if (bi > 0) res.unshift(res.splice(bi, 1)[0]);
    out = res; depth = d;
    if (Math.abs(out[0].v) >= WIN - N) break;                  // decided: no round deeper changes it
  }
  return { moves: out, depth, nodes };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(Array.from({ length: C4.cols }, (_, c) => c).filter(c => !mini.cells[c]));
}
export function flashMs(f, winLen, won) {
  return won ? 1150 : 600;
}
