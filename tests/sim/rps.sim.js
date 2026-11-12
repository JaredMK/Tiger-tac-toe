'use strict';
// Simulations: Rock Paper Scissors (slow, never part of npm test: `npm run sim -- rps`). The computer against itself at
// each level over many dealt squares: each player's turns, the winner's turns and the first mover's wins (December 2026:
// the house at random, so every level is the same; the figures in the test's output).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function play(lx, lo, N, tuneSet) {
  E.setTune('rps', tuneSet || null);
  let turns = 0, winnerTurns = 0, first = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('rps-sim:' + g), m = E.newMini('rps', rng), lv = { X: lx, O: lo }; let p = 'X', fresh = true; const n = { X: 0, O: 0 };
      for (let k = 0; k < 500; k++) {
        if (fresh) n[p]++;
        const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: lv[p], until: null }).move, rng);
        if (r.outcome !== 'continue') { turns += n.X + n.O; winnerTurns += n[p]; if (p === 'X') first++; break; }
        fresh = !r.again; if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { E.setTune('rps', null); }
  return { each: turns / N / 2, winner: winnerTurns / N, first: first / N };
}
test('rps: the computer against itself (the house at random, December 2026): turns each, the winner\'s and the first mover by goal', () => {
  const N = 8000;
  for (const g of [2, 3, 4]) {
    const r = play('normal', 'normal', N, { goal: g });
    console.log(`  goal ${g}: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}%`);
  }
  const r = play('normal', 'normal', N); assert.ok(r.each >= 3 && r.each <= 7); assert.ok(r.first < 0.62);
});
