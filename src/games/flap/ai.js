// Flap: the computer's play.
import { runAi, runNeeds } from '../shared/runner.js';
import { tune } from '../../core/tune.js';

export function needs(pm, p) {
  return runNeeds(pm.cfg, pm.dist[p]);
}
// Each level its own runs (TUNE, Computer: Easy / Normal / Hard): about how many runs it takes to finish (shorter runs
// for more) and how much a run's length varies. Normal keeps the old keys (aiRuns, aiSpread), so a square dealt before
// plays as it did; Easy and Hard read aiRunsEasy/aiSpreadEasy and aiRunsHard/aiSpreadHard.
export function runLevel(pm, level) {
  const t = tune(pm), L = level === 'easy' ? 'Easy' : level === 'hard' ? 'Hard' : '';
  if (!L) return pm;
  const runs = t['aiRuns' + L], spread = t['aiSpread' + L];
  return Object.assign({}, pm, { cfg: Object.assign({}, pm.cfg, runs != null ? { aiRuns: runs } : null, spread != null ? { aiSpread: spread } : null) });
}
export function best(pm, me, rng, style, ctx) {
  return runAi(runLevel(pm, ctx && ctx.level), me, rng);       // a run drawn to finish in about the level's runs
}
