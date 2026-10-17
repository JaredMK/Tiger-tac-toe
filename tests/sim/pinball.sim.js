'use strict';
// Simulations: Pinball. Slow, so never part of npm test:
// npm run sim -- pinball
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

/* ===================================== Pinball ===================================== */
const PIN = P.PIN;
const segDist = (px, py, [x1, y1, x2, y2]) => { const dx = x2 - x1, dy = y2 - y1, u = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - x1 - u * dx, py - y1 - u * dy); };

test('pinball: no tunnelling — over many balls the ball is never inside a wall or a flipper and never leaves the table, at any step', () => {
  let worst = 0, steps = 0, guards = 0;
  for (let s = 0; s < 30; s++) {
    const rng = E.makeRng('tun' + s), w = P.pinNew(E.pinConfig(), [0, 0, 0, 0, 0, 0, 0]);
    let flip = { L: false, R: false };
    P.pinLaunch(w, rng());
    while (!w.over && w.t < 40) {
      if (rng() < 0.08) flip = { L: rng() < 0.5, R: rng() < 0.5 };
      P.pinRun(w, 1000 / 240, flip); steps++;
      const b = w.ball.position;
      assert.ok(b.x >= 0 && b.x <= PIN.w && b.y >= 0 && b.y <= PIN.h + 5, 'on the table');
      for (const seg of P.PIN_WALLS) worst = Math.max(worst, seg[4] / 2 + PIN.ballR - segDist(b.x, b.y, seg));
      for (const side of ['L', 'R']) worst = Math.max(worst, PIN.ballR + PIN.flip.thick / 2 * 0.65 - segDist(b.x, b.y, P.pinFlipLine(side, w.flip[side].a)) - 0.9);   // (the capsule thins to its tip)
      if (!w.inPlay && !w.over) P.pinLaunch(w, rng());
    }
    guards += w.events.filter(e => e.k === 'guard').length;
  }
  assert.ok(steps > 10000);
  assert.ok(worst < 0.9, `never more than a little into a wall or a flipper (deepest ${worst.toFixed(2)} units; the ball is ${PIN.ballR * 2} across)`);
  assert.equal(guards, 0, 'the table\'s last-resort guard never needed');
});
test('pinball: every touch of a target counts (and only a real touch: never through a wall), at every size the settings allow', () => {
  for (const size of [0.6, 1, E.pinConfig().size, E.PINB_LIMITS.size[1]]) {
    const cfg = Object.assign(E.pinConfig(), { size });
    for (const t of PIN.targets) {
      if (t.spin) continue;
      const r = t.r * size;
      for (const seg of P.PIN_WALLS.slice(8)) {   // a target may sit against a wall, but never pokes out of its far side (the outside's far side is off the table)
        const d = segDist(t.x, t.y, seg);
        if (d < r + seg[4] / 2) assert.ok(d + seg[4] / 2 >= r - 1e-9 || d <= seg[4] / 2, `target ${t.id} at size ${size} pokes through a wall`);
      }
    }
    let missed = 0, touches = 0;
    for (let s = 0; s < 12; s++) {
      const r = P.pinAi(cfg, [0, 0, 0, 0, 0, 0, 0], E.makeRng('reg' + size + s)), lit = {};
      for (const [id, t] of r.result.hits) lit[id] = t;
      void r;
      touches += r.result.hits.length;
    }
    for (let s = 0; s < 6; s++) {   // the ball's every step: a ball overlapping an unlit target lights it in that step
      const w = P.pinNew(cfg, [0, 0, 0, 0, 0, 0, 0]), rng = E.makeRng('step' + size + s);
      P.pinLaunch(w, rng());
      while (!w.over && w.t < 30) {
        const flip = { L: rng() < 0.3, R: rng() < 0.3 };
        P.pinRun(w, 1000 / 480, flip);
        const b = w.ball.position;
        for (const t of PIN.targets) {
          const [x, y] = t.spin ? P.pinSpinAt(w.t, cfg) : [t.x, t.y];
          if (Math.hypot(b.x - x, b.y - y) < t.r * size + PIN.ballR - 0.05 && !w.lit[t.id]) missed++;
        }
        if (!w.inPlay && !w.over) P.pinLaunch(w, rng());
      }
    }
    assert.equal(missed, 0, `size ${size}: no touch missed`);
    assert.ok(touches > 0);
  }
  for (let k = 0; k <= 10; k++) {                                  // a launch never lights anything through the lane's wall
    const w = P.pinNew({ size: E.PINB_LIMITS.size[1] }, [0, 0, 0, 0, 0, 0, 0]);
    P.pinLaunch(w, k / 10);
    while (!w.over && w.t < 3 && w.ball.position.x > 86) { P.pinRun(w, 1000 / 60, {}); if (w.ball.position.x > 88.5) assert.deepEqual(w.hits, [], 'nothing lit from the plunger lane'); }
  }
});
test('pinball: a ball nobody flips always drains (it never rests on the flippers or anywhere); a quick drain is saved', () => {
  const ends = {};
  for (let s = 0; s < 60; s++) {
    const rng = E.makeRng('pass' + s), w = P.pinNew(E.pinConfig(), [0, 0, 0, 0, 0, 0, 0]);
    P.pinLaunch(w, 0.2 + 0.8 * rng());
    while (!w.over) { P.pinRun(w, 1000 / 60, {}); if (!w.inPlay && !w.over) P.pinLaunch(w, 0.5); }
    const r = P.pinResult(w); ends[r.end] = (ends[r.end] || 0) + 1;
    assert.ok(r.ms < 60000, `drained in ${r.ms} ms`);
  }
  assert.ok(!ends.time, `no ball lasts for ever (${JSON.stringify(ends)})`);
  // a drain in the first seconds: served again (the same move goes on)
  const w = P.pinNew(E.pinConfig(), [0, 0, 0, 0, 0, 0, 0]);
  const M = require('matter-js');
  P.pinLaunch(w, 0.5); P.pinRun(w, 100, {});
  M.Body.setPosition(w.ball, { x: 45, y: PIN.drain - 1 }); M.Body.setVelocity(w.ball, { x: 0, y: 3 });
  for (let k = 0; k < 3; k++) P.pinRun(w, 50, {});
  assert.ok(w.events.some(e => e.k === 'save') && !w.over, 'saved');
});
test('pinball: played as a phone plays it (frames of uneven length, a relaunch at once after a save), the recording keeps time with the ball and passes the check', () => {
  let drift = 0;
  for (let s = 0; s < 40; s++) {
    const rng = E.makeRng('phone' + s), mini = E.newMini('pinball', rng), w = P.pinNew(mini.cfg, mini.lit.X);
    P.pinLaunch(w, rng());
    while (!w.over) { P.pinRun(w, 8 + rng() * 40, { L: rng() < 0.2, R: rng() < 0.2 }); if (!w.inPlay && !w.over) P.pinLaunch(w, rng()); }
    const r = P.pinResult(w), frames = r.rec.split(',').length;
    drift = Math.max(drift, Math.abs(frames - (r.ms / 1000) * PIN.fps));
    assert.equal(E.pinCheck(mini, 'X', { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end }), null, `ball ${s} passes`);
  }
  assert.ok(drift <= 1.01, `frame k at k/30 s (at most a frame out: ${drift.toFixed(2)})`);
});
