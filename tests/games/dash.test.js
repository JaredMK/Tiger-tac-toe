'use strict';
// Dash: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));
// Step a run until a condition holds (or it ends), in frames of 1/60 s.
function runUntil(sim, cond, max = 20000) { for (let k = 0; k < max && !sim.crash && !sim.done && !cond(sim); k++) E.runStep(sim, 1 / 60); return sim; }
const runOut = sim => runUntil(sim, () => false);

test('dash: a fixed, seeded course per square, the same for both players: ground hazards, low flyers and pairs, spaced within the config\'s gaps, up to the target', () => {
  E.setRunConfig(null);
  const m = mini('dash', 'course');
  const cx = E.runCourse(m, 'X'), co = E.runCourse(m, 'O');
  assert.deepEqual(E.runCourse(m, 'X'), cx, 'the same course every time');
  assert.deepEqual(co, cx, 'one course for both players');
  assert.notDeepEqual(E.runCourse(mini('dash', 'other'), 'X'), cx, 'another square, another course');
  const cfg = m.cfg;
  assert.ok(cx[0].at >= E.runGrace(cfg, 0) + 5, 'nothing in the opening grace stretch');
  assert.ok(cx[cx.length - 1].at < cfg.target, 'the last one before the finish');
  for (let k = 1; k < cx.length; k++) {
    const gap = cx[k].at - cx[k - 1].at;
    if (cx[k].pair === 2) assert.ok(gap > 2 && gap < 9, `a pair's two hazards are a jump apart (${gap})`);
    else assert.ok(gap >= cfg.gapMin - 0.01 && gap <= cfg.gapMax + 0.01, `obstacles ${k - 1} and ${k} are ${gap} m apart`);
  }
  const kinds = new Set(cx.map(o => o.k));
  assert.ok(['rock', 'crate', 'spike', 'flyer'].every(k => kinds.has(k)), `every kind comes up (${[...kinds].join(' ')})`);
  assert.ok(cx.some(o => o.pair === 1) && cx.filter(o => o.pair === 1).length === cx.filter(o => o.pair === 2).length, 'pairs come in twos');
  for (const o of cx) assert.ok(E.DASH_OBS[o.k], `a known hazard: ${o.k}`);
});

/* ===================================== the run ===================================== */
test('dash: the runner runs on its own; a hazard not jumped is a crash at the hazard; a tap clears a rock, a crate and a spike; a flyer is hit by a jump and passed on the ground', () => {
  E.setRunConfig(null);
  const m = mini('dash', 'sim');
  const fresh = course => Object.assign(E.runStart(m, 'X'), { course, i: 0 });
  // no input: the first hazard stops the run, just in front of it
  let sim = runOut(fresh([{ at: 40, k: 'rock' }]));
  assert.ok(sim.crash && sim.crash.at >= 40 - E.DASH.box.w && sim.crash.at <= 40.5, `a crash at the rock (${sim.crash && sim.crash.at})`);
  assert.equal(sim.crash.ob.k, 'rock');
  // a tap just before each ground hazard clears it
  for (const k of ['rock', 'crate', 'spike']) {
    sim = fresh([{ at: 40, k }]);
    runUntil(sim, s => s.d >= 40 - 0.3 * E.runSpeed(s.cfg, s.d));
    assert.ok(E.runJump(sim), 'the press launches');
    E.runStep(sim, 0.06); E.runRelease(sim);                  // a tap: let go after 60 ms
    runUntil(sim, s => s.d > 46);
    assert.ok(!sim.crash, `a tap clears a ${k}`);
    assert.ok(!sim.air, 'and the runner is back on the ground');
  }
  // the jump's height: a tap about 1.5 m, a hold about 2.3 m
  const apex = hold => { const s = fresh([]); E.runJump(s); let top = 0; for (let t = 0; t < 1.2; t += 1 / 240) { E.runStep(s, 1 / 240); if (!hold && t >= 0.06) E.runRelease(s); top = Math.max(top, s.y); } return top; };
  assert.ok(apex(false) > 1.3 && apex(false) < 1.7, `a tap peaks at ${apex(false).toFixed(2)} m`);
  assert.ok(apex(true) > 2.0 && apex(true) < 2.6, `a hold peaks at ${apex(true).toFixed(2)} m`);
  assert.ok(!E.runJump(Object.assign(fresh([]), { air: true })), 'no jump while in the air');
  // a flyer: jumping into it is a crash; staying on the ground passes under
  sim = fresh([{ at: 40, k: 'flyer' }]);
  runUntil(sim, s => s.d >= 40 - 0.3 * E.runSpeed(s.cfg, s.d)); E.runJump(sim);
  runUntil(sim, s => s.d > 46);
  assert.ok(sim.crash && sim.crash.ob.k === 'flyer', 'a jump hits the flyer');
  sim = runUntil(fresh([{ at: 40, k: 'flyer' }]), s => s.d > 46);
  assert.ok(!sim.crash, 'on the ground, the flyer passes overhead');
  // the finish: the target ends the run
  sim = runOut(fresh([]));
  assert.ok(sim.done && sim.d === m.cfg.target, 'the run finishes at the target');
  assert.deepEqual(E.runResult(sim), { dist: m.cfg.target, ms: Math.round(sim.t * 1000), out: false, log: '', steps: sim.n }, 'the move: the end, the time, and the log (no inputs here) with the steps');
});

test('dash: the computer\'s runner clears every course when it has nothing to crash at (taps over single hazards, holds over pairs, the ground under flyers), and crashes at the hazard it is given: into a flyer, or short of a ground hazard', () => {
  E.setRunConfig(null);
  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let flyers = 0, ground = 0;
  for (let s = 1; s <= 40; s++) for (const f of [0, 0.35, 0.7]) {
    const m = mini('dash', 'pilot' + s), from = Math.round(f * m.cfg.target); m.dist.X = from;
    const sim = E.runPilot(E.runStart(m, 'X'), null, lcg(s));
    assert.ok(sim.done, `course ${s} from ${from}: crashed at ${sim.crash && sim.crash.at} (${sim.crash && sim.crash.ob.k})`);
    assert.ok(sim.rec.length >= 2 && sim.rec.every(([n, c]) => Number.isInteger(n) && 'jr'.includes(c)), 'its jumps and releases logged');
    const s2 = E.runStart(m, 'X'), plan = s2.course[Math.min(s2.course.length - 1, 2 + (s % 4))];
    E.runPilot(s2, plan, lcg(s));
    assert.ok(s2.crash, `it crashes when told to (from ${from})`);
    const o = s2.crash.ob, pair = plan.pair === 2 ? s2.course[s2.course.indexOf(plan) - 1] : plan;
    assert.ok(o === pair || o === plan, `at that hazard (${o.k} at ${o.at}, planned ${plan.k} at ${plan.at})`);
    if (o.k === 'flyer') flyers++; else ground++;
  }
  assert.ok(flyers > 5 && ground > 20, `both ways of crashing come up (${flyers} flyers, ${ground} on the ground)`);
});

test('dash: a pair needs a well-timed long jump (or two quick ones); a single tap on the first lands on the second', () => {
  E.setRunConfig(null);
  const m = mini('dash', 'pair');
  const at = 60, v = E.runSpeed(m.cfg, at), gap = 1.0 + 0.15 * v;
  const course = [{ at, k: 'rock', pair: 1 }, { at: at + 1 + gap, k: 'rock', pair: 2 }];
  const go = (lead, hold) => { const s = Object.assign(E.runStart(m, 'X'), { course, i: 0 }); runUntil(s, x => x.d >= at - lead * v); E.runJump(s); if (!hold) { E.runStep(s, 0.06); E.runRelease(s); } runUntil(s, x => x.d > at + 12); return s; };
  assert.ok(go(0.25, false).crash, 'one tap: over the first, into the second');
  assert.ok(!go(0.2, true).crash, 'a well-timed hold clears both');
  assert.ok(go(0.05, true).crash && go(0.5, true).crash, 'too late or too early, it does not');
  assert.ok(['pair', 'pair2', 'pair3', 'pair4'].some(k => E.runCourse(mini('dash', k), 'O').some(o => o.pair)), 'pairs are part of the course');
});

test('dash: the Mini-game Settings: a square is dealt with them (in its cfg) and plays by them; the computer\'s runs pass the check', () => {
  E.setRunConfig(null); E.setTune('dash', { grace: 3, jump: 110, aiRuns: 3, aiSpread: 20 });
  const m = mini('dash', 'tuned');
  E.setTune('dash', null);
  assert.equal(m.cfg.grace, 3); assert.equal(m.cfg.aiRuns, 3); assert.equal(m.cfg.aiSpread, 20);
  assert.ok(Math.abs(E.runGrace(m.cfg, 0) - E.runAfter(m.cfg, 0, 3)) < 1e-9, 'a three-second clear start');
  assert.ok(E.runNeeds(m.cfg, 0) < E.runNeeds(mini('dash', 'tuned').cfg, 0), 'the computer means to finish in fewer runs');
  const sim = E.runStart(m, 'X'); E.runJump(sim); assert.ok(Math.abs(sim.vy - E.DASH.vy * 1.1) < 1e-9, 'the jump 10% stronger');
  const rng = E.makeRng('tuned-ai');
  for (let k = 0; k < 3 && m.dist.O < m.cfg.target; k++) { const r = E.applyMove(m, 'O', E.runAi(E.publicMini(m), 'O', rng).move, rng); assert.equal(r.ok, true, r.reason); }
  assert.deepEqual(Object.keys(mini('dash', 'plain').cfg).sort(), Object.keys(E.runConfig('dash')).sort(), 'back to the defaults: nothing added');
});
