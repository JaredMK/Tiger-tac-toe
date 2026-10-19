'use strict';
// Lane Rush: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));
// Step a run until a condition holds (or it ends), in frames of 1/60 s.
function runUntil(sim, cond, max = 20000) { for (let k = 0; k < max && !sim.crash && !sim.done && !cond(sim); k++) E.runStep(sim, 1 / 60); return sim; }
const runOut = sim => runUntil(sim, () => false);

test('lane rush: rows of one or two cars, never a row fully blocked, and an open lane always within reach of the row before', () => {
  E.setRunConfig(null);
  for (let s = 0; s < 60; s++) {
    const m = mini('lane', 'lane' + s);
    for (const p of ['X', 'O']) {
      const rows = E.runCourse(m, p);
      assert.ok(rows.length > 15, 'a course of rows');
      let prev = null;
      for (const r of rows) {
        assert.equal(r.cars.length, 3);
        const open = [0, 1, 2].filter(l => !r.cars[l]);
        assert.ok(open.length >= 1 && open.length <= 2, 'one or two cars: at least one lane open');
        if (prev) assert.ok(E.runSecs(m.cfg, prev.at, r.at) >= E.laneNeed(prev.cars, r.cars), `row at ${r.at}: an open lane within reach of the row before in the time there is`);
        prev = r;
      }
      for (let k = 1; k < rows.length; k++) assert.ok(rows[k].at - rows[k - 1].at >= m.cfg.gapMin - 0.01, 'rows at least the minimum gap apart');
    }
  }
});

test('lane rush: the car drives on; a car ahead in its lane is a crash; a change into a car is a crash; a change away in time passes', () => {
  E.setRunConfig(null);
  const m = mini('lane', 'sim');
  const fresh = course => Object.assign(E.runStart(m, 'X'), { course, i: 0 });
  let sim = runOut(fresh([{ at: 50, cars: [false, true, false] }]));
  assert.ok(sim.crash && Math.abs(sim.crash.at - 50) < E.LANE.box + 0.1, `a crash at the car ahead (${sim.crash && sim.crash.at})`);
  sim = fresh([{ at: 50, cars: [false, true, false] }]);
  runUntil(sim, s => s.d >= 50 - 1.2 * E.runSpeed(s.cfg, s.d));
  assert.ok(E.runLane(sim, -1), 'a swipe left');
  runUntil(sim, s => s.d > 56);
  assert.ok(!sim.crash && sim.lane === 0, 'in the left lane, past the car');
  assert.ok(!E.runLane(sim, -1), 'no lane further left');
  sim = fresh([{ at: 50, cars: [true, false, false] }]);
  runUntil(sim, s => s.d >= 50 - 0.5 * E.runSpeed(s.cfg, s.d));
  E.runLane(sim, -1);
  runUntil(sim, s => s.d > 56);
  assert.ok(sim.crash, 'switching into a car is a crash');
  // a change takes LANE.switchSecs: the car is between lanes meanwhile
  sim = fresh([]); E.runLane(sim, 1); for (let k = 0; k < 6; k++) E.runStep(sim, E.LANE.switchSecs / 12);
  assert.ok(E.runLaneX(sim) > 1.3 && E.runLaneX(sim) < 1.7, `mid-change (${E.runLaneX(sim)})`);
  runUntil(sim, s => s.laneT >= 1); assert.equal(E.runLaneX(sim), 2);
  assert.ok(runOut(fresh([])).done, 'an empty course: the finish');
});

test('lane rush: the computer\'s driver gets through every course when it has no row to crash at, and crashes into a car of the row it is given (or, when no lane blocked there is within reach, one of the next)', () => {
  E.setRunConfig(null);
  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let at = 0, later = 0;
  for (let s = 1; s <= 40; s++) for (const f of [0, 0.35, 0.7]) {
    const m = mini('lane', 'driver' + s), from = Math.round(f * m.cfg.target); m.dist.X = from;
    const sim = E.runPilot(E.runStart(m, 'X'), null, lcg(s));
    assert.ok(sim.done, `course ${s} from ${from}: crashed at ${sim.crash && sim.crash.at}`);
    assert.ok(sim.rec.every(([n, c]) => Number.isInteger(n) && 'lL'.includes(c)), 'its lane changes logged');
    const s2 = E.runStart(m, 'X'), plan = s2.course[Math.min(s2.course.length - 1, 2 + (s % 4))];
    E.runPilot(s2, plan, lcg(s));
    assert.ok(s2.crash && s2.crash.ob.at >= plan.at, `it crashes when told to, at the row or past it (from ${from}: ${s2.crash && s2.crash.ob.at}, planned ${plan.at})`);
    if (s2.crash.ob === plan) at++; else { later++; assert.ok(s2.crash.ob.at - plan.at < 60, 'not far past it'); }
  }
  assert.ok(at > later * 10, `almost always the row itself (${at} there, ${later} later)`);
});
