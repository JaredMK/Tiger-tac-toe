'use strict';
// Simulations: Thirty-One (games/t31), the computer against itself over many dealt squares: the turns each player
// takes (a turn is a take and a discard), the winner's, and how often the first mover wins, at each level; and the
// targets around the default. Slow, so never part of npm test: npm run sim -- t31.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function play(lx, lo, N, tuneSet, seed) {
  E.setTune('t31', tuneSet || null);
  let first = 0, each = 0, win = 0, n = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng((seed || 't31s') + g), m = E.newMini('t31', rng); let p = 'X';
      for (let k = 0; k < 400; k++) {
        const lvl = p === 'X' ? lx : lo, mv = E.localBest(E.publicMini(m, p), p, rng, {}, { level: lvl, until: null }).move;
        const r = E.applyMove(m, p, mv, rng); assert.ok(r.ok, r.reason);
        if (r.outcome === 'win') { const w = r.winner || p; if (w === 'X') first++; each += (m.turns.X + m.turns.O) / 2; win += m.turns[w]; n++; break; }
        if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { E.setTune('t31', null); }
  return { first: first / n, each: each / n, winner: win / n };
}
test('t31: the computer against itself: 3 to 6 turns each, the first mover under 60%; Hard at least as good as Normal', () => {
  const out = {};
  for (const [name, a, b, N] of [['Normal v Normal', 'normal', 'normal', 3000], ['Hard v Hard', 'hard', 'hard', 600], ['Easy v Easy', 'easy', 'easy', 3000], ['Normal (X) v Hard (O)', 'normal', 'hard', 600]]) {
    const r = play(a, b, N); out[name] = r;
    console.log(`  ${name}: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}%`);
  }
  for (const t of [24, 26, 27, 29]) { const r = play('normal', 'normal', 2000, { target: t }); console.log(`  target ${t}, Normal v Normal: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, first mover ${(100 * r.first).toFixed(1)}%`); }
  const nn = out['Normal v Normal'];
  assert.ok(nn.each >= 3 && nn.each <= 6, 'turns each ' + nn.each); assert.ok(nn.first < 0.6);
  assert.ok(out['Normal (X) v Hard (O)'].first <= nn.first + 0.03, 'Hard no worse than Normal');
});
