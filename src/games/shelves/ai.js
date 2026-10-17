// Shelves: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { shelfOn, shelfPick } from './rules.js';

export function needs(pm, p) {
  const e = pm.cells.filter(c => !c).length; return e ? raceNeeds(shelfOn(pm.cells, p) - shelfOn(pm.cells, other(p)), e / 4, 1) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const b = shelfPick(pm, me, rng), a = pm.cells.slice(); a[b.i] = me; return { move: b.i, after: { type: 'shelves', cells: a } };
}
