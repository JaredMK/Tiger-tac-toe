'use strict';
// Candy Race: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
const colorRng = name => seq(pick(L.CANDY.colors.indexOf(name), L.CANDY.colors.length));

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

// ================================== Candy race ==================================
test('candy: twelve random colours with the same colour never within two spaces of itself', () => {
  const rng = lcg(3);
  const seen = new Set();
  for (let k = 0; k < 10000; k++) {
    const track = L.candyTrack(rng);
    assert.equal(track.length, L.CANDY.len);
    for (let i = 0; i < track.length; i++) {
      assert.ok(L.CANDY.colors.includes(track[i]));
      if (i >= 1) assert.notEqual(track[i], track[i - 1], `track ${track.join(',')}: repeat at ${i}`);
      if (i >= 2) assert.notEqual(track[i], track[i - 2], `track ${track.join(',')}: repeat two apart at ${i}`);
      seen.add(track[i]);
    }
  }
  assert.deepEqual([...seen].sort(), [...L.CANDY.colors].sort(), 'every colour gets used');
  const m = mini('candy');
  for (let i = 2; i < m.track.length; i++) assert.ok(new Set(m.track.slice(i - 2, i + 1)).size === 3, 'newMini uses the spaced track');
  assert.deepEqual(m.pos, { X: -1, O: -1 });
});

test('candy: the token hops to the next space of the spun colour, sharing a space is fine', () => {
  const m = Object.assign(mini('candy'), { track: ['red', 'blue', 'green', 'red', 'blue', 'yellow', 'red', 'green', 'blue', 'red', 'yellow', 'green'] });
  assert.deepEqual(L.applyMove(m, 'X', 1, colorRng('blue')), { ok: true, outcome: 'continue', note: 'spin' });
  assert.equal(m.pos.X, 1);
  assert.deepEqual(m.last, { by: 'X', color: 'blue', from: -1, to: 1 });
  L.applyMove(m, 'X', 1, colorRng('red'));    // next red after space 1 is 3
  assert.equal(m.pos.X, 3);
  L.applyMove(m, 'O', 1, colorRng('red'));    // O from the start: first red is 0
  assert.equal(m.pos.O, 0);
  L.applyMove(m, 'O', 1, colorRng('red'));
  assert.equal(m.pos.O, 3, 'both tokens on space 4');
  L.applyMove(m, 'X', 1, colorRng('yellow')); // 5
  assert.equal(m.pos.X, 5);
});

test('candy: no space of that colour ahead means the finish, which wins', () => {
  const m = Object.assign(mini('candy'), { track: ['red', 'blue', 'green', 'red', 'blue', 'yellow', 'red', 'green', 'blue', 'red', 'yellow', 'green'] });
  m.pos.X = 9;                                // the last blue is 8
  assert.equal(L.applyMove(m, 'X', 1, colorRng('blue')).outcome, 'win');
  assert.equal(m.pos.X, L.CANDY.len);
  const n = Object.assign(mini('candy'), { track: ['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow'] });
  assert.equal(L.applyMove(n, 'O', 1, colorRng('blue')).outcome, 'win', 'a colour missing from the track finishes at once');
  assert.equal(L.applyMove(n, 'X', 1, colorRng('red')).outcome, 'continue');
  assert.equal(n.pos.X, 0);
});

test('candy: X can spin on consecutive turns and win before O ever spins (lopsided)', () => {
  const st = matchWith(['candy', 'ttt']);
  st.squares[0].mini.track = ['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow'];
  turn(st, 0, 1, colorRng('red')); turn(st, 1, 0);
  assert.equal(st.squares[0].mini.pos.X, 0);
  const f = turn(st, 0, 1, colorRng('blue'));   // none ahead
  assert.equal(f.kind, 'claim');
  assert.equal(f.color, 'blue');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(st.squares[0].mini.pos.O, -1);
});
