'use strict';
// Fruit Reels (December 2026: the batch's Slot Machine; v 2, a 3x3 window scored on five lines, no hold): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/reels/rules.js');
const A = require('../../src/games/reels/ai.js');
const M = require('../../src/games/reels/meta.js');

// an rng that gives each cell the picture asked for, row by row (the weights 4, 3, 2, 1 of 10: cherry below .4, lemon .7, bell .9, star above)
const pics = (...v) => { const at = [0.1, 0.5, 0.8, 0.95]; let k = 0; return () => at[v[k++ % v.length]]; };

test('reels: Admin only, luck; no gambling words in its name or text; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.info.name], ['admin', 'luck', '1.29.0', 'Fruit Reels']);
  assert.doesNotMatch(`${M.info.name} ${M.info.hint} ${M.explainer.play} ${M.explainer.win} ${M.explainVars({ stars: 'on' }).starText}`, /slot|jackpot|bet|payout|casino|gambl|wager|coin/i);
  assert.deepEqual(E.tuneFields('reels').map(f => [f.k, f.def]), [['target', 10], ['stars', 'on'], ['tri1', 3], ['tri2', 4], ['tri3', 6], ['tri4', 10], ['w1', 4], ['w2', 3], ['w3', 2], ['w4', 1]]);
});

test('reels: a spin fills the 3x3 window; three alike on any of the five lines (rows, diagonals) score; no hold', () => {
  const m = E.newMini('reels', E.makeRng('a'));
  assert.equal(m.v, 2);
  assert.equal(E.applyMove(m, 'X', 'h0', pics(0)).ok, false, 'no hold any more');
  // top row cherries, the diagonal 0-4-8 cherries too: two lines
  let r = E.applyMove(m, 'X', 'spin', pics(0, 0, 0, 1, 0, 2, 3, 1, 0));
  assert.ok(r.ok); assert.deepEqual(m.grid.X, [0, 0, 0, 1, 0, 2, 3, 1, 0]);
  assert.deepEqual(m.last.wins.map(w => [w.line, w.sym, w.pts]), [[0, 0, 3], [3, 0, 3]]); assert.equal(m.score.X, 6); assert.equal(r.outcome, 'continue');
  // nothing on a line: no points (a column of three does not count)
  r = E.applyMove(m, 'O', 'spin', pics(1, 0, 2, 1, 3, 0, 1, 2, 3));
  assert.deepEqual([m.last.wins, m.score.O, r.note], [[], 0, 'none']);
  // the other diagonal, bells: past the target
  r = E.applyMove(m, 'X', 'spin', pics(1, 0, 2, 0, 2, 1, 2, 1, 0));
  assert.deepEqual(m.last.wins.map(w => w.line), [4]); assert.equal(r.outcome, 'win'); assert.equal(m.score.X, 10);
});

test('reels: three stars on a line win at once while that is on; off, they score their points', () => {
  const m = E.newMini('reels', E.makeRng('b'));
  const r = E.applyMove(m, 'O', 'spin', pics(1, 0, 2, 3, 3, 3, 0, 1, 2));
  assert.deepEqual([r.outcome, r.note, m.last.stars], ['win', 'stars', true]);
  E.setTune('reels', { stars: 'off' });
  try { const m2 = E.newMini('reels', E.makeRng('c')); E.applyMove(m2, 'O', 'spin', pics(1, 0, 2, 3, 3, 3, 0, 1, 2)); assert.equal(m2.score.O, 10); assert.equal(m2.last.stars, false); } finally { E.setTune('reels', null); }
});

test('reels: a square from before (three reels and a hold) is dealt again', () => {
  assert.equal(R.stale({ type: 'reels', score: { X: 2, O: 0 }, reels: { X: [0, 0, 1], O: null } }), true);
  assert.equal(R.stale(E.newMini('reels', E.makeRng('d'))), false);
});

test('reels: the computer spins at every level; its needs from a spin\'s exact worth', () => {
  const m = E.newMini('reels', E.makeRng('e'));
  for (const level of ['easy', 'normal', 'hard']) assert.equal(A.best(R.publicView(m), 'X', E.makeRng('r'), null, { level }).move, 'spin');
  const w = A.spinWorth(R.reelsCfg(m));   // 5 lines x (.064 x 3 + .027 x 4 + .008 x 6)
  assert.ok(Math.abs(w.ev - 5 * (0.064 * 3 + 0.027 * 4 + 0.008 * 6)) < 1e-9); assert.ok(w.win > 0.004 && w.win < 0.006);
  assert.ok(A.needs(R.publicView(m), 'X') > 3);
});
