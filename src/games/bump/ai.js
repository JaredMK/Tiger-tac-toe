// Bump: the computer's play.
import { BUMP } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, (BUMP.n + 1 - pm.pos[p]) / 2);
}
export function best(pm, me, rng, style, ctx) {
  const need = BUMP.n + 1 - pm.pos[me]; return { move: 'spin', q: need <= BUMP.max ? (BUMP.max + 1 - need) / BUMP.max : 0 };
}
