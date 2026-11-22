'use strict';
// Simulations: Puzzle Build (slow, never part of npm test: `npm run sim -- jigsaw`). The computer against itself, 500
// squares at Normal (the batch's standard), then by level, by setting and by grid.
// What it finds, plainly. The rule as first asked for (a 3 by 3 puzzle with its centre in place, `centre` on: eight pieces between two players,
// more than half takes the square) meets the batch's length (Normal v Normal about 5.2 turns each, median 5) and MISSES
// two things, and this test says so rather than assert them:
//   - DRAWS. Eight pieces between two players who never miss is always 4-4, and the surer the play the nearer to that:
//     Easy (55% right at a full choice) draws about 46% of its squares, Normal (75%) about 57%, Hard (92%) about 81%.
//   - THE FIRST MOVER. Of the squares that are decided the first to move takes about 60% at Easy, 72% at Normal and 89%
//     at Hard (the target is 45-60%). With every piece placed in turn the first mover lays pieces 1, 3, 5, 7: a miss
//     by the first mover only hands that place to the other side, a miss by the second mover loses the square.
// Both come down as play gets less sure (a shorter piece timer, a harder picture; nothing here can measure a person)
// and both are the rule's, not the settings': no share of right placements gives under 60% for the first mover inside
// six turns each. The setting that changes it: `centre` off (nothing in place at the start: nine pieces, five still
// take the square): never a draw, the first mover 60% at Normal, 54% at Easy, 79% at Hard, the same length. That is the
// default from December 2026 (the owner's choice); the owner's first rule, the centre in place, is the setting `centre` on. "Go again on success" on is a different game: about 1.5 turns each at Normal (a run
// of right pieces takes the square in a turn or two).
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('jigsaw: 500 squares at Normal with the centre in place (`centre` on: 75% right at a full choice): every square ends, 3 to 6 turns each; the draws and the first mover miss the targets', () => {
  const r = duel('jigsaw', 'normal', 'normal', 500, { centre: 'on' });
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0, 'every square ends');
  assert.ok(r.each >= 3 && r.each <= 6, `turns each (mean): ${r.each.toFixed(2)}`);
  assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `turns each (median): ${r.eachMed}`);
  assert.ok(r.winner >= 4, 'no square is won in a first turn or two: five pieces, one a turn');
  assert.ok(r.draws > 0.4 && r.draws < 0.7, `draws: ${(100 * r.draws).toFixed(1)}% (about 57%: the rule's, see the header)`);
  assert.ok(r.first > 0.6, 'if this fails the game has got fairer: put the batch\'s target (first mover 45-60%) back in this test');
});
test('jigsaw: the defaults, 500 squares at Normal (nine pieces, the centre not in place): never a draw, the first mover about 60%', () => {
  const r = duel('jigsaw', 'normal', 'normal', 500);
  console.log(line('Normal v Normal (the defaults)', r));
  assert.equal(r.open, 0); assert.equal(r.draws, 0);
  assert.ok(r.each >= 3 && r.each <= 6 && r.eachMed >= 3 && r.eachMed <= 6);
  assert.ok(r.first > 0.54 && r.first < 0.66, `first mover ${(100 * r.first).toFixed(1)}%`);
});
test('jigsaw: by level, setting and grid', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('jigsaw', a, b, 3000, t)));
  T('Normal v Normal (the defaults), 3,000 squares', null); T('centre on (the first rule), Normal, 3,000 squares', { centre: 'on' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard'); T('Normal v Easy', null, 'normal', 'easy'); T('Easy v Normal', null, 'easy', 'normal');
  T('centre off (nine pieces), Normal', { centre: 'off' }); T('centre off, Hard v Hard', { centre: 'off' }, 'hard', 'hard'); T('centre off, Easy v Easy', { centre: 'off' }, 'easy', 'easy'); T('centre off, Hard v Normal', { centre: 'off' }, 'hard', 'normal'); T('centre off, Normal v Hard', { centre: 'off' }, 'normal', 'hard');
  for (const a of [50, 60, 65, 70, 80, 85]) T(`Normal right ${a}% of the time`, { aiNormal: a });
  T('Go again on, Normal', { again: 'on' }); T('Go again on, Hard v Hard', { again: 'on' }, 'hard', 'hard'); T('Go again on, Easy v Easy', { again: 'on' }, 'easy', 'easy'); T('Go again on, centre off, Normal', { again: 'on', centre: 'off' });
  T('4 by 4 (16 pieces, none in place), Normal', { size: 4 }); T('5 by 5 (24 pieces), Normal', { size: 5 }); T('5 by 5, centre off (25 pieces), Normal', { size: 5, centre: 'off' });
});
