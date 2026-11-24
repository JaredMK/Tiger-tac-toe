'use strict';
// Target Practice (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/target/rules.js');
const M = require('../../src/games/target/meta.js');

const at = (...v) => { let k = 0; return () => v[k++ % v.length]; };   // an rng that says these in turn (the dart's distance from the middle of the circle, then its direction)

test('target: Admin only, skill, real time, held out of Find Match; the deal: four targets each, the same places, clear of the edges and each other', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.realTime], ['admin', 'skill', '1.24.0', true]);
  assert.ok(E.FIND_MATCH_HOLD.includes('target'), 'the server cannot time a tap');
  assert.deepEqual(E.gameFields('target').map(f => f.k), ['targets', 'size', 'sweepMs', 'circleMin', 'circleMax', 'pulseMs', 'aiErr', 'aiErrHard', 'aiErrEasy']);
  for (let g = 0; g < 60; g++) {
    const m = E.newMini('target', E.makeRng('d' + g));
    assert.equal(m.tg.X.length, 4); assert.deepEqual(m.tg.X, m.tg.O); assert.equal(m.tsize, 11);
    m.tg.X.forEach((t, i) => { assert.ok(t.on && t.x - 11 >= 3 && t.x + 11 <= 97 && t.y - 11 >= 3 && t.y + 11 <= 97, 'inside the field'); m.tg.X.forEach((q, j) => { if (j > i) assert.ok(Math.hypot(t.x - q.x, t.y - q.y) >= 22, 'no two overlap'); }); });
  }
  assert.equal(E.secretOf(E.newMini('target', E.makeRng('s'))), null);
});

test('target: the sliders sweep across and back, the circle from largest to smallest and back', () => {
  const c = R.targetCfg(E.newMini('target', E.makeRng('a')));
  assert.deepEqual([c.sweep, c.rmin, c.rmax, c.pulse], [1000, 5, 26, 700]);
  assert.deepEqual([0, 500, 1000, 1500, 2000].map(t => Math.round(R.targetLine(c, t))), [6, 50, 94, 50, 6]);
  assert.deepEqual([0, 350, 700, 1050, 1400].map(t => Math.round(R.targetRing(c, t) * 10) / 10), [26, 15.5, 5, 15.5, 26]);
});

test('target: the dart lands at a point drawn inside the circle; on one of the thrower\'s standing targets it knocks it out; first to clear theirs wins', () => {
  const m = E.newMini('target', E.makeRng('b')), t0 = m.tg.X[0];
  let r = E.applyMove(m, 'X', { x: t0.x, y: t0.y, r: 5 }, at(0.5, 0.25));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.hits.X, m.tg.X[0].on, m.last.hit], ['continue', 'hit', false, 1, false, 0]);
  assert.ok(Math.hypot(m.last.lx - t0.x, m.last.ly - t0.y) <= 5.05, 'inside the circle');
  assert.equal(m.tg.O[0].on, true, 'the other player\'s targets are their own');
  r = E.applyMove(m, 'X', { x: t0.x, y: t0.y, r: 5 }, at(0, 0)); assert.deepEqual([r.note, m.last.hit, m.hits.X], ['miss', -1, 1], 'a target knocked out is gone');
  for (let g = 0; g < 400; g++) { const t = E.newMini('target', E.makeRng('p' + g)); E.applyMove(t, 'O', { x: 50, y: 50, r: 20 }, E.makeRng('q' + g)); assert.ok(Math.hypot(t.last.lx - 50, t.last.ly - 50) <= 20.1); }
  for (const bad of [null, {}, { x: 50, y: 50 }, { x: 50, y: 50, r: 2 }, { x: 50, y: 50, r: 40 }, { x: -3, y: 50, r: 10 }, { x: '50', y: 50, r: 10 }, { x: NaN, y: 1, r: 10 }]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  const w = E.newMini('target', E.makeRng('c')); w.tg.X.forEach((t, i) => { if (i) t.on = false; }); w.hits.X = 3;
  assert.equal(E.applyMove(w, 'X', { x: w.tg.X[0].x, y: w.tg.X[0].y, r: 5 }, at(0.2, 0.7)).outcome, 'win');
});

test('target: the computer aims at a standing target with an error by level; whole squares end with a winner', () => {
  const m = E.newMini('target', E.makeRng('e')), rate = level => { let h = 0; for (let k = 0; k < 600; k++) { const t = JSON.parse(JSON.stringify(m)), rng = E.makeRng(level + k); if (E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng).note === 'hit') h++; } return h / 600; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e < n && n < h, `hits a throw: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}`); assert.ok(n > 0.45 && n < 0.85, `Normal ${n.toFixed(2)}`);
  let wins = 0;
  for (let g = 0; g < 150; g++) { const rng = E.makeRng('w' + g), t = E.newMini('target', rng); let p = 'X'; for (let k = 0; k < 200; k++) { const r = E.applyMove(t, p, E.localBest(E.publicMini(t), p, rng, {}, { level: 'normal' }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome === 'win') { wins++; break; } p = p === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 150);
  const st = E.newMatch(E.makeRng('i'), { games: ['target'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { x: 40, y: 40, r: 8 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.tp).sort(), ['by', 'hit', 'lx', 'ly', 'n', 'r', 'x', 'y']); assert.ok(E.playMs(st.flash) >= R.targetMs()); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
});
