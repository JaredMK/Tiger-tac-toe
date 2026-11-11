'use strict';
// Simulations: Word Tiles. Slow, so never part of npm test:
// npm run sim -- wtiles
// The target (meta.js TUNE) was picked here (November 2026) for 3 to 6 turns a player at Normal; the figures each run
// prints are the report. A turn: a word played or a swap.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/wtiles/ai.js');

function squares(levels, N, tune) {
  E.setTune('wtiles', tune || null);
  let first = 0, wTurns = 0, allTurns = 0, pts = 0, words = 0, swaps = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('wt-sim' + g + JSON.stringify(tune || {})), m = E.newMini('wtiles', rng), turns = { X: 0, O: 0 };
      let p = 'X', fresh = true;
      for (let k = 0; k < 400; k++) {
        if (fresh) { turns[p]++; fresh = false; }
        const b = A.best(E.publicMini(m), p, rng, {}, { level: levels[p], until: null }), r = E.applyMove(m, p, b.move, rng);
        assert.ok(r.ok, r.reason);
        if (m.last.kind === 'word') { pts += m.last.pts; words++; } else swaps++;
        if (r.outcome === 'win') { if (p === 'X') first++; wTurns += turns[p]; allTurns += turns.X + turns.O; break; }
        if (!r.again) { p = p === 'X' ? 'O' : 'X'; fresh = true; }
      }
    }
  } finally { E.setTune('wtiles', null); }
  return { first: first / N, winner: wTurns / N, each: allTurns / N / 2, perWord: pts / Math.max(1, words), swap: swaps / Math.max(1, words + swaps) };
}
const say = (name, r) => console.log(`Word Tiles ${name}: the winner's turns ${r.winner.toFixed(2)}, each player's ${r.each.toFixed(2)}; the first mover wins ${(100 * r.first).toFixed(1)}%; ${r.perWord.toFixed(1)} points a word, ${(100 * r.swap).toFixed(1)}% swaps`);
test('wtiles: whole squares between the computers: 3 to 6 turns a player at Normal, the first mover under 60%; Hard quicker than Normal', () => {
  const n = squares({ X: 'normal', O: 'normal' }, 1500), h = squares({ X: 'hard', O: 'hard' }, 800), e = squares({ X: 'easy', O: 'easy' }, 800);
  const hn = squares({ X: 'normal', O: 'hard' }, 800);
  say('Normal v Normal', n); say('Hard v Hard', h); say('Easy v Easy', e);
  console.log(`Word Tiles: Normal (X, first) against Hard wins ${(100 * hn.first).toFixed(1)}% (Normal v Normal ${(100 * n.first).toFixed(1)}%)`);
  for (const t of [80, 90, 110]) say(`target ${t}, Normal v Normal`, squares({ X: 'normal', O: 'normal' }, 600, { target: t }));
  assert.ok(n.each >= 3 && n.each <= 6, `3 to 6 turns a player (${n.each.toFixed(2)})`); assert.ok(n.first < 0.6);
  assert.ok(hn.first <= n.first, 'Hard better than Normal');
});
