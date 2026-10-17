// Districts: the computer's play.
import { raceNeeds } from '../shared/placement.js';
import { distEval, distSearch } from './rules.js';

export function needs(pm, p) {
  const e = pm.who.filter(w => !w).length; return e ? raceNeeds(distEval(pm.map, pm.who, p), e / 2, 1.2) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const b = distSearch(pm, me, rng); return { move: b.k, after: { type: 'districts', map: pm.map, who: b.after } };
}
