'use strict';
// Simulations: Door Drop (slow, never part of npm test: `npm run sim -- doors`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('doors: 500 squares at Normal: the first mover and the turns each (the defaults: 3 floors of 4 doors, separate towers)', () => {
  const r = duel('doors', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('doors: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('doors', a, b, 4000, t)));
  T('defaults (4,000)', null);
  T('shared tower', { towers: 'shared' });
  T('Go again on success', { again: 'on' });
  T('2 floors of 4', { floors: 2 }); T('4 floors of 4', { floors: 4 }); T('3 floors of 3', { dmin: 3, dmax: 3 }); T('4 floors of 3', { floors: 4, dmin: 3, dmax: 3 }); T('3 floors of 5', { dmin: 5, dmax: 5 });
  T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Hard', null, 'hard', 'hard'); T('Normal v Easy', null, 'normal', 'easy'); T('Easy v Normal', null, 'easy', 'normal');
});
