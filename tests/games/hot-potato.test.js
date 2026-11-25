'use strict';
// Hot Potato: its rules, the bomb's tick after every board turn (core/board.js tickBombs), timeouts, the online record,
// its settings and the computer's toss (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/hot-potato/rules.js');
const M = require('../../src/games/hot-potato/meta.js');

const T = 'hot-potato';
const fixed = v => () => v;                                     // an rng that always draws v
const C = { start: 10, grace: 5, inc: 1, every: 2, cap: 100 };
// A match whose board is tic-tac-toe everywhere but square 4, Hot Potato.
function match(seed) {
  const st = E.newMatch(E.makeRng(seed || 'hp'), { games: ['ttt'] });
  st.squares[4] = { owner: null, mini: E.newMini(T, E.makeRng('m')) };
  st.turn = 'X'; st.cpu = null;
  return st;
}
const back = st => E.endFlash(st);                             // (the result over: back to the board, where the turn passes)

test('hot-potato: Admin only, luck, shared, 1.36.0, never in Super Chaos; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.superChaos, M.format], ['admin', 'luck', '1.36.0', false, false, 'shared']);
  assert.equal(E.CLIENT_VERSION, '1.36.0');
  assert.deepEqual(E.gameFields(T).map(f => [f.k, f.def]), [['start', 10], ['grace', 5], ['inc', 1], ['every', 2], ['cap', 100]]);
  assert.ok(E.TYPES.includes(T) && E.TEST_TYPES.includes(T));
  assert.deepEqual(E.newMini(T, E.makeRng('a')), { type: T, v: 1, holder: null, n: 0, tosses: { X: 0, O: 0 }, last: null, tick: null, boom: null });
});

test('hot-potato: the chance per tick (start, grace, increment, every, cap)', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(n => R.hpChance(n, C)), [10, 10, 10, 10, 10, 11, 11, 12, 12, 13, 13], 'the brief\'s example');
  assert.equal(R.hpChance(300, C), 100, 'capped');
  assert.equal(R.hpChance(40, Object.assign({}, C, { cap: 25 })), 25);
  assert.deepEqual([1, 2, 3, 4].map(n => R.hpChance(n, { start: 5, grace: 0, inc: 5, every: 1, cap: 100 })), [10, 15, 20, 25], 'no grace: it grows from the first tick');
});

test('hot-potato: the toss: anyone first, then the holder alone; never won by a move', () => {
  const m = E.newMini(T, E.makeRng('t'));
  assert.ok(E.canMove(m, 'X') && E.canMove(m, 'O'), 'before the first toss: either');
  const r = E.applyMove(m, 'X', 'toss', fixed(0));
  assert.deepEqual([r.ok, r.outcome, m.holder, m.tosses.X, m.n], [true, 'continue', 'O', 1, 0]);
  assert.ok(!E.canMove(m, 'X') && E.canMove(m, 'O'), 'only the holder');
  assert.equal(E.applyMove(m, 'X', 'toss', fixed(0)).ok, false, 'not the holder: refused');
  assert.equal(E.applyMove(m, 'O', 'pass', fixed(0)).ok, false);
  assert.equal(R.randomMove(m, 'X'), null); assert.equal(R.randomMove(m, 'O'), 'toss');
});

test('hot-potato: no tick before the first toss; a tick after every board turn from it on, the toss turn the first', () => {
  const st = match();
  E.playMove(st, 0, 0, fixed(0.99)); back(st);                   // X plays tic-tac-toe: no bomb in play yet
  assert.equal(st.squares[4].mini.n, 0);
  const r = E.playMove(st, 4, 'toss', fixed(0.99));              // O tosses: tick 1, on X (the holder now)
  assert.ok(r.ok); assert.deepEqual(r.flash.bombs, [{ i: 4, n: 1, pct: 10, holder: 'X', boom: false, winner: null }]);
  back(st);
  assert.equal(st.turn, 'X');
  E.playMove(st, 2, 0, fixed(0.99)); back(st);                   // X plays elsewhere, keeping the bomb: tick 2, on X
  assert.deepEqual([st.squares[4].mini.n, st.squares[4].mini.tick.holder], [2, 'X']);
  E.playMove(st, 1, 0, fixed(0.99)); back(st);                   // O elsewhere: tick 3, still X's
  assert.equal(st.squares[4].mini.n, 3);
});

test('hot-potato: an explosion: the holder loses the square, it stamps in, and no more ticks', () => {
  const st = match();
  E.playMove(st, 4, 'toss', fixed(0.5)); back(st);               // X tosses (tick 1, 10%, 0.5: nothing)
  const r = E.playMove(st, 0, 0, fixed(0.05));                   // O plays elsewhere holding it: tick 2 at 10% with 0.05: boom on O
  assert.ok(r.ok); assert.deepEqual(r.flash.bombs[0], { i: 4, n: 2, pct: 10, holder: 'O', boom: true, winner: 'X' });
  assert.equal(st.squares[4].owner, 'X'); assert.deepEqual(st.squares[4].mini.boom, { n: 2, holder: 'O', winner: 'X' });
  assert.ok(st.sqlog.some(e => e.t === T && e.w === 'X'), 'the square\'s play is logged as won');
  back(st);
  assert.equal(st.stamp, 4, 'the exploded square stamps in on the board');
  E.playMove(st, 1, 0, fixed(0.01)); back(st);
  assert.equal(st.squares[4].mini.n, 2, 'a decided square ticks no more');
});

test('hot-potato: an explosion that completes a line wins the match; a match already won ticks nothing', () => {
  const st = match();
  st.squares[0].owner = 'X'; st.squares[8].owner = 'X';          // X has 0 and 8: the centre (the bomb's square) completes the diagonal
  E.playMove(st, 4, 'toss', fixed(0.5)); back(st);               // X tosses: O holds
  E.playMove(st, 1, 0, fixed(0.01));                             // O plays elsewhere: tick 2 explodes on O: X wins 4, and the match
  assert.equal(st.winner, 'X'); assert.deepEqual(st.winLine, [0, 4, 8]);
  const st2 = match(); st2.squares[3].owner = 'O'; st2.squares[5].owner = 'O';
  E.playMove(st2, 4, 'toss', fixed(0.5)); back(st2);             // X tosses: O holds
  st2.squares[1].mini.cells = ['O', 'O', null, null, null, null, null, null, null]; st2.turn = 'O';
  E.playMove(st2, 1, 2, fixed(0.01));                            // O wins square 1 (no line): the bomb then goes off on O
  assert.equal(st2.squares[1].owner, 'O'); assert.equal(st2.squares[4].owner, 'X');
});

test('hot-potato: a missed turn ticks too; a turn held to its square does not', () => {
  const st = match(); st.timer = E.newTimer(30);
  E.playMove(st, 4, 'toss', fixed(0.9)); back(st);                // tick 1
  const r = E.timeoutMove(st, fixed(0.9));                        // O misses: tick 2
  assert.ok(r.ok && r.missed === 'O'); assert.equal(st.squares[4].mini.n, 2);
  const t2 = E.timeoutMove(st, fixed(0.02));                      // X misses holding nothing (O holds): tick 3 explodes on O
  assert.ok(t2.ok); assert.equal(st.squares[4].owner, 'X');
});

test('hot-potato: online: the tick rides the record and the entry; the bomb never predicted wrong', () => {
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === T]));
  let rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, E.makeRng('on'), 'hp');
  const p = rec.state.turn, i = rec.state.squares.findIndex(s => s.mini.type === T);
  const mv = E.applyOnlineMove(rec, p, i, 'toss', fixed(0.9));
  assert.ok(mv.ok, JSON.stringify(mv));
  assert.equal(mv.rec.state.squares[i].mini.holder, p === 'X' ? 'O' : 'X');
  assert.ok(mv.rec.state.squares.some(s => s.mini.type === T && s.mini.n === 1), 'every bomb on the board ticked once');
  assert.ok(Array.isArray(mv.entries[0].bombs) && mv.entries[0].bombs.length >= 1, 'the entry carries the ticks');
  rec = mv.rec;
  const other = rec.state.turn, j = rec.state.squares.findIndex((s, k) => k !== i && s.mini.type === T && !s.owner);
  if (j >= 0) assert.equal(E.applyOnlineMove(rec, other, j, 'toss', fixed(0.9)).ok, true, 'another bomb on the board: anyone may toss it first');
  assert.equal(E.applyOnlineMove(rec, p, i, 'toss', fixed(0.9)).ok, false, 'not this side\'s turn');
});

test('hot-potato: the computer tosses a bomb it holds at once, unless it can win the match outright this turn', () => {
  const st = match(); st.cpu = 'O'; st.cpuLevel = 'easy';
  E.playMove(st, 4, 'toss', fixed(0.9)); back(st);               // X tosses: the computer (O) holds it
  for (const level of ['easy', 'normal', 'hard']) {
    const b = E.cpuMove(st, E.makeRng('c' + level), null, { level, clock: () => 0, budget: 50 });
    assert.deepEqual([b.square, b.move], [4, 'toss'], level);
  }
  st.squares[3].owner = 'O'; st.squares[5].owner = 'O'; st.squares[4].owner = null;   // (a line through 4 is the bomb itself: use 6-7-8)
  st.squares[3].owner = null; st.squares[5].owner = null;
  st.squares[6].owner = 'O'; st.squares[7].owner = 'O';
  st.squares[8].mini.cells = ['O', 'O', null, null, null, null, null, null, null];   // O wins square 8 with cell 2: the match
  const w = E.cpuMove(st, E.makeRng('cw'), null, { level: 'normal', clock: () => 0, budget: 50 });
  assert.deepEqual([w.square, w.move], [8, 2], 'the match won outright: no toss');
  const n = E.cpuMove(match(), E.makeRng('cn'), null, { level: 'normal', clock: () => 0, budget: 50 });
  assert.ok(n, 'holding nothing: its usual play');
});

test('hot-potato: the view and flash carry no hidden state (nothing is hidden)', () => {
  const m = E.newMini(T, E.makeRng('v')); E.applyMove(m, 'X', 'toss', fixed(0.5)); R.boardTick(m, fixed(0.5));
  assert.deepEqual(E.publicMini(m), m);
  assert.equal(R.secret, undefined); assert.equal(R.hide, undefined);
});
