'use strict';
// Simulations: Home Run Heroes (slow, never part of npm test: `npm run sim -- homer`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's timing error stands in for a
// finger's: 100 ms at Normal, 60 at Hard, 150 at Easy.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('homer: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('homer', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('homer: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('homer', a, b, 6000, t)));
  T('the defaults, 6,000 squares', null);
  T('3 home runs to win (as asked)', { goal: 3 }); T('5 home runs', { goal: 5 }); T('a 35 ms window, Normal at 75 ms, 3 to win (the first cut)', { goal: 3, hrMs: 35, aiMs: 75 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
