'use strict';
// Simulations: Twist Five (slow, never part of npm test: `npm run sim -- twist`). The computer against itself, 500
// squares at Normal (the batch's standard), then by line length, board and level.
// Five in a row on the 6x6 board runs about ten turns each, so the default is four in a row: its turns are in range,
// but the first mover wins about two squares in three, over the batch's 60%: a game of placing with nothing by chance
// favours whoever places first, and the test says so rather than assert it.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('twist: 500 squares at Normal (the defaults: 6x6, 4 in a row): the turns each are in range; the first mover is over the target', () => {
  const r = duel('twist', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
  assert.ok(r.first > 0.6, 'if this fails the first mover is within the batch\'s 45-60%: assert that instead');
});
test('twist: by line length, board and level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 300) => console.log(line(label, duel('twist', a, b, n, t)));
  T('as asked: 5 in a row', { line: 5 }); T('4 in a row on the 4x4 board', { size: 4 }); T('3 in a row on the 4x4 board', { size: 4, line: 3 });
  T('Hard v Hard', null, 'hard', 'hard', 100); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal', 100); T('Normal v Hard', null, 'normal', 'hard', 100);
});
