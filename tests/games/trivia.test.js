'use strict';
// Trivia: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

test('trivia: online, a new question stays face down on the server until revealed; the right answer stays there until someone picks it; a wrong pick tells nobody which is right', () => {
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('trivia'), timer: 60 }, lcg(51), 'tq1');
  const pub = rec.state.squares[0].mini, sec = rec.secrets[0];
  assert.equal(pub.answer, undefined, 'nothing in the public state says which answer is right');
  assert.deepEqual([pub.shown, pub.ask], [false, { down: true, n: 4 }], 'face down: the phones know only that there is a question');
  assert.ok(sec.ask.q && sec.ask.opts.length === 4 && Number.isInteger(sec.answer), 'the question, its options and the answer are in the secrets');
  assert.equal(E.canMove(pub, 'X'), true, 'a face-down question is still a square to play');
  // the reveal: not a move; the turn and its clock go on; the player is held to the square
  assert.equal(E.applyOnlineReveal(rec, 'O', 0).reason, 'turn', 'only the player to move turns it up');
  let r = E.applyOnlineReveal(rec, 'X', 0);
  assert.equal(r.ok, true); assert.equal(r.entries, undefined, 'no move made');
  const up = r.rec.state.squares[0].mini;
  assert.equal(up.shown, true); assert.deepEqual(up.ask, sec.ask, 'turned up: the question for both phones'); assert.equal(up.answer, undefined, 'the answer still hidden');
  assert.equal(r.rec.state.lock, 0); assert.equal(r.rec.state.turn, 'X'); assert.equal(r.rec.state.seq, rec.state.seq, 'the same turn');
  assert.equal(E.applyOnlineReveal(r.rec, 'X', 0).reason, 'shown', 'once up, it is up');
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(up)), 'X', 0).reason, 'secret', 'a phone cannot judge a guess by itself');
  const right = sec.answer, wrong = (right + 1) % 4;
  r = E.applyOnlineMove(r.rec, 'X', 0, wrong, lcg(52));
  assert.equal(r.ok, true); assert.equal(r.entries[0].trivia.correct, false); assert.equal(r.entries[0].trivia.fresh, true, 'turned up in this turn: the other phone shows the reveal first');
  const leak = JSON.stringify(r.entries[0]) + JSON.stringify(r.rec.state);
  assert.equal(r.entries[0].trivia.right, undefined, 'the result of a wrong pick: no right answer in it');
  assert.ok(!/"right":\d/.test(leak) && !/"answer":\d/.test(leak), 'nor anywhere in what the phones get');
  const m1 = r.rec.state.squares[0].mini;
  assert.deepEqual(m1.crossed, [wrong], 'crossed out, for both phones'); assert.equal(m1.ask.id, sec.ask.id); assert.equal(m1.shown, true, 'still up for the next player');
  assert.equal(r.rec.state.lock, null, 'the turn over: nobody held');
  r = E.applyOnlineMove(r.rec, 'O', 0, right, lcg(53));
  assert.equal(r.ok, true); assert.equal(r.entries[0].trivia.correct, true, 'the server judges and tells both phones');
  assert.equal(r.entries[0].trivia.fresh, undefined, 'O found it already up: no reveal to show');
  assert.equal(r.entries[0].trivia.right, right, 'the right answer shows with the right pick');
  const after = r.rec.state.squares[0].mini;
  assert.equal(after.answer, undefined, 'the next question\'s answer is hidden again');
  assert.deepEqual([after.shown, after.ask], [false, { down: true, n: 4 }], 'the next question starts face down');
  assert.notEqual(r.rec.secrets[0].ask.id, sec.ask.id); assert.ok(Number.isInteger(r.rec.secrets[0].answer));
});

test('trivia: the reveal holds the player to the square: no other square this turn; out of time, an option is crossed out; a pick on a face-down question turns it up', () => {
  const st = E.newMatch(lcg(54), { games: ['trivia'] });
  const i = st.squares.findIndex(q => q.mini.type === 'trivia'), j = st.squares.findIndex((q, k) => k !== i && q.mini.type === 'trivia');
  assert.equal(st.squares[i].mini.shown, false, 'dealt face down');
  assert.equal(E.triviaReveal(st, i, 'X').ok, true);
  assert.equal(st.lock, i);
  assert.equal(E.playMove(st, j, 0, lcg(55)).reason, 'locked', 'another square: refused');
  assert.equal(E.triviaReveal(st, j, 'X').reason, 'locked');
  st.timer = E.newTimer(60);
  const t = E.timeoutMove(st, lcg(56));
  assert.equal(t.ok, true); assert.equal(t.square, i, 'out of time: the move is made in the square revealed');
  assert.equal(st.squares[i].mini.crossed.length, 1, 'one option crossed out'); assert.equal(st.squares[i].mini.shown, true);
  assert.deepEqual(st.squares[i].mv, { X: 1, O: 0 }, 'the pick after a reveal counts as the turn\'s move (stats)');
  assert.equal(st.flash.trivia.fresh, true);
  E.endFlash(st);
  assert.equal(st.lock, null); assert.equal(st.turn, 'O');
  // the computer (or a timeout) on a question still face down: turned up with the pick
  const k = st.squares.findIndex((q, n) => n !== i && q.mini.type === 'trivia' && !q.mini.shown);
  const r = E.playMove(st, k, st.squares[k].mini.answer, lcg(57));
  assert.equal(r.ok, true); assert.equal(st.flash.trivia.fresh, true); assert.equal(st.flash.trivia.correct, true);
  assert.equal(E.playMs(st.flash), E.TRIVIA.flip + E.TRIVIA.pause + E.TRIVIA.reveal, 'the playback: the reveal, the pause, the pick');
  assert.equal(st.squares[k].mini.shown, false, 'answered right: a new question, face down');
});
