'use strict';
// Simulation: Rummy Lite (November 2026). Slow, so never part of npm test: npm run sim -- rummy.
// v 2: one deck (the ace to 6 by default) and one pile for both, each hand its own.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function play(lx, lo, N, tuneSet) {
  E.setTune('rummy', tuneSet || null);
  let winT = 0, each = 0, first = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('rsim' + g), m = E.newMini('rummy', rng); let p = 'X'; const n = { X: 0, O: 0 };
      for (let k = 0; k < 400; k++) {
        const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: p === 'X' ? lx : lo, until: null }).move, rng);
        assert.ok(r.ok, r.reason);
        if (r.note !== 'take') n[p]++;
        if (r.outcome === 'win') { winT += n[p]; each += (n.X + n.O) / 2; if (p === 'X') first++; break; }
        if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { E.setTune('rummy', null); }
  return { winner: winT / N, each: each / N, first: first / N };
}
test('rummy: the computer against itself: 3 to 6 turns each, the first mover under 60%; Hard quicker than Normal', () => {
  const out = {};
  for (const [name, a, b, n] of [['Normal v Normal', 'normal', 'normal', 2000], ['Hard v Hard', 'hard', 'hard', 300], ['Easy v Easy', 'easy', 'easy', 1000], ['Normal (X) v Hard (O)', 'normal', 'hard', 300]]) {
    const r = play(a, b, n); out[name] = r;
    console.log(`  ${name}: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}%`);
  }
  for (const ranks of [6, 7, 9, 13]) { const r = play('normal', 'normal', 400, { ranks }); console.log(`  ${ranks} ranks, Normal v Normal: turns each ${r.each.toFixed(2)}, first mover ${(100 * r.first).toFixed(1)}%`); }
  const nn = out['Normal v Normal'];
  assert.ok(nn.each >= 3 && nn.each <= 6); assert.ok(nn.first < 0.6);
  assert.ok(out['Hard v Hard'].each < nn.each, 'Hard finishes sooner');
  assert.ok(out['Normal (X) v Hard (O)'].first < 0.5, 'Hard beats Normal');
});
