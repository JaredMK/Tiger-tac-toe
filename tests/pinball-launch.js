'use strict';
// Pinball's launch, measured: a square's table on a layout with seven spots dealt by an rng, and one
// launch at a power with no flipper input, run to its end and classified. Shared by the unit test
// (tests/games/pinball.test.js) and the launch simulation (tests/sim/pinball-launch.sim.js).
const E = require('./engine.js');
const P = require('./physics.js');
E.setPhysics(P);
const PIN = P.PIN;
const segDist = (px, py, [x1, y1, x2, y2]) => { const dx = x2 - x1, dy = y2 - y1, u = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - x1 - u * dx, py - y1 - u * dy); };
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
// A square's table on layout k with seven of its spots dealt by the rng.
function dealTable(k, rng, cfg) {
  const n = P.PIN_LAYOUTS[k].spots.length, idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return P.pinTable({ cfg: cfg || E.pinConfig(), table: { k, t: idx.slice(0, E.PINB.targets) } });
}
// One launch at a power, no flippers, to its first drain, save or fall-back (or the cap, 20 s): what
// became of it. end: 'played' (it touched a bumper, a slingshot or a target, or came down to the flippers,
// before it drained or was saved; or it was still bouncing about the bumpers at the cap), 'loopDrain'
// (drained or saved having touched nothing), 'fellBack' (too weak to leave the lane: served again),
// 'stuck' (it came to rest and had to be nudged, or had touched nothing for 3 s when the cap came).
// tunnel: a word when the ball was ever outside the outline, inside a wall, back in the lane through the
// shut gate, or caught by the last-resort guard; else null. entered: it touched something or reached the
// flippers. capped: still in play at the cap.
function launchTrial(tb, power, cap) {
  const w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)), F = tb.flip || PIN.flip;
  P.pinLaunch(w, power);
  let touched = false, flipZone = false, tunnel = null, lanes = 0, firstTouch = null, lastTouch = -1, end = null, capped = false;
  while (!w.over && w.t < (cap || 20)) {
    const evs = P.pinRun(w, 1000 / 240, {});
    for (const e of evs) {
      if (e.k === 'bump' || e.k === 'sling' || e.k === 'hit') { touched = true; lastTouch = e.t; if (firstTouch == null) firstTouch = e.t; }
      if (e.k === 'guard') tunnel = tunnel || 'the guard';
      if (e.k === 'nudge') end = end || 'stuck';
      if (e.k === 'lane') end = end || 'fellBack';
      if (e.k === 'save' || e.k === 'drain') end = end || (touched || flipZone ? 'played' : 'loopDrain');
    }
    const b = w.ball.position;
    if (w.inPlay) {
      if (!(inPoly([b.x, b.y], tb.outer) || b.y > PIN.drain)) tunnel = tunnel || `outside at (${b.x.toFixed(1)},${b.y.toFixed(1)})`;
      for (const seg of tb.walls) if (segDist(b.x, b.y, seg) < seg[4] / 2 + PIN.ballR - 0.3) tunnel = tunnel || `in a wall at (${b.x.toFixed(1)},${b.y.toFixed(1)})`;
      if (b.y < PIN.arc.cy && Math.hypot(b.x - PIN.arc.cx, b.y - PIN.arc.cy) > PIN.arc.r - PIN.arc.t / 2 - PIN.ballR + 0.3) tunnel = tunnel || `in the arch at (${b.x.toFixed(1)},${b.y.toFixed(1)})`;
      if (w.gateOn && b.x > PIN.lane.wall + 1.2 && b.y > PIN.lane.top + 2) lanes++;
      if (b.y > F.L[1] - 14 && b.x > F.L[0] - 9 && b.x < F.R[0] + 9) flipZone = true;   // down at the flippers (the inlanes and the flippers' sweep)
    }
    if (end) break;
  }
  if (!end) { capped = true; end = touched && w.t - lastTouch < 3 ? 'played' : 'stuck'; }
  if (lanes) tunnel = tunnel || 'back in the lane through the gate';
  return { end, touched, flipZone, firstTouch, tunnel, t: w.t, entered: touched || flipZone, capped, events: w.events };
}
// A launch with nobody flipping: does the ball go down an outlane before any flip could have reached it? Every 4
// steps once the ball is low, a copy of the table tries a flip of each flipper: the first that strikes the ball
// means the player had their chance ('reach'). Else what became of it: 'out' (an outlane, untouched: the table
// gives such a ball back, pinStep's save with `out`, and it is counted here all the same), 'mid' (between the
// flippers with no flip able to touch it), 'none' (still going at 25 s).
function launchUntouched(tb, power) {
  const w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)); w.cfg = Object.assign({}, w.cfg, { save: 0 });
  P.pinLaunch(w, power);
  for (let n = 0; !w.over && w.t < 25; n++) {
    if (w.inPlay && w.ball.position.y > 140 && w.ball.position.x < PIN.lane.wall && n % 4 === 0) for (const side of ['L', 'R']) { const c = P.pinCopy(w); c.flip[side].on = true; for (let i = 0; i < 40; i++) { P.pinStep(c, 1 / PIN.hz); if (c.flip[side].struck) return 'reach'; } }
    const n0 = w.events.length; P.pinStep(w, 1 / PIN.hz);
    if (w.events.slice(n0).some(e => e.k === 'save' && e.out)) return 'out';
  }
  const d = w.events.find(e => e.k === 'drain');
  return d ? (d.x < PIN.flip.L[0] - 8 || d.x > PIN.flip.R[0] + 8 ? 'out' : 'mid') : 'none';
}
module.exports = { dealTable, launchTrial, launchUntouched };
