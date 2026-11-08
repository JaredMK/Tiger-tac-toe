'use strict';
// Simulations: Snake. Slow, so never part of npm test:
//   npm run sim -- snake
// The computer against itself in one square, run after run (X first), with each level's play: how many runs the
// winner takes (the balance target: about 4 to 6 of their own), how often the first mover wins (under 60%), how
// often a square is handed over (won by the other player from food of their colour), and Hard against Normal.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/snake/rules.js');
const A = require('../../src/games/snake/ai.js');

const square = seed => { const m = E.newMini('snake', E.makeRng('snake-sim:' + seed)); m.seed = { X: seed, O: seed }; return m; };
// One square played out: X and O take turns at a run (each at its level, through the AI hook) until a total reaches the target.
function playSquare(seed, levels) {
  const mini = square(seed), rng = E.makeRng('runs:' + seed);
  let p = 'X';
  for (let k = 0; k < 200; k++) {
    const mv = A.best(E.publicMini(mini), p, rng, null, { level: levels[p], until: null }).move;
    const r = E.applyMove(mini, p, mv, rng);
    assert.equal(r.ok, true, r.reason);
    if (r.outcome === 'win') { const w = r.winner || p; return { winner: w, runs: mini.tries[w], gift: r.note === 'gift', pts: mini.score[w] }; }
    p = p === 'X' ? 'O' : 'X';
  }
  throw new Error('a square never won');
}
function report(name, levels, N) {
  let xWins = 0, runs = 0, gifts = 0, per = 0;
  for (let s = 0; s < N; s++) { const r = playSquare(s, levels); if (r.winner === 'X') xWins++; runs += r.runs; gifts += r.gift ? 1 : 0; per += r.pts / r.runs; }
  const out = { avgRuns: +(runs / N).toFixed(2), firstMover: +(100 * xWins / N).toFixed(1), gifts: +(100 * gifts / N).toFixed(1), perRun: +(per / N).toFixed(2) };
  console.log(`${name}: the winner takes ${out.avgRuns} runs (about ${out.perRun} points a run); the first mover wins ${out.firstMover}%; ${out.gifts}% handed over`);
  return out;
}
test('snake: Normal against Normal: the winner needs about 4 to 6 runs, the first mover under 60%', () => {
  const r = report('Normal v Normal', { X: 'normal', O: 'normal' }, 600);
  assert.ok(r.avgRuns >= 4 && r.avgRuns <= 6, `runs: ${r.avgRuns}`);
  assert.ok(r.firstMover < 60, `first mover: ${r.firstMover}%`);
});
test('snake: Hard is better than Normal, and takes fewer runs', () => {
  const hh = report('Hard v Hard', { X: 'hard', O: 'hard' }, 300);
  const hn = report('Hard (O) v Normal (X)', { X: 'normal', O: 'hard' }, 400);
  report('Easy v Easy', { X: 'easy', O: 'easy' }, 300);
  assert.ok(hh.avgRuns < 4.5, `Hard's runs: ${hh.avgRuns}`);
  assert.ok(hn.firstMover < 35, `Normal first against Hard wins ${hn.firstMover}%`);
  assert.ok(hh.firstMover < 66, `Hard v Hard first mover ${hh.firstMover}%`);
});
test('snake: the needs estimate (SNAKE_GAIN) is about the net points Normal gets in a run', () => {
  const m = square(1), hand = R.snakeHand(m, 'normal'), rng = E.makeRng('gain');
  let tot = 0, gave = 0;
  const N = 500;
  for (let i = 0; i < N; i++) { const mm = JSON.parse(JSON.stringify(m)); mm.tries.X = i; const mv = R.snakeAi(mm, 'X', rng, hand).move; tot += mv.n; gave += mv.g; }
  const gain = (tot - gave) / N;
  console.log(`Normal scores ${(tot / N).toFixed(2)} a run and gives ${(gave / N).toFixed(2)} (SNAKE_GAIN ${R.SNAKE_GAIN})`);
  assert.ok(Math.abs(gain - R.SNAKE_GAIN) < 1.5, `SNAKE_GAIN ${R.SNAKE_GAIN} against ${gain.toFixed(2)}`);
});
