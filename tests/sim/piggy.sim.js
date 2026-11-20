'use strict';
// Simulations: Pig (slow, never part of npm test: `npm run sim -- piggy`). The computer against itself, 500 squares at
// Normal (the batch's standard), then by target and by level, and Risky Rolls beside it for the comparison.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('piggy: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('piggy', 'normal', 'normal', 500);
  console.log(line('Normal v Normal, target 25 (the default)', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('piggy: by target and by level; Risky Rolls for the comparison', () => {
  for (const t of [15, 20, 25, 30, 40]) console.log(line(`Normal, target ${t}`, duel('piggy', 'normal', 'normal', 4000, { target: t })));
  for (const [a, b] of [['hard', 'hard'], ['easy', 'easy'], ['hard', 'normal'], ['normal', 'hard'], ['normal', 'easy']]) console.log(line(`${a} v ${b}`, duel('piggy', a, b, 4000)));
  console.log(line('Risky Rolls, Normal v Normal', duel('pig', 'normal', 'normal', 4000)));
});
