// Odd One Out: the computer's play.
import { randInt } from '../../core/random.js';
import { ODD } from './rules.js';

export function needs(pm, p) {
  let n = 0; for (let f = pm.finds[p]; f < ODD.goal; f++) n += 1 / ODD.aiFind[Math.min(f, ODD.aiFind.length - 1)]; return Math.max(1, n);
}
export function best(pm, me, rng, style, ctx) {   // a find 75%, 60%, then 45% of the time (ODD.aiFind)
  const q = ODD.aiFind[Math.min(pm.finds[me], ODD.aiFind.length - 1)], pos = pm.pos[me], n = pm.n[me] * pm.n[me];
  if (!Number.isInteger(pos)) return { move: 'auto', q: 0 };
  if (rng() < q) return { move: pos, q };
  let w = randInt(rng, n - 1); if (w >= pos) w++;
  return { move: w, q };
}
