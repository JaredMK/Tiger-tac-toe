'use strict';
// A Super Chaos match from Find Match as the server runs it (core/scgame.js): each side's move a request at
// a time on its own copy of the round, the round settled once both are in (or at the deadline, with the
// timeout rule's move), a bot's move by the computer's own play, the public state with every secret hidden
// and the other side's move kept back, each side's own node, a resignation, the end (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const T0 = 1700000000000, rng = s => E.makeRng(s);
const games = Object.fromEntries(E.scTypes().map(t => [t, true]));
const fresh = () => E.newScGame({ names: { X: 'Ann', O: 'Bo' }, games }, rng('new'), 'g1', T0, 6000);
// the squares set as given (the rest Higher/Lower squares nobody plays)
function rig(g, minis) { g.full.squares = Array.from({ length: 9 }, (_, i) => ({ owner: null, mini: minis[i] || { type: 'hilo', target: 20, lo: 1, hi: 30, guesses: [] }, mv: { X: 0, O: 0 } })); return g; }
const wordle = word => ({ type: 'wordle', word, guesses: [] }), hangman = word => ({ type: 'hangman', word, letters: [] });

test('scgame: a new match is timed from the server (plus the grace); a side\'s move is made on its own copy, hidden in what it is shown; the other side sees only that a move is in; both in settle the round with a shared start after the last mover\'s own result', () => {
  const g = fresh();
  assert.deepEqual([g.full.sc.round, g.full.sc.deadline, g.full.sc.online], [1, T0 + 6000 + 60000, true]);
  assert.ok(g.full.squares.every(q => E.scTypes().includes(q.mini.type)), 'Super Chaos games only');
  rig(g, [wordle('CRANE'), hangman('ZEBRA')]);
  const rx = E.applyScMove(g, 'X', 0, 'CRANE', rng('x'), T0 + 10000, { rep: [[0, 'key', 'C']] });
  assert.ok(rx.ok, JSON.stringify(rx)); assert.equal(rx.me.win, true); assert.equal(rx.moved, 0); assert.equal(rx.lock, null); assert.equal(rx.resolved, false);
  assert.notEqual(rx.mini.word, 'CRANE', 'the word stays on the server'); assert.equal(rx.mini.guesses.length, 1);
  assert.equal(E.applyScMove(g, 'X', 1, 'A', rng('x'), T0 + 11000).reason, 'moved', 'one move a round');
  const pub = E.scPublicState(g);
  assert.deepEqual(pub.sc.moves, { X: true, O: false }, 'the other side learns only that X is in');
  assert.equal(pub.squares[0].mini.guesses.length, 0, 'nothing of X\'s move on the board until the recap');
  assert.notEqual(pub.squares[1].mini.word, 'ZEBRA');
  const sx = JSON.parse(JSON.stringify(E.scSideView(g, 'X')));
  assert.deepEqual([sx.round, sx.me.square, sx.me.win, sx.me.mini.guesses.length, sx.me.mini.word, sx.prog], [1, 0, true, 1, undefined, null], 'X\'s own node: its move, hidden as its phone shows it');
  assert.deepEqual(E.scSideView(g, 'O').me, null);
  // O: a Hangman guess that hits keeps the move going (lock), the next ends it
  const o1 = E.applyScMove(g, 'O', 1, 'Z', rng('o'), T0 + 12000);
  assert.ok(o1.ok); assert.equal(o1.lock, 1); assert.equal(o1.me, null); assert.notEqual(o1.mini.word, 'ZEBRA'); assert.equal(o1.mini.letters.length, 1);
  assert.deepEqual(E.scSideView(g, 'O').prog.square, 1, 'its progress, for a reload');
  assert.equal(E.applyScMove(g, 'O', 2, 10, rng('o'), T0 + 12500).reason, 'locked', 'held to its square');
  const o2 = E.applyScMove(g, 'O', 1, 'Q', rng('o'), T0 + 13000);
  assert.ok(o2.ok && o2.me && o2.resolved, JSON.stringify(o2));
  assert.equal(g.full.sc.round, 2); assert.equal(g.full.sc.deadline, null, 'the next round waits for a phone through the recap');
  assert.equal(g.full.squares[0].owner, 'X');
  const rc = E.scPublicState(g).sc.recap;
  assert.deepEqual(rc.claims.map(c => c.square + c.by), ['0X']);
  assert.ok(rc.at >= T0 + 13000 + 1000, 'the shared start after the last mover\'s own result');
  assert.deepEqual([rc.mv.X.square, rc.mv.O.square, rc.mv.O.steps.length], [0, 1, 2], 'both moves kept for the replays');
  assert.notEqual(rc.mv.O.steps[1].after.word, 'ZEBRA', 'hidden there too'); assert.notEqual(rc.mv.O.start.word, 'ZEBRA');
  assert.deepEqual(E.scSideView(g, 'X'), { round: 2, me: null, prog: null });
  assert.equal(E.applyScMove(g, 'X', 2, 10, rng('x'), T0 + 14000).reason, 'recap');
  assert.deepEqual(E.applyScBegin(g, T0 + 20000), { ok: true }); assert.equal(g.full.sc.deadline, T0 + 80000);
  assert.equal(E.applyScBegin(g, T0 + 20000).reason, 'begun');
  assert.equal(E.scDue(g), T0 + 80000 + E.SC_ONLINE.graceMs);
});
test('scgame: the deadline past its grace: the timeout rule\'s move for a side not in (a move going on is played out in its square), the round settled; a bot\'s move by the computer\'s play; a resignation ends it', () => {
  const g = rig(fresh(), [wordle('SLATE'), hangman('ZEBRA')]);
  const dl = g.full.sc.deadline;
  assert.equal(E.applyScTimeout(g, dl + 1000, rng('t')).reason, 'early');
  assert.ok(E.applyScMove(g, 'O', 1, 'Z', rng('o'), dl - 5000).ok, 'O hit, its move going on');
  const r = E.applyScTimeout(g, dl + E.SC_ONLINE.graceMs, rng('t'));
  assert.ok(r.ok, JSON.stringify(r)); assert.deepEqual(r.timed, ['X', 'O']);
  const rc = g.full.sc.recap;
  assert.equal(rc.mv.O.square, 1, 'O\'s move finished where it was'); assert.ok(rc.mv.O.steps.length >= 2);
  assert.ok(rc.mv.X.square != null && rc.mv.X.auto, 'X: a random move');
  assert.equal(E.applyScBegin(g, dl + 30000).ok, true);
  // a bot on O: its move by the computer's Super Chaos play, at the admin's level; then X in: settled
  const b = E.applyScBot(g, 'O', rng('bot'), 'normal', dl + 31000);
  assert.ok(b.ok && !b.resolved, JSON.stringify(b)); assert.ok(Number.isInteger(b.square));
  assert.equal(E.applyScBot(g, 'O', rng('bot'), 'normal', dl + 31000).reason, 'moved');
  assert.deepEqual(E.scPublicState(g).sc.moves, { X: false, O: true });
  const x = E.applyScMove(g, 'X', 0, 'SLATE', rng('x'), dl + 32000);
  assert.ok(x.ok && x.resolved, JSON.stringify(x));
  assert.equal(g.full.squares[0].owner, 'X');
  const res = E.applyScResign(g, 'O');
  assert.ok(res.ok); assert.deepEqual([g.full.winner, g.full.winReason, g.full.resigned], ['X', 'resign', 'O']);
  assert.equal(E.scDue(g), 1);
  const fin = E.scFinal(g, { X: 'Ann', O: 'Bo' });
  assert.equal(fin.squares[1].mini.word, 'ZEBRA', 'the final board reveals everything');
  assert.equal(E.applyScMove(g, 'X', 2, 10, rng('x'), dl + 40000).reason, 'over');
});
