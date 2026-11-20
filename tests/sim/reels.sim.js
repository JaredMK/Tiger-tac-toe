'use strict';
// Simulations: Fruit Reels (slow, never part of npm test: `npm run sim -- reels`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('reels: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('reels', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('reels: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('reels', a, b, 6000, t)));
  T('the defaults, 6,000 squares', null);
  T('target 8', { target: 8 }); T('target 12', { target: 12 }); T('two alike 1, three alike 3/4/6', { pair: 1, tri1: 3, tri2: 4, tri3: 6 }); T('star weight 2', { w4: 2 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
