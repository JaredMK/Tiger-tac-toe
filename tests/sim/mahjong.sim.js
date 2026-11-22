'use strict';
// Simulations: Mahjong (slow, never part of npm test: `npm run sim -- mahjong`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. December 2026, the hand-building game: the
// defaults (Shared, a hand of 7, three suits of 1 to 5, no honours) chosen from these: Shared 3 suits of 1-6 with the
// honours ran a median 6.5 turns each; honours on make it slower (they never run), and Race slower still (no taking the
// other's discard): Race at the defaults about 7.5 turns, 2 suits of 1-6 5 turns and 50%.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('mahjong: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('mahjong', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('mahjong: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 1000) => console.log(line(label, duel('mahjong', a, b, n, t)));
  T('the defaults, 2,000 squares', null, 'normal', 'normal', 2000);
  T('Race', { mode: 'race' }); T('Race, 2 suits of 1-6', { mode: 'race', suits: 2, nums: 6 }); T('honours on', { honours: 'on' }); T('1-6', { nums: 6 }); T('1-4', { nums: 4 });
  T('a hand of 4', { hand: 4 }); T('a hand of 10', { hand: 10 });
  T('Hard v Hard', null, 'hard', 'hard', 400); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal', 400); T('Normal v Hard', null, 'normal', 'hard', 400);
});
