// Odd One Out: the computer's play.
import { randInt } from '../../core/random.js';
import { oddAi } from './rules.js';
import { tune } from '../../core/tune.js';

export function needs(pm, p) {
  const t = tune(pm); let n = 0; for (let f = pm.finds[p]; f < t.goal; f++) n += 1 / Math.max(0.01, oddAi(t, f)); return Math.max(1, n);
}
export function best(pm, me, rng, style, ctx) {   // a find 75%, 60%, then 45% of the time (its settings: ai1-ai3)
  const q = oddAi(tune(pm), pm.finds[me]), pos = pm.pos[me], n = pm.n[me] * pm.n[me];
  if (!Number.isInteger(pos)) return { move: 'auto', q: 0 };
  if (rng() < q) return { move: pos, q };
  let w = randInt(rng, n - 1); if (w >= pos) w++;
  return { move: w, q };
}
