'use strict';
// Simulations: Heads or Tails (slow, never part of npm test: `npm run sim -- heads`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('heads: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('heads', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('heads: by setting', () => {
  const T = (label, t) => console.log(line(label, duel('heads', 'normal', 'normal', 20000, t)));
  T('the defaults, 20,000 squares', null); T('2 to win', { wins: 2 }); T('4 to win', { wins: 4 }); T('5 to win', { wins: 5 });
  T('shared, 3 to win', { boards: 'shared' }); T('shared, 5 to win', { boards: 'shared', wins: 5 });
});
