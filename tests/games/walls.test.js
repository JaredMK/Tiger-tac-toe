'use strict';
// Wall Race (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/walls/rules.js');
const M = require('../../src/games/walls/meta.js');

test('walls: Admin only, brain; the deal: a 5x5 board, each pawn in the middle of its own end row, three walls each', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'brain', '1.24.0']);
  assert.deepEqual(E.gameFields('walls').map(f => f.k), ['size', 'walls']);
  const m = E.newMini('walls', E.makeRng('a'));
  assert.deepEqual([m.n, m.at, m.walls, m.left], [5, { X: [4, 2], O: [0, 2] }, [], { X: 3, O: 3 }]);
  assert.deepEqual([R.wallPath(5, [], [4, 2], 'X'), R.wallPath(5, [], [0, 2], 'O')], [4, 4]); assert.equal(E.secretOf(m), null);
});

test('walls: a step goes one square up, down, left or right, never diagonally, off the board or through a wall; pawns may share a square', () => {
  const m = E.newMini('walls', E.makeRng('b'));
  assert.deepEqual(R.wallSteps(m, 'X').map(q => q.join(',')).sort(), ['3,2', '4,1', '4,3']);
  assert.equal(E.applyMove(m, 'X', { s: [3, 3] }, E.makeRng('x')).reason, 'illegal'); assert.equal(E.applyMove(m, 'X', { s: [2, 2] }, E.makeRng('x')).reason, 'illegal');
  let r = E.applyMove(m, 'X', { s: [3, 2] }, E.makeRng('x')); assert.deepEqual([r.outcome, r.note, m.at.X], ['continue', 'step', [3, 2]]);
  m.walls.push(['h', 2, 1]);                                      // a wall under row 2, columns 1 and 2: the way up from 3,2 is shut
  assert.ok(R.wallShut(m.walls, 3, 2, -1, 0) && R.wallShut(m.walls, 2, 1, 1, 0) && !R.wallShut(m.walls, 3, 3, -1, 0));
  assert.deepEqual(R.wallSteps(m, 'X').map(q => q.join(',')).sort(), ['3,1', '3,3', '4,2']);
  m.at.O = [3, 3]; assert.ok(E.applyMove(m, 'X', { s: [3, 3] }, E.makeRng('x')).ok, 'onto the other pawn\'s square');
  for (const bad of [null, {}, 'x', { s: 5 }, { w: ['x', 0, 0] }, { w: ['h', 9, 0] }]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
});

test('walls: a wall is two squares long, never over or across another, and never where it would shut a pawn off from its far side', () => {
  const m = E.newMini('walls', E.makeRng('c'));
  let r = E.applyMove(m, 'X', { w: ['h', 0, 1] }, E.makeRng('x')); assert.deepEqual([r.note, m.left.X, m.walls], ['wall', 2, [['h', 0, 1]]]);
  for (const [o, rr, cc, why] of [['h', 0, 1, 'the same place'], ['v', 0, 1, 'across it'], ['h', 0, 0, 'over its end'], ['h', 0, 2, 'over its other end']]) assert.equal(R.wallFits(m, o, rr, cc), false, why);
  assert.ok(R.wallFits(m, 'h', 0, 3) && R.wallFits(m, 'v', 0, 0));
  E.applyMove(m, 'O', { w: ['h', 0, 3] }, E.makeRng('x'));        // row 0 now walled under columns 1 to 4: O's only way down is column 0
  assert.equal(R.wallPath(5, m.walls, m.at.O, 'O'), 6);
  assert.equal(R.wallFits(m, 'v', 0, 0), false, 'the wall that would shut the last gap is refused');
  assert.equal(E.applyMove(m, 'X', { w: ['v', 0, 0] }, E.makeRng('x')).reason, 'nofit');
  m.left.X = 0; assert.equal(E.applyMove(m, 'X', { w: ['v', 2, 2] }, E.makeRng('x')).reason, 'nowalls');
  for (let g = 0; g < 80; g++) {                                 // however the walls fall, both pawns always have a way
    const rng = E.makeRng('w' + g), t = E.newMini('walls', rng); let p = 'X';
    for (let k = 0; k < 30; k++) { const spots = R.wallSpots(t, p); if (!spots.length) break; E.applyMove(t, p, { w: spots[Math.floor(rng() * spots.length)] }, rng); assert.ok(R.wallPath(t.n, t.walls, t.at.X, 'X') >= 0 && R.wallPath(t.n, t.walls, t.at.O, 'O') >= 0); p = p === 'X' ? 'O' : 'X'; }
  }
});

test('walls: the first pawn on its far row takes the square; a pawn alone always gets there', () => {
  const m = E.newMini('walls', E.makeRng('d')); m.at.X = [1, 2];
  assert.deepEqual([E.applyMove(m, 'X', { s: [0, 2] }, E.makeRng('x')).outcome, m.at.X], ['win', [0, 2]]);
  for (let g = 0; g < 40; g++) {
    const rng = E.makeRng('solo' + g), t = E.newMini('walls', rng); let won = false;
    for (let k = 0; k < 6; k++) { const sp = R.wallSpots(t, 'X'); if (sp.length && k < 3) E.applyMove(t, 'X', { w: sp[Math.floor(rng() * sp.length)] }, rng); }
    for (let k = 0; k < 60 && !won; k++) { const steps = R.wallSteps(t, 'O'), d = q => R.wallPath(t.n, t.walls, q, 'O'), best = steps.reduce((a, b) => (d(b) < d(a) ? b : a)); won = E.applyMove(t, 'O', { s: best }, rng).outcome === 'win'; }
    assert.ok(won);
  }
});

test('walls: the computer steps along its shortest way, walls when it is losing the race, and every square ends; the flash carries the move', () => {
  const m = E.newMini('walls', E.makeRng('e'));
  assert.deepEqual(E.localBest(E.publicMini(m), 'X', E.makeRng('n'), {}, { level: 'normal' }).move, { s: [3, 2] }, 'level, and first to move: straight on');
  m.at.O = [3, 2]; m.at.X = [4, 0]; const mv = E.localBest(E.publicMini(m), 'X', E.makeRng('n'), {}, { level: 'normal' }).move;
  assert.ok(mv.w, 'O one step from home: a wall'); const t = JSON.parse(JSON.stringify(m)); E.applyMove(t, 'X', mv, E.makeRng('x')); assert.ok(R.wallPath(5, t.walls, t.at.O, 'O') > 1, 'that lengthens O\'s way');
  let ends = 0;
  for (let g = 0; g < 40; g++) {
    const rng = E.makeRng('g' + g), q = E.newMini('walls', rng), lv = ['easy', 'normal', 'normal', 'hard'][g % 4]; let p = 'X';
    for (let k = 0; k < 300; k++) { const r = E.applyMove(q, p, E.localBest(E.publicMini(q), p, rng, {}, { level: g % 4 === 3 && p === 'O' ? 'normal' : lv, until: null }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome === 'win') { ends++; break; } p = p === 'X' ? 'O' : 'X'; }
  }
  assert.equal(ends, 40);
  const st = E.newMatch(E.makeRng('i'), { games: ['walls'] });
  assert.ok(E.playMove(st, 4, { w: ['h', 1, 1] }, E.makeRng('s')).ok); assert.deepEqual(st.flash.wr, { by: st.flash.by, wall: ['h', 1, 1] });
});
