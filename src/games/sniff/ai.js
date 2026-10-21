// Sniff: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { SNIFF_MID, sniffCands, sniffDirs, sniffPick, sniffSteps } from './rules.js';

// Super Chaos: a dog each. The computer walks its own, from what both players' last few steps showed (each
// was shown in its replay), never onto the middle or a cell either dog has stood on.
const own = (pm, p) => (pm.dogs ? { dog: pm.dogs[p], trail: pm.trails.X.concat(pm.trails.O), not: [SNIFF_MID].concat(pm.paths.X, pm.paths.O) } : pm);

export function needs(pm, p) {   // the steps to the nearest cell it may be in (diagonals count one), and what is still unknown
  pm = own(pm, p);
  const c = sniffCands(pm), d = c.length ? Math.min(...c.map(x => sniffSteps(pm.dog, x))) : 1; return Math.max(1, d + Math.log2(Math.max(1, c.length)) * 0.8);
}
export function best(pm, me, rng, style, ctx) {
  const miss = tune(pm).miss || 0;                               // (the admin's mistake rate: a step any way)
  if (miss && rng() * 100 < miss) { const ds = sniffDirs(own(pm, me).dog); return { move: ds[randInt(rng, ds.length)], q: 0, shared: !pm.dogs }; }
  const b = sniffPick(own(pm, me), rng); return { move: b.move, q: b.q, shared: !pm.dogs };   // (Super Chaos: its step walks its own dog only)
}
