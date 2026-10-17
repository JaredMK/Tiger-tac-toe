'use strict';
// Simulations: Lane Rush. Slow, so never part of npm test:
// npm run sim -- lane
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('lane rush, harder again: half as fast again and about a third more cars, through the config, a lane always open; a driver seeing only the screen, a quarter-second late, still gets through', () => {
  E.setRunConfig(null);
  const cfg = E.runConfig('lane');
  assert.deepEqual([cfg.v0, cfg.ramp], [27, 2.7], 'half as fast again (18 to 27 m/s, the ramp likewise)');
  const count = c => { let cars = 0; for (let k = 0; k < 300; k++) { const m = mini('lane', 'traffic' + k); m.cfg = c; for (const o of E.runCourse(m, 'X')) cars += o.cars.filter(Boolean).length; } return cars / 300; };
  const ratio = count(cfg) / count({ target: 1000, v0: 18, ramp: 1.8, gapMin: 18.8, gapMax: 34.4, mix: { one: 55, two: 45 } });
  assert.ok(ratio > 1.25 && ratio < 1.5, `about a third more cars a course (x${ratio.toFixed(2)})`);
  // every row leaves a lane open, one the car can reach from wherever it passed the row before in the time there is
  for (let k = 0; k < 200; k++) {
    const m = mini('lane', 'reach' + k), rows = E.runCourse(m, 'X');
    rows.forEach((r, i) => {
      const open = [0, 1, 2].filter(l => !r.cars[l]); assert.ok(open.length >= 1, 'a lane open');
      if (!i) return;
      const was = [0, 1, 2].filter(l => !rows[i - 1].cars[l]), t = E.runSecs(m.cfg, rows[i - 1].at, r.at);
      const far = Math.max(...was.map(q => Math.min(...open.map(o => Math.abs(o - q)))));
      if (far === 1) assert.ok(t >= E.LANE_TIGHT, `one lane over: ${t.toFixed(2)} s at least ${E.LANE_TIGHT}`);
      if (far === 2) assert.ok(t >= E.LANE_NEAR, `two lanes over: ${t.toFixed(2)} s at least ${E.LANE_NEAR}`);
    });
  }
  // traffic in every lane: about a third of the cars each, and the open lane moving about (it once locked into one lane)
  { const per = [0, 0, 0]; let changes = 0, rows = 0;
    for (let k = 0; k < 200; k++) { const c = E.runCourse(mini('lane', 'spread' + k), 'X'); c.forEach((r, i) => { r.cars.forEach((v, l) => { if (v) per[l]++; }); rows++; if (i && r.cars.join() !== c[i - 1].cars.join()) changes++; }); }
    const tot = per[0] + per[1] + per[2];
    for (const n of per) assert.ok(n / tot > 0.22, `cars in every lane: ${per}`);
    assert.ok(changes / rows > 0.5, `the rows change lanes (${changes} of ${rows})`); }
  // the driver: sees what the page shows (34 m of road, the car 82% down: 27.9 m ahead), acts 0.25 s late
  const VIEW = 0.82 * 34, react = 0.25;
  const drive = m => {
    const sim = E.runStart(m, 'X'), rows = sim.course, hist = [];
    while (!sim.crash && !sim.done) {
      hist.push([sim.t, sim.d]);
      let seen = -Infinity; for (const [t, d] of hist) { if (t <= sim.t - react) seen = d; else break; }
      const known = rows.filter(o => o.at <= seen + VIEW && o.at > sim.d - E.LANE.box), cur = Math.round(sim.lane);
      if (known.length && sim.laneT >= 1 && !rows.some(o => Math.abs(o.at - sim.d) < E.LANE.box + 0.6)) {
        const open = r => [0, 1, 2].filter(l => !r.cars[l]), a = open(known[0]), b = known[1] ? open(known[1]) : null;
        const cost = l => Math.abs(l - cur) * 10 + (b ? Math.min(...b.map(q => Math.abs(q - l))) : 0);
        const want = a.slice().sort((x, y) => cost(x) - cost(y))[0];
        if (want !== cur) E.runLane(sim, want > cur ? 1 : -1);
      }
      E.runStep(sim, 1 / 60);
    }
    return sim;
  };
  let fin = 0;
  for (let k = 0; k < 40; k++) { const s = drive(mini('lane', 'react' + k)); if (s.done) fin++; }
  assert.equal(fin, 40, `every course driven to the finish (${fin}/40)`);
  // at the finish line's speed a row is still on screen over a reaction and a lane change before the car reaches it
  const vEnd = E.runSpeed(cfg, cfg.target);
  assert.ok(VIEW / vEnd > react + E.LANE.switchSecs, `${(VIEW / vEnd).toFixed(2)} s of warning at ${vEnd} m/s`);
});
