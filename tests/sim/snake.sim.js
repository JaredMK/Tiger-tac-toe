'use strict';
// Simulations: Snake. Slow, so never part of npm test:
//   npm run sim -- snake
// The computer against itself in one square, run after run (X first), with each level's hand: how many runs the
// winner takes (the balance target: about 4 to 6 of their own), how often the first mover wins (under 60%), and
// Hard against Normal.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/snake/rules.js');

const square = seed => { const m = E.newMini('snake', E.makeRng('snake-sim:' + seed)); m.seed = { X: seed, O: seed }; return m; };
// One square played out: X and O take turns at a run (each with its hand) until a total reaches the target.
function playSquare(seed, hands) {
  const mini = square(seed), rng = E.makeRng('runs:' + seed);
  let p = 'X';
  for (let k = 0; k < 200; k++) {
    const r = E.applyMove(mini, p, R.snakeAi(mini, p, rng, hands[p]).move, rng);
    assert.equal(r.ok, true, r.reason);
    if (r.outcome === 'win') return { winner: p, runs: mini.tries[p], apples: { X: mini.score.X, O: mini.score.O } };
    p = p === 'X' ? 'O' : 'X';
  }
  throw new Error('a square never won');
}
function report(name, hands, N) {
  let xWins = 0, runs = 0, per = 0, n = 0;
  for (let s = 0; s < N; s++) { const r = playSquare(s, hands); if (r.winner === 'X') xWins++; runs += r.runs; per += r.apples[r.winner] / r.runs; n++; }
  const out = { avgRuns: +(runs / n).toFixed(2), firstMover: +(100 * xWins / n).toFixed(1), applesPerRun: +(per / n).toFixed(2) };
  console.log(`${name}: the winner takes ${out.avgRuns} runs (about ${out.applesPerRun} apples a run); the first mover wins ${out.firstMover}%`);
  return out;
}
test('snake: Normal against Normal: the winner needs about 4 to 6 runs, the first mover under 60%', () => {
  const m = square(0), hand = R.snakeHand(m, 'normal');
  const r = report('Normal v Normal', { X: hand, O: hand }, 600);
  assert.ok(r.avgRuns >= 4 && r.avgRuns <= 6, `runs: ${r.avgRuns}`);
  assert.ok(r.firstMover < 60, `first mover: ${r.firstMover}%`);
});
test('snake: Hard is better than Normal, and takes fewer runs', () => {
  const m = square(0), N = R.snakeHand(m, 'normal'), H = R.snakeHand(m, 'hard');
  const hh = report('Hard v Hard', { X: H, O: H }, 300);
  const hn = report('Hard (O) v Normal (X)', { X: N, O: H }, 400);
  assert.ok(hh.avgRuns < 4.5, `Hard's runs: ${hh.avgRuns}`);
  assert.ok(hn.firstMover < 35, `Normal first against Hard wins ${hn.firstMover}%`);
});
test('snake: the needs estimate (SNAKE_GAIN) is about what Normal gets in a run', () => {
  const m = square(1), hand = R.snakeHand(m, 'normal'), rng = E.makeRng('gain');
  let tot = 0, N = 500;
  for (let i = 0; i < N; i++) { const mm = JSON.parse(JSON.stringify(m)); mm.tries.X = i; tot += R.snakeAi(mm, 'X', rng, hand).move.n; }
  const gain = tot / N;
  console.log(`Normal eats ${gain.toFixed(2)} apples a run (SNAKE_GAIN ${R.SNAKE_GAIN})`);
  assert.ok(Math.abs(gain - R.SNAKE_GAIN) < 1.5, `SNAKE_GAIN ${R.SNAKE_GAIN} against ${gain.toFixed(2)}`);
});
