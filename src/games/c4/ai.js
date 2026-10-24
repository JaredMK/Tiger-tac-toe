// Four in a Row: the computer's play.
import { tune } from '../../core/tune.js';
import { lineNeeds, pickValued, slip } from '../shared/lines.js';
import { C4, c4Drop, c4Hard, c4Moves, c4Playable } from './rules.js';

export function needs(pm, p) {
  return lineNeeds(pm.cells, C4.cols, C4.rows, tune(pm).k, p, c4Playable(pm.cells));
}
export function best(pm, me, rng, style, ctx) {
  const t = tune(pm);
  const moves = ctx && ctx.level === 'hard' ? c4Hard(pm.cells, me, t.k, ctx.until).moves : c4Moves(pm.cells, me, t.depth, t.k);   // (Hard: the deep search, as the time allows)
  return pickValued(pm, me, slip(pm, moves, rng), c4Drop);
}
