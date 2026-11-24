'use strict';
// Fruit Slice (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/slice/rules.js');
const M = require('../../src/games/slice/meta.js');

test('slice: Admin only, skill, real time, held out of Find Match; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime], ['admin', 'skill', '1.25.0', false, true]);
  assert.ok(E.FIND_MATCH_HOLD.includes('slice'), 'what was sliced is the phone\'s word');
  assert.deepEqual(E.gameFields('slice').map(f => f.k), ['secs', 'target', 'fruits', 'bombRate', 'bombCost', 'speed', 'aiHit', 'aiBomb', 'aiHitHard', 'aiBombHard', 'aiHitEasy', 'aiBombEasy']);
  const c = R.sliceCfg(E.newMini('slice', E.makeRng('a')));
  assert.deepEqual([c.target, c.secs, c.fruits, c.bombs, c.cost, c.speed], [25, 10, 14, 4, 5, 1]);
});

test('slice: a round\'s throws: the same wherever they are worked out, new for each round and player, all down again before the round ends', () => {
  for (let g = 0; g < 30; g++) {
    const m = E.newMini('slice', E.makeRng('r' + g)), a = R.sliceRound(m, 'X'), c = R.sliceCfg(m);
    assert.deepEqual(a, R.sliceRound(JSON.parse(JSON.stringify(m)), 'X')); assert.notDeepEqual(a, R.sliceRound(m, 'O'));
    assert.deepEqual([a.length, a.filter(it => it.k < 0).length, a[0].k >= 0], [18, 4, true], '14 fruit and 4 bombs, never a bomb first');
    a.forEach((it, i) => { assert.ok(it.t >= R.SLICE.lead && it.t + it.d <= c.secs * 1000, `throw ${i} is within the round`); if (i) assert.ok(it.t >= a[i - 1].t); assert.ok(it.k >= -1 && it.k < R.SLICE.kinds);
      const top = R.sliceAt(it, it.t + it.d / 2), end = R.sliceAt(it, it.t + it.d); assert.ok(top[1] > 5 && top[1] < 70 && top[0] > 5 && top[0] < 95, `throw ${i} peaks on the field (${top})`); assert.ok(end[1] >= R.SLICE.h, 'and falls off its foot'); assert.equal(R.sliceAt(it, it.t - 1), null); });
    const before = JSON.stringify(a); E.applyMove(m, 'X', { hit: [] }, E.makeRng('x')); assert.notEqual(JSON.stringify(R.sliceRound(m, 'X')), before, 'the next round is another');
  }
});

test('slice: a fruit is a point; a bomb ends the round there and costs 5 of it; the rounds add up to the target', () => {
  const m = E.newMini('slice', E.makeRng('b')), items = R.sliceRound(m, 'X'), c = R.sliceCfg(m), fruit = items.map((it, i) => (it.k >= 0 ? i : -1)).filter(i => i >= 0), b0 = items.findIndex(it => it.k < 0);
  assert.deepEqual(R.sliceScore(c, items, fruit).pts, 14);
  const s = R.sliceScore(c, items, fruit.concat([b0])), before = fruit.filter(i => i < b0).length;
  assert.deepEqual([s.fr, s.bomb, s.pts], [before, b0, Math.max(0, before - 5)], 'nothing after the bomb counts');
  let r = E.applyMove(m, 'X', { hit: fruit.slice(0, 6) }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.score.X, m.last.fr, m.last.pts, m.last.got.length, m.last.of, m.n.X], ['continue', 'round', false, 6, 6, 6, 6, 14, 1]);
  for (const bad of [null, {}, { hit: 3 }, { hit: [1, 1] }, { hit: [99] }, { hit: [-1] }, { hit: [1.5] }, { hit: ['2'] }]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  m.score.X = 20; const again = R.sliceRound(m, 'X').map((it, i) => (it.k >= 0 ? i : -1)).filter(i => i >= 0);
  r = E.applyMove(m, 'X', { hit: again }, E.makeRng('x')); assert.deepEqual([r.outcome, m.score.X], ['win', 25], 'never past the target');
});

test('slice: the computer by level; the flash; a timeout plays nothing; whole squares end with a winner', () => {
  const pts = level => { let s = 0; for (let k = 0; k < 500; k++) { const t = E.newMini('slice', E.makeRng('q' + k)), rng = E.makeRng(level + k); E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng); s += t.last.pts; } return s / 500; };
  const e = pts('easy'), n = pts('normal'), h = pts('hard');
  assert.ok(e < n && n < h, `points a round: easy ${e.toFixed(1)} < normal ${n.toFixed(1)} < hard ${h.toFixed(1)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['slice'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { hit: [0] }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.fs).sort(), ['bomb', 'by', 'fr', 'from', 'got', 'of', 'pts', 'to']);
  assert.ok(E.playMs(st.flash) >= R.sliceShowMs(st.flash.fs)); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  let wins = 0;
  for (let g = 0; g < 120; g++) { const rng = E.makeRng('w' + g), t = E.newMini('slice', rng); let q = 'X'; for (let k = 0; k < 900; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 120);
});
