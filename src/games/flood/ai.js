// Flood: the computer's play.
import { randInt } from '../../core/random.js';
import { floodApply, floodCfg, floodSearch } from './rules.js';

export function needs(pm, p) {
  return Math.max(0.5, (floodCfg(pm).goal - pm.score[p]) / 3.2);
}
export function best(pm, me, rng, style, ctx) {
  const cf = floodCfg(pm);
  if (cf.miss && rng() < cf.miss / 100) {                   // (the admin's settings: a mistake now and then, any colour but the blob's)
    const cs = Array.from({ length: cf.colors - 1 }, (_, k) => (k >= pm.colors[0] ? k + 1 : k)), c = cs[randInt(rng, cs.length)], a = floodApply(pm, c, me);
    return { move: c, after: { type: 'flood', colors: a.colors, owner: a.owner, score: a.score }, win: a.score[me] >= cf.goal };
  }
  const b = floodSearch(pm, me, rng); return { move: b.c, after: b.after, win: b.win };
}
