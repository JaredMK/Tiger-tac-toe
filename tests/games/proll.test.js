'use strict';
// Point Roll (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/proll/rules.js');
const A = require('../../src/games/proll/ai.js');
const M = require('../../src/games/proll/meta.js');

// an rng that rolls these dice in turn (pairs of faces)
const dice = (...v) => { let k = 0; return () => (v[k++ % v.length] - 0.5) / 6; };

test('proll: Admin only, luck; no gambling words; its settings; every number worth about the same a turn', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder], ['admin', 'luck', '1.25.0', false]);
  assert.doesNotMatch(`${M.info.name} ${M.info.hint} ${M.explainer.play} ${M.explainer.win}`, /bet|payout|pays|casino|gambl|wager|craps|odds/i);
  assert.deepEqual(E.gameFields('proll').map(f => f.k), ['target', 'p2', 'p3', 'p4', 'p5', 'p6', 'shown', 'aiLongEasy', 'aiLongNormal', 'aiLongHard']);
  const c = R.prollCfg(E.newMini('proll', E.makeRng('a')));
  assert.deepEqual([c.target, c.pts[2], c.pts[12], c.pts[3], c.pts[11], c.pts[4], c.pts[10], c.pts[5], c.pts[9], c.pts[6], c.pts[8]], [10, 14, 14, 8, 8, 6, 6, 5, 5, 4, 4]);
  assert.deepEqual([2, 3, 4, 5, 6].map(n => Math.round(R.prollChance(n) * 1000)), [143, 250, 333, 400, 455]);
  R.PICKS.forEach(n => { const ev = R.prollChance(n) * c.pts[n]; assert.ok(ev >= 1.8 && ev <= 2.01, `${n}: ${ev.toFixed(2)} a turn`); assert.equal(R.prollChance(n), R.prollChance(14 - n)); });
});

test('proll: the dice roll until the pick or a 7; the pick scores its points, a 7 nothing; never 7 as a pick; first to the target', () => {
  const m = E.newMini('proll', E.makeRng('b'));
  let r = E.applyMove(m, 'X', 9, dice(1, 1, 6, 2, 4, 5));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.score.X, m.last.rolls, m.last.nr, m.last.hit, m.last.pts], ['continue', 'hit', false, 5, [[1, 1], [6, 2], [4, 5]], 3, true, 5]);
  r = E.applyMove(m, 'O', 2, dice(6, 6, 3, 4));
  assert.deepEqual([r.note, m.score.O, m.last.hit, m.last.rolls], ['seven', 0, false, [[6, 6], [3, 4]]]);
  r = E.applyMove(m, 'X', 12, dice(6, 6));
  assert.deepEqual([r.outcome, m.score.X, m.last.from, m.last.to], ['win', 10, 5, 10], 'never past the target');
  for (const bad of [7, 1, 13, '9', null, 2.5, {}]) assert.equal(E.applyMove(E.newMini('proll', E.makeRng('c')), 'X', bad, dice(1, 1)).ok, false, String(bad));
  const long = E.newMini('proll', E.makeRng('d')); E.applyMove(long, 'X', 2, dice(2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1));
  assert.deepEqual([long.last.nr, long.last.rolls.length, long.last.hit], [8, 5, true], 'only the last rolls are kept for show');
  const rng = E.makeRng('odds'); let hit = 0; for (let k = 0; k < 6000; k++) { const t = E.newMini('proll', rng); E.applyMove(t, 'X', 4, rng); if (t.last.hit) hit++; }
  assert.ok(Math.abs(hit / 6000 - 1 / 3) < 0.025, `a 4 before a 7 one time in three (${(hit / 6000).toFixed(3)})`);
});

test('proll: the computer: Normal the pick worth the most now, Hard the fewest turns still needed, Easy any; whole squares end', () => {
  const m = E.newMini('proll', E.makeRng('e')), best = (level, seed) => E.localBest(E.publicMini(m), 'X', E.makeRng(seed || 'r'), {}, { level }).move;
  assert.ok([5, 9].includes(best('hard')), 'from nothing: two 5-pointers are the shortest way to 10');
  m.score.X = 6; assert.ok([6, 8].includes(best('hard')) && [6, 8].includes(best('normal')), '4 needed: the likeliest number that covers it');
  assert.ok(new Set(Array.from({ length: 60 }, (_, k) => best('easy', 'e' + k))).size >= 6);
  const T = A.prollTable(R.prollCfg(m)); assert.ok(Math.abs(T[10] - 5) < 1e-9 && Math.abs(T[4] - 2.2) < 1e-9 && T[0] === 0);
  const st = E.newMatch(E.makeRng('i'), { games: ['proll'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, 8, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.pr).sort(), ['by', 'from', 'hit', 'nr', 'pick', 'pts', 'rolls', 'to']);
  assert.ok(E.playMs(st.flash) >= R.prollTimes(st.flash.pr.rolls.length).judge); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  let wins = 0;
  for (let g = 0; g < 200; g++) { const rng = E.makeRng('w' + g), t = E.newMini('proll', rng); let q = 'X'; for (let k = 0; k < 400; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 200);
});
