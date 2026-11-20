'use strict';
// Simulations: Block Drop (slow, never part of npm test: `npm run sim -- blocks`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('blocks: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('blocks', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('blocks: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('blocks', a, b, 2000, t)));
  T('the defaults, 2,000 squares', null);
  T('3 rows', { lines: 3 }); T('5 rows', { lines: 5 }); T('6 rows', { lines: 6 }); T('2 pieces a turn', { pieces: 2 }); T('board 5 wide', { cols: 5 }); T('board 7 wide', { cols: 7 }); T('junk rows on', { junk: 'on' }); T('equal turns off (as asked: first to the target)', { even: 'off' }); T('equal turns off, junk rows on', { even: 'off', junk: 'on' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
