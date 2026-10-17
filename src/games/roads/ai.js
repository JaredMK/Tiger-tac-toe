// Roads: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { roadLongest, roadPick } from './rules.js';

export function needs(pm, p) {
  const e = pm.segs.filter(c => !c).length; return e ? raceNeeds(roadLongest(pm.segs, p).len - roadLongest(pm.segs, other(p)).len, e / 4, 1.2) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const b = roadPick(pm, me, rng); return { move: b.k, after: { type: 'roads', segs: b.after } };
}
