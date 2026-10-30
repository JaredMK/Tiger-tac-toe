'use strict';
// Simulations: Risky Spins. Slow, so never part of npm test:
// npm run sim -- wheels
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/wheels/ai.js');

// Whole squares, the computer against itself (October 2026, defaults: 30 to win, skulls 1/3/4): the first mover
// with Normal on both sides 56%, Hard on both 56%; Hard beats Normal about 80% of the time; a Normal winner
// takes about 5 turns, a Hard one about 2.5.
test('wheels: whole squares, Normal and Hard, over many dealt sets: the first mover, the turns a win takes', () => {
  const play = (seed, lx, lo) => {
    const rng = E.makeRng('s' + seed), m = E.newMini('wheels', rng), turns = { X: 0, O: 0 };
    let p = 'X';
    for (let k = 0; k < 3000; k++) {
      if (!m.turn) turns[p]++;
      const b = A.best(E.publicMini(m), p, rng, {}, { level: p === 'X' ? lx : lo, until: null }), r = E.applyMove(m, p, b.move, rng);
      if (r.outcome === 'win') return { w: p, turns: turns[p] };
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
    return null;
  };
  for (const [lx, lo] of [['normal', 'normal'], ['hard', 'hard'], ['hard', 'normal'], ['normal', 'hard']]) {
    let x = 0, t = 0; const n = 2000;
    for (let s = 0; s < n; s++) { const r = play(s, lx, lo); assert.ok(r); if (r.w === 'X') x++; t += r.turns; }
    console.log(`Risky Spins: X ${lx} vs O ${lo}: X wins ${(100 * x / n).toFixed(1)}%, the winner's turns ${(t / n).toFixed(2)}`);
    if (lx === lo) assert.ok(x / n < 0.6, 'the first mover under 60%');
  }
});
