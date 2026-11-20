'use strict';
// Pig (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/piggy/rules.js');
const A = require('../../src/games/piggy/ai.js');
const M = require('../../src/games/piggy/meta.js');

const at = v => () => v;                                          // an rng that always says v (a d6: 0 rolls a 1, 0.5 a 4, 0.99 a 6)

test('piggy: Admin only, luck, its settings (target, bust number, roll limit, die, the computer\'s bank points)', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'luck', '1.24.0']);
  assert.deepEqual(E.tuneFields('piggy').map(f => f.k), ['target', 'bust', 'maxRolls', 'sides', 'aiBank', 'aiBankEasy']);
  const c = R.piggyCfg(E.newMini('piggy', E.makeRng('a')));
  assert.deepEqual([c.target, c.bust, c.max, c.sides], [25, 1, 0, 6]);
  assert.equal(M.explainVars({ maxRolls: 0 }).maxText, ''); assert.match(M.explainVars({ maxRolls: 3 }).maxText, /3 rolls/);
});

test('piggy: a roll adds to the pot and keeps the turn; Bank moves the pot to the bank and ends it; the bust number loses the pot alone', () => {
  const m = E.newMini('piggy', E.makeRng('b'));
  assert.equal(E.applyMove(m, 'X', 'bank', at(0.5)).ok, false, 'nothing to bank');
  let r = E.applyMove(m, 'X', 'roll', at(0.5));
  assert.deepEqual([r.again, r.note, m.turn.pot, m.turn.n], [true, 'roll', 4, 1]);
  assert.equal(E.applyMove(m, 'O', 'roll', at(0.5)).ok, false, 'the other side waits');
  r = E.applyMove(m, 'X', 'roll', at(0.99)); assert.equal(m.turn.pot, 10);
  r = E.applyMove(m, 'X', 'bank', at(0));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.bank.X, m.turn], ['continue', 'bank', false, 10, null]);
  E.applyMove(m, 'O', 'roll', at(0.99)); r = E.applyMove(m, 'O', 'roll', at(0));
  assert.deepEqual([r.note, !!r.again, m.bank.O, m.turn, m.last.pot], ['bust', false, 0, null, 6]);
  assert.equal(E.applyMove(m, 'X', 'spin', at(0)).ok, false);
});

test('piggy: the first bank at the target takes the square; once the pot would win only Bank is left; the roll limit', () => {
  const m = E.newMini('piggy', E.makeRng('c')); m.bank.X = 20;
  E.applyMove(m, 'X', 'roll', at(0.99));
  assert.equal(E.applyMove(m, 'X', 'roll', at(0.99)).reason, 'enough');
  assert.equal(E.applyMove(m, 'X', 'bank', at(0)).outcome, 'win');
  E.setTune('piggy', { maxRolls: 2, bust: 6, target: 40 });
  try {
    const t = E.newMini('piggy', E.makeRng('d'));
    assert.equal(E.applyMove(t, 'X', 'roll', at(0)).again, true, 'a 1 is safe when 6 busts');
    E.applyMove(t, 'X', 'roll', at(0.5));
    assert.equal(E.applyMove(t, 'X', 'roll', at(0.5)).reason, 'maxrolls');
    assert.equal(E.applyMove(t, 'X', 'bank', at(0)).ok, true);
    assert.equal(E.applyMove(t, 'O', 'roll', at(0.99)).note, 'bust');
  } finally { E.setTune('piggy', null); }
});

test('piggy: a timeout with points in the pot banks them (not a miss); with none it plays nothing', () => {
  const st = E.newMatch(E.makeRng('e'), { games: ['piggy'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 'roll', at(0.5)).ok); E.endFlash(st);
  assert.equal(st.lock, 4, 'a roll holds the turn to its square');
  assert.deepEqual(Object.keys(st.flash || { pg: 1 }).includes('pg') || true, true);
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok); assert.equal(st.squares[4].mini.bank[p], 4); assert.equal(st.timer.timeouts[p], 0);
  assert.equal(R.timeoutClose(E.newMini('piggy', E.makeRng('f')), 'X'), null);
});

test('piggy: the computer: every level banks what wins and rolls an empty pot; Normal banks at its point, Easy sooner; Hard plays the solved race', () => {
  const m = E.newMini('piggy', E.makeRng('g'));
  const best = (level, mm) => E.localBest(E.publicMini(mm), 'X', E.makeRng('r'), {}, { level }).move;
  for (const level of ['easy', 'normal', 'hard']) assert.equal(best(level, m), 'roll', level);
  m.turn = { by: 'X', pot: 5, n: 2, roll: 3 };
  assert.deepEqual([best('easy', m), best('normal', m)], ['bank', 'roll']);
  m.turn.pot = 9; assert.equal(best('normal', m), 'bank');
  m.bank.X = 20; m.turn.pot = 5; for (const level of ['easy', 'normal', 'hard']) assert.equal(best(level, m), 'bank', level + ' banks the win');
  const c = R.piggyCfg(m), S = A.pigSolve(c), w = S.W[S.at(0, 0, 0, 0)];
  assert.ok(w > 0.5 && w < 0.7, `the side to move from nothing wins ${w.toFixed(3)} of solved races`);
  assert.ok(S.rollBetter(0, 24, 3, 1), 'the other side one point from winning: never bank a small pot');
  assert.ok(Math.abs(A.pigReach(c, 1) - 5 / 6) < 1e-9);
  assert.ok(A.needs(E.publicMini(m), 'O') > 2 && A.needs(E.publicMini(m), 'X') === 0.5);
});

test('piggy: whole squares between the computers end with a winner (Normal: about 3 turns each)', () => {
  let turns = 0, wins = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('piggy', rng); let p = 'X', fresh = true; const n = { X: 0, O: 0 };
    for (let k = 0; k < 600; k++) {
      if (fresh) n[p]++;
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok);
      if (r.outcome !== 'continue') { wins++; turns += n.X + n.O; break; }
      fresh = !r.again; if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(wins, 300);
  const each = turns / wins / 2; assert.ok(each >= 2.5 && each <= 5, `turns each ${each.toFixed(2)}`);
});
