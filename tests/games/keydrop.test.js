'use strict';
// Key Drop (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/keydrop/rules.js');
const M = require('../../src/games/keydrop/meta.js');

test('keydrop: Admin only, skill, real time, held out of Find Match; the deal: a wall of 3 by 3 each, every prize on its shelf, nothing hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.realTime, M.placeholder], ['admin', 'skill', '1.26.0', true, false]);
  assert.ok(E.FIND_MATCH_HOLD.includes('keydrop'), 'the server cannot time a finger letting go');
  assert.deepEqual(E.tuneFields('keydrop').map(f => f.k), ['goal', 'speedX', 'speedY', 'tol', 'cols', 'rows', 'ramp', 'rampPct', 'aiMsEasy', 'aiMs', 'aiMsHard', 'aiThinkEasy', 'aiThinkNormal', 'aiThinkHard']);
  assert.deepEqual(E.tuneFields('keydrop').filter(f => /^ai/.test(f.k)).map(f => f.group), ['Computer: Easy', 'Computer: Normal', 'Computer: Hard', 'Computer: Easy', 'Computer: Normal', 'Computer: Hard'], 'each level\'s settings in its own group');
  const m = E.newMini('keydrop', E.makeRng('d')), c = R.keydCfg(m);
  assert.deepEqual([m.cols, m.rows, m.wall.X.length, m.wall.O.length, c.goal, c.vx, c.vy, c.tol, c.ramp], [3, 3, 9, 9, 2, 45, 45, 2.5, 0]);
  assert.ok(m.wall.X.every(Boolean) && m.wall.O.every(Boolean)); assert.equal(E.secretOf(m), null);
  assert.deepEqual([0, 1, 2, 4, 8].map(i => R.keydHole(m, i)), [{ x: 26, y: 26 }, { x: 55, y: 26 }, { x: 84, y: 26 }, { x: 55, y: 55 }, { x: 84, y: 84 }]);
  for (const [cols, rows] of [[2, 2], [5, 4], [4, 3]]) { E.setTune('keydrop', { cols, rows }); try { const w = E.newMini('keydrop', E.makeRng('w')); assert.equal(w.wall.X.length, cols * rows); for (let i = 0; i < cols * rows; i++) { const h = R.keydHole(w, i); assert.ok(h.x >= R.KEYD.lo && h.x <= R.KEYD.lo + R.KEYD.span && h.y >= R.KEYD.lo && h.y <= R.KEYD.max, 'every keyhole within the rails\' reach'); } } finally { E.setTune('keydrop', null); } }
});

test('keydrop: a slide runs at the key\'s speed from its start and stops at the rail\'s end; the speed-up adds its share an attempt, to twice at most', () => {
  const m = E.newMini('keydrop', E.makeRng('a')), c = R.keydCfg(m);
  assert.deepEqual([0, 500, 1000, 1500, 5000].map(t => R.keydAt(R.KEYD.x0, c.vx, t)), [10, 32.5, 55, 77.5, 92]);
  assert.deepEqual(R.keydSpeed(c, 7), { x: 45, y: 45 }, 'off by default');
  E.setTune('keydrop', { ramp: 'on', rampPct: 10 });
  try { const r = E.newMini('keydrop', E.makeRng('a')), rc = R.keydCfg(r); assert.deepEqual([0, 1, 3, 40].map(n => Math.round(R.keydSpeed(rc, n).x * 10) / 10), [45, 49.5, 58.5, 90]); } finally { E.setTune('keydrop', null); }
});

test('keydrop: within the tolerance both ways the key goes in and the prize drops; a scrape is a near miss; an emptied shelf scores nothing again; first to 2', () => {
  const m = E.newMini('keydrop', E.makeRng('b'));
  let r = E.applyMove(m, 'X', { x: 55 + 2.5, y: 55 - 2.5 }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.got.X, m.wall.X[4], m.last.hit, m.last.near], ['continue', 'hit', false, 1, false, 4, false]);
  assert.equal(m.wall.O[4], true, 'the other player\'s machine is their own');
  r = E.applyMove(m, 'O', { x: 55 + 2.6, y: 55 }, E.makeRng('x')); assert.deepEqual([r.note, m.last.hit, m.last.near, m.last.hole, m.got.O], ['near', -1, true, 4, 0], 'just outside: it scrapes the edge');
  r = E.applyMove(m, 'O', { x: 55, y: 55 + 6.5 }, E.makeRng('x')); assert.equal(r.note, 'near'); r = E.applyMove(m, 'O', { x: 55, y: 55 + 6.7 }, E.makeRng('x')); assert.deepEqual([r.note, m.last.near, m.last.hole], ['miss', false, -1]);
  r = E.applyMove(m, 'O', { x: 55 + 2.4, y: 55 + 2.6 }, E.makeRng('x')); assert.equal(r.note, 'near', 'in line across but not up');
  r = E.applyMove(m, 'X', { x: 55, y: 55 }, E.makeRng('x')); assert.deepEqual([r.note, m.last.empty, m.last.hit, m.got.X], ['empty', true, -1, 1], 'that keyhole cannot be scored again');
  assert.deepEqual([m.n.X, m.n.O], [2, 4]);
  r = E.applyMove(m, 'X', { x: 26, y: 84 }, E.makeRng('x')); assert.deepEqual([r.outcome, r.note, m.got.X, m.wall.X[6]], ['win', 'won', 2, false]);
  for (const bad of [null, {}, 'x', { x: 50 }, { x: 5, y: 50 }, { x: 50, y: 93 }, { x: '50', y: 50 }, { x: NaN, y: 50 }, { x: 50, y: Infinity }]) assert.equal(E.applyMove(E.newMini('keydrop', E.makeRng('z')), 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  E.setTune('keydrop', { goal: 6, cols: 2, rows: 2 }); try { assert.equal(R.keydCfg(E.newMini('keydrop', E.makeRng('g'))).goal, 4, 'never more prizes to win than the wall holds'); } finally { E.setTune('keydrop', null); }
});

test('keydrop: the computer lets go early or late by its level\'s timing error, never perfectly; whole squares end with a winner; the flash and the timeout', () => {
  const rate = level => { let h = 0, exact = 0; const N = 1500; for (let k = 0; k < N; k++) { const rng = E.makeRng(level + k), t = E.newMini('keydrop', rng), mv = E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level }).move; if (t.wall.X.some((on, i) => { const q = R.keydHole(t, i); return q.x === mv.x && q.y === mv.y; })) exact++; if (E.applyMove(t, 'X', mv, rng).note === 'hit') h++; } return { h: h / N, exact: exact / N }; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e.h < n.h && n.h < h.h, `in, an attempt: easy ${e.h.toFixed(2)} < normal ${n.h.toFixed(2)} < hard ${h.h.toFixed(2)}`);
  assert.ok(n.h > 0.27 && n.h < 0.4, `Normal about 1 in 3: ${n.h.toFixed(2)}`); assert.ok(h.h < 0.6 && h.exact < 0.02, 'Hard is no perfect release');
  let wins = 0;
  for (let g = 0; g < 150; g++) { const rng = E.makeRng('w' + g), t = E.newMini('keydrop', rng); let p = 'X'; for (let k = 0; k < 400; k++) { const r = E.applyMove(t, p, E.localBest(E.publicMini(t, p), p, rng, {}, { level: 'normal' }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome === 'win') { wins++; break; } p = p === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 150);
  const st = E.newMatch(E.makeRng('i'), { games: ['keydrop'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { x: 40, y: 40 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.kd).sort(), ['by', 'empty', 'hit', 'hole', 'n', 'near', 'x', 'y']); assert.ok(E.playMs(st.flash) >= R.keydMs(false)); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
});

test('keydrop: the help text follows the settings', () => {
  assert.equal(M.explainVars({ ramp: 'off' }).rampText, ''); assert.match(M.explainVars({ ramp: 'on' }).rampText, /faster with each attempt/);
  assert.match(M.explainer.win, /\{goal\}/); assert.doesNotMatch(JSON.stringify([M.info, M.explainer]), /slot|jackpot|bet\b/i);
});
