'use strict';
// Simulations: Craps. Slow, so never part of npm test:
// npm run sim -- craps
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

test('craps: a move rolls a whole round out; the square takes the winner about 4 to 6 of their own moves; the first mover wins under 60%', () => {
  const N = 20000, rng = E.makeRng('craps-sim');
  let first = 0, movesOfWinner = 0, rolls = 0, rounds = 0;
  for (let g = 0; g < N; g++) {
    const m = E.newMini('craps', rng), own = { X: 0, O: 0 };
    let p = 'X';
    for (let k = 0; k < 200; k++) {
      const r = E.applyMove(m, p, 'roll', rng); own[p]++; rounds++; rolls += m.last.rolls.length;
      assert.equal(m.point, null, 'nothing left on after a move');
      if (r.outcome === 'win') { if (p === 'X') first++; movesOfWinner += own[p]; break; }
      p = p === 'X' ? 'O' : 'X';
    }
  }
  const fm = first / N, mv = movesOfWinner / N;
  console.log(`  first mover wins ${(fm * 100).toFixed(1)}%; the winner's own moves ${mv.toFixed(2)}; ${(rolls / rounds).toFixed(2)} rolls a round`);
  assert.ok(fm < 0.6, `first-mover win rate under 60% (${(fm * 100).toFixed(1)}%)`);
  assert.ok(mv >= 4 && mv <= 6, `about 4 to 6 own moves to win the square (${mv.toFixed(2)})`);
});
