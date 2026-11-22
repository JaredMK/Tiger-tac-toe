'use strict';
// Trail Race (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/trail/rules.js');
const M = require('../../src/games/trail/meta.js');

const none = () => 0.5;
test('trail: Admin only, brain; its settings; the deal: each trail starts in the middle of its own edge; nothing hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'brain', '1.25.0', false]);
  assert.deepEqual(E.tuneFields('trail').map(f => f.k), ['size', 'cells', 'even']);
  const m = E.newMini('trail', E.makeRng('a'));
  assert.deepEqual([m.n, m.tr, R.trailCfg(m), E.secretOf(m), R.trailFar(m, 'X'), R.trailFar(m, 'O')], [6, { X: [[0, 3]], O: [[5, 3]] }, { cells: 2, even: false }, null, 5, 0]);
  E.setTune('trail', { size: 7 }); try { assert.deepEqual(E.newMini('trail', E.makeRng('b')).tr, { X: [[0, 3]], O: [[6, 3]] }); } finally { E.setTune('trail', null); }
  assert.deepEqual([R.trailDist(m, 'X'), R.trailDist(m, 'O')], [6, 6], 'five rows and a step aside: the other trail starts straight ahead');
});

test('trail: a trail grows by up to 2 squares, forward or sideways, never back, never through a trail; the far row wins', () => {
  const m = E.newMini('trail', E.makeRng('c'));
  assert.deepEqual(R.trailMoves(m, 'X', 2).sort(), ['e', 'ee', 'en', 'n', 'ne', 'nn', 'nw', 'w', 'wn', 'ww'], 'every move from the start: one or two steps, three ways each, never back on itself');
  let r = E.applyMove(m, 'X', 'nn', none);
  assert.deepEqual([r.outcome, r.note, !!r.again, m.tr.X, m.last.path, m.last.from, m.moves.X, m.used.X], ['continue', 'step', false, [[0, 3], [1, 3], [2, 3]], [[1, 3], [2, 3]], 1, 1, 2]);
  for (const bad of ['s', 'nnn', '', 'x', null, 3, 'ns', {}]) assert.equal(E.applyMove(m, 'X', bad, none).ok, false, JSON.stringify(bad));
  assert.equal(E.applyMove(m, 'O', 'n', none).ok, false, 'O never goes back up');
  E.applyMove(m, 'O', 'ss', none);                                  // O's head now at [3, 3], facing X's at [2, 3]
  assert.equal(E.applyMove(m, 'X', 'n', none).ok, false, 'not through the other trail'); assert.equal(E.applyMove(m, 'X', 'ew', none).ok, false, 'nor back over its own');
  assert.deepEqual([R.trailDist(m, 'X'), R.trailDist(m, 'O')], [4, 4], 'round each other: a step aside, then on');
  E.applyMove(m, 'X', 'en', none); E.applyMove(m, 'O', 'ws', none); E.applyMove(m, 'X', 'nn', none);
  assert.deepEqual(R.trailHead(m, 'X'), [5, 4]);
  const w = E.newMini('trail', E.makeRng('w')); w.tr.X = [[0, 3], [1, 3], [2, 3], [3, 3], [4, 0]]; w.tr.O = [[5, 5]];
  r = E.applyMove(w, 'X', 'n', none); assert.deepEqual([r.outcome, r.note, w.last.path], ['win', 'won', [[5, 0]]]);
  assert.equal(R.trailTry(E.newMini('trail', E.makeRng('f')), 'X', 'nn', 2).won, false);
  const far = E.newMini('trail', E.makeRng('g')); far.tr.X = [[4, 1]]; assert.equal(R.trailTry(far, 'X', 'ne', 2), null, 'the move ends on the far row');
});

test('trail: a player with no step when their turn comes is rubbed out and starts again from their edge', () => {
  const m = E.newMini('trail', E.makeRng('d'));
  m.tr.O = [[5, 3], [4, 3], [4, 4], [4, 5], [3, 5], [2, 5]]; m.tr.X = [[0, 3], [0, 4], [1, 4]];   // O's head at [2, 5] in the corner pocket X is about to close
  let r = E.applyMove(m, 'X', 'ne', none);                          // X to [2, 4] then... [2, 5] is O's: refused
  assert.equal(r.ok, false);
  m.tr.X = [[0, 3], [0, 4], [0, 5], [1, 5], [1, 4]];                 // X under O's head at [1, 5], and beside it after this move
  r = E.applyMove(m, 'X', 'n', none);                               // X to [2, 4]: O's head [2, 5] has [1, 5] X below, [2, 4] X beside, the wall the other side
  assert.deepEqual([r.outcome, r.note, m.last.wipe, m.tr.O, m.wipes.O, m.last.was.length], ['continue', 'wipe', 'O', [[5, 3]], 1, 6], 'boxed in: back to the middle of its own edge, its trail gone');
  assert.equal(R.trailGrid(m)[4][3], null, 'the squares it held are free again');
  const self = E.newMini('trail', E.makeRng('s')); self.tr.X = [[0, 3], [1, 3], [1, 4], [1, 5]]; self.tr.O = [[5, 3], [4, 3], [3, 3], [3, 4], [3, 5], [2, 5]];
  r = E.applyMove(self, 'O', 'w', none);                            // O steps to [2, 4]: X's head [1, 5] has O above at [2, 5], its own trail beside, the wall
  assert.deepEqual([self.last.wipe, self.tr.X], ['X', [[0, 3]]]);
  const blockd = E.newMini('trail', E.makeRng('t')); blockd.tr.X = [[0, 3]]; blockd.tr.O = [[5, 3], [4, 3], [3, 3], [2, 3], [1, 3], [1, 2], [1, 1], [1, 0]];
  assert.equal(R.trailDist(blockd, 'X'), 6, 'a wall is walked round: a step aside, then five rows'); blockd.tr.O.push([0, 0]); blockd.tr.X = [[0, 3], [0, 4], [0, 5]]; blockd.tr.O.splice(0, 0, [1, 5], [1, 4]); assert.equal(R.trailDist(blockd, 'X'), Infinity, 'walled in: no way');
});

test('trail: equal turns (a setting): the first to move across is answered: the shorter trail wins, level a draw, short of it the square is theirs', () => {
  E.setTune('trail', { even: 'on' });
  try {
    const mk = () => { const m = E.newMini('trail', E.makeRng('e')); m.tr.X = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]]; m.tr.O = [[5, 5], [4, 5], [3, 5], [2, 5], [1, 5]]; m.moves = { X: 2, O: 2 }; m.used = { X: 4, O: 4 }; return m; };
    let m = mk(), r = E.applyMove(m, 'X', 'n', none);
    assert.deepEqual([r.outcome, r.note, m.final], ['continue', 'reached', { by: 'X', used: 5 }]);
    r = E.applyMove(m, 'O', 's', none); assert.deepEqual([r.outcome, r.note], ['draw', 'tie'], 'across too, in as many squares');
    m = mk(); m.used.O = 3; E.applyMove(m, 'X', 'n', none); r = E.applyMove(m, 'O', 's', none); assert.deepEqual([r.outcome, r.winner, r.note], ['win', undefined, 'passed']);
    m = mk(); m.used.O = 6; E.applyMove(m, 'X', 'n', none); r = E.applyMove(m, 'O', 's', none); assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'X', 'held']);
    m = mk(); E.applyMove(m, 'X', 'n', none); r = E.applyMove(m, 'O', 'w', none); assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'X', 'held'], 'the answer fell short');
    m = mk(); E.applyMove(m, 'X', 'n', none); assert.equal(E.applyMove(m, 'X', 'e', none).ok, false); r = E.applyMove(m, 'X', 'claim', none); assert.deepEqual([r.outcome, r.note], ['win', 'unanswered']);
    m = mk(); m.moves = { X: 3, O: 2 }; r = E.applyMove(m, 'O', 's', none); assert.deepEqual([r.outcome, r.note], ['win', 'won'], 'the second to move, level on turns after this one: theirs at once');
  } finally { E.setTune('trail', null); }
  const off = E.newMini('trail', E.makeRng('o')); off.tr.X = [[0, 0], [4, 0]]; assert.equal(E.applyMove(off, 'X', 'n', none).outcome, 'win', 'off (the default): first across wins');
});

test('trail: the computer: takes a win, steps round a wall; Hard never lets the other player across when it can stop it; the flash; whole squares end', () => {
  const m = E.newMini('trail', E.makeRng('h')); m.tr.X = [[0, 3], [1, 3], [2, 3], [3, 3]]; m.tr.O = [[5, 0]];
  for (const level of ['easy', 'normal', 'hard']) assert.equal(E.localBest(E.publicMini(m), 'X', E.makeRng(level), {}, { level }).move, 'nn', level + ': straight across');
  const st = E.newMatch(E.makeRng('i'), { games: ['trail'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, p === 'X' ? 'n' : 's', E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.tl).sort(), ['by', 'from', 'm', 'path', 'was', 'wipe']);
  assert.ok(E.playMs(st.flash) >= R.TRAIL.step); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  for (const even of ['off', 'on']) {
    E.setTune('trail', { even });
    try { let ends = 0; for (let g = 0; g < 60; g++) { const rng = E.makeRng('w' + g), t = E.newMini('trail', rng); let q = 'X'; for (let k = 0; k < 600; k++) { const b = E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }); const r = E.applyMove(t, q, b.move, rng); assert.ok(r.ok, `${r.reason}: ${b.move}`); if (r.outcome !== 'continue') { ends++; break; } q = q === 'X' ? 'O' : 'X'; } } assert.equal(ends, 60, 'equal turns ' + even); } finally { E.setTune('trail', null); }
  }
});
test('a move that boxes the mover in rubs the mover\'s own trail out: it starts again from its edge (never a player with no move)', () => {
  const m = E.newMini('trail', E.makeRng('self-box'));
  m.tr = { X: [[0, 3], [0, 2], [0, 1], [1, 1], [1, 2], [2, 2], [2, 1]], O: [[5, 3], [5, 2], [4, 2], [4, 3], [4, 4], [3, 4], [3, 3], [2, 3], [2, 4], [2, 5], [1, 5], [1, 4]] };
  const r = E.applyMove(m, 'O', 'w', E.makeRng('x'));                 // (O steps to [1,3]: X above, its own trail beside: no step left)
  assert.equal(r.ok, true); assert.equal(m.last.wipe, 'O'); assert.deepEqual(m.tr.O, [[5, 3]]); assert.equal(m.wipes.O, 1);
  assert.ok(E.randomLegalMove(m, 'O', E.makeRng('y')) != null, 'O has a move again');
});
