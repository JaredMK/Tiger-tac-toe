'use strict';
// Simulations: Coin Pusher. Slow, so never part of npm test:
// npm run sim -- pusher
// The settings (meta.js TUNE) were picked here (November 2026); the figures are printed by the run below (and kept in
// meta.js beside TUNE).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

// Whole squares between two levels: { each (turns per player), winner (the winner's turns), first (X, the first mover, wins), rate (coins a move), lost }.
function play(lx, lo, N, set) {
  if (set) E.setTune('pusher', set);
  try {
    let first = 0, each = 0, winner = 0, coins = 0, moves = 0, lost = 0, draws = 0, dec = 0;
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('push-sim' + g + lx + lo), m = E.newMini('pusher', rng);
      let p = 'X';
      for (let k = 0; k < 200; k++) {
        const b = E.localBest(E.publicMini(m, p), p, rng, {}, { level: p === 'X' ? lx : lo, until: null }), r = E.applyMove(m, p, b.move, rng);
        assert.ok(r.ok, r.reason);
        moves++; coins += m.last.scored; lost += m.last.lost;
        if (r.outcome === 'draw') { draws++; break; }
        if (r.outcome === 'win') { const w = r.winner || p; dec++; if (w === 'X') first++; each += (m.turns.X + m.turns.O) / 2; winner += m.turns[w]; break; }
        if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
    return { each: each / dec, winner: winner / dec, first: first / dec, draws: draws / N, rate: coins / moves, lost: lost / moves };
  } finally { if (set) E.setTune('pusher', null); }
}
const line = (name, r) => console.log(`  ${name}: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}% of decided squares, ${(100 * r.draws).toFixed(1)}% level, ${r.rate.toFixed(2)} coins a move, ${r.lost.toFixed(2)} lost`);

test('pusher: the computer against itself: 3 to 6 turns each, the first mover under 60%; Hard at least as good as Normal', () => {
  const nn = play('normal', 'normal', 400), hh = play('hard', 'hard', 120), ee = play('easy', 'easy', 400), nh = play('normal', 'hard', 120);
  line('Normal v Normal', nn); line('Hard v Hard', hh); line('Easy v Easy', ee); line('Normal (X) v Hard (O)', nh);
  for (const t of [10, 14]) line(`target ${t}, Normal v Normal`, play('normal', 'normal', 200, { target: t }));
  assert.ok(nn.each >= 3 && nn.each <= 6, `Normal: 3 to 6 turns each (${nn.each.toFixed(2)})`);
  assert.ok(nn.first < 0.6, `Normal: the first mover under 60% (${(100 * nn.first).toFixed(1)}%)`);
  assert.ok(nh.first <= nn.first + 0.04, 'Hard no worse than Normal');
});
