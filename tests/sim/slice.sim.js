'use strict';
// Simulations: Fruit Slice (slow, never part of npm test: `npm run sim -- slice`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's shares (fruit sliced, bombs
// struck) stand in for a finger: real play decides the target.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('slice: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('slice', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('slice: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('slice', a, b, 4000, t)));
  T('the defaults, 4,000 squares', null);
  T('target 20', { target: 20 }); T('target 35', { target: 35 }); T('no bombs', { bombRate: 0 }); T('as first tried: bombs 20%, cost 3, 14% struck, target 30', { bombRate: 20, bombCost: 3, aiBomb: 14, target: 30 }); T('20 fruit a round', { fruits: 20 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
