'use strict';
// Simulations: Muncher. Slow, so never part of npm test:
// npm run sim -- muncher
// The settings (meta.js TUNE) were picked here (November 2026): 18 dots of about 21 (a dot on every other open cell),
// two spooks at 3.8 cells a second against the muncher's 3.5, after it 90% of the time at a junction, a second's grace,
// 7 seconds a run: the Normal computer against itself (its hand: a decision every 200 ms, two cells clear of a spook,
// the spooks forgotten 20% of the time) takes about 5.7 runs for the winner (both players about 11 together), the first
// mover wins about 59%; a run eats about 3 dots (a first run 5), four in five end on a spook. Hard against Hard is a
// shorter race (about 3.5 runs for the winner, the first mover about 70%): Hard plays the maze well, and a short race
// favours the first mover; the balance targets are for Normal play.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/muncher/ai.js');
const R = require('../../src/games/muncher/rules.js');

function squares(level, N) {
  let first = 0, wRuns = 0, allRuns = 0, ate = 0, runs = 0, caught = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('mun-sim' + level + g), m = E.newMini('muncher', rng);
    let p = 'X';
    for (let k = 0; k < 200; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level, until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok, r.reason);
      ate += b.move.ate; runs++; if (b.move.end === 'caught') caught++;
      if (r.outcome === 'win') { if (p === 'X') first++; wRuns += m.tries[p]; allRuns += m.tries.X + m.tries.O; break; }
      p = p === 'X' ? 'O' : 'X';
    }
  }
  return { first: first / N, wRuns: wRuns / N, allRuns: allRuns / N, ate: ate / runs, caught: caught / runs };
}
test('muncher: whole squares, the Normal computer against itself: the first mover under 60%, the winner about 4 to 6 runs', () => {
  const N = 1500, s = squares('normal', N);
  console.log(`Muncher (Normal): first mover wins ${(100 * s.first).toFixed(1)}%; the winner's runs ${s.wRuns.toFixed(2)} (both players ${s.allRuns.toFixed(1)}); a run eats ${s.ate.toFixed(2)} dots, ${(100 * s.caught).toFixed(0)}% end on a spook`);
  assert.ok(s.first < 0.6, `first-mover win rate under 60% (${(100 * s.first).toFixed(1)}%)`);
  assert.ok(s.wRuns >= 4 && s.wRuns <= 6, `about 4 to 6 runs for the winner (${s.wRuns.toFixed(2)})`);
});
test('muncher: Hard against Hard: a run eats more than Normal\'s, the square is decided sooner', () => {
  const N = 300, h = squares('hard', N), n = squares('normal', N);
  console.log(`Muncher (Hard): first mover wins ${(100 * h.first).toFixed(1)}%; the winner's runs ${h.wRuns.toFixed(2)}; a run eats ${h.ate.toFixed(2)} dots (Normal ${n.ate.toFixed(2)}), ${(100 * h.caught).toFixed(0)}% end on a spook (Normal ${(100 * n.caught).toFixed(0)}%)`);
  assert.ok(h.ate > n.ate, 'Hard eats more a run');
  assert.ok(h.wRuns < n.wRuns, 'and gets there in fewer runs');
});
test('muncher: the computer\'s guess at the runs still needed (ai.js MUN_GAIN) is near what a Normal run eats', () => {
  let ate = 0, n = 0;
  for (let s = 0; s < 400; s++) { const m = E.newMini('muncher', E.makeRng('gain' + s)); const r = R.munPilot(m, 'X', E.makeRng('g' + s), R.munHand(m, 'normal')); ate += r.move.ate; n++; }
  console.log(`Muncher: a first Normal run eats ${(ate / n).toFixed(2)} dots (MUN_GAIN ${A.MUN_GAIN}: a whole square's runs average less, the maze thinning)`);
  assert.ok(Math.abs(ate / n - A.MUN_GAIN) < 2.5);
});
