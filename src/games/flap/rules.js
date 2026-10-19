// Flap: the rules (pure: no page, no clock; the server runs the same code).
import { RUNT, runJump } from '../shared/runner.js';
export { runnerCreate as create } from '../shared/runner.js';
export { runnerApply as apply } from '../shared/runner.js';
export { runnerPublicView as publicView } from '../shared/runner.js';
export { runnerMoveFlash as moveFlash } from '../shared/runner.js';

// Flap: a sky h metres high. A tap sets the bird climbing at vy; gravity g pulls it down; the ceiling
// stops it, the ground (past the grace stretch) is a crash. Posts post metres wide, each with a gap of
// the mix's size (gaps: metres), its middle at most shift metres from the last one's and never nearer
// than margin to the ground or the sky. Before the first tap, in the grace stretch, the bird holds its
// height. The box is a touch smaller than the art.
export const FLAP = { h: 10, g: 30, vy: 8.6, box: { w: 0.7, h: 0.56 }, art: 0.95, post: 1.3, gaps: { wide: 3.7, mid: 3.2, narrow: 2.8 }, shift: 2.6, margin: 1.0, step: 1 / 240 };
// The computer's bird (runPilot's hand): it aims a little below the middle of the next gap (a touch
// above or below that, drawn afresh at every flap) and flaps, looking every frame, whenever it is below
// its aim and not already climbing (so it bobs between the aim and a flap's height above it, well
// inside the narrowest gap). At `plan` (the post it is to crash at) it aims a metre above the gap
// instead and flies into the upper post.
export function flapPilot(sim, plan, rng) {
  const course = sim.course, off = Math.floor(rng() * 4);
  let k = 0, bias = 0;
  return () => {
    if (sim.n % 4 !== off) return;                                           // (a thumb: 60 times a second)
    while (k < course.length && course[k].at + FLAP.post <= sim.d - FLAP.box.w / 2) k++;   // the posts passed
    const o = course[k], want = !o ? FLAP.h / 2 : o === plan ? o.gy + o.gh / 2 + 1 : o.gy - o.gh * 0.12 + bias;
    if ((sim.y < want || !sim.flown) && sim.vy < 1.5 && runJump(sim)) bias = (rng() - 0.5) * 0.3;   // (the first flap at once: until it the bird holds its height, and the first gap may be well below)
  };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                           // a run that crashes after a short random distance
}
export function flashMs(f, winLen, won) {
  return RUNT.bar + RUNT.hold + (won ? 600 : 0);
}
