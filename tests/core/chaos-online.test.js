'use strict';
// Super Chaos in a friend room (core/chaos.js, core/records.js): each phone plays its own move on its own copy
// of the board and sends it in; the second one in settles the round on the record (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

const clone = v => JSON.parse(JSON.stringify(v));
// A Super Chaos match in a room, its squares set as given (the rest Higher/Lower squares nobody plays)
function room(minis) {
  const games = Object.fromEntries(E.scTypes().map(t => [t, true]));
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games, timer: 0, chaos: true }, E.makeRng('room'), 'm1');
  assert.ok(rec && rec.state.sc && rec.state.sc.online, 'a Super Chaos match');
  assert.ok(rec.state.squares.every(q => E.scTypes().includes(q.mini.type)), 'Super Chaos games only');
  const full = E.fullState(rec);
  full.sc = clone(rec.state.sc);
  full.squares = Array.from({ length: 9 }, (_, i) => ({ owner: null, mini: minis[i] || { type: 'hilo', target: 20, lo: 1, hi: 30, guesses: [] }, mv: { X: 0, O: 0 } }));
  return E.matchRecord(full);
}
// One phone's copy of the round, as it joins it from the record
function phone(rec, me) {
  const st = E.fullState(rec);
  st.online = { role: me === 'X' ? 'host' : 'guest', code: 'ABCDE', me };
  st.sc = Object.assign(clone(rec.state.sc), { me: null, moved: null, start: null, steps: null, recap: null });
  st.turn = me; st.lock = null;
  return st;
}
// The phone's move (each step of it), then what it sends in
function play(rec, me, i, moves, rng) {
  const st = phone(rec, me);
  for (const m of moves) { const r = E.playMove(st, i, m, rng || E.makeRng('p' + me)); assert.ok(r.ok, JSON.stringify(r)); st.flash = null; }
  assert.ok(st.sc.me, 'the move is in');
  return E.scMoveOf(st, me);
}
const wordle = word => ({ type: 'wordle', word, guesses: [] });

test('Super Chaos online: each sends in its move; the second one settles the round on the record, both moves kept for the replays', () => {
  const rec = room([wordle('CRANE')]);
  const mx = play(rec, 'X', 0, ['CRANE']);
  assert.equal(mx.win, true); assert.equal(mx.steps.length, 1); assert.equal(mx.start.guesses.length, 0);
  const r1 = E.applyChaosSubmit(rec, 'X', mx, E.makeRng('r'));
  assert.ok(r1.ok && !r1.resolved, 'waiting for O');
  assert.equal(r1.rec.state.squares[0].owner, null, 'nothing claimed yet');
  assert.ok(r1.rec.state.sc.moves.X, 'X is in');
  assert.equal(E.applyChaosSubmit(r1.rec, 'X', mx, E.makeRng('r')).reason, 'moved', 'one move a round');
  const mo = play(r1.rec, 'O', 1, [10]);
  assert.equal(E.applyChaosSubmit(r1.rec, 'O', Object.assign({}, mo, { round: 5 }), E.makeRng('r')).reason, 'round');
  const r2 = E.applyChaosSubmit(r1.rec, 'O', mo, E.makeRng('r'));
  assert.ok(r2.ok && r2.resolved, 'settled');
  const st = r2.rec.state, rc = st.sc.recap;
  assert.equal(st.squares[0].owner, 'X', 'X takes the Wordle square');
  assert.deepEqual(rc.claims.map(c => [c.square, c.by]), [[0, 'X']]);
  assert.deepEqual([rc.mv.X.square, rc.mv.O.square, rc.mv.O.steps.length, rc.mv.O.type], [0, 1, 1, 'hilo'], 'both moves kept for the replays');
  assert.deepEqual([st.sc.round, st.sc.moves], [2, {}], 'the next round has begun');
  assert.deepEqual(st.sc.last, { X: 0, O: 1 });
  assert.equal(st.squares[1].mini.guesses.length, 1, "O's guess is on the board");
  // the next round: the order they come in does not matter; both win the same square: it resets
  const rec2 = room([wordle('SLATE')]);
  const r3 = E.applyChaosSubmit(rec2, 'O', play(rec2, 'O', 0, ['SLATE']), E.makeRng('r'));
  const r4 = E.applyChaosSubmit(r3.rec, 'X', play(r3.rec, 'X', 0, ['SLATE']), E.makeRng('r'));
  assert.ok(r4.resolved);
  assert.deepEqual(r4.rec.state.sc.recap.resets.map(x => [x.square, x.why]), [[0, 'both']]);
  assert.equal(r4.rec.state.squares[0].owner, null);
});

test('Super Chaos online: a player whose move is long overdue gets one from the computer, and the round settles', () => {
  const rec = room([wordle('CRANE')]);
  const r1 = E.applyChaosSubmit(rec, 'X', play(rec, 'X', 0, ['SLATE']), E.makeRng('r'));
  const r2 = E.applyChaosAuto(r1.rec, 'O', E.makeRng('auto'));
  assert.ok(r2.ok && r2.resolved);
  const rc = r2.rec.state.sc.recap;
  assert.ok(rc.mv.O && rc.mv.O.auto && Number.isInteger(rc.mv.O.square), 'the computer moved for O');
  const r3 = E.applyChaosSubmit(r2.rec, 'O', play(r2.rec, 'O', 1, [10]), E.makeRng('r'));
  assert.equal(E.applyChaosAuto(r3.rec, 'O', E.makeRng('auto')).ok, false, 'never for a player whose move is in');
});
