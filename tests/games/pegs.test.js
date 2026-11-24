'use strict';
// Peg Jump Race (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/pegs/rules.js');
const M = require('../../src/games/pegs/meta.js');

const board = (X, O, rows = 4, cols = 5) => ({ type: 'pegs', v: 1, rows, cols, pegs: { X, O }, home: { X: X.filter(q => !q).length, O: O.filter(q => !q).length }, hop: null, last: null });

test('pegs: Admin only, brain; the deal: three pegs each on their own end row, in the middle columns', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'brain', '1.24.0']);
  assert.deepEqual(E.gameFields('pegs').map(f => f.k), ['pegs', 'rows', 'cols']);
  const m = E.newMini('pegs', E.makeRng('a'));
  assert.deepEqual([m.rows, m.cols, m.pegs.X, m.pegs.O], [4, 5, [[3, 1], [3, 2], [3, 3]], [[0, 1], [0, 2], [0, 3]]]);
  assert.deepEqual(E.publicMini(m).pegs, m.pegs, 'nothing hidden'); assert.equal(E.secretOf(m), null);
});

test('pegs: a step goes one cell forward, straight or diagonal, onto an empty cell; never back, sideways or onto a peg', () => {
  const m = board([[3, 2], [2, 0], null], [[0, 0], [0, 1], [1, 1]]);
  const to = k => R.pegMovesOf(m, 'X', k, false).map(x => x.to.join(',') + (x.jump ? 'j' : '') + (x.home ? 'h' : '')).sort();
  assert.deepEqual(to(0), ['2,1', '2,2', '2,3']);
  assert.deepEqual(to(1), ['0,2jh', '1,0'], 'the edge peg: a step ahead, and a jump over the peg at 1,1 to the far row (home)');
  assert.equal(E.applyMove(m, 'X', { k: 0, to: [3, 3] }, E.makeRng('x')).reason, 'illegal'); assert.equal(E.applyMove(m, 'X', { k: 0, to: [2, 2] }, E.makeRng('x')).ok, true);
  assert.deepEqual(m.pegs.X[0], [2, 2]); assert.equal(m.hop, null);
  for (const bad of [null, {}, { k: 0 }, { k: 9, to: [1, 1] }, 'stop', 'pass', { k: 0, to: 'home' }]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
});

test('pegs: a jump goes over any peg, either player\'s, onto the empty cell beyond; a chain may go on or stop; the far row and beyond is home', () => {
  const m = board([[3, 2], [2, 2], null], [[1, 2], [0, 0], null]);
  // X's peg at 3,2 jumps its own peg at 2,2? the cell beyond (1,2) holds a peg: no. Its peg at 2,2 jumps O's at 1,2 to the far row: home.
  assert.ok(!R.pegMovesOf(m, 'X', 0, false).some(x => x.jump && x.to[1] === 2));
  let r = E.applyMove(m, 'X', { k: 1, to: [0, 2] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.pegs.X[1], m.home.X, m.last.over], ['continue', 'jump', false, null, 2, [1, 2]]);
  const c = board([[3, 1], null, null], [[2, 1], [0, 1], null]);    // a chain: over 2,1 to 1,1, then over the peg on the far row and off the board
  r = E.applyMove(c, 'X', { k: 0, to: [1, 1] }, E.makeRng('x'));
  assert.deepEqual([r.again, c.hop, r.note], [true, { by: 'X', k: 0 }, 'jump']);
  assert.deepEqual(R.pegMoves(c, 'X').map(x => x.to), [[-1, 1]], 'mid-chain: that peg\'s jumps alone');
  const stop = JSON.parse(JSON.stringify(c)); assert.deepEqual([E.applyMove(stop, 'X', 'stop', E.makeRng('x')).note, stop.hop], ['stop', null]);
  assert.equal(R.timeoutClose(c, 'X'), 'stop'); assert.equal(R.timeoutClose(c, 'O'), null);
  r = E.applyMove(c, 'X', { k: 0, to: [-1, 1] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, c.home.X], ['win', 'home', 3], 'the last peg home takes the square');
});

test('pegs: a forward move always exists: thousands of squares at random and by the computer never leave a player without one', () => {
  for (const set of [null, { rows: 3 }, { rows: 6, cols: 4, pegs: 4 }, { cols: 6, pegs: 2 }]) {
    E.setTune('pegs', set);
    try {
      for (let g = 0; g < 250; g++) {
        const rng = E.makeRng('f' + g), m = E.newMini('pegs', rng); let p = 'X', done = false;
        for (let k = 0; k < 400 && !done; k++) {
          const all = R.pegMoves(m, p); if (!(m.hop && m.hop.by === p)) assert.ok(all.length > 0, `${p} has a move (${JSON.stringify(m.pegs)})`);
          const r = E.applyMove(m, p, g % 4 === 0 ? E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move : E.randomLegalMove(m, p, rng), rng);
          assert.ok(r.ok, r.reason); done = r.outcome === 'win'; if (!r.again) p = p === 'X' ? 'O' : 'X';
        }
        assert.ok(done, 'every square ends');
      }
    } finally { E.setTune('pegs', null); }
  }
});

test('pegs: the computer takes a peg home when it can, and Hard beats Easy; the flash carries the move', () => {
  const m = board([[1, 2], null, null], [[2, 0], [2, 4], null]);
  for (const level of ['normal', 'hard']) { const mv = E.localBest(E.publicMini(m), 'X', E.makeRng(level), {}, { level }).move; assert.deepEqual([mv.k, mv.to[0]], [0, 0], level + ': the last peg, one step from home, goes home'); }
  let hard = 0;
  for (let g = 0; g < 30; g++) {
    const rng = E.makeRng('h' + g), t = E.newMini('pegs', rng), lv = g % 2 ? { X: 'hard', O: 'easy' } : { X: 'easy', O: 'hard' }; let p = 'X';
    for (let k = 0; k < 300; k++) { const r = E.applyMove(t, p, E.localBest(E.publicMini(t), p, rng, {}, { level: lv[p], until: null }).move, rng); if (r.outcome === 'win') { if (lv[p] === 'hard') hard++; break; } if (!r.again) p = p === 'X' ? 'O' : 'X'; }
  }
  assert.ok(hard >= 26, `Hard beat Easy in ${hard} of 30`);
  const st = E.newMatch(E.makeRng('i'), { games: ['pegs'] }), p = st.turn, q = st.squares[4].mini, mv = R.pegMoves(q, p)[0];
  assert.ok(E.playMove(st, 4, { k: mv.k, to: mv.to }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.pg).sort(), ['by', 'from', 'home', 'jump', 'k', 'more', 'over', 'to']);
});
