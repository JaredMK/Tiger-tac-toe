'use strict';
// Simulations: Darts Cricket (slow, never part of npm test: `npm run sim -- cricket`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's aim error stands in for a
// finger on the two sweeping lines.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('cricket: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('cricket', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('cricket: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('cricket', a, b, 3000, t)));
  T('the defaults, 3,000 squares', null);
  T('a looser hand (aim error 8): 6.5 turns each', { aiErr: 8 }); T('3 numbers, 2 marks, no doubles', { numbers: 3, hits: 2, doubles: 'off', heart: 0 }); T('3 numbers, 1 mark', { numbers: 3, hits: 1 }); T('2 numbers, 2 marks', { numbers: 2, hits: 2 }); T('2 numbers, 1 mark', { numbers: 2, hits: 1 });
  T('scoring on', { scoring: 'on' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
