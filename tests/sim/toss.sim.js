'use strict';
// Simulations: Bin Shot (slow, never part of npm test: `npm run sim -- toss`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's aim error stands in for a
// finger: real play decides the bin's size.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('toss: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('toss', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('toss: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('toss', a, b, 8000, t)));
  T('the defaults, 8,000 squares', null);
  T('2 baskets', { goal: 2 }); T('4 baskets', { goal: 4 }); T('bin 8', { bin: 8 }); T('bin 12', { bin: 12 }); T('no fan', { windMin: 0, windMax: 0 }); T('bin at 60', { dist: 60 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
