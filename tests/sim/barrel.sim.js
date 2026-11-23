'use strict';
// Simulations: Barrel Launch (slow, never part of npm test: `npm run sim -- barrel`). The computer against itself, 500
// squares at Normal (the batches' standard), then its catches a shot by level, and by setting and by level. The
// computer's timing error stands in for a finger's: it taps 60 ms early or late at Normal (a normal spread), 40 at
// Hard, 90 at Easy. Defaults: Normal v Normal 4.7 turns each (median 4.5), the first mover 52-54%; Hard v Hard 2.2
// (median 2), 57%; Easy v Easy 9.1 (median 8.5), 52%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { duel, line } = require('./duel.js');

const catches = (level, N, t) => {
  E.setTune('barrel', t || null);
  try { let h = 0; for (let k = 0; k < N; k++) { const rng = E.makeRng(level + ':' + k), m = E.newMini('barrel', rng), r = E.applyMove(m, 'X', E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level }).move, rng); if (r.note === 'catch') h++; } return h / N; } finally { E.setTune('barrel', null); }
};
test('barrel: 500 squares at Normal: the first mover and the turns each (the defaults: 7 barrels to the top, a 1.6 s swing of 40 degrees each way, a gap of 34, a catch window of 4)', () => {
  const r = duel('barrel', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`); assert.ok(r.each >= 3 && r.each <= 6, `mean turns ${r.each}`);
});
test('barrel: how often a shot is caught, by level', () => {
  for (const lv of ['easy', 'normal', 'hard']) { const h = catches(lv, 20000); console.log(`  ${lv}: caught ${(100 * h).toFixed(1)}%`); }
});
test('barrel: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('barrel', a, b, 4000, t)));
  T('the defaults, 4,000 squares', null);
  T('4 barrels', { top: 4 }); T('8 barrels', { top: 8 }); T('window 3.5', { win: 3.5 }); T('window 6', { win: 6 }); T('a faster swing (1200 ms)', { period: 1200 }); T('a slower swing (2200 ms)', { period: 2200 });
  T('the speed-up on (8% a barrel)', { ramp: 'on' }); T('a wider swing (60)', { amp: 60 }); T('a longer gap (48)', { gap: 48 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
