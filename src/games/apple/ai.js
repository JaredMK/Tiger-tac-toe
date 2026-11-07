// Apple Pick: the computer's play. There is one move (spin), so `best` is the spin; what the computer knows is how
// many spins a bucket still needs (`needs`), from the wheel's exact odds, which the main board's AI weighs the
// square by (core/ai.js). Hard has nothing to search here: every level plays the same (ctx.level is read, not needed).
import { tune } from '../../core/tune.js';
import { appleSegs, appleStep, appleTarget } from './rules.js';

const TABLES = new Map();
// E[b]: the spins a bucket of b apples takes to reach the target on average (a bird or a spill sends it back, so
// the chain loops; solved by sweeps until it settles). One table per wheel, target and settings.
function appleTable(pm) {
  const t = tune(pm), T = appleTarget(pm), segs = Array.isArray(pm.segs) && pm.segs.length ? pm.segs : appleSegs(t);
  const key = T + '|' + segs.join(',') + '|' + (t.birdTakes || 2) + '|' + (t.spillPct || 50);
  let E = TABLES.get(key);
  if (E) return E;
  E = new Float64Array(T + 1);
  const n = segs.length, next = [];
  for (let b = 0; b < T; b++) next.push(segs.map(v => appleStep(v, b, T, t).bucket));
  for (let it = 0; it < 2000; it++) {
    let delta = 0;
    for (let b = T - 1; b >= 0; b--) {
      let s = 0;
      for (const b2 of next[b]) s += E[b2];
      const e = 1 + s / n;
      delta = Math.max(delta, Math.abs(e - E[b])); E[b] = e;
    }
    if (delta < 1e-9) break;
  }
  if (TABLES.size >= 12) TABLES.delete(TABLES.keys().next().value);
  TABLES.set(key, E);
  return E;
}
// The moves (spins) a side still needs: none once the bucket is full.
export function needs(pm, p) {
  const T = appleTarget(pm), b = Math.min(T, (pm.bucket && pm.bucket[p]) || 0);
  if (b >= T) return 0;
  return appleTable(pm)[b];
}
export function best(pm, me, rng, style, ctx) {
  const T = appleTarget(pm), b = (pm.bucket && pm.bucket[me]) || 0, segs = Array.isArray(pm.segs) && pm.segs.length ? pm.segs : appleSegs(tune(pm));
  const q = segs.filter(v => v > 0 && v >= T - b).length / segs.length;   // this spin's chance of the square: a pick that fills the bucket
  if (ctx && ctx.level === 'hard') { /* nothing to search: Hard spins like the rest */ }
  return { move: 'spin', q };
}
