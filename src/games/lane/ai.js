// Lane Rush: the computer's play.
import { runAi, runNeeds } from '../shared/runner.js';

export function needs(pm, p) {
  return runNeeds(pm.cfg, pm.dist[p]);
}
export function best(pm, me, rng, style, ctx) {
  return runAi(pm, me, rng);       // a run drawn to finish in about 4-5 of them
}
