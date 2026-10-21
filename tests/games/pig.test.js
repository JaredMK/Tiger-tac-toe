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
// The die and the target are settings (config/pig): most tests below play the original d6 to 21; the
// defaults (a d8 to 51) have tests of their own at the end.
E.setPigConfig({ sides: 6, target: 21 });
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

test('Risky Rolls by default: an 8-sided die and 51 to win, copied into the square as dealt', () => {
  E.setPigConfig(null);
  try {
    const m = mini('pig');
    assert.equal(m.sides, 8); assert.equal(m.target, 51);
    assert.deepEqual([E.PIG_DEFAULTS.sides, E.PIG_DEFAULTS.target], [8, 51]);
    assert.equal(E.publicMini(m).sides, 8); assert.equal(E.publicMini(m).target, 51);
    const d8 = (...faces) => seq(...faces.map(n => pick(n - 1, 8)));
    assert.equal(L.applyMove(m, 'X', 'roll', d8(8)).again, true);
    assert.deepEqual(m.turn.rolls, [8], 'an 8 comes up on a d8');
    for (const n of [7, 1, 2, 3, 4, 5]) assert.equal(L.applyMove(m, 'X', 'roll', d8(n)).again, true);
    assert.equal(m.turn.rolls.length, 7);
    assert.equal(L.applyMove(m, 'X', 'roll', d8(6)).again, true, 'all eight numbers once: 8 rolls');
    assert.equal(L.applyMove(m, 'X', 'roll', d8(6)).reason, 'maxrolls', 'a ninth roll could only bust');
    assert.equal(L.applyMove(m, 'X', 'bank').outcome, 'continue', '36 banked');
    assert.equal(L.applyMove(m, 'X', 'roll', d8(3)).again, true);
    assert.equal(L.applyMove(m, 'X', 'roll', d8(3)).note, 'bust', 'a repeat still busts');
    m.bank.O = 45;
    L.applyMove(m, 'O', 'roll', d8(6));
    assert.equal(L.applyMove(m, 'O', 'bank').outcome, 'win', '45 + 6 = 51 wins');
    // an older square (no die, no target recorded) plays on as it was: a d6 to 21
    const old = { type: 'pig', bank: { X: 20, O: 0 }, turn: null, last: null };
    assert.equal(E.pigSides(old), 6); assert.equal(E.pigGoal(old), 21);
    L.applyMove(old, 'X', 'roll', die(1));
    assert.equal(L.applyMove(old, 'X', 'bank').outcome, 'win');
    // the settings, checked
    E.setPigConfig({ sides: 6, target: 30 }); assert.deepEqual([mini('pig').sides, mini('pig').target], [6, 30]);
    E.setPigConfig({ sides: 7, target: 5 }); assert.deepEqual([mini('pig').sides, mini('pig').target], [8, 51], 'out of range: the defaults');
  } finally { E.setPigConfig({ sides: 6, target: 21 }); }
});

test('Risky Rolls with a d8: the computer banks around 12 (its best pot) and needs about 6 turns to 51', () => {
  E.setPigConfig(null);
  try {
    const rng = lcg(5);
    let turns = 0, games = 0;
    for (let g = 0; g < 200; g++) {
      const m = mini('pig', rng);
      let n = 0;
      while (m.bank.X < 51 && n < 60) {
        n++;
        for (let k = 0; k < 12; k++) {
          const b = E.localBest(E.publicMini(m), 'X', rng, E.STYLE0, {});
          const r = L.applyMove(m, 'X', b.move, rng);
          assert.equal(r.ok, true);
          if (!r.again) break;
        }
      }
      turns += n; games++;
    }
    const avg = turns / games;
    assert.ok(avg > 5 && avg < 7.5, 'turns to 51: ' + avg.toFixed(2));
    const pm = { type: 'pig', bank: { X: 0, O: 0 }, turn: { by: 'X', rolls: [5, 7], pot: 12 }, sides: 8, target: 51 };
    assert.equal(E.localBest(pm, 'X', rng, E.STYLE0, {}).move, 'bank', 'a pot of 12 is banked');
    pm.turn = { by: 'X', rolls: [2, 3], pot: 5 };
    assert.equal(E.localBest(pm, 'X', rng, E.STYLE0, {}).move, 'roll');
  } finally { E.setPigConfig({ sides: 6, target: 21 }); }
});

test('risky rolls: the computer\'s banking setting is dealt into the square and played by', () => {
  E.setTune('pig', { risk: 8 });
  const m = E.newMini('pig', E.makeRng('pig-tune'));
  E.setTune('pig', null);
  assert.deepEqual(m.tune, { risk: 8 });
  const at = (mini, pot) => { const pm = E.publicMini(mini); pm.turn = { by: 'X', rolls: [pot], pot }; return E.localBest(pm, 'X', E.makeRng('p')).move; };
  const plain = E.newMini('pig', E.makeRng('pig-tune'));
  assert.equal(at(plain, 8), 'roll'); assert.equal(at(plain, 12), 'bank', 'the usual: banks at 12 (a d8)');
  assert.equal(at(m, 12), 'roll', 'banks later');
});

test('Risky Rolls: the Hard computer plays the exact race (a d8 to 51): its table built in bounded slices, the bank or roll the rule misses, its prediction borne out in play', () => {
  const A = require('../../src/games/pig/ai.js'), ctx = { level: 'hard', until: null };
  E.setPigConfig(null);
  try {
    let e, calls = 0;
    do { const t0 = performance.now(); e = A.pigRace(8, 51, null); assert.ok(performance.now() - t0 < 60, 'a slice under 60 ms'); calls++; } while (!e.done && calls < 100);
    assert.ok(e.done && calls <= 20, 'the table within a few calls: ' + calls);
    assert.ok(e.P[0] > 0.55 && e.P[0] < 0.62, 'the first to roll wins about 59% from 0-0: ' + e.P[0].toFixed(3));
    assert.ok(e.P[50 * 51 + 0] > 0.99 && e.P[0 * 51 + 50] < 0.05, 'one point short against none, and the other way');
    const pm = (a, b, rolls) => ({ type: 'pig', bank: { X: a, O: b }, turn: { by: 'X', rolls, pot: rolls.reduce((x, y) => x + y, 0) }, sides: 8, target: 51 });
    const hard = (a, b, rolls, style) => A.best(pm(a, b, rolls), 'X', lcg(3), style || {}, ctx).move, rule = (a, b, rolls) => A.best(pm(a, b, rolls), 'X', lcg(3), {}, {}).move;
    assert.equal(hard(0, 0, [3, 5]), 'roll'); assert.equal(hard(0, 0, [1, 2, 3, 4, 5]), 'bank'); assert.equal(hard(40, 0, [8, 3]), 'bank', 'the square: q 1');
    assert.equal(hard(44, 0, [2, 3]), 'bank', 'well ahead, a small pot banks: a bust would cost the turn'); assert.equal(rule(44, 0, [2, 3]), 'roll', '(the rule rolls on)');
    assert.equal(hard(10, 48, [5, 6, 7]), 'roll', 'the other side a roll from the square: 28 banked would not do'); assert.equal(rule(10, 48, [5, 6, 7]), 'bank', '(the rule banks)');
    assert.equal(hard(30, 30, [1, 2, 3]), 'bank', 'three of eight numbers rolled: a bust costs the pot and the turn'); assert.equal(rule(30, 30, [1, 2, 3]), 'roll');
    assert.equal(hard(30, 30, [1, 2, 3], { rollRisk: 6 }), 'roll', 'a bolder style banks as if the pot were smaller'); assert.equal(hard(44, 0, [2, 3], { rollRisk: -3 }), 'bank');
    E.setTune('pig', { risk: 8 }); assert.equal(A.best(Object.assign(pm(30, 30, [1, 2, 3]), { tune: { risk: 8 } }), 'X', lcg(3), {}, ctx).move, 'roll', 'the admin\'s banks-later setting too'); E.setTune('pig', null);
    // a square played through: Hard against Hard from 0-0, the first to roll wins about as the table says; Hard against the rule, Hard wins more
    const play = (rng, sides) => { const m = E.newMini('pig', rng); let p = 'X', n = 0; for (;;) { const b = A.best(E.publicMini(m), p, rng, E.STYLE0, sides[p]); const r = E.applyMove(m, p, b.move, rng); assert.equal(r.ok, true); if (r.outcome === 'win') return p; if (!r.again) p = p === 'X' ? 'O' : 'X'; assert.ok(++n < 500); } };
    const rng = lcg(21);
    let first = 0; for (let g = 0; g < 300; g++) if (play(rng, { X: ctx, O: ctx }) === 'X') first++;
    assert.ok(first > 150 && first < 205, 'the first to roll won ' + first + ' of 300 (the table: ' + Math.round(300 * e.P[0]) + ')');
    let hardWins = 0; for (let g = 0; g < 400; g++) { const side = g % 2 ? 'O' : 'X'; if (play(rng, { X: side === 'X' ? ctx : {}, O: side === 'O' ? ctx : {} }) === side) hardWins++; }
    assert.ok(hardWins > 200, 'Hard against the rule (about 54% over many): ' + hardWins + ' of 400');
    for (let k = 0; k < 5; k++) { const t0 = performance.now(); A.best(pm(12 + k, 20, [4, 7]), 'X', lcg(k), {}, ctx); assert.ok(performance.now() - t0 < 60, 'a Hard move under 60 ms'); }
    const t0 = performance.now(); A.best(Object.assign(pm(0, 0, [2]), { sides: 6, target: 21 }), 'X', lcg(1), {}, ctx); assert.ok(performance.now() - t0 < 60, 'a new table\'s first slice under 60 ms');
    assert.equal(A.best(Object.assign(pm(0, 0, [2]), { target: 200 }), 'X', lcg(1), {}, ctx).move, 'roll', 'a target too big for a table: the rule');
  } finally { E.setPigConfig({ sides: 6, target: 21 }); E.setTune('pig', null); }
});
