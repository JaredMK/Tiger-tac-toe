// Takeover: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { takeCount, takeSearch } from './rules.js';

export function needs(pm, p) {
  const e = pm.cells.filter(c => !c).length; return e ? raceNeeds(takeCount(pm.cells, p) - takeCount(pm.cells, other(p)), e / 5, 3) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const b = takeSearch(pm.cells, me, rng);
  const full = !b.after.includes(null);
  return { move: b.i, after: { type: 'takeover', cells: b.after }, win: full && takeCount(b.after, me) > takeCount(b.after, other(me)) };
}
