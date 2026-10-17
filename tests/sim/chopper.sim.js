'use strict';
// Simulations: Chopper. Slow, so never part of npm test:
// npm run sim -- chopper
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

// A planning Chopper pilot: every 1/30 s it tries hold-then-let-go and let-go-then-hold over the next second, keeps
// the one that stays furthest from the walls and blocks, and acts on it `react` s late (it knows its own lag), misjudging
// its height by up to `noise` m each time.
function planPilot(mini, react, noise, rng) {
  const C = E.CHOP, H = 1.0, dtp = 1 / 30;
  const room = (sim, x, y) => {
    const [f, c] = E.runWalls(sim, x), hh = C.box.h / 2;
    let m = Math.min(y - hh - f, c - (y + hh));
    for (const o of sim.course) {
      if (o.at > x + C.box.w) break;
      if (o.at + C.bw < x - C.box.w) continue;
      if (x + C.box.w / 2 > o.at && x - C.box.w / 2 < o.at + C.bw) m = Math.min(m, Math.max(o.y - (y + hh), (y - hh) - (o.y + o.bh)));
    }
    return m;
  };
  const fly = (y, vy, held, secs, out) => { for (let j = 0; j < Math.round(secs / (dtp / 4)); j++) { vy = Math.max(-C.vmax, Math.min(C.vmax, vy + (held ? C.up : -C.down) * dtp / 4)); y += vy * dtp / 4; } out.y = y; out.vy = vy; };
  const plan = (sim, y, vy, d, v) => {
    let best = null;
    for (const first of [true, false]) for (let k = 0; k <= 30; k += 2) {
      const p = { y, vy }; let m = Infinity;
      for (let s = 0; s < H / dtp && m >= -0.05; s++) { fly(p.y, p.vy, s < k ? first : !first, dtp, p); m = Math.min(m, room(sim, d + v * (s + 1) * dtp, p.y)); }
      if (!best || m > best.m) best = { m, hold: k > 0 ? first : !first };
    }
    return best.hold;
  };
  const sim = E.runStart(mini, 'X'), queue = [];
  E.runJump(sim); E.runRelease(sim);
  while (!sim.crash && !sim.done && sim.t < 400) {
    const v = E.runSpeed(sim.cfg, sim.d), p = { y: sim.y + (noise ? (rng() - 0.5) * 2 * noise : 0), vy: sim.vy };
    let held = sim.held, t = sim.t;
    for (const [at, h] of queue.concat([[sim.t + react, null]])) { fly(p.y, p.vy, held, Math.max(0, at - t), p); t = Math.max(t, at); if (h != null) held = h; }
    queue.push([sim.t + react, plan(sim, p.y, p.vy, sim.d + v * react, v)]);
    while (queue.length && queue[0][0] <= sim.t + 1e-9) { const [, h] = queue.shift(); if (h && !sim.held) E.runJump(sim); else if (!h && sim.held) E.runRelease(sim); }
    E.runStep(sim, dtp);
  }
  return sim;
}
// runs to the finish on each of `courses` squares (each run starts where the last crash was, as in the game)
function runsToFinish(over, react, noise, courses) {
  const out = [];
  for (let k = 0; k < courses; k++) {
    const mini = E.newMini('chopper', E.makeRng('pilot' + k)), rng = E.makeRng('noise' + k);
    mini.cfg = Object.assign({}, mini.cfg, over);
    let n = 0;
    while (mini.dist.X < mini.cfg.target && n < 40) { const sim = planPilot(mini, react, noise, rng); n++; mini.dist.X = Math.min(mini.cfg.target, sim.d); }
    out.push(n);
  }
  return out;
}

test('chopper: every course can be flown: a pilot with no lag finishes each in one run', () => {
  const runs = runsToFinish({}, 0, 0, 20);
  assert.ok(runs.every(n => n === 1), `runs per course: ${runs}`);
});

test('chopper, harder through the config: a typical pilot (0.25 s late, a little unsteady) takes 3 to 6 runs; on the old settings it took about 2', () => {
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const now = mean(runsToFinish({}, 0.25, 0.6, 30));
  assert.ok(now >= 3 && now <= 6, `${now.toFixed(2)} runs on average`);
  const before = mean(runsToFinish({ ramp: 0.9, gapMin: 35.2, gapMax: 64, mix: { none: 30, small: 45, big: 25 }, cave0: 7.6, cave1: 4.4 }, 0.25, 0.6, 30));
  assert.ok(before < 2.6, `old settings: ${before.toFixed(2)} runs`);
});
