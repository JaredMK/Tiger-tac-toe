// Plinko: the computer's play.
import { randInt } from '../../core/random.js';
import { tune } from '../../core/tune.js';
import { PLINKO, plinkoDist, plinkoExp, plinkoOpen } from './rules.js';

export function needs(pm, p) {
  const e = Array.from({ length: PLINKO.slots }, (_, k) => plinkoExp(pm, k)), best = Math.max(...plinkoOpen(pm).map(k => e[k])), mean = e.reduce((x, y) => x + y, 0) / e.length; return Math.max(1, (pm.target - pm.pts[p]) / ((best + mean) / 2));
}
export function best(pm, me, rng, style, ctx) {   // the open slot with the most points to expect (the bonus peg counted); level, the likelier to finish
  const need = pm.target - pm.pts[me], q = k => Object.entries(plinkoDist(pm, k)).reduce((t, [v, c]) => t + (Number(v) >= need ? c : 0), 0);
  const miss = tune(pm).miss;
  if (miss && rng() * 100 < miss) { const open = plinkoOpen(pm), k = open[randInt(rng, open.length)]; return { move: k, q: q(k), exp: plinkoExp(pm, k) }; }   // (now and then, the admin's mistake rate, any open slot)
  let move = -1, top = -1, tq = -1;
  for (const k of plinkoOpen(pm)) { const e = plinkoExp(pm, k), qk = q(k); if (e > top + 1e-9 || (Math.abs(e - top) < 1e-9 && qk > tq)) { move = k; top = e; tq = qk; } }
  return { move, q: tq, exp: top };
}
