// Muncher: the computer's play. One move (a run), so `best` is the run its hand makes (rules.js munPilot: Normal decides
// every aiReact ms, keeps aiAvoid cells from a spook and forgets them aiLapse of the time; Hard decides every other step,
// looks where a spook is heading, goes for a pellet when a spook closes in and after a frightened spook near enough,
// and tries a few runs within its time, keeping the one worth most). The run is worked out here in full, so q is
// exact: the square is won by this move or it is not.
import { munBestOf, munCfg, munHand, munScore, munTarget } from './rules.js';

export const MUN_GAIN = 9;   // the dots a Normal run gains, about (a first run more, later ones fewer as the maze thins: tests/sim/muncher.sim.js)
export function needs(pm, p) {
  const left = munTarget(pm) - munScore(pm, p);
  return left <= 0 ? 0 : Math.max(1, left / MUN_GAIN);
}
export function best(pm, me, rng, style, ctx) {
  const hard = !!(ctx && ctx.level === 'hard'), until = ctx && ctx.until;
  const r = munBestOf(pm, me, rng, munHand(pm, hard ? 'hard' : 'normal'), hard ? 5 : 1, hard && until == null ? null : until);
  return { move: r.move, q: munScore(pm, me) + r.move.ate + r.move.gh * munCfg(pm).ghostDots >= munTarget(pm) ? 1 : 0 };
}
