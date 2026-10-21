// Line games (Tic-Tac-Toe, Connect 4, Hex): runs and windows, and the tactics they share.
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { C4 } from '../c4/rules.js';
import { hexDist, hexPath } from '../hex/rules.js';

// K in a row for player p on a W x H grid: returns the winning cell indexes, or null.
export function findRun(cells, W, H, K, p) {
  const dirs = [[1, 0], [0, 1], [1, 1], [-1, 1]]; // [dc, dr]: right, down, down-right, down-left
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (cells[r * W + c] !== p) continue;
      for (const [dc, dr] of dirs) {
        const run = [r * W + c];
        for (let k = 1; k < K; k++) {
          const rr = r + dr * k, cc = c + dc * k;
          if (rr < 0 || rr >= H || cc < 0 || cc >= W || cells[rr * W + cc] !== p) break;
          run.push(rr * W + cc);
        }
        if (run.length === K) return run;
      }
    }
  }
  return null;
}

// ---- how far each side is from claiming a square: estimated moves still needed, with nobody interfering ----
export const WINDOWS = {};
export function windowsOf(W, H, K) {
  const key = W + 'x' + H + 'x' + K;
  if (WINDOWS[key]) return WINDOWS[key];
  const out = [];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) for (const [dc, dr] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
    const win = [];
    for (let k = 0; k < K; k++) { const rr = r + dr * k, cc = c + dc * k; if (rr < 0 || rr >= H || cc < 0 || cc >= W) break; win.push(rr * W + cc); }
    if (win.length === K) out.push(win);
  }
  return (WINDOWS[key] = out);
}
export function lineNeeds(cells, W, H, K, p, playable) {
  let best = Infinity;
  for (const win of windowsOf(W, H, K)) {
    let mine = 0, bad = false, empty = null;
    for (const k of win) { const c = cells[k]; if (c === p) mine++; else if (c) { bad = true; break; } else empty = k; }
    if (bad) continue;
    let n = K - mine;
    if (n === 1 && playable && !playable(empty)) n = 2;        // Connect 4: a hole still needs a piece under it
    if (n < best) best = n;
  }
  return best;
}
// Open lines weighted by how full they are: mine count for, the other side's against.
export function threatScore(cells, W, H, K, me) {
  const o = other(me), w8 = [0, 1, 10, 100, 1000, 10000];
  let s = 0;
  for (const win of windowsOf(W, H, K)) {
    let m = 0, t = 0;
    for (const k of win) { if (cells[k] === me) m++; else if (cells[k] === o) t++; }
    if (m && !t) s += w8[m]; else if (t && !m) s -= w8[t];
  }
  return s;
}
// Pick among valued moves: the best value, then the position with the most open lines (or, in Hex, the biggest lead in distance).
export function pickValued(pm, me, moves, place) {
  const o = other(me), K = pm.type === 'c4' ? tune(pm).k : C4.k;   // (Connect 4: its square's run length)
  let best = null;
  for (const mv of moves) {
    const after = { type: pm.type, cells: pm.cells.slice() };
    if (pm.tune) after.tune = pm.tune;                     // (its settings go with it: needs() reads them)
    const k = place(after.cells, mv.i);
    after.cells[k] = me;
    const win = pm.type === 'hex' ? !!hexPath(after.cells, me) : !!findRun(after.cells, pm.type === 'ttt' ? 3 : C4.cols, pm.type === 'ttt' ? 3 : C4.rows, pm.type === 'ttt' ? 3 : K, me);
    const h = pm.type === 'hex' ? Math.min(hexDist(after.cells, o), 9) - Math.min(hexDist(after.cells, me), 9)
      : pm.type === 'ttt' ? threatScore(after.cells, 3, 3, 3, me) : threatScore(after.cells, C4.cols, C4.rows, K, me);
    if (!best || mv.v > best.v || (mv.v === best.v && h > best.h)) best = { move: mv.i, v: mv.v, h, after, win };
  }
  return best;
}
// The computer's slip (its square's miss %, TUNE): now and then one legal move at random instead of the
// best (no draw at all at 0, so the default deals as before).
export function slip(pm, moves, rng) {
  const miss = tune(pm).miss;
  return miss && moves.length && rng() * 100 < miss ? [moves[Math.floor(rng() * moves.length)]] : moves;
}
