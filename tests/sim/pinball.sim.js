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
const inPoly = (p, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
const zeros = () => new Array(E.PINB.targets).fill(0);
const tipGap = () => { const [, , lx] = P.pinFlipLine(null, 'L', PIN.flip.rest), [, , rx] = P.pinFlipLine(null, 'R', PIN.flip.rest); return rx - lx; };

test('pinball: every spot of every layout is lit by the computer\'s hand (so any seven dealt can all be hit), and its balls drain between the flippers now and then', () => {
  let between = 0, drains = 0;
  for (let k = 0; k < P.PIN_LAYOUTS.length; k++) {
    const tb = P.pinAllSpots(k, E.pinConfig()), r = P.pinReach(tb, E.makeRng('reach' + k), 40);
    const unlit = tb.targets.filter(t => r.hits[t.id] < 2).map(t => `${t.name} (${r.hits[t.id]})`);
    assert.deepEqual(unlit, [], `${tb.name}: every spot lit, more than once, over ${r.balls} balls of a hand that never aims (${r.hits.join(',')})`);
    assert.ok(!r.ends.time, `${tb.name}: no ball lasts for ever (${JSON.stringify(r.ends)})`);
    const gapLo = PIN.flip.L[0] + PIN.flip.len * Math.cos(PIN.flip.rest), gapHi = PIN.flip.R[0] - PIN.flip.len * Math.cos(PIN.flip.rest);
    between += r.drains.filter(x => x > gapLo && x < gapHi).length; drains += r.drains.length;
    console.log(`  ${tb.name}: hits per spot ${r.hits.join(' ')}; ends ${JSON.stringify(r.ends)}; drains between the flippers ${r.drains.filter(x => x > gapLo && x < gapHi).length} of ${r.drains.length}`);
  }
  assert.ok(between >= drains * 0.08, `balls really drain between the flipper tips: ${between} of ${drains}`);
});
test('pinball: the lower table — the flippers low on the table, a gap of about a ball and a half between their tips at rest, guides above each, the table enclosed with the one-way gate: the ball never leaves the screen, never gets stuck, and never rests in a wall or a flipper', () => {
  const gap = tipGap() - PIN.ballR * 0;   // (the tips' centres; the flipper's tip is thin)
  assert.ok(PIN.flip.L[1] > PIN.h - 20, `the flippers sit at the bottom (pivots at y ${PIN.flip.L[1]} of ${PIN.h})`);
  assert.ok(gap - PIN.flip.thick * 0.65 > PIN.ballR * 2 * 1.2 && gap - PIN.flip.thick * 0.65 < PIN.ballR * 2 * 1.9, `a drain gap of about a ball and a half between the tips (${(gap - PIN.flip.thick * 0.65).toFixed(1)} units clear, a ball is ${PIN.ballR * 2})`);
  let worst = 0, steps = 0, guards = 0, lanes = 0;
  for (let s = 0; s < 42; s++) {
    const k = s % P.PIN_LAYOUTS.length, mini = E.newMini('pinball', E.makeRng('tun' + s)), tb = P.pinTable(Object.assign({}, mini, { table: { k, t: mini.table.t.map(i => i % P.PIN_LAYOUTS[k].spots.length) } }));
    const rng = E.makeRng('tun' + s), w = P.pinNew(tb, E.pinConfig(), zeros());
    let flip = { L: false, R: false };
    P.pinLaunch(w, rng());
    while (!w.over && w.t < 40) {
      if (rng() < 0.08) flip = { L: rng() < 0.5, R: rng() < 0.5 };
      P.pinRun(w, 1000 / 240, flip); steps++;
      const b = w.ball.position;
      assert.ok(b.x >= 0 && b.x <= PIN.w && b.y >= 0 && b.y <= PIN.h + 5, 'on the table');
      assert.ok(inPoly([b.x, b.y], tb.outer) || b.y > PIN.drain, `inside the outline at (${b.x.toFixed(1)},${b.y.toFixed(1)})`);
      for (const seg of tb.walls) worst = Math.max(worst, seg[4] / 2 + PIN.ballR - segDist(b.x, b.y, seg));
      for (const side of ['L', 'R']) worst = Math.max(worst, PIN.ballR + PIN.flip.thick / 2 * 0.65 - segDist(b.x, b.y, P.pinFlipLine(tb, side, w.flip[side].a)) - 0.9);   // (the capsule thins to its tip)
      if (w.gateOn && w.inPlay && b.x > PIN.lane.x0 + PIN.ballR && b.y > PIN.lane.top + 2 && b.y < PIN.lane.serve[1] - 2) lanes++;   // (never back in the lane through a shut gate)
      if (!w.inPlay && !w.over) P.pinLaunch(w, rng());
    }
    guards += w.events.filter(e => e.k === 'guard').length;
  }
  assert.ok(steps > 10000);
  assert.ok(worst < 0.9, `never more than a little into a wall or a flipper (deepest ${worst.toFixed(2)} units; the ball is ${PIN.ballR * 2} across)`);
  assert.equal(guards, 0, 'the table\'s last-resort guard never needed');
  assert.equal(lanes, 0, 'the gate keeps a ball from falling back into the lane');
});
test('pinball: every touch of a target counts (and only a real touch: never through a wall), at every size the settings allow', () => {
  for (const size of [0.6, 1, E.pinConfig().size, E.PINB_LIMITS.size[1]]) {
    const cfg = Object.assign(E.pinConfig(), { size });
    let missed = 0, touches = 0;
    for (let k = 0; k < P.PIN_LAYOUTS.length; k++) {
      const tb = P.pinAllSpots(k, cfg);
      for (let s = 0; s < 3; s++) touches += P.pinAi(tb, cfg, tb.targets.map(() => 0), E.makeRng('reg' + size + k + s)).result.hits.length;
      for (let s = 0; s < 2; s++) {   // the ball's every step: a ball overlapping an unlit target lights it in that step
        const w = P.pinNew(tb, cfg, tb.targets.map(() => 0)), rng = E.makeRng('step' + size + k + s);
        P.pinLaunch(w, rng());
        while (!w.over && w.t < 30) {
          const flip = { L: rng() < 0.3, R: rng() < 0.3 };
          P.pinRun(w, 1000 / 480, flip);
          const b = w.ball.position;
          for (const t of tb.targets) {
            const [x, y] = t.spin ? P.pinSpinAt(t, w.t, cfg) : [t.x, t.y];
            if (Math.hypot(b.x - x, b.y - y) < t.r + PIN.ballR - 0.05 && !w.lit[t.id]) missed++;
          }
          if (!w.inPlay && !w.over) P.pinLaunch(w, rng());
        }
      }
    }
    assert.equal(missed, 0, `size ${size}: no touch missed`);
    assert.ok(touches > 0);
  }
  for (let k = 0; k <= 10; k++) {                                  // a launch never lights anything through the lane's wall
    const tb = P.pinAllSpots(k % P.PIN_LAYOUTS.length, Object.assign(E.pinConfig(), { size: E.PINB_LIMITS.size[1] })), w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0));
    P.pinLaunch(w, k / 10);
    while (!w.over && w.t < 3 && w.ball.position.x > 86) { P.pinRun(w, 1000 / 60, {}); if (w.ball.position.x > 88.5) assert.deepEqual(w.hits, [], 'nothing lit from the plunger lane'); }
  }
});
test('pinball: a ball nobody flips always drains (it never rests on the flippers or anywhere); a quick drain is saved', () => {
  const ends = {};
  for (let s = 0; s < 60; s++) {
    const rng = E.makeRng('pass' + s), tb = P.pinAllSpots(s % P.PIN_LAYOUTS.length, E.pinConfig()), w = P.pinNew(tb, E.pinConfig(), tb.targets.map(() => 0));
    P.pinLaunch(w, 0.2 + 0.8 * rng());
    while (!w.over) { P.pinRun(w, 1000 / 60, {}); if (!w.inPlay && !w.over) P.pinLaunch(w, 0.5); }
    const r = P.pinResult(w); ends[r.end] = (ends[r.end] || 0) + 1;
    assert.ok(r.ms < 60000, `drained in ${r.ms} ms`);
  }
  assert.ok(!ends.time, `no ball lasts for ever (${JSON.stringify(ends)})`);
  // a drain in the first seconds: served again (the same move goes on)
  const tb = P.pinAllSpots(0, E.pinConfig()), w = P.pinNew(tb, E.pinConfig(), tb.targets.map(() => 0));
  const M = require('matter-js');
  P.pinLaunch(w, 0.5); P.pinRun(w, 100, {});
  M.Body.setPosition(w.ball, { x: 45, y: PIN.drain - 1 }); M.Body.setVelocity(w.ball, { x: 0, y: 3 });
  for (let k = 0; k < 3; k++) P.pinRun(w, 50, {});
  assert.ok(w.events.some(e => e.k === 'save') && !w.over, 'saved');
});
test('pinball: played as a phone plays it (frames of uneven length, a relaunch at once after a save), the recording keeps time with the ball and passes the check', () => {
  let drift = 0;
  for (let s = 0; s < 40; s++) {
    const rng = E.makeRng('phone' + s), mini = E.newMini('pinball', rng), w = P.pinNew(P.pinTable(mini), mini.cfg, mini.lit.X);
    P.pinLaunch(w, rng());
    while (!w.over) { P.pinRun(w, 8 + rng() * 40, { L: rng() < 0.2, R: rng() < 0.2 }); if (!w.inPlay && !w.over) P.pinLaunch(w, rng()); }
    const r = P.pinResult(w), frames = r.rec.split(',').length;
    drift = Math.max(drift, Math.abs(frames - (r.ms / 1000) * PIN.fps));
    assert.equal(E.pinCheck(mini, 'X', { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end }), null, `ball ${s} passes`);
  }
  assert.ok(drift <= 1.03, `frame k at k/30 s (at most a frame out, and the move's time rounded to the millisecond: ${drift.toFixed(2)})`);
});
