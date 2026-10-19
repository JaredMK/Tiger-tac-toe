'use strict';
// Simulations: Dash. Slow, so never part of npm test:
// npm run sim -- dash
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

// A typical player's hand: they see 9 m of the course ahead (the phone's 16:11 scene: the runner at 18% across,
// 7.5 m of height), take about a quarter of a second to react to a hazard coming into view, and tap aiming
// 0.27 s before a ground hazard (a hold 0.2 s before a pair), off by about 0.05 s; under a flyer they stay down,
// though 1 time in 20 they jump into it. A run ends at the first crash; the next starts from there.
const VIEW = 0.82 * 7.5 * 16 / 11, P = { react: 0.25, sd: 0.05, flyMiss: 0.05 };
const gauss = rng => { let u = 0; for (let k = 0; k < 6; k++) u += rng(); return (u - 3) / Math.sqrt(0.5); };
function hand(sim, rng) {
  const course = sim.course, OBS = E.DASH_OBS;
  let k = 0, lk = -1, plan = null, hold = 0;
  return () => {
    while (k < course.length && course[k].at + OBS[course[k].k].w < sim.d - 0.5) k++;
    if (sim.held && sim.holdT >= hold) E.runRelease(sim);
    const o = course[k];
    if (!o || sim.air) return;
    const v = E.runSpeed(sim.cfg, sim.d);
    if (k !== lk) {
      lk = k;
      const want = (o.pair === 1 ? 0.2 : 0.27) + gauss(rng) * P.sd, react = P.react + gauss(rng) * 0.04;
      plan = o.pair === 2 ? { skip: true } : { lead: Math.min(want, VIEW / v - react), fly: o.k === 'flyer' && rng() < P.flyMiss };
    }
    if (plan.skip || (o.k === 'flyer' && !plan.fly)) return;
    if (sim.d >= o.at - plan.lead * v && E.runJump(sim)) { hold = o.pair === 1 ? E.DASH.holdMax + 0.05 : 0.06; plan.skip = true; }
  };
}
function runsToFinish(cfg, courses) {
  const out = [];
  for (let c = 0; c < courses; c++) {
    const mini = E.newMini('dash', E.makeRng('course' + c)), rng = E.makeRng('hand' + c);
    mini.cfg = cfg; mini.dist = { X: 0, O: 0 };
    let n = 0;
    while (mini.dist.X < cfg.target && n < 60) {
      const sim = E.runStart(mini, 'X'), h = hand(sim, rng);
      while (!sim.crash && !sim.done && sim.t < 400) { h(); E.runStep(sim, E.runStepOf('dash')); }
      n++; mini.dist.X = Math.min(cfg.target, Math.max(mini.dist.X, sim.d));
    }
    out.push(n);
  }
  return out;
}
const mean = a => a.reduce((x, y) => x + y, 0) / a.length;

test('dash: a clean run of the course takes 25-30 s, every course can be run clean (the computer with nothing to crash at), and a typical player takes 3 to 6 runs; the old settings took about 2 (a 70 s course)', () => {
  E.setRunConfig(null);
  const cfg = E.runConfig('dash');
  assert.deepEqual([cfg.target, cfg.v0, cfg.ramp, cfg.gapMin, cfg.gapMax], [550, 13, 3, 18, 32]);
  const times = [];
  for (let c = 0; c < 60; c++) for (const f of [0, 0.35, 0.7]) {
    const mini = E.newMini('dash', E.makeRng('clean' + c)); mini.dist.X = Math.round(f * cfg.target);
    const sim = E.runPilot(E.runStart(mini, 'X'), null, E.makeRng('p' + c));
    assert.ok(sim.done, `course ${c} from ${mini.dist.X} m: run clean`);
    if (!f) times.push(sim.t);
  }
  assert.ok(Math.min(...times) >= 25 && Math.max(...times) <= 30, `a clean run: ${Math.min(...times).toFixed(1)}-${Math.max(...times).toFixed(1)} s`);
  const now = mean(runsToFinish(cfg, 80));
  assert.ok(now >= 3 && now <= 6, `${now.toFixed(2)} runs on average`);
  const before = runsToFinish(Object.assign({}, cfg, { target: 1000, v0: 8, ramp: 1.5, gapMin: 26, gapMax: 48 }), 40);
  assert.ok(mean(before) < 2.6, `old settings: ${mean(before).toFixed(2)} runs`);
  console.log(`Dash: a clean run ${mean(times).toFixed(1)} s; a typical player ${now.toFixed(2)} runs (old settings ${mean(before).toFixed(2)})`);
});
