'use strict';
// Simulations: Apple Pick. Slow, so never part of npm test:
// npm run sim -- apple
// The settings (meta.js TUNE) were picked here (November 2026): 10 apples a tree, ten segments (two of each pick 1 to 4,
// one bird, one spill), the bird takes 2, a spill tips half the bucket back: the winner takes about 5.0 spins (both
// players about 9.5 together), the first mover wins about 56%; a lone player empties a tree in about 6.7 spins.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/apple/ai.js');

test('apple: whole squares, the computer against itself, over many dealt squares: the first mover under 60%, the winner about 4 to 6 spins', () => {
  const N = 20000;
  let first = 0, wSpins = 0, allSpins = 0, birds = 0, spills = 0, lost = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('apple-sim' + g), m = E.newMini('apple', rng);
    let p = 'X';
    for (let k = 0; k < 500; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: 'normal', until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok);
      if (m.last.kind === 'bird') { birds++; lost += m.last.n; } else if (m.last.kind === 'spill') { spills++; lost += m.last.n; }
      if (r.outcome === 'win') { if (p === 'X') first++; wSpins += m.spins[p]; allSpins += m.spins.X + m.spins.O; break; }
      p = p === 'X' ? 'O' : 'X';
    }
  }
  const fm = first / N, w = wSpins / N, solo = A.needs(E.publicMini(E.newMini('apple', E.makeRng('solo'))), 'X');
  console.log(`Apple Pick: first mover wins ${(100 * fm).toFixed(1)}%; the winner's spins ${w.toFixed(2)} (both players ${(allSpins / N).toFixed(1)}); a lone tree in ${solo.toFixed(2)} spins; ${(birds / N).toFixed(2)} birds and ${(spills / N).toFixed(2)} spills a square sent ${(lost / N).toFixed(1)} apples back`);
  assert.ok(fm < 0.6, `first-mover win rate under 60% (${(100 * fm).toFixed(1)}%)`);
  assert.ok(w >= 4 && w <= 6, `about 4 to 6 spins for the winner (${w.toFixed(2)})`);
});
