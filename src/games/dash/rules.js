// Dash: the rules (pure: no page, no clock; the server runs the same code).
import { RUNT } from '../shared/runner.js';
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
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                           // a run that crashes after a short random distance
}
export function flashMs(f, winLen, won) {
  return RUNT.bar + RUNT.hold + (won ? 600 : 0);
}
