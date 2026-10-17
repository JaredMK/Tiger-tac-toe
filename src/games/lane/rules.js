// Lane Rush: the rules (pure: no page, no clock; the server runs the same code).
import { shuffle } from '../../core/random.js';
import { RUNT, runCourse, runLane, runStart, runStep } from '../shared/runner.js';
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
// The computer's Lane Rush run as a screen shows it. It has no recording (its move is only where the run
// ended), so a driver who sees the whole road takes an open lane at every row before the one the run ended
// at, then stays in, or moves into, a lane blocked there; a finished run drives to the line. When that row
// cannot be reached in a blocked lane (the row before blocks the same lane, or two lanes over in a blink),
// the crash is at a row up to 30 m before it (under a second). Stepped at a fixed LANE.step, so a page
// replaying the lane changes at their times drives exactly this. Returns the changes ([{ t, dir }], seconds
// into the run), the run's length in seconds and the row crashed into; null when no such drive is found.
export function laneDrive(mini, p, from, to, done) {
  const m = Object.assign({}, mini, { dist: Object.assign({}, mini.dist, { [p]: from }) });
  const rows = runCourse(m, p), last = done ? null : rows.find(o => Math.abs(o.at + 0.2 - to) < 0.02);
  if (!done && !last) return null;
  const tries = done ? [null] : rows.filter(o => o.at <= last.at && o.at >= last.at - 30).reverse();
  for (const end of tries) {
    const sim = runStart(m, p), steps = [], open = r => [0, 1, 2].filter(l => !r.cars[l]);
    while (!sim.crash && !sim.done && sim.t < 180) {
      const cur = Math.round(sim.lane), ahead = rows.filter(o => o.at > sim.d), r0 = ahead[0], r1 = ahead[1];
      if (sim.laneT >= 1 && !rows.some(o => o !== end && Math.abs(o.at - sim.d) < LANE.box + 0.6)) {   // (no change beside a row; into the last row's car, however close)
        let want = cur;
        if (r0 && r0 === end) want = r0.cars[cur] ? cur : [0, 1, 2].filter(l => r0.cars[l]).sort((x, y) => Math.abs(x - cur) - Math.abs(y - cur))[0];
        else if (r0) {
          const nx = !r1 ? null : r1 === end ? [0, 1, 2].filter(l => r1.cars[l]) : open(r1), cost = l => Math.abs(l - cur) * 10 + (nx ? Math.min(...nx.map(q => Math.abs(q - l))) : 0);   // (before the last row: lined up with one of its cars)
          want = open(r0).sort((x, y) => cost(x) - cost(y))[0];
        }
        if (want !== cur && runLane(sim, want > cur ? 1 : -1)) steps.push({ t: sim.t, dir: want > cur ? 1 : -1 });
      }
      runStep(sim, LANE.step);
    }
    if (done ? sim.done : sim.crash && sim.crash.ob && sim.crash.ob.at === end.at) return { steps, secs: sim.t, row: end && end.at };   // (into that row's car, from behind or the side)
  }
  return null;
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                           // a run that crashes after a short random distance
}
export function flashMs(f, winLen, won) {
  return RUNT.bar + RUNT.hold + (won ? 600 : 0);
}
