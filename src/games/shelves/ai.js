// Shelves: the computer's play.
import { other } from '../../core/util.js';
import { raceNeeds } from '../shared/placement.js';
import { randInt } from '../../core/random.js';
import { shelfCfg, shelfOn, shelfPick } from './rules.js';

export function needs(pm, p) {
  const e = pm.cells.filter(c => !c).length, per = shelfCfg(pm).per; return e ? raceNeeds(shelfOn(pm.cells, p, per) - shelfOn(pm.cells, other(p), per), e / 4, 1) : Infinity;
}
export function best(pm, me, rng, style, ctx) {
  const cf = shelfCfg(pm), e = pm.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
  const b = cf.miss && rng() < cf.miss / 100 ? { i: e[randInt(rng, e.length)] } : shelfPick(pm, me, rng), a = pm.cells.slice(); a[b.i] = me; return { move: b.i, after: { type: 'shelves', cells: a } };
}
