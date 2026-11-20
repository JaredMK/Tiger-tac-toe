'use strict';
// Shuffleboard (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/shuffle/rules.js');
const M = require('../../src/games/shuffle/meta.js');

const flat = () => 0.5;                                            // (gauss of .5, .5: a small fixed nudge)
const still = () => { let k = 0; return () => (k++ % 2 ? 0.25 : 0.9); };   // gauss = sqrt(-2 ln .9) * cos(pi/2) = 0: no spread at all
test('shuffle: Admin only, skill; its settings; the zones at the lane\'s end', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'skill', '1.25.0', false]);
  assert.deepEqual(E.tuneFields('shuffle').map(f => f.k), ['target', 'boards', 'z1', 'z2', 'z3', 'zoneLen', 'friction', 'spread', 'knock', 'knockLoss', 'flickMin', 'flickMax', 'aiErr', 'aiErrHard', 'aiErrEasy']);
  const m = E.newMini('shuffle', E.makeRng('a')), c = R.shufCfg(m);
  assert.deepEqual([m.shared, c.target, c.vals, c.z0, c.zl], [false, 10, [1, 2, 4], 70, 10]);
  assert.deepEqual([69.9, 70, 79.9, 80, 90, 100, 100.1].map(y => R.shufPts(c, 25, y)), [0, 1, 1, 2, 4, 4, 0]);
  assert.deepEqual([R.shufPts(c, -0.1, 95), R.shufPts(c, 50.1, 95)], [0, 0], 'off a side: nothing');
  assert.match(M.explainVars({ boards: 'shared', knockLoss: 50 }).sharedText, /stay on the lane/); assert.equal(M.explainVars({ boards: 'separate', knockLoss: 50 }).sharedText, '');
});

test('shuffle: a flick slides the puck to where it is aimed; its zone scores; short, off the end and off a side score nothing', () => {
  const m = E.newMini('shuffle', E.makeRng('b')), c = R.shufCfg(m), at = (x, y) => R.shufFlickAt(c, x, y);
  const a = R.shufAim(c, at(20, 85)); assert.ok(Math.hypot(a[0] - 20, a[1] - 85) < 0.2);
  let r = E.applyMove(m, 'X', at(25, 95), still());
  assert.deepEqual([r.outcome, r.note, !!r.again, m.score.X, m.last.pts, m.last.out, m.last.segs.length, m.pucks.length], ['continue', 'in', false, 4, 4, null, 1, 0]);
  r = E.applyMove(m, 'O', at(25, 50), still()); assert.deepEqual([r.note, m.last.pts, m.last.short, m.score.O], ['miss', 0, true, 0]);
  r = E.applyMove(m, 'X', at(25, 110), still()); assert.deepEqual([m.last.out, m.last.pts, m.score.X], ['end', 0, 4], 'off the end');
  r = E.applyMove(m, 'O', { a: 0.6, p: 0.7 }, still()); assert.deepEqual([m.last.out, m.score.O], ['side', 0]);
  E.applyMove(m, 'X', at(25, 95), still()); r = E.applyMove(m, 'X', at(25, 85), still());
  assert.deepEqual([r.outcome, m.score.X], ['win', 10], 'never past the target');
  for (const bad of [null, {}, { a: 2, p: 0.5 }, 'x']) assert.equal(E.applyMove(m, 'O', bad, flat).ok, false);
  E.setTune('shuffle', { friction: 125 }); try { const t = E.newMini('shuffle', E.makeRng('f')); E.applyMove(t, 'X', { a: 0, p: 0.8 }, still()); assert.equal(t.last.segs[0].y1, 80, 'more friction: less far (0.8 of 125 / 1.25)'); } finally { E.setTune('shuffle', null); }
});

test('shuffle: a shared lane: pucks stay; a struck puck goes on and scores again for its owner; knocked off, its owner loses half', () => {
  E.setTune('shuffle', { boards: 'shared' });
  try {
    const m = E.newMini('shuffle', E.makeRng('s')), c = R.shufCfg(m), at = (x, y) => R.shufFlickAt(c, x, y);
    E.applyMove(m, 'X', at(25, 75), still());
    assert.deepEqual([m.shared, m.pucks, m.score], [true, [{ by: 'X', x: 25, y: 75, pts: 1 }], { X: 1, O: 0 }]);
    let r = E.applyMove(m, 'O', at(25, 95), still());              // straight through X's puck: O stops at the touch, X's goes on 70% of the way left
    const [mv, kn] = m.last.segs;
    assert.deepEqual([m.last.segs.length, mv.hit, mv.y1, kn.id, kn.by, kn.y0, kn.y1], [2, true, 67, 0, 'X', 75, 94.6]);
    assert.ok(mv.t1 < mv.d && kn.t0 === mv.t1, 'the struck puck leaves as it is touched');
    assert.deepEqual([m.score, m.last.pts, m.last.short], [{ X: 4, O: 0 }, 0, true], 'X\'s puck is now in the far zone: +3 for X; O\'s stopped short');
    assert.deepEqual(m.pucks, [{ by: 'X', x: 25, y: 94.6, pts: 4 }], 'a puck short of the zones is taken off');
    r = E.applyMove(m, 'O', at(25, 105), still());                  // knocks X's puck off the end
    assert.deepEqual([m.last.segs[1].out, m.score.X, m.last.pts, m.score.O, m.pucks.map(q => q.by)], ['end', 2, 2, 2, ['O']], 'knocked off: half its 4 points gone');
    assert.deepEqual(m.last.was, [{ by: 'X', x: 25, y: 94.6 }]);
    const g = E.newMini('shuffle', E.makeRng('g')); g.score.X = 9; g.pucks = [{ by: 'X', x: 25, y: 75, pts: 1 }];
    r = E.applyMove(g, 'O', at(25, 85), still());
    assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'X', 'gift'], 'a knock that takes the other player to the target hands them the square');
    for (let k = 0; k < 12; k++) E.applyMove(m, k % 2 ? 'O' : 'X', at(6 + (k % 6) * 7.6, 72 + (k % 3) * 10), still());
    assert.ok(m.pucks.length <= R.SHUF.keep);
  } finally { E.setTune('shuffle', null); }
});

test('shuffle: a slide slows to a stop; the computer by level; the flash; whole squares end, on a shared lane too', () => {
  const seg = { t0: 0, t1: 950, d: 950 }; assert.deepEqual([0, 475, 950].map(t => Math.round(R.shufAt(seg, t) * 100)), [0, 75, 100]);
  const pts = level => { let s = 0; for (let k = 0; k < 900; k++) { const t = E.newMini('shuffle', E.makeRng('q')), rng = E.makeRng(level + k); E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng); s += t.last.pts; } return s / 900; };
  const e = pts('easy'), n = pts('normal'), h = pts('hard');
  assert.ok(e < n && n < h, `points a flick: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['shuffle'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { a: 0, p: 0.7 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.sb).sort(), ['a', 'by', 'from', 'out', 'p', 'pts', 'segs', 'short', 'to', 'was']);
  assert.ok(E.playMs(st.flash) >= R.SHUF.slide); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  for (const boards of ['separate', 'shared']) {
    E.setTune('shuffle', { boards });
    try { let wins = 0; for (let g = 0; g < 90; g++) { const rng = E.makeRng('w' + g), t = E.newMini('shuffle', rng); let q = 'X'; for (let k = 0; k < 900; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } } assert.equal(wins, 90, boards); } finally { E.setTune('shuffle', null); }
  }
});
