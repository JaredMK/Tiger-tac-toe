'use strict';
// Memory: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
// make one full turn as the UI does: the move, then the result overlay clearing, which (unless the
// same player goes again or the match is over) brings the board back and passes the turn
function turn(st, i, m, rng) {
  const r = L.playMove(st, i, m, rng || lcg(99));
  assert.equal(r.ok, true, `move ${JSON.stringify(m)} in square ${i} should be accepted (${r.reason})`);
  const flash = st.flash;
  L.endFlash(st);
  return flash;
}
const sorted = a => a.slice().sort((x, y) => x - y);
const mini = (type, rng) => L.newMini(type, rng || lcg(11));

// ================================== Memory ==================================
function pairOf(cards) {
  const seen = new Map();
  let pair = null;
  cards.forEach((c, i) => { const k = c.s + '/' + c.c; if (seen.has(k)) pair = [seen.get(k), i]; else seen.set(k, i); });
  return pair;
}

// ================================ Computer player ================================
const cpuRng = () => lcg(314);
// a match where the computer plays `me`, with the given squares (type names or ready-made minis)
function cpuMatch(me, squares, owners = []) {
  const st = matchWith(squares.map(s => (typeof s === 'string' ? s : s.type)));
  for (let i = squares.length; i < 9; i++) st.squares[i].mini = L.newMini('ttt', lcg(900 + i));   // the rest: fresh, plain squares (what the pool happens to deal must not decide a tactics test)
  squares.forEach((s, i) => { if (typeof s !== 'string') st.squares[i].mini = s; });
  owners.forEach((o, i) => { if (o) st.squares[i].owner = o; });
  st.cpu = me; st.turn = me;
  return st;
}

test('memory: nine cards, exactly one matching pair, every other card different', () => {
  const rng = lcg(5);
  for (let k = 0; k < 200; k++) {
    const cards = L.memoryDeck(rng);
    assert.equal(cards.length, 9);
    const keys = cards.map(c => c.s + '/' + c.c);
    assert.equal(new Set(keys).size, 8, 'eight distinct combinations');
    for (const c of cards) { assert.ok(L.MEMORY.shapes.includes(c.s)); assert.ok(L.MEMORY.colors.includes(c.c)); }
    assert.ok(pairOf(cards), 'a pair exists');
  }
});

test('memory: flipping two different face-down cards is a move; the pair wins', () => {
  const m = mini('memory');
  const [a, b] = pairOf(m.cards);
  for (const bad of [[a, a], [a], [a, b, 0], [a, 9], [-1, b], 'ab', null]) assert.equal(L.applyMove(m, 'X', bad).ok, false, JSON.stringify(bad));
  const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => i !== a && i !== b);
  assert.deepEqual(L.applyMove(m, 'X', [others[0], others[1]]), { ok: true, outcome: 'continue', note: 'nomatch' });
  assert.deepEqual(L.applyMove(m, 'X', [others[0], a]), { ok: true, outcome: 'continue', note: 'nomatch' });
  assert.equal(m.flips, 2);
  assert.deepEqual(m.last, { by: 'X', a: others[0], b: a });
  const r = L.applyMove(m, 'X', [b, a]);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([a, b]));
});

test('memory: the first pick is cleared after a move and a player may keep flipping on later turns', () => {
  const st = matchWith(['memory', 'ttt']);
  const [a, b] = pairOf(st.squares[0].mini.cards);
  const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => i !== a && i !== b);
  st.pick = others[0];
  const f = turn(st, 0, [others[0], others[1]]);
  assert.equal(f.kind, 'move');
  assert.deepEqual(f.reveal, [others[0], others[1]]);
  assert.equal(st.pick, null);
  turn(st, 1, 0);
  assert.equal(turn(st, 0, [a, b]).kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
});

test('memory tactics: a known pair is flipped, otherwise only unseen cards', () => {
  const m = mini('memory');
  const idx = new Map(); let pair = null;
  m.cards.forEach((c, i) => { const k = c.s + c.c; if (idx.has(k)) pair = [idx.get(k), i]; else idx.set(k, i); });
  const others = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !pair.includes(i));
  L.applyMove(m, 'O', [others[0], others[1]]);
  let mv = L.localBest(L.publicMini(m), 'X', cpuRng());
  assert.ok(mv.move.every(k => !m.seen.includes(k)), 'flips unseen cards');
  assert.ok(mv.q < 0.2);
  L.applyMove(m, 'O', [pair[0], others[2]]);
  L.applyMove(m, 'O', [pair[1], others[3]]);
  mv = L.localBest(L.publicMini(m), 'X', cpuRng());
  assert.deepEqual(mv.move.slice().sort(), pair.slice().sort(), 'remembers both cards of the pair');
  assert.equal(mv.q, 1);
  const st = cpuMatch('X', [m, 'ttt']);
  const cm = L.cpuMove(st, cpuRng());
  assert.equal(cm.square, 0, 'a sure claim beats a fresh square');
  assert.equal(L.playMove(st, 0, cm.move).flash.kind, 'claim');
});
