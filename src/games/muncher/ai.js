// Muncher: the computer's play. One move (a run), so `best` is the run its hand makes (rules.js munPilot: Normal decides
// every aiReact ms, keeps aiAvoid cells from a spook and forgets them aiLapse of the time; Hard decides every step,
// keeps three cells clear, looks where a spook is heading, and tries a few runs within its time, keeping the best).
// The run is worked out here in full, so q is exact: the square is won by this move or it is not.
import { munBestOf, munHand, munScore, munTarget } from './rules.js';

export const MUN_GAIN = 4;   // the dots a Normal run eats, about (a first run about 5, later ones fewer as the maze thins: tests/sim/muncher.sim.js)
export function needs(pm, p) {
  const left = munTarget(pm) - munScore(pm, p);
  return left <= 0 ? 0 : Math.max(1, left / MUN_GAIN);
}
export function best(pm, me, rng, style, ctx) {
  const hard = !!(ctx && ctx.level === 'hard'), until = ctx && ctx.until;
  const r = munBestOf(pm, me, rng, munHand(pm, hard ? 'hard' : 'normal'), hard ? 5 : 1, hard && until == null ? null : until);
  return { move: r.move, q: munScore(pm, me) + r.move.ate >= munTarget(pm) ? 1 : 0 };
}
