// Districts: the computer's play.
import { raceNeeds } from '../shared/placement.js';
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { distEval, distSearch } from './rules.js';

export function needs(pm, p) {
  const e = pm.who.filter(w => !w).length; return e ? raceNeeds(distEval(pm.map, pm.who, p), e / 2, 1.2) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const miss = tune(pm).miss, e = pm.who.map((w, k) => (w ? -1 : k)).filter(k => k >= 0);
  if (miss && rng() < miss / 100) { const k = e[randInt(rng, e.length)], a = pm.who.slice(); a[k] = me; return { move: k, after: { type: 'districts', map: pm.map, who: a } }; }   // (the admin's settings: a mistake now and then, any empty spot)
  const b = distSearch(pm, me, rng); return { move: b.k, after: { type: 'districts', map: pm.map, who: b.after } };
}
