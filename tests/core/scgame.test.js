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

test('scgame: what the server holds a phone\'s move to (security review F3): no timeout move from a phone; a run with its log, no longer than the round has lasted; an attempt after Start (scStart stamps it, holds the side) and in the time since; an attention game\'s round hidden until its Start, handed over with it, its answer after Start and in time', () => {
  E.setPhysics(require('../physics.js'));
  const g = fresh();
  const dash = E.newMini('dash', rng('d')), hop = E.newMini('skyhop', rng('h')), head = E.newMini('headcount', rng('hc')), pin = E.newMini('pinball', rng('pb'));
  rig(g, [dash, hop, head, pin]);
  assert.equal(g.full.sc.began, T0, 'the round began with the match (the grace is for the intro)');
  // a timeout is never a phone's to play
  for (const [i, t] of [[0, 'dash'], [1, 'skyhop'], [2, 'headcount'], [3, 'pinball'], [4, 'hilo']]) assert.equal(E.applyScMove(g, 'X', i, 'auto', rng('x'), T0 + 10000).reason, 'auto', `${t}: 'auto' from a phone`);
  // a runner: the log, and the round's time
  const run = E.runAi(dash, 'X', rng('run')).move;
  assert.equal(E.applyScMove(g, 'X', 0, { dist: run.dist, ms: run.ms }, rng('x'), T0 + run.ms + 5000).reason, 'log', 'a run without its inputs');
  assert.equal(E.applyScMove(g, 'X', 0, run, rng('x'), T0 + 1000).reason, 'fast', 'longer than the round has lasted');
  // a finger game: Start first, then the attempt in the time since
  const hopMove = E.fingAi(hop, 'O', rng('hop')), hopMs = hopMove.steps * E.FING.step * 1000;
  assert.equal(E.applyScMove(g, 'O', 1, hopMove, rng('o'), T0 + 30000).reason, 'start', 'no Start');
  assert.deepEqual(E.applyScStart(g, 'O', 1, T0 + 2000), { ok: true, round: null }, 'Start: held to the square');
  assert.equal(g.full.squares[1].mini.started.O, T0 + 2000); assert.equal(g.prog.O.lock, 1);
  assert.equal(E.applyScMove(g, 'O', 2, 3, rng('o'), T0 + 3000).reason, 'locked', 'held to its square');
  assert.equal(E.applyScStart(g, 'O', 2, T0 + 3000).reason, 'locked');
  assert.equal(E.applyScMove(g, 'O', 1, hopMove, rng('o'), T0 + 2000 + hopMs - E.FING.slackMs - 1000).reason, 'fast', 'an attempt longer than the time since Start');
  const ho = E.applyScMove(g, 'O', 1, hopMove, rng('o'), T0 + 2000 + hopMs + 500);
  assert.ok(ho.ok && ho.me, JSON.stringify(ho)); assert.equal(g.prog.O.mini.started.O, null, 'the attempt in: the stamp cleared on the side\'s copy (the match takes it at the round\'s end)');
  assert.equal(E.applyScStart(g, 'O', 3, T0 + 40000).reason, 'moved', 'one move a round: no Start after it');
  // an attention game: the round is the server's until Start
  const pub0 = E.scPublicState(g);
  assert.equal(pub0.squares[2].mini.round.X.hidden, true, 'the round hidden in the public state'); assert.deepEqual(pub0.squares[2].mini.round.X.items, []);
  const truth = E.attTruth('headcount', g.full.squares[2].mini.round.X);
  assert.equal(E.applyScMove(g, 'X', 2, truth, rng('x'), T0 + 10000).reason, 'start', 'no answer before Start');
  const sx = E.applyScStart(g, 'X', 2, T0 + 10000);
  assert.ok(sx.ok); assert.deepEqual(sx.round, g.full.squares[2].mini.round.X, 'Start hands the round over');
  assert.deepEqual(E.scPublicState(g).squares[2].mini.round.X, sx.round, 'and the record shows it from then on');
  assert.equal(E.scPublicState(g).squares[2].mini.round.O.hidden, true, 'the other side\'s still hidden');
  assert.deepEqual(E.applyScStart(g, 'X', 2, T0 + 12000).round, sx.round, 'a Start again (a reload): the same round');
  assert.equal(g.full.squares[2].mini.started.X, T0 + 10000, 'on the same clock');
  const late = T0 + 10000 + E.attMs('headcount', sx.round) + E.ATT.answerMs.headcount + E.ATT.slackMs + 1;
  const lx = E.applyScMove(g, 'X', 2, truth, rng('x'), late);
  assert.ok(lx.ok && lx.me, JSON.stringify(lx));
  assert.deepEqual([lx.flash.att.answer, lx.flash.att.correct], [null, false], 'too late: out of time, a wrong answer');
  assert.equal(g.full.sc.round, 2, 'both in: the round settled');
  // the next round: begun once both are through the recap, its own began
  assert.equal(E.applyScBegin(g, late + 1000, ['X', 'O']).ok, true);
  assert.equal(g.full.sc.began, late + 1000); assert.equal(g.full.sc.deadline, late + 1000 + g.full.sc.limit * 1000);
  // Pinball: the inputs, after Start
  const P = E.PHYSICS.lib, pa = P.pinAi(P.pinTable(pin), pin.cfg, pin.lit.X, rng('pa')), pm = { hits: pa.result.hits, ms: pa.result.ms, end: pa.result.end, log: pa.log, steps: pa.steps };
  assert.equal(E.applyScMove(g, 'X', 3, pm, rng('x'), late + 90000).reason, 'start');
  assert.ok(E.applyScStart(g, 'X', 3, late + 2000).ok);
  assert.equal(E.applyScMove(g, 'X', 3, { hits: pm.hits, ms: pm.ms, end: pm.end, rec: pa.result.rec }, rng('x'), late + 2000 + pm.ms + 500).reason, 'log', 'a recording is no proof');
  const px = E.applyScMove(g, 'X', 3, pm, rng('x'), late + 2000 + pm.ms + 500);
  assert.ok(px.ok && px.me, JSON.stringify(px));
  assert.deepEqual(px.mini.lit.X.filter(Boolean).length, pm.hits.length, 'the server\'s ball lit what the inputs light');
});
