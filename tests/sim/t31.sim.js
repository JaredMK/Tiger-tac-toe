'use strict';
// Simulations: Thirty-One (games/t31; v 2: one deck of 32 and one pile for both, private hands), the computer against
// itself over many dealt squares, each side playing from its own view (its hand alone): the turns each player takes (a
// turn is a take and a discard), the winner's, how often the first mover wins, how many squares are won within the
// winner's first two turns and how many run past eight, at each level; and the targets around the default. Slow, so
// never part of npm test: npm run sim -- t31.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function play(lx, lo, N, tuneSet, seed) {
  E.setTune('t31', tuneSet || null);
  let first = 0, each = 0, win = 0, n = 0, one = 0, two = 0, long = 0, open = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng((seed || 't31s') + g), m = E.newMini('t31', rng); let p = 'X', done = false;
      for (let k = 0; k < 800 && !done; k++) {
        const lvl = p === 'X' ? lx : lo, mv = E.localBest(E.publicMini(m, p), p, rng, {}, { level: lvl, until: null }).move;
        const r = E.applyMove(m, p, mv, rng); assert.ok(r.ok, r.reason);
        if (r.outcome === 'win') { const w = r.winner || p; if (w === 'X') first++; each += (m.turns.X + m.turns.O) / 2; win += m.turns[w]; if (m.turns[w] === 1) one++; if (m.turns[w] <= 2) two++; if (m.turns[w] > 8) long++; n++; done = true; }
        else if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
      if (!done) open++;                                               // (never won in 200 turns each: only at a target of 31, each side holding what the other needs)
    }
  } finally { E.setTune('t31', null); }
  return { first: first / n, each: each / n, winner: win / n, one: one / n, two: two / n, long: long / n, open: open / N };
}
const line = r => `turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}%; won on the winner's first turn ${(100 * r.one).toFixed(1)}%, within two ${(100 * r.two).toFixed(1)}%, past eight ${(100 * r.long).toFixed(1)}%${r.open ? `, never won ${(100 * r.open).toFixed(1)}%` : ''}`;
test('t31: the computer against itself: 3 to 6 turns each, the first mover under 60%, no square won on a first turn; Hard no worse than Normal', () => {
  const out = {};
  for (const [name, a, b, N] of [['Normal v Normal', 'normal', 'normal', 6000], ['Hard v Hard', 'hard', 'hard', 800], ['Easy v Easy', 'easy', 'easy', 3000], ['Normal (X) v Hard (O)', 'normal', 'hard', 800], ['Hard (X) v Normal (O)', 'hard', 'normal', 800]]) {
    const r = play(a, b, N); out[name] = r;
    console.log(`  ${name}: ${line(r)}`);
  }
  for (const t of [27, 28, 29, 30, 31]) for (const [lvl, N] of [['normal', 3000], ['hard', 400], ['easy', 2000]]) { const r = play(lvl, lvl, N, { target: t }, 't31t'); console.log(`  target ${t}, ${lvl} v ${lvl}: ${line(r)}`); }
  const nn = out['Normal v Normal'];
  assert.ok(nn.each >= 3 && nn.each <= 6, 'turns each ' + nn.each); assert.ok(nn.winner >= 3.5 && nn.winner <= 5.5, 'the winner\'s turns ' + nn.winner);
  assert.ok(nn.first < 0.6, 'the first mover ' + nn.first); assert.equal(nn.one, 0, 'no square won on a first turn');
  assert.ok(out['Hard v Hard'].first < 0.6 && out['Hard v Hard'].each <= 6);
  const hardWins = (1 - out['Normal (X) v Hard (O)'].first + out['Hard (X) v Normal (O)'].first) / 2;
  console.log(`  Hard against Normal, either side first: Hard wins ${(100 * hardWins).toFixed(1)}%`);
  assert.ok(hardWins >= 0.5, 'Hard no worse than Normal: ' + hardWins);
});
