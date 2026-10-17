// Risk Wheels: the computer's play.
import { other } from '../../core/util.js';
import { wheelsTable } from './rules.js';

export function needs(pm, p) {
  return Math.max(0.5, wheelsTable(pm.target, pm.wheels).E[Math.min(pm.target, pm.pts[p])]);
}
export function best(pm, me, rng, style, ctx) {   // the wheel with the best chance to reach the target first from here, both players playing their best (behind, that is the riskier one)
  const T = pm.target, a = Math.min(T - 1, pm.pts[me]), b = Math.min(T - 1, pm.pts[other(me)]), w = wheelsTable(T, pm.wheels).best[a][b];
  return { move: w, q: pm.wheels[w].filter(v => a + v >= T).length / pm.wheels[w].length };
}
