'use strict';
// What the race games (Snakes and Ladders, Candy Race, Bump, the Dice race) share, tested once for all of them (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
// Trivia needs its questions (the page fetches trivia.json; the server has it as a file): a small made-up bank here.
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
// The engine takes all its randomness from the caller. Where a test does not care which random choice
// is made, these wrappers hand it a fixed seeded generator.
const anyRng = () => E.makeRng('any');
const L = Object.assign({}, E, {
  newState: rng => E.newState(rng || anyRng()),
  startMatch: (st, rng) => E.startMatch(st, rng || anyRng()),
  newMatch: (rng, setup) => E.newMatch(rng || anyRng(), setup),
  playMove: (st, i, m, rng, opts) => E.playMove(st, i, m, rng || anyRng(), opts),
  cpuMove: (st, rng) => E.cpuMove(st, rng || anyRng()),
  timeoutMove: (st, rng) => E.timeoutMove(st, rng || anyRng()),
  randomLegalMove: (mini, p, rng) => E.randomLegalMove(mini, p, rng || anyRng()),
  applyMove: (mini, p, m, rng, ...rest) => E.applyMove(mini, p, m, rng || anyRng(), ...rest),
});
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

// ================================ Computer player ================================
const cpuRng = () => lcg(314);

test('candy race and dice race: the odds are read from the public state', () => {
  const E = L.candyExpected(['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow']);
  assert.ok(E[0] > 1 && E[0] < 4, `start: ${E[0]} spins expected`);
  assert.ok(E[12] >= 1 && E[12] < E[0], 'closer to the finish, fewer spins');
  assert.equal(E[13], 0);
  const noBlue = L.localBest({ type: 'candy', track: ['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow'], pos: { X: 9, O: -1 } }, 'X', cpuRng());
  assert.equal(noBlue.q, 0.5, 'blue or red from space 10 goes straight to the finish');
  assert.equal(L.localBest({ type: 'dice', totals: { X: 12, O: 0 } }, 'X', cpuRng()).q, 3 / 6, 'four spaces short: a 4, 5 or 6 finishes');
  assert.equal(L.localBest({ type: 'dice', totals: { X: 0, O: 0 } }, 'X', cpuRng()).q, 0);
  assert.ok(L.needsOf({ type: 'dice', totals: { X: 12, O: 0 } }, 'X') < L.needsOf({ type: 'dice', totals: { X: 0, O: 0 } }, 'X'));
  assert.equal(L.winChance(0, 3), 1); assert.equal(L.winChance(3, 0), 0); assert.equal(L.winChance(2, 2), 0.5); assert.equal(L.winChance(Infinity, Infinity), 0.5);
});
