'use strict';
// Home Run Heroes (December 2026: the batch's Home Run Derby): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/homer/rules.js');
const A = require('../../src/games/homer/ai.js');
const M = require('../../src/games/homer/meta.js');

test('homer: Admin only, skill, real time, held out of Find Match; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.realTime, M.info.name], ['admin', 'skill', '1.24.0', true, 'Home Run Heroes']);
  assert.ok(E.FIND_MATCH_HOLD.includes('homer'), 'the server cannot time a tap');
  assert.deepEqual(E.gameFields('homer').map(f => f.k), ['goal', 'pitches', 'fastMs', 'slowMs', 'hrMs', 'hitMs', 'aiMs', 'aiMsHard', 'aiMsEasy']);
  const c = R.homerCfg(E.newMini('homer', E.makeRng('a')));
  assert.deepEqual([c.goal, c.pitches, c.fast, c.slow, c.hr, c.hit], [4, 3, 430, 780, 30, 90]);
});

test('homer: an at-bat\'s pitches come from the square\'s public seed, the player and the at-bat: the same on every phone, new each at-bat', () => {
  const m = E.newMini('homer', E.makeRng('b')), c = R.homerCfg(m);
  const a = R.homerPitches(m, 'X'), b = R.homerPitches(JSON.parse(JSON.stringify(E.publicMini(m))), 'X');
  assert.deepEqual(a, b, 'from what is public alone');
  assert.equal(a.length, 3); for (const q of a) assert.ok(q.f >= c.fast && q.f <= c.slow && Math.abs(q.x) <= 1);
  assert.notDeepEqual(R.homerPitches(m, 'O'), a); assert.notDeepEqual(R.homerPitches(m, 'X', 1), a);
  const plan = R.homerPlan(a);
  plan.at.forEach((q, i) => { assert.equal(q.c - q.go, a[i].f); assert.equal(q.go - q.s, R.HOMER.wind); if (i) assert.equal(q.s, plan.at[i - 1].e); });
  assert.equal(plan.end, plan.at[2].e); assert.ok(plan.end < 8000, 'an at-bat is well under 15 seconds');
});

test('homer: a swing within the home run window is a home run, within the hit window only a hit, else a miss; no swing is nothing', () => {
  const m = E.newMini('homer', E.makeRng('c')), c = R.homerCfg(m);
  assert.deepEqual([0, 30, -30, 31, -90, 91, 600, null].map(dt => R.homerJudge(c, dt)), ['hr', 'hr', 'hr', 'hit', 'hit', 'miss', 'miss', 'take']);
  let r = E.applyMove(m, 'X', { s: [5, -60, null] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.hr.X, m.ab.X, m.last.res], ['continue', 'hr', false, 1, 1, ['hr', 'hit', 'take']]);
  r = E.applyMove(m, 'O', { s: [200] }, E.makeRng('x'));
  assert.deepEqual([r.note, m.hr.O, m.last.s, m.last.res], ['out', 0, [200, null, null], ['miss', 'take', 'take']], 'pitches not swung at: no swing');
  for (const bad of [null, {}, { s: 'x' }, { s: [1, 2, 3, 4] }, { s: [1.5] }, { s: [9999] }, { s: ['0'] }]) assert.equal(E.applyMove(m, 'X', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
});

test('homer: the first to the goal takes the square, and the at-bat stops on the home run that does', () => {
  const m = E.newMini('homer', E.makeRng('d')); m.hr.X = 3;
  const r = E.applyMove(m, 'X', { s: [300, 0, 0] }, E.makeRng('x'));
  assert.deepEqual([r.outcome, m.hr.X, m.last.res, m.last.s], ['win', 4, ['miss', 'hr'], [300, 0]]);
  const st = E.newMatch(E.makeRng('i'), { games: ['homer'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { s: [0, 0, 500] }, E.makeRng('s')).ok);
  assert.deepEqual([st.flash.hr.res, st.flash.hr.pitches.length, st.flash.by], [['hr', 'hr', 'miss'], 3, p]);
  assert.ok(E.playMs(st.flash) >= R.homerPlan(st.flash.hr.pitches).end, 'the flash lasts the at-bat');
  assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
});

test('homer: the computer swings at every pitch, its timing error by level; whole squares end with a winner', () => {
  const m = E.newMini('homer', E.makeRng('e')), rate = level => { let hr = 0, n = 0; for (let k = 0; k < 1500; k++) for (const dt of E.localBest(E.publicMini(m), 'X', E.makeRng(level + k), {}, { level }).move.s) { n++; if (dt != null && Math.abs(dt) <= 30) hr++; } return hr / n; };
  const e = rate('easy'), nm = rate('normal'), h = rate('hard');
  assert.ok(e < nm && nm < h, `home runs a swing: easy ${e.toFixed(2)} < normal ${nm.toFixed(2)} < hard ${h.toFixed(2)}`);
  assert.ok(nm > 0.18 && nm < 0.3, `Normal about one swing in four (${nm.toFixed(3)})`);
  assert.ok(A.needs(E.publicMini(m), 'X') > 3);
  let wins = 0;
  for (let g = 0; g < 200; g++) {
    const rng = E.makeRng('w' + g), t = E.newMini('homer', rng); let q = 'X';
    for (let k = 0; k < 200; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: 'normal' }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; }
  }
  assert.equal(wins, 200);
});
