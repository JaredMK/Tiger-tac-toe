'use strict';
// Simulations: Maze Runner (slow, never part of npm test: `npm run sim -- maze`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. December 2026's rework aimed at a median of
// 5 to 7 turns each with the first mover on 45-60%: the defaults are a maze 8 wide and 10 tall each, the door bottom
// left and the flag top right, grown 60% from random cells (the rest newest-first), no path to the flag under 22 cells,
// and dealt to take a runner alone 8 turns.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('maze: 500 squares at Normal: the first mover and the turns each (the defaults: a maze each, 8 by 10)', () => {
  const r = duel('maze', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 5 && r.eachMed <= 7, `median turns ${r.eachMed}`);
});
test('maze: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 1000) => console.log(line(label, duel('maze', a, b, n, t)));
  T('the defaults, 2,000 squares', null, 'normal', 'normal', 2000);
  T('the old 6 by 6, 6 turns alone', { cols: 6, rows: 6, minPath: 10, turns: 6, branch: 100 });
  T('branching 100%', { branch: 100 }); T('branching 30%', { branch: 30 }); T('7 turns alone', { turns: 7 }); T('9 turns alone', { turns: 9 });
  T('10 by 12, 10 turns alone', { cols: 10, rows: 12, minPath: 28, turns: 10 });
  T('one shared maze, a runner each', { boards: 'shared' }); T('one maze, one runner', { boards: 'one' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
