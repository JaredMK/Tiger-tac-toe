'use strict';
// Seating (reworked November 2026): its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const A = require('../../src/games/seating/ai.js');
const R = require('../../src/games/seating/rules.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
// A square laid out by hand: n tables, the seats' colours, the occupants and the next customer's colour.
function laid(color, who, next, score) {
  const m = E.newMini('seating', lcg(1));
  m.color = color.slice(); m.who = who.slice(); m.next = next; m.score = Object.assign({ X: 0, O: 0 }, score || {});
  return m;
}

test('seating: 15 tables for two in four colours by default, nobody seated, a next customer with a seat of their colour; the settings are the admin\'s', () => {
  const m = E.newMini('seating', lcg(1));
  assert.equal(m.color.length, 30); assert.ok(m.color.every(c => c >= 0 && c < 4)); assert.ok(m.color.includes(m.next));
  assert.deepEqual(m.score, { X: 0, O: 0 }); assert.equal(m.v, 2); assert.ok(m.who.every(w => w === null));
  E.setTune('seating', { tables: 9, colors: 2 });
  try { const t = E.newMini('seating', lcg(2)); assert.equal(t.color.length, 18); assert.ok(t.color.every(c => c < 2)); } finally { E.setTune('seating', null); }
});

test('seating: a seat only at a table nobody is at; the customer across from a player scores them 1, at an empty table a second customer closes it, with no seat of their colour they leave', () => {
  // tables: 0 [X, empty(c0)], 1 [O, empty(c1)], 2 [empty c0, empty c2], 3 [empty c3, empty c3]
  const base = () => laid([2, 0, 2, 1, 0, 2, 3, 3], ['X', null, 'O', null, null, null, null, null], 0);
  const m = base();
  assert.equal(E.applyMove(m, 'O', 1, lcg(1)).ok, false, 'never a seat at a table someone is at');
  assert.equal(E.applyMove(m, 'O', 0, lcg(1)).ok, false, 'never a seat taken');
  // O sits at table 3; the customer (colour 0) has two seats of their colour: across from X (seat 1) or table 2's (seat 4)
  let across = 0, pair = 0;
  for (let k = 0; k < 60; k++) {
    const t = base(), r = E.applyMove(t, 'O', 6, E.makeRng('seat' + k));
    assert.ok(r.ok);
    if (t.last.scorer) { across++; assert.equal(t.last.scorer, 'X'); assert.equal(t.score.X, 1); assert.equal(t.who[1], 'Z'); assert.equal(t.last.z2, null); }
    else { pair++; assert.deepEqual([t.who[4], t.who[5], t.last.z, t.last.z2], ['Z', 'Z', 4, 5], 'an empty table: a second customer takes the other seat'); assert.deepEqual(t.score, { X: 0, O: 0 }); }
    assert.equal(t.who[6], 'O'); assert.equal(t.who[7], null, 'the mover\'s seat stays waiting');
  }
  assert.ok(across > 10 && pair > 10, `both outcomes come up (${across}/${pair})`);
  // the move takes the last seat of the customer's colour: they leave
  const l = laid([0, 1, 1, 1, 1, 1], [null, null, null, null, null, null], 0);
  const r = E.applyMove(l, 'X', 0, lcg(1));
  assert.deepEqual([r.ok, l.last.left, l.last.z, l.score.X], [true, true, null, 0]);
  assert.ok(l.color.some((c, i) => !l.who[i] && c === l.next), 'the next colour has a seat');
});

test('seating: the end: no table left to sit at, higher score wins (the seats still waiting score nothing), level resets; or at once when the side behind cannot catch up', () => {
  // the last free table taken: X 2, O 1, nothing else to sit at
  const m = laid([0, 1, 2, 2], ['X', 'Z', null, null], 1, { X: 2, O: 1 });
  const r = E.applyMove(m, 'O', 2, lcg(1));
  assert.ok(r.ok); assert.equal(r.outcome, 'win'); assert.equal(r.winner, 'X'); assert.equal(r.note, 'full');
  const d = laid([0, 1, 2, 2], ['X', 'Z', null, null], 1, { X: 1, O: 1 });
  assert.deepEqual([E.applyMove(d, 'X', 2, lcg(1)).outcome], ['draw'], 'level: the square resets');
  // decided early: O 0 with nothing waiting and one table left, X 3: O could reach at most 1
  const e = laid([0, 0, 1, 1, 2, 2], ['X', 'Z', 'Z', 'Z', null, null], 3, { X: 3, O: 0 });
  assert.equal(R.seatEnd(e.who, e.score).winner, 'X');
  const f = laid([0, 0, 1, 1, 2, 2, 3, 3], [null, null, null, null, null, null, null, null], 0, { X: 2, O: 0 });
  assert.equal(R.seatEnd(f.who, f.score), null, 'four tables left: O can still catch up');
});

test('seating: the public view, the flash and the replay carry the move, the customer and the next colour; a timeout plays nothing', () => {
  const st = E.newMatch(lcg(3), { games: ['seating'] }), p = st.turn, i = 4;
  const mini = st.squares[i].mini, seat = R.seatMoves(mini.who)[0];
  const r = E.playMove(st, i, seat, lcg(4));
  assert.ok(r.ok);
  const f = st.flash.seat;
  assert.deepEqual(Object.keys(f).sort(), ['by', 'c', 'left', 'next', 'score', 'scorer', 'seat', 'z', 'z2'].sort());
  assert.equal(f.seat, seat); assert.equal(f.by, p);
  assert.ok(E.playMs(st.flash) >= R.seatTimes(f).end);
  const pub = E.publicMini(mini);
  assert.deepEqual(Object.keys(pub).sort(), ['color', 'next', 'score', 'type', 'v', 'who']);
});

test('seating: the computer: Normal sits where the customer at the door is likeliest to sit across from it and least to score the other side; Easy any free seat; Hard a legal seat, quickly', () => {
  // the next customer is colour 0. Table 0: X waiting across a colour-0 seat. Free tables: 1 (seats c1 | c0), 2 (c2 | c2).
  const m = laid([3, 0, 1, 0, 2, 2], ['X', null, null, null, null, null], 0);
  const pm = E.publicMini(m);
  // O at seat 2 (c1): the customer's seats are X's waiting one and seat 3, across from O: even. Seat 3 (c0): X's is the
  // only one left, X scores. A table-2 seat: X's 1 in 2. Normal takes seat 2.
  assert.equal(E.localBest(pm, 'O', lcg(1), {}, { level: 'normal' }).move, 2);
  assert.ok(A.seatNow(pm, 'O', 2) > A.seatNow(pm, 'O', 4));
  for (let k = 0; k < 20; k++) assert.ok(R.seatMoves(m.who).includes(E.localBest(pm, 'O', lcg(k), {}, { level: 'easy' }).move));
  const big = E.newMini('seating', lcg(9)), t0 = performance.now(), h = E.localBest(E.publicMini(big), 'X', lcg(2), {}, { level: 'hard', until: null });
  assert.ok(R.seatMoves(big.who).includes(h.move)); assert.ok(performance.now() - t0 < 400, 'Hard is quick');
  assert.ok(A.needs(E.publicMini(big), 'X') >= 1);
});

test('seating: whole squares between the computers end with a winner (an odd count of tables: a tie only when a customer has left) in about 4 to 6 moves for the winner', () => {
  let moves = 0, wins = 0, draws = 0;
  for (let g = 0; g < 200; g++) {
    const rng = E.makeRng('st' + g), m = E.newMini('seating', rng); let p = 'X'; const n = { X: 0, O: 0 };
    for (let k = 0; k < 60; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok); n[p]++;
      if (r.outcome !== 'continue') { if (r.outcome === 'draw') draws++; else { wins++; moves += n[r.winner]; } break; }
      p = p === 'X' ? 'O' : 'X';
    }
  }
  const avg = moves / wins;
  assert.ok(avg >= 4 && avg <= 6, `the winner's moves ${avg.toFixed(2)}`); assert.ok(draws < 20, `few ties (${draws})`);
});
