'use strict';
// Flap: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));
const square = (type, seed, from = 0) => ({ type, cfg: E.runConfig(type), seed: { X: seed, O: seed + 1 }, dist: { X: from, O: 0 }, runs: { X: 0, O: 0 }, crashes: { X: [], O: [] } });
// Flap: aim a little below the middle of the next gap; flap when, from what it saw `lag` ago, it would sink below it.
function flyFlap(mini, lag) {
  const sim = E.runStart(mini, 'X'), dt = 1 / 60, hist = [];
  for (let n = 0; !sim.crash && !sim.done && n < 60 * 400; n++) {
    hist.push({ y: sim.y, vy: sim.vy }); while (hist.length > Math.round(lag / dt) + 1) hist.shift();
    const o = sim.course.find(q => q.at + E.FLAP.post > sim.d - E.FLAP.box.w / 2), want = o ? o.gy - o.gh * 0.12 : E.FLAP.h / 2;
    const seen = hist[0];
    if (seen.y + seen.vy * 0.12 - 0.5 * E.FLAP.g * 0.0144 < want && sim.vy < 1.5) E.runJump(sim);
    E.runStep(sim, dt);
  }
  return sim;
}

test('flap: posts every 9-12 m, each gap of the mix\'s size, its middle within reach of the last one\'s and clear of the ground and sky', () => {
  for (let s = 1; s <= 60; s++) {
    const mini = square('flap', s * 101), course = E.runCourse(mini, 'X');
    assert.ok(course.length > 30 && course.length < 55, `${course.length} posts (450 m)`);
    course.forEach((o, k) => {
      assert.ok(Object.values(E.FLAP.gaps).includes(o.gh));
      assert.ok(o.gy - o.gh / 2 >= E.FLAP.margin - 1e-6 && o.gy + o.gh / 2 <= E.FLAP.h - E.FLAP.margin + 1e-6, 'clear of the ground and the sky');
      if (k) { assert.ok(o.at - course[k - 1].at >= 9 - 0.01 && o.at - course[k - 1].at <= 12 + 0.01, 'spacing'); assert.ok(Math.abs(o.gy - course[k - 1].gy) <= E.FLAP.shift + 0.01, 'within reach'); }
    });
    assert.deepEqual(E.runCourse(mini, 'X'), course, 'the same course every time (seeded)');
  }
});

test('flap: a pilot that reacts 0.12 s late finishes every course', () => {
  for (let s = 1; s <= 25; s++) { const sim = flyFlap(square('flap', s * 7919), 0.12); assert.ok(sim.done, `course ${s}: crashed at ${Math.round(sim.d)} m (${sim.crash && sim.crash.ob.k})`); }
});

test('flap: the computer\'s bird flies all but the odd course through when it has no post to crash at (from the start or a saved distance), and flies into the upper post it is given', () => {
  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let fin = 0, n = 0;
  for (let s = 1; s <= 40; s++) for (const f of [0, 0.3, 0.6, 0.9]) {
    const mini = square('flap', s * 131, Math.round(f * 450)), sim = E.runPilot(E.runStart(mini, 'X'), null, lcg(s));
    n++; if (sim.done) fin++;
    assert.ok(sim.rec.length > 0 && sim.rec.every(([k, c]) => Number.isInteger(k) && c === 'j'), 'its flaps logged');
    const s2 = E.runStart(mini, 'X'), plan = s2.course[Math.min(s2.course.length - 1, 1 + (s % 5))];
    if (!plan) continue;
    E.runPilot(s2, plan, lcg(s));
    assert.ok(s2.crash && s2.crash.ob === plan && s2.y > plan.gy, `into that post, from above (from ${mini.dist.X}: ${s2.crash && s2.crash.ob.at}, planned ${plan.at})`);
  }
  assert.ok(fin >= n - 3, `${fin} of ${n} flights finished`);
});

test('flap: the Mini-game Settings: a square is dealt with them (in its cfg) and plays by them; the computer\'s runs pass the check', () => {
  E.setRunConfig(null); E.setTune('flap', { grace: 3, gaps: 120, aiRuns: 3, aiSpread: 20 });
  const m = mini('flap', 'tuned');
  E.setTune('flap', null);
  assert.equal(m.cfg.grace, 3); assert.equal(m.cfg.aiRuns, 3); assert.equal(m.cfg.aiSpread, 20);
  assert.ok(Math.abs(E.runGrace(m.cfg, 0) - E.runAfter(m.cfg, 0, 3)) < 1e-9, 'a three-second clear start');
  assert.ok(E.runNeeds(m.cfg, 0) < E.runNeeds(mini('flap', 'tuned').cfg, 0), 'the computer means to finish in fewer runs');
  for (const o of E.runCourse(m, 'X')) assert.ok(Math.abs(o.gh - E.FLAP.gaps[o.k] * 1.2) < 0.01, 'the gaps 20% wider');
  const rng = E.makeRng('tuned-ai');
  for (let k = 0; k < 3 && m.dist.O < m.cfg.target; k++) { const r = E.applyMove(m, 'O', E.runAi(E.publicMini(m), 'O', rng).move, rng); assert.equal(r.ok, true, r.reason); }
  assert.deepEqual(Object.keys(mini('flap', 'plain').cfg).sort(), Object.keys(E.runConfig('flap')).sort(), 'back to the defaults: nothing added');
});
