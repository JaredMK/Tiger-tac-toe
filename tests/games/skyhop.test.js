'use strict';
// Sky Hop: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const hopMini = (seed, h0) => ({ type: 'skyhop', cfg: E.hopConfig(), seed: { X: seed, O: seed + 1 }, height: { X: h0 || 0, O: 0 }, tries: { X: 0, O: 0 }, last: null });

/* ===================================== Sky Hop ===================================== */
test('sky hop: the same inputs give the same attempt (the phone, the server, a replay), step for step', () => {
  for (let s = 0; s < 12; s++) {
    const mini = hopMini(100 + s, s * 37.5), r = E.hopAi(mini, 'X', E.makeRng('d' + s));
    const log = E.fingUnlog(r.move.log, r.move.steps, Math.ceil(E.HOP.w * E.FING.q));
    assert.ok(log, 'the inputs read back');
    const a = E.fingReplay('skyhop', mini, 'X', log, r.move.steps), b = E.fingReplay('skyhop', JSON.parse(JSON.stringify(mini)), 'X', log, r.move.steps);
    assert.deepEqual([a.n, a.y, a.x, a.top, a.end], [r.sim.n, r.sim.y, r.sim.x, r.sim.top, r.sim.end], 'the replay ends exactly where the attempt did');
    assert.deepEqual([b.n, b.y, b.x, b.top], [a.n, a.y, a.x, a.top]);
    assert.equal(E.fingCheck(mini, 'X', r.move).why, null, 'and it passes the check');
  }
});
test('sky hop: every course is a chain of platforms each within one bounce of the last (up and across), with hazards never in the way up', () => {
  const cfg = E.hopConfig(), peak = E.hopPeak(cfg);
  for (let s = 0; s < 40; s++) {
    const c = E.hopCourse(cfg, 'chain' + s), chain = c.plats.filter(q => q.c);
    assert.ok(chain[chain.length - 1].y >= cfg.target, 'the chain goes past the top');
    let y = 0, x = E.HOP.w / 2;
    for (const q of chain) {
      const gap = q.y - y;
      assert.ok(gap > 0 && gap <= E.HOP.gapK * peak + 1e-9, `a gap of ${gap.toFixed(2)} m is within a bounce (${peak.toFixed(2)})`);
      const air = (cfg.bounce + Math.sqrt(cfg.bounce * cfg.bounce - 2 * E.HOP.g * gap)) / E.HOP.g;
      assert.ok(Math.abs(q.x - x) <= E.HOP.vx * air + 1e-6, 'and within reach across, in the time in the air');
      assert.ok(q.x - q.w / 2 - q.amp >= -1e-9 && q.x + q.w / 2 + q.amp <= E.HOP.w + 1e-9, 'wholly inside the walls, its swing too');
      y = q.y; x = q.x;
    }
    for (const h of c.haz) for (const q of chain) assert.ok(!(q.y > h.y - peak - 0.6 && q.y < h.y + 1.2 && Math.abs(q.x - h.x) < q.w / 2 + q.amp + 1.2), 'no hazard over a platform on the way up');
  }
});
test('sky hop: an attempt resumes at the saved height on a safe start (2 seconds of grace, nothing hazardous in reach), and keeps the best height', () => {
  const cfg = E.hopConfig(), peak = E.hopPeak(cfg);
  for (const h0 of [0, 31.5, 77, 160.9, 262]) {
    const mini = hopMini(77, h0), sim = E.hopStart(mini, 'X');
    assert.equal(sim.y, h0); assert.equal(sim.top, h0);
    assert.ok(sim.haz.every(h => h.y > h0 + peak + 0.5), 'no hazard within the first bounce');
    for (let n = 0; n < E.FING.grace / E.FING.step; n++) E.hopStep(sim, null);   // no finger at all for the grace
    assert.equal(sim.end, null, `from ${h0} m: still going after the grace`);
    assert.ok(sim.y >= h0 - 1e-9 || sim.vy > 0, 'held up by the start ledge');
    // the move keeps the best height, and never takes any off
    const r = E.hopAi(mini, 'X', E.makeRng('k' + h0)), st = { squares: [{ owner: null, mini }] };
    const before = mini.height.X, c = E.fingCheck(mini, 'X', r.move);
    assert.equal(c.why, null);
    assert.ok(r.move.h >= before, 'an attempt\'s height is at least where it started');
    void st;
  }
});
test('sky hop: difficulty rises with height (wider gaps, narrower, moving and breaking platforms, hazards higher up)', () => {
  const cfg = E.hopConfig(), lo = [], hi = [];
  for (let s = 0; s < 20; s++) for (const q of E.hopCourse(cfg, 'd' + s).plats) (q.y < 60 ? lo : q.y > 220 ? hi : []).push(q);
  const share = (a, k) => a.filter(q => q.k === k).length / a.length;
  assert.ok(avg(hi.map(q => q.w)) < avg(lo.map(q => q.w)), 'narrower higher up');
  assert.ok(share(hi, 'm') > share(lo, 'm') && share(hi, 'b') > share(lo, 'b'), 'more moving and breaking platforms higher up');
  assert.equal(lo.filter(q => q.k === 'b' && q.y < cfg.breakAt).length, 0, 'none break below their start height');
  const haz = [].concat(...Array.from({ length: 20 }, (_, s) => E.hopCourse(cfg, 'd' + s).haz));
  assert.ok(haz.length > 20 && haz.every(h => h.y > cfg.hazAt - E.HOP.gapK * E.hopPeak(cfg)), 'hazards, only from about their start height (within the gap below it)');
});
test('sky hop: a breaking platform takes one bounce; a burr ends the attempt; falling off the bottom ends it; the top ends it', () => {
  const ends = {};
  for (let s = 0; s < 40; s++) { const r = E.hopAi(hopMini(300 + s, 80 + (s % 5) * 35), 'X', E.makeRng('e' + s)); ends[r.move.end] = (ends[r.move.end] || 0) + 1; if (r.move.end === 'top') assert.equal(r.move.h, E.hopConfig().target); }
  assert.ok(ends.fall > 0 && ends.hazard > 0, `falls and hazards both happen (${JSON.stringify(ends)})`);
  const sim = E.hopStart(hopMini(9, 110), 'X');
  for (let n = 0; n < 60 / E.FING.step && !sim.end; n++) { E.hopStep(sim, null); if (sim.last === 'break') assert.equal(sim.gone[sim.on], 1, 'a broken platform is gone'); }
});
