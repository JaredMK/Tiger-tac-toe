'use strict';
// Super Chaos in a friend room (core/chaos.js, core/records.js): the record is the round's one truth (its number,
// its deadline in server time, each move in); each phone plays its own move on its own copy of the board and
// sends it in; the second one in settles the round on the record, as does the deadline (the timeout rule's move
// for a side not in), with a shared start a second ahead; the first phone through the recap begins the next
// round (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

const clone = v => JSON.parse(JSON.stringify(v));
const T0 = 1700000000000;   // server time at the start
// A Super Chaos match in a room, its squares set as given (the rest Higher/Lower squares nobody plays)
function room(minis) {
  const games = Object.fromEntries(E.scTypes().map(t => [t, true]));
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games, timer: 0, chaos: true }, E.makeRng('room'), 'm1', T0);
  assert.ok(rec && rec.state.sc && rec.state.sc.online, 'a Super Chaos match');
  assert.equal(rec.state.sc.deadline, T0 + 60000, 'the first round timed from the server\'s time');
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
  const r1 = E.applyChaosSubmit(rec, 'X', mx, E.makeRng('r'), T0 + 5000);
  assert.ok(r1.ok && !r1.resolved, 'waiting for O');
  assert.equal(r1.rec.state.squares[0].owner, null, 'nothing claimed yet');
  assert.ok(r1.rec.state.sc.moves.X, 'X is in');
  assert.equal(E.applyChaosSubmit(r1.rec, 'X', mx, E.makeRng('r'), T0 + 5000).reason, 'moved', 'one move a round');
  const mo = play(r1.rec, 'O', 1, [10]);
  assert.equal(E.applyChaosSubmit(r1.rec, 'O', Object.assign({}, mo, { round: 5 }), E.makeRng('r'), T0 + 9000).reason, 'round');
  const r2 = E.applyChaosSubmit(r1.rec, 'O', mo, E.makeRng('r'), T0 + 9000);
  assert.ok(r2.ok && r2.resolved, 'settled');
  const st = r2.rec.state, rc = st.sc.recap;
  assert.equal(st.squares[0].owner, 'X', 'X takes the Wordle square');
  assert.deepEqual(rc.claims.map(c => [c.square, c.by]), [[0, 'X']]);
  assert.deepEqual([rc.mv.X.square, rc.mv.O.square, rc.mv.O.steps.length, rc.mv.O.type], [0, 1, 1, 'hilo'], 'both moves kept for the replays');
  assert.deepEqual([st.sc.round, st.sc.moves, st.sc.deadline], [2, {}, null], 'the next round is on the record, not begun yet (its deadline comes once the recap is over)');
  assert.equal(rc.at, T0 + 9000 + E.SC_ONLINE.leadMs, 'the shared start: a second after the round settled, in server time');
  const r2b = E.applyChaosSubmit(r1.rec, 'O', mo, E.makeRng('r'), T0 + 9000, 2600);
  assert.equal(r2b.rec.state.sc.recap.at, T0 + 9000 + 2600, "the mover's own result still on show: the shared start waits for it");
  assert.equal(E.applyChaosSubmit(r1.rec, 'O', mo, E.makeRng('r'), T0 + 9000, 400).rec.state.sc.recap.at, T0 + 9000 + E.SC_ONLINE.leadMs, 'a second at least');
  assert.equal(E.applyChaosSubmit(r2.rec, 'X', Object.assign({}, mx, { round: 2 }), E.makeRng('r'), T0 + 9500).reason, 'recap', 'no move until the round has begun');
  const b = E.applyChaosBegin(r2.rec, T0 + 20000);
  assert.ok(b.ok); assert.equal(b.rec.state.sc.deadline, T0 + 80000, 'the first phone through the recap begins the round, timed from then');
  assert.equal(E.applyChaosBegin(b.rec, T0 + 20300).reason, 'begun', 'the other finds it begun');
  assert.deepEqual(st.sc.last, { X: 0, O: 1 });
  assert.equal(st.squares[1].mini.guesses.length, 1, "O's guess is on the board");
  // the next round: the order they come in does not matter; both win the same square: it resets
  const rec2 = room([wordle('SLATE')]);
  const r3 = E.applyChaosSubmit(rec2, 'O', play(rec2, 'O', 0, ['SLATE']), E.makeRng('r'), T0 + 1000);
  const r4 = E.applyChaosSubmit(r3.rec, 'X', play(r3.rec, 'X', 0, ['SLATE']), E.makeRng('r'), T0 + 2000);
  assert.ok(r4.resolved);
  assert.deepEqual(r4.rec.state.sc.recap.resets.map(x => [x.square, x.why]), [[0, 'both']]);
  assert.equal(r4.rec.state.squares[0].owner, null);
});

test('Super Chaos online: the deadline settles the round with the timeout rule\'s move for a side not in (either phone, once the mover\'s own grace is past); a move in late still counts while unsettled', () => {
  const rec = room([wordle('CRANE')]), dl = rec.state.sc.deadline;
  const r1 = E.applyChaosSubmit(rec, 'X', play(rec, 'X', 0, ['SLATE']), E.makeRng('r'), T0 + 5000);
  assert.equal(E.applyChaosDeadline(r1.rec, dl - 1, E.makeRng('d')).reason, 'early', 'not before the deadline');
  assert.equal(E.applyChaosDeadline(r1.rec, dl + 1000, E.makeRng('d')).reason, 'early', 'nor in the grace for the mover\'s own phone');
  const late = E.applyChaosSubmit(r1.rec, 'O', play(r1.rec, 'O', 1, [10]), E.makeRng('r'), dl + 1500);
  assert.ok(late.ok && late.resolved, 'a move in a little late still settles the round');
  const r2 = E.applyChaosDeadline(r1.rec, dl + E.SC_ONLINE.graceMs, E.makeRng('d'));
  assert.ok(r2.ok && r2.resolved, 'the deadline settles it');
  const rc = r2.rec.state.sc.recap;
  assert.ok(rc.mv.O && rc.mv.O.auto && Number.isInteger(rc.mv.O.square) && rc.mv.O.steps.length >= 1, 'the timeout rule moved for O');
  assert.equal(rc.at, dl + E.SC_ONLINE.graceMs + E.SC_ONLINE.leadMs, 'with the shared start a second ahead');
  assert.equal(E.applyChaosDeadline(r2.rec, dl + 9000, E.makeRng('d')).reason, 'recap', 'once only');
  // nobody in at all: both get the timeout rule's move
  const r3 = E.applyChaosDeadline(rec, dl + E.SC_ONLINE.graceMs, E.makeRng('d2'));
  assert.ok(r3.ok && r3.rec.state.sc.recap.mv.X.auto && r3.rec.state.sc.recap.mv.O.auto);
});

test('Super Chaos online Roulette: the record draws the round\'s spin (kept off the public state); both phones\' bets land on it; a new one each round', () => {
  const rl = { type: 'rl', hits: { X: 0, O: 0 }, spins: [], last: null };
  const full0 = E.fullState(room([rl]));
  E.scRoundStart(full0.squares, E.makeRng('d'));
  const rec = E.matchRecord(Object.assign(full0, { sc: clone(full0.sc) }));
  const spin = E.fullState(rec).squares[0].mini.spin;
  assert.ok(Number.isInteger(spin), 'drawn on the record');
  assert.equal(rec.state.squares[0].mini.spin, undefined, 'not in the public state');
  const mx = play(rec, 'X', 0, ['g1']), mo = play(rec, 'O', 0, ['zero']);
  assert.deepEqual([mx.mini.last.n, mo.mini.last.n], [spin, spin], 'one spin for both bets');
  const r1 = E.applyChaosSubmit(rec, 'X', mx, E.makeRng('r'), T0 + 1000);
  const r2 = E.applyChaosSubmit(r1.rec, 'O', mo, E.makeRng('r'), T0 + 2000);
  assert.ok(r2.resolved);
  const after = E.fullState(r2.rec).squares[0];
  assert.deepEqual([after.owner, after.mini.type, spin], [null, 'rl', 11], 'both missed (11: neither 1–8 nor green 0)');
  assert.deepEqual(after.mini.spins, [{ n: 11, by: '', hit: false }], 'once in the history');
  assert.ok(Number.isInteger(after.mini.spin), 'the next round\'s spin is drawn as the round settles');
});
