'use strict';
// Mastermind: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

function matchWith(types, rng = lcg(7)) {
  const st = L.newMatch(rng);
  types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
  return st;
}

// ================================ Computer player ================================
const cpuRng = () => lcg(314);

// ================================ Mastermind ================================
const mmMini = code => ({ type: 'mastermind', code, guesses: [] });

test('mastermind: feedback against known examples, including all the right colours in all the wrong spots', () => {
  const code = [0, 1, 2, 3];
  const cases = [
    [[0, 1, 2, 3], 4, 0, 'exact'],
    [[1, 0, 3, 2], 0, 4, 'all four colours, every one in the wrong spot'],
    [[3, 2, 1, 0], 0, 4, 'reversed: all wrong spots'],
    [[1, 2, 3, 0], 0, 4, 'rotated: all wrong spots'],
    [[0, 1, 3, 2], 2, 2, 'two right, two swapped'],
    [[0, 4, 5, 1], 1, 1, 'one right spot, one wrong spot'],
    [[4, 5, 0, 1], 0, 2, 'two colours, both misplaced'],
    [[4, 5, 2, 3], 2, 0, 'two right in place, two absent'],
    [[0, 5, 4, 3], 2, 0],
    [[5, 4, 1, 0], 0, 2],
  ];
  for (const [g, solid, hollow, why] of cases) assert.deepEqual(L.mmFeedback(g, code), { solid, hollow }, `${JSON.stringify(g)} ${why || ''}`);
  // with only 6 colours and 4 pegs, at least two of any guess's colours are in the code
  for (const g of L.mmAll()) { const f = L.mmFeedback(g, code); assert.ok(f.solid + f.hollow >= 2 && f.solid + f.hollow <= 4); }
  // the markers are symmetric in count: guess vs code and code vs guess give the same result
  const rng = lcg(4);
  for (let k = 0; k < 200; k++) { const a = L.mmAll()[Math.floor(rng() * 360)], b = L.mmAll()[Math.floor(rng() * 360)]; assert.deepEqual(L.mmFeedback(a, b), L.mmFeedback(b, a)); }
});

test('mastermind: a hidden code of 4 different colours from 6; guesses must be 4 different colours too', () => {
  assert.deepEqual(L.MM, { pegs: 4, colors: 6 });
  assert.equal(L.mmAll().length, 360, '6 x 5 x 4 x 3 codes');
  const rng = lcg(9);
  for (let k = 0; k < 50; k++) {
    const m = L.newMini('mastermind', rng);
    assert.equal(m.code.length, 4); assert.equal(new Set(m.code).size, 4, 'no repeated colour');
    assert.ok(m.code.every(c => c >= 0 && c < 6));
  }
  const m = mmMini([0, 1, 2, 3]);
  for (const bad of [[0, 0, 1, 2], [0, 1, 2], [0, 1, 2, 3, 4], [0, 1, 2, 6], [-1, 1, 2, 3], 'RGBY', [0, 1, 2, 3.5]]) {
    assert.deepEqual(L.applyMove(m, 'X', bad), { ok: false, reason: 'bad' }, JSON.stringify(bad));
  }
  assert.equal(m.guesses.length, 0, 'refused guesses leave nothing behind');
  assert.ok(L.defaultSetup().games.mastermind, 'on by default in the Advanced list');
  assert.ok(L.TYPES.includes('mastermind'));
});

test('mastermind: guesses and feedback stay on record; whoever guesses the exact code wins', () => {
  const st = matchWith(['mastermind', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = mmMini([5, 2, 0, 4]);
  let r = L.playMove(st, 0, [0, 1, 2, 3], lcg(1));
  assert.equal(r.ok, true); assert.equal(st.flash.kind, 'move');
  assert.deepEqual([st.flash.solid, st.flash.hollow], [0, 2]);
  assert.deepEqual(st.flash.code, [0, 1, 2, 3]);
  L.endFlash(st);
  assert.equal(st.turn, 'O');
  r = L.playMove(st, 0, [5, 2, 4, 0], lcg(1));               // O: close, not exact
  assert.equal(st.flash.kind, 'move'); assert.deepEqual([st.flash.solid, st.flash.hollow], [2, 2]);
  L.endFlash(st);
  r = L.playMove(st, 0, [5, 2, 0, 4], lcg(1));               // X cracks it
  assert.equal(r.ok, true); assert.equal(st.flash.kind, 'claim'); assert.equal(st.squares[0].owner, 'X');
  assert.deepEqual(st.squares[0].mini.guesses.map(g => [g.by, g.solid, g.hollow]), [['X', 0, 2], ['O', 2, 2], ['X', 4, 0]]);
});

test('mastermind: the code never leaves the hidden part until it is cracked', () => {
  const st = matchWith(['mastermind', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = mmMini([5, 2, 0, 4]);
  L.playMove(st, 0, [0, 1, 2, 3], lcg(1)); L.endFlash(st);
  const pm = L.publicMini(st.squares[0].mini);
  assert.ok(!('code' in pm)); assert.equal(pm.guesses.length, 1);
  st.id = 'm'; st.seq = 0; st.recent = [];
  const rec = L.matchRecord(st);
  assert.ok(!('code' in rec.state.squares[0].mini), 'not in the shared state online');
  assert.ok(!JSON.stringify(rec.state).includes('[5,2,0,4]'));
  assert.deepEqual(rec.secrets[0], { code: [5, 2, 0, 4] }, 'kept in the separate secrets node');
  // a guess made through the online record is scored against the secret
  let o = L.applyOnlineMove(rec, 'O', 0, [5, 2, 0, 4], lcg(2));
  assert.equal(o.ok, true); assert.equal(o.rec.state.squares[0].owner, 'O');
  assert.deepEqual(o.rec.state.squares[0].mini.code, [5, 2, 0, 4], 'once cracked, the code is on show');
});

test('mastermind tactics: only codes consistent with every feedback, the best minimax split, the last one taken', () => {
  const m = mmMini([3, 1, 4, 0]);
  L.applyMove(m, 'X', [0, 1, 2, 3]);
  L.applyMove(m, 'O', [4, 5, 0, 1]);
  const pm = L.publicMini(m);
  const cand = L.mmCandidates(pm);
  assert.ok(cand.some(c => c.join() === '3,1,4,0'), 'the real code is still possible');
  for (const c of cand) for (const g of pm.guesses) assert.deepEqual(L.mmFeedback(g.code, c), { solid: g.solid, hollow: g.hollow });
  // the minimax guess: no other guess leaves a smaller worst case
  const worst = g => { const groups = new Map(); for (const c of cand) { const f = L.mmFeedback(g, c); const k = f.solid * 10 + f.hollow; groups.set(k, (groups.get(k) || 0) + 1); } return Math.max(...groups.values()); };
  const best = L.mmBestGuess(cand);
  assert.ok(L.mmValid(best));
  const bw = worst(best);
  for (const g of L.mmAll()) assert.ok(worst(g) >= bw, `${g} does not beat ${best}`);
  const lb = L.localBest(pm, 'X', cpuRng());
  assert.ok(L.mmValid(lb.move)); assert.equal(lb.shared, true); assert.equal(lb.q, 1 / cand.length);
  // one code left: guess it
  const one = mmMini([3, 1, 4, 0]);
  for (const g of [[0, 1, 2, 3], [4, 5, 0, 1], [1, 3, 5, 0], [3, 1, 0, 4]]) L.applyMove(one, 'X', g);
  const left = L.mmCandidates(L.publicMini(one));
  if (left.length === 1) { const b = L.localBest(L.publicMini(one), 'O', cpuRng()); assert.deepEqual(b.move, [3, 1, 4, 0]); assert.equal(b.q, 1); }
  // playing alone it always cracks the code, within 5 guesses
  for (const code of L.mmAll().filter((_, k) => k % 7 === 0)) {
    const g = mmMini(code.slice()); let n = 0, r;
    do { n++; r = L.applyMove(g, 'X', L.localBest(L.publicMini(g), 'X', cpuRng()).move); } while (r.outcome !== 'win' && n < 10);
    assert.ok(n <= 5, `${code} took ${n} guesses`);
  }
  // board level: the fewer codes left, the closer both players are (shared information)
  const fresh = L.needsOf(L.publicMini(mmMini([0, 1, 2, 3])), 'X');
  assert.ok(L.needsOf(pm, 'X') < fresh); assert.equal(L.needsOf(pm, 'X'), L.needsOf(pm, 'O'));
});

test('mastermind: a timed-out random move is a valid 4-colour guess', () => {
  const rng = lcg(21);
  for (let k = 0; k < 40; k++) {
    const m = L.newMini('mastermind', rng);
    const g = L.randomLegalMove(m, 'X', rng);
    assert.ok(L.mmValid(g), JSON.stringify(g));
    assert.equal(L.applyMove(m, 'X', g).ok, true);
  }
});

test('mastermind: the admin\'s settings (colours, the computer ignoring the clues) are dealt into the square and played by', () => {
  E.setTune('mastermind', { colors: 4, miss: 60 });
  const m = E.newMini('mastermind', E.makeRng('mm-tune'));
  E.setTune('mastermind', null);
  assert.deepEqual(m.tune, { colors: 4, miss: 60 });
  assert.ok(m.code.every(c => c < 4));
  assert.equal(E.applyMove(m, 'X', [0, 1, 2, 5], anyRng()).ok, false, 'a colour not in play');
  assert.equal(E.applyMove(m, 'X', [3, 2, 1, 0], anyRng()).ok, true);
  assert.equal(E.mmAll().length, 360, 'the default list stays as it was');
  const pm = E.publicMini(m);
  assert.ok(E.mmCandidates(pm).length <= 24);
  for (let k = 0; k < 10; k++) { const g = E.localBest(pm, 'O', E.makeRng('mm-ai' + k)).move; assert.ok(E.mmValid(g, 4), JSON.stringify(g)); }
  for (let k = 0; k < 40 && !E.applyMove(m, 'O', E.localBest(E.publicMini(m), 'O', E.makeRng('mm-p' + k)).move, anyRng()).outcome.startsWith('win'); k++);
  assert.ok(m.guesses.some(g => g.solid === 4), 'cracked');
});
