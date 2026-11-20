'use strict';
// Mahjong (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/mahjong/rules.js');
const M = require('../../src/games/mahjong/meta.js');

const clearAll = (tiles, rng) => { const on = tiles.map(() => true); let n = 0; for (;;) { const pr = R.mahjPairs(tiles, on); if (!pr.length) break; const [i, j] = pr[Math.floor(rng() * pr.length)]; on[i] = false; on[j] = false; n++; } return { n, left: on.filter(Boolean).length }; };

test('mahjong: Admin only, luck; every layout holds its pairs, each picture exactly twice', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'luck', '1.24.0']);
  assert.deepEqual(E.tuneFields('mahjong').map(f => f.k), ['goal', 'chain', 'even', 'pairs', 'set']);
  for (const k of Object.keys(R.LAYOUTS)) {
    assert.equal(R.LAYOUTS[k].length, Number(k) * 2, `layout ${k}`);
    assert.equal(new Set(R.LAYOUTS[k].map(q => q.join(','))).size, R.LAYOUTS[k].length, 'no two tiles in one place');
    for (const [x, y, z] of R.LAYOUTS[k]) if (z > 0) assert.ok(R.LAYOUTS[k].some(q => q[2] === z - 1 && Math.abs(q[0] - x) < 2 && Math.abs(q[1] - y) < 2), 'an upper tile lies on something');
  }
  const m = E.newMini('mahjong', E.makeRng('a'));
  for (const p of ['X', 'O']) { const count = {}; m.lay[p].forEach(t => { count[t.k] = (count[t.k] || 0) + 1; }); assert.equal(m.lay[p].length, 24); assert.ok(Object.values(count).every(n => n === 2)); }
});

test('mahjong: layouts are always solvable: any order of free pairs clears every tile, for every size', () => {
  for (const size of [6, 8, 9, 10, 12]) for (let g = 0; g < 40; g++) {
    const rng = E.makeRng(`s${size}:${g}`), tiles = R.mahjDeal(size, 12, rng);
    for (let k = 0; k < 4; k++) { const r = clearAll(tiles, E.makeRng(`o${g}:${k}`)); assert.deepEqual([r.n, r.left], [size, 0], `size ${size}: never stuck`); }
  }
});

test('mahjong: free tiles alone come off, in matching pairs; a pair that uncovers a tile keeps the turn, another ends it', () => {
  const m = E.newMini('mahjong', E.makeRng('b')), tiles = m.lay.X, on = m.on.X;
  const blocked = tiles.findIndex((t, i) => !R.mahjFree(tiles, on, i)), pairs = R.mahjPairs(tiles, on);
  assert.ok(blocked >= 0 && pairs.length > 0);
  assert.equal(E.applyMove(m, 'X', [blocked, pairs[0][0]], E.makeRng('x')).reason, 'blocked');
  const free = tiles.map((t, i) => i).filter(i => R.mahjFree(tiles, on, i)), odd = free.find(i => tiles[i].k !== tiles[free[0]].k);
  assert.equal(E.applyMove(m, 'X', [free[0], odd], E.makeRng('x')).reason, 'nomatch');
  for (const bad of [null, [1], [1, 1], [0, 99], 'x', [0.5, 1]]) assert.equal(E.applyMove(m, 'X', bad, E.makeRng('x')).ok, false);
  const [i, j] = pairs[0], unc = R.mahjUncovers(tiles, on, i, j), r = E.applyMove(m, 'X', [i, j], E.makeRng('x'));
  assert.deepEqual([r.outcome, !!r.again, r.note, m.got.X, on[i], on[j], m.turns.X, m.first], ['continue', unc, unc ? 'chain' : 'pair', 1, false, false, 1, 'X']);
  assert.ok(m.lay.O.length === 24 && m.on.O.every(Boolean), 'the other layout is untouched');
});

test('mahjong: equal turns: the first mover reaching the goal gives the other one turn to answer; level is a draw, short leaves it, never answered it is taken', () => {
  const setup = () => { const m = E.newMini('mahjong', E.makeRng('c')); m.first = 'X'; m.got.X = 11; m.got.O = 11; m.turns.X = 3; m.turns.O = 3; return m; };
  const any = (m, p) => R.mahjPairs(m.lay[p], m.on[p])[0];
  let m = setup(); m.turns.O = 2;                                  // X about to reach it with a turn more than O
  let r = E.applyMove(m, 'X', any(m, 'X'), E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.final], ['continue', 'reached', false, { by: 'X' }]);
  r = E.applyMove(m, 'O', any(m, 'O'), E.makeRng('x')); assert.deepEqual([r.outcome, r.note], ['draw', 'tie'], 'O reaches it too: a draw');
  m = setup(); m.turns.O = 2; m.got.O = 3; E.applyMove(m, 'X', any(m, 'X'), E.makeRng('x'));
  const pr = R.mahjPairs(m.lay.O, m.on.O).find(([i, j]) => !R.mahjUncovers(m.lay.O, m.on.O, i, j));
  if (pr) { r = E.applyMove(m, 'O', pr, E.makeRng('x')); assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'X', 'held'], 'the answer falls short: the first keeps it'); }
  m = setup(); m.turns.O = 2; E.applyMove(m, 'X', any(m, 'X'), E.makeRng('x'));
  r = E.applyMove(m, 'X', [0, 1], E.makeRng('x')); assert.deepEqual([r.outcome, r.note], ['win', 'unanswered'], 'never answered: the leader\'s next move takes it');
  m = setup();                                                    // O, second, reaching it level on turns: the square at once
  m.turns.X = 4; r = E.applyMove(m, 'O', any(m, 'O'), E.makeRng('x')); m.turns.O = 4;
  assert.deepEqual([r.outcome, r.note], ['win', 'won']);
  E.setTune('mahjong', { even: 'off' });
  try { const t = E.newMini('mahjong', E.makeRng('d')); t.first = 'X'; t.got.X = 11; assert.equal(E.applyMove(t, 'X', R.mahjPairs(t.lay.X, t.on.X)[0], E.makeRng('x')).outcome, 'win'); } finally { E.setTune('mahjong', null); }
});

test('mahjong: the computer takes a pair that uncovers when there is one (Hard the longest chain); whole squares end, won or drawn', () => {
  const m = E.newMini('mahjong', E.makeRng('e')), tiles = m.lay.X, on = m.on.X;
  const good = R.mahjPairs(tiles, on).filter(([i, j]) => R.mahjUncovers(tiles, on, i, j));
  if (good.length) for (const level of ['normal', 'hard']) { const mv = E.localBest(E.publicMini(m), 'X', E.makeRng(level), {}, { level }).move; assert.ok(R.mahjUncovers(tiles, on, mv[0], mv[1]), level); }
  let ends = 0, draws = 0;
  for (let g = 0; g < 120; g++) {
    const rng = E.makeRng('w' + g), t = E.newMini('mahjong', rng); let q = 'X';
    for (let k = 0; k < 300; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: g % 3 ? 'normal' : 'hard' }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome !== 'continue') { ends++; if (r.outcome === 'draw') draws++; break; } if (!r.again) q = q === 'X' ? 'O' : 'X'; }
  }
  assert.equal(ends, 120); assert.ok(draws > 10 && draws < 80, `draws ${draws} of 120`);
  const st = E.newMatch(E.makeRng('i'), { games: ['mahjong'] }), p = st.turn, q4 = st.squares[4].mini;
  assert.ok(E.playMove(st, 4, R.mahjPairs(q4.lay[p], q4.on[p])[0], E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.mj).sort(), ['again', 'got', 'i', 'j', 'k']); assert.equal(R.timeoutClose(q4, p), null);
});
