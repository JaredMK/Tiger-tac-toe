'use strict';
// Simulations: Headcount. Slow, so never part of npm test:
// npm run sim -- headcount
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Headcount ===================================== */
test('headcount: the count is what crossed; decoys never count; every creature crosses the whole field; two going the same way in a lane never cover each other; level 1 left and right, level 2 all four ways at varied speeds, level 3 look-alikes stopping and starting', () => {
  const cfg = E.headConfig(), ways = { 0: new Set(), 1: new Set(), 2: new Set() }, look = new Set(E.HEAD_THEMES.filter(x => x.L.includes(3)).map(x => x.d));
  const at = (it, r, ms) => { const a = E.headAt(it, ms), c = 10 + it.lane * 20; return a == null ? null : E.headAxis(it, r) === 'v' ? [c, a] : [a, c]; };
  for (let level = 0; level < 3; level++) {
    const L = level + 1; let crossings = 0, spread = 0;
    for (let k = 0; k < 300; k++) {
      const r = E.headRound(level, lcg(k * 7 + level));
      const targets = r.items.filter(o => o.k === r.t), decoys = r.items.filter(o => o.k !== r.t);
      assert.equal(E.attTruth('headcount', r), targets.length, 'the answer: the ones asked for, counted');
      assert.ok(targets.length >= cfg['n' + L + 'lo'] && targets.length <= cfg['n' + L + 'hi'], `level ${L}: ${targets.length} to count`);
      assert.ok(decoys.length >= cfg['d' + L + 'lo'] && decoys.length <= cfg['d' + L + 'hi'], `level ${L}: ${decoys.length} decoys`);
      assert.ok(decoys.every(o => o.k === r.d) && r.d !== r.t, 'decoys: another kind (or colour)');
      assert.equal(L === 3, look.has(r.d), 'level 3 alone: decoys that look like them');
      assert.equal(E.headAsk(r), `How many ${E.HEAD_KINDS[r.t][1]}?`);
      for (const o of r.items) {
        ways[level].add(E.headAxis(o, r) + o.dir);
        assert.ok(o.t >= E.HEAD.lead && o.t + o.d <= r.ms, 'starts after the lead-in, gone before the question');
        assert.ok(Math.abs(E.headAt(o, o.t) - (o.dir > 0 ? -E.HEAD.size / 2 : 100 + E.HEAD.size / 2)) < 1e-9, 'in from the edge (just out of sight)');
        assert.ok(Math.abs(E.headAt(o, o.t + o.d) - (o.dir > 0 ? 100 + E.HEAD.size / 2 : -E.HEAD.size / 2)) < 1e-9, 'out at the far edge');
        assert.ok(o.d >= 500 && o.lane >= 0 && o.lane < E.HEAD.lanes, 'in sight long enough, in a lane');
        assert.equal(!!(o.s && o.s.length), L === 3, 'level 3 alone: each one stops and starts');
        // the page's key points move it exactly as the engine does
        const keys = E.headKeys(o);
        for (let f = 0; f <= 1; f += 0.05) { const j = keys.findIndex(([t]) => t >= f), [t1, u1] = keys[j], [t0, u0] = keys[Math.max(0, j - 1)], u = t1 === t0 ? u1 : u0 + ((f - t0) / (t1 - t0)) * (u1 - u0); assert.ok(Math.abs(u - E.headU(o, o.t + f * o.d)) < 1e-6, 'key points match'); }
      }
      if (L > 1) { const sp = r.items.map(o => o.d - (o.s || []).reduce((x, [, w]) => x + w, 0)); spread += Math.max(...sp) / Math.min(...sp); }
      for (let i = 0; i < r.items.length; i++) for (let j = i + 1; j < r.items.length; j++) {
        const a = r.items[i], b = r.items[j], same = a.lane === b.lane && E.headAxis(a, r) === E.headAxis(b, r);
        for (let ms = Math.max(a.t, b.t); ms <= Math.min(a.t + a.d, b.t + b.d); ms += 10) {
          const pa = at(a, r, ms), pb = at(b, r, ms);
          if (!pa || !pb) continue;
          if (same) assert.ok(Math.abs(pa[0] - pb[0]) + Math.abs(pa[1] - pb[1]) >= E.HEAD.size, `level ${L} round ${k}: two going the same way in lane ${a.lane} never cover each other`);
          else if (Math.abs(pa[0] - pb[0]) < E.HEAD.size && Math.abs(pa[1] - pb[1]) < E.HEAD.size) { crossings++; break; }
        }
      }
    }
    if (L > 1) { assert.ok(crossings / 300 >= 8, `level ${L}: paths cross often (${(crossings / 300).toFixed(1)} a round)`); assert.ok(spread / 300 >= 1.8, `level ${L}: speeds vary widely`); }
  }
  assert.deepEqual([...ways[0]].sort(), ['h-1', 'h1'], 'level 1: left and right');
  assert.deepEqual([...ways[1]].sort(), ['h-1', 'h1', 'v-1', 'v1'], 'level 2: all four ways'); assert.deepEqual([...ways[2]].sort(), ['h-1', 'h1', 'v-1', 'v1']);
});
