// Number Target: the computer's play. It stands in for a head for figures: with its level's chance (`aiPct`) it finds
// a way to the target (rules.js numbersSolve, three steps at most: every puzzle has one) and plays it; otherwise its
// attempt is a sum or two that goes nowhere.
import { numbersCfg, numbersOp, numbersSolve } from './rules.js';

export function needs(pm, p) { const c = numbersCfg(pm); return Math.max(1, 100 / Math.max(1, c.ai.normal)); }
export function best(pm, me, rng, style, ctx) {
  const c = numbersCfg(pm), level = (ctx && ctx.level) || 'normal', pct = c.ai[level] == null ? c.ai.normal : c.ai[level], pz = pm.pz;
  if (rng() < pct / 100) { const s = numbersSolve(pz); if (s) return { move: { steps: s }, q: 1 }; }
  for (let k = 0; k < 20; k++) {                                    // a wrong try: two of the numbers added or multiplied, off the target
    const i = Math.floor(rng() * pz.nums.length), j = (i + 1 + Math.floor(rng() * (pz.nums.length - 1))) % pz.nums.length, op = rng() < 0.5 ? '+' : '*', v = numbersOp(pz.nums[i], op, pz.nums[j]);
    if (v != null && v !== pz.target) return { move: { steps: [[i, op, j]] }, q: 0 };
  }
  return { move: { steps: [] }, q: 0 };
}
