// Connect 4: the rules (pure: no page, no clock; the server runs the same code).
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
export function randomMove(mini, p, rng, from, empties) {
  return from(Array.from({ length: C4.cols }, (_, c) => c).filter(c => !mini.cells[c]));
}
export function flashMs(f, winLen, won) {
  return won ? 1150 : 600;
}
