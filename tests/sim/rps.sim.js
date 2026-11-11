'use strict';
// Simulations: Rock Paper Scissors (slow, never part of npm test: `npm run sim -- rps`). The computer against itself at
// each level over many dealt squares: each player's turns, the winner's turns and the first mover's wins. November 2026:
// 3 of each and 3 wins (the defaults, as asked for): 3.7 turns, 61.0% (Hard 64.9%); 5 of each and 4 wins: Normal 5.4
// turns each, the first mover 58.4%; Hard 5.2, 59.9%.
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
test('rps: the computer against itself: 3 to 6 turns each (the defaults: a first mover over 60%, reported; 5 of each and 4 wins under it); Hard at least as good as Normal', () => {
  const N = 6000, out = {};
  for (const [name, a, b] of [['Normal v Normal', 'normal', 'normal'], ['Hard v Hard', 'hard', 'hard'], ['Easy v Easy', 'easy', 'easy'], ['Normal (X) v Hard (O)', 'normal', 'hard']]) {
    const r = play(a, b, N); out[name] = r;
    console.log(`  ${name}: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}%`);
  }
  for (const g of [3, 5]) { const r = play('normal', 'normal', 3000, { goal: g }); console.log(`  goal ${g}, Normal v Normal: turns each ${r.each.toFixed(2)}, first mover ${(100 * r.first).toFixed(1)}%`); }
  const nn = out['Normal v Normal'];
  assert.ok(nn.each >= 3 && nn.each <= 6);
  const alt = play('normal', 'normal', 3000, { goal: 4, rocks: 5, papers: 5, scissors: 5 }); console.log(`  5 of each, first to 4, Normal v Normal: turns each ${alt.each.toFixed(2)}, first mover ${(100 * alt.first).toFixed(1)}%`); assert.ok(alt.first < 0.6);
  assert.ok(out['Normal (X) v Hard (O)'].first <= nn.first + 0.02, 'Hard no worse than Normal');
});
