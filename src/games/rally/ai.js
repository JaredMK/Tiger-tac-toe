// Road Race: the computer's play. It drives the attempt itself, in the same steps (rules.js rallyDrive), from where it
// got to on this lap (rallyFrom): it steers for a point of the centre line a little ahead, turning the wheel no faster
// than a hand does, and now and then its attention lapses for a while (`aiLapse` times in a hundred seconds on
// average, by level) and the wheel stays where it was: into a bend, or out of one, that is a crash. Never a perfect
// driver: its lapses stand in for a player's.
import { rallyCfg, rallyDrive, rallyFrom, rallyTrack } from './rules.js';

const lapseOf = (c, level) => (c.ai[level] == null ? c.ai.normal : c.ai[level]) / 100;
// (measured at Normal, tests/sim/rally.sim.js: CRASH the crashes in a lap's worth of road, a v 3 square; PER the
// attempts a lap takes on a v 2 square, every attempt from the line, and WHOLE the share of those that come round)
const AI_RALLY = { CRASH: 1.0, PER: 2.7, WHOLE: 0.37 };
const leftOf = (pm, p) => { const c = rallyCfg(pm), left = c.laps - pm.laps[p]; if (left <= 0) return { left: 0, road: 0 }; const n = rallyTrack(pm).n, got = Math.min(Math.max(rallyFrom(pm, p), 0), n - 1) / n; return { left, road: left - got }; };
// The turns still needed: one for each lap still to come round (an attempt ends at the line), and one for each crash
// to expect on the road still to drive (a v 2 square: the laps left over the share of attempts that come round).
export function needs(pm, p) { const { left, road } = leftOf(pm, p); return left <= 0 ? 0 : pm.v === 3 ? left + AI_RALLY.CRASH * road : left * AI_RALLY.PER; }
export function best(pm, me, rng, style, ctx) {
  const c = rallyCfg(pm), level = (ctx && ctx.level) || 'normal', d = rallyDrive(c, rallyTrack(pm), rng, lapseOf(c, level), rallyFrom(pm, me)), { left, road } = leftOf(pm, me);
  return { move: { log: d.log, steps: d.steps }, q: left !== 1 ? 0 : pm.v === 3 ? Math.exp(-AI_RALLY.CRASH * road) : AI_RALLY.WHOLE };   // (q: the chance this turn takes the square)
}
