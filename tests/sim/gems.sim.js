'use strict';
// Simulations: Gem Swap (slow, never part of npm test: `npm run sim -- gems`). The computer against itself, 500 squares
// at Normal (the batch's standard), then by target, kinds of gem, board, the two switches and level.
// What chose the defaults (7x7, six kinds, 32 to win):
// - Six kinds, not five: with five the cascades run long (a turn brings 10.4 gems, sd 6.4, against 6.3, sd 4.0) and a
//   square that lasts 4 to 5 turns each needs 50 points.
// - The opening board is a settled one (rules.js gemsOpen): on a fresh deal the first swap was sure of 7.2 gems and
//   brought 9.2, against 5.0 and 6.3 on a board in play, and the first to move won 67-69% of squares.
// - 32 to win: a mean of 4.8 turns each (median 4.5), the winner's 5.1; two or three squares in a hundred are won
//   inside their winner's first two turns and two in a thousand on a first turn (a turn's most in 3,000 squares: 40 gems).
// THE FIRST MOVER: every turn adds about the same (6.3 gems, give or take 4), so this is a plain race and the first
// to move wins about 60.5% of squares (6,000 squares; 61.2% at 30 to win, 59.7% at 36 and 38): at the very top of the
// batch's 45-60%, a shade over it, and no target or board brings it clearly inside. The assert below allows a
// 500-square run its noise (two points either way) and does not pretend otherwise. What does bring it inside is the
// `even` switch (Equal turns: the other player answers; off by default, the first to the target winning at once as the
// game was asked for): 48% with 2.4% of squares level.
// "Go again on success" at its default of 6 gems keeps the turn on nearly half the swaps (a square is over in 2.2
// turns each); 10 gems suits it better (3.9 turns each, the first mover 58%).
// Levels: Hard beats Normal about three squares in five (71% moving first, 48% moving second); Normal beats Easy 73%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { duel, line } = require('./duel.js');

// The share of squares won inside their winner's first `k` turns, and the gems a turn brings (Normal v Normal).
function early(N, k, tune) {
  E.setTune('gems', tune || null);
  let quick = 0, sum = 0, sq = 0, turns = 0, top = 0;
  try {
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('gems-early:' + g), m = E.newMini('gems', rng), n = { X: 0, O: 0 }; let p = 'X';
      for (let i = 0; i < 400; i++) {
        n[p]++;
        const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal', until: null }).move, rng);
        sum += m.last.n; sq += m.last.n * m.last.n; turns++; top = Math.max(top, m.last.n);
        if (r.outcome !== 'continue') { if (n[r.winner || p] <= k) quick++; break; }
        p = p === 'X' ? 'O' : 'X';
      }
    }
  } finally { E.setTune('gems', null); }
  const mean = sum / turns;
  return { quick: quick / N, mean, sd: Math.sqrt(sq / turns - mean * mean), top };
}

test('gems: 500 squares at Normal (the defaults: 7x7, six kinds, 32 to win): the turns each are in range; the first mover is at the top edge of the band', () => {
  const r = duel('gems', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.equal(r.draws, 0);
  assert.ok(r.each >= 3 && r.each <= 6, `mean turns each ${r.each}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns each ${r.eachMed}`);
  assert.ok(r.first >= 0.45 && r.first <= 0.63, `first mover ${r.first}: about 60.5% over 6,000 squares (see the header): two points of noise allowed, no more`);
  const e = early(500, 2);
  console.log(`  a turn brings ${e.mean.toFixed(2)} gems (sd ${e.sd.toFixed(2)}, the most ${e.top}); won inside the winner's first two turns: ${(100 * e.quick).toFixed(1)}% of squares`);
  assert.ok(e.quick <= 0.06, `squares won in two turns: ${e.quick}`);
});
test('gems: Equal turns on (the other player answers): the first mover inside the band', () => {
  const r = duel('gems', 'normal', 'normal', 500, { even: 'on' });
  console.log(line('Equal turns on', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.43 && r.first <= 0.57, `first mover ${r.first}`); assert.ok(r.draws < 0.06);
});
test('gems: by target, kinds, board, switch and level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 500) => console.log(line(label, duel('gems', a, b, n, t)));
  T('the defaults over 3,000 squares', null, 'normal', 'normal', 3000);
  T('28 to win', { target: 28 }); T('36 to win', { target: 36 }); T('40 to win', { target: 40 });
  T('five kinds, 32 to win', { kinds: 5 }); T('five kinds, 50 to win', { kinds: 5, target: 50 });
  T('a 6x6 board, 26 to win', { size: 6, target: 26 }); T('an 8x8 board, 36 to win', { size: 8, target: 36 });
  T('Equal turns on, 3,000 squares', { even: 'on' }, 'normal', 'normal', 3000);
  T('Go again on (6 gems)', { again: 'on' }); T('Go again on, 8 gems', { again: 'on', againAt: 8 }); T('Go again on, 9 gems', { again: 'on', againAt: 9 }); T('Go again on, 10 gems', { again: 'on', againAt: 10 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard'); T('Normal v Easy', null, 'normal', 'easy'); T('Easy v Normal', null, 'easy', 'normal');
});
