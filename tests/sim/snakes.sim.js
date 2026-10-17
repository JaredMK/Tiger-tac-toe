'use strict';
// Simulations: Snakes and Ladders. Slow, so never part of npm test:
// npm run sim -- snakes
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

// ============================ Snakes and Ladders ============================
// Each rule checked on its own (not through snlValid), on many boards from many seeds.
test('snakes: 50,000 boards, every one keeps every placement rule', () => {
  const rows = k => Math.floor((k - 1) / 5);
  const seen = new Set();
  for (let k = 0; k < 50000; k++) {
    const b = L.snlBoard(L.makeRng('snl' + k));
    assert.equal(b.ladders.length, 2, 'two ladders'); assert.equal(b.snakes.length, 2, 'two snakes');
    const ends = [];
    for (const [a, c] of b.ladders) { assert.ok(c > a, `a ladder goes up (${a}->${c})`); ends.push(a, c); }
    for (const [a, c] of b.snakes) { assert.ok(c < a, `a snake goes down (${a}->${c})`); ends.push(a, c); }
    for (const [a, c] of b.ladders.concat(b.snakes)) {
      assert.ok(Math.abs(c - a) >= 3, `spans at least 3 spaces (${a}->${c})`);
      assert.notEqual(rows(a), rows(c), `crosses rows (${a}->${c})`);
      assert.notEqual(a, 1, 'nothing starts on space 1');
      assert.ok(a >= 1 && a <= 19 && c >= 1 && c <= 19, `nothing touches the top space (${a}->${c})`);
    }
    assert.equal(new Set(ends).size, 8, `no shared ends (${JSON.stringify(b)})`);
    const starts = b.ladders.concat(b.snakes).map(x => x[0]), finishes = b.ladders.concat(b.snakes).map(x => x[1]);
    assert.ok(starts.every(a => !finishes.includes(a)), 'nothing starts where another ends');
    assert.equal(L.snlValid(b), true);
    seen.add(JSON.stringify(b));
  }
  assert.ok(seen.size > 40000, `boards vary (${seen.size} different)`);
  // the checker itself refuses each kind of broken board
  const ok = { ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 12]] };
  assert.equal(L.snlValid(ok), true);
  for (const bad of [
    { ladders: [[1, 8], [9, 17]], snakes: [[14, 6], [19, 12]] },     // starts on 1
    { ladders: [[3, 20], [9, 17]], snakes: [[14, 6], [19, 12]] },    // touches the top
    { ladders: [[3, 5], [9, 17]], snakes: [[14, 6], [19, 12]] },     // too short
    { ladders: [[6, 9], [11, 17]], snakes: [[14, 4], [19, 12]] },    // one row (6 to 9)
    { ladders: [[3, 8], [8, 17]], snakes: [[14, 6], [19, 12]] },     // starts where another ends
    { ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 6]] },      // a shared end
    { ladders: [[8, 3], [9, 17]], snakes: [[14, 6], [19, 12]] },     // a ladder going down
  ]) assert.equal(L.snlValid(bad), false, JSON.stringify(bad));
});
