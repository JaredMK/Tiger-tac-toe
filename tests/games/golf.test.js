'use strict';
// Mini Golf: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('golf: the ball drops in the cup only when slow enough, else it lips out; the first ball in takes the square, even knocked in by the other', () => {
  const m = mini('golf', 'cup'); m.hole = 2;                     // (the horseshoe: a clear run up to the cup from below)
  const cup = P.HOLES[2].cup;
  m.balls.X = [cup[0], cup[1] + 36]; m.balls.O = [90, 150];
  const soft = E.applyMove(JSON.parse(JSON.stringify(m)), 'X', { aim: 0, power: 0.45 });
  assert.deepEqual([soft.outcome, soft.note, soft.winner], ['win', 'holed', 'X'], 'a soft putt drops');
  const hard = JSON.parse(JSON.stringify(m)), hr = E.applyMove(hard, 'X', { aim: 0, power: 1 });
  assert.equal(hr.outcome, 'continue'); assert.equal(hr.note, 'lip', 'a hard one lips out');
  assert.ok(hard.last.events.some(e => e.k === 'lip') && !hard.holed.X && hard.balls.X[1] !== m.balls.X[1]);
  assert.equal(hard.shots.X, 1);
  // the other ball, sitting by the cup, knocked in: the square goes to its owner
  const knock = mini('golf', 'knock'); knock.hole = 2;
  knock.balls.O = [cup[0], cup[1] + 7]; knock.balls.X = [cup[0], cup[1] + 30];
  const kr = E.applyMove(knock, 'X', { aim: 0, power: 0.35 });
  assert.equal(kr.outcome, 'win'); assert.equal(kr.winner, 'O', `O's ball went in first (${kr.note})`);
  assert.ok(knock.holed.O);
  for (const bad of [null, 'x', { aim: 'a', power: 0.5 }, { aim: 0, power: 1.5 }, { aim: 4, power: 0.5 }]) assert.equal(E.applyMove(mini('golf', 'b'), 'X', bad).ok, false);
});

test('golf: the page may choose a new square\'s hole (a local game: a layout the device has not had lately); without a choice, any of the 42', () => {
  const seen = new Set();
  for (let k = 0; k < 400; k++) seen.add(E.newMini('golf', E.makeRng('pick' + k)).hole);
  assert.equal(seen.size, P.HOLES.length, 'any hole, mirrored ones too');
  E.setGolfPick((rng, holes) => holes.findIndex(h => h.name === 'Moat, mirrored'));
  try { assert.equal(P.HOLES[E.newMini('golf', lcg(1)).hole].name, 'Moat, mirrored', 'the page\'s choice'); E.setGolfPick(() => null); assert.ok(E.newMini('golf', lcg(2)).hole >= 0, 'no choice: any'); E.setGolfPick(() => 99); assert.ok(E.newMini('golf', lcg(3)).hole < P.HOLES.length, 'a choice out of range: any'); }
  finally { E.setGolfPick(null); }
  const m = E.newMini('golf', lcg(4)), tee = P.HOLES[m.hole].tee;
  assert.deepEqual(m.balls, { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] }, 'both balls on that hole\'s tee');
});

test('golf: a bumper kicks the ball straight off it, faster than it came (a bump event for the flash and the sound), unlike a wall', () => {
  P.HOLES.push({ name: 'test', tee: [50, 150], cup: [90, 10], walls: [[50, 60, 30, 5, 0]], bumpers: [[50, 80, 4]], path: [[90, 10]] });
  try {
    const h = P.HOLES.length - 1, m = Object.assign(mini('golf', 'kick'), { hole: h, balls: { X: [50, 140], O: [8, 152] }, holed: { X: false, O: false } });
    const speedAt = (r, t) => { const i = r.rec.ids.indexOf('X') * 2, f = r.rec.frames, k = Math.max(1, Math.min(f.length - 1, Math.round(t * r.rec.fps))); return Math.hypot(f[k][i] - f[k - 1][i], f[k][i + 1] - f[k - 1][i + 1]) * r.rec.fps; };
    const r = P.run('golf', m, 'X', { aim: 0.02, power: 0.6 }), bump = r.events.find(e => e.k === 'bump');
    assert.ok(bump && bump.b === 0 && bump.id === 'X', 'the ball hits the bumper');
    assert.ok(!r.events.some(e => e.k === 'wall' && Math.abs(e.t - bump.t) < 0.02), 'a bump, not a wall');
    const before = speedAt(r, bump.t - 2 / r.rec.fps), after = speedAt(r, bump.t + 3 / r.rec.fps);
    assert.ok(after > before + 8, `kicked off faster (${before.toFixed(1)} → ${after.toFixed(1)} u/s)`);
    assert.ok(r.final.X[1] > 84, 'and back the way it came');
    // a slow roll into it is kicked off all the same
    const slow = P.run('golf', Object.assign({}, m, { balls: { X: [50, 92], O: [8, 152] } }), 'X', { aim: 0, power: 0.2 });
    assert.ok(slow.events.some(e => e.k === 'bump'), 'a slow ball still pops off');
    assert.ok(P.LAYOUTS.every(hh => hh.bumpers.length >= 3), 'every layout has its bumpers');
  } finally { P.HOLES.pop(); }
});
