'use strict';
// Simulations: Dice Combo. Slow, so never part of npm test:
// npm run sim -- combo
// Whole squares, the computer against itself (Normal against Normal, Hard against Hard), counting turns (a move: its
// rolls and the claim; a turn ends when the turn passes). The settings (meta.js TUNE) were picked here (November 2026):
// 3 combos and 2 rolls a move (see meta.js for the other settings tried).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/combo/ai.js');

function run(level, N, tune) {
  E.setTune('combo', tune || null);
  let first = 0, wTurns = 0, allTurns = 0, none = 0, moves = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('combo-sim' + level + g), m = E.newMini('combo', rng), turns = { X: 0, O: 0 };
      let p = 'X', fresh = true;
      for (let k = 0; k < 2000; k++) {
        if (fresh) { turns[p]++; fresh = false; }
        const b = A.best(E.publicMini(m), p, rng, {}, { level, until: null }), r = E.applyMove(m, p, b.move, rng);
        assert.ok(r.ok, `${b.move}: ${r.reason}`);
        if (r.note === 'none') none++;
        if (r.note === 'claim' || r.note === 'none') moves++;
        if (r.outcome === 'win') { if (p === 'X') first++; wTurns += turns[p]; allTurns += turns.X + turns.O; break; }
        if (!r.again) { p = p === 'X' ? 'O' : 'X'; fresh = true; }
      }
    }
  } finally { E.setTune('combo', null); }
  return { fm: first / N, w: wTurns / N, each: allTurns / N / 2, none: none / moves };
}
test('combo: whole squares between the computers: the winner about 3 to 6 turns, the first mover under 60%', () => {
  const out = {};
  for (const level of ['normal', 'hard']) {
    const r = out[level] = run(level, level === 'hard' ? 3000 : 6000);
    console.log(`  Dice Combo ${level} v ${level}: the winner's turns ${r.w.toFixed(2)}, each player's ${r.each.toFixed(2)}; the first mover wins ${(100 * r.fm).toFixed(1)}%; ${(100 * r.none).toFixed(1)}% of moves claim nothing`);
  }
  for (const r of Object.values(out)) { assert.ok(r.w >= 3 && r.w <= 6, `winner ${r.w}`); assert.ok(r.each >= 3 && r.each <= 6, `each ${r.each}`); assert.ok(r.fm < 0.6, `first ${r.fm}`); }
});
