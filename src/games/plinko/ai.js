// Peg Drop: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { other } from '../../core/util.js';
import { PLINKO, plinkoBonusPts, plinkoDist, plinkoExp, plinkoOpen, plinkoPegs, plinkoTouches, plinkoWays } from './rules.js';

export function needs(pm, p) {
  const e = Array.from({ length: PLINKO.slots }, (_, k) => plinkoExp(pm, k)), best = Math.max(...plinkoOpen(pm).map(k => e[k])), mean = e.reduce((x, y) => x + y, 0) / e.length; return Math.max(1, (pm.target - pm.pts[p]) / ((best + mean) / 2));
}
export function best(pm, me, rng, style, ctx) {   // the open slot with the most points to expect (the bonus peg counted); level, the likelier to finish. Hard: the likelier to win the square (plinkoDeep)
  const need = pm.target - pm.pts[me], q = k => Object.entries(plinkoDist(pm, k)).reduce((t, [v, c]) => t + (Number(v) >= need ? c : 0), 0);
  const miss = tune(pm).miss;
  if (miss && rng() * 100 < miss) { const open = plinkoOpen(pm), k = open[randInt(rng, open.length)]; return { move: k, q: q(k), exp: plinkoExp(pm, k) }; }   // (now and then, the admin's mistake rate, any open slot)
  if (ctx && ctx.level === 'hard') { const x = plinkoDeep(pm, me), k = x ? x.move : plinkoHard(pm, me); return { move: k, q: q(k), exp: plinkoExp(pm, k) }; }
  let move = -1, top = -1, tq = -1;
  for (const k of plinkoOpen(pm)) { const e = plinkoExp(pm, k), qk = q(k); if (e > top + 1e-9 || (Math.abs(e - top) < 1e-9 && qk > tq)) { move = k; top = e; tq = qk; } }
  return { move, q: tq, exp: top };
}

// ---- the race, reckoned (Hard until November 2026; now where the look-ahead below has no peg to go by) ----
// The open slot with the best chance of winning the square: every outcome of my drop (plinkoDist: the bin and
// the bonus peg), then the other side's best reply over the slots still open (the one I use locks for them
// too; a bonus peg I hit moves, so their reply is reckoned without one), then the race from there (plinkoRace:
// each turn a typical drop, the mean of the seven slots, until one side reaches the target).
function drops(pm, k) {                                         // a drop's outcomes from slot k: [points, chance, the peg hit]
  const out = new Map(), b = pm.bonus, bonus = plinkoBonusPts(pm);
  for (const w of plinkoWays(k)) { const hit = !!b && plinkoTouches(k, w.path)[b.r - 1] === b.x, key = (pm.vals[w.bin] + (hit ? bonus : 0)) * 2 + (hit ? 1 : 0); out.set(key, (out.get(key) || 0) + w.p); }
  return [...out].map(([key, p]) => [key >> 1, p, key & 1]);
}
export function plinkoRace(T, D) {   // R[a * T + b]: the chance the player to move, a points to the other's b, wins
  const R = new Float64Array(T * T);
  for (let s = 2 * T - 2; s >= 0; s--) for (let a = Math.min(T - 1, s); a >= 0 && s - a < T; a--) {
    const b = s - a; let v = 0;
    for (const [x, p] of D) v += p * (a + x >= T ? 1 : 1 - R[b * T + a + x]);
    R[a * T + b] = v;
  }
  return R;
}
export function plinkoHard(pm, me) {
  const T = pm.target, a = Math.min(T - 1, pm.pts[me]), b = Math.min(T - 1, pm.pts[other(me)]);
  const open = plinkoOpen(pm), all = Array.from({ length: PLINKO.slots }, (_, k) => k);
  const withPeg = all.map(k => drops(pm, k)), noPeg = all.map(k => drops(Object.assign({}, pm, { bonus: null }), k));
  const mean = {}; for (const d of withPeg) for (const [v, p] of d) mean[v] = (mean[v] || 0) + p / PLINKO.slots;
  const R = plinkoRace(T, Object.entries(mean).map(([v, p]) => [Number(v), p]));
  const reply = (used, ds, a2) => {                               // the other side's best drop, then my chance
    let top = 0;
    for (let j = 0; j < PLINKO.slots; j++) { if (used[j]) continue; let v = 0; for (const [x, p] of ds[j]) v += p * (b + x >= T ? 1 : 1 - R[a2 * T + b + x]); if (v > top) top = v; }
    return 1 - top;
  };
  let move = open[0], best = -1, bq = -1, be = -1;
  for (const k of open) {
    const used = pm.used.slice(); used[k] = true;
    if (used.every(Boolean)) used.fill(false);
    let v = 0, q = 0, e = 0;
    for (const [x, p, hit] of withPeg[k]) { v += p * (a + x >= T ? 1 : reply(used, hit ? noPeg : withPeg, a + x)); e += p * x; if (a + x >= T) q += p; }
    if (v > best + 1e-9 || (v > best - 1e-9 && (q > bq + 1e-9 || (q > bq - 1e-9 && e > be)))) { best = v; bq = q; be = e; move = k; }   // (alike: the square now, then the points)
  }
  return move;
}

// ---- Hard: the look-ahead ----
// Everything in the square shows: the bins, both scores, the slots locked, the bonus peg; the only chance is the
// chip's way down and where a hit bonus peg goes next (any other peg below the top row, each as likely). The square's
// exact value (the chance the player to move wins it, both dropping their best, over 590,000 positions of scores,
// slots and peg) is worked out in tests/sim/plinko-table.js, too slow to build for every square (a tenth of a second);
// Hard plays this instead, measured there against it: it gives up 0.014% of a square a drop on average (the reckoning
// above, plinkoHard, 0.05%; the exact table, nothing).
// LOOSE[a][b][used]: the race with the bonus peg anywhere each drop (its chance of being hit from a slot the mean
// over the pegs): 18,000 positions, a millisecond, kept per square. The look-ahead plays the square as it is (the peg
// where it shows) DEEP.depth drops ahead, both sides at their best, and reads LOOSE where a drop hits the peg (the
// next one is anywhere) or the depth runs out.
let GEO = null;                                                 // (worked out at the first call, never as the module loads: rules.js may still be loading then)
function geo() {
  if (GEO) return GEO;
  const PEGS = plinkoPegs().filter(q => q.r >= 2), pegIx = b => PEGS.findIndex(q => q.x === b.x && q.r === b.r);
  // per slot: its ways down as { bin, the pegs touched (a bit each, PEGS' order, two words), chance }
  const W8 = [];
  for (let k = 0; k < PLINKO.slots; k++) W8.push(plinkoWays(k).map(w => { const t = plinkoTouches(k, w.path); let lo = 0, hi = 0; t.forEach((x, r) => { const i = pegIx({ x, r: r + 1 }); if (i >= 0) { if (i < 30) lo |= 1 << i; else hi |= 1 << (i - 30); } }); return { bin: w.bin, lo, hi, p: w.p }; }));
  return (GEO = { NP: PEGS.length, NU: 1 << PLINKO.slots, FULL: (1 << PLINKO.slots) - 1, pegIx, W8 });
}
export const DEEP = { depth: 3 };
const LOOSE = new Map();
function looseTable(pm) {
  const T = pm.target, bonus = plinkoBonusPts(pm), key = T + '|' + bonus + '|' + pm.vals.join(',');
  let e = LOOSE.get(key);
  if (e) return e;
  const { W8, NP, NU, FULL } = geo(), NS = PLINKO.slots, D = [];   // per slot: [points, chance], the peg anywhere
  for (let k = 0; k < NS; k++) {
    const m = new Map();
    for (const w of W8[k]) { let n = 0; for (let g = 0; g < NP; g++) n += g < 30 ? (w.lo >>> g) & 1 : (w.hi >>> (g - 30)) & 1; const v = pm.vals[w.bin]; m.set(v, (m.get(v) || 0) + w.p * (1 - n / NP)); if (n) m.set(v + bonus, (m.get(v + bonus) || 0) + w.p * n / NP); }
    D.push([...m]);
  }
  const DS = new Int32Array(NS + 1), X = [], P = [];
  D.forEach((d, k) => { for (const [x, p] of d) { X.push(x); P.push(p); } DS[k + 1] = X.length; });
  const xs = Int32Array.from(X), ps = Float64Array.from(P), L = new Float32Array(T * T * NU);
  for (let s = 2 * T - 2; s >= 0; s--) for (let a = Math.min(T - 1, s); a >= 0 && s - a < T; a--) {
    const b = s - a, row = (a * T + b) * NU, bT = b * T + a;
    for (let used = 0; used < FULL; used++) {
      let top = 0;
      for (let k = 0; k < NS; k++) {
        if (used & (1 << k)) continue;
        let u2 = used | (1 << k), v = 0; if (u2 === FULL) u2 = 0;
        for (let j = DS[k], end = DS[k + 1]; j < end; j++) { const x = xs[j]; v += ps[j] * (a + x >= T ? 1 : 1 - L[(bT + x) * NU + u2]); }
        if (v > top) top = v;
      }
      L[row + used] = top;
    }
  }
  e = { T, L };
  if (LOOSE.size >= 4) LOOSE.delete(LOOSE.keys().next().value);
  LOOSE.set(key, e);
  return e;
}
export function plinkoDeep(pm, me, depth) {
  const { W8, NU, FULL, pegIx } = geo(), T = pm.target, a0 = Math.min(T - 1, pm.pts[me]), b0 = Math.min(T - 1, pm.pts[other(me)]), g = pm.bonus ? pegIx(pm.bonus) : -1;
  if (!(T >= 1 && T <= 40) || g < 0 || !Array.isArray(pm.vals) || pm.vals.length !== PLINKO.slots) return null;
  const { L } = looseTable(pm), NS = PLINKO.slots, bonus = plinkoBonusPts(pm), D = [];
  for (let k = 0; k < NS; k++) {                                // per slot, the peg where it is: [points, chance, hit]
    const m = new Map();
    for (const w of W8[k]) { const hit = g < 30 ? (w.lo >>> g) & 1 : (w.hi >>> (g - 30)) & 1, id = (pm.vals[w.bin] + (hit ? bonus : 0)) * 2 + hit; m.set(id, (m.get(id) || 0) + w.p); }
    D.push([...m].map(([id, p]) => [id >> 1, p, id & 1]));
  }
  const slot = (a, b, used, k, d) => {                          // the mover's chance dropping from k, d more drops looked at after it
    let u2 = used | (1 << k), v = 0; if (u2 === FULL) u2 = 0;
    for (const [x, p, hit] of D[k]) v += p * (a + x >= T ? 1 : 1 - (hit || d <= 0 ? L[(b * T + a + x) * NU + u2] : node(b, a + x, u2, d - 1)));
    return v;
  };
  const node = (a, b, used, d) => { let top = 0; for (let k = 0; k < NS; k++) { if (used & (1 << k)) continue; const v = slot(a, b, used, k, d); if (v > top) top = v; } return top; };
  let used = 0; pm.used.forEach((u, k) => { if (u) used |= 1 << k; });
  if (used === FULL) used = 0;
  const need = T - pm.pts[me], vals = new Array(NS).fill(null);
  let move = -1, best = -1, bq = -1, be = -1;
  for (const k of plinkoOpen(pm)) {
    const v = vals[k] = slot(a0, b0, used, k, (depth || DEEP.depth) - 1);
    let q = 0, ex = 0; for (const [x, p] of D[k]) { ex += x * p; if (x >= need) q += p; }
    if (v > best + 1e-7 || (v > best - 1e-7 && (q > bq + 1e-9 || (q > bq - 1e-9 && ex > be)))) { best = v; bq = q; be = ex; move = k; }
  }
  return move < 0 ? null : { move, p: best, vals };
}
