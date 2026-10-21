// Hex: the computer's play.
import { pickValued, slip } from '../shared/lines.js';
import { hexDist, hexHard, hexMoves } from './rules.js';

export function needs(pm, p) {
  return hexDist(pm.cells, p);
}
export function best(pm, me, rng, style, ctx) {
  const moves = ctx && ctx.level === 'hard' ? hexHard(pm.cells, me, ctx.until).moves : hexMoves(pm.cells, me);   // (Hard: the deep search, as the time allows)
  return pickValued(pm, me, slip(pm, moves, rng), (cells, i) => i);
}
