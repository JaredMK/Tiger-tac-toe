// Treasure Hunt: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { huntBand, huntCandidates, huntDist, huntGrid, huntSize } from './rules.js';

// Race mode (core/race.js, `rv: 2`): the computer digs its own grid for its own treasure (its part, pm.side[me]); the
// other grid is the other treasure's and tells it nothing. Normal: the splitter, as in Shared. Hard: the fewest digs
// expected (huntSolo). Both grids are open, so each side's needs come from its own candidates, with no limit.
export function needs(pm, p) {
  const g = huntGrid(pm, p);
  if (!g) { const n = huntSize(pm); return 1 + Math.log2(n * n) / 2.5; }   // (a part this copy has not got: a fresh grid)
  const n = huntCandidates(pm, p).length; return n <= 1 ? 1 : 1 + Math.log2(n) / 2.5;
}
export function best(pm, me, rng, style, ctx) {
  const shared = !pm.race, cand = huntCandidates(pm, me), g = huntGrid(pm, me) || { n: huntSize(pm), dug: new Array(huntSize(pm) ** 2).fill(null) };
  if (!cand.length) { const open = g.dug.map((d, i) => (d ? -1 : i)).filter(i => i >= 0); return { move: open[0], q: 0, shared }; }
  if (cand.length === 1) return { move: cand[0], q: 1, shared };
  const miss = tune(pm).miss || 0;                               // (the admin's mistake rate: a dig anywhere it could be)
  if (miss && rng() * 100 < miss) return { move: cand[randInt(rng, cand.length)], q: 1 / cand.length, shared };
  if (ctx && ctx.level === 'hard') return shared ? huntHard(pm, cand, ctx, g) : huntSolo(cand, ctx, g);
  let best = cand[0], bestSplit = Infinity;        // the dig that, if it misses, leaves the fewest candidates on average (by the band it would show)
  const n = g.n;
  for (const c of cand) {
    const groups = new Map();
    for (const x of cand) if (x !== c) { const k = huntBand(huntDist(c, x, n)); groups.set(k, (groups.get(k) || 0) + 1); }
    let split = 0;
    for (const gr of groups.values()) split += gr * gr;
    if (split < bestSplit) { bestSplit = split; best = c; }
  }
  return { move: best, q: 1 / cand.length, shared };
}

// ---- Hard: the race for the treasure (a shared grid) ----
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
function huntHard(pm, cand, ctx, g) {
  const n = g.n, nn = n * n, B = bandTable(n);
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
    for (const gg of S) { const v = dig(S, gg, d - 1, true); if (stop) return 0.5; if (v > top) top = v; }
    memo.set(key, { d, v: top, full: m <= HUH.exact });
    return top;
  };
  const dig = (S, gg, d, inS) => {                               // a dig's worth: the groups each band leaves the other side (-1: one that tells nothing)
    const m = S.length, gr = [];
    for (const c of S) if (c !== gg) { const k = B[gg * nn + c]; (gr[k] || (gr[k] = [])).push(c); }
    let v = inS ? 1 / m : 0, parts = 0;
    for (const grp of gr) if (grp) { parts++; v += grp.length / m * (1 - V(grp, d)); if (stop) return 0; }
    return !inS && parts === 1 && gr.find(x => x).length === m ? -1 : v;
  };
  let move = C[0], top = 0, depth = 0;
  for (let d = 1; d <= HUH.depth && !stop; d++) {
    let best = -1, pick = -1;
    for (const gg of C) { const v = dig(C, gg, d - 1, true); if (stop) break; if (v > best) { best = v; pick = gg; } }
    if (stop) break;
    move = pick; top = best; depth = d;
    if (m0 <= HUH.exact) break;
  }
  if (depth) {
    stop = false; work = 0;
    const inC = new Set(C);
    for (let gg = 0; gg < nn; gg++) { if (g.dug[gg] || inC.has(gg)) continue; const v = dig(C, gg, depth - 1, false); if (stop) break; if (v > top + HUH.margin) { top = v; move = gg; } }
  }
  return { move, q: C.includes(move) ? 1 / m0 : 0, shared: true };
}

// ---- Hard in a race: the fewest digs (its own grid, its own treasure) ----
// The digs still expected from the cells S the treasure may be in: 1 for the dig, then, for each band the others would
// show, that group's own expectation by its share (none once it is dug up). Exact over sets of HSO.exact or fewer (kept in
// a memo), deeper as the budget allows for the rest (iterative deepening), a set out of reach worth HSO.h of its size.
// The first dig may also be a cell outside S, when it splits S clearly better (it can never be the treasure).
const HSO = { exact: 9, work: 1.5e5, depth: 6, margin: 0.03 };
const hEst = m => (m <= 1 ? 1 : 1 + Math.log2(m) / 1.55);         // a set's digs, roughly (measured on the 6x6 grid against the exact values)
function huntSolo(cand, ctx, g) {
  const n = g.n, nn = n * n, B = bandTable(n), until = ctx.until, memo = new Map();
  const C = cand.slice().sort((a, b) => a - b);
  let nodes = 0, work = 0, stop = false;
  const groups = (S, gg) => { const gr = []; for (const c of S) if (c !== gg) { const k = B[gg * nn + c]; (gr[k] || (gr[k] = [])).push(c); } return gr.filter(x => x); };
  const E = (S, d) => {                                          // the digs expected from S, d digs deep
    const m = S.length;
    if (m <= 1) return 1;
    if (m === 2) return 1.5;
    if (m > HSO.exact && d <= 0) return hEst(m);
    if (stop) return hEst(m);
    const key = S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * (m + 8)) > HSO.work) { stop = true; return hEst(m); }
    let low = Infinity;
    for (const gg of S) { const v = dig(S, gg, d - 1, true); if (stop) return hEst(m); if (v < low) low = v; }
    memo.set(key, { d, v: low, full: m <= HSO.exact });
    return low;
  };
  const dig = (S, gg, d, inS) => {                               // a dig's expected digs (Infinity: one that tells nothing)
    const m = S.length, gr = groups(S, gg);
    if (!inS && gr.length === 1) return Infinity;
    let v = 1;
    for (const grp of gr) { v += grp.length / m * E(grp, d); if (stop) return Infinity; }
    return v;
  };
  let move = C[0], low = Infinity, depth = 0;
  for (let d = 1; d <= HSO.depth && !stop; d++) {
    let top = Infinity, pick = -1;
    for (const gg of C) { const v = dig(C, gg, d - 1, true); if (stop) break; if (v < top) { top = v; pick = gg; } }
    if (stop) break;
    move = pick; low = top; depth = d;
    if (C.length <= HSO.exact) break;
  }
  if (depth) {
    stop = false; work = 0;
    const inC = new Set(C);
    for (let gg = 0; gg < nn; gg++) { if (g.dug[gg] || inC.has(gg)) continue; const v = dig(C, gg, depth - 1, false); if (stop) break; if (v < low - HSO.margin) { low = v; move = gg; } }
  }
  return { move, q: C.includes(move) ? 1 / C.length : 0, shared: false };
}
