'use strict';
// Simulations: Target Practice (slow, never part of npm test: `npm run sim -- target`). The computer against itself,
// 500 squares at Normal (the batch's standard), then by setting and by level. The computer's aim error stands in for
// a finger's: 7 field units at Normal (a normal spread on each slider), 4 at Hard, 11 at Easy.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('target: 500 squares at Normal: the first mover and the turns each (the defaults: 4 targets of 11, the circle 5 to 26)', () => {
  const r = duel('target', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('target: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('target', a, b, 6000, t)));
  T('the defaults, 6,000 squares', null);
  T('as asked: 5 targets', { targets: 5 }); T('3 targets', { targets: 3 }); T('5 bigger targets (14)', { targets: 5, size: 14 }); T('smaller targets (9)', { size: 9 }); T('a smaller circle (3 to 20)', { circleMin: 3, circleMax: 20 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
