// Lane Rush: the rules (pure: no page, no clock; the server runs the same code).
import { shuffle } from '../../core/random.js';
import { RUNT, runLane } from '../shared/runner.js';
export { runnerCreate as create } from '../shared/runner.js';
export { runnerApply as apply } from '../shared/runner.js';
export { runnerPublicView as publicView } from '../shared/runner.js';
export { runnerMoveFlash as moveFlash } from '../shared/runner.js';

// Lane Rush: three lanes; a lane change takes switchSecs; the cars (the player's and the traffic's) are
// art metres long with a box that much shorter; two cars collide when their lanes are within laneHit.
export const LANE = { lanes: 3, switchSecs: 0.22, art: 2.2, box: 2.0, laneHit: 0.72, step: 1 / 240 };
// A row of traffic: one or two cars (the mix), in lanes drawn at random, so traffic comes in every lane;
// always a lane open, and never more than a lane over from any lane open in the row before (at speed a row
// comes on screen too late for two changes). When the car has to move over, the row is placed far enough
// down the road for it (laneNeed: LANE_TIGHT seconds at least); when it need not, any gap will do. (The
// rows were once kept passable by choosing the lanes alone: with rows closer than a lane change, every
// lane open before had to stay open, and the traffic locked into one lane.)
export const LANE_TIGHT = 0.6, LANE_NEAR = 1.1;                         // seconds between two rows: a change of one lane, of two
export function laneRow(k, prev, rng) {
  for (let tries = 0; tries < 40; tries++) {
    const cars = [false, false, false];
    shuffle([0, 1, 2], rng).slice(0, k === 'two' ? 2 : 1).forEach(l => { cars[l] = true; });
    if (!prev || laneNeed(prev, cars) <= LANE_TIGHT) return cars;
  }
  return prev.map(c => c);                                        // (the same row again: nothing to change)
}
// The time a row needs after the one before: from any lane open there, the nearest open one in this row.
export function laneNeed(prev, cars) {
  const open = [0, 1, 2].filter(l => !cars[l]);
  let m = 0;
  for (const q of [0, 1, 2].filter(l => !prev[l])) m = Math.max(m, Math.min(...open.map(o => Math.abs(o - q))));
  return m === 0 ? 0 : m === 1 ? LANE_TIGHT : LANE_NEAR;
}
// The computer's driver (runPilot's hand): a driver who sees the whole road takes an open lane at every
// row (the nearest, and of those the one lined up with the row after), moving over as soon as it is
// past the row before (never beside a row: a change there is a crash into its car) and a few frames of
// thought later. At `plan` (the row it is to crash at) and from there on, it stays in, or moves into, a
// lane blocked there, into the car however close: at the plan row when that lane is within reach from
// the row before, else at one of the next.
export function lanePilot(sim, plan, rng) {
  const rows = sim.course, open = r => [0, 1, 2].filter(l => !r.cars[l]), blocked = r => [0, 1, 2].filter(l => r.cars[l]), pk = plan ? rows.indexOf(plan) : Infinity;
  let k = 0, lk = -1, wait = 0;
  return () => {
    while (k < rows.length && rows[k].at <= sim.d) k++;                      // the rows passed
    const r0 = rows[k], r1 = rows[k + 1], cur = Math.round(sim.lane), failing = k >= pk;
    if (k !== lk) { lk = k; wait = failing ? 0 : sim.t + 0.02 + rng() * 0.07; }   // (the thought before the next change; none when it means to crash)
    if (!r0 || sim.laneT < 1 || sim.t < wait) return;
    if (rows.some(o => !(failing && o === r0) && Math.abs(o.at - sim.d) < LANE.box + 0.6)) return;   // (no change beside a row; into the plan row's car, however close)
    let want = cur;
    if (failing) want = r0.cars[cur] ? cur : blocked(r0).sort((x, y) => Math.abs(x - cur) - Math.abs(y - cur))[0];
    else {
      const nx = !r1 ? null : k + 1 >= pk ? blocked(r1) : open(r1), cost = l => Math.abs(l - cur) * 10 + (nx ? Math.min(...nx.map(q => Math.abs(q - l))) : 0);   // (before the plan row: lined up with one of its cars)
      want = open(r0).sort((x, y) => cost(x) - cost(y))[0];
    }
    if (want !== cur) runLane(sim, want > cur ? 1 : -1);
  };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                           // a run that crashes after a short random distance
}
export function flashMs(f, winLen, won) {
  return RUNT.bar + RUNT.hold + (won ? 600 : 0);
}
