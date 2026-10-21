'use strict';
// Coin Flip: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

// ================================== Coin flip ==================================
const headsRng = sym => seq(pick(sym === 'X' ? 0 : 1, 2));   // every flip lands on sym
const coinsOf = (...c) => Object.assign(mini('coins'), { coins: c });

test('coins: five coins, two of each and one mystery coin, in random positions', () => {
  const rng = lcg(21);
  const orders = new Set();
  for (let k = 0; k < 200; k++) {
    const m = L.newMini('coins', rng);
    assert.equal(m.coins.length, L.COINS.n);
    assert.equal(L.COINS.n, 5);
    assert.equal(m.coins.filter(c => c === 'X').length, 2);
    assert.equal(m.coins.filter(c => c === 'O').length, 2);
    assert.equal(m.coins.filter(c => c === '?').length, 1);
    orders.add(m.coins.join(''));
  }
  assert.equal(orders.size, 30, 'every arrangement turns up');
});

test('coins: one Flip turns every coin that isn\'t yours when there are three or fewer, mystery coin included, never your own', () => {
  const m = coinsOf('X', 'O', 'X', '?', 'O');
  for (const bad of [[1], [1, 3, 4], 1, null, 'ab', 'bank']) assert.deepEqual(L.applyMove(m, 'X', bad), { ok: false, reason: 'bad' }, JSON.stringify(bad));
  assert.deepEqual(m.coins, ['X', 'O', 'X', '?', 'O'], 'rejected moves change nothing');
  assert.deepEqual(L.applyMove(m, 'X', 'flip', seq(pick(0, 2), pick(1, 2), pick(0, 2))), { ok: true, outcome: 'continue', note: 'flip' });
  assert.deepEqual(m.last, { by: 'X', flipped: [1, 3, 4], results: ['X', 'O', 'X'], was: ['O', '?', 'O'] }, 'both O coins and the mystery coin, landing as the rng says');
  assert.deepEqual(m.coins, ['X', 'X', 'X', 'O', 'X'], 'the mystery coin now shows a side like any other');
  const o = coinsOf('X', 'X', '?', 'X', 'O');
  assert.deepEqual(L.applyMove(o, 'O', 'flip', headsRng('O')).outcome, 'continue');
  assert.equal(o.last.flipped.length, 3, 'three of the four coins that aren\'t O\'s');
  assert.ok(o.last.flipped.every(k => k !== 4), 'never the flipper\'s own coin');
  const done = coinsOf('X', 'X', 'X', 'X', 'X');
  assert.deepEqual(L.applyMove(done, 'X', 'flip'), { ok: false, reason: 'none' }, 'nothing left to flip');
});

test('coins: with more than three coins that aren\'t yours, three are picked at random', () => {
  const picks = new Set();
  let mystery = 0;
  for (let k = 0; k < 80; k++) {
    const m = coinsOf('O', 'O', '?', 'O', 'X');
    const r = L.applyMove(m, 'X', 'flip', L.makeRng('coins' + k));
    assert.equal(r.ok, true);
    assert.equal(m.last.flipped.length, 3);
    assert.ok(m.last.flipped.every(i => i < 4), 'only coins that aren\'t X\'s');
    assert.equal(new Set(m.last.flipped).size, 3, 'three different coins');
    assert.equal(m.coins[4], 'X', 'X\'s own coin is untouched');
    if (m.last.flipped.includes(2)) mystery++; else assert.equal(m.coins[2], '?', 'an unflipped mystery coin stays a mystery');
    picks.add(m.last.flipped.join(''));
  }
  assert.equal(picks.size, 4, 'every three of the four');
  assert.ok(mystery > 30 && mystery < 80, `the mystery coin is picked like any other (${mystery} of 80)`);
});

test('coins: all five the same wins; a mystery coin still showing means no win yet', () => {
  const m = coinsOf('X', 'X', 'X', 'O', 'O');
  assert.equal(L.applyMove(m, 'O', 'flip', headsRng('O')).outcome, 'win', 'all three X coins land O');
  assert.deepEqual(m.coins, ['O', 'O', 'O', 'O', 'O']);
  const n = coinsOf('X', 'X', 'X', 'O', 'O');
  assert.equal(L.applyMove(n, 'O', 'flip', seq(pick(1, 2), pick(1, 2), pick(0, 2))).outcome, 'continue', 'one landed X: no win');
  const r = L.applyMove(n, 'O', 'flip', headsRng('O'));
  assert.equal(r.outcome, 'win');
  assert.equal(r.winner, 'O');
  assert.deepEqual(r.cells, [0, 1, 2, 3, 4]);
  // with no coin of their own, X's flip can land every coin O: the square goes to O
  const lose = coinsOf('O', 'O', '?', 'O', 'O');
  const rl = L.applyMove(lose, 'X', 'flip', seq(pick(1, 5), pick(0, 4), pick(0, 3), pick(1, 2)));
  assert.ok(lose.last.flipped.includes(2), 'the mystery coin was among the three');
  if (lose.coins.every(c => c === 'O')) { assert.equal(rl.outcome, 'win'); assert.equal(rl.winner, 'O'); }
  const forced = coinsOf('O', 'O', '?', 'O', 'O');
  let gave = 0;
  for (let k = 0; k < 200; k++) {
    const c = coinsOf(...forced.coins);
    const rr = L.applyMove(c, 'X', 'flip', lcg(k + 3));
    if (rr.outcome === 'win') { assert.equal(rr.winner, 'O'); gave++; }
  }
  assert.ok(gave > 3 && gave < 35, `about 3 in 40 flips hand O the square (${gave} of 200)`);
});

test('coins: the computer knows the chance of winning, and of handing the square over', () => {
  assert.deepEqual(L.localBest(L.publicMini(coinsOf('X', 'X', 'X', 'O', '?')), 'X'), { move: 'flip', q: 0.25, qLose: 0 });
  assert.deepEqual(L.localBest(L.publicMini(coinsOf('X', 'O', 'O', 'O', '?')), 'X'), { move: 'flip', q: 0, qLose: 0 });
  const l = L.localBest(L.publicMini(coinsOf('O', 'O', 'O', 'O', '?')), 'X');
  assert.equal(l.q, 0); assert.ok(Math.abs(l.qLose - 0.075) < 1e-9, '3 in 5 the mystery coin is picked, then all three land O');
  assert.equal(L.needsOf(L.publicMini(coinsOf('X', 'X', 'O', 'O', '?')), 'X'), L.COIN_NEEDS[3], 'the mystery coin counts as not yet mine');
});

test('coins: X can keep flipping across turns and claim the square while O plays elsewhere (lopsided)', () => {
  const st = matchWith(['coins', 'ttt']);
  st.squares[0].mini = coinsOf('O', 'O', '?', 'O', 'X');
  turn(st, 0, 'flip', seq(pick(0, 4), pick(0, 3), pick(0, 2), pick(0, 2))); turn(st, 1, 0);
  assert.equal(st.squares[0].mini.coins.filter(c => c === 'X').length, 4, 'three coins turned X');
  const f = turn(st, 0, 'flip', headsRng('X'));
  assert.equal(f.kind, 'claim');
  assert.equal(f.winner, 'X');
  assert.equal(f.n, 1, 'only one coin was left to flip');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(L.canMove(st.squares[0].mini, 'O'), true);
});

// ============================== Coin flip marks ==============================
test('coins: the coins a flip will turn are picked and marked as the turn starts, and exactly those flip', () => {
  let checked = 0;
  for (let g = 0; g < 150; g++) {
    const rng = L.makeRng('cm' + g);
    const st = L.newMatch(rng, { games: ['coins', 'ttt'] });
    const coinSq = () => st.squares.map((s, i) => (!s.owner && s.mini.type === 'coins' ? i : -1)).filter(i => i >= 0);
    for (const i of coinSq()) assert.equal(st.squares[i].mini.marks.by, 'X', 'marked for X as the match starts');
    for (let n = 0; n < 60 && !st.winner; n++) {
      const p = st.turn;
      for (const i of coinSq()) {
        const mk = st.squares[i].mini.marks;
        assert.equal(mk.by, p, 'marked for the player whose turn it is');
        assert.deepEqual(mk.coins, L.coinMarksFor(st.squares[i].mini, p), 'a full, valid set');
      }
      const open = coinSq();
      const i = open.length && rng() < 0.6 ? open[0] : st.squares.findIndex(s => !s.owner && s.mini.type === 'ttt');
      if (i < 0) break;
      const sq = st.squares[i];
      if (sq.mini.type !== 'coins') { turn(st, i, sq.mini.cells.findIndex(x => !x), rng); continue; }
      const marked = sq.mini.marks.coins.slice();
      turn(st, i, 'flip', rng);
      assert.deepEqual(sq.mini.last.flipped, marked, 'the marked coins are exactly the ones flipped');
      checked++;
    }
  }
  assert.ok(checked > 1000, `${checked} flips checked`);
  // fresh each turn: with more than three coins to pick from, an untouched square shows new marks the next turn
  const st = L.newMatch(lcg(5), { games: ['ttt'] });
  st.squares[0].mini = Object.assign(mini('coins'), { coins: ['O', 'O', '?', 'O', 'X'] });
  const sets = new Set();
  for (let k = 0; k < 40; k++) {
    st.turn = 'O'; turn(st, 1, 4, L.makeRng('o' + k));
    assert.equal(st.turn, 'X');
    sets.add(JSON.stringify(st.squares[0].mini.marks.coins));
    st.squares[1] = { owner: null, mini: mini('ttt') };
  }
  assert.ok(sets.size > 1, `new marks each turn (${[...sets].join(' ')})`);
});

test('coins: marks survive the online record, and the computer reads its exact odds from them', () => {
  const st = L.newMatch(lcg(8), { games: ['coins'] });
  st.id = 'c'; st.seq = 0; st.recent = [];
  const rec = L.matchRecord(st);
  assert.deepEqual(rec.state.squares[0].mini.marks, st.squares[0].mini.marks, 'public, kept in the shared state');
  const m = Object.assign(mini('coins'), { coins: ['X', 'X', 'O', 'O', '?'], marks: { by: 'X', coins: [2, 3, 4] } });
  assert.deepEqual(L.localBest(L.publicMini(m), 'X'), { move: 'flip', q: 0.125, qLose: 0 });
  const n = Object.assign(mini('coins'), { coins: ['X', 'O', 'O', 'O', '?'], marks: { by: 'X', coins: [1, 2, 3] } });
  assert.deepEqual(L.localBest(L.publicMini(n), 'X'), { move: 'flip', q: 0, qLose: 0 }, 'the mystery coin stays: no win this flip');
  const o = Object.assign(mini('coins'), { coins: ['O', 'O', 'O', '?', 'O'], marks: { by: 'X', coins: [0, 1, 3] } });
  assert.deepEqual(L.localBest(L.publicMini(o), 'X'), { move: 'flip', q: 0, qLose: 0.125 }, 'all landing O hands it over');
  const bad = Object.assign(mini('coins'), { coins: ['X', 'X', 'O', 'O', '?'], marks: { by: 'X', coins: [0, 2, 3] } });
  assert.equal(L.coinMarksFor(bad, 'X'), null, 'marks on your own coin are not used');
});

test('coins: the admin settings deal seven coins and flip up to four (the marks and the computer follow)', () => {
  E.setTune('coins', { n: 7, flips: 4 });
  try {
    const st = L.newState(); st.squares[0].mini = L.newMini('coins', lcg(4));
    const m = st.squares[0].mini;
    assert.equal(m.coins.length, 7); assert.deepEqual(m.tune, { n: 7, flips: 4 });
    assert.deepEqual(['X', 'O', '?'].map(s => m.coins.filter(c => c === s).length), [3, 3, 1]);
    L.markCoins(st, 'X', lcg(5));
    assert.equal(m.marks.coins.length, 4); assert.deepEqual(L.coinMarksFor(m, 'X'), m.marks.coins);
    assert.equal(L.applyMove(m, 'X', 'flip', lcg(6)).ok, true); assert.equal(m.last.flipped.length, 4);
    assert.equal(L.localBest(L.publicMini(m), 'O', lcg(7)).move, 'flip');
    assert.ok(E.needsOf(L.publicMini(m), 'O') > 0);
  } finally { E.setTune('coins', null); }
  assert.equal(L.newMini('coins', lcg(4)).coins.length, 5);
});
