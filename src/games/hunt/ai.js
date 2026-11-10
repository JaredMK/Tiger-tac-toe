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
  if (ctx && ctx.level === 'hard') return shared ? huntHard(pm, cand, ctx, g, rng) : huntSolo(cand, ctx, g);
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
// (Normal) but who digs it up first. A position is the cells the treasure may be in (S); a dig is any open cell:
// one of S (it is the treasure 1 time in |S|) or not, and either way its band splits the rest into groups, the
// other side to move from the one that holds it. A dig that splits nothing (an open cell outside S at one band from
// all of S) is a wait: it hands the same cells over. Waiting matters: a side whose every dig would leave the other
// better off (three cells apart, any dig naming the treasure for the other side: 1 in 3) does better to wait, and
// the other side can wait back while such cells last, so the one with the last wait has the edge. The worth of S
// for the side to move, with P waits open (counted exactly: the open cells that split nothing of S, less the digs
// made since): the best splitting dig's worth v, or with an odd P the better of v and 1 - v. Solved in a memo over
// S as bits, every open cell weighed at every position, sets of HUH.exact or fewer to the end and bigger ones as
// deep as the work allows (iterative deepening; out of reach: a half). At the root: the best dig, or a wait when
// every dig is worth less than a half (a wait costs nothing even with an even count: the other side waiting back
// only brings the same position round). A wait is reported with `after` (the same position: no gain on the board).
const HUH = { exact: 14, work: 2.5e5, depth: 14, bits: 30, eps: 1e-9, margin: 0.004 };
// The first dig of a fresh 6x6 grid, solved to the end (every dig weighed at every position, the waits counted): the
// four cells one in from a corner are worth a half, every other cell 17 in 36 (the other side 19 in 36).
const HUNT_OPEN = { 6: [7, 10, 25, 28] };
const BANDS = {};                                               // per grid size: the band between any two cells
function bandTable(n) {
  if (BANDS[n]) return BANDS[n];
  const nn = n * n, b = new Uint8Array(nn * nn);
  for (let a = 0; a < nn; a++) for (let c = 0; c < nn; c++) b[a * nn + c] = huntBand(huntDist(a, c, n));
  return (BANDS[n] = b);
}
const bits = x => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
// The solver for one set of cells C (30 or fewer) with the open cells `open` (C among them), `t0` digs already made
// since the root's count of waits was taken: { digs(d): [[cell, worth]] for every splitting dig at depth d, waits:
// the open cells that split nothing }.
function huntSolver(C, open, B, nn, budget, memo) {
  const m0 = C.length, full = m0 === 32 ? -1 : (1 << m0) - 1;
  const G = [], own = [], gm = [];                               // each open cell: its bit in C (0: not one), the cells of C at each band from it
  for (const g of open) {
    const at = C.indexOf(g), masks = [0, 0, 0, 0, 0];
    for (let i = 0; i < m0; i++) if (C[i] !== g) masks[B[g * nn + C[i]]] |= 1 << i;
    G.push(g); own.push(at >= 0 ? 1 << at : 0); gm.push(masks);
  }
  const ng = G.length;
  const dead0 = S => { let c = 0; for (let j = 0; j < ng; j++) { if (own[j] & S) continue; const k = gm[j]; if ((k[1] & S) === S || (k[2] & S) === S || (k[3] & S) === S || (k[4] & S) === S) c++; } return c; };
  const digv = (S, m, j, t, d) => {                              // a dig's worth from S (-1: it splits nothing)
    const k = gm[j], mine = own[j] & S;
    let v = mine ? 1 / m : 0, rest = 0;
    for (let b = 1; b <= 4; b++) {
      const g = k[b] & S;
      if (!g) continue;
      if (g === S) return -1;                                    // (all of S at one band: a wait)
      rest = 1;
      v += bits(g) / m * (1 - V(g, t + 1, d));
      if (budget.stop) return 0;
    }
    return mine || rest ? v : -1;
  };
  const V = (S, t, d) => {                                       // the side to move's chance from S, t digs after the root
    const m = bits(S);
    if (m <= 1) return 1;
    if (m > budget.exact && d <= 0) return 0.5;
    if (budget.stop) return 0.5;
    const P = Math.max(0, dead0(S) - t), key = S * 2 + (P & 1), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (budget.until ? (++budget.nodes & 15) === 0 && budget.until() <= 0 : (budget.work += ng * 6) > budget.cap) { budget.stop = true; return 0.5; }
    let top = 0;
    for (let j = 0; j < ng; j++) { const v = digv(S, m, j, t, d - 1); if (budget.stop) return 0.5; if (v > top) top = v; }
    if ((P & 1) && 1 - top > top) top = 1 - top;
    memo.set(key, { d, v: top, full: m <= budget.exact });
    return top;
  };
  return {
    V, full,
    digs: (t, d) => { const out = []; for (let j = 0; j < ng; j++) { const v = digv(full, m0, j, t, d); if (budget.stop) return null; if (v >= 0) out.push([G[j], v]); } return out; },
    waits: () => { const out = []; for (let j = 0; j < ng; j++) { if (own[j]) continue; const k = gm[j]; if (k[1] === full || k[2] === full || k[3] === full || k[4] === full) out.push(G[j]); } return out; },
  };
}
function huntHard(pm, cand, ctx, g, rng) {
  const n = g.n, nn = n * n, B = bandTable(n);
  const C = cand.slice().sort((a, b) => a - b), m0 = C.length;
  const open = []; for (let c = 0; c < nn; c++) if (!g.dug[c]) open.push(c);
  const budget = { until: ctx.until, nodes: 0, work: 0, cap: ctx.cap || HUH.work, exact: ctx.exact || HUH.exact, stop: false };
  let vals = null, waits = [];
  if (m0 === nn && HUNT_OPEN[n] && !ctx.solve) { const o = HUNT_OPEN[n], move = o[randInt(rng, o.length)]; return { move, q: 1 / m0, shared: true }; }   // the first dig: solved (below)
  if (m0 <= HUH.bits) {
    const sv = huntSolver(C, open, B, nn, budget, new Map());
    waits = sv.waits();
    for (let d = 1; d <= HUH.depth && !budget.stop; d++) {
      const out = sv.digs(0, d - 1);
      if (!out) break;
      vals = out;
      if (m0 <= HUH.exact) break;
    }
  } else {                                                       // too many for the bits (an open grid): each dig by the groups it leaves, each group solved on its own
    const memos = new Map(), inC = new Set(C);
    const worth = (grp, rest, d) => {
      if (grp.length <= 1) return 1;
      if (grp.length > HUH.bits) return 0.5;
      const key = grp.join(',');
      let e = memos.get(key);
      if (!e) memos.set(key, (e = { sv: huntSolver(grp, rest, B, nn, budget, new Map()) }));
      return e.sv.V(e.sv.full, 1, d);
    };
    for (let d = 0; d <= 2 && !budget.stop; d++) {
      const out = [];
      for (const c of open) {
        const gr = [[], [], [], [], []];
        for (const x of C) if (x !== c) gr[B[c * nn + x]].push(x);
        const parts = gr.filter(x => x.length);
        if (!inC.has(c) && parts.length <= 1) continue;
        const rest = open.filter(x => x !== c);
        let v = inC.has(c) ? 1 / m0 : 0;
        for (const grp of parts) { v += grp.length / m0 * (1 - worth(grp, rest, d)); if (budget.stop) break; }
        if (budget.stop) break;
        out.push([c, v]);
      }
      if (budget.stop) break;
      vals = out;
    }
  }
  if (!vals || !vals.length) {                                   // (out of time before the first depth: a dig that could be it)
    return { move: C[randInt(rng, m0)], q: 1 / m0, shared: true };
  }
  if (ctx.solve) return { vals };
  let top = -1;
  for (const x of vals) if (x[1] > top) top = x[1];
  if (waits.length && top < 0.5 - HUH.margin) return { move: waits[randInt(rng, waits.length)], q: 0, after: pm, shared: true };
  const ties = vals.filter(x => x[1] >= top - HUH.eps), move = ties[randInt(rng, ties.length)][0];
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

// The first dig of a fresh n x n grid, worked out to the end (slow: half a second for 6x6; `tests/sim/hunt-table.js`
// prints it and checks HUNT_OPEN against it): [[cell, the first mover's chance]].
export function huntFirstDigs(n) {
  const pm = { type: 'hunt', dug: new Array(n * n).fill(null), clues: new Array(n * n).fill(null) };
  const g = huntGrid(pm, 'X'), r = huntHard(pm, huntCandidates(pm, 'X'), { until: null, solve: true, cap: Infinity, exact: HUH.bits }, g, () => 0);
  return r.vals || [];
}
export const HUNT_FIRST = HUNT_OPEN;
