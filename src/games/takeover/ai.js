// Takeover: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { takeApply, takeCount, takeSearch } from './rules.js';

export function needs(pm, p) {
  const e = pm.cells.filter(c => !c).length; return e ? raceNeeds(takeCount(pm.cells, p) - takeCount(pm.cells, other(p)), e / 5, 3) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const t = tune(pm), e = pm.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  const slip = t.miss && rng() < t.miss / 100, i = slip ? e[randInt(rng, e.length)] : null;   // (the admin's settings: a mistake now and then, any empty cell)
  const b = slip ? { i, after: takeApply(pm.cells, i, me) } : takeSearch(pm.cells, me, rng, t.depth);
  const full = !b.after.includes(null);
  return { move: b.i, after: { type: 'takeover', cells: b.after }, win: full && takeCount(b.after, me) > takeCount(b.after, other(me)) };
}
