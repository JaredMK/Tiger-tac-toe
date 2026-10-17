// Connect 4: the computer's play.
import { lineNeeds, pickValued } from '../shared/lines.js';
import { C4, c4Drop, c4Moves, c4Playable } from './rules.js';

export function needs(pm, p) {
  return lineNeeds(pm.cells, C4.cols, C4.rows, C4.k, p, c4Playable(pm.cells));
}
export function best(pm, me, rng, style, ctx) {
  return pickValued(pm, me, c4Moves(pm.cells, me), c4Drop);
}
