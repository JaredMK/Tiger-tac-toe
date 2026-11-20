'use strict';
// Simulations: Wall Race (slow, never part of npm test: `npm run sim -- walls`). The computer against itself, 500
// squares at Normal (the batch's standard), then by board, walls and level.
// It cannot meet both of the batch's targets, and the test says so rather than assert them: with the 5x5 board and 3
// walls each that were asked for, the first mover is level (about 46%) but a square runs about eleven turns each (a
// turn is one tap); with fewer walls it is short and the first mover's: 2 walls 7 turns and 75%, 1 wall or none 100%
// (with no wall worth placing it is a straight race, and the first pawn to move gets there first).
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('walls: 500 squares at Normal (the defaults: 5x5, 3 walls each): the first mover is in range; the turns each are over the target', () => {
  const r = duel('walls', 'normal', 'normal', 500, null, { cap: 600 });
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.4 && r.first <= 0.6, `first mover ${r.first}`);
  assert.ok(r.eachMed > 6, 'if this fails the squares have got shorter: assert the batch\'s 3 to 6 turns instead');
});
test('walls: by board, walls and level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 1500) => console.log(line(label, duel('walls', a, b, n, t, { cap: 600 })));
  T('no walls', { walls: 0 }); T('1 wall each', { walls: 1 }); T('2 walls each', { walls: 2 }); T('4 walls each', { walls: 4 });
  T('4x4, 3 walls', { size: 4 }); T('4x4, 2 walls', { size: 4, walls: 2 }); T('6x6, 3 walls', { size: 6 }); T('6x6, 5 walls', { size: 6, walls: 5 });
  T('Hard v Hard', null, 'hard', 'hard', 100); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal', 100); T('Normal v Hard', null, 'normal', 'hard', 100);
});
