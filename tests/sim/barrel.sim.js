'use strict';
// Simulations: Barrel Launch (slow, never part of npm test: `npm run sim -- barrel`). The computer against itself, 500
// squares at Normal (the batches' standard), then its catches a shot by level, and by setting and by level. The
// computer's timing error stands in for a finger's: it taps 60 ms early or late at Normal (a normal spread), 50 at
// Hard, 95 at Easy. The defaults of November 2026 (the barrels 52 apart, half as far again as before; the catch
// window 6.5, about a barrel's half width, so a shot that points at the barrel lands in it; a 1.7 s swing): a shot is
// caught while the swing is within about 50 ms of dead on. Normal v Normal 3.8 turns each (median 3.5), the winner's
// 4.1 (median 4), the first mover 53-55%; Hard v Hard 2.7 (median 2.5), 57%; Easy v Easy 8.3 (median 8), 51%; a shot
// caught 60% at Normal, 69% at Hard, 41% at Easy.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { duel, line } = require('./duel.js');

const catches = (level, N, t) => {
  E.setTune('barrel', t || null);
  try { let h = 0; for (let k = 0; k < N; k++) { const rng = E.makeRng(level + ':' + k), m = E.newMini('barrel', rng), r = E.applyMove(m, 'X', E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level }).move, rng); if (r.note === 'catch') h++; } return h / N; } finally { E.setTune('barrel', null); }
};
test('barrel: 500 squares at Normal: the first mover and the turns each (the defaults: 7 barrels to the top, a 1.7 s swing of 40 degrees each way, a gap of 52, a catch window of 6.5)', () => {
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
  T('4 barrels', { top: 4 }); T('8 barrels', { top: 8 }); T('window 5', { win: 5 }); T('window 8', { win: 8 }); T('a faster swing (1300 ms)', { period: 1300 }); T('a slower swing (2200 ms)', { period: 2200 });
  T('the speed-up on (8% a barrel)', { ramp: 'on' }); T('a wider swing (60)', { amp: 60 }); T('the old gap (34) and window (4)', { gap: 34, win: 4 }); T('a longer gap (70)', { gap: 70 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
