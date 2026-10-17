'use strict';
// Simulations: Scoop Stack. Slow, so never part of npm test:
// npm run sim -- scoop
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);
const scoopMini = (seed, n0, tries) => ({ type: 'scoop', cfg: E.scoopConfig(), seed: { X: seed, O: seed + 1 }, stack: { X: Array.from({ length: n0 || 0 }, (_, k) => k % 5), O: [] }, tries: { X: tries || 0, O: 0 }, last: null });

/* ===================================== Scoop Stack ===================================== */
// A perfect cone (it knows every item and moves at the fair speed) plans its way back from the last item:
// at each item only some places will do (under a scoop; clear of a hazard), and from each it must be able
// to reach the next. Played through the real steps (the sway included), it catches every scoop and is
// never hit: every attempt is fair.
function perfectScoop(mini) {
  const sim = E.scoopStart(mini, 'X'), cfg = sim.cfg, v = cfg.cone * E.SCOOP.fair, lo = E.SCOOP.edge, hi = E.SCOOP.w - E.SCOOP.edge, its = sim.items;
  const allowed = it => (it.k === 'scoop' ? [[it.x - 0.2, it.x + 0.2]] : [[lo, it.x - E.SCOOP.hit - E.SCOOP.pad], [it.x + E.SCOOP.hit + E.SCOOP.pad, hi]].filter(([a, b]) => b >= a));
  const cut = (A, B) => { const out = []; for (const [a, b] of A) for (const [c, d] of B) { const x = Math.max(a, c), y = Math.min(b, d); if (y >= x) out.push([x, y]); } return out; };
  const grow = (A, e) => A.map(([a, b]) => [Math.max(lo, a - e), Math.min(hi, b + e)]);
  const S = new Array(its.length);
  for (let i = its.length - 1; i >= 0; i--) S[i] = i === its.length - 1 ? allowed(its[i]) : cut(allowed(its[i]), grow(S[i + 1], v * (its[i + 1].T - its[i].T)));
  const way = [[0, sim.x]];
  let x = sim.x, t = 0;
  for (let i = 0; i < its.length; i++) {
    const reach = v * (its[i].T - t);
    let best = null;
    for (const [a, b] of S[i]) { const y = Math.max(a, Math.min(b, x)); if (Math.abs(y - x) <= reach + 1e-9 && (best == null || Math.abs(y - x) < Math.abs(best - x))) best = y; }
    if (best == null) return { planned: false, at: i };
    way.push([its[i].T, best]); x = best; t = its[i].T;
  }
  const at = tt => { let k = 0; while (k < way.length - 1 && way[k + 1][0] < tt) k++; if (k === way.length - 1) return way[k][1]; const [t0, x0] = way[k], [t1, x1] = way[k + 1]; const u = Math.min(1, Math.max(0, (tt - t0) / Math.max(1e-9, (t1 - t0) * 0.5))); return x0 + (x1 - x0) * u; };   // (it gets there in the first half of each stretch, then waits)
  let sway = 0;
  while (!sim.end) { E.scoopStep(sim, at(sim.t + E.FING.step)); sway = Math.max(sway, Math.abs(sim.s)); }
  return { planned: true, end: sim.end, got: sim.got.length, miss: sim.miss, sway };
}

test('scoop stack: every attempt is fair — a perfect cone catches every scoop and dodges every hazard, sway and all', () => {
  const bad = [];
  let sway = 0;
  for (let s = 0; s < 120; s++) {
    const r = perfectScoop(scoopMini(900 + s, s % 25, s % 4));
    sway = Math.max(sway, r.sway || 0);
    if (!r.planned || r.end !== 'top' || r.miss) bad.push([s, r]);
  }
  assert.deepEqual(bad, [], 'all reach the target with no miss');
  assert.ok(sway > 0.02, `the stack sways (${sway.toFixed(2)})`);
});
