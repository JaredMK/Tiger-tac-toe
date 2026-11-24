'use strict';
// Shape Split (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/split/rules.js');
const M = require('../../src/games/split/meta.js');

const SQUARE = [[10, 10], [90, 10], [90, 90], [10, 90]];

test('split: Admin only, skill; its settings (the target, three bands and their points, the corners, the computer\'s error)', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'skill', '1.24.0']);
  assert.deepEqual(E.gameFields('split').map(f => f.k), ['target', 'band1', 'pts1', 'band2', 'pts2', 'band3', 'pts3', 'corners', 'aiErrEasy', 'aiErr', 'aiErrHard']);
  const c = R.splitCfg(E.newMini('split', E.makeRng('a')));
  assert.deepEqual([c.target, c.bands, c.corners], [6, [[1, 3], [3, 2], [6, 1]], 8]);
});

test('split: a shape comes from the square\'s public seed, the player and the cut: a simple many-cornered shape inside the mat, new every cut', () => {
  const m = E.newMini('split', E.makeRng('b'));
  const a = R.splitShape(m, 'X'), b = R.splitShape(JSON.parse(JSON.stringify(E.publicMini(m))), 'X');
  assert.deepEqual(a, b, 'from what is public alone'); assert.equal(a.length, 8);
  assert.notDeepEqual(R.splitShape(m, 'O'), a); assert.notDeepEqual(R.splitShape(m, 'X', 1), a);
  for (let g = 0; g < 40; g++) {
    const t = E.newMini('split', E.makeRng('s' + g)), sh = R.splitShape(t, g % 2 ? 'X' : 'O', g % 5);
    for (const [x, y] of sh) assert.ok(x >= 7.9 && x <= 92.1 && y >= 7.9 && y <= 92.1, 'inside the mat');
    assert.ok(R.splitArea(sh) > 900, 'a shape with room to cut');
    for (const ang of [0, 0.6, 1.3, 2.4]) {                       // any cut's two parts add up to the shape
      const l = R.splitAim(sh, ang, 0.5), cut = R.splitCut(sh, l.a, l.b);
      assert.ok(Math.abs(R.splitArea(cut.parts[0]) + R.splitArea(cut.parts[1]) - R.splitArea(sh)) < 0.5);
      assert.ok(Math.abs(cut.pct - 50) <= 0.6, `an aimed cut is half and half (${cut.pct})`);
    }
  }
});

test('split: the areas either side are exact; the bands score by how far from half and half; a line off the shape scores nothing', () => {
  const c = R.splitCfg(E.newMini('split', E.makeRng('c')));
  const cut = x => R.splitCut(SQUARE, [x, 0], [x, 100]);
  assert.equal(cut(50).pct, 50); assert.equal(cut(30).pct, 25, 'the first share is the side on the line\'s one hand as it runs'); assert.equal(R.splitCut(SQUARE, [30, 100], [30, 0]).pct, 75, 'the other way round: the other side');
  assert.deepEqual([50, 50.8, 51.2, 52.4, 53, 54.8, 55.2, 70].map(x => R.splitScore(c, cut(x)).pts), [3, 3, 2, 2, 1, 1, 0, 0]);
  assert.deepEqual(R.splitScore(c, cut(5)), { pts: 0, err: 50, band: -1 }); assert.ok(cut(5).miss);
  const diag = R.splitCut(SQUARE, [0, 0], [100, 100]); assert.equal(diag.pct, 50);
});

test('split: a move is one line; the score counts on to the target, never past it; a bad line is refused', () => {
  const m = E.newMini('split', E.makeRng('d')), sh = R.splitShape(m, 'X');
  let r = E.applyMove(m, 'X', R.splitAim(sh, 0.4, 0.5), E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.score.X, m.n.X, m.last.pts], ['continue', 'cut', false, 3, 1, 3]);
  r = E.applyMove(m, 'O', R.splitAim(R.splitShape(m, 'O'), 1, 0.8), E.makeRng('x'));
  assert.deepEqual([r.note, m.score.O, m.last.pts], ['off', 0, 0]);
  r = E.applyMove(m, 'X', R.splitAim(R.splitShape(m, 'X'), 2, 0.5), E.makeRng('x'));
  assert.deepEqual([r.outcome, m.score.X], ['win', 6]);
  for (const bad of [null, {}, { a: [0, 0] }, { a: [0, 0], b: [1, 1] }, { a: [0, 0], b: [NaN, 5] }, { a: [0, 0], b: [900, 5] }, { a: ['0', 0], b: [50, 50] }, 'cut']) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  const st = E.newMatch(E.makeRng('i'), { games: ['split'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, R.splitAim(R.splitShape(st.squares[4].mini, p), 0.2, 0.52), E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.sp).sort(), ['a', 'b', 'band', 'by', 'from', 'miss', 'n', 'pct', 'pts', 'to']);
  assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
});

test('split: the computer aims for half with an error by level (Hard nearest, Easy furthest); whole squares end with a winner', () => {
  const m = E.newMini('split', E.makeRng('e')), sh = R.splitShape(m, 'X'), c = R.splitCfg(m);
  const avg = level => { let s = 0; for (let k = 0; k < 400; k++) { const l = E.localBest(E.publicMini(m), 'X', E.makeRng(level + k), {}, { level }).move; s += R.splitScore(c, R.splitCut(sh, l.a, l.b)).pts; } return s / 400; };
  const e = avg('easy'), n = avg('normal'), h = avg('hard');
  assert.ok(e < n && n < h, `points a cut: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}`);
  let wins = 0;
  for (let g = 0; g < 200; g++) {
    const rng = E.makeRng('w' + g), t = E.newMini('split', rng); let q = 'X';
    for (let k = 0; k < 300; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: 'normal' }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; }
  }
  assert.equal(wins, 200);
});
