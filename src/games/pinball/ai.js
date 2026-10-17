// Pinball: the computer's play.
import { fingNeeds } from '../shared/finger.js';

export function needs(pm, p) {
  return fingNeeds(pm, p);
}
export function best(pm, me, rng, style, ctx) {
  const n = fingNeeds(pm, me); return { move: { fing: true }, q: n <= 1 ? 0.6 : 0.35 / n };
}
