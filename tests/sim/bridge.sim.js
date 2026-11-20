'use strict';
// Simulations: Glass Bridge (slow, never part of npm test: `npm run sim -- bridge`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('bridge: 500 squares at Normal: the first mover and the turns each (the defaults: 6 rows of 3, 2 weak, shared)', () => {
  const r = duel('bridge', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('bridge: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('bridge', a, b, 3000, t)));
  T('as asked: 2-3 platforms, 0-2 weak', { pmin: 2, pmax: 3, bmin: 0, bmax: 2 });
  T('3 platforms, 1-2 weak', { bmin: 1 });
  T('8 rows, 3 platforms, 1-2 weak', { rows: 8, bmin: 1 });
  T('separate bridges', { boards: 'separate' });
  T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Hard', null, 'hard', 'hard'); T('Normal v Easy', null, 'normal', 'easy');
});
