// Roads: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { randInt } from '../../core/random.js';
import { roadCfg, roadLongest, roadPick } from './rules.js';

export function needs(pm, p) {
  const e = pm.segs.filter(c => !c).length; return e ? raceNeeds(roadLongest(pm.segs, p).len - roadLongest(pm.segs, other(p)).len, e / 4, 1.2) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const cf = roadCfg(pm), e = pm.segs.map((w, k) => (w ? -1 : k)).filter(k => k >= 0);
  if (cf.miss && rng() < cf.miss / 100) { const k = e[randInt(rng, e.length)], a = pm.segs.slice(); a[k] = me; return { move: k, after: { type: 'roads', segs: a } }; }   // (the admin's settings: a mistake now and then, any open edge)
  const b = roadPick(pm, me, rng); return { move: b.k, after: { type: 'roads', segs: b.after } };
}
