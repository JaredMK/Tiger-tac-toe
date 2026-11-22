// Road Race: the computer's play. It drives the attempt itself, in the same steps (rules.js rallyDrive): it steers for
// a point of the centre line a little ahead, turning the wheel no faster than a hand does, and now and then its
// attention lapses for a while (`aiLapse` times in a hundred seconds on average, by level) and the wheel stays where
// it was: into a bend, or out of one, that is a crash. Never a perfect driver: its lapses stand in for a player's.
import { rallyCfg, rallyDrive, rallyTrack } from './rules.js';

const lapseOf = (c, level) => (c.ai[level] == null ? c.ai.normal : c.ai[level]) / 100;
// The turns still needed: the laps left over the share of attempts that come round (measured, tests/sim/rally.sim.js:
// a little over a third at Normal).
export function needs(pm, p) { const c = rallyCfg(pm), left = c.laps - pm.laps[p]; return left <= 0 ? 0 : left * 2.7; }
export function best(pm, me, rng, style, ctx) {
  const c = rallyCfg(pm), level = (ctx && ctx.level) || 'normal', d = rallyDrive(c, rallyTrack(pm), rng, lapseOf(c, level));
  return { move: { log: d.log, steps: d.steps }, q: c.laps - pm.laps[me] === 1 ? 0.37 : 0 };
}
