'use strict';
// Rhythm Tap (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/rhythm/rules.js');
const M = require('../../src/games/rhythm/meta.js');

test('rhythm: Admin only, skill, real time, held out of Find Match; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime], ['admin', 'skill', '1.25.0', false, true]);
  assert.ok(E.FIND_MATCH_HOLD.includes('rhythm'), 'a tap\'s moment is the phone\'s word');
  assert.deepEqual(E.gameFields('rhythm').map(f => f.k), ['secs', 'target', 'lives', 'tempo', 'window', 'dense', 'aiMs', 'aiMiss', 'aiMsHard', 'aiMissHard', 'aiMsEasy', 'aiMissEasy']);
  const c = R.rhythmCfg(E.newMini('rhythm', E.makeRng('a')));
  assert.deepEqual([c.target, c.secs, c.beat, c.win, c.lives], [60, 10, 600, 150, 2]);
  assert.match(M.explainVars({ lives: 2 }).livesText, /Miss 2 notes/); assert.equal(M.explainVars({ lives: 0 }).livesText, '');
});

test('rhythm: a round\'s notes: on the beat or half way between, in three lanes, the same wherever worked out, new each round', () => {
  for (let g = 0; g < 30; g++) {
    const m = E.newMini('rhythm', E.makeRng('r' + g)), a = R.rhythmChart(m, 'X'), c = R.rhythmCfg(m);
    assert.deepEqual(a, R.rhythmChart(JSON.parse(JSON.stringify(m)), 'X')); assert.notDeepEqual(a, R.rhythmChart(m, 'O'));
    assert.ok(a.length >= 10 && a.length <= 24, `${a.length} notes`); assert.equal(a[0].t, R.RHYTHM.count * c.beat, 'the first note after the count-in');
    a.forEach((n, i) => { assert.equal(n.t % (c.beat / 2), 0); assert.ok(n.t <= c.secs * 1000 - R.RHYTHM.tail && n.lane >= 0 && n.lane < 3 && n.tone >= 0 && n.tone < R.RHYTHM.scale.length); if (i) assert.ok(n.t > a[i - 1].t); if (i > 2) assert.ok(!(n.lane === a[i - 1].lane && n.lane === a[i - 2].lane && n.lane === a[i - 3].lane), 'never four in a row in one lane'); });
    const before = JSON.stringify(a); E.applyMove(m, 'X', { d: a.map(() => null) }, E.makeRng('x')); assert.notEqual(JSON.stringify(R.rhythmChart(m, 'X')), before);
  }
});

test('rhythm: on the beat is a Perfect (2), close a Good (1), outside the window or no tap a miss; two misses end the round', () => {
  const m = E.newMini('rhythm', E.makeRng('b')), c = R.rhythmCfg(m), notes = R.rhythmChart(m, 'X'), n = notes.length;
  assert.deepEqual([0, 60, -60, 61, 150, -151, null].map(dt => R.rhythmJudge(c, dt)), ['perfect', 'perfect', 'perfect', 'good', 'good', 'miss', 'miss']);
  let s = R.rhythmScore(c, notes, notes.map(() => 0)); assert.deepEqual([s.perf, s.pts, s.out], [n, 2 * n, false]);
  const d = notes.map(() => 100); d[1] = null; d[3] = 400;
  s = R.rhythmScore(c, notes, d); assert.deepEqual([s.good, s.miss, s.out, s.pts, s.res.length], [2, 2, true, 2, 4], 'the round is over at the second miss: nothing after it counts');
  let r = E.applyMove(m, 'X', { d }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.score.X, m.last.out, m.last.of, m.n.X], ['continue', 'out', false, 2, true, n, 1]);
  const o = R.rhythmChart(m, 'O');
  for (const bad of [null, {}, { d: 3 }, { d: o.map(() => 0).slice(1) }, { d: o.map(() => '0') }, { d: o.map(() => NaN) }, { d: o.map(() => 9999) }]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad).slice(0, 40));
  E.setTune('rhythm', { lives: 0 }); try { const t = E.newMini('rhythm', E.makeRng('l')), nt = R.rhythmChart(t, 'X'); assert.equal(R.rhythmScore(R.rhythmCfg(t), nt, nt.map(() => null)).out, false, 'no lives: a round never ends early'); } finally { E.setTune('rhythm', null); }
  m.score.X = 50; r = E.applyMove(m, 'X', { d: R.rhythmChart(m, 'X').map(() => 0) }, E.makeRng('x')); assert.deepEqual([r.outcome, m.score.X], ['win', 60]);
});

test('rhythm: the computer by level; the flash; a timeout plays nothing; whole squares end with a winner', () => {
  const pts = level => { let s = 0; for (let k = 0; k < 500; k++) { const t = E.newMini('rhythm', E.makeRng('q' + k)), rng = E.makeRng(level + k); E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng); s += t.last.pts; } return s / 500; };
  const e = pts('easy'), n = pts('normal'), h = pts('hard');
  assert.ok(e < n && n < h, `points a round: easy ${e.toFixed(1)} < normal ${n.toFixed(1)} < hard ${h.toFixed(1)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['rhythm'] }), p = st.turn, nt = R.rhythmChart(st.squares[4].mini, p);
  assert.ok(E.playMove(st, 4, { d: nt.map(() => 20) }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.rt).sort(), ['by', 'from', 'good', 'miss', 'of', 'out', 'perf', 'pts', 'to']);
  assert.ok(E.playMs(st.flash) >= R.rhythmShowMs()); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  let wins = 0;
  for (let g = 0; g < 120; g++) { const rng = E.makeRng('w' + g), t = E.newMini('rhythm', rng); let q = 'X'; for (let k = 0; k < 900; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 120);
});
