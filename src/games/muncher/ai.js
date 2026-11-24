// Muncher: the computer's play. One move (a run), so `best` is the run its hand makes (rules.js munPilot: Normal decides
// every aiReact ms, keeps aiAvoid cells from a spook and forgets them aiLapse of the time; Hard decides every other step,
// looks where a spook is heading, goes for a pellet when a spook closes in and after a frightened spook near enough,
// and tries a few runs within its time, keeping the one worth most; Easy's hand is slower and warier of nothing). Each
// level's hand is its settings (Computer: Easy / Normal / Hard). A run that would gain nothing is tried another way
// (munBestOf: the spooks leave the pen alike every run, so the same plan would be caught the same way for ever). The run is worked out here in full, so q is
// exact: the square is won by this move or it is not.
import { munBestOf, munCfg, munHand, munScore, munTarget } from './rules.js';
import { tune } from '../../core/tune.js';

export const MUN_GAIN = 9;   // the dots a Normal run gains, about (a first run more, later ones fewer as the maze thins: tests/sim/muncher.sim.js)
export function needs(pm, p) {
  const left = munTarget(pm) - munScore(pm, p);
  return left <= 0 ? 0 : Math.max(1, left / MUN_GAIN);
}
export function best(pm, me, rng, style, ctx) {
  const level = (ctx && ctx.level) || 'normal', hard = level === 'hard', until = ctx && ctx.until;
  const r = munBestOf(pm, me, rng, munHand(pm, level), hard ? Math.max(1, Number(tune(pm).aiTriesHard) || 5) : 1, hard && until == null ? null : until);
  return { move: r.move, q: munScore(pm, me) + r.move.ate + r.move.gh * munCfg(pm).ghostDots >= munTarget(pm) ? 1 : 0 };
}
