// Candy Race: the computer's play.
import { CANDY, candyExpected } from './rules.js';

export function needs(pm, p) {
  return Math.max(1, candyExpected(pm.track)[pm.pos[p] + 1]);
}
export function best(pm, me, rng, style, ctx) {
  let finishing = 0;
  for (const color of CANDY.colors) if (!pm.track.some((c, i) => i > pm.pos[me] && c === color)) finishing++;
  return { move: 1, q: finishing / CANDY.colors.length };
}
