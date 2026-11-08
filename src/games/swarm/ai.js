// Star Swarm: the computer's play. Its move is a whole run flown by the autopilot (rules.js swarmAi: Normal's
// hand is the square's settings, Hard's quicker and surer), recorded so it replays through the same view.
// What the main board's AI weighs the square by is the runs a side still needs (`needs`), from what a run
// gets on average (SW_GAIN, measured by tests/sim/swarm.sim.js).
import { swarmAi, swarmGoal } from './rules.js';

export const SW_GAIN = 16.2;   // points a run scores, about (the Normal computer; see the simulation)
export function needs(pm, p) {
  const goal = swarmGoal(pm), at = (pm.score && pm.score[p]) || 0;
  return Math.max(1, (goal - at) / SW_GAIN);
}
export function best(pm, me, rng, style, ctx) {
  const n = needs(pm, me), level = ctx && ctx.level === 'hard' ? 'hard' : 'normal';
  return { move: swarmAi(pm, me, rng, level).move, q: n <= 1 ? 0.6 : 0.35 / n };   // (q: as Sky Hop's: a rough chance of the square from how far there is to go)
}
