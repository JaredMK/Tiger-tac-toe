// Snakes and Ladders: the computer's play.
import { SNL, snlExpected } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, snlExpected(pm)[pm.pos[p]]);
}
export function best(pm, me, rng, style, ctx) {
  const need = SNL.n - pm.pos[me]; return { move: 'roll', q: need <= 6 ? (7 - need) / 6 : 0 };
}
