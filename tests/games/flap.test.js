'use strict';
// Flap: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
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
