'use strict';
// Chopper: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));
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

test('chopper: the computer\'s pilot flies all but the odd course through when it has nowhere to crash (from the start or a saved distance), and dives into the floor about where it is told to', () => {
  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  let fin = 0, n = 0;
  for (let s = 1; s <= 40; s++) for (const f of [0, 0.3, 0.6, 0.9]) {
    const mini = square('chopper', s * 131, Math.round(f * 1000)), sim = E.runPilot(E.runStart(mini, 'X'), Infinity, lcg(s));
    n++; if (sim.done) fin++;
    assert.ok(sim.rec.every(([k, c]) => Number.isInteger(k) && 'jr'.includes(c)) && (sim.rec.length > 0 || mini.dist.X > 800), 'its presses and releases logged (a flight from near the end may need none)');
    const at = mini.dist.X + sim.grace + 40 + (s % 7) * 30, s2 = E.runPilot(E.runStart(mini, 'X'), at, lcg(s));
    if (at >= mini.cfg.target - 20) continue;
    assert.ok(s2.crash && s2.d >= at - 12 && s2.d <= at + 40, `a crash near ${at} (from ${mini.dist.X}: ${s2.crash ? s2.crash.at + ' ' + s2.crash.ob.k : 'finished'})`);
  }
  assert.ok(fin >= n - 5, `${fin} of ${n} flights finished`);
});

test('chopper: the Mini-game Settings: a square is dealt with them (in its cfg) and plays by them; the computer\'s runs pass the check', () => {
  E.setRunConfig(null); E.setTune('chopper', { grace: 3, up: 20, down: 12, aiRuns: 3, aiSpread: 20 });
  const m = mini('chopper', 'tuned');
  E.setTune('chopper', null);
  assert.equal(m.cfg.grace, 3); assert.equal(m.cfg.aiRuns, 3); assert.equal(m.cfg.aiSpread, 20);
  assert.ok(Math.abs(E.runGrace(m.cfg, 0) - E.runAfter(m.cfg, 0, 3)) < 1e-9, 'a three-second clear start');
  assert.ok(E.runNeeds(m.cfg, 0) < E.runNeeds(mini('chopper', 'tuned').cfg, 0), 'the computer means to finish in fewer runs');
  const sim = E.runStart(m, 'X'); E.runJump(sim); E.runTick(sim); assert.ok(Math.abs(sim.vy - 20 * E.CHOP.step) < 1e-9, 'it climbs at the dealt rate');
  const rng = E.makeRng('tuned-ai');
  for (let k = 0; k < 3 && m.dist.O < m.cfg.target; k++) { const r = E.applyMove(m, 'O', E.runAi(E.publicMini(m), 'O', rng).move, rng); assert.equal(r.ok, true, r.reason); }
  assert.deepEqual(Object.keys(mini('chopper', 'plain').cfg).sort(), Object.keys(E.runConfig('chopper')).sort(), 'back to the defaults: nothing added');
});
