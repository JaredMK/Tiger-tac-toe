'use strict';
// Simulations: Split It (slow, never part of npm test: `npm run sim -- pint`). The computer against itself, 500
// squares at Normal (the batches' standard), then its splits an attempt by level, and by setting and by level. The
// computer's timing error stands in for a finger's: it lets go 120 ms early or late at Normal (a normal spread), 90
// at Hard, 170 at Easy; at half a glass a second (a little more as the drink goes down) that is 6 to 7% of the glass
// against a split's 3.5% either way and a perfect one's 1%. Targets: 3 to 6 turns each (mean and median), first
// mover 45 to 60%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { duel, line } = require('./duel.js');

const shots = (level, N, t) => {
  E.setTune('pint', t || null);
  try { const n = [0, 0, 0]; let soon = 0; for (let k = 0; k < N; k++) { const rng = E.makeRng(level + ':' + k), m = E.newMini('pint', rng), r = E.applyMove(m, 'X', E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level }).move, rng); n[m.last.pts]++; if (r.note === 'soon') soon++; } return { miss: n[0] / N, split: n[1] / N, perfect: n[2] / N, soon: soon / N }; } finally { E.setTune('pint', null); }
};
test('pint: 500 squares at Normal: the first mover and the turns each (the defaults: 3 points, a split within 3.5% of the glass, a perfect one within 1%, half a glass a second)', () => {
  const r = duel('pint', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.equal(r.draws, 0);
  assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`);
  assert.ok(r.each >= 3 && r.each <= 6, `mean turns each ${r.each}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns each ${r.eachMed}`);
});
test('pint: no square is won on a first turn; few within two', () => {
  let one = 0, two = 0; const N = 4000;
  for (let g = 0; g < N; g++) { const rng = E.makeRng('quick' + g), m = E.newMini('pint', rng); let p = 'X'; for (let k = 0; k < 400; k++) { const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move, rng); if (r.outcome === 'win') { if (m.n[p] === 1) one++; if (m.n[p] <= 2) two++; break; } p = p === 'X' ? 'O' : 'X'; } }
  console.log(`  won on the winner's first turn ${(100 * one / N).toFixed(1)}%, within two ${(100 * two / N).toFixed(1)}%`);
  assert.equal(one, 0, 'three points take two pints at least'); assert.ok(two / N < 0.25, `within two turns: ${two / N}`);
});
test('pint: Normal splits about two pints in five, a perfect one about one in eight', () => {
  for (const lv of ['easy', 'normal', 'hard']) { const h = shots(lv, 20000); console.log(`  ${lv}: a perfect split ${(100 * h.perfect).toFixed(1)}%, a split ${(100 * h.split).toFixed(1)}%, a miss ${(100 * h.miss).toFixed(1)}% (too soon ${(100 * h.soon).toFixed(1)}%), points an attempt ${(h.split + 2 * h.perfect).toFixed(2)}`); if (lv === 'normal') assert.ok(h.split + h.perfect > 0.38 && h.split + h.perfect < 0.58, `Normal ${h.split + h.perfect}`); }
});
test('pint: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('pint', a, b, 6000, t)));
  T('the defaults, 6,000 squares', null);
  T('2 points', { goal: 2 }); T('4 points', { goal: 4 }); T('5 points', { goal: 5 });
  T('a split within 2.5%', { tol: 2.5 }); T('a split within 5%', { tol: 5 }); T('a perfect split within 0.5%', { perfect: 0.5 }); T('a perfect split within 2%', { perfect: 2 });
  T('a slower drink (35% a second)', { rate: 35 }); T('a faster drink (70% a second)', { rate: 70 });
  T('marks high on the glass (60 to 85%)', { markLo: 60, markHi: 85 }); T('marks low on the glass (30 to 45%)', { markLo: 30, markHi: 45 });
  T('Go again on success', { again: 'on' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard'); T('Normal v Easy', null, 'normal', 'easy');
});
