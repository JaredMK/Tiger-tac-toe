'use strict';
// Simulations: Maze Runner (slow, never part of npm test: `npm run sim -- maze`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('maze: 500 squares at Normal: the first mover and the turns each (the defaults: a 6x6 maze each, 6 turns alone)', () => {
  const r = duel('maze', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 5, `median turns ${r.eachMed}`);
});
test('maze: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('maze', a, b, 2500, t)));
  T('the defaults, 2,500 squares', null);
  T('5x5, 4 turns alone', { size: 5, turns: 4 }); T('5x5, 5 turns alone', { size: 5, turns: 5 }); T('6x6, 5 turns alone', { turns: 5 }); T('7x7, 8 turns alone', { size: 7, turns: 8 });
  T('one shared maze', { boards: 'shared' }); T('one shared 5x5, 5 turns', { boards: 'shared', size: 5, turns: 5 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
