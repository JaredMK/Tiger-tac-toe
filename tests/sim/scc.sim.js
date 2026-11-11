'use strict';
// Simulations: Ship, Captain & Crew. Slow, so never part of npm test:
// npm run sim -- scc
// The target (meta.js TUNE) was picked here (November 2026) for about 3 to 6 turns a player: see the figures it prints.
// A turn is every roll of one turn (Roll, Roll again, Keep: one turn); turns per player: each side's turns in a square,
// averaged over both sides; the winner's turns: the turns the winner took.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

function play(level, N, tag, target) {
  if (target) E.setTune('scc', { target }); else E.setTune('scc', null);
  let first = 0, wT = 0, allT = 0, zero = 0, turns = 0, pts = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng(`scc-${tag}-${g}`), m = E.newMini('scc', rng);
      let p = 'X';
      for (let k = 0; k < 2000; k++) {
        const b = E.localBest(E.publicMini(m), p, rng, {}, { level: level[p], until: null }), r = E.applyMove(m, p, b.move, rng);
        assert.ok(r.ok, r.reason);
        if (!m.turn) { turns++; pts += m.last.pts; if (!m.last.pts) zero++; }
        if (r.outcome === 'win') { if (p === 'X') first++; wT += m.turns[p]; allT += m.turns.X + m.turns.O; break; }
        if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { E.setTune('scc', null); }
  return { fm: first / N, winner: wT / N, each: allT / N / 2, zero: zero / turns, ev: pts / turns };
}
const say = (name, r) => console.log(`  ${name}: the winner ${r.winner.toFixed(2)} turns, each player ${r.each.toFixed(2)}; first mover ${(100 * r.fm).toFixed(1)}%; ${(100 * r.zero).toFixed(1)}% of turns score 0, ${r.ev.toFixed(2)} points a turn`);

test('scc: the computer against itself: about 3 to 6 turns a player, the first mover under 60%', () => {
  if (process.env.SCC_SWEEP) for (const t of [14, 16, 18, 20, 22, 24, 26, 28, 30]) say(`target ${t}, Normal`, play({ X: 'normal', O: 'normal' }, 4000, 'sw' + t, t));
  const n = play({ X: 'normal', O: 'normal' }, 8000, 'n'), h = play({ X: 'hard', O: 'hard' }, 4000, 'h'), e = play({ X: 'easy', O: 'easy' }, 4000, 'e');
  const hn = play({ X: 'normal', O: 'hard' }, 4000, 'hn');
  say('Normal v Normal', n); say('Hard v Hard', h); say('Easy v Easy', e);
  console.log(`  Hard (O) against Normal (X): Normal, first, wins ${(100 * hn.fm).toFixed(1)}%`);
  for (const r of [n, h]) { assert.ok(r.each >= 3 && r.each <= 6, `3 to 6 turns a player (${r.each.toFixed(2)})`); assert.ok(r.fm < 0.6, `first mover under 60% (${(100 * r.fm).toFixed(1)}%)`); }
  assert.ok(hn.fm < n.fm + 0.005, 'Hard does at least as well as Normal');
});
