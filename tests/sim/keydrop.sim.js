'use strict';
// Simulations: Key Drop (slow, never part of npm test: `npm run sim -- keydrop`). The computer against itself, 500
// squares at Normal (the batches' standard), then its hits an attempt by level, and by setting and by level. The
// computer's timing error stands in for a finger's: it lets go of each slide 70 ms early or late at Normal (a normal
// spread), 55 at Hard, 95 at Easy; at 45 units a second that is 3.2 units against a tolerance of 2.5.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { duel, line } = require('./duel.js');

const hits = (level, N, t) => {
  E.setTune('keydrop', t || null);
  try { let h = 0, near = 0; for (let k = 0; k < N; k++) { const rng = E.makeRng(level + ':' + k), m = E.newMini('keydrop', rng), r = E.applyMove(m, 'X', E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level }).move, rng); if (r.note === 'hit') h++; else if (r.note === 'near') near++; } return { hit: h / N, near: near / N }; } finally { E.setTune('keydrop', null); }
};
test('keydrop: 500 squares at Normal: the first mover and the attempts each (the defaults: 2 prizes, 45 units a second each way, tolerance 2.5, a wall of 3 by 3)', () => {
  const r = duel('keydrop', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median attempts ${r.eachMed}`);
});
test('keydrop: an attempt goes in about 1 time in 3 at Normal; most misses are near ones', () => {
  for (const lv of ['easy', 'normal', 'hard']) { const h = hits(lv, 20000); console.log(`  ${lv}: in ${(100 * h.hit).toFixed(1)}%, a near miss ${(100 * h.near).toFixed(1)}%, clear of every keyhole ${(100 * (1 - h.hit - h.near)).toFixed(1)}%`); if (lv === 'normal') assert.ok(h.hit > 0.28 && h.hit < 0.39, `Normal ${h.hit}`); }
});
test('keydrop: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('keydrop', a, b, 6000, t)));
  T('the defaults, 6,000 squares', null);
  T('3 prizes', { goal: 3 }); T('1 prize', { goal: 1 }); T('tolerance 2', { tol: 2 }); T('tolerance 3', { tol: 3 }); T('a faster key (60)', { speedX: 60, speedY: 60 }); T('a slower key (35)', { speedX: 35, speedY: 35 });
  T('the speed-up on (6% an attempt)', { ramp: 'on' }); T('a wall of 5 by 4', { cols: 5, rows: 4 }); T('a wall of 2 by 2', { cols: 2, rows: 2 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
