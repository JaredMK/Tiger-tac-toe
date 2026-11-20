'use strict';
// Simulations: Trail Race (slow, never part of npm test: `npm run sim -- trail`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
// IT DOES NOT MEET THE BATCH'S FAIRNESS TARGET AND THIS FILE SAYS SO RATHER THAN ASSERT IT. Nothing is hidden and
// nothing is by chance, so who wins is a matter of tempo and of the board's size: between two Normal computers a board
// of 6 gives the first to move 55% in 4 turns each (inside both targets, and so the default), a board of 7 (as first
// asked for) gives the SECOND to move 70% over 8 turns each, and between two Hard computers the first to move takes
// every square at every size (it simply races). Equal turns (the setting) turns that into a draw every time.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('trail: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('trail', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('trail: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 1500) => console.log(line(label, duel('trail', a, b, n, t)));
  T('the defaults, 1,500 squares', null);
  T('1 square a turn', { cells: 1 }); T('3 squares a turn', { cells: 3 }); T('board 5', { size: 5 }); T('board 7 (as first asked for)', { size: 7 }); T('board 8', { size: 8 }); T('board 8, 3 squares', { size: 8, cells: 3 }); T('board 9', { size: 9 });
  T('equal turns', { even: 'on' }); T('equal turns, Hard v Hard', { even: 'on' }, 'hard', 'hard', 200);
  T('Hard v Hard', null, 'hard', 'hard', 400); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal', 400); T('Normal v Hard', null, 'normal', 'hard', 400);
});
