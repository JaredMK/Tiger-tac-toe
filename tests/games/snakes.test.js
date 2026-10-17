'use strict';
// Snakes and Ladders: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

test('snakes: a roll hops up from the start, then a ladder lifts and a snake drops; reaching or passing 20 wins', () => {
  const m = Object.assign(mini('snakes'), { ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 12]], pos: { X: 0, O: 0 } });
  assert.deepEqual(L.applyMove(m, 'X', 'roll', seq(pick(0, 6))), { ok: true, outcome: 'continue', note: 'roll' });
  assert.deepEqual(m.last, { by: 'X', roll: 1, from: 0, land: 1, to: 1, via: null }, 'a 1 from the start lands on space 1');
  assert.deepEqual(L.applyMove(m, 'X', 'roll', seq(pick(1, 6))), { ok: true, outcome: 'continue', note: 'ladder' });
  assert.deepEqual(m.last, { by: 'X', roll: 2, from: 1, land: 3, to: 8, via: 'ladder' }, 'up the ladder from 3 to 8');
  assert.equal(m.pos.X, 8);
  assert.deepEqual(L.applyMove(m, 'O', 'roll', seq(pick(5, 6))).note, 'roll');
  assert.equal(m.pos.O, 6, 'landing on a snake\'s tail does nothing');
  L.applyMove(m, 'O', 'roll', seq(pick(1, 6)));
  assert.equal(m.pos.O, 8, 'two pieces may share a space');
  assert.equal(L.applyMove(m, 'X', 'roll', seq(pick(5, 6))).note, 'snake');
  assert.deepEqual(m.last, { by: 'X', roll: 6, from: 8, land: 14, to: 6, via: 'snake' }, 'down the snake from 14 to 6');
  m.pos.X = 17;
  assert.deepEqual(L.applyMove(m, 'X', 'roll', seq(pick(2, 6))), { ok: true, outcome: 'win' }, '17 + 3 = 20: the top');
  m.pos.O = 18;
  assert.equal(L.applyMove(m, 'O', 'roll', seq(pick(5, 6))).outcome, 'win', 'passing the top wins too');
  assert.equal(m.pos.O, 20);
  m.pos.O = 13;
  assert.equal(L.applyMove(m, 'O', 'roll', seq(pick(5, 6))).note, 'snake', 'the snake at 19 still bites');
  assert.equal(m.pos.O, 12);
  assert.equal(L.applyMove(m, 'O', 1).ok, false, 'the move is a roll');
  const rolls = new Set();
  for (let k = 0; k < 600; k++) { const d = mini('snakes', L.makeRng('s' + k)); L.applyMove(d, 'X', 'roll', L.makeRng('r' + k)); rolls.add(d.last.roll); }
  assert.deepEqual([...rolls].sort(), [1, 2, 3, 4, 5, 6]);
});

test('snakes: the odds and expected rolls come from the board; random play always finishes', () => {
  const b = { type: 'snakes', ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 12]], pos: { X: 0, O: 0 } };
  const E = L.snlExpected(b), plain = L.snlExpected({ type: 'snakes', ladders: [], snakes: [], pos: { X: 0, O: 0 } });
  assert.equal(E[20], 0);
  assert.ok(E[0] > 1 && E[0] < plain[0] + 3, `from the start: ${E[0].toFixed(2)} rolls`);
  assert.ok(E[17] < E[13], 'higher up, fewer rolls (17 vs 13)');
  assert.equal(L.localBest(Object.assign({}, b, { pos: { X: 16, O: 0 } }), 'X', cpuRng()).q, 3 / 6, '4, 5 or 6 reaches the top');
  assert.equal(L.localBest(b, 'X', cpuRng()).move, 'roll');
  assert.equal(L.randomLegalMove(L.newMini('snakes', lcg(3)), 'O'), 'roll');
  for (let k = 0; k < 200; k++) {
    const m = L.newMini('snakes', L.makeRng('play' + k)), r = L.makeRng('roll' + k);
    let n = 0, out;
    do { out = L.applyMove(m, n % 2 ? 'O' : 'X', 'roll', r); n++; } while (out.outcome !== 'win' && n < 2000);
    assert.equal(out.outcome, 'win');
  }
});
