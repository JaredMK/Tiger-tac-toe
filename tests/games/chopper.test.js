'use strict';
// Chopper: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const square = (type, seed, from = 0) => ({ type, cfg: E.runConfig(type), seed: { X: seed, O: seed + 1 }, dist: { X: from, O: 0 }, runs: { X: 0, O: 0 }, crashes: { X: [], O: [] } });

test('chopper: the cave narrows from 5.6 m to 3.4 m (the config\'s heights) and stays in the sky; every block leaves room to pass, all the way in', () => {
  const cfg = E.runConfig('chopper');
  assert.deepEqual([cfg.cave0, cfg.cave1], [5.6, 3.4]);
  assert.equal(E.caveHeight(cfg, 0), cfg.cave0); assert.equal(E.caveHeight(cfg, cfg.target), cfg.cave1);
  const old = { target: 1000 };                                     // a square dealt before the cave was in the config: CHOP's heights
  assert.equal(E.caveHeight(old, 0), E.CHOP.cave0); assert.equal(E.caveHeight(old, 1000), E.CHOP.cave1);
  for (let s = 1; s <= 40; s++) {
    const mini = square('chopper', s * 977), cave = E.runCave(mini, 'X'), course = E.runCourse(mini, 'X');
    for (let d = 0; d <= cfg.target; d += 2.5) { const [f, c] = E.caveWalls(cave, cfg, d); assert.ok(f >= -0.01 && c <= E.CHOP.h + 0.01 && c - f >= cfg.cave1 - 2 * E.CHOP.wave - 0.01, `walls at ${d}: ${f} ${c}`); }
    for (const o of course) {
      let f = -Infinity, c = Infinity;
      for (let x = o.at - 4; x <= o.at + E.CHOP.bw + 1.5; x += 0.25) { const w = E.caveWalls(cave, cfg, x); f = Math.max(f, w[0]); c = Math.min(c, w[1]); }
      assert.ok(Math.max(o.y - f, c - (o.y + o.bh)) >= E.CHOP.room - 0.05, `block at ${o.at}: room ${o.y - f} below, ${c - o.y - o.bh} above`);
    }
  }
});
