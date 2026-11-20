'use strict';
// Simulations: Point Roll (slow, never part of npm test: `npm run sim -- proll`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('proll: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('proll', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('proll: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('proll', a, b, 10000, t)));
  T('the defaults, 10,000 squares', null);
  T('target 12', { target: 12 }); T('target 15', { target: 15 }); T('points 7/4/3/2/2', { p2: 7, p3: 4, p4: 3, p5: 2, p6: 2 }); T('points 14/8/6/5/5', { p6: 5 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
