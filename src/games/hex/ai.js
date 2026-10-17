// Hex: the computer's play.
import { pickValued } from '../shared/lines.js';
import { hexDist, hexMoves } from './rules.js';

export function needs(pm, p) {
  return hexDist(pm.cells, p);
}
export function best(pm, me, rng, style, ctx) {
  return pickValued(pm, me, hexMoves(pm.cells, me), (cells, i) => i);
}
