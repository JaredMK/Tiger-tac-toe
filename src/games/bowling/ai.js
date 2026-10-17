// Bowling: the computer's play.
import { physAi, physNeeds } from '../shared/physics.js';

export function needs(pm, p) {
  return physNeeds(pm, p);
}
export function best(pm, me, rng, style, ctx) {
  return physAi(pm, me, rng);   // the best of its candidate shots, with a little error
}
