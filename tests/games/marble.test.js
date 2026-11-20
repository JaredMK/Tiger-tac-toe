'use strict';
// Marble Toss (the second December 2026 batch): its rules and computer, and the flick games' shared arithmetic (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/marble/rules.js');
const M = require('../../src/games/marble/meta.js');
const F = require('../../src/games/shared/flick.js');

const flat = () => 0.5;                                            // an rng with no spread worth the name (gauss of .5, .5 is small and fixed)
test('marble: Admin only, skill; its settings; the deal: the layout\'s holes with their points', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'skill', '1.25.0', false]);
  assert.deepEqual(E.tuneFields('marble').map(f => f.k), ['marbles', 'target', 'layout', 'v1', 'v2', 'v3', 'hole', 'spread', 'flickMin', 'flickMax', 'aiErr', 'aiErrHard', 'aiErrEasy']);
  const m = E.newMini('marble', E.makeRng('a')), c = R.marbleCfg(m);
  assert.deepEqual([m.lay, m.holes.length, c.target, c.marbles, m.holes.map(h => h.v)], ['classic', 6, 18, 3, [1, 2, 2, 4, 4, 4]]);
  for (const lay of Object.keys(R.LAYOUTS)) R.LAYOUTS[lay].forEach(([x, y, k], i) => { const rad = [11, 8.5, 6.5]; assert.ok(x - rad[k] >= 0 && x + rad[k] <= 100 && y - rad[k] >= 0 && y + rad[k] <= 101, `${lay}: hole ${i} on the table, clear of the start`); R.LAYOUTS[lay].forEach(([x2, y2, k2], j) => { if (j > i) assert.ok(Math.hypot(x - x2, y - y2) >= rad[k] + rad[k2] + 1, `${lay}: holes ${i} and ${j} apart`); }); });
  E.setTune('marble', { layout: 'ladder', hole: 120 }); try { const t = E.newMini('marble', E.makeRng('b')); assert.deepEqual([t.lay, t.holes.length, t.holes[0].r], ['ladder', 5, 13.2]); } finally { E.setTune('marble', null); }
  assert.equal(E.secretOf(m), null);
});

test('flick: a swipe\'s angle and speed become the move; what is not a move', () => {
  assert.deepEqual(F.flickMove(0.2, 0.95, { flickMin: 0.3, flickMax: 1.6 }), { a: 0.2, p: 0.5 });
  assert.deepEqual(F.flickMove(-2, 9, null), { a: -0.75, p: 1 }); assert.deepEqual(F.flickMove(0, 0.1, null), { a: 0, p: 0 });
  for (const bad of [null, {}, { a: 0 }, { a: 1, p: 0.5 }, { a: 0, p: 1.2 }, { a: '0', p: 0.5 }, { a: NaN, p: 0.5 }, 'x']) assert.equal(F.flickOk(bad), false, JSON.stringify(bad));
  assert.equal(F.flickOk({ a: -0.75, p: 0 }), true);
});

test('marble: a flick lands where it is aimed, give or take the spread; in a hole scores its points; three marbles a turn', () => {
  const m = E.newMini('marble', E.makeRng('c')), h = m.holes[3];
  const at = R.marbleAim(R.marbleFlickAt(h.x, h.y)); assert.ok(Math.hypot(at[0] - h.x, at[1] - h.y) < 0.2, 'the flick aimed at a point goes there');
  let r = E.applyMove(m, 'X', R.marbleFlickAt(h.x, h.y), flat);
  assert.deepEqual([r.outcome, r.note, r.again, m.last.hole, m.last.pts, m.score.X, m.last.left, m.run], ['continue', 'in', true, 3, 4, 4, 2, { by: 'X', left: 2 }]);
  assert.equal(E.applyMove(m, 'O', 'end', flat).ok, false, 'no turn of O\'s to end');
  r = E.applyMove(m, 'X', R.marbleFlickAt(50, 58), flat);
  assert.deepEqual([r.note, r.again, m.last.hole, m.last.off, m.last.pts, m.last.left], ['miss', true, -1, false, 0, 1]);
  r = E.applyMove(m, 'X', { a: 0.75, p: 1 }, flat);
  assert.deepEqual([r.note, !!r.again, m.last.off, m.run], ['miss', false, true, null], 'off the table; the third marble ends the turn');
  r = E.applyMove(m, 'O', R.marbleFlickAt(m.holes[0].x, m.holes[0].y), flat); assert.deepEqual([m.score.O, m.run.left, r.again], [1, 2, true]);
  assert.equal(R.timeoutClose(m, 'O'), 'end'); assert.equal(R.timeoutClose(m, 'X'), null);
  r = E.applyMove(m, 'O', 'end', flat); assert.deepEqual([r.ok, !!r.again, m.run], [true, false, null], 'a turn out of time ends where it stands');
  for (const bad of [null, {}, { a: 2, p: 0.5 }, { a: 0, p: -1 }, 'go']) assert.equal(E.applyMove(m, 'X', bad, flat).ok, false, JSON.stringify(bad));
  const w = E.newMini('marble', E.makeRng('d')); w.score.X = 15; r = E.applyMove(w, 'X', R.marbleFlickAt(h.x, h.y), flat);
  assert.deepEqual([r.outcome, w.score.X, w.run], ['win', 18, null]);
  const rng = E.makeRng('sp'); let far = 0; for (let k = 0; k < 500; k++) { const t = E.newMini('marble', rng); E.applyMove(t, 'X', R.marbleFlickAt(50, 55), rng); far = Math.max(far, Math.hypot(t.last.x - 50, t.last.y - 55)); }
  assert.ok(far > 3 && far < 14, `the spread is the table's (${far.toFixed(1)} at most in 500)`);
});

test('marble: the computer aims at a hole with an error by level; the flash; whole squares end with a winner', () => {
  const pts = level => { let s = 0; for (let k = 0; k < 900; k++) { const t = E.newMini('marble', E.makeRng('q')), rng = E.makeRng(level + k); E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng); s += t.last.pts; } return s / 900; };
  const e = pts('easy'), n = pts('normal'), h = pts('hard');
  assert.ok(e < n && n < h, `points a marble: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['marble'] });
  assert.ok(E.playMove(st, 4, { a: 0, p: 0.5 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.mb).sort(), ['a', 'by', 'from', 'hole', 'k', 'left', 'off', 'p', 'pts', 'to', 'x', 'y']);
  assert.ok(E.playMs(st.flash) >= R.MARB.roll);
  let wins = 0;
  for (let g = 0; g < 120; g++) { const rng = E.makeRng('w' + g), t = E.newMini('marble', rng); let q = 'X'; for (let k = 0; k < 900; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } if (!r.again) q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 120);
});
