'use strict';
// Fruit Reels (December 2026: the batch's Slot Machine): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/reels/rules.js');
const A = require('../../src/games/reels/ai.js');
const M = require('../../src/games/reels/meta.js');

// an rng that gives each reel the picture asked for (the weights 4, 3, 2, 1 of 10: cherry below .4, lemon .7, bell .9, star above)
const pics = (...v) => { const at = [0.1, 0.5, 0.8, 0.95]; let k = 0; return () => at[v[k++ % v.length]]; };

test('reels: Admin only, luck; no gambling words in its name or text; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.info.name], ['admin', 'luck', '1.24.0', 'Fruit Reels']);
  assert.doesNotMatch(`${M.info.name} ${M.info.hint} ${M.explainer.play} ${M.explainer.win} ${M.explainVars({ stars: 'on' }).starText}`, /slot|jackpot|bet|payout|casino|gambl|wager|coin/i);
  assert.deepEqual(E.tuneFields('reels').map(f => f.k), ['target', 'stars', 'pair', 'tri1', 'tri2', 'tri3', 'tri4', 'w1', 'w2', 'w3', 'w4']);
  const c = R.reelsCfg(E.newMini('reels', E.makeRng('a')));
  assert.deepEqual([c.target, c.stars, c.pair, c.tri, c.w], [10, true, 2, [4, 5, 7, 10], [4, 3, 2, 1]]);
});

test('reels: what a spin scores: two alike, three alike by picture, nothing; three stars win the square while that is on', () => {
  const c = R.reelsCfg(E.newMini('reels', E.makeRng('b')));
  assert.deepEqual(R.reelsScore(c, [0, 1, 2]), { pts: 0, kind: 'none', sym: -1, cells: [] });
  assert.deepEqual(R.reelsScore(c, [1, 2, 1]), { pts: 2, kind: 'pair', sym: 1, cells: [0, 2] });
  assert.deepEqual([0, 1, 2].map(k => R.reelsScore(c, [k, k, k]).pts), [4, 5, 7]);
  assert.equal(R.reelsScore(c, [3, 3, 3]).kind, 'stars');
  assert.deepEqual(R.reelsScore(Object.assign({}, c, { stars: false }), [3, 3, 3]), { pts: 10, kind: 'tri', sym: 3, cells: [0, 1, 2] });
  const m = E.newMini('reels', E.makeRng('c'));
  assert.deepEqual([E.applyMove(m, 'X', 'spin', pics(3, 3, 3)).outcome, m.last.kind], ['win', 'stars']);
});

test('reels: one spin a turn; a hold keeps that reel of the player\'s own last spin and spins the other two; first to the target wins', () => {
  const m = E.newMini('reels', E.makeRng('d'));
  assert.equal(E.applyMove(m, 'X', 'h0', pics(0)).reason, 'nohold', 'nothing to hold before a first spin');
  let r = E.applyMove(m, 'X', 'spin', pics(2, 0, 1));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.reels.X, m.score.X], ['continue', 'none', false, [2, 0, 1], 0]);
  assert.equal(E.applyMove(m, 'O', 'h1', pics(0)).reason, 'nohold', 'never the other player\'s reels');
  r = E.applyMove(m, 'X', 'h0', pics(2, 2));                       // the bell held, two more bells
  assert.deepEqual([m.reels.X, m.last.h, m.last.pts, m.score.X, r.note], [[2, 2, 2], 0, 7, 7, 'tri']);
  r = E.applyMove(m, 'X', 'h2', pics(2, 0));
  assert.deepEqual([m.reels.X, m.score.X, r.outcome], [[2, 0, 2], 9, 'continue']);
  r = E.applyMove(m, 'X', 'spin', pics(1, 1, 0));
  assert.deepEqual([r.outcome, m.score.X], ['win', 10], 'never past the target');
  assert.equal(E.applyMove(m, 'X', 'pull', pics(0)).ok, false);
  const seen = [0, 0, 0, 0], rng = E.makeRng('w');
  for (let k = 0; k < 4000; k++) { const t = E.newMini('reels', rng); E.applyMove(t, 'X', 'spin', rng); t.reels.X.forEach(v => seen[v]++); }
  seen.forEach((n, k) => assert.ok(Math.abs(n / 12000 - [0.4, 0.3, 0.2, 0.1][k]) < 0.02, `${R.REELS.names[k]} comes up by its weight (${(n / 12000).toFixed(3)})`));
});

test('reels: the computer: Normal takes the move worth the most points, Hard the fewest spins still needed, Easy anything; the table', () => {
  const m = E.newMini('reels', E.makeRng('e')); m.reels.X = [3, 0, 2];
  const best = (level, seed) => E.localBest(E.publicMini(m), 'X', E.makeRng(seed || 'r'), {}, { level }).move;
  assert.equal(best('normal'), 'h1', 'the cherry held: the likeliest pair');
  assert.ok(R.MOVES.includes(best('hard')));
  assert.ok(new Set(Array.from({ length: 40 }, (_, k) => best('easy', 'e' + k))).size >= 3);
  m.reels.X = null; for (const level of ['easy', 'normal', 'hard']) assert.equal(best(level), 'spin', level + ': a first spin');
  const T = A.reelsTable(R.reelsCfg(m));
  assert.ok(T[0][64] > 5 && T[0][64] < 6.5, `alone, about ${T[0][64].toFixed(2)} spins from nothing`);
  assert.ok(T[9][64] < T[5][64] && T[5][64] < T[0][64]);
  assert.ok(Math.abs(A.needs(E.publicMini(m), 'X') - T[0][64]) < 1e-9);
});

test('reels: the flash carries the spin; a timeout plays nothing; whole squares between the computers end with a winner', () => {
  const st = E.newMatch(E.makeRng('i'), { games: ['reels'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 'spin', E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.rl3).sort(), ['by', 'cells', 'from', 'h', 'kind', 'pts', 'sym', 'to', 'v', 'was']);
  assert.ok(E.playMs(st.flash) >= R.REELS.judge);
  assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  let wins = 0;
  for (let g = 0; g < 200; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('reels', rng); let q = 'X';
    for (let k = 0; k < 400; k++) { const r = E.applyMove(m, q, E.localBest(E.publicMini(m), q, rng, {}, { level: g % 2 ? 'normal' : 'hard' }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; }
  }
  assert.equal(wins, 200);
});
