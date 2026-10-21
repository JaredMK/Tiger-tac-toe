// Connect 4: the computer's play.
import { tune } from '../../core/tune.js';
import { lineNeeds, pickValued, slip } from '../shared/lines.js';
import { C4, c4Drop, c4Moves, c4Playable } from './rules.js';

export function needs(pm, p) {
  return lineNeeds(pm.cells, C4.cols, C4.rows, tune(pm).k, p, c4Playable(pm.cells));
}
export function best(pm, me, rng, style, ctx) {
  const t = tune(pm);
  return pickValued(pm, me, slip(pm, c4Moves(pm.cells, me, t.depth, t.k), rng), c4Drop);
}
