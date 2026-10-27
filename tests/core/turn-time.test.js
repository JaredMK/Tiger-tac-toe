'use strict';
// The online turn's time (core/timer.js): 30 seconds a turn, and 60 in a game that declares it (meta.js turnSecs:
// the runners, Sky Hop, Scoop Stack, Pinball, Echo, Snapshot, Risky Rolls). Opening such a square on your turn
// gives the turn its time, counted from the turn's start, and holds the turn there (turnOpen; the server's 'open').
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const LONG = ['dash', 'lane', 'flap', 'chopper', 'skyhop', 'scoop', 'pinball', 'echo', 'snapshot', 'pig'];
const T0 = 1700000000000;
function match(types, timer = 30) {                               // an online match, its squares dealt from these games
  const games = Object.fromEntries(E.TYPES.map(g => [g, types.includes(g)]));
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer }, lcg(3), 'mt');
  E.armClock(rec.state, [], T0);
  return rec;
}

test('turn time: Find Match and a friend game take 30 seconds a turn; the long games declare 60', () => {
  assert.deepEqual(E.TIMER_OPTIONS, [0, 30]);
  for (const t of E.TYPES) assert.equal(E.turnSecs(t), LONG.includes(t) ? 60 : null, t);
  const rec = match(['ttt']);
  assert.equal(rec.state.timer.limit, 30);
  assert.equal(E.clockDeadline(rec.state.timer), T0 + 30000);
});

test('turn time: opening a 60 s game gives the turn 60 s from its start and holds it there; a 30 s game, or a second open, changes nothing', () => {
  const rec = match(['dash', 'ttt']), full = E.fullState(rec), p = full.turn;
  const short = full.squares.findIndex(s => s.mini.type === 'ttt'), long = full.squares.findIndex(s => s.mini.type === 'dash');
  assert.ok(short >= 0 && long >= 0);
  assert.equal(E.applyOnlineOpen(rec, p, short).reason, 'same', 'a 30 s game: the turn keeps its 30 s');
  assert.equal(E.applyOnlineOpen(rec, E.other(p), long).reason, 'turn', 'only the player on the move');
  const r = E.applyOnlineOpen(rec, p, long);
  assert.equal(r.ok, true);
  const st = E.fullState(r.rec);
  assert.equal(st.lock, long, 'held to the square'); assert.equal(st.lockBy, 'open');
  assert.equal(st.timer.secs, 60); assert.equal(E.clockDeadline(st.timer), T0 + 60000, '60 s from the turn\'s start');
  assert.equal(E.turnBegan(st.timer), T0, 'the turn began when it began (a run is held to that)');
  assert.ok(E.parseMatch(E.packMatch(r.rec)).state.lockBy === 'open', 'the record keeps the hold');
  assert.equal(E.applyOnlineOpen(r.rec, p, long).reason, 'same', 'once a turn');
  assert.equal(E.applyOnlineMove(r.rec, p, short, 4, lcg(1)).reason, 'locked', 'no move elsewhere once opened');
});

test('turn time: before the clock starts (the replay still playing), the latest deadline is the start plus 60; startClock counts 60 too', () => {
  const rec = match(['skyhop']), st = E.fullState(rec);
  st.timer.deadline = null; st.timer.startBy = T0 + 5000;
  assert.equal(E.turnOpen(st, 0), true);
  assert.equal(E.clockDeadline(st.timer), T0 + 65000);
  assert.equal(E.startClock(st, st.turn, T0 + 2000), true);
  assert.equal(st.timer.deadline, T0 + 62000);
});

test('turn time: a move in the opened square is the turn\'s move (counted, not a bonus); the next turn has 30 s again', () => {
  const rec = match(['pig']), full = E.fullState(rec), p = full.turn;
  let r = E.applyOnlineOpen(rec, p, 4);
  r = E.applyOnlineMove(r.rec, p, 4, 'roll', lcg(2));
  assert.equal(r.ok, true);
  let st = E.fullState(r.rec);
  assert.equal(st.squares[4].mv[p], 1, 'the roll counts as the turn spent there');
  assert.equal(st.lockBy, null);
  if (st.turn === p) { r = E.applyOnlineMove(r.rec, p, 4, 'bank', lcg(3)); st = E.fullState(r.rec); }
  assert.notEqual(st.turn, p);
  E.armClock(st, [], T0 + 70000);
  assert.equal(st.timer.secs, null); assert.equal(E.clockDeadline(st.timer), T0 + 100000, 'the next turn: 30 s');
});

test('turn time: a square opened and nothing done there times out as a missed turn; two in a row lose the match', () => {
  let rec = match(['dash']);
  const p = rec.state.turn;
  for (let k = 0; k < 2; k++) {
    let r = E.applyOnlineOpen(rec, rec.state.turn, k ? 2 : 4);
    assert.equal(r.ok, true);
    r = E.applyOnlineTimeout(r.rec, lcg(5 + k));
    assert.equal(r.ok, true);
    rec = r.rec;
    if (k === 0) {
      const st = E.fullState(rec);
      assert.equal(st.timer.streak[p], 1, 'a miss, not a move under way'); assert.notEqual(st.turn, p);
      // the other player misses once too, then it is p's turn again
      E.armClock(rec.state, [], T0); const r2 = E.applyOnlineTimeout(rec, lcg(9)); rec = r2.rec; E.armClock(rec.state, [], T0);
      assert.equal(rec.state.turn, p);
    }
  }
  const st = E.fullState(rec);
  assert.equal(st.winner, E.other(p)); assert.equal(st.winReason, 'timeout', 'two misses in a row: a forfeit');
});

test('turn time: a Start after an open is an attempt begun (a timeout fails it, as before)', () => {
  const rec = match(['skyhop']), p = rec.state.turn;
  let r = E.applyOnlineOpen(rec, p, 4);
  r = E.applyOnlineStart(r.rec, p, 4, T0 + 1000);
  assert.equal(r.ok, true);
  assert.equal(E.fullState(r.rec).lockBy, null);
  const to = E.applyOnlineTimeout(r.rec, lcg(4));
  assert.equal(to.ok, true);
  assert.equal(E.fullState(to.rec).timer.streak[p], 0, 'an attempt begun: closed, not a miss');
});
