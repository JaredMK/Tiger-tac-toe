'use strict';
// Simulations: Shuffleboard (slow, never part of npm test: `npm run sim -- shuffle`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's aim error stands in for a
// finger: real play decides the zones' length.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('shuffle: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('shuffle', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('shuffle: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('shuffle', a, b, 4000, t)));
  T('the defaults, 4,000 squares', null); T('target 8', { target: 8 }); T('target 12', { target: 12 }); T('zones 1/2/3', { z3: 3 }); T('zones of 15, a steadier hand (error 9%): as first tried', { zoneLen: 15, z3: 3, aiErr: 9 });
  T('shared lane', { boards: 'shared' }); T('shared lane, Hard v Hard', { boards: 'shared' }, 'hard', 'hard');
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
