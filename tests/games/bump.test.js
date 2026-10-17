'use strict';
// Bump: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

// ---- helpers ----
// rng that yields a fixed sequence of values in [0, 1)
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
// rng value that makes randInt(rng, n) return k
const pick = (k, n) => (k + 0.5) / n;
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (type, rng) => L.newMini(type, rng || lcg(11));

// ================================ Computer player ================================
const cpuRng = () => lcg(314);

// ================================== Bump ==================================
test('bump: a spin of 1, 2 or 3 hops forward; landing on the other piece sends it home; reaching the Finish wins', () => {
  const m = mini('bump');
  assert.deepEqual(m.pos, { X: 0, O: 0 }, 'both start at Home');
  assert.deepEqual(L.applyMove(m, 'X', 'spin', seq(pick(1, 3))), { ok: true, outcome: 'continue', note: 'spin' });
  assert.deepEqual(m.last, { by: 'X', spin: 2, from: 0, to: 2, bumped: false });
  assert.deepEqual(L.applyMove(m, 'O', 'spin', seq(pick(1, 3))), { ok: true, outcome: 'continue', note: 'bump' }, 'O lands on X');
  assert.deepEqual(m.pos, { X: 0, O: 2 }, 'X is back at Home');
  assert.equal(m.last.bumped, true);
  L.applyMove(m, 'X', 'spin', seq(pick(2, 3)));
  assert.deepEqual(m.pos, { X: 3, O: 2 }, 'hopping past a piece does not bump it');
  L.applyMove(m, 'O', 'spin', seq(pick(2, 3)));
  assert.deepEqual(m.pos, { X: 3, O: 5 });
  m.pos.X = 7;
  assert.deepEqual(L.applyMove(m, 'X', 'spin', seq(pick(2, 3))), { ok: true, outcome: 'win' }, '7 + 3 = 10: the Finish');
  m.pos = { X: 9, O: 1 };
  assert.equal(L.applyMove(m, 'X', 'spin', seq(pick(2, 3))).outcome, 'win', 'passing the Finish wins too');
  assert.equal(m.pos.X, 10);
  m.pos = { X: 8, O: 9 };
  assert.equal(L.applyMove(m, 'O', 'spin', seq(pick(0, 3))).outcome, 'win');
  assert.equal(m.last.bumped, false, 'the Finish bumps nobody');
  assert.equal(L.applyMove(m, 'X', 'roll').ok, false, 'the move is a spin');
  const spins = { 1: 0, 2: 0, 3: 0 };
  for (let k = 0; k < 3000; k++) { const d = mini('bump'); L.applyMove(d, 'X', 'spin', L.makeRng('b' + k)); spins[d.last.spin]++; }
  for (const v of [1, 2, 3]) assert.ok(spins[v] > 850 && spins[v] < 1150, `even odds (${JSON.stringify(spins)})`);
  assert.equal(L.localBest({ type: 'bump', pos: { X: 8, O: 0 } }, 'X', cpuRng()).q, 2 / 3, '2 or 3 finishes from 8');
  assert.equal(L.localBest({ type: 'bump', pos: { X: 0, O: 0 } }, 'X', cpuRng()).q, 0);
  assert.equal(L.randomLegalMove(mini('bump'), 'X'), 'spin');
});
