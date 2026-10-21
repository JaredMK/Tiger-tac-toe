// Treasure Hunt: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { huntBand, huntCandidates, huntDist, huntSize } from './rules.js';

export function needs(pm, p) {
  const n = huntCandidates(pm).length; return n <= 1 ? 1 : 1 + Math.log2(n) / 2.5;
}
export function best(pm, me, rng, style, ctx) {
  const cand = huntCandidates(pm);
  if (!cand.length) { const open = pm.dug.map((d, i) => (d ? -1 : i)).filter(i => i >= 0); return { move: open[0], q: 0, shared: true }; }
  if (cand.length === 1) return { move: cand[0], q: 1, shared: true };
  const miss = tune(pm).miss || 0;                               // (the admin's mistake rate: a dig anywhere it could be)
  if (miss && rng() * 100 < miss) return { move: cand[randInt(rng, cand.length)], q: 1 / cand.length, shared: true };
  if (ctx && ctx.level === 'hard') return huntHard(pm, cand, ctx);
  let best = cand[0], bestSplit = Infinity;        // the dig that, if it misses, leaves the fewest candidates on average (by the band it would show)
  const n = huntSize(pm);
  for (const c of cand) {
    const groups = new Map();
    for (const x of cand) if (x !== c) { const k = huntBand(huntDist(c, x, n)); groups.set(k, (groups.get(k) || 0) + 1); }
    let split = 0;
    for (const g of groups.values()) split += g * g;
    if (split < bestSplit) { bestSplit = split; best = c; }
  }
  return { move: best, q: 1 / cand.length, shared: true };
}

// ---- Hard: the race for the treasure ----
// The grid is shared and every clue shows both players, so what counts is not the dig that tells most
// (Normal) but who digs it up first. The value of the cells it may be in for the side to move: the chance
// the dig is it (1/n), else, for each band the others would show, what is left of the other side's chances
// from that group. Solved over the candidate cells as digs, every set met kept in a memo, deeper as the
// budget allows (iterative deepening; a set of 8 or fewer to the end, a bigger one out of reach worth 0.5).
// Then every other open cell at the depth reached: a dig outside the candidates can leave the other side a
// set it can do little with, taken when it beats the best candidate clearly (never one whose band would
// tell nothing: a pass, and two sides passing would never end).
const HUH = { exact: 8, work: 1.2e5, depth: 14, margin: 0.05 };
const BANDS = {};                                               // per grid size: the band between any two cells
function bandTable(n) {
  if (BANDS[n]) return BANDS[n];
  const nn = n * n, b = new Uint8Array(nn * nn);
  for (let a = 0; a < nn; a++) for (let c = 0; c < nn; c++) b[a * nn + c] = huntBand(huntDist(a, c, n));
  return (BANDS[n] = b);
}
function huntHard(pm, cand, ctx) {
  const n = huntSize(pm), nn = n * n, B = bandTable(n);
  const C = cand.slice().sort((a, b) => a - b), m0 = C.length;
  const until = ctx.until, memo = new Map();
  let nodes = 0, work = 0, stop = false;
  const V = (S, d) => {                                          // the side to move's chance from the cells S, d plies deep
    const m = S.length;
    if (m <= 1) return 1;
    if (m > HUH.exact && d <= 0) return 0.5;
    if (stop) return 0.5;
    const key = S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * (m + 8)) > HUH.work) { stop = true; return 0.5; }
    let top = 0;
    for (const g of S) { const v = dig(S, g, d - 1, true); if (stop) return 0.5; if (v > top) top = v; }
    memo.set(key, { d, v: top, full: m <= HUH.exact });
    return top;
  };
  const dig = (S, g, d, inS) => {                                // a dig's worth: the groups each band leaves the other side (-1: one that tells nothing)
    const m = S.length, gr = [];
    for (const c of S) if (c !== g) { const k = B[g * nn + c]; (gr[k] || (gr[k] = [])).push(c); }
    let v = inS ? 1 / m : 0, parts = 0;
    for (const grp of gr) if (grp) { parts++; v += grp.length / m * (1 - V(grp, d)); if (stop) return 0; }
    return !inS && parts === 1 && gr.find(x => x).length === m ? -1 : v;
  };
  let move = C[0], top = 0, depth = 0;
  for (let d = 1; d <= HUH.depth && !stop; d++) {
    let best = -1, pick = -1;
    for (const g of C) { const v = dig(C, g, d - 1, true); if (stop) break; if (v > best) { best = v; pick = g; } }
    if (stop) break;
    move = pick; top = best; depth = d;
    if (m0 <= HUH.exact) break;
  }
  if (depth) {
    stop = false; work = 0;
    const inC = new Set(C);
    for (let g = 0; g < nn; g++) { if (pm.dug[g] || inC.has(g)) continue; const v = dig(C, g, depth - 1, false); if (stop) break; if (v > top + HUH.margin) { top = v; move = g; } }
  }
  return { move, q: C.includes(move) ? 1 / m0 : 0, shared: true };
}
