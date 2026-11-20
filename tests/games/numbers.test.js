'use strict';
// Number Target (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/numbers/rules.js');
const M = require('../../src/games/numbers/meta.js');

test('numbers: Admin only, brain; its settings; nothing hidden (the puzzle is on show to both, its answer kept nowhere)', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.turnSecs], ['admin', 'brain', '1.25.0', false, 60]);
  assert.deepEqual(E.tuneFields('numbers').map(f => f.k), ['secs', 'attempts', 'numbers', 'tmin', 'tmax', 'aiPct', 'aiPctHard', 'aiPctEasy']);
  const m = E.newMini('numbers', E.makeRng('a'));
  assert.deepEqual([Object.keys(m).sort(), Object.keys(m.pz).sort(), E.secretOf(m)], [['last', 'n', 'pn', 'pz', 'tries', 'type'], ['nums', 'target'], null]);
});

test('numbers: every puzzle: six numbers (two bigger ones), a target in range that no single step makes, and a way to it in three steps', () => {
  for (let g = 0; g < 400; g++) {
    const m = E.newMini('numbers', E.makeRng('p' + g)), { nums, target } = m.pz;
    assert.equal(nums.length, 6); assert.equal(nums.filter(v => R.NUMS.bigs.includes(v) && v >= 10).length, 2); nums.forEach(v => assert.ok(Number.isInteger(v) && v >= 1 && v <= 50));
    assert.ok(target >= 30 && target <= 300 && !nums.includes(target), `target ${target}`);
    assert.equal(R.numbersSolve(m.pz, 1), null, 'never one step away');
    const s = R.numbersSolve(m.pz); assert.ok(s && s.length <= 3, `puzzle ${g} has a way`);
    assert.deepEqual([R.numbersEval(m.pz, s).ok, R.numbersEval(m.pz, s).hit], [true, true]);
  }
  E.setTune('numbers', { numbers: 4, tmin: 20, tmax: 60 }); try { for (let g = 0; g < 60; g++) { const m = E.newMini('numbers', E.makeRng('s' + g)); assert.equal(m.pz.nums.length, 4); assert.ok(m.pz.target >= 20 && m.pz.target <= 60); assert.ok(R.numbersSolve(m.pz)); } } finally { E.setTune('numbers', null); }
});

test('numbers: an attempt: each number once, whole results above zero; the last result equal to the target wins', () => {
  const pz = { nums: [25, 4, 3, 7, 10, 2], target: 107 };
  assert.deepEqual([R.numbersOp(7, '-', 7), R.numbersOp(3, '-', 7), R.numbersOp(7, '/', 2), R.numbersOp(8, '/', 1), R.numbersOp(8, '/', 2), R.numbersOp(8, '%', 2)], [null, null, null, null, 4, null]);
  let ev = R.numbersEval(pz, [[0, '*', 1], [6, '+', 3]]);
  assert.deepEqual([ev.ok, ev.out, ev.value, ev.hit], [true, [[25, '*', 4, 100], [100, '+', 7, 107]], 107, true], 'a result is the next number in play');
  assert.deepEqual([R.numbersEval(pz, []).ok, R.numbersEval(pz, []).value, R.numbersEval(pz, []).hit], [true, null, false], 'nothing made is an attempt too');
  for (const bad of [[[0, '*', 0]], [[0, '*', 1], [0, '+', 2]], [[0, '*', 9]], [[2, '-', 3]], [[3, '/', 5]], [[0, '^', 1]], [[0, '*']], 'x', [[0.5, '+', 1]]]) assert.equal(R.numbersEval(pz, bad).ok, false, JSON.stringify(bad));
  const m = E.newMini('numbers', E.makeRng('b')); m.pz = pz;
  let r = E.applyMove(m, 'X', { steps: [[0, '+', 1]] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.tries, m.last.value, m.last.hit, m.pn], ['continue', 'miss', false, { X: 1, O: 0 }, 29, false, 1]);
  assert.equal(E.applyMove(m, 'O', { steps: [[0, '/', 1]] }, E.makeRng('x')).ok, false); assert.equal(E.applyMove(m, 'O', null, E.makeRng('x')).ok, false);
  r = E.applyMove(m, 'O', { steps: [[0, '*', 1], [6, '+', 3]] }, E.makeRng('x')); assert.deepEqual([r.outcome, m.last.hit], ['win', true]);
});

test('numbers: a new puzzle after 2 attempts each without a hit, or 4 by one player alone', () => {
  const m = E.newMini('numbers', E.makeRng('c')), first = JSON.stringify(m.pz), miss = { steps: [] };
  E.applyMove(m, 'X', miss, E.makeRng('1')); E.applyMove(m, 'O', miss, E.makeRng('2')); E.applyMove(m, 'X', miss, E.makeRng('3'));
  assert.deepEqual([JSON.stringify(m.pz), m.pn, m.tries], [first, 1, { X: 2, O: 1 }]);
  const r = E.applyMove(m, 'O', miss, E.makeRng('4'));
  assert.deepEqual([r.note, m.pn, m.tries, m.last.fresh, JSON.stringify(m.last.nums) === JSON.stringify(JSON.parse(first).nums)], ['fresh', 2, { X: 0, O: 0 }, true, true]); assert.notEqual(JSON.stringify(m.pz), first);
  const a = E.newMini('numbers', E.makeRng('d')); for (let k = 0; k < 3; k++) E.applyMove(a, 'X', miss, E.makeRng('s' + k)); assert.equal(a.pn, 1);
  E.applyMove(a, 'X', miss, E.makeRng('s3')); assert.deepEqual([a.pn, a.tries], [2, { X: 0, O: 0 }], 'alone in the square: a new puzzle after four');
});

test('numbers: the computer finds the way with its level\'s chance; the flash; whole squares end with a winner', () => {
  const rate = level => { let h = 0; for (let k = 0; k < 600; k++) { const t = E.newMini('numbers', E.makeRng('q' + k)), rng = E.makeRng(level + k); if (E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng).outcome === 'win') h++; } return h / 600; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e < n && n < h && Math.abs(n - 0.1) < 0.04, `hits an attempt: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['numbers'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { steps: [] }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.nt).sort(), ['by', 'fresh', 'hit', 'nums', 'steps', 'target', 'tries', 'value']);
  assert.ok(E.playMs(st.flash) >= R.numbersShowMs(st.flash.nt)); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  let wins = 0;
  for (let g = 0; g < 90; g++) { const rng = E.makeRng('w' + g), t = E.newMini('numbers', rng); let q = 'X'; for (let k = 0; k < 3000; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 90);
});
