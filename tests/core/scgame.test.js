'use strict';
// A Super Chaos match from Find Match as the server runs it (core/scgame.js): each side's move a request at
// a time on its own copy of the round, the round settled once both are in (or at the deadline: a side not in
// misses the round, two misses in a row lose), the next round once both phones are through the recap, a bot's move by the computer's own play, the public state with every secret hidden
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

test('scgame: a new match is timed from the server (plus the grace); a side\'s move is made on its own copy, hidden in what it is shown; the other side sees only that a move is in; both in settle the round, the last mover\'s phone starting its recap after its own result; the next round once both are through it', () => {
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
  assert.deepEqual([rc.at, Object.keys(rc.lead)], [T0 + 13000 + E.SC_ONLINE.leadMs, ['O']], 'the recap\'s start; O\'s phone (its own result on show) later');
  assert.ok(rc.lead.O >= E.SC_GAME.leadHoldMs);
  assert.deepEqual([rc.mv.X.square, rc.mv.O.square, rc.mv.O.steps.length], [0, 1, 2], 'both moves kept for the replays');
  assert.notEqual(rc.mv.O.steps[1].after.word, 'ZEBRA', 'hidden there too'); assert.notEqual(rc.mv.O.start.word, 'ZEBRA');
  assert.deepEqual(E.scSideView(g, 'X'), { round: 2, me: null, prog: null });
  assert.equal(E.applyScMove(g, 'X', 2, 10, rng('x'), T0 + 14000).reason, 'recap');
  assert.deepEqual(E.applyScBegin(g, T0 + 20000, ['X']), { ok: true, begun: false }); assert.equal(g.full.sc.deadline, null, 'X through the recap: waiting for O');
  assert.equal(E.applyScBegin(g, T0 + 20500, ['X']).reason, 'waiting');
  assert.equal(E.scDue(g), T0 + 20000 + E.SC_ONLINE.readyWaitMs, 'the sweep looks again once X has waited long enough');
  assert.deepEqual(E.applyScBegin(g, T0 + 22000, ['O']), { ok: true, begun: true }); assert.equal(g.full.sc.deadline, T0 + 82000, 'both through: begun, timed from then');
  assert.equal(E.applyScBegin(g, T0 + 22000, ['X']).reason, 'begun');
  assert.equal(E.scDue(g), T0 + 82000 + E.SC_ONLINE.graceMs);
});
test('scgame: the deadline past its grace: a side not in misses the round (a move going on ends as it stands), the round settled; two misses in a row lose; a bot\'s move by the computer\'s play (a bot through the recap at once); a resignation ends it', () => {
  const g = rig(fresh(), [wordle('SLATE'), hangman('ZEBRA')]);
  const dl = g.full.sc.deadline;
  assert.equal(E.applyScTimeout(g, dl + 1000, rng('t')).reason, 'early');
  assert.ok(E.applyScMove(g, 'O', 1, 'Z', rng('o'), dl - 5000).ok, 'O hit, its move going on');
  const r = E.applyScTimeout(g, dl + E.SC_ONLINE.graceMs, rng('t'));
  assert.ok(r.ok, JSON.stringify(r)); assert.deepEqual(r.timed, ['X', 'O']);
  const rc = g.full.sc.recap;
  assert.deepEqual([rc.mv.O.square, rc.mv.O.steps.length], [1, 1], 'O\'s move ended where it stood: its one guess, nothing more');
  assert.deepEqual([rc.mv.X, rc.missed, g.full.sc.miss], [null, ['X'], { X: 1, O: 0 }], 'X missed the round: nothing played for it');
  assert.equal(E.applyScBegin(g, dl + 30000).reason, 'waiting', 'the sweep: nobody through yet');
  assert.equal(E.applyScBegin(g, dl + 30000, ['X', 'O']).begun, true, 'a phone and a bot through: begun');
  // a bot on O: its move by the computer's Super Chaos play, at the admin's level; then X in: settled
  const b = E.applyScBot(g, 'O', rng('bot'), 'normal', dl + 31000);
  assert.ok(b.ok && !b.resolved, JSON.stringify(b)); assert.ok(Number.isInteger(b.square));
  assert.equal(E.applyScBot(g, 'O', rng('bot'), 'normal', dl + 31000).reason, 'moved');
  assert.deepEqual(E.scPublicState(g).sc.moves, { X: false, O: true });
  const x = E.applyScMove(g, 'X', 0, 'SLATE', rng('x'), dl + 32000);
  assert.ok(x.ok && x.resolved, JSON.stringify(x));
  assert.equal(g.full.squares[0].owner, 'X');
  assert.deepEqual(g.full.sc.miss, { X: 0, O: 0 }, 'a move made clears the count');
  // two rounds missed in a row lose the match
  const g2 = rig(fresh(), [wordle('SLATE')]);
  E.applyScTimeout(g2, g2.full.sc.deadline + E.SC_ONLINE.graceMs, rng('t'));
  E.applyScBegin(g2, T0 + 90000, ['X', 'O']);
  assert.ok(E.applyScMove(g2, 'O', 3, 10, rng('o'), T0 + 91000).ok);
  const r2 = E.applyScTimeout(g2, g2.full.sc.deadline + E.SC_ONLINE.graceMs, rng('t'));
  assert.deepEqual([r2.timed, g2.full.winner, g2.full.winReason, g2.full.resigned, E.scDue(g2)], [['X'], 'O', 'timeout', 'X', 1]);
  const res = E.applyScResign(g, 'O');
  assert.ok(res.ok); assert.deepEqual([g.full.winner, g.full.winReason, g.full.resigned], ['X', 'resign', 'O']);
  assert.equal(E.scDue(g), 1);
  const fin = E.scFinal(g, { X: 'Ann', O: 'Bo' });
  assert.equal(fin.squares[1].mini.word, 'ZEBRA', 'the final board reveals everything');
  assert.equal(E.applyScMove(g, 'X', 2, 10, rng('x'), dl + 40000).reason, 'over');
});
