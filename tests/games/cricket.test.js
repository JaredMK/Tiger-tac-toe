'use strict';
// Darts Cricket (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/cricket/rules.js');
const M = require('../../src/games/cricket/meta.js');

const none = () => 0.5;
const at = (m, c, t, dbl) => { const s = R.cricketSpot(m, c, t, dbl); return { x: s[0] / 100, y: s[1] / 100 }; };
test('cricket: Admin only, skill, real time, held out of Find Match; its settings; the deal: three numbers from 15 to 20', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime], ['admin', 'skill', '1.25.0', false, true]);
  assert.ok(E.FIND_MATCH_HOLD.includes('cricket'));
  assert.deepEqual(E.gameFields('cricket').map(f => f.k), ['numbers', 'hits', 'scoring', 'doubles', 'band', 'bull', 'heart', 'sweepMs', 'aiErr', 'aiErrHard', 'aiErrEasy']);
  for (let g = 0; g < 40; g++) { const m = E.newMini('cricket', E.makeRng('d' + g)); assert.equal(m.nums.length, 3); assert.equal(new Set(m.nums).size, 3); m.nums.forEach(n => assert.ok(n >= 15 && n <= 20)); assert.deepEqual(m.marks, { X: [0, 0, 0, 0], O: [0, 0, 0, 0] }); }
  assert.equal(E.secretOf(E.newMini('cricket', E.makeRng('s'))), null);
});

test('cricket: what a dart hits: a number\'s wedge once, its outer band twice, the bullseye once and its heart twice, a dead wedge and off the board nothing', () => {
  const m = E.newMini('cricket', E.makeRng('a')), c = R.cricketCfg(m), hit = (x, y) => R.cricketAt(m, c, x, y);
  assert.deepEqual([c.hits, c.scoring, c.bull, c.heart, c.band], [2, false, 10, 5, 12]);
  assert.deepEqual([hit(50, 50), hit(50, 43), hit(50, 30), hit(50, 12), hit(50, 4)], [{ t: 3, n: 2 }, { t: 3, n: 1 }, { t: 0, n: 1 }, { t: 0, n: 2 }, { t: -2, n: 0 }], 'straight up from the middle: the heart, the bullseye, the first number, its outer band, off');
  assert.deepEqual(hit(80, 50 - 30 * Math.tan(Math.PI / 6) + 1), { t: -1, n: 0 }, 'a dead wedge between two numbers');
  [0, 1, 2].forEach(t => { assert.deepEqual(hit(...R.cricketSpot(m, c, t, false)), { t, n: 1 }); assert.deepEqual(hit(...R.cricketSpot(m, c, t, true)), { t, n: 2 }); });
  E.setTune('cricket', { doubles: 'off', heart: 0 }); try { const t = E.newMini('cricket', E.makeRng('b')), c2 = R.cricketCfg(t); assert.deepEqual([R.cricketAt(t, c2, 50, 12), R.cricketAt(t, c2, 50, 50)], [{ t: 0, n: 1 }, { t: 3, n: 1 }]); } finally { E.setTune('cricket', null); }
});

test('cricket: marks close a number; first to close every number and the bullseye wins; one dart a turn', () => {
  const m = E.newMini('cricket', E.makeRng('c')), c = R.cricketCfg(m);
  let r = E.applyMove(m, 'X', at(m, c, 0, false), none);
  assert.deepEqual([r.outcome, r.note, !!r.again, m.marks.X, m.last.add, m.last.closed], ['continue', 'hit', false, [1, 0, 0, 0], 1, false]);
  r = E.applyMove(m, 'X', at(m, c, 0, true), none); assert.deepEqual([m.marks.X, m.last.n, m.last.add, m.last.closed], [[2, 0, 0, 0], 2, 1, true], 'never more marks than close it');
  r = E.applyMove(m, 'X', at(m, c, 0, false), none); assert.deepEqual([r.note, m.last.add, m.pts.X], ['miss', 0, 0], 'closed already: nothing, with scoring off');
  r = E.applyMove(m, 'O', { x: 0.02, y: 0.02 }, none); assert.deepEqual([r.note, m.last.t], ['miss', -2]);
  E.applyMove(m, 'X', at(m, c, 1, true), none); E.applyMove(m, 'X', at(m, c, 2, true), none);
  r = E.applyMove(m, 'X', { x: 0.5, y: 0.43 }, none); assert.deepEqual([r.outcome, m.marks.X[3]], ['continue', 1], 'the bullseye outside its heart: one mark');
  r = E.applyMove(m, 'X', { x: 0.5, y: 0.5 }, none); assert.deepEqual([r.outcome, m.marks.X], ['win', [2, 2, 2, 2]]);
  for (const bad of [null, {}, { x: 0.5 }, { x: 1.2, y: 0.5 }, { x: '0.5', y: 0.5 }, { x: NaN, y: 0 }, 'x']) assert.equal(E.applyMove(m, 'O', bad, none).ok, false, JSON.stringify(bad));
});

test('cricket: scoring on: a mark on a number you closed and they have not is a point; closing all wins only when not behind', () => {
  E.setTune('cricket', { scoring: 'on' });
  try {
    const m = E.newMini('cricket', E.makeRng('s')), c = R.cricketCfg(m); assert.equal(c.scoring, true);
    E.applyMove(m, 'X', at(m, c, 0, true), none); E.applyMove(m, 'X', at(m, c, 0, true), none);
    assert.deepEqual([m.marks.X[0], m.pts.X, m.last.sc], [2, 2, 2]);
    m.marks.O = [2, 0, 0, 0]; E.applyMove(m, 'X', at(m, c, 0, false), none); assert.equal(m.pts.X, 2, 'closed by both: no more points there');
    m.marks.O = [2, 2, 2, 1]; let r = E.applyMove(m, 'O', at(m, c, 3, false), none);
    assert.deepEqual([r.outcome, m.marks.O], ['continue', [2, 2, 2, 2]], 'everything closed but 2 points behind: not yet');
    r = E.applyMove(m, 'O', at(m, c, 1, true), none); assert.deepEqual([r.outcome, m.pts.O], ['win', 3], 'ahead on points with everything closed (the heart\'s second mark was a point too)');
    const t = E.newMini('cricket', E.makeRng('t')); t.marks.O = [2, 2, 2, 2]; t.marks.X = [2, 2, 2, 1]; t.pts.X = 3; t.pts.O = 1;
    r = E.applyMove(t, 'X', { x: 0.5, y: 0.5 }, none); assert.deepEqual([r.outcome, r.winner], ['win', undefined], 'ahead on points: closing all wins');
    const u = E.newMini('cricket', E.makeRng('u')); u.marks.O = [2, 2, 2, 2]; u.marks.X = [2, 2, 2, 1]; u.pts.X = 1; u.pts.O = 3;
    r = E.applyMove(u, 'X', { x: 0.5, y: 0.5 }, none); assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'O', 'points'], 'both closed everything: the more points');
  } finally { E.setTune('cricket', null); }
});

test('cricket: the computer by level; the flash; whole squares end, with scoring on too', () => {
  const rate = level => { let h = 0; for (let k = 0; k < 700; k++) { const rng = E.makeRng(level + k), t = E.newMini('cricket', E.makeRng('q')); E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng); h += t.last.add; } return h / 700; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e < n && n < h, `marks a dart: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['cricket'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { x: 0.5, y: 0.5 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.ck).sort(), ['add', 'by', 'closed', 'marks', 'n', 'sc', 't', 'x', 'y']);
  assert.ok(E.playMs(st.flash) >= R.cricketMs()); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  for (const scoring of ['off', 'on']) {
    E.setTune('cricket', { scoring });
    try { let wins = 0; for (let g = 0; g < 90; g++) { const rng = E.makeRng('w' + g), t = E.newMini('cricket', rng); let q = 'X'; for (let k = 0; k < 1500; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } } assert.equal(wins, 90, 'scoring ' + scoring); } finally { E.setTune('cricket', null); }
  }
});
