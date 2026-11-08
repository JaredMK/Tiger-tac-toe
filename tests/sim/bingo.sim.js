'use strict';
// Simulations: Bingo. Slow, so never part of npm test:
// npm run sim -- bingo
// The settings (meta.js TUNE) were picked here (November 2026): 4x4 cards from 1 to 22, three numbers offered a turn,
// diagonals on: the winner takes about 5.4 calls (both players about 10 together), the first mover wins about 52% of the
// decided squares, and about 9-10% of squares tie (one call completes a line on both cards: the square resets). Wider
// ranges make longer games (1 to 30: 6.9 calls, 7.5% ties); narrower ones more ties (1 to 20: 5.0 calls, 10% ties).
// Hard (rollouts) against Normal is about even: a luck game, with little to choose between three numbers.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/bingo/ai.js');

function squares(N, levels, cfg) {
  if (cfg) E.setTune('bingo', cfg);
  let first = 0, dec = 0, ties = 0, wCalls = 0, allCalls = 0, gifts = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('bingo-sim' + g), m = E.newMini('bingo', rng);
    let p = 'X';
    for (let k = 0; k < 200; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: levels[p], until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok);
      if (r.outcome === 'win') { dec++; if (r.winner === 'X') first++; if (r.winner !== p) gifts++; wCalls += m.calls[r.winner]; allCalls += m.calls.X + m.calls.O; break; }
      if (r.outcome === 'draw') { ties++; break; }
      p = p === 'X' ? 'O' : 'X';
    }
  }
  if (cfg) E.setTune('bingo', null);
  return { first: first / dec, ties: ties / N, w: wCalls / dec, all: allCalls / dec, gifts: gifts / dec };
}
const say = (what, r) => console.log(`Bingo ${what}: first mover wins ${(100 * r.first).toFixed(1)}% of decided squares; ties ${(100 * r.ties).toFixed(1)}%; the winner's calls ${r.w.toFixed(2)} (both players ${r.all.toFixed(1)}); squares handed over by a call ${(100 * r.gifts).toFixed(1)}%`);

test('bingo: whole squares, Normal against itself, over many dealt squares: the first mover under 60%, the winner about 4 to 6 calls', () => {
  const r = squares(6000, { X: 'normal', O: 'normal' });
  say('Normal v Normal', r);
  assert.ok(r.first < 0.6, `first-mover win rate under 60% (${(100 * r.first).toFixed(1)}%)`);
  assert.ok(r.w >= 4 && r.w <= 6, `about 4 to 6 calls for the winner (${r.w.toFixed(2)})`);
  assert.ok(r.ties < 0.15, `ties under 15% (${(100 * r.ties).toFixed(1)}%)`);
});

test('bingo: the other settings, for the record (1 to 30, 1 to 20, four numbers a turn, no diagonals)', () => {
  for (const cfg of [{ range: 30 }, { range: 20 }, { offer: 4 }, { diag: 0 }]) say(JSON.stringify(cfg), squares(2000, { X: 'normal', O: 'normal' }, cfg));
});

test('bingo: Hard against Normal, either seat: never worse than Normal against itself by more than a few points', () => {
  const nn = squares(400, { X: 'normal', O: 'normal' }), hx = squares(400, { X: 'hard', O: 'normal' }), ho = squares(400, { X: 'normal', O: 'hard' });
  say('Hard (X) v Normal', hx); say('Normal v Hard (O)', ho);
  assert.ok(hx.first > nn.first - 0.1, `Hard as X: ${(100 * hx.first).toFixed(1)}% against Normal's ${(100 * nn.first).toFixed(1)}%`);
  assert.ok(ho.first < nn.first + 0.1, `Hard as O: the first mover ${(100 * ho.first).toFixed(1)}% against Normal's ${(100 * nn.first).toFixed(1)}%`);
});
