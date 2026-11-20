'use strict';
// Simulations: Marble Toss (slow, never part of npm test: `npm run sim -- marble`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's aim error stands in for a
// finger: real play decides the holes' sizes.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('marble: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('marble', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('marble: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('marble', a, b, 4000, t)));
  T('the defaults, 4,000 squares', null); T('aim error 8 (500 squares gave 61%, 20,000 57%)', { aiErr: 8 });
  T('target 10', { target: 10 }); T('target 15', { target: 15 }); T('2 marbles a turn', { marbles: 2 }); T('small holes 4 points', { v3: 4 });
  T('layout ladder', { layout: 'ladder' }); T('layout corners', { layout: 'corners' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
