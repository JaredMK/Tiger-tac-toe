'use strict';
// Number Shuffle (December 2026, in place of Number Target): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/numbers/rules.js');
const A = require('../../src/games/numbers/ai.js');
const M = require('../../src/games/numbers/meta.js');

test('numbers: Admin only, brain; its settings; the hidden order is the secret', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.info.name], ['admin', 'brain', '1.28.0', false, 'Number Shuffle']);
  assert.deepEqual(E.gameFields('numbers').filter(f => !/^Computer/.test(f.group)).map(f => [f.k, f.def]), [['mode', 'race'], ['n', 5]]);
  const m = E.newMini('numbers', E.makeRng('a'));
  assert.equal(m.d.length, 5); assert.equal(new Set(m.d).size, 5); assert.deepEqual(m.d, m.d.slice().sort((a, b) => a - b));
  assert.ok(m.tg.X.join('') !== m.tg.O.join(''), 'a race: never the same order');
  assert.deepEqual(E.secretOf(m), { tg: m.tg });
  assert.equal(R.publicView(m).tg, undefined);
});

test('numbers: a guess is an order of the digits; the answer is higher, lower or the hit', () => {
  const m = E.newMini('numbers', E.makeRng('b')), want = R.nsVal(m.tg.X);
  assert.equal(E.applyMove(m, 'X', { o: [1, 2] }, E.makeRng('x')).ok, false, 'too few');
  assert.equal(E.applyMove(m, 'X', { o: m.d.map(() => m.d[0]) }, E.makeRng('x')).ok, false, 'a digit twice');
  const all = R.nsPerms(m.d), g = all[0], r = E.applyMove(m, 'X', { o: g.slice() }, E.makeRng('x'));
  assert.ok(r.ok); assert.equal(m.last.r, R.nsVal(g) === want ? 'eq' : 'hi');
  const rg = R.nsRange(m, 'X'); assert.ok(rg.lo >= 1 && R.nsVal(all[rg.lo]) <= want && R.nsVal(all[rg.hi]) >= want);
  assert.equal(R.nsRange(m, 'O').left, all.length, 'a race: X\'s guesses tell O nothing');
  const w = E.applyMove(m, 'O', { o: m.tg.O.slice() }, E.makeRng('x')); assert.equal(w.outcome, 'win'); assert.deepEqual(m.last.other, m.tg.X);
});

test('numbers: Shared: one hidden order, every guess narrows it for both', () => {
  E.setTune('numbers', { mode: 'shared', n: 4 });
  try {
    const m = E.newMini('numbers', E.makeRng('c'));
    assert.deepEqual(m.tg.X, m.tg.O);
    E.applyMove(m, 'X', { o: R.nsPerms(m.d)[11].slice() }, E.makeRng('x'));
    assert.deepEqual(R.nsRange(m, 'O'), R.nsRange(m, 'X'));
  } finally { E.setTune('numbers', {}); }
});

test('numbers: the computer only guesses what is still possible and always finds it; Hard halves', () => {
  for (const level of ['easy', 'normal', 'hard']) for (let g = 0; g < 40; g++) {
    const m = E.newMini('numbers', E.makeRng(level + g)), rng = E.makeRng('r' + g); let k = 0;
    for (; k < 150; k++) { const mv = A.best(R.publicView(m), 'X', rng, null, { level }).move; if (E.applyMove(m, 'X', mv, rng).outcome === 'win') break; }
    assert.ok(k < (level === 'hard' ? 7 : 150), `${level} found it (${k + 1} guesses)`);
  }
});

test('numbers: a Number Target square from before is stale (dealt again as the record is read)', () => {
  assert.equal(R.stale({ type: 'numbers', pz: { nums: [1], target: 2 } }), true);
  assert.equal(R.stale(E.newMini('numbers', E.makeRng('d'))), false);
});
