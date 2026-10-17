'use strict';
// Higher/Lower: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

// ============================== Higher / lower ==============================
test('hilo: the number comes from the rng, guesses narrow the range, the number wins', () => {
  for (let k = 0; k < 20; k++) assert.equal(L.newMini('hilo', seq(pick(k, 20))).target, k + 1);
  const m = L.newMini('hilo', seq(pick(12, 20)));   // target 13
  assert.equal(m.target, 13);
  assert.equal(L.applyMove(m, 'X', 0).ok, false);
  assert.equal(L.applyMove(m, 'X', 21).ok, false);
  assert.equal(L.applyMove(m, 'X', 2.5).ok, false);
  assert.deepEqual(L.applyMove(m, 'X', 10), { ok: true, outcome: 'continue', note: 'higher' });
  assert.equal(m.lo, 11); assert.equal(m.hi, 20);
  assert.deepEqual(L.applyMove(m, 'X', 15), { ok: true, outcome: 'continue', note: 'lower' });
  assert.equal(m.hi, 14);
  assert.equal(L.applyMove(m, 'O', 10).ok, false, 'outside the remaining range');
  assert.equal(L.applyMove(m, 'O', 13).outcome, 'win');
  assert.deepEqual(m.guesses.map(g => [g.by, g.n, g.res]), [['X', 10, 'higher'], ['X', 15, 'lower'], ['O', 13, 'hit']]);
});

test('hilo: guessing inside the range always ends the game, for every target', () => {
  for (let t = 1; t <= 20; t++) {
    const m = L.newMini('hilo', seq(pick(t - 1, 20)));
    let r, n = 0;
    do { r = L.applyMove(m, 'X', m.lo); n++; } while (r.outcome !== 'win' && n < 25);
    assert.equal(r.outcome, 'win', `target ${t}`);
    assert.equal(n, t, 'counting up from 1 takes exactly t guesses');
  }
});
