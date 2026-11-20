'use strict';
// Simulations: Mystery Face (slow, never part of npm test: `npm run sim -- faces`). The computer against itself, 500
// squares at Normal (the batch's standard), then by clue, board and level.
// It does NOT meet the batch's targets (first mover 45-60%, median 3-6 turns each), and the test says so rather than
// assert them: sixteen faces are four bits, and any clue worth the name gives a careful guesser more than one, so the
// mystery face is found in two or three guesses whatever the clue; in so short a race the first mover is far ahead.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('faces: 500 squares at Normal (the defaults: 16 faces, 5 features of 3 kinds, a tick or cross on each): every square ends; the targets are missed', () => {
  const r = duel('faces', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0);
  assert.ok(r.eachMed < 3, 'if this fails the game has got longer: put the batch\'s targets back in this test');
});
test('faces: by clue, board and level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('faces', a, b, 3000, t)));
  T('a tick or cross on each (the default), 3,000 squares', null);
  T('one feature in common', { clue: 'one' }); T('how many match', { clue: 'count' });
  T('20 faces, 4 kinds, one in common', { clue: 'one', faces: 20, vals: 4 }); T('16 faces, 2 kinds, one in common', { clue: 'one', vals: 2 }); T('20 faces, 2 kinds, how many match', { clue: 'count', faces: 20, vals: 2 });
  T('one mystery face for both', { boards: 'shared' }); T('one for both, how many match', { boards: 'shared', clue: 'count' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
