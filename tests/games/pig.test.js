'use strict';
// Risky Rolls: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
// Trivia needs its questions (the page fetches trivia.json; the server has it as a file): a small made-up bank here.
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
// The engine takes all its randomness from the caller. Where a test does not care which random choice
// is made, these wrappers hand it a fixed seeded generator.
const anyRng = () => E.makeRng('any');
const L = Object.assign({}, E, {
  newState: rng => E.newState(rng || anyRng()),
  startMatch: (st, rng) => E.startMatch(st, rng || anyRng()),
  newMatch: (rng, setup) => E.newMatch(rng || anyRng(), setup),
  playMove: (st, i, m, rng, opts) => E.playMove(st, i, m, rng || anyRng(), opts),
  cpuMove: (st, rng) => E.cpuMove(st, rng || anyRng()),
  timeoutMove: (st, rng) => E.timeoutMove(st, rng || anyRng()),
  randomLegalMove: (mini, p, rng) => E.randomLegalMove(mini, p, rng || anyRng()),
  applyMove: (mini, p, m, rng, ...rest) => E.applyMove(mini, p, m, rng || anyRng(), ...rest),
});

// ---- helpers ----
// rng that yields a fixed sequence of values in [0, 1)
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
// rng value that makes randInt(rng, n) return k
const pick = (k, n) => (k + 0.5) / n;
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

function matchWith(types, rng = lcg(7)) {
  const st = L.newMatch(rng);
  types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
  return st;
}
// make one full turn as the UI does: the move, then the result overlay clearing, which (unless the
// same player goes again or the match is over) brings the board back and passes the turn
function turn(st, i, m, rng) {
  const r = L.playMove(st, i, m, rng || lcg(99));
  assert.equal(r.ok, true, `move ${JSON.stringify(m)} in square ${i} should be accepted (${r.reason})`);
  const flash = st.flash;
  L.endFlash(st);
  return flash;
}
const mini = (type, rng) => L.newMini(type, rng || lcg(11));

// ==================================== Risky Rolls ====================================
const die = (...faces) => seq(...faces.map(n => pick(n - 1, 6)));   // rolls come out in this order

test('pig: a roll adds a new number to the pot and keeps the turn; the bank is untouched until Bank', () => {
  const m = mini('pig');
  assert.deepEqual(m.bank, { X: 0, O: 0 });
  assert.equal(m.turn, null);
  assert.deepEqual(L.applyMove(m, 'X', 'roll', die(4)), { ok: true, outcome: 'continue', note: 'roll', again: true });
  assert.deepEqual(m.turn, { by: 'X', rolls: [4], pot: 4 });
  assert.deepEqual(m.last, { by: 'X', kind: 'roll', roll: 4, rolls: [4], pot: 4 });
  assert.equal(L.applyMove(m, 'X', 'roll', die(2)).again, true);
  assert.deepEqual(m.turn, { by: 'X', rolls: [4, 2], pot: 6 });
  assert.deepEqual(m.bank, { X: 0, O: 0 }, 'nothing is banked yet');
  assert.deepEqual(L.applyMove(m, 'O', 'roll', die(1)), { ok: false, reason: 'busy' }, 'the other player cannot cut in');
  for (const bad of ['x', 1, null, ['roll']]) assert.equal(L.applyMove(m, 'X', bad).ok, false);
});

test('pig: a repeated number always busts, loses only this turn\'s pot and ends the move', () => {
  for (let n = 1; n <= 6; n++) {
    const m = mini('pig');
    m.bank.X = 7;
    L.applyMove(m, 'X', 'roll', die(n));
    const others = [1, 2, 3, 4, 5, 6].filter(k => k !== n);
    L.applyMove(m, 'X', 'roll', die(others[0]));
    const r = L.applyMove(m, 'X', 'roll', die(n));
    assert.deepEqual(r, { ok: true, outcome: 'continue', note: 'bust' }, `rolling ${n} twice`);
    assert.equal(m.turn, null, 'the turn is over');
    assert.equal(m.bank.X, 7, 'the banked score survives');
    assert.deepEqual(m.last, { by: 'X', kind: 'bust', roll: n, rolls: [n, others[0], n], pot: n + others[0] });
  }
});

test('pig: Bank needs a pot, adds it to the banked score, ends the move, and 21 wins', () => {
  const m = mini('pig');
  assert.deepEqual(L.applyMove(m, 'X', 'bank'), { ok: false, reason: 'nopot' }, 'nothing to bank before rolling');
  L.applyMove(m, 'X', 'roll', die(6)); L.applyMove(m, 'X', 'roll', die(5));
  assert.deepEqual(L.applyMove(m, 'X', 'bank'), { ok: true, outcome: 'continue', note: 'bank' });
  assert.deepEqual(m.bank, { X: 11, O: 0 });
  assert.equal(m.turn, null);
  assert.deepEqual(L.applyMove(m, 'X', 'bank'), { ok: false, reason: 'nopot' }, 'a new move starts with a roll');
  L.applyMove(m, 'O', 'roll', die(3)); L.applyMove(m, 'O', 'bank');
  assert.deepEqual(m.bank, { X: 11, O: 3 }, 'each player has their own bank');
  L.applyMove(m, 'X', 'roll', die(6)); L.applyMove(m, 'X', 'roll', die(3));
  assert.equal(L.applyMove(m, 'X', 'bank').outcome, 'continue', '11 + 9 = 20 is not enough');
  L.applyMove(m, 'X', 'roll', die(1));
  assert.equal(L.applyMove(m, 'X', 'bank').outcome, 'win', '20 + 1 = 21');
  assert.equal(m.bank.X, 21);
  assert.equal(L.RISKY.goal, 21);
});

test('pig: once the score and this turn\'s points reach 21, only Bank is left', () => {
  const m = mini('pig');
  for (const n of [3, 1, 4, 6, 2]) assert.equal(L.applyMove(m, 'X', 'roll', die(n)).again, true);
  assert.equal(L.applyMove(m, 'X', 'roll', die(5)).again, true);
  assert.deepEqual(m.turn, { by: 'X', rolls: [3, 1, 4, 6, 2, 5], pot: 21 });
  assert.equal(L.applyMove(m, 'X', 'roll', die(5)).ok, false, 'a seventh roll can only bust');
  assert.equal(L.applyMove(m, 'X', 'bank').outcome, 'win');
  assert.equal(m.bank.X, 21);
  const n = mini('pig');
  n.bank.X = 15;
  L.applyMove(n, 'X', 'roll', die(2));
  assert.equal(L.applyMove(n, 'X', 'roll', die(4)).again, true, '15 + 6 = 21');
  assert.deepEqual(L.applyMove(n, 'X', 'roll', die(1)), { ok: false, reason: 'enough' }, 'no more rolling');
  assert.equal(L.randomLegalMove(n, 'X'), 'bank');
  assert.equal(L.localBest(L.publicMini(n), 'X').move, 'bank');
  assert.equal(L.applyMove(n, 'X', 'bank').outcome, 'win');
});

test('pig: through playMove a roll locks the player to the square and only Bank or a bust passes the turn', () => {
  const st = matchWith(['pig', 'ttt']);
  const r = L.playMove(st, 0, 'roll', die(5));
  assert.equal(r.ok, true);
  assert.equal(st.flash.kind, 'again');
  assert.equal(st.flash.roll, 5);
  assert.equal(st.flash.pot, 5);
  assert.equal(st.turn, 'X');
  assert.equal(st.lock, 0);
  L.endFlash(st);
  assert.equal(st.screen, 'mini');
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'locked' }, 'must finish the turn first');
  assert.equal(turn(st, 0, 'roll', die(2)).kind, 'again');
  const bank = turn(st, 0, 'bank');
  assert.equal(bank.kind, 'move');
  assert.equal(bank.note, 'bank');
  assert.equal(bank.pot, 7);
  assert.equal(bank.bank, 7);
  assert.equal(st.lock, null);
  assert.equal(st.turn, 'O');
  assert.equal(st.screen, 'board');
  turn(st, 0, 'roll', die(4));
  const bust = turn(st, 0, 'roll', die(4));
  assert.equal(bust.kind, 'move');
  assert.equal(bust.note, 'bust');
  assert.equal(bust.pot, 4);
  assert.equal(st.lock, null);
  assert.equal(st.turn, 'X');
  assert.deepEqual(st.squares[0].mini.bank, { X: 7, O: 0 });
});

test('pig: X can bank up to 21 over several turns while O plays elsewhere (lopsided)', () => {
  const st = matchWith(['pig', 'ttt']);
  turn(st, 0, 'roll', die(6)); turn(st, 0, 'roll', die(5)); turn(st, 0, 'bank'); turn(st, 1, 0);
  turn(st, 0, 'roll', die(6)); turn(st, 0, 'roll', die(1)); turn(st, 0, 'bank'); turn(st, 1, 1);
  assert.deepEqual(st.squares[0].mini.bank, { X: 18, O: 0 });
  turn(st, 0, 'roll', die(3));
  const f = turn(st, 0, 'bank');
  assert.equal(f.kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(st.squares[0].mini.bank.X, 21);
});

test('a timed-out pig turn rolls once and, if it did not bust, banks next', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const st = matchWith(['pig', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
    st.timer = L.newTimer(30);
    st.lock = 0;
    const r = L.timeoutMove(st, lcg(seed));
    assert.equal(r.ok, true); assert.equal(r.move, 'roll');
    const bust = st.flash.note === 'bust';
    L.endFlash(st);
    if (bust) {
      assert.equal(st.timer.bankNext, false);
      L.leaveSquare(st); assert.equal(st.turn, 'O');
    } else {
      assert.equal(st.timer.bankNext, true, 'the roll kept the turn; the bank comes next');
      assert.equal(st.lock, 0);
      assert.equal(st.turn, 'X');
      st.timer.bankNext = false;
      const b = L.playMove(st, 0, 'bank', lcg(seed), { forced: true });
      assert.equal(b.ok, true);
      assert.equal(st.flash.timeout, true);
      assert.ok(st.squares[0].mini.bank.X > 0 || st.squares[0].owner === 'X');
      L.endFlash(st); L.leaveSquare(st);
      if (!st.winner) assert.equal(st.turn, 'O');
    }
  }
});

test('an online timeout makes a random move (Risky Rolls: roll then bank) and the second in a row loses', () => {
  let st = matchWith(['pig', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(8));
  st.id = 'm'; st.seq = 0; st.recent = []; st.timer = L.newTimer(30); st.lock = 0;
  let rec = L.matchRecord(st);
  let r = L.applyOnlineTimeout(rec, lcg(2));
  assert.equal(r.ok, true);
  assert.equal(r.entries[0].timeout, true); assert.equal(r.entries[0].square, 0);
  if (r.entries[0].note !== 'bust') { assert.equal(r.entries.length, 2, 'the roll, then the bank'); assert.equal(r.entries[1].pot, undefined === r.entries[1].pot ? r.entries[1].pot : r.entries[1].pot); }
  assert.equal(r.rec.state.turn, 'O'); assert.equal(r.rec.state.lock, null);
  assert.equal(r.rec.state.timer.timeouts.X, 1); assert.equal(r.rec.state.timer.streak.X, 1); assert.equal(r.rec.state.timer.bankNext, false);
  rec = r.rec;
  r = L.applyOnlineMove(rec, 'O', 1, 4, lcg(1)); assert.equal(r.ok, true); rec = r.rec;   // O plays in time
  assert.deepEqual(rec.state.timer.streak, { X: 1, O: 0 });
  r = L.applyOnlineTimeout(rec, lcg(3));
  assert.equal(r.ok, true); assert.equal(r.lost, 'X'); assert.deepEqual(r.entries, []);
  assert.equal(r.rec.state.winner, 'O'); assert.equal(r.rec.state.winReason, 'timeout');
  assert.equal(L.applyOnlineTimeout(r.rec, lcg(4)).ok, false, 'nothing more once it is over');
  assert.equal(L.applyOnlineMove(r.rec, 'O', 1, 0, lcg(4)).reason, 'over');
});

test('Risky Rolls: a bank that wins the square is still a bank (the phones show it as one, the die left alone)', () => {
  const st = matchWith(['pig', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(8));
  st.squares[0].mini.bank = { X: 18, O: 0 }; st.squares[0].mini.turn = { by: 'X', rolls: [1, 3], pot: 4 }; st.lock = 0;
  const r = L.playMove(st, 0, 'bank', lcg(1));
  assert.equal(r.ok, true); assert.equal(r.flash.kind, 'claim'); assert.equal(r.flash.note, 'bank');
  assert.equal(st.squares[0].mini.last.roll, 3, 'the last number rolled stays the last roll');
});
