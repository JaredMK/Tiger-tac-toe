'use strict';
// Scoop Stack: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const scoopMini = (seed, n0, tries) => ({ type: 'scoop', cfg: E.scoopConfig(), seed: { X: seed, O: seed + 1 }, stack: { X: Array.from({ length: n0 || 0 }, (_, k) => k % 5), O: [] }, tries: { X: tries || 0, O: 0 }, last: null });

test('scoop stack: the same inputs give the same attempt; the stack carries over, attempt to attempt, with the same falls on a retry only after a new try', () => {
  const mini = scoopMini(42, 0, 0);
  let n = 0;
  for (let k = 0; k < 4; k++) {
    const r = E.scoopAi(mini, 'X', E.makeRng('sc' + k));
    const c = E.fingCheck(mini, 'X', r.move);
    assert.equal(c.why, null);
    assert.equal(c.sim.n0, n, 'it starts with the stack so far');
    assert.deepEqual(E.fingReplay('scoop', mini, 'X', E.fingUnlog(r.move.log, r.move.steps, 500), r.move.steps).got, r.sim.got);
    mini.stack.X = mini.stack.X.concat(c.sim.got); mini.tries.X++; n = mini.stack.X.length;
  }
  assert.ok(n > 0, 'the stack grew');
  const a = E.scoopItems(mini.cfg, 'x', 3, 5), b = E.scoopItems(mini.cfg, 'x', 3, 5), c = E.scoopItems(mini.cfg, 'x', 4, 5);
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
});
test('scoop stack: faster and more hazards as the stack grows; nothing lands in the grace; three misses end it; a scoop far off-centre slides off', () => {
  const cfg = E.scoopConfig(), low = E.scoopItems(cfg, 'r', 0, 0), high = E.scoopItems(cfg, 'r', 0, 20);
  assert.ok(low[0].T > E.FING.grace, 'the first item lands after the grace');
  assert.ok(avg(high.slice(0, 20).map(i => i.v)) > avg(low.slice(0, 20).map(i => i.v)), 'faster');
  const hz = n0 => { let bad = 0, all = 0; for (let k = 0; k < 30; k++) { const a = E.scoopItems(cfg, 'h' + k, 0, n0).slice(0, 12); all += a.length; bad += a.filter(i => i.k !== 'scoop').length; } return bad / all; };
  assert.ok(hz(20) > hz(0) + 0.05, `more hazards higher up (${hz(0).toFixed(2)} of the items at the bottom, ${hz(20).toFixed(2)} near the target)`);
  // a cone that stays still: scoops slide off or miss, three of them end it
  const sim = E.scoopStart(scoopMini(5), 'X'), seen = new Set();
  while (!sim.end) { E.scoopStep(sim, 1); if (sim.last) seen.add(sim.last); }
  assert.ok(sim.end === 'miss' || sim.end === 'hazard');
  if (sim.end === 'miss') assert.equal(sim.miss, 3);
  // one scoop, put down just off the top: within slide it stacks, further but touching it slides off
  for (const [off, want] of [[0.3, 'catch'], [0.8, 'slide'], [1.5, 'miss']]) {
    const s = E.scoopStart(scoopMini(6), 'X'); s.items = [{ T: 0.05, x: s.x + off, k: 'scoop', f: 1, v: 5 }];
    while (!s.last && !s.end) E.scoopStep(s, null);
    assert.equal(s.last, want, `${off} off-centre: ${want}`);
  }
});
