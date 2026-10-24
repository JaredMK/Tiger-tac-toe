'use strict';
// Bowling: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('bowling: a turn is one roll at a fresh rack; a wide roll is a gutter ball; every pin down counts, no bonuses; the target takes the square', () => {
  const m = mini('bowling', 'b');
  assert.deepEqual([m.pins, m.frames, m.open], [{ X: 0, O: 0 }, { X: [], O: [] }, undefined]); assert.equal(P.BOWL.pins.length, 10);
  const r = E.applyMove(m, 'X', { aim: 0, power: 0.85 });
  assert.equal(r.outcome, 'continue'); assert.equal(r.again, undefined, 'one roll: the turn passes at once'); assert.ok(m.pins.X >= 3 && m.pins.X <= 10, `a straight roll knocks a few (${m.pins.X})`); assert.equal(m.rolls.X, 1);
  assert.deepEqual(m.frames.X, [{ r: [m.pins.X], strike: m.pins.X === 10, total: m.pins.X }]);
  assert.equal(m.last.down.filter(Boolean).length, m.last.knocked);
  // the other player: a fresh rack of their own; a gutter ball is a roll of nothing
  const g = E.applyMove(m, 'O', { aim: 0.45, power: 0.9 });
  assert.deepEqual([g.note, g.again, m.pins.O, m.last.gutter, m.frames.O], ['gutter', undefined, 0, true, [{ r: [0], strike: false, total: 0 }]]);
  // X's next turn: a fresh rack again
  const before = m.pins.X;
  assert.equal(E.applyMove(m, 'X', { aim: 0, power: 0.85 }).again, undefined);
  assert.ok(m.pins.X > before && m.frames.X.length === 2, 'a fresh rack: the same roll knocks pins again');
  // a strike (all ten down) is noted: the best angle of the computer's comes up with one over a few racks
  let strike = false; const rng = lcg(5);
  for (let k = 0; k < 40 && !strike; k++) { const t = mini('bowling', 'strike' + k); const ai = E.physAi(t, 'X', rng); const rr = E.applyMove(t, 'X', ai.move); if (rr.note === 'strike') { strike = true; assert.deepEqual([rr.again, t.frames.X[0].strike, t.pins.X], [undefined, true, 10]); } }
  assert.ok(strike, 'a strike within forty computer rolls');
  // 35 pins take the square (the target: the admin's setting)
  const w = mini('bowling', 'w'); w.pins.X = 30;
  let n = 0; while (w.pins.X < 35 && n++ < 10) { const rr = E.applyMove(w, 'X', { aim: 0, power: 0.85 }); if (rr.outcome === 'win') { assert.equal(rr.note, 'pins'); break; } }
  assert.ok(w.pins.X >= 35);
  assert.equal(E.bowlTarget(w), 35);
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

test('bowling: its settings (TUNE) are dealt into the square and played by: the target, a slower ball; the computer\'s error', () => {
  E.setTune('bowling', { vMax: 90, aiPow: 0, target: 12 });
  const m = mini('bowling', 'tune');
  E.setTune('bowling', null);
  assert.deepEqual(m.tune, { vMax: 90, aiPow: 0, target: 12 });
  assert.equal(E.bowlTarget(m), 12, 'the target as dealt');
  const t = JSON.parse(JSON.stringify(m)); t.pins.O = 11;
  assert.equal(E.applyMove(t, 'O', { aim: 0, power: 0.85 }).outcome, 'win', 'the dealt target takes the square');
  const slow = JSON.parse(JSON.stringify(m)), fast = Object.assign(JSON.parse(JSON.stringify(m)), { tune: undefined });
  E.applyMove(slow, 'X', { aim: 0.3, power: 1 }); E.applyMove(fast, 'X', { aim: 0.3, power: 1 });
  assert.ok(slow.last.ms > fast.last.ms, `the same roll is slower (${slow.last.ms} vs ${fast.last.ms} ms)`);
  const ai = E.physAi(E.publicMini(m), 'X', E.makeRng('ai'));
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(m)), 'X', ai.move).ok, true);
});
