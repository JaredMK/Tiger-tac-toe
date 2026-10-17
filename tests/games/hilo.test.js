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
test('hilo: the number comes from the rng (1 to 30), guesses narrow the range, the number wins', () => {
  for (let k = 0; k < 30; k++) assert.equal(L.newMini('hilo', seq(pick(k, 30))).target, k + 1);
  const m = L.newMini('hilo', seq(pick(12, 30)));   // target 13
  assert.deepEqual([m.target, m.lo, m.hi, m.top, m.limit], [13, 1, 30, 30, 5]);
  assert.equal(L.applyMove(m, 'X', 0).ok, false);
  assert.equal(L.applyMove(m, 'X', 31).ok, false);
  assert.equal(L.applyMove(m, 'X', 2.5).ok, false);
  assert.deepEqual(L.applyMove(m, 'X', 10), { ok: true, outcome: 'continue', note: 'higher' });
  assert.equal(m.lo, 11); assert.equal(m.hi, 30);
  assert.deepEqual(L.applyMove(m, 'X', 15), { ok: true, outcome: 'continue', note: 'lower' });
  assert.equal(m.hi, 14);
  assert.equal(L.applyMove(m, 'O', 10).ok, false, 'outside the remaining range');
  assert.equal(L.applyMove(m, 'O', 13).outcome, 'win');
  assert.deepEqual(m.guesses.map(g => [g.by, g.n, g.res]), [['X', 10, 'higher'], ['X', 15, 'lower'], ['O', 13, 'hit']]);
  assert.deepEqual(E.publicMini(m).limit, 5); assert.equal('target' in E.publicMini(m), false);
});

test('hilo: an older square (1 to 20, no limit) plays on as it was: counting up always ends the game', () => {
  for (let t = 1; t <= 20; t++) {
    const m = { type: 'hilo', target: t, lo: 1, hi: 20, guesses: [] };
    let r, n = 0;
    do { r = L.applyMove(m, 'X', m.lo); n++; } while (r.outcome !== 'win' && n < 25);
    assert.equal(r.outcome, 'win', `target ${t}`);
    assert.equal(n, t, 'counting up from 1 takes exactly t guesses');
    assert.equal(r.winner, undefined, 'the guesser\'s');
  }
});

test('hilo: each player has 5 guesses; a 5th that misses hands the square to the other player (either side)', () => {
  const m = L.newMini('hilo', seq(pick(29, 30)));   // target 30
  for (const n of [1, 2, 3, 4]) assert.equal(L.applyMove(m, 'X', n).outcome, 'continue');
  for (const n of [5, 6, 7, 8]) assert.equal(L.applyMove(m, 'O', n).outcome, 'continue', 'O\'s own five');
  assert.deepEqual([E.hiloLeft(m, 'X'), E.hiloLeft(m, 'O')], [1, 1]);
  assert.deepEqual(L.applyMove(m, 'O', 9), { ok: true, outcome: 'win', winner: 'X', note: 'out' }, 'O\'s 5th misses: X claims');
  const m2 = L.newMini('hilo', seq(pick(29, 30)));
  for (const n of [1, 2, 3, 4]) L.applyMove(m2, 'X', n);
  assert.deepEqual(L.applyMove(m2, 'X', 5), { ok: true, outcome: 'win', winner: 'O', note: 'out' }, 'X\'s 5th misses: O claims');
  assert.equal(L.applyMove(m2, 'X', 6).reason, 'out', 'no 6th guess');
  const m3 = L.newMini('hilo', seq(pick(4, 30)));   // target 5
  for (const n of [1, 2, 3, 4]) L.applyMove(m3, 'X', n);
  assert.deepEqual(L.applyMove(m3, 'X', 5), { ok: true, outcome: 'win' }, 'a 5th that finds it wins');
  // through the match: the square is the other player's, and the flash says so
  const st = L.newMatch(seq(0.5));
  st.squares[0].mini = L.newMini('hilo', seq(pick(29, 30)));
  st.squares[0].mini.guesses = [1, 2, 3, 4].map(n => ({ by: 'X', n, res: 'higher' })); st.squares[0].mini.lo = 5;
  const r = L.playMove(st, 0, 5);
  assert.equal(r.ok, true);
  assert.equal(st.squares[0].owner, 'O');
  assert.equal(r.flash.kind, 'claim'); assert.equal(r.flash.winner, 'O'); assert.equal(r.flash.note, 'out');
});

test('hilo: the computer halves the range, finds any number from 1 to 30 within its 5 guesses alone, and avoids a last-guess gamble', () => {
  for (let t = 1; t <= 30; t++) {
    const m = L.newMini('hilo', seq(pick(t - 1, 30)));
    let r, n = 0;
    do { r = L.applyMove(m, 'X', L.localBest(E.publicMini(m), 'X', seq(0.5)).move); n++; } while (r.outcome !== 'win' && n < 6);
    assert.equal(r.outcome, 'win'); assert.equal(r.winner, undefined, `target ${t}: found by X`);
    assert.ok(n <= 5, `target ${t}: ${n} guesses`);
  }
  const pm = { type: 'hilo', lo: 1, hi: 10, top: 30, limit: 5, guesses: [1, 2, 3, 4].map(n => ({ by: 'X', n: 30 - n, res: 'lower' })) };
  const b = L.localBest(pm, 'X', seq(0.5));
  assert.ok(b.qLose > 0.8, 'its last guess on 10 numbers: a likely loss');
  assert.ok(E.moveGain(pm, 'X', b) < 0, 'not worth it');
  assert.equal(L.localBest(pm, 'O', seq(0.5)).qLose, 0, 'O still has all five');
});
