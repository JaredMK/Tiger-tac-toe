// Pool: the computer's play.
import { physAi, physNeeds } from '../shared/physics.js';

export function needs(pm, p) {
  return physNeeds(pm, p);
}
import { tune } from '../../core/tune.js';
const num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
// By level: its aim and power error (Easy aiAimEasy / aiPowEasy, Normal aiAim / aiPow, Hard aiAimHard / aiPowHard).
export function best(pm, me, rng, style, ctx) {
  const lv = ctx && ctx.level, t = tune(pm);
  if (lv === 'easy' || lv === 'hard') { const E = lv === 'easy' ? 'Easy' : 'Hard'; pm = Object.assign({}, pm, { tune: Object.assign({}, pm.tune, { aiAim: num(t['aiAim' + E], lv === 'easy' ? 45 : 5), aiPow: num(t['aiPow' + E], lv === 'easy' ? 6 : 1) }) }); }
  return physAi(pm, me, rng);   // the best of its candidate shots, with a little error
}
