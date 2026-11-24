'use strict';
// Mahjong (December 2026: the hand-building game in place of the solitaire layouts): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/mahjong/rules.js');
const A = require('../../src/games/mahjong/ai.js');
const M = require('../../src/games/mahjong/meta.js');

const mini = (seed, tune) => { E.setTune('mahjong', tune || null); try { return E.newMini('mahjong', E.makeRng('mj-' + (seed || 1))); } finally { E.setTune('mahjong', null); } };
const pv = (m, p) => E.publicMini(m, p);

test('mahjong: Admin only, luck, never on one phone; its settings; the tile set; a deal of seven each from one wall (Shared) or a wall each (Race)', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.samePhone], ['admin', 'luck', '1.29.0', false, false]);
  assert.deepEqual(E.gameFields('mahjong').map(f => [f.k, f.def]), [['mode', 'shared'], ['hand', 7], ['suits', 3], ['nums', 5], ['honours', 'off']]);
  assert.equal(R.mjTiles(R.mjCfg({ type: 'mahjong' })).length, 60, '3 suits of 1-5, four of each');
  assert.equal(R.mjTiles({ suits: 3, nums: 6, honours: true }).length, 84, 'with the honours: Sun, Moon, Cloud');
  const s = mini(1);
  assert.deepEqual([s.v, s.mode, s.hand.X.length, s.hand.O.length, Object.keys(s.wall), s.left.S], [2, 'shared', 7, 7, ['S'], 46]);
  const r = mini(1, { mode: 'race' });
  assert.deepEqual([r.mode, Object.keys(r.wall).sort(), r.left.X, r.left.O], ['race', ['O', 'X'], 53, 53]);
  assert.ok(R.stale({ type: 'mahjong' }), 'a solitaire square from before is dealt again');
});

test('mahjong: a complete hand is sets of three (three alike, or a run in one suit) and one pair; honours never run; the steps from complete', () => {
  assert.ok(R.mjComplete(['b1', 'b2', 'b3', 'd4', 'd4', 'd4', 's2', 's2']));
  assert.ok(R.mjComplete(['d1', 'd2', 'd3', 'd2', 'd3', 'd4', 'd5', 'd5']), 'two runs sharing a suit');
  assert.ok(R.mjComplete(['b4', 'b5', 'd1', 'd2', 'd3', 's2', 's2', 'b6']), 'in any order');
  assert.ok(!R.mjComplete(['h1', 'h2', 'h3', 'd4', 'd4', 'd4', 's2', 's2']), 'honours make no run');
  assert.ok(!R.mjComplete(['b4', 'b5', 'b6', 'd4', 'd4', 'd4', 's2', 's3']), 'no pair');
  assert.equal(R.mjShanten(['b1', 'b2', 'b3', 'd4', 'd4', 'd4', 's2'], 2), 0, 'one tile away');
  assert.equal(R.mjShanten(['b1', 'b2', 'b3', 'd4', 'd4', 'd4', 's2', 's2'], 2), -1, 'complete');
  assert.equal(R.mjShanten(['b1', 'b4', 'd2', 'd6', 's1', 's5', 'h1'], 2), 4, 'nothing together');
  assert.deepEqual(R.mjSets(['b1', 'b2', 'b3', 'b3', 'b4', 'b5', 's2', 's2']), { sets: [['b1', 'b2', 'b3'], ['b3', 'b4', 'b5']], pair: ['s2', 's2'] });
});

test('mahjong: Take (the wall, or in Shared the pile; the turn held), then Throw; a take that completes the hand wins at once', () => {
  const m = mini(2);
  m.hand.X = ['b1', 'b2', 'b3', 'd4', 'd4', 'd4', 's2']; m.wall.S.push('s5');
  let r = E.applyMove(m, 'X', { d: 'b1' }, E.makeRng('a')); assert.equal(r.ok, false, 'nothing to throw before a take');
  r = E.applyMove(m, 'X', 'wall', E.makeRng('a'));
  assert.deepEqual([r.ok, r.again, r.note, m.hand.X.length, m.held.t], [true, true, 'take', 8, 's5']);
  assert.equal(E.applyMove(m, 'X', 'wall', E.makeRng('a')).ok, false, 'one take a turn');
  r = E.applyMove(m, 'X', { d: 's5' }, E.makeRng('a'));
  assert.deepEqual([r.ok, !!r.again, r.note, m.hand.X.length, m.pile.S.slice(-1)[0], m.sc.X], [true, false, 'discard', 7, 's5', 2]);
  // O takes X's discard; then X, one away, takes a pair tile off the pile and wins
  r = E.applyMove(m, 'O', 'pile', E.makeRng('b')); assert.deepEqual([r.ok, m.last.t, m.held.t], [true, 's5', 's5']);
  m.hand.O.splice(m.hand.O.indexOf('s5'), 1); m.hand.O.push('s2'); m.held.t = 's2';
  r = E.applyMove(m, 'O', { d: 's2' }, E.makeRng('b')); assert.ok(r.ok);
  r = E.applyMove(m, 'X', 'pile', E.makeRng('c'));
  assert.deepEqual([r.outcome, r.note, m.last.win, m.held], ['win', 'mahjong', true, null]);
  for (const bad of [null, {}, 'x', { d: 'zz' }]) assert.equal(E.applyMove(mini(3), 'X', bad, E.makeRng('x')).ok, false);
});

test('mahjong: Race: each player their own wall and discards, no taking from a pile; a wall run out shuffles its pile back in', () => {
  const m = mini(4, { mode: 'race' }), before = m.left.O;
  assert.equal(E.applyMove(m, 'X', 'pile', E.makeRng('a')).ok, false);
  E.applyMove(m, 'X', 'wall', E.makeRng('a')); E.applyMove(m, 'X', { d: m.hand.X[0] }, E.makeRng('a'));
  assert.deepEqual([m.left.X, m.left.O, m.pile.X.length, m.pile.O.length], [52, before, 1, 0]);
  m.wall.X = []; m.pile.X = ['b1', 'b2', 'b3'];
  const r = E.applyMove(m, 'X', 'wall', E.makeRng('b'));
  assert.ok(r.ok); assert.equal(m.last.reshuf, true); assert.deepEqual(m.pile.X, ['b3'], 'the top stays');
});

test('mahjong: the hands are secret: never in the public view, an entry or the other side\'s view; each side its own part; a timeout throws the tile taken', () => {
  const m = mini(5);
  assert.deepEqual(Object.keys(E.secretOf(m)).sort(), ['hand', 'held', 'wall']);
  const v = pv(m); assert.deepEqual(v.hand, {}); assert.equal(v.wall, undefined);
  assert.deepEqual(Object.keys(pv(m, 'X').hand), ['X']);
  E.applyMove(m, 'X', 'wall', E.makeRng('a'));
  const t = m.held.t;
  assert.equal(pv(m, 'O').held.t, undefined, 'a wall tile is the taker\'s alone'); assert.equal(pv(m, 'X').held.t, t);
  const part = R.sidePart(m, 'X'); assert.deepEqual([part.hand.length, part.took], [8, t]);
  const h = JSON.parse(JSON.stringify(m)); R.hide(h); assert.deepEqual([h.wall, h.hand, h.held.t], [undefined, {}, undefined]);
  R.sideMerge(h, 'X', part); assert.deepEqual([h.hand.X.length, h.held.t], [8, t]);
  assert.equal(R.timeoutClose(m, 'X'), 'auto'); assert.equal(R.timeoutClose(m, 'O'), null);
  const r = E.applyMove(m, 'X', 'auto', E.makeRng('a')); assert.ok(r.ok); assert.equal(m.pile.S.slice(-1)[0], t);
  const st = E.newMatch(E.makeRng('i'), { games: ['mahjong'] }); assert.ok(E.playMove(st, 4, 'wall', E.makeRng('s')).ok);
  assert.ok(st.flash.mj && st.flash.mj.kind === 'take'); assert.ok(E.playMs(st.flash) >= R.MJT.slide);
});

test('mahjong: the computer: it takes a winning discard, throws the tile that leaves it closest (Hard by the tiles left unseen); whole squares end at every level', () => {
  const m = mini(6, { aiMissNormal: 0 });                            // (its careful play: no careless throws)
  m.hand.X = ['b1', 'b2', 'b3', 'd4', 'd4', 'd4', 's2']; m.pile.S = ['s2'];
  assert.equal(E.localBest(pv(m, 'X'), 'X', E.makeRng('a'), {}, { level: 'normal' }).move, 'pile');
  m.pile.S = [];
  E.applyMove(m, 'X', 'wall', E.makeRng('z')); m.hand.X = R.mjSort(['b1', 'b2', 'b3', 'd4', 'd4', 'd4', 's2', 'h1']); m.held.t = 'h1';
  for (const level of ['normal', 'hard']) assert.deepEqual(E.localBest(pv(m, 'X'), 'X', E.makeRng('a'), {}, { level }).move, { d: 'h1' }, level);
  assert.ok(A.needs(pv(m, 'X'), 'X') < A.needs(pv(m, 'O'), 'O') + 3);
  for (const tune of [null, { mode: 'race' }, { hand: 4 }, { hand: 10, honours: 'on' }]) for (let g = 0; g < 12; g++) {
    const t = mini('w' + g, tune), rng = E.makeRng('w' + g); let q = 'X', done = false;
    for (let k = 0; k < 600 && !done; k++) { const b = E.localBest(pv(t, q), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }); const r = E.applyMove(t, q, b.move, rng); assert.ok(r.ok, JSON.stringify(b.move)); if (r.outcome === 'win') done = true; else if (!r.again) q = q === 'X' ? 'O' : 'X'; }
    assert.ok(done, `square ${g} ${JSON.stringify(tune)} ended`);
  }
});
