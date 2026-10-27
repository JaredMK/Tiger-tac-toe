'use strict';
// Simulations: Hex (5x5 with the swap rule). Slow, so never part of npm test:
// npm run sim -- hex
// The first mover's rate between the game's own computer players: in one square, moving in turn; and in whole matches
// of Hex squares, the computer choosing squares on both sides (the any-square rule: a player may move twice in a row in
// a square while the other plays elsewhere). Hex is released only with the first mover under 60%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

function inTurn(N, ctx) {                                          // one square, strict turns: how often the opener wins
  let first = 0, swaps = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('hsim' + (ctx.level || 'n') + g), m = E.newMini('hex', rng), opener = g % 2 ? 'O' : 'X';
    let p = opener, r;
    do { const mv = E.localBest(E.publicMini(m), p, rng, {}, ctx).move; if (mv === 'swap') swaps++; r = E.applyMove(m, p, mv, rng); p = E.other(p); } while (r.outcome === 'continue');
    if ((r.winner || E.other(p)) === opener) first++;
  }
  return { rate: first / N, swaps };
}
function inMatches(N) {                                            // whole matches of Hex squares (Normal on both sides)
  let first = 0, done = 0, twice = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('hmatch' + g), st = E.newMatch(rng, { games: ['hex'] }), opener = {}, last = {};
    for (let n = 0; n < 400 && !st.winner; n++) {
      const m = E.cpuMove(st, rng), sq = st.squares[m.square], p = st.turn, k = m.square;
      if (!sq.mini.cells.some(Boolean)) opener[k] = p;
      if (last[k] === p) twice++; last[k] = p;
      assert.equal(E.playMove(st, k, m.move, rng).ok, true);
      const kind = st.flash.kind;
      if (kind === 'claim' || kind === 'match') { done++; if (st.squares[k].owner === opener[k]) first++; delete last[k]; }
      E.endFlash(st);
    }
  }
  return { rate: first / done, done, twice };
}

test('hex: the first mover between the computer players (5x5, swap rule), in turn and in whole matches; Admin only while over 60%', () => {
  const n = inTurn(400, {}), h = inTurn(100, { level: 'hard', until: null }), mt = inMatches(60);
  console.log(`  Hex 5x5 + swap: in turn, Normal ${(100 * n.rate).toFixed(1)}% (${n.swaps} swaps), Hard ${(100 * h.rate).toFixed(1)}% (${h.swaps} swaps); whole matches (Normal, the any-square rule) ${(100 * mt.rate).toFixed(1)}% of ${mt.done} squares, ${mt.twice} times a player moved twice in a row in a square`);
  const worst = Math.max(n.rate, h.rate, mt.rate);
  assert.equal(E.TEST_TYPES.includes('hex'), worst > 0.6, `released only with the first mover under 60% (worst ${(100 * worst).toFixed(1)}%)`);
});
