// Hex: the computer's play.
import { pickValued, slip } from '../shared/lines.js';
import { hexDist, hexMoves } from './rules.js';

export function needs(pm, p) {
  return hexDist(pm.cells, p);
}
export function best(pm, me, rng, style, ctx) {
  return pickValued(pm, me, slip(pm, hexMoves(pm.cells, me), rng), (cells, i) => i);
}
