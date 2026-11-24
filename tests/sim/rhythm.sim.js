'use strict';
// Simulations: Rhythm Tap (slow, never part of npm test: `npm run sim -- rhythm`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's shares (fruit rhythmd, bombs
// struck) stand in for a finger: real play decides the target.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('rhythm: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('rhythm', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('rhythm: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('rhythm', a, b, 4000, t)));
  T('the defaults, 4,000 squares', null);
  T('target 40', { target: 40 }); T('target 80', { target: 80 }); T('no lives (a round never ends early)', { lives: 0 }); T('3 lives', { lives: 3 }); T('as first tried: 3 lives, 6% let go by, target 40', { lives: 3, aiLetGo: 6, target: 40 }); T('window 120', { window: 120 }); T('tempo 120', { tempo: 120 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
