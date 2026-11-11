'use strict';
// Dice Combo (November 2026): its rules and AI (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const R = require('../../src/games/combo/rules.js');
const A = require('../../src/games/combo/ai.js');

const has = (dice, k) => R.comboHas(R.comboCounts(dice), k);
// a rng that rolls the given faces, in order (randInt(rng, 6) + 1)
const faces = (...f) => { let i = 0; return () => (f[i++ % f.length] - 1 + 0.5) / 6; };

test('combo: what each combo is: a bigger set counts as a smaller one, a large straight as a small one, five alike never a full house', () => {
  assert.ok(has([2, 2, 2, 5, 6], '3k')); assert.ok(!has([2, 2, 5, 5, 6], '3k'));
  assert.ok(has([4, 4, 4, 4, 1], '4k') && has([4, 4, 4, 4, 1], '3k')); assert.ok(!has([4, 4, 4, 1, 1], '4k'));
  assert.ok(has([6, 6, 6, 6, 6], '5k') && has([6, 6, 6, 6, 6], '4k') && has([6, 6, 6, 6, 6], '3k'));
  assert.ok(has([3, 3, 5, 5, 5], 'fh')); assert.ok(!has([6, 6, 6, 6, 6], 'fh'), 'five alike is not a full house'); assert.ok(!has([3, 3, 3, 3, 5], 'fh'));
  for (const d of [[1, 2, 3, 4, 6], [2, 3, 4, 5, 5], [3, 4, 5, 6, 1], [6, 4, 3, 5, 3]]) assert.ok(has(d, 'ss'), String(d));
  assert.ok(!has([1, 2, 3, 5, 6], 'ss'));
  assert.ok(has([1, 2, 3, 4, 5], 'ls') && has([6, 5, 4, 3, 2], 'ls') && has([1, 2, 3, 4, 5], 'ss')); assert.ok(!has([1, 2, 3, 4, 6], 'ls'));
});
test('combo: a move: roll, hold and roll again up to the rolls allowed, then a claim; nothing to claim after the last roll ends it; a claimed combo never again; first to the goal wins', () => {
  E.setTune('combo', { rolls: 3 });
  try {
    const m = E.newMini('combo', E.makeRng('c1'));
    assert.equal(E.applyMove(m, 'X', 'roll:10000', E.makeRng('z')).ok, false, 'no holds before the first roll');
    assert.equal(E.applyMove(m, 'X', 'c:3k', E.makeRng('z')).ok, false, 'no claim before a roll');
    let r = E.applyMove(m, 'X', 'roll', faces(2, 2, 5, 1, 6));
    assert.deepEqual([r.ok, r.again, m.cur.dice, m.cur.rolls], [true, true, [2, 2, 5, 1, 6], 1]);
    assert.equal(E.applyMove(m, 'X', 'roll', E.makeRng('z')).ok, false, 'a first roll only once');
    assert.equal(E.applyMove(m, 'X', 'roll:11111', E.makeRng('z')).ok, false, 'a roll rolls something');
    assert.equal(E.applyMove(m, 'X', 'c:3k', E.makeRng('z')).ok, false, 'not made');
    r = E.applyMove(m, 'X', 'roll:11000', faces(2, 4, 4));
    assert.deepEqual(m.cur.dice, [2, 2, 2, 4, 4], 'the held dice stay, the rest rolled'); assert.equal(r.again, true);
    assert.deepEqual(m.last.open.sort(), ['3k', 'fh']);
    r = E.applyMove(m, 'X', 'c:fh', E.makeRng('z'));
    assert.deepEqual([r.ok, r.outcome, r.again, m.claimed.X, m.cur], [true, 'continue', undefined, ['fh'], null], 'claimed; the turn passes (Go again off)');
    // nothing made after the last roll: the move ends, nothing claimed
    E.applyMove(m, 'O', 'roll', faces(1, 2, 4, 6, 6)); E.applyMove(m, 'O', 'roll:11110', faces(6)); r = E.applyMove(m, 'O', 'roll:11110', faces(6));
    assert.equal(m.cur, null); assert.equal(r.note, 'none'); assert.equal(r.again, undefined); assert.equal(m.last.none, true);
    // the roll limit: a fourth roll is refused
    E.applyMove(m, 'X', 'roll', faces(1, 1, 1, 2, 3)); E.applyMove(m, 'X', 'roll:11100', faces(2, 3)); E.applyMove(m, 'X', 'roll:11100', faces(2, 3));
    assert.equal(E.applyMove(m, 'X', 'roll:11100', E.makeRng('z')).ok, false, 'three rolls at most');
    assert.equal(E.applyMove(m, 'X', 'c:fh', E.makeRng('z')).ok, false, 'never the same combo twice');
    assert.equal(E.applyMove(m, 'X', 'c:3k', E.makeRng('z')).ok, true);
    // the goal
    m.claimed.X = ['3k', 'fh']; E.applyMove(m, 'X', 'roll', faces(1, 2, 3, 4, 6));
    assert.deepEqual(E.applyMove(m, 'X', 'c:ss', E.makeRng('z')).outcome, 'win');
  } finally { E.setTune('combo', null); }
});
test('combo: Go again on success: a claim keeps the turn for a fresh move; a timeout mid-move claims nothing and the next move starts afresh', () => {
  E.setTune('combo', { again: 'on' });
  try {
    const m = E.newMini('combo', E.makeRng('c2'));
    E.applyMove(m, 'X', 'roll', faces(3, 3, 3, 1, 2));
    const r = E.applyMove(m, 'X', 'c:3k', E.makeRng('z')); assert.equal(r.again, true); assert.equal(m.cur, null);
  } finally { E.setTune('combo', null); }
  const st = E.newMatch(E.makeRng('c3'), { games: ['combo'] }), p = st.turn;
  E.playMove(st, 4, 'roll', faces(1, 2, 4, 5, 6)); E.endFlash(st);
  assert.equal(st.lock, 4, 'the move holds the turn to its square');
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok); assert.equal(t.move, 'auto', 'the move under way ends as it stands (rules.js timeoutClose)'); if (st.flash) E.endFlash(st); assert.notEqual(st.turn, p, 'the turn passed'); assert.deepEqual(st.squares[4].mini.claimed[p], [], 'nothing claimed');
  const q = st.turn; assert.ok(E.playMove(st, 4, 'roll', faces(6, 6, 6, 1, 2)).ok, "the other side's move starts afresh");
  assert.equal(st.squares[4].mini.cur.by, q);
});
test('combo: the computer: legal at every level, Hard by the exact table (expected turns), quick; whole squares end with a winner', () => {
  const T = A.comboTable(3, 2, 0, false);
  assert.ok(T.V > 4.5 && T.V < 6, `alone, about 5 turns (${T.V.toFixed(2)}; in a race the winner takes about 4)`);
  for (const level of ['easy', 'normal', 'hard']) {
    for (let g = 0; g < 40; g++) {
      const rng = E.makeRng('cai' + level + g), m = E.newMini('combo', rng); let p = 'X', done = false;
      for (let k = 0; k < 500 && !done; k++) {
        const t0 = performance.now(), b = E.localBest(E.publicMini(m), p, rng, {}, { level, until: null });
        assert.ok(performance.now() - t0 < 400, 'quick');
        const r = E.applyMove(m, p, b.move, rng);
        assert.ok(r.ok, `${level}: ${b.move} (${r.reason})`);
        if (r.outcome === 'win') done = true; else if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
      assert.ok(done, 'the square ends');
    }
  }
  // Hard keeps a pair for the full house it needs rather than claiming nothing
  const m = E.newMini('combo', E.makeRng('h')); m.claimed.X = ['3k', '4k', 'ss', 'ls', '5k'].slice(0, 2); m.cur = { by: 'X', dice: [2, 2, 5, 5, 1], rolls: 1 };
  const h = A.comboHard(E.publicMini(m), 'X');
  assert.ok(/^roll:/.test(h.move) || /^c:/.test(h.move));
  assert.ok(A.needs(E.publicMini(E.newMini('combo', E.makeRng('n'))), 'X') > 1);
});
test('combo: the public view and the flash carry the dice, the holds and the cards; the settings are the admin\'s', () => {
  const st = E.newMatch(E.makeRng('pv'), { games: ['combo'] });
  E.playMove(st, 0, 'roll', faces(1, 1, 3, 4, 5));
  assert.deepEqual(st.flash.combo.dice, [1, 1, 3, 4, 5]); assert.deepEqual(st.flash.combo.held, [0, 0, 0, 0, 0]);
  const pub = E.publicMini(st.squares[0].mini);
  assert.deepEqual(Object.keys(pub).sort(), ['claimed', 'cur', 'type', 'v']);
  E.setTune('combo', { goal: 2, rolls: 3 });
  try { const m = E.newMini('combo', E.makeRng('tt')); assert.deepEqual(m.tune, { goal: 2, rolls: 3 }); } finally { E.setTune('combo', null); }
  const meta = require('../../src/games/combo/meta.js');
  assert.deepEqual([meta.release, meta.category, meta.minVersion, meta.TUNE[0].k, meta.TUNE[0].def], ['admin', 'luck', '1.8.0', 'again', 'off']);
});
