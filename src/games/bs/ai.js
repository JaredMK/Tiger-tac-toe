// Sea Battle: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { bsCandidates, bsN, bsPlacements, bsSea } from './rules.js';

// Race mode (core/race.js, `rv: 2`): the computer fires at its own sea (pm.side[me]) for its own ship; the other
// side's sea is open too (their needs from their own shots), and a shot of its own tells nothing of theirs: Hard plays
// for the fewest turns (misses) to the sinking shot (bsHardRace). No shot limit in a race.
const raceEst = (sh, len, N) => {                                // about how many placements still fit a hunt of `hits` hits and `miss` misses
  const all = bsPlacements(len, N).length, cells = N * N, hits = sh.hits || 0, miss = sh.miss || 0;
  if (sh.sunk || hits >= len) return 1;
  const through = hits ? Math.max(1, 2 * (len - hits + 1) - 1) : all;   // (through a hit: the ways a line through it lies, about 2(len - h + 1) - 1)
  return Math.max(1, through * Math.pow(1 - miss / Math.max(1, cells - hits), len - hits));
};
export function needs(pm, p) {
  if (pm.race && !(pm.side && pm.side[p])) {                     // (a race square from before the rework: the other side from their shape)
    const sh = (pm.shape && pm.shape[p]) || {}, n = raceEst(sh, pm.len, bsN(pm));
    return Math.max(1, pm.len - (sh.hits || 0) + (n <= 1 ? 0 : Math.log2(n) / 2));
  }
  const sea = bsSea(pm, p), n = bsCandidates(sea).length;
  return Math.max(1, sea.len - sea.hits.length + (n <= 1 ? 0 : Math.log2(n) / 2));
}
export function best(pm, me, rng, style, ctx) {
  // Fire where the ship most often still fits, given every hit and miss (so around a hit once there
  // is one); between equals, the shot most likely to sink it.
  const race = !!pm.race;
  pm = bsSea(pm, me);                                            // (a race: the computer's own sea)
  const cand = bsCandidates(pm), open = pm.revealed.map((r, i) => (r ? -1 : i)).filter(i => i >= 0);
  if (!cand.length) return { move: open[randInt(rng, open.length)], q: 0, shared: !race };
  const miss = tune(pm).miss || 0;                               // (the admin's mistake rate: a shot anywhere open)
  if (miss && rng() * 100 < miss) return { move: open[randInt(rng, open.length)], q: 0, shared: !race };
  if (ctx && ctx.level === 'hard') return race ? bsHardRace(pm, cand, open, ctx) : bsHard(pm, cand, open, ctx);
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
  return { move, q: sinks[move] / cand.length, shared: !race };
}

// ---- Hard, Race: the fewest turns to the sinking shot ----
// The other side's shots tell this one nothing and take nothing from it, so what counts is how many turns the hunt
// takes: a hit fires again, a miss ends the turn. The expected misses before the ship goes under, from the
// placements still possible with the hits so far: for each cell some placement covers, a hit (no miss: the hunt
// goes on from the placements through it, or the last part sinks it) or a miss (one, then on from the rest).
// Solved over the cells, every state met kept in a memo, deeper as the budget allows (iterative deepening; 8
// placements or fewer to the end, more out of reach worth about log2 of their number, halved).
function bsHardRace(pm, cand, open, ctx) {
  const N = bsN(pm), nn = N * N;
  const pc = cand.map(cells => cells.reduce((a, k) => a | (1 << k), 0));
  const H = pm.hits.reduce((a, k) => a | (1 << k), 0), C = pc.map((_, i) => i), n = C.length;
  const until = ctx.until, memo = new Map();
  let nodes = 0, work = 0, stop = false;
  const guess = m => (m <= 1 ? 0 : Math.log2(m) / 2);          // misses about left with m placements open
  const V = (S, h, d) => {                                       // the misses still to come from the placements S with the hits h, d plies deep
    const m = S.length;
    if (m <= 1) return 0;                                        // (one left: every shot a hit)
    if (m > BSH.exact && d <= 0) return guess(m);
    if (stop) return guess(m);
    const key = h + ':' + S.join(','), hit = memo.get(key);
    if (hit && (hit.full || hit.d >= d)) return hit.v;
    if (until ? (++nodes & 15) === 0 && until() <= 0 : (work += m * nn) > BSH.work) { stop = true; return guess(m); }
    let cells = 0;
    for (const p of S) cells |= pc[p];
    cells &= ~h;
    let low = Infinity;
    for (let k = 0; k < nn; k++) { if (!((cells >> k) & 1)) continue; const v = shot(S, h, k, d - 1); if (stop) return guess(m); if (v < low) low = v; }
    memo.set(key, { d, v: low, full: m <= BSH.exact });
    return low;
  };
  const shot = (S, h, k, d) => {                                 // a shot's expected misses (Infinity: at a cell no placement covers)
    const m = S.length, bit = 1 << k, h2 = h | bit, hits = [], miss = [];
    let sunk = 0;
    for (const p of S) { if (pc[p] & bit) { if (pc[p] === h2) sunk++; else hits.push(p); } else miss.push(p); }
    if (!hits.length && !sunk) return Infinity;
    let v = 0;
    if (hits.length) { v += hits.length / m * V(hits, h2, d); if (stop) return guess(m); }
    if (miss.length) v += miss.length / m * (1 + V(miss, h, d));
    return v;
  };
  let move = open[0];
  for (let d = 1; d <= BSH.depth && !stop; d++) {
    let best = Infinity, pick = -1;
    for (const k of open) {
      if ((H >> k) & 1) continue;
      const v = shot(C, H, k, d - 1); if (stop) break;
      if (v < best) { best = v; pick = k; }
    }
    if (stop || pick < 0) break;
    move = pick;
    if (n <= BSH.exact) break;
  }
  let q = 0;
  for (const p of C) if (pc[p] === (H | (1 << move))) q = 1 / n;
  return { move, q, shared: false };
}

// ---- Hard: the race for the ship ----
// The sea is shared and every shot shows both players, so what counts is not the likeliest cell (Normal) but
// who sinks it. The value of the placements still possible for the side to move, with the hits so far: for
// each cell some placement covers, the chance of a hit (the placements through it: the last part, sunk; else
// the side fires again from those placements) and of a miss (the other side moves, from the rest). Solved
// over the cells, every state met kept in a memo, deeper as the budget allows (iterative deepening; 8
// placements or fewer to the end, more out of reach worth 0.5). Never a shot at a cell no placement covers
// (a pass, and it never paid).
const BSH = { exact: 8, work: 1.2e5, depth: 16 };
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
  let move = open[0];
  for (let d = 1; d <= BSH.depth && !stop; d++) {
    let best = -1, pick = -1;
    for (const k of open) {
      if ((H >> k) & 1) continue;
      const v = shot(C, H, k, d - 1); if (stop) break;
      if (v > best) { best = v; pick = k; }
    }
    if (stop) break;
    move = pick;
    if (n <= BSH.exact) break;
  }
  let q = 0;
  for (const p of C) if (pc[p] === (H | (1 << move))) q = 1 / n;
  return { move, q, shared: true };
}
