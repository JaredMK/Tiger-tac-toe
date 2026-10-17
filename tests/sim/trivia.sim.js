'use strict';
// Simulations: Trivia. Slow, so never part of npm test:
// npm run sim -- trivia
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

/* ===================================== Trivia ===================================== */
test('trivia: one question a square, shared; a wrong pick is crossed out for both and the question stays, the right answer never shown; the next turn there carries on; right scores and a new question comes; three right wins', () => {
  const st = E.newMatch(lcg(21), { games: ['trivia'] });
  const asks = [];
  for (const sq of st.squares) { const a = sq.mini.ask; assert.equal(sq.mini.type, 'trivia'); assert.ok(a && a.id && a.q && a.opts.length === 4, 'a question dealt'); asks.push(a.id); assert.equal(a.opts[sq.mini.answer], 'Right ' + a.id.slice(1), 'the right answer is where answer says'); assert.deepEqual(sq.mini.crossed, []); }
  assert.equal(new Set(asks).size, 9, 'nine different questions across the nine squares');
  const sq = st.squares[0], m = sq.mini, q0 = m.ask.id, right = m.answer, wrongs = [0, 1, 2, 3].filter(k => k !== right);
  // X picks wrong: crossed out, no point, the same question, and nothing in the result says which is right
  let r = E.playMove(st, 0, wrongs[0], lcg(1));
  assert.equal(r.ok, true); assert.equal(r.flash.trivia.correct, false);
  assert.equal(r.flash.trivia.right, undefined, 'a wrong pick never reveals the right answer'); assert.equal(m.last.right, undefined);
  assert.deepEqual(r.flash.trivia.crossed, [], 'what was crossed out before this pick'); assert.equal(r.flash.trivia.picked, wrongs[0]);
  assert.equal(m.right.X, 0); assert.equal(m.ask.id, q0, 'the question stays'); assert.deepEqual(m.crossed, [wrongs[0]]);
  E.endFlash(st); E.leaveSquare(st);
  assert.equal(st.turn, 'O');
  // O carries on with the same question; the crossed-out option cannot be picked again
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(m)), 'O', wrongs[0]).reason, 'crossed');
  r = E.playMove(st, 0, wrongs[1], lcg(2));
  assert.equal(r.ok, true); assert.deepEqual(r.flash.trivia.crossed, [wrongs[0]]); assert.deepEqual(m.crossed, [wrongs[0], wrongs[1]]); assert.equal(m.ask.id, q0);
  E.endFlash(st); E.leaveSquare(st);
  // X's timeout: one wrong pick, the last wrong option crossed out (never the right one)
  r = E.playMove(st, 0, 'auto', lcg(3));
  assert.equal(r.ok, true); assert.equal(r.flash.trivia.picked, wrongs[2]); assert.ok(r.flash.trivia.auto); assert.equal(r.flash.trivia.right, undefined);
  assert.deepEqual(m.crossed.slice().sort(), wrongs.slice().sort()); assert.equal(m.ask.id, q0);
  E.endFlash(st); E.leaveSquare(st);
  // only the right one left: a timeout now crosses nothing
  const only1 = JSON.parse(JSON.stringify(m)); const ra = E.applyMove(only1, 'O', 'auto', lcg(4));
  assert.equal(ra.note, 'wrong'); assert.equal(only1.last.picked, -1); assert.deepEqual(only1.crossed, m.crossed); assert.equal(only1.right.O, 0);
  // O takes the right one: a point, the answer shown with it, and a new question dealt (crossed cleared)
  r = E.playMove(st, 0, right, lcg(5));
  assert.equal(r.flash.trivia.correct, true); assert.equal(r.flash.trivia.right, right); assert.equal(m.right.O, 1);
  assert.ok(m.ask && m.ask.id !== q0 && !asks.includes(m.ask.id), 'a new question, not one asked anywhere in the match');
  assert.deepEqual(m.crossed, []); assert.deepEqual(m.asked, [q0]);
  E.endFlash(st); E.leaveSquare(st);
  for (const bad of [4, -1, 'x', 1.5]) assert.equal(E.applyMove(m, 'O', bad).ok, false);
  let n = 0;
  while (!sq.owner && n++ < 30) { if (st.turn === 'O') E.playMove(st, 0, m.answer, lcg(n)); else E.playMove(st, 0, 'auto', lcg(n)); E.endFlash(st); E.leaveSquare(st); }
  assert.equal(sq.owner, 'O', 'three right: O takes the square');
  // the computer: right about 65% of the time with four options, more as they are crossed out, never a crossed one
  const rng = lcg(31);
  for (const [cross, want] of [[0, 0.65], [1, 0.69], [2, 0.77]]) {
    let ok = 0;
    for (let k = 0; k < 3000; k++) {
      const g = E.newMatch(lcg(k), { games: ['trivia'] }), gm = g.squares[0].mini;
      gm.crossed = [0, 1, 2, 3].filter(i => i !== gm.answer).slice(0, cross);
      const b = E.localBest(E.publicMini(gm), 'X', rng);
      assert.ok(!gm.crossed.includes(b.move), 'never a crossed-out option');
      if (b.move === gm.answer) ok++;
    }
    assert.ok(Math.abs(ok / 3000 - want) < 0.035, `${cross} crossed: right ${ok / 3000} (wanted ~${want})`);
  }
  // the whole bank asked: questions come round again rather than the game stalling
  E.setTriviaBank(bank(3));
  const small = E.newMatch(lcg(41), { games: ['trivia'] });
  assert.ok(small.squares.every(q => q.mini.ask && q.mini.ask.q), 'every square still has its question');
  E.setTriviaBank(bank(40));
  // no bank: no question, and a Trivia square is one nobody can move in (it resets like a dead square)
  E.setTriviaBank(null);
  const none = E.newMini('trivia', lcg(1));
  assert.equal(E.canMove(none, 'X'), false);
  assert.equal(E.applyMove(none, 'X', 0).reason, 'noquestion');
  E.setTriviaBank(bank(40));
  // a square from when each player had their own question: it keeps one of them and plays on
  const old = { type: 'trivia', right: { X: 1, O: 0 }, ask: { X: { id: 'q5', q: 'Question 5?', cat: 'Science', opts: ['a', 'b', 'c', 'd'] }, O: null }, answers: { X: 2, O: null }, asked: ['q1'], last: null };
  E.upgradeMini(old);
  assert.deepEqual([old.ask.id, old.answer, old.crossed, old.answers], ['q5', 2, [], undefined]);
  assert.equal(E.applyMove(old, 'O', 2).note, 'right');
});
