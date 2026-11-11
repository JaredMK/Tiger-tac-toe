// Sea Battle: the computer's play.
import { randInt } from '../../core/random.js';
import { goAgain, tune } from '../../core/tune.js';
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
  return Math.max(1, sea.len - sea.hits.length + (n <= 1 ? 0 : Math.log2(n) / (goAgain(pm) ? 2 : 1)));   // ("Go again on success" off: a shot a turn)
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
  const hard = ctx && ctx.level === 'hard';
  if (hard && !race) { const x = bsExact(pm, cand, rng); if (x) return x; }   // Hard, a shared sea: the solved race, the search shots too
  if (!pm.hits.length) return bsHunt(pm, cand, open, rng, race);   // no hit yet: a random search shot (every level)
  if (hard) return race ? bsHardRace(pm, cand, open, ctx, rng) : bsHard(pm, cand, open, ctx, rng);
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

// The search before any hit (every level): a random shot among the open cells some placement still covers, weighted by
// how many cover it, never in order; for a ship of 2 or more, on one colour of a checkerboard (every placement crosses
// both), the colour its own misses so far keep to (a random one to start). Once there is a hit, the levels below
// target round it: the placements through every hit are the only ones left, so the cells beside it come first and,
// with a second hit, the line it lies along.
const bsPar = (k, N) => (Math.floor(k / N) + (k % N)) & 1;
export function bsHunt(pm, cand, open, rng, race) {
  const N = bsN(pm), cover = new Array(N * N).fill(0);
  for (const cells of cand) for (const k of cells) cover[k]++;
  let pool = open.filter(k => cover[k] > 0);
  if (!pool.length) pool = open;
  if (pm.len >= 2) {
    const misses = pm.revealed.map((r, i) => (r && !pm.hits.includes(i) ? i : -1)).filter(i => i >= 0);
    const ones = misses.filter(k => bsPar(k, N)).length, want = ones * 2 > misses.length ? 1 : ones * 2 < misses.length ? 0 : randInt(rng, 2);
    const on = pool.filter(k => bsPar(k, N) === want);
    if (on.length) pool = on;
  }
  const total = pool.reduce((a, k) => a + Math.max(1, cover[k]), 0);
  let r = rng() * total, move = pool[pool.length - 1];
  for (const k of pool) { r -= Math.max(1, cover[k]); if (r < 0) { move = k; break; } }
  return { move, q: pm.len === 1 && cand.length ? cover[move] / cand.length : 0, shared: !race };
}
// Among shots worth the same (to a hair), one at random: never the first in order.
const pickTie = (vals, rng, better) => { let b = null; for (const [, v] of vals) if (b === null || better(v, b)) b = v; const ties = vals.filter(([, v]) => Math.abs(v - b) < 1e-9).map(([k]) => k); return ties.length ? ties[randInt(rng, ties.length)] : -1; };

// ---- Hard, Race: the fewest turns to the sinking shot ----
// The other side's shots tell this one nothing and take nothing from it, so what counts is how many turns the hunt
// takes: a hit fires again, a miss ends the turn. The expected misses before the ship goes under, from the
// placements still possible with the hits so far: for each cell some placement covers, a hit (no miss: the hunt
// goes on from the placements through it, or the last part sinks it) or a miss (one, then on from the rest).
// Solved over the cells, every state met kept in a memo, deeper as the budget allows (iterative deepening; 8
// placements or fewer to the end, more out of reach worth about log2 of their number, halved).
function bsHardRace(pm, cand, open, ctx, rng) {
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
    const vals = [];
    for (const k of open) {
      if ((H >> k) & 1) continue;
      const v = shot(C, H, k, d - 1); if (stop) break;
      if (v < Infinity) vals.push([k, v]);
    }
    const pick = vals.length ? pickTie(vals, rng, (a, b) => a < b) : -1;
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
function bsHard(pm, cand, open, ctx, rng) {
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
    const vals = [];
    for (const k of open) {
      if ((H >> k) & 1) continue;
      const v = shot(C, H, k, d - 1); if (stop) break;
      if (v >= 0) vals.push([k, v]);
    }
    if (stop) break;
    const pick = vals.length ? pickTie(vals, rng, (a, b) => a > b) : -1;
    if (pick < 0) break;
    move = pick;
    if (n <= BSH.exact) break;
  }
  let q = 0;
  for (const p of C) if (pc[p] === (H | (1 << move))) q = 1 / n;
  return { move, q, shared: true };
}

// ---- Hard, the 4x4 sea: the race solved ----
// The whole game is small enough to solve: a position is the placements still possible (a bit each) and the hits;
// its worth for the side to move is the best shot's: the placements it sinks, those it hits (the side fires again
// from them) and those it misses (the other side's, from the rest). Every position met is kept for the life of the
// page (a ship of 3: about 3,200 positions, 20 ms; of 2: 23,000, 120 ms; worked out as they come up). What it shows:
// the first shot is worth the same anywhere (a half), but not the second: after a miss, some cells leave the other
// side 46% and others 54%, where the random search took any. A shot at a cell no placement covers (a wasted shot to
// hand the move over) is never the best (checked over every position, with the wasted shots counted). Among shots
// worth the same to BSX.near, one at random: the computer never fires in an order. A ship of one cell has nothing to
// solve (every open cell the same); a bigger sea keeps the search above.
const BSX = { n: 4, near: 1e-6, memo: {} };
function bsExact(pm, cand, rng) {
  const N = bsN(pm), len = pm.len;
  if (N !== BSX.n || !(len >= 2 && len <= N) || !cand.length) return null;
  const key = len + ':' + N, T = BSX.memo[key] || (BSX.memo[key] = { pc: bsPlacements(len, N).map(cells => cells.reduce((a, k) => a | (1 << k), 0)), memo: new Map() });
  const pc = T.pc, np = pc.length, nn = N * N, memo = T.memo;
  const shots = (S, h) => {                                      // every shot at a cell some placement covers: [cell, worth, the chance it sinks]
    let m = 0, cells = 0;
    for (let p = 0; p < np; p++) if ((S >>> p) & 1) { m++; cells |= pc[p]; }
    const live = cells & ~h, out = [];
    for (let k = 0; k < nn; k++) {
      if (!((live >>> k) & 1)) continue;
      const bit = 1 << k, h2 = h | bit;
      let hs = 0, ms = 0, nh = 0, nm = 0, sunk = 0;
      for (let p = 0; p < np; p++) if ((S >>> p) & 1) { if (pc[p] & bit) { if (pc[p] === h2) sunk++; else { hs |= 1 << p; nh++; } } else { ms |= 1 << p; nm++; } }
      let v = sunk / m;
      if (nh) v += nh / m * V(hs, h2);
      if (nm) v += nm / m * (1 - V(ms, h));
      out.push([k, v, sunk / m]);
    }
    return out;
  };
  const V = (S, h) => {                                          // the side to move's chance
    if (!(S & (S - 1))) return 1;                                // (one placement left: every shot a hit)
    const kk = S * 65536 + h, hit = memo.get(kk);
    if (hit !== undefined) return hit;
    let top = 0;
    for (const x of shots(S, h)) if (x[1] > top) top = x[1];
    memo.set(kk, top);
    return top;
  };
  let S = 0;
  const H = pm.hits.reduce((a, k) => a | (1 << k), 0);
  for (const cells of cand) { const b = cells.reduce((a, k) => a | (1 << k), 0), p = pc.indexOf(b); if (p < 0) return null; S |= 1 << p; }
  const vals = shots(S >>> 0, H).filter(x => !pm.revealed[x[0]]);
  if (!vals.length) return null;
  let top = -1;
  for (const x of vals) if (x[1] > top) top = x[1];
  let ties = vals.filter(x => x[1] >= top - BSX.near);
  if (pm.hits.length) {                                          // among equals: beside a hit (the way a person targets)
    const by = ties.filter(x => pm.hits.some(h => (Math.abs(h - x[0]) === 1 && Math.floor(h / N) === Math.floor(x[0] / N)) || Math.abs(h - x[0]) === N));
    if (by.length) ties = by;
  } else {                                                       // among equals: the search's checkerboard (bsHunt: the colour its misses keep to, a random one to start)
    const misses = pm.revealed.map((r, i) => (r ? i : -1)).filter(i => i >= 0);
    const ones = misses.filter(k => bsPar(k, N)).length, want = ones * 2 > misses.length ? 1 : ones * 2 < misses.length ? 0 : randInt(rng, 2);
    const on = ties.filter(x => bsPar(x[0], N) === want);
    if (on.length) ties = on;
  }
  const pick = ties[randInt(rng, ties.length)];
  return { move: pick[0], q: pick[2], shared: true };
}
