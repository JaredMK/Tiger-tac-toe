'use strict';
// Simulations: Number Shuffle (slow, never part of npm test: `npm run sim -- numbers`). The computer against itself,
// 500 squares at Normal (the batch's standard; Normal guesses any order still possible), then by mode, digits and level.
// The defaults (Race, 5 digits): Normal v Normal a median 6 guesses each, first mover 56%; Shared 5 digits a median 4,
// 49%; Race 4 digits 3.5 and 60%, 6 digits 9.5 and 55%. Hard halves what is left every guess (Race 5: 5.5, 70%).
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('numbers: 500 squares at Normal: the first mover and the guesses each (the defaults)', () => {
  const r = duel('numbers', 'normal', 'normal', 500);
  console.log(line('Normal v Normal (Race, 5 digits)', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median guesses ${r.eachMed}`);
});
test('numbers: by mode, digits and level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('numbers', a, b, 500, t)));
  for (const mode of ['race', 'shared']) for (const n of [3, 4, 5, 6]) T(`${mode}, ${n} digits`, { mode, n });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal');
});
