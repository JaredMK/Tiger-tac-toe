// Dash: the computer's play.
import { runAi, runNeeds } from '../shared/runner.js';

export function needs(pm, p) {
  return runNeeds(pm.cfg, pm.dist[p]);
}
import { tune } from '../../core/tune.js';
const num = (v, d) => (v != null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : d);
// By level: the runs it takes to finish, about (aiRunsEasy / aiRuns / aiRunsHard: the square's cfg carries the ones
// changed from the defaults): a run drawn that long, then driven.
export function best(pm, me, rng, style, ctx) {
  const lv = ctx && ctx.level, t = Object.assign({}, tune(pm), pm.cfg), runs = lv === 'easy' ? num(t.aiRunsEasy, 6.5) : lv === 'hard' ? num(t.aiRunsHard, 3.2) : null;
  if (runs != null && pm.cfg) pm = Object.assign({}, pm, { cfg: Object.assign({}, pm.cfg, { aiRuns: runs }) });
  return runAi(pm, me, rng);       // a run drawn to finish in about 4-5 of them
}
