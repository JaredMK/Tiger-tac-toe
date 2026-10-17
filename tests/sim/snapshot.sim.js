'use strict';
// Simulations: Snapshot. Slow, so never part of npm test:
// npm run sim -- snapshot
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Snapshot ===================================== */
test('snapshot: 4x5 with 7, 5x5 with 9, 5x6 with 11; 5 s on show, then 5 s blank; never a trivial pattern; only an exact match counts', () => {
  const sizes = [[4, 5, 7], [5, 5, 9], [5, 6, 11]];
  for (let level = 0; level < 3; level++) {
    const [c, rr, k] = sizes[level];
    for (let n = 0; n < 2000; n++) {
      const r = E.snapRound(level, lcg(n * 13 + level));
      assert.deepEqual([r.c, r.r, r.cells.length, r.show, r.wait, E.attMs('snapshot', r)], [c, rr, k, 5000, 5000, 10000]);
      const on = new Set(r.cells), at = (x, y) => on.has(y * c + x);
      for (let y = 0; y < rr; y++) assert.ok(!Array.from({ length: c }, (_, x) => at(x, y)).every(Boolean), 'no full row');
      for (let x = 0; x < c; x++) assert.ok(!Array.from({ length: rr }, (_, y) => at(x, y)).every(Boolean), 'no full column');
      const xs = r.cells.map(i => i % c), ys = r.cells.map(i => Math.floor(i / c));
      assert.ok((Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1) > k, 'no solid block');
      assert.ok(!r.cells.every(i => at(c - 1 - (i % c), Math.floor(i / c))) && !r.cells.every(i => at(i % c, rr - 1 - Math.floor(i / c))), 'not mirror-symmetric');
      assert.equal(E.snapTrivial(r.cells, c, rr), null);
    }
  }
  const r = E.snapRound(1, lcg(5));
  assert.equal(E.attJudge('snapshot', r, r.cells.slice().reverse()), true, 'the same cells, in any order');
  assert.equal(E.attJudge('snapshot', r, r.cells.slice(1)), false, 'one missed');
  const extra = Array.from({ length: 20 }, (_, i) => i).find(i => !r.cells.includes(i));
  assert.equal(E.attJudge('snapshot', r, r.cells.concat(extra)), false, 'one too many');
  assert.equal(E.attJudge('snapshot', r, r.cells.slice(1).concat(extra)), false, 'one in the wrong place');
  assert.equal(E.snapTrivial([0, 1, 2, 3, 6, 9], 4, 4), 'row'); assert.equal(E.snapTrivial([5, 6, 9, 10, 13, 14], 4, 4), 'block'); assert.equal(E.snapTrivial([0, 5, 10, 15, 3, 6], 4, 4), 'line');
});
