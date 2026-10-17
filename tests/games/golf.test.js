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
