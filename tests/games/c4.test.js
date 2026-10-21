'use strict';
// Connect 4: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
const typeRng = type => seq(pick(L.TYPES.indexOf(type), L.TYPES.length), 0.5);
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

function matchWith(types, rng = lcg(7)) {
  const st = L.newMatch(rng);
  types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
  return st;
}
const sorted = a => a.slice().sort((x, y) => x - y);
const mini = (type, rng) => L.newMini(type, rng || lcg(11));

// ================================ Connect 4 ================================
const c4idx = (row, col) => row * L.C4.cols + col; // row 0 = top, row 5 = bottom

// A full 7x6 board with no four in a row anywhere; X has 22 pieces, O has 20.
const C4_DRAW = [
  'X', 'O', 'X', 'O', 'X', 'O', 'X',
  'X', 'O', 'X', 'O', 'X', 'O', 'X',
  'O', 'X', 'O', 'X', 'O', 'X', 'O',
  'O', 'X', 'O', 'X', 'O', 'X', 'O',
  'X', 'O', 'X', 'O', 'X', 'O', 'X',
  'X', 'O', 'X', 'O', 'X', 'O', 'X',
];

// ================================ Computer player ================================
const cpuRng = () => lcg(314);

test('c4: pieces drop to the lowest open cell of the column', () => {
  const m = mini('c4');
  L.applyMove(m, 'X', 2);
  assert.equal(m.cells[c4idx(5, 2)], 'X');
  L.applyMove(m, 'O', 2);
  assert.equal(m.cells[c4idx(4, 2)], 'O');
  assert.equal(m.last, c4idx(4, 2));
});

test('c4: three in a row is not enough, four is (lopsided vertical win)', () => {
  const m = mini('c4');
  assert.equal(L.applyMove(m, 'X', 2).outcome, 'continue');
  assert.equal(L.applyMove(m, 'X', 2).outcome, 'continue');
  assert.equal(L.applyMove(m, 'X', 2).outcome, 'continue', 'three stacked is not a win');
  const r = L.applyMove(m, 'X', 2);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([c4idx(5, 2), c4idx(4, 2), c4idx(3, 2), c4idx(2, 2)]));
  assert.equal(m.cells.filter(c => c === 'O').length, 0);
});

test('c4: horizontal win on the bottom row', () => {
  const m = mini('c4');
  L.applyMove(m, 'O', 0); L.applyMove(m, 'O', 1);
  assert.equal(L.applyMove(m, 'O', 2).outcome, 'continue');
  const r = L.applyMove(m, 'O', 3);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), [c4idx(5, 0), c4idx(5, 1), c4idx(5, 2), c4idx(5, 3)]);
});

test('c4: diagonal wins in both directions', () => {
  let m = mini('c4');
  const seqR = [['X', 0], ['O', 1], ['X', 1], ['O', 2], ['O', 2], ['X', 2], ['O', 3], ['O', 3], ['O', 3]];
  for (const [p, c] of seqR) assert.equal(L.applyMove(m, p, c).outcome, 'continue');
  let r = L.applyMove(m, 'X', 3);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([c4idx(5, 0), c4idx(4, 1), c4idx(3, 2), c4idx(2, 3)]));
  m = mini('c4');
  const seqL = [['X', 4], ['O', 3], ['X', 3], ['O', 2], ['O', 2], ['X', 2], ['O', 1], ['O', 1], ['O', 1]];
  for (const [p, c] of seqL) assert.equal(L.applyMove(m, p, c).outcome, 'continue');
  r = L.applyMove(m, 'X', 1);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([c4idx(5, 4), c4idx(4, 3), c4idx(3, 2), c4idx(2, 1)]));
});

test('c4: a full column and bad columns are rejected', () => {
  const m = mini('c4');
  for (let k = 0; k < 6; k++) assert.equal(L.applyMove(m, k % 2 ? 'O' : 'X', 0).outcome, 'continue');
  assert.deepEqual(L.applyMove(m, 'X', 0), { ok: false, reason: 'full' });
  assert.equal(L.applyMove(m, 'X', 7).ok, false, 'there is no eighth column');
  assert.equal(L.applyMove(m, 'X', -1).ok, false);
  assert.equal(L.applyMove(m, 'X', 6).ok, true, 'the seventh column is there');
});

test('c4: the board is the standard 7 columns by 6 rows, four in a row to win', () => {
  assert.deepEqual(L.C4, { cols: 7, rows: 6, k: 4 });
  const m = mini('c4');
  assert.equal(m.cells.length, 42);
  for (let col = 0; col < 7; col++) assert.equal(L.applyMove(m, 'X', col).ok, true);
  assert.equal(m.cells.slice(35).every(c => c === 'X'), true, 'every column of the bottom row');
});

test('c4: four in a row in the outer columns and across the full width', () => {
  let m = mini('c4');
  for (const col of [3, 4, 5]) assert.equal(L.applyMove(m, 'O', col).outcome, 'continue');
  let r = L.applyMove(m, 'O', 6);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), [c4idx(5, 3), c4idx(5, 4), c4idx(5, 5), c4idx(5, 6)]);
  m = mini('c4');
  for (let k = 0; k < 3; k++) L.applyMove(m, 'X', 6);
  r = L.applyMove(m, 'X', 6);
  assert.equal(r.outcome, 'win', 'four stacked in the last column');
  m = mini('c4');                                   // a diagonal ending in the right-hand column
  for (const [p, c] of [['X', 3], ['O', 4], ['X', 4], ['O', 5], ['O', 5], ['X', 5], ['O', 6], ['O', 6], ['O', 6]]) assert.equal(L.applyMove(m, p, c).outcome, 'continue');
  r = L.applyMove(m, 'X', 6);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([c4idx(5, 3), c4idx(4, 4), c4idx(3, 5), c4idx(2, 6)]));
  m = mini('c4');                                   // three with a gap is not four
  for (const col of [0, 1, 3]) L.applyMove(m, 'X', col);
  assert.equal(L.applyMove(m, 'X', 5).outcome, 'continue');
  assert.equal(L.findRun(m.cells, 7, 6, 4, 'X'), null);
});

test('c4: an old 5-column board is widened with an empty column on each side', () => {
  const old = { type: 'c4', cells: new Array(30).fill(null), last: 27, winCells: [25, 26, 27, 28] };
  [25, 26, 27, 28].forEach(k => { old.cells[k] = 'X'; });
  old.cells[20] = 'O';
  L.upgradeMini(old);
  assert.equal(old.cells.length, 42);
  assert.deepEqual([36, 37, 38, 39].map(k => old.cells[k]), ['X', 'X', 'X', 'X']);
  assert.equal(old.cells[35], null); assert.equal(old.cells[41], null);
  assert.equal(old.cells[29], 'O', 'row 4, old column 0 is now column 1');
  assert.equal(old.last, 38); assert.deepEqual(old.winCells, [36, 37, 38, 39]);
  const fresh = mini('c4'); L.upgradeMini(fresh); assert.equal(fresh.cells.length, 42, 'a new board is left alone');
});

test('c4: filling the board with no four in a row is a draw (lopsided 22 vs 20)', () => {
  const m = mini('c4');
  let last;
  for (let col = 0; col < L.C4.cols; col++) {
    for (let row = L.C4.rows - 1; row >= 0; row--) {
      last = L.applyMove(m, C4_DRAW[c4idx(row, col)], col);
      assert.equal(last.ok, true);
    }
  }
  assert.equal(last.outcome, 'draw');
  assert.deepEqual(m.cells, C4_DRAW);
  assert.equal(m.cells.filter(c => c === 'X').length, 22);
});

test('c4: a drawn square resets through playMove', () => {
  const st = matchWith(['c4']);
  const m = st.squares[0].mini;
  for (let col = 0; col < L.C4.cols; col++) {
    for (let row = L.C4.rows - 1; row >= 0; row--) {
      if (row === 0 && col === 6) break;
      L.applyMove(m, C4_DRAW[c4idx(row, col)], col);
    }
  }
  st.turn = C4_DRAW[c4idx(0, 6)];
  st.games = ['hex'];                                           // (the reset's only choice)
  assert.equal(L.playMove(st, 0, 6, typeRng('hex')).ok, true);
  assert.equal(st.flash.kind, 'draw');
  assert.equal(st.squares[0].owner, null);
  assert.equal(st.squares[0].mini.type, 'hex');
});

test('connect 4 tactics: completes four, blocks three, and otherwise prefers the middle', () => {
  const c = mini('c4');
  for (const [p, col] of [['X', 1], ['X', 2], ['X', 3], ['O', 0], ['O', 0]]) L.applyMove(c, p, col);
  const win = L.localBest(L.publicMini(c), 'X', cpuRng());
  assert.ok(win.move === 0 || win.move === 4);
  assert.equal(win.win, true);
  const block = L.localBest(L.publicMini(c), 'O', cpuRng());
  assert.ok(block.move === 0 || block.move === 4, `O blocks one end (played ${block.move})`);
  const vertical = mini('c4');
  for (const [p, col] of [['O', 2], ['O', 2], ['O', 2], ['X', 0]]) L.applyMove(vertical, p, col);
  assert.equal(L.localBest(L.publicMini(vertical), 'X', cpuRng()).move, 2, 'caps the column');
  assert.equal(L.localBest(L.publicMini(mini('c4')), 'X', cpuRng()).move, 3, 'the middle column first');
  const edge = mini('c4');                                   // a threat along the outer columns of the wider board
  for (const [p, col] of [['O', 4], ['O', 5], ['O', 6], ['X', 4], ['X', 5]]) L.applyMove(edge, p, col);
  assert.equal(L.localBest(L.publicMini(edge), 'X', cpuRng()).move, 3, 'blocks the open end of three on the right');
});

test('connect 4: the admin\'s settings (run length, look-ahead) are dealt into the square and played by', () => {
  E.setTune('c4', { k: 3, depth: 2 });
  const m = E.newMini('c4', E.makeRng('c4-tune'));
  E.setTune('c4', null);
  assert.deepEqual(m.tune, { k: 3, depth: 2 });
  assert.equal(E.applyMove(m, 'X', 0, anyRng()).outcome, 'continue');
  assert.equal(E.applyMove(m, 'X', 1, anyRng()).outcome, 'continue');
  const lb = E.localBest(E.publicMini(m), 'X', anyRng());
  assert.ok(lb.win && (lb.move === 2), 'three in a row wins now');
  assert.equal(E.applyMove(m, 'X', 2, anyRng()).outcome, 'win');
});
