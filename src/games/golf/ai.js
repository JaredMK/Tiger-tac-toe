// Mini Golf: the computer's play.
import { physAi, physNeeds } from '../shared/physics.js';
import { tune } from '../../core/tune.js';

export function needs(pm, p) {
  return physNeeds(pm, p);
}
// Each level its own hand (TUNE, Computer: Easy / Normal / Hard): its aim error (thousandths of a radian) and its power
// error (%). Normal keeps the keys from before the levels (aiAim, aiPow); Easy and Hard read aiAimEasy/aiPowEasy and
// aiAimHard/aiPowHard. The shot it picks is the same; how well it strikes it is the level's.
export function golfLevel(pm, level) {
  const L = level === 'easy' ? 'Easy' : level === 'hard' ? 'Hard' : '';
  if (!L) return pm;
  const t = tune(pm);
  return Object.assign({}, pm, { tune: Object.assign({}, pm.tune, { aiAim: t['aiAim' + L], aiPow: t['aiPow' + L] }) });
}
export function best(pm, me, rng, style, ctx) {
  return physAi(golfLevel(pm, ctx && ctx.level), me, rng);   // the best of its candidate shots, struck with the level's error
}
