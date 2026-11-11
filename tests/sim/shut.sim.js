'use strict';
// Simulations: Shut the Box. Slow, so never part of npm test:
// npm run sim -- shut
// The settings (meta.js TUNE) were picked here (November 2026). The rules as asked (tiles 1 to 6, one die once the
// open tiles add up to 6 or less) already give 3 to 6 turns a player, so they are the defaults; the figures each run
// prints are the report. A turn: a roll and its flip (a roll no tiles make ends it at once; the turn's own second step,
// the flip, counts in the same turn).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/shut/ai.js');

function squares(levels, N, tune) {
  E.setTune('shut', tune || null);
  let first = 0, wTurns = 0, allTurns = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('shut-sim' + g + JSON.stringify(tune || {})), m = E.newMini('shut', rng), turns = { X: 0, O: 0 };
      let p = 'X', fresh = true;
      for (let k = 0; k < 2000; k++) {
        if (fresh) { turns[p]++; fresh = false; }
        const b = A.best(E.publicMini(m), p, rng, {}, { level: levels[p], until: null }), r = E.applyMove(m, p, b.move, rng);
        assert.ok(r.ok, r.reason);
        if (r.outcome === 'win') { if (p === 'X') first++; wTurns += turns[p]; allTurns += turns.X + turns.O; break; }
        if (!r.again) { p = p === 'X' ? 'O' : 'X'; fresh = true; }
      }
    }
  } finally { E.setTune('shut', null); }
  return { first: first / N, winner: wTurns / N, each: allTurns / N / 2 };
}
const say = (name, r) => console.log(`Shut the Box ${name}: the winner's turns ${r.winner.toFixed(2)}, each player's ${r.each.toFixed(2)}; the first mover wins ${(100 * r.first).toFixed(1)}%`);
test('shut: whole squares between the computers: 3 to 6 turns a player, the first mover under 60%; Hard at least as quick as Normal', () => {
  const n = squares({ X: 'normal', O: 'normal' }, 20000), h = squares({ X: 'hard', O: 'hard' }, 20000), e = squares({ X: 'easy', O: 'easy' }, 10000);
  const on = squares({ X: 'normal', O: 'normal' }, 10000, { again: 'on' });
  const hn = squares({ X: 'hard', O: 'normal' }, 20000);
  say('Normal v Normal', n); say('Hard v Hard', h); say('Easy v Easy', e); say('Normal v Normal, go again on', on);
  console.log(`Shut the Box: Hard (X, first) against Normal wins ${(100 * hn.first).toFixed(1)}% (Normal v Normal ${(100 * n.first).toFixed(1)}%)`);
  for (const r of [n, h]) { assert.ok(r.each >= 3 && r.each <= 6, `3 to 6 turns a player (${r.each.toFixed(2)})`); assert.ok(r.first < 0.6); }
  assert.ok(hn.first >= n.first - 0.01, 'Hard no worse than Normal');
});
