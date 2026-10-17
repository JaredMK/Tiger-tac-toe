// Flap: the rules (pure: no page, no clock; the server runs the same code).
import { RUNT } from '../shared/runner.js';
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
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                           // a run that crashes after a short random distance
}
export function flashMs(f, winLen, won) {
  return RUNT.bar + RUNT.hold + (won ? 600 : 0);
}
