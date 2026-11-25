'use strict';
// Simulations: Hot Potato (slow, never part of npm test: `npm run sim -- hot-potato`). The computer against itself,
// 500 squares at Normal (the batch's standard), then by setting.
// The square alone (tests/sim/duel.js): every turn is a toss by the holder (the computer's rule: a bomb it holds goes
// at once), and after every turn the bomb ticks and rolls (rules.js boardTick, as core/board.js tickBombs does after a
// board turn). The first mover tosses first, so the other player takes tick 1. A "turn each" is a toss each.
// The defaults (start 10%, grace 5, +1% every 2 ticks, cap 100%): Normal v Normal 4.15 turns each (median 3), first
// mover 48.8% (500); 4.24 (median 3.5), 52.1% over 20,000. Both inside the standard (first mover 45-60%, median 3-6
// turns each), the median at its low edge. Every level plays the same (one move, no choice): Easy and Hard are Normal.
// In a whole match the bomb also ticks on the turns played elsewhere, so a square held without tossing lasts fewer of
// its own turns: these figures are its longest.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('hot-potato: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('hot-potato', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('hot-potato: by setting', () => {
  const S = (label, t) => console.log(line(label, duel('hot-potato', 'normal', 'normal', 20000, t)));
  S('defaults (20,000)', null);
  S('start 8%', { start: 8 }); S('start 6%', { start: 6 }); S('start 12%', { start: 12 });
  S('grace 0', { grace: 0 }); S('grace 10', { grace: 10 });
  S('+2% every tick', { inc: 2, every: 1 }); S('cap 25%', { cap: 25 });
});
