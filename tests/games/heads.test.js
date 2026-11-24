'use strict';
// Heads or Tails (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/heads/rules.js');
const M = require('../../src/games/heads/meta.js');

const coin = (...v) => { let k = 0; return () => (v[k++ % v.length] === 'h' ? 0.2 : 0.8); };   // an rng that lands the coin as asked

test('heads: Admin only, luck; its settings; nothing hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'luck', '1.25.0', false]);
  assert.deepEqual(E.gameFields('heads').map(f => f.k), ['wins', 'boards']);
  const m = E.newMini('heads', E.makeRng('a'));
  assert.deepEqual([m.shared, R.headsCfg(m).wins, E.secretOf(m)], [false, 3, null]);
  assert.match(M.explainVars({ boards: 'shared' }).sharedText, /other player/); assert.equal(M.explainVars({ boards: 'separate' }).sharedText, '');
});

test('heads: a call a turn; a right call is a point, a wrong one nothing; first to 3 wins', () => {
  const m = E.newMini('heads', E.makeRng('b'));
  let r = E.applyMove(m, 'X', 'h', coin('h'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.n.X, m.last.side, m.last.right, m.last.to], ['continue', 'right', false, 1, 'h', true, 'X']);
  r = E.applyMove(m, 'O', 'h', coin('t'));
  assert.deepEqual([r.note, m.n.O, m.n.X, m.last.to], ['wrong', 0, 1, null], 'separate: a wrong call is nobody\'s point');
  E.applyMove(m, 'X', 't', coin('t'));
  r = E.applyMove(m, 'X', 't', coin('t'));
  assert.deepEqual([r.outcome, r.winner, m.n.X], ['win', undefined, 3]);
  for (const bad of [null, 'x', 0, {}, 'heads']) assert.equal(E.applyMove(E.newMini('heads', E.makeRng('c')), 'X', bad, coin('h')).ok, false);
  let h = 0; const rng = E.makeRng('fair'); for (let k = 0; k < 4000; k++) { const t = E.newMini('heads', rng); E.applyMove(t, 'X', 'h', rng); if (t.last.side === 'h') h++; }
  assert.ok(Math.abs(h / 4000 - 0.5) < 0.03, 'a fair coin');
});

test('heads: shared: the one flip counts for both, a wrong call is the other player\'s point and can hand them the square', () => {
  E.setTune('heads', { boards: 'shared' });
  try {
    const m = E.newMini('heads', E.makeRng('s')); assert.equal(m.shared, true);
    E.applyMove(m, 'X', 'h', coin('t')); E.applyMove(m, 'O', 't', coin('t'));
    assert.deepEqual(m.n, { X: 0, O: 2 });
    const r = E.applyMove(m, 'X', 'h', coin('t'));
    assert.deepEqual([r.outcome, r.winner, r.note, m.n.O], ['win', 'O', 'gift', 3]);
  } finally { E.setTune('heads', null); }
  assert.equal(E.newMini('heads', E.makeRng('s2')).shared, false);
});

test('heads: the computer calls at random at every level; the flash; a timeout plays nothing; whole squares end', () => {
  const m = E.newMini('heads', E.makeRng('e'));
  for (const level of ['easy', 'normal', 'hard']) assert.equal(new Set(Array.from({ length: 40 }, (_, k) => E.localBest(E.publicMini(m), 'X', E.makeRng(level + k), {}, { level }).move)).size, 2, level);
  const st = E.newMatch(E.makeRng('i'), { games: ['heads'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 'h', E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.ht).sort(), ['by', 'call', 'from', 'n', 'right', 'side', 'to']);
  assert.ok(E.playMs(st.flash) >= R.HEADS.judge); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  let wins = 0;
  for (let g = 0; g < 200; g++) { const rng = E.makeRng('w' + g), t = E.newMini('heads', rng); let q = 'X'; for (let k = 0; k < 400; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: 'normal' }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 200);
});
