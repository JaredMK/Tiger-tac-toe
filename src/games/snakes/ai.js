// Snakes and Ladders: the computer's play.
import { tune } from '../../core/tune.js';
import { SNL, snlExpected } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, snlExpected(pm)[pm.pos[p]]);
}
export function best(pm, me, rng, style, ctx) {
  const need = SNL.n - pm.pos[me], D = tune(pm).die || SNL.die; return { move: 'roll', q: need <= D ? (D + 1 - need) / D : 0 };
}
