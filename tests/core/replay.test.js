'use strict';
// The replay log (core/replay.js): its shape, its limits, and the move it rides with.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('replay log: normalized to the same shape from anywhere; gaps kept, a long one cut to 1.5 s, at most 48 inputs; bad input refused', () => {
  assert.deepEqual(E.repNorm([[100, 'key', 'k=C'], [410, 'key', 'k=R'], [700, 'key', 'k=A'], [5100, 'key', 'k=T'], [5300, 'key', 'k=E'], [5600, 'enter']]), [[0, 'key', 'k=C'], [310, 'key', 'k=R'], [600, 'key', 'k=A'], [2100, 'key', 'k=T'], [2300, 'key', 'k=E'], [2600, 'enter']], 'from the first input, the long pause cut, the gaps after it as they were');
  assert.deepEqual(E.repNorm([['0', 'move', 'm=4']]), [[0, 'move', 'm=4']], 'numbers as strings are fine');
  assert.deepEqual(E.repNorm([[0, 'move'], [50, 'move', null]]), [[0, 'move'], [50, 'move']], 'no value: a two-part entry');
  assert.deepEqual(E.repNorm([[300, 'a'], [100, 'b']]), [[0, 'a'], [0, 'b']], 'time never runs backwards');
  assert.equal(E.repNorm(Array.from({ length: 60 }, (_, i) => [i * 10, 'key', 'k=A'])).length, E.REP.max, 'only the last 48');
  for (const bad of [null, 'x', [], [[0]], [['a', 'key']], [[0, 'Key']], [[0, 'key', 'k=<b>']], [[0, 'a-very-long-control-name']], [[NaN, 'key']], [[0, 'key', 'x'.repeat(61)]]]) assert.equal(E.repNorm(bad), null, 'refused: ' + JSON.stringify(bad));
});
test('replay log: the move rides the flash when small; a run, a recording or a long move does not', () => {
  assert.equal(E.repMove(4), 4); assert.equal(E.repMove('STARE'), 'STARE'); assert.deepEqual(E.repMove([0, 1, 2, 3]), [0, 1, 2, 3]); assert.deepEqual(E.repMove({ aim: 0.1, power: 0.5 }), { aim: 0.1, power: 0.5 });
  assert.equal(E.repMove({ dist: 100, ms: 5000, log: 'a:j' }), undefined, 'a run with its log');
  assert.equal(E.repMove({ hits: [], ms: 1, rec: '' }), undefined, 'a ball with its recording');
  assert.equal(E.repMove('x'.repeat(70)), undefined, 'too long');
  assert.equal(E.repMove(undefined), undefined);
  assert.equal(E.repOf('STARE'), 'm="STARE"'); assert.equal(E.repOf(4), 'm=4');
});
test('replay log: a move played with a log carries it on the flash, normalized; a bad log is dropped', () => {
  const st = E.newMatch(E.makeRng('rep'), { games: ['ttt'] });
  const r = E.playMove(st, 4, 4, E.makeRng('x'), { rep: [[20, 'move', 'm=4']] });
  assert.equal(r.ok, true); assert.deepEqual(st.flash.rep, [[0, 'move', 'm=4']]); assert.equal(st.flash.m, 4);
  E.endFlash(st);
  const r2 = E.playMove(st, 4, 0, E.makeRng('y'), { rep: 'nonsense' });
  assert.equal(r2.ok, true); assert.ok(!('rep' in st.flash)); assert.equal(st.flash.m, 0);
});
