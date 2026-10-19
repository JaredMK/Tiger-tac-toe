// Chopper: the rules (pure: no page, no clock; the server runs the same code).
import { RUNT, runJump, runRelease, runSpeed, runWalls } from '../shared/runner.js';
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
export const CHOP = { k: 1.6, h: 10, up: 16, down: 15, vmax: 6.5, box: { w: 1.76, h: 0.6 }, art: 1.3, seg: 22.4, wander: 2.2, cave0: 7.6, cave1: 4.4, wave: 0.28, blocks: { small: 1.5, big: 2.4 }, bw: 2.08, room: 1.9, step: 1 / 240, hand: { near: 0.45, far: 0.8, edge: 0.8 } };   // hand: the computer's pilot (chopPilot): how far ahead it looks, in seconds, and how close to a wall it will aim
// The computer's pilot (runPilot's hand): forty times a second it looks 0.6 s of flying ahead and aims
// at the middle of the corridor that is clear all that way: the highest floor and the lowest roof over
// it (every couple of metres), a block in it counting as a wall on its tighter side, so the way past is
// its roomier one. It holds when, letting go now, it would stop short of its aim, lets go when it would
// overshoot (a band of a few centimetres either way, drawn per run, keeps it from fluttering). From
// 0.3 s before `plan` (the distance it is to crash at) it lets go and stays let go: into the floor.
export function chopPilot(sim, plan, rng) {
  const course = sim.course, hw = CHOP.box.w / 2, off = Math.floor(rng() * 6), band = 0.08 + rng() * 0.08, above = new Map();
  const over = o => {                                                      // the way past a block: above it (true) or below, whichever has more room all the way past
    if (above.has(o)) return above.get(o);
    let f = -Infinity, c = Infinity;
    for (let x = o.at - CHOP.box.w; x <= o.at + CHOP.bw + CHOP.box.w; x += 0.5 * CHOP.k) { const w = runWalls(sim, x); f = Math.max(f, w[0]); c = Math.min(c, w[1]); }
    const up = c - (o.y + o.bh) >= o.y - f;
    above.set(o, up);
    return up;
  };
  let k = 0;
  return () => {
    if (sim.n % 6 !== off) return;
    if (!sim.flown) { runJump(sim); return; }                                 // the first press at once: until it the chopper hovers, and a block may be right where the grace stretch ends
    const v = runSpeed(sim.cfg, sim.d), d = sim.d;
    if (d >= plan - v * 0.3) { if (sim.held) runRelease(sim); return; }       // the dive
    while (k < course.length && course[k].at + CHOP.bw + hw < d) k++;         // the blocks passed
    const H = CHOP.hand, o = course[k], past = o ? o.at + CHOP.bw + hw : Infinity, far = d + v * H.far, near = o && o.at - hw <= d + v * H.near ? Math.max(past, d + v * H.near) : d + v * H.near;
    let F = -Infinity, C = Infinity, Fn = -Infinity, Cn = Infinity;         // the corridor over the whole look ahead, and the near one (the next 0.45 s, and the way past a block that close)
    for (let x = d; x <= far + 1e-9; x += 1.2 * CHOP.k) {
      let [f, c] = runWalls(sim, x);
      if (o && x >= o.at - hw && x <= past) { if (over(o)) f = Math.max(f, o.y + o.bh); else c = Math.min(c, o.y); }
      F = Math.max(F, f); C = Math.min(C, c);
      if (x <= near) { Fn = Math.max(Fn, f); Cn = Math.min(Cn, c); }
    }
    const m = Math.min(H.edge, (Cn - Fn) / 2), aim = Math.min(Cn - m, Math.max(Fn + m, (F + C) / 2));   // the middle of the whole corridor, kept well inside the near one (where the cave climbs or drops beyond, it waits at that side of the near one)
    const stop = sim.vy > 0 ? sim.vy * sim.vy / (2 * CHOP.down) : -sim.vy * sim.vy / (2 * CHOP.up);   // where it would come to rest, let go now (rising) or held now (falling)
    if (sim.y + stop < aim - band) { if (!sim.held) runJump(sim); }
    else if (sim.y + stop > aim + band && sim.held) runRelease(sim);
  };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';                           // a run that crashes after a short random distance
}
export function flashMs(f, winLen, won) {
  return RUNT.bar + RUNT.hold + (won ? 600 : 0);
}
