'use strict';
// Mancala Race (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/mancala/rules.js');
const M = require('../../src/games/mancala/meta.js');

const C = { target: 10, extra: true, capture: true, cross: true };
const board = (X, O, bx = 0, bo = 0) => ({ type: 'mancala', v: 1, pits: { X: X.slice(), O: O.slice() }, bank: { X: bx, O: bo }, last: null });
const total = m => m.pits.X.concat(m.pits.O).reduce((s, v) => s + v, 0) + m.bank.X + m.bank.O;

test('mancala: Admin only, brain; the deal: six pits a side, three seeds a pit on average, the two sides the same pit for pit', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'brain', '1.24.0']);
  assert.deepEqual(E.tuneFields('mancala').map(f => f.k), ['target', 'extra', 'capture', 'cross', 'pits', 'seeds', 'mix']);
  let uneven = 0;
  for (let g = 0; g < 60; g++) {
    const m = E.newMini('mancala', E.makeRng('d' + g));
    assert.deepEqual(m.pits.X, m.pits.O, 'the same for both'); assert.equal(m.pits.X.length, 6); assert.equal(total(m), 36);
    assert.ok(m.pits.X.every(v => v >= 2 && v <= 4)); if (m.pits.X.some(v => v !== 3)) uneven++;
  }
  assert.ok(uneven > 40, 'most deals are uneven');
  E.setTune('mancala', { mix: 'off', pits: 4 });
  try { assert.deepEqual(E.newMini('mancala', E.makeRng('e')).pits.X, [3, 3, 3, 3]); } finally { E.setTune('mancala', null); }
  assert.equal(E.secretOf(E.newMini('mancala', E.makeRng('f'))), null);
});

test('mancala: sowing: one seed a place along your side, into your bank, along the other side from its far end, never into the other bank', () => {
  let r = R.mancSow({ X: [0, 0, 3, 0], O: [1, 1, 1, 1] }, { X: 0, O: 0 }, 'X', 2, C);
  assert.deepEqual([r.pits.X, r.pits.O, r.bank, r.path], [[0, 0, 0, 1], [2, 1, 1, 1], { X: 1, O: 0 }, [['X', 3], ['X', 'bank'], ['O', 0]]]);
  r = R.mancSow({ X: [0, 0, 0, 7], O: [0, 0, 0, 0] }, { X: 0, O: 0 }, 'X', 3, Object.assign({}, C, { capture: false }));   // a full lap: bank, the other side's four, back onto its own (the other bank skipped)
  assert.deepEqual([r.pits.X, r.pits.O, r.bank], [[1, 1, 0, 0], [1, 1, 1, 1], { X: 1, O: 0 }]);
  r = R.mancSow({ X: [0, 0, 5, 0], O: [0, 0, 0, 0] }, { X: 0, O: 0 }, 'X', 2, Object.assign({}, C, { cross: false }));
  assert.deepEqual([r.pits.X, r.pits.O, r.bank.X], [[1, 1, 1, 1], [0, 0, 0, 0], 1], 'crossing off: round its own side again');
  for (let g = 0; g < 200; g++) { const rng = E.makeRng('s' + g), m = E.newMini('mancala', rng); let p = 'X'; for (let k = 0; k < 40; k++) { const r2 = E.applyMove(m, p, E.randomLegalMove(m, p, rng), rng); assert.ok(r2.ok); assert.equal(total(m), 36, 'no seed is ever lost or made'); if (r2.outcome !== 'continue') break; if (!r2.again) p = p === 'X' ? 'O' : 'X'; } }
});

test('mancala: the last seed in your bank goes again; in an empty pit of yours with seeds opposite it captures; the target takes the square', () => {
  const m = board([0, 0, 2, 1], [2, 0, 3, 3]);
  let r = E.applyMove(m, 'X', 3, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.again, r.note, m.bank.X], ['continue', true, 'again', 1]);
  assert.equal(E.applyMove(m, 'X', 3, E.makeRng('x')).reason, 'bad', 'an empty pit');
  const cap = board([1, 0, 0, 0], [0, 0, 4, 0]);                   // X's seed lands in its empty pit 1; opposite it is O's pit 2
  r = E.applyMove(cap, 'X', 0, E.makeRng('x'));
  assert.deepEqual([r.note, !!r.again, cap.bank.X, cap.pits.X, cap.pits.O, cap.last.cap], ['capture', false, 5, [0, 0, 0, 0], [0, 0, 0, 0], { i: 1, n: 5 }]);
  const win = board([0, 0, 0, 1], [3, 3, 3, 3], 9);
  assert.equal(E.applyMove(win, 'X', 3, E.makeRng('x')).outcome, 'win');
  E.setTune('mancala', { extra: 'off', capture: 'off' });
  try { const t = E.newMini('mancala', E.makeRng('g')); t.pits.X = [0, 0, 0, 0, 0, 1]; assert.equal(!!E.applyMove(t, 'X', 5, E.makeRng('x')).again, false); } finally { E.setTune('mancala', null); }
});

test('mancala: nothing to sow on your turn ends the square for whoever banked more (level: a draw): a player alone always ends it', () => {
  const m = board([0, 0, 0, 0], [2, 2, 2, 2], 4, 2);
  assert.deepEqual(R.mancMoves(m, 'X'), []); assert.equal(E.randomLegalMove(m, 'X', E.makeRng('r')), 'end');
  let r = E.applyMove(m, 'X', 'end', E.makeRng('x')); assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'X', 'out']);
  const lvl = board([0, 0, 0, 0], [1, 0, 0, 0], 3, 3); assert.equal(E.applyMove(lvl, 'X', 'end', E.makeRng('x')).outcome, 'draw');
  assert.equal(E.applyMove(board([1, 0, 0, 0], [1, 0, 0, 0]), 'X', 'end', E.makeRng('x')).reason, 'canmove');
  for (let g = 0; g < 60; g++) {                                 // X alone, O never playing: it ends, and X has banked more
    const rng = E.makeRng('solo' + g), t = E.newMini('mancala', rng); let out = null;
    for (let k = 0; k < 200 && !out; k++) { const r2 = E.applyMove(t, 'X', E.randomLegalMove(t, 'X', rng), rng); if (r2.outcome !== 'continue') out = r2; }
    assert.ok(out && out.outcome === 'win' && (out.winner || 'X') === 'X', 'alone, X takes it');
  }
});

test('mancala: the computer banks what it can (Hard looks ahead and beats Easy); the flash carries the sowing', () => {
  for (let g = 0; g < 40; g++) {                                 // Normal never banks less this turn than the best single sowing would, give or take its care for the reply
    const m = E.newMini('mancala', E.makeRng('n' + g)), c = R.mancCfg(m), gain = i => { const r = R.mancSow(m.pits, m.bank, 'X', i, c); return r.bank.X - m.bank.X + (r.again ? 0.8 : 0); };
    const mv = E.localBest(E.publicMini(m), 'X', E.makeRng('r' + g), {}, { level: 'normal' }).move, top = Math.max(...R.mancMoves(m, 'X').map(gain));
    assert.ok(gain(mv) >= top - 2.01, `a move worth ${gain(mv)} of ${top}`);
  }
  const one = board([0, 0, 0, 0, 0, 1], [3, 3, 3, 3, 3, 3], 9);
  for (const level of ['easy', 'normal', 'hard']) assert.equal(E.localBest(E.publicMini(one), 'X', E.makeRng(level), {}, { level }).move, 5, level + ': the seed that wins');
  let hard = 0;
  for (let g = 0; g < 30; g++) {
    const rng = E.makeRng('h' + g), t = E.newMini('mancala', rng), lv = g % 2 ? { X: 'hard', O: 'easy' } : { X: 'easy', O: 'hard' }; let p = 'X';
    for (let k = 0; k < 300; k++) { const r = E.applyMove(t, p, E.localBest(E.publicMini(t), p, rng, {}, { level: lv[p] }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome !== 'continue') { if (r.outcome === 'win' && lv[r.winner || p] === 'hard') hard++; break; } if (!r.again) p = p === 'X' ? 'O' : 'X'; }
  }
  assert.ok(hard >= 26, `Hard beat Easy in ${hard} of 30`);
  const st = E.newMatch(E.makeRng('i'), { games: ['mancala'] }), p = st.turn, q = st.squares[4].mini;
  assert.ok(E.playMove(st, 4, R.mancMoves(q, p)[0], E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.mc).sort(), ['again', 'by', 'cap', 'from', 'i', 'n', 'path', 'to']); assert.equal(R.timeoutClose(q, p), null);
});
