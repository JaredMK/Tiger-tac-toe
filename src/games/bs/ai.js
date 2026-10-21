// Battleship: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { bsCandidates, bsN } from './rules.js';

export function needs(pm, p) {
  const n = bsCandidates(pm).length; return Math.max(1, pm.len - pm.hits.length + (n <= 1 ? 0 : Math.log2(n) / 2));
}
export function best(pm, me, rng, style, ctx) {
  // Fire where the ship most often still fits, given every hit and miss (so around a hit once there
  // is one); between equals, the shot most likely to sink it.
  const cand = bsCandidates(pm), open = pm.revealed.map((r, i) => (r ? -1 : i)).filter(i => i >= 0);
  if (!cand.length) return { move: open[randInt(rng, open.length)], q: 0, shared: true };
  const miss = tune(pm).miss || 0;                               // (the admin's mistake rate: a shot anywhere open)
  if (miss && rng() * 100 < miss) return { move: open[randInt(rng, open.length)], q: 0, shared: true };
  if (ctx && ctx.level === 'hard') return bsHard(pm, cand, open, ctx);
  const N = bsN(pm), cover = new Array(N * N).fill(0), sinks = new Array(N * N).fill(0);
  for (const cells of cand) {
    const left = cells.filter(k => !pm.hits.includes(k));
    for (const k of left) cover[k]++;
    if (left.length === 1) sinks[left[0]]++;
  }
  let top = [];
  for (const k of open) {
    if (!top.length || cover[k] > cover[top[0]] || (cover[k] === cover[top[0]] && sinks[k] > sinks[top[0]])) top = [k];
    else if (cover[k] === cover[top[0]] && sinks[k] === sinks[top[0]]) top.push(k);
  }
  const move = top[randInt(rng, top.length)];
  return { move, q: sinks[move] / cand.length, shared: true };
}

// ---- Hard: the race for the ship ----
// The sea is shared and every shot shows both players, so what counts is not the likeliest cell (Normal) but
// who sinks it. The value of the placements still possible for the side to move, with the hits so far: for
// each cell some placement covers, the chance of a hit (the placements through it: the last part, sunk; else
// the side fires again from those placements) and of a miss (the other side moves, from the rest). Solved
// over the cells, every state met kept in a memo, deeper as the budget allows (iterative deepening; 8
// placements or fewer to the end, more out of reach worth 0.5). At the root a shot at a cell no placement
// covers is a pass (the other side faces the same sea): taken only when it beats the best shot clearly.
const BSH = { exact: 8, work: 1.2e5, depth: 16, margin: 0.05 };
function bsHard(pm, cand, open, ctx) {
  const N = bsN(pm), nn = N * N;
  const pc = cand.map(cells => cells.reduce((a, k) => a | (1 << k), 0));   // each placement's cells as bits
  const H = pm.hits.reduce((a, k) => a | (1 << k), 0), C = pc.map((_, i) => i), n = C.length;
  const until = ctx.until, memo = new Map();
  let nodes = 0, work = 0, stop = false;
  const V = (S, h, d) => {                                       // the side to move's chance from the placements S with the hits h, d plies deep
    const m = S.length;
    if (m <= 1) return 1;                                        // (one left: every shot a hit)
    if (m > BSH.exact && d <= 0) return 0.5;
    if (stop) return 0.5;
    const key = h + ':' + S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * nn) > BSH.work) { stop = true; return 0.5; }
    let cells = 0;
    for (const p of S) cells |= pc[p];
    cells &= ~h;
    let top = 0;
    for (let k = 0; k < nn; k++) { if (!((cells >> k) & 1)) continue; const v = shot(S, h, k, d - 1); if (stop) return 0.5; if (v > top) top = v; }
    memo.set(key, { d, v: top, full: m <= BSH.exact });
    return top;
  };
  const shot = (S, h, k, d) => {                                 // a shot's worth (-1: at a cell no placement covers)
    const m = S.length, bit = 1 << k, h2 = h | bit, hits = [], miss = [];
    let sunk = 0;
    for (const p of S) { if (pc[p] & bit) { if (pc[p] === h2) sunk++; else hits.push(p); } else miss.push(p); }
    if (!hits.length && !sunk) return -1;
    let v = sunk / m;
    if (hits.length) { v += hits.length / m * V(hits, h2, d); if (stop) return 0; }
    if (miss.length) v += miss.length / m * (1 - V(miss, h, d));
    return v;
  };
  let move = open[0], top = 0, stall = -1;
  for (let d = 1; d <= BSH.depth && !stop; d++) {
    let best = -1, pick = -1;
    for (const k of open) {
      if ((H >> k) & 1) continue;
      const v = shot(C, H, k, d - 1); if (stop) break;
      if (v < 0) { if (stall < 0) stall = k; continue; }
      if (v > best) { best = v; pick = k; }
    }
    if (stop) break;
    move = pick; top = best;
    if (n <= BSH.exact) break;
  }
  if (stall >= 0 && 1 - top > top + BSH.margin) move = stall;
  let q = 0;
  for (const p of C) if (pc[p] === (H | (1 << move))) q = 1 / n;
  return { move, q, shared: true };
}
