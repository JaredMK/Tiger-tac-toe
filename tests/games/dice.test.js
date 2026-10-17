'use strict';
// Dice Race: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

function matchWith(types, rng = lcg(7)) {
  const st = L.newMatch(rng);
  types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
  return st;
}
// make one full turn as the UI does: the move, then the result overlay clearing, which (unless the
// same player goes again or the match is over) brings the board back and passes the turn
function turn(st, i, m, rng) {
  const r = L.playMove(st, i, m, rng || lcg(99));
  assert.equal(r.ok, true, `move ${JSON.stringify(m)} in square ${i} should be accepted (${r.reason})`);
  const flash = st.flash;
  L.endFlash(st);
  return flash;
}
const mini = (type, rng) => L.newMini(type, rng || lcg(11));

// ================================ Dice race ================================
test('dice: a roll of 1 to 6 comes from the rng and moves the roller, reaching or passing the finish (space 16) wins', () => {
  const m = mini('dice');
  assert.deepEqual(L.applyMove(m, 'X', 1, seq(pick(3, 6))), { ok: true, outcome: 'continue', note: 'roll' });
  assert.deepEqual(m.totals, { X: 4, O: 0 });
  assert.deepEqual(m.last, { by: 'X', roll: 4 });
  L.applyMove(m, 'O', 1, seq(pick(5, 6)));
  assert.deepEqual(m.totals, { X: 4, O: 6 });
  L.applyMove(m, 'X', 'whatever', seq(pick(5, 6)));   // the move value is ignored, only the roll matters
  L.applyMove(m, 'X', 1, seq(pick(4, 6)));
  assert.equal(m.totals.X, 15, 'on the last numbered space, not finished yet');
  assert.equal(L.applyMove(m, 'X', 1, seq(pick(0, 6))).outcome, 'win');   // 4 + 6 + 5 + 1 = 16: the finish
  assert.deepEqual(m.totals, { X: 16, O: 6 });
  const far = mini('dice');
  L.applyMove(far, 'O', 1, seq(pick(5, 6))); L.applyMove(far, 'O', 1, seq(pick(5, 6)));
  assert.equal(L.applyMove(far, 'O', 1, seq(pick(5, 6))).outcome, 'win', 'passing the finish wins too');
  assert.equal(far.totals.O, 18);
  const seen = new Set();
  for (let k = 0; k < 500; k++) { const d = mini('dice'); L.applyMove(d, 'X', 1, Math.random); seen.add(d.last.roll); }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
});

test('dice: three straight rolls by one player can win before the other ever rolls (lopsided)', () => {
  const st = matchWith(['dice', 'ttt']);
  turn(st, 0, 1, seq(pick(5, 6))); turn(st, 1, 0);
  turn(st, 0, 1, seq(pick(5, 6))); turn(st, 1, 1);
  const f = turn(st, 0, 1, seq(pick(3, 6)));
  assert.equal(f.kind, 'claim');
  assert.deepEqual(st.squares[0].mini.totals, { X: 16, O: 0 });
});
