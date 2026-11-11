'use strict';
// Simulations: Poker Hands. Slow, so never part of npm test:
// npm run sim -- poker
// The target (meta.js TUNE) was picked here (November 2026): 7 points: Normal v Normal 5.0 turns each, the winner 5.3,
// the first mover 57%; Hard v Hard 5.0, 55%; Easy 9.2. A move scores about 1.18 points (Normal), 1.28 (Hard), 0.63 (Easy).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

// Whole squares between two computer levels: turns each (a turn is a deal and its draw), the winner's turns, the first
// mover's share of the wins.
function play(lx, lo, N, set) {
  if (set) E.setTune('poker', set);
  let first = 0, wTurns = 0, allTurns = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng(`pok-sim:${lx}:${lo}:${JSON.stringify(set || {})}:${g}`), m = E.newMini('poker', rng), turns = { X: 0, O: 0 };
      let p = 'X';
      for (let k = 0; k < 400; k++) {
        const lvl = p === 'X' ? lx : lo, b = E.localBest(E.publicMini(m), p, rng, {}, { level: lvl, until: null }), r = E.applyMove(m, p, b.move, rng);
        assert.ok(r.ok, r.reason);
        if (m.last.kind === 'draw') turns[p]++;
        if (r.outcome === 'win') { if (p === 'X') first++; wTurns += turns[p]; allTurns += turns.X + turns.O; break; }
        if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { if (set) E.setTune('poker', null); }
  return { first: first / N, winner: wTurns / N, each: allTurns / N / 2 };
}
test('poker: the computer against itself: 3 to 6 turns each, the first mover under 60%', () => {
  const out = {};
  for (const [name, a, b, n] of [['Normal v Normal', 'normal', 'normal', 6000], ['Hard v Hard', 'hard', 'hard', 600], ['Easy v Easy', 'easy', 'easy', 6000], ['Normal (X) v Hard (O)', 'normal', 'hard', 600]]) {
    const r = play(a, b, n); out[name] = r;
    console.log(`  ${name}: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}%`);
  }
  for (const target of [5, 6, 8]) { const r = play('normal', 'normal', 3000, { target }); console.log(`  target ${target}, Normal v Normal: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, first mover ${(100 * r.first).toFixed(1)}%`); }
  const nn = out['Normal v Normal'];
  assert.ok(nn.each >= 3 && nn.each <= 6, `turns each ${nn.each}`); assert.ok(nn.first < 0.6, `first mover ${nn.first}`);
  assert.ok(out['Normal (X) v Hard (O)'].first <= nn.first + 0.03, 'Hard no worse than Normal');
});
