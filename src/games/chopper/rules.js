// Chopper: the rules (pure: no page, no clock; the server runs the same code).
import { RUNT } from '../shared/runner.js';
export { runnerCreate as create } from '../shared/runner.js';
export { runnerApply as apply } from '../shared/runner.js';
export { runnerPublicView as publicView } from '../shared/runner.js';
export { runnerMoveFlash as moveFlash } from '../shared/runner.js';

// Chopper: a cave in a sky h metres high. Held, the chopper climbs (up m/s² the other way to gravity),
// let go it drops (down), never faster than vmax either way. The cave's middle wanders (a point every
// seg metres, wander apart at most, smoothly joined); it is cave0 metres high at the start and narrows
// to cave1 at the target; each wall waves a little (wave metres). Blocks float in it (blocks: their
// heights, bw wide), always leaving at least room to fly past above or below. In the grace stretch the
// walls close in from the edges of the sky and touch nothing; before the first press, the chopper hovers.
// Along the cave Chopper counts k of its metres to every metre on the screen (the distance counter runs
// k times as fast, so a run gets k times as far, at the same speed and spacing to the eye): everything
// along the way (seg, bw, the chopper's box, the waves, the config's speed and gaps) is in those metres;
// across it (h, the heights) in plain ones.
export const CHOP = { k: 1.6, h: 10, up: 16, down: 15, vmax: 6.5, box: { w: 1.76, h: 0.6 }, art: 1.3, seg: 22.4, wander: 2.2, cave0: 7.6, cave1: 4.4, wave: 0.28, blocks: { small: 1.5, big: 2.4 }, bw: 2.08, room: 1.9, step: 1 / 240 };
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                           // a run that crashes after a short random distance
}
export function flashMs(f, winLen, won) {
  return RUNT.bar + RUNT.hold + (won ? 600 : 0);
}
