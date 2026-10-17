'use strict';
// Treasure Hunt: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

// ================================ Treasure hunt ================================
test('hunt: a 6x6 grid; the treasure comes from the rng; distances are steps up, down, left and right', () => {
  assert.equal(L.newMini('hunt', lcg(1)).dug.length, 36);
  for (let k = 0; k < 36; k++) assert.equal(L.newMini('hunt', seq(pick(k, 36))).treasure, k);
  assert.equal(L.huntDist(14, 14), 0);
  assert.equal(L.huntDist(14, 15), 1);
  assert.equal(L.huntDist(14, 8), 1);
  assert.equal(L.huntDist(14, 0), 4);
  assert.equal(L.huntDist(0, 35), 10);
  assert.equal(L.huntDist(5, 30), 10);
  for (let a = 0; a < 36; a++) for (let b = 0; b < 36; b++) {
    assert.equal(L.huntDist(a, b), L.huntDist(b, a));
    assert.ok(L.huntDist(a, b) >= 0 && L.huntDist(a, b) <= 10);
  }
  assert.equal(L.huntDist(12, 24, 5), 4, 'an older 5x5 square measures on its own grid');
});

test('hunt: a dug cell shows only its band: Hot 1 step, Warm 2-3, Cool 4-5, Cold 6 or more', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 10].map(L.huntBand), [0, 1, 2, 2, 3, 3, 4, 4, 4]);
  assert.deepEqual(L.HUNT.bands, [null, 'hot', 'warm', 'cool', 'cold']);
  const m = L.newMini('hunt', seq(pick(14, 36)));              // the treasure at row 2, column 2
  for (const [cell, band] of [[15, 1], [8, 1], [16, 2], [21, 2], [0, 3], [5, 3], [30, 3], [35, 4]]) assert.equal(L.huntClue(m, cell), band, `cell ${cell}`);
  L.applyMove(m, 'X', 35); L.applyMove(m, 'O', 15);
  const pm = L.publicMini(m);
  assert.deepEqual(pm.clues.filter(c => c != null), [1, 4], 'the public view holds bands, never distances');
  const rec = (() => { const st = matchWith(['hunt']); st.squares[0].mini = m; st.id = 'h'; st.seq = 0; st.recent = []; return L.matchRecord(st); })();
  assert.equal(rec.state.squares[0].mini.clues[35], 4, 'online too: Cold, not 7 steps');
  assert.ok(!('treasure' in rec.state.squares[0].mini));
  const old = Object.assign(L.newMini('hunt', lcg(2)), { treasure: 12, dug: new Array(25).fill(null) });   // an older 5x5 square
  assert.equal(L.huntSize(old), 5); assert.equal(L.huntClue(old, 24), 3, 'measured on its own 5x5 grid: 4 steps, Cool');
});

test('hunt: a dig marks the cell for both players, a treasure dig wins, dug cells cannot be dug again', () => {
  const m = L.newMini('hunt', seq(pick(12, 36)));
  assert.deepEqual(L.applyMove(m, 'X', 0), { ok: true, outcome: 'continue', note: 'dig' });
  assert.equal(m.dug[0], 'X');
  assert.equal(L.applyMove(m, 'O', 0).ok, false);
  assert.equal(L.applyMove(m, 'O', 36).ok, false);
  assert.equal(L.applyMove(m, 'O', 7).outcome, 'continue');
  const r = L.applyMove(m, 'O', 12);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(r.cells, [12]);
  assert.equal(m.dug[12], 'O');
});

test('hunt: digging every other cell never ends the game, the treasure always does (lopsided)', () => {
  for (const t of [0, 7, 14, 35]) {
    const st = matchWith(['hunt']);
    st.squares[0].mini = L.newMini('hunt', seq(pick(t, 36)));
    for (let i = 0; i < 36; i++) {
      if (i === t) continue;
      st.turn = 'X';
      const f = turn(st, 0, i);
      assert.equal(f.kind, 'move');
      assert.equal(f.band, L.huntBand(L.huntDist(t, i)));
      assert.ok(f.band >= 1 && f.band <= 4);
      assert.ok(!('dist' in f), 'no distance on the move either');
    }
    st.turn = 'X';
    const f = turn(st, 0, t);
    assert.equal(f.kind, 'claim');
    assert.equal(f.band, 0);
    assert.equal(st.squares[0].owner, 'X');
  }
});

test('treasure hunt tactics: only cells consistent with every clue, the best splitter first', () => {
  const m = L.newMini('hunt', seq(pick(14, 36)));          // treasure at row 3, column 3 of 6
  L.applyMove(m, 'O', 0);                                  // 4 steps: Cool
  const pm = L.publicMini(m);
  const cand = L.huntCandidates(pm);
  assert.ok(cand.every(c => L.huntBand(L.huntDist(c, 0)) === 3 && c !== 0), 'only cells 4 or 5 steps from the dig');
  assert.ok(cand.includes(14));
  for (let k = 0; k < 20; k++) {
    const st = cpuMatch('X', [m, 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], [null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O']);   // the only open square: the dig itself is under test
    const mv = L.cpuMove(st, lcg(k));
    assert.equal(mv.square, 0);
    assert.ok(cand.includes(mv.move), `dig ${mv.move} fits the clue`);
  }
  L.applyMove(m, 'O', 5);                                  // row 1 column 6: 5 steps, Cool as well
  const cand2 = L.huntCandidates(L.publicMini(m));
  assert.ok(cand2.length < cand.length);
  assert.ok(cand2.every(c => L.huntBand(L.huntDist(c, 0)) === 3 && L.huntBand(L.huntDist(c, 5)) === 3));
  // four Hot digs around it leave one cell: dig it and win
  const one = L.newMini('hunt', seq(pick(14, 36)));
  for (const d of [8, 13, 15, 20]) L.applyMove(one, 'O', d);
  const c1 = L.huntCandidates(L.publicMini(one));
  assert.deepEqual(c1, [14]);
  const st = cpuMatch('X', [one, 'ttt']);
  const mv = L.cpuMove(st, cpuRng());
  assert.equal(mv.move, 14);
  assert.equal(L.playMove(st, 0, mv.move).flash.kind, 'claim');
  // left to itself, the computer digs only cells that fit every clue, and finds the treasure
  let total = 0;
  for (let g = 0; g < 60; g++) {
    const h = L.newMini('hunt', L.makeRng('hunt' + g));
    let n = 0;
    for (; n < 36; n++) {
      const c = L.huntCandidates(L.publicMini(h));
      const b = L.localBest(L.publicMini(h), 'X', lcg(g));
      assert.ok(c.includes(b.move), 'a dig consistent with every band');
      if (L.applyMove(h, 'X', b.move).outcome === 'win') break;
    }
    assert.ok(n < 36); total += n + 1;
  }
  assert.ok(total / 60 < 8, `found in ${(total / 60).toFixed(1)} digs on average`);
});
