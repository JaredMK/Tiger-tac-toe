'use strict';
// Rock Paper Scissors (November 2026; December 2026: the house throws at random, no deck): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/rps/rules.js');
const A = require('../../src/games/rps/ai.js');

const at = v => () => v;                                          // an rng that always says v (the house's throw: r below 1/3, p, s above 2/3)

test('rps: no house deck anywhere: the square, its public view and its settings hold only the wins; the goal is the admin\'s', () => {
  const m = E.newMini('rps', E.makeRng('a'));
  assert.equal(m.deck, undefined); assert.deepEqual(m.score, { X: 0, O: 0 });
  assert.equal(E.publicMini(m).deck, undefined);
  assert.deepEqual(E.tuneFields('rps').map(f => f.k).sort(), ['again', 'goal']);
  E.setTune('rps', { goal: 2 });
  try { assert.equal(R.rpsCfg(E.newMini('rps', E.makeRng('b'))).goal, 2); } finally { E.setTune('rps', null); }
});

test('rps: the house throws at random, each as likely; a win scores 1 and ends the turn, a loss ends it, a tie keeps the turn', () => {
  const m = E.newMini('rps', E.makeRng('c'));
  let r = E.applyMove(m, 'X', 'p', at(0.1));                      // the house: rock
  assert.deepEqual([r.outcome, r.note, !!r.again, m.score.X, m.last.h], ['continue', 'won', false, 1, 'r']);
  r = E.applyMove(m, 'X', 'p', at(0.9));                          // scissors: lost
  assert.deepEqual([r.note, !!r.again, m.score.X, m.last.h], ['lost', false, 1, 's']);
  r = E.applyMove(m, 'X', 'p', at(0.5));                          // paper: a tie, throw again
  assert.deepEqual([r.note, r.again, m.tie], ['tie', true, 'X']);
  assert.equal(E.applyMove(m, 'X', 'x', at(0)).ok, false, 'never a throw that is not one');
  const seen = { r: 0, p: 0, s: 0 }, rng = E.makeRng('even');
  for (let k = 0; k < 3000; k++) { const t = E.newMini('rps', rng); E.applyMove(t, 'X', 'r', rng); seen[t.last.h]++; }
  for (const k of ['r', 'p', 's']) assert.ok(seen[k] > 850 && seen[k] < 1150, `the house throws ${k} about a third of the time (${seen[k]})`);
  const st = E.newMatch(E.makeRng('d'), { games: ['rps'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 's', E.makeRng('e')).ok);
  assert.deepEqual(Object.keys(st.flash.rps).sort(), ['h', 'res', 'score', 't']);
  assert.ok(E.playMs(st.flash) >= R.rpsTimes(st.flash.rps).end);
  if (st.flash.rps.res === 'tie') assert.equal(st.lock, 4, 'a tie holds the turn to its square');
  else assert.equal(st.flash.by, p);
});

test('rps: first to the goal takes the square; with "Go again on success" on, a win keeps the turn; a square from before keeps its wins and drops its deck', () => {
  const m = E.newMini('rps', E.makeRng('f')); m.score.X = 2;
  assert.deepEqual([E.applyMove(m, 'X', 'p', at(0.1)).outcome, m.score.X], ['win', 3]);
  E.setTune('rps', { again: 'on' });
  try { assert.equal(E.applyMove(E.newMini('rps', E.makeRng('g')), 'O', 'p', at(0.1)).again, true); } finally { E.setTune('rps', null); }
  const old = { type: 'rps', score: { X: 1, O: 2 }, deck: { X: { r: 1, p: 0, s: 0 }, O: { r: 3, p: 3, s: 3 } }, tie: null, last: null };
  assert.ok(E.applyMove(old, 'O', 'r', at(0.9)).ok);
  assert.deepEqual([old.score.O, old.deck], [3, undefined]);
});

test('rps: the computer throws at random at every level; a turn wins half the time', () => {
  const m = E.newMini('rps', E.makeRng('h'));
  for (const level of ['easy', 'normal', 'hard']) {
    const seen = new Set(); for (let k = 0; k < 40; k++) seen.add(E.localBest(E.publicMini(m), 'X', E.makeRng(level + k), {}, { level }).move);
    assert.equal(seen.size, 3, level);
  }
  assert.equal(A.RPS_WIN, 0.5);
  assert.ok(Math.abs(A.needs(E.publicMini(m), 'X') - 6) < 1e-9, 'three wins at a half a turn: six turns');
});

test('rps: a timeout while a tie waits plays nothing (the turn passes, not a miss)', () => {
  const st = E.newMatch(E.makeRng('i'), { games: ['rps'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 's', at(0.9)).ok); E.endFlash(st);
  assert.equal(st.lock, 4);
  st.timer.deadline = 1; const t = E.timeoutMove(st, E.makeRng('t'));
  assert.ok(t.ok && t.ended); assert.notEqual(st.turn, p);
  assert.equal(st.timer.timeouts[p], 0, 'not a miss');
});

test('rps: whole squares between the computers end with a winner in 3 to 7 turns each', () => {
  let turns = 0, wins = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('rps', rng); let p = 'X'; const n = { X: 0, O: 0 }; let fresh = true;
    for (let k = 0; k < 400; k++) {
      if (fresh) n[p]++;
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok);
      if (r.outcome !== 'continue') { wins++; turns += n.X + n.O; break; }
      fresh = !r.again; if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(wins, 300);
  const each = turns / wins / 2;
  assert.ok(each >= 3 && each <= 7, `turns each ${each.toFixed(2)}`);
});
