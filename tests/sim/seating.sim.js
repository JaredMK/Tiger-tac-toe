'use strict';
// Simulations: Seating (reworked November 2026). Slow, so never part of npm test:
// npm run sim -- seating
// The settings (meta.js TUNE) were picked here: 15 tables, 4 colours. Normal against Normal over 3,000 squares: the winner
// takes about 5.0 moves, the first mover wins about 57% of decided squares; Hard against Hard about 58%. An even count of
// tables ties about half the squares (every customer either scores, closes an empty table or leaves, so with nobody
// leaving the points add up to the tables' parity): the tables are odd. Tried: 11 tables 3.7 moves, 13: 4.3-4.5,
// 17: 5.6-5.7; 2 to 8 colours barely move it (more colours, a few more points). Skill: Normal beats Easy about 65% with
// sides swapped; Hard (a two-ply look-ahead) is level with Normal (about 50%): the next customer is the one thing to
// read, and Normal reads it.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function race(N, lvX, lvO, tag) {
  let first = 0, draws = 0, wMoves = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng(`seat-sim-${tag}-${g}`), m = E.newMini('seating', rng); let p = 'X'; const n = { X: 0, O: 0 };
    for (let k = 0; k < 100; k++) {
      const b = E.localBest(E.publicMini(m), p, rng, {}, { level: p === 'X' ? lvX : lvO, until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok); n[p]++;
      if (r.outcome !== 'continue') { if (r.outcome === 'draw') draws++; else { if (r.winner === 'X') first++; wMoves += n[r.winner]; } break; }
      p = p === 'X' ? 'O' : 'X';
    }
  }
  const dec = N - draws;
  return { first: first / dec, winner: wMoves / dec, draws: draws / N };
}
test('seating: Normal against Normal: the winner about 4 to 6 moves, the first mover under 60%, few ties', () => {
  const r = race(3000, 'normal', 'normal', 'nn');
  console.log(`Seating, Normal v Normal: first mover ${(100 * r.first).toFixed(1)}%, the winner's moves ${r.winner.toFixed(2)}, ties ${(100 * r.draws).toFixed(1)}%`);
  assert.ok(r.first < 0.6); assert.ok(r.winner >= 4 && r.winner <= 6); assert.ok(r.draws < 0.05);
});
test('seating: Hard against Hard', () => {
  const r = race(1500, 'hard', 'hard', 'hh');
  console.log(`Seating, Hard v Hard: first mover ${(100 * r.first).toFixed(1)}%, the winner's moves ${r.winner.toFixed(2)}, ties ${(100 * r.draws).toFixed(1)}%`);
  assert.ok(r.winner >= 4 && r.winner <= 6);
});
