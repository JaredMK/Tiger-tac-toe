'use strict';
// Simulations: Claw Machine. Slow, so never part of npm test:
// npm run sim -- claw
// Whole squares between the computer's hands on the shared machine (and a careful human-like finger: a timing error of HUMAN_MS ms
// at the first good moment for the widest prize, Normal's plan),
// turns each player, the winner's turns and the first mover's win rate.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/claw/ai.js');
const R = require('../../src/games/claw/rules.js');
const HUMAN_MS = 60;
// A hand: a level's play, or ('human') Normal's plan tapped with a timing error of HUMAN_MS.
function move(m, p, rng, level) {
  if (level !== 'human') return A.best(E.publicMini(m), p, rng, {}, { level, until: null }).move;
  const pl = A.clawPlan(E.publicMini(m), rng, 'normal');
  const u = Math.max(1e-9, rng()), v = rng(), g = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return { k: Math.max(0, pl.k + Math.round(g * HUMAN_MS * R.CLAW.hz / 1000)) };
}
function play(lx, lo, N, tuneSet) {
  if (tuneSet) E.setTune('claw', tuneSet);
  let first = 0, turns = 0, wTurns = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('claw-sim' + g), m = E.newMini('claw', rng), n = { X: 0, O: 0 };
      let p = 'X';
      for (let k = 0; k < 400; k++) {
        const r = E.applyMove(m, p, move(m, p, rng, p === 'X' ? lx : lo), rng);
        assert.ok(r.ok, r.reason);
        n[p]++;
        if (r.outcome === 'win') { if (p === 'X') first++; turns += (n.X + n.O) / 2; wTurns += n[p]; break; }
        if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { if (tuneSet) E.setTune('claw', null); }
  return { each: turns / N, winner: wTurns / N, first: first / N };
}
test('claw: whole squares between the computer\'s hands: 3 to 6 turns each at Normal, the first mover under 60%; Hard better than Normal', () => {
  const N = 6000, out = {};
  for (const [name, a, b] of [['Normal v Normal', 'normal', 'normal'], ['Hard v Hard', 'hard', 'hard'], ['Easy v Easy', 'easy', 'easy'], ['Human-like v Human-like', 'human', 'human'], ['Normal (X) v Hard (O)', 'normal', 'hard']]) {
    const r = play(a, b, N); out[name] = r;
    console.log(`  ${name}: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}%`);
  }
  const nn = out['Normal v Normal'];
  assert.ok(nn.each >= 3 && nn.each <= 6, `turns each ${nn.each}`); assert.ok(nn.first < 0.6);
  assert.ok(out['Normal (X) v Hard (O)'].first < nn.first, 'Hard better than Normal');
});
