'use strict';
// Bowling: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('bowling: a fresh rack of ten every roll; the pins down go on the roller\'s total; a strike is ten; a wide roll is a gutter ball; 25 takes the square', () => {
  const m = mini('bowling', 'b');
  assert.deepEqual(m.pins, { X: 0, O: 0 }); assert.equal(P.BOWL.pins.length, 10);
  const r = E.applyMove(m, 'X', { aim: 0, power: 0.85 });
  assert.equal(r.outcome, 'continue'); assert.ok(m.pins.X >= 3 && m.pins.X <= 10, `a straight roll knocks a few (${m.pins.X})`); assert.equal(m.rolls.X, 1);
  assert.equal(m.last.down.filter(Boolean).length, m.last.knocked);
  const g = E.applyMove(m, 'O', { aim: 0.45, power: 0.9 });
  assert.equal(g.note, 'gutter'); assert.equal(m.pins.O, 0); assert.ok(m.last.gutter);
  const before = m.pins.X;
  E.applyMove(m, 'X', { aim: 0, power: 0.85 });
  assert.ok(m.pins.X > before, 'a fresh rack: the same roll knocks pins again');
  // the best angle of the computer's: a strike comes up over a few racks
  let strike = false; const rng = lcg(5);
  for (let k = 0; k < 12 && !strike; k++) { const t = mini('bowling', 'strike' + k); const ai = E.physAi(t, 'X', rng); const rr = E.applyMove(t, 'X', ai.move); if (rr.note === 'strike') strike = true; assert.ok(t.pins.X <= 10); }
  assert.ok(strike, 'a strike within a dozen computer rolls');
  const w = mini('bowling', 'w'); w.pins.X = 20;
  let n = 0; while (w.pins.X < 25 && n++ < 10) { const rr = E.applyMove(w, 'X', { aim: 0, power: 0.85 }); if (rr.outcome === 'win') { assert.equal(rr.note, 'pins'); break; } }
  assert.ok(w.pins.X >= 25);
});
test('bowling: no back wall — the ball and any pin that pass the end of the lane drop into the pit and are gone; nothing comes back', () => {
  const pos = { ball: P.BOWL.start }; P.BOWL.pins.forEach((p, k) => { pos['p' + k] = p; });
  let pits = 0, back = 0;
  for (let i = 0; i < 12; i++) {
    const r = P.run('bowling', pos, 'ball', { aim: (i - 6) * 0.008, power: 0.7 + (i % 3) * 0.15 });
    assert.ok(!r.events.some(e => e.k === 'wall'), 'nothing hits a wall at the back');
    pits += r.events.filter(e => e.k === 'pit').length;
    r.rec.ids.forEach((id, j) => { let low = false; for (const f of r.rec.frames) { const y = f[2 * j + 1]; if (y == null) continue; if (y < 6) low = true; else if (low && y > 12) back++; } });
    for (const e of r.events.filter(e => e.k === 'pit')) assert.equal(r.final[e.id], null, `${e.id} in the pit is gone`);
    if (r.final.ball) assert.ok(r.final.ball[1] >= P.BOWL.pit, 'the ball is never left past the end of the lane');
  }
  assert.ok(pits > 0, 'pins knocked hard enough drop into the pit');
  assert.equal(back, 0, 'nothing bounces back down the lane from the end');
});
