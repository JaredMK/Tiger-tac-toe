// Dash: the rules (pure: no page, no clock; the server runs the same code).
import { RUNT, runJump, runRelease, runSpeed } from '../shared/runner.js';
export { runnerCreate as create } from '../shared/runner.js';
export { runnerApply as apply } from '../shared/runner.js';
export { runnerPublicView as publicView } from '../shared/runner.js';
export { runnerMoveFlash as moveFlash } from '../shared/runner.js';

// Dash's obstacles in metres (the runner is about a metre tall): width and height; a flyer's bottom
// edge is y above the ground, higher than the running runner and, being tall, in the way of any jump. Hitboxes are
// a touch smaller than the art (DASH.box, the 0.1 m shaved off each obstacle's sides).
export const DASH_OBS = { rock: { w: 1.0, h: 0.8 }, crate: { w: 1.2, h: 1.15 }, spike: { w: 0.9, h: 0.95 }, flyer: { w: 1.3, h: 2.0, y: 1.25 } };   // (a flyer: a column of birds from 1.25 m up, too tall for any jump)
// The jump: a press launches at vy; while held (up to holdMax seconds) gravity is gHold, after that g,
// so a tap peaks at about 1.5 m and a hold at about 2.3 m, in the air a little longer.
export const DASH = { g: 26, gHold: 10, vy: 8, holdMax: 0.25, box: { w: 0.6, h: 0.9 }, art: { w: 0.8, h: 1.0 }, shave: 0.1, step: 1 / 240 };
// The computer's runner (runPilot's hand): a tap (the press let go after 60 ms) a little before every
// ground hazard, the lead a stretch of running that grows with the speed (0.27 s of it, give or take a
// frame or two: a tap clears a crate from anywhere between 0.18 and 0.36 s before it, and the rest from
// wider still); a hold (the press kept past holdMax) 0.2 s before a pair, which clears both; on the
// ground under a flyer. At `plan` (the hazard it is to crash at; the first of a pair) and from there on,
// the opposite: no jump at a ground hazard, a jump straight into a flyer.
export function dashPilot(sim, plan, rng) {
  const course = sim.course;
  let k = 0, lk = -1, lead = 0, hold = 0, pk = plan ? course.indexOf(plan) : Infinity;
  if (plan && plan.pair === 2) pk -= 1;
  return () => {
    while (k < course.length && course[k].at + DASH_OBS[course[k].k].w < sim.d - 0.5) k++;   // the hazards passed
    if (sim.held && sim.holdT >= hold) runRelease(sim);
    const o = course[k];
    if (!o || sim.air) return;
    if (k !== lk) { lk = k; lead = o.pair === 1 ? 0.2 + (rng() - 0.5) * 0.03 : 0.27 + (rng() - 0.5) * 0.06; }   // this hazard's lead, drawn once
    const failing = k >= pk;
    if (o.k === 'flyer' ? !failing : failing) return;                    // a flyer is passed on the ground (jumped into when failing); a ground hazard jumped (not when failing)
    if (sim.d >= o.at - lead * runSpeed(sim.cfg, sim.d) && runJump(sim)) hold = o.pair === 1 ? DASH.holdMax + 0.05 : 0.06;
  };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                           // a run that crashes after a short random distance
}
export function flashMs(f, winLen, won) {
  return RUNT.bar + RUNT.hold + (won ? 600 : 0);
}
