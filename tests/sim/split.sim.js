'use strict';
// Simulations: Shape Split (slow, never part of npm test: `npm run sim -- split`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's error stands in for an eye's:
// 6 points of a percent at Normal (a normal spread), 3 at Hard, 10 at Easy.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('split: 500 squares at Normal: the first mover and the turns each (the defaults: bands 1/3/6 for 3/2/1, 6 to win)', () => {
  const r = duel('split', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('split: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('split', a, b, 6000, t)));
  T('the defaults, 6,000 squares', null);
  T('as asked: bands 2/5/10, 5 to win', { band1: 2, band2: 5, band3: 10, target: 5 }); T('bands 2/5/10, 8 to win', { band1: 2, band2: 5, band3: 10, target: 8 });
  T('bands 1/3/6, 5 to win', { target: 5 }); T('bands 1/3/6, 8 to win', { target: 8 }); T('bands 1/2/4, 5 to win', { band2: 2, band3: 4, target: 5 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
