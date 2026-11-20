'use strict';
// Simulations: Peg Jump Race (slow, never part of npm test: `npm run sim -- pegs`). The computer against itself, 500
// squares at Normal (the batch's standard), then by board and by level.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('pegs: 500 squares at Normal: the first mover and the turns each (the defaults: 3 pegs, 4 rows by 5 columns)', () => {
  const r = duel('pegs', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('pegs: by board and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 2000) => console.log(line(label, duel('pegs', a, b, n, t)));
  T('the defaults, 2,000 squares', null);
  T('3 rows', { rows: 3 }); T('5 rows', { rows: 5 }); T('4 columns', { cols: 4 }); T('6 columns', { cols: 6 }); T('2 pegs', { pegs: 2 }); T('4 pegs', { pegs: 4 });
  T('Hard v Hard', null, 'hard', 'hard', 400); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal', 400); T('Normal v Hard', null, 'normal', 'hard', 400);
});
