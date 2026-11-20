// Road Race: the computer's play. It drives the attempt itself, in the same steps (rules.js rallyDrive): it makes for
// the middle of the road a little ahead and, a few times a lap, its attention lapses for a while (`aiLapse` times a
// second on average, by level) and its finger stays where it was: on a bend that is a crash.
import { rallyCfg, rallyDrive, rallyTrack } from './rules.js';

export function needs(pm, p) { const c = rallyCfg(pm), left = c.laps - pm.laps[p]; return left <= 0 ? 0 : left * 2.3; }
export function best(pm, me, rng, style, ctx) {
  const c = rallyCfg(pm), level = (ctx && ctx.level) || 'normal', d = rallyDrive(c, rallyTrack(pm, me), rng, (c.ai[level] == null ? c.ai.normal : c.ai[level]) / 100);
  return { move: { log: d.log, steps: d.steps }, q: c.laps - pm.laps[me] === 1 ? 0.4 : 0 };
}
