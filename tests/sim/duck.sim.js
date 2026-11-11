'use strict';
// Simulations: Hook-a-Duck (slow, never part of npm test: `npm run sim -- duck`). Every duck looks alike, so every level
// hooks at random: the computer against itself over many dealt squares, each player's turns, the winner's turns and the
// first mover's wins, at the defaults and a few other targets and mixes (src/games/duck/meta.js TUNE).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function play(N, tuneSet, level) {
  E.setTune('duck', tuneSet || null);
  let turns = 0, winnerTurns = 0, first = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('duck-sim:' + g), m = E.newMini('duck', rng); let p = 'X', fresh = true; const n = { X: 0, O: 0 };
      for (let k = 0; k < 500; k++) {
        if (fresh) n[p]++;
        const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: level || 'normal', until: null }).move, rng);
        if (!r.ok) throw new Error('refused: ' + r.reason);
        if (r.outcome !== 'continue') { turns += n.X + n.O; winnerTurns += n[p]; if (p === 'X') first++; break; }
        fresh = !r.again; if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { E.setTune('duck', null); }
  return { each: turns / N / 2, winner: winnerTurns / N, first: first / N };
}
const say = (name, r) => console.log(`  ${name}: turns each ${r.each.toFixed(2)}, the winner's ${r.winner.toFixed(2)}, X (first) wins ${(100 * r.first).toFixed(1)}%`);
test('duck: the computer against itself: 3 to 6 turns each, the first mover under 60%', () => {
  const d = play(8000);
  say('defaults (Normal v Normal)', d);
  say('Easy v Easy', play(3000, null, 'easy'));
  for (const target of [8, 12, 14]) say(`target ${target}`, play(3000, { target }));
  say('go again on', play(3000, { again: 'on' }));
  assert.ok(d.each >= 3 && d.each <= 6, 'turns each ' + d.each); assert.ok(d.first < 0.6, 'first mover ' + d.first);
});
