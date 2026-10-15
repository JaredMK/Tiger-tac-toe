'use strict';
// Run with:  node --test
// Exercises the game engine (engine.js), which the page and the Cloud Functions share.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

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
const wordRng = (list, word) => seq(pick(list.indexOf(word), list.length));
const colorRng = name => seq(pick(L.CANDY.colors.indexOf(name), L.CANDY.colors.length));
const REMOVED = ['nim', 'chomp', 'obstruction', 'tug', 'othello'];   // Hexapawn came back as a 3x4 game

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
// a battleship with its ship on the given cells
const bsAt = (...ship) => Object.assign(mini('bs'), { len: ship.length, ship, revealed: new Array(16).fill(null), hits: [] });
// a one-cell ship (a Patrol Boat) at cell 0: either player claims it with one move
const oneMove = () => L.newMini('bs', seq(pick(0, 4), pick(0, 2), pick(0, 4), pick(0, 4)));

// =============================== Tic-tac-toe ===============================
test('ttt: X wins with three consecutive moves while O has no pieces (lopsided)', () => {
  const m = mini('ttt');
  assert.equal(L.applyMove(m, 'X', 0).outcome, 'continue');
  assert.equal(L.applyMove(m, 'X', 1).outcome, 'continue');
  const r = L.applyMove(m, 'X', 2);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), [0, 1, 2]);
  assert.equal(m.cells.filter(c => c === 'O').length, 0);
});

test('ttt: every row, column and diagonal is detected', () => {
  for (const line of L.LINES) {
    const m = mini('ttt');
    let r;
    for (const c of line) r = L.applyMove(m, 'O', c);
    assert.equal(r.outcome, 'win', `line ${line}`);
    assert.deepEqual(sorted(r.cells), sorted(line));
  }
});

test('ttt: occupied and out-of-range cells are rejected', () => {
  const m = mini('ttt');
  L.applyMove(m, 'X', 4);
  assert.equal(L.applyMove(m, 'O', 4).ok, false);
  assert.equal(L.applyMove(m, 'O', 9).ok, false);
  assert.equal(L.applyMove(m, 'O', -1).ok, false);
  assert.equal(L.applyMove(m, 'O', 1.5).ok, false);
  assert.equal(m.cells[4], 'X');
});

// O O X / X O O / O X X : full, no line, O has 5 and X has 4 (impossible with strict alternation)
const TTT_DRAW = ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];

test('ttt: a full board with no line is a draw, even with lopsided counts', () => {
  const m = mini('ttt');
  for (let i = 0; i < 8; i++) assert.equal(L.applyMove(m, TTT_DRAW[i], i).outcome, 'continue');
  assert.equal(L.applyMove(m, TTT_DRAW[8], 8).outcome, 'draw');
  assert.equal(m.cells.filter(c => c === 'O').length, 5);
});

test('ttt: a drawn square resets to a fresh random mini-game and stays unclaimed', () => {
  const st = matchWith(['ttt']);
  for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
  st.turn = TTT_DRAW[8];
  const r = L.playMove(st, 0, 8, typeRng('c4'));
  assert.equal(r.ok, true);
  assert.equal(st.flash.kind, 'draw');
  assert.equal(st.flash.newType, 'c4');
  assert.equal(st.flash.drawn.cells.every(Boolean), true, 'overlay keeps the full board');
  assert.equal(st.squares[0].owner, null);
  assert.equal(st.squares[0].mini.type, 'c4');
  assert.equal(st.squares[0].mini.cells.every(c => c === null), true, 'fresh board');
  assert.equal(st.done.next, L.other(TTT_DRAW[8]), 'the turn still passes after a draw');
  assert.equal(st.done.drawn, st.flash.drawn, 'the drawn board is kept for the result on show');
  L.endFlash(st);
  assert.equal(st.screen, 'board', 'the board comes back once the result has shown');
  assert.equal(st.turn, L.other(TTT_DRAW[8]));
  assert.equal(st.winner, null);
});

// X O X / O O X / _ X O : one cell left, but every line holds an X and an O
const TTT_BLOCKED = ['X', 'O', 'X', 'O', 'O', 'X', null, 'X', 'O'];

test('ttt: once neither player can make three in a row it is a draw at once, empty cells and all', () => {
  const m = mini('ttt');
  m.cells = TTT_BLOCKED.slice(); m.cells[8] = null;          // before O's mark at 8, X can still fill 2-5-8
  assert.equal(L.tttOpen(m.cells, 'X'), true);
  const r = L.applyMove(m, 'O', 8);
  assert.deepEqual([r.ok, r.outcome, r.note], [true, 'draw', 'blocked']);
  assert.equal(m.cells.filter(c => !c).length, 1, 'a cell still empty');
  assert.equal(L.tttOpen(m.cells, 'X') || L.tttOpen(m.cells, 'O'), false);
});

test('ttt: only one player blocked is not a draw: the other can still win', () => {
  const m = mini('ttt');
  m.cells = ['X', 'O', 'X', 'O', null, 'X', null, 'X', null];
  const r = L.applyMove(m, 'O', 4);                          // O has no line left; X still has 2-5-8
  assert.equal(r.outcome, 'continue');
  assert.deepEqual([L.tttOpen(m.cells, 'O'), L.tttOpen(m.cells, 'X')], [false, true]);
  assert.equal(L.applyMove(m, 'X', 8).outcome, 'win', 'and X does');
});

test('ttt: a blocked square resets like a full one: unclaimed, a new mini-game, the blocked board kept for the result', () => {
  const st = matchWith(['ttt']);
  st.squares[0].mini.cells = TTT_BLOCKED.slice(); st.squares[0].mini.cells[8] = null;
  st.turn = 'O';
  const r = L.playMove(st, 0, 8, typeRng('c4'));
  assert.equal(r.ok, true);
  assert.deepEqual([st.flash.kind, st.flash.note, st.flash.newType], ['draw', 'blocked', 'c4']);
  assert.deepEqual(st.flash.drawn.cells, TTT_BLOCKED, 'the board that blocked, empty cell and all');
  assert.equal(st.squares[0].owner, null);
  assert.equal(st.squares[0].mini.type, 'c4');
  assert.equal(st.sqlog[st.sqlog.length - 1].end, 'draw', 'counted as a draw-reset in the stats');
  L.endFlash(st);
  assert.equal(st.turn, 'X', 'the turn passes as after any draw');
});

test('ttt: in random play a square goes on only while someone can still make three in a row', () => {
  const rng = lcg(7);
  let blocked = 0;
  for (let g = 0; g < 2000; g++) {
    const m = mini('ttt');
    for (;;) {
      const free = m.cells.map((c, i) => (c ? -1 : i)).filter(i => i >= 0);
      const p = rng() < .5 ? 'X' : 'O';                        // moves in a square need not alternate
      const r = L.applyMove(m, p, free[Math.floor(rng() * free.length)]);
      if (r.outcome === 'continue') { assert.ok(L.tttOpen(m.cells, 'X') || L.tttOpen(m.cells, 'O')); continue; }
      if (r.outcome === 'draw') {
        assert.equal(L.tttOpen(m.cells, 'X') || L.tttOpen(m.cells, 'O'), false);
        assert.equal(r.note === 'blocked', m.cells.some(c => !c), 'blocked exactly when cells are left');
        if (r.note === 'blocked') blocked++;
      }
      break;
    }
  }
  assert.ok(blocked > 10, `blocked draws come up (${blocked})`);
});

test('ttt: a draw can reset to any game in the full list, including the same type', () => {
  for (const type of L.TYPES) {
    const st = matchWith(['ttt']);
    for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
    st.turn = TTT_DRAW[8];
    L.playMove(st, 0, 8, typeRng(type));
    assert.equal(st.squares[0].mini.type, type);
  }
});

// ================================ Connect 4 ================================
const c4idx = (row, col) => row * L.C4.cols + col; // row 0 = top, row 5 = bottom

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

// A full 7x6 board with no four in a row anywhere; X has 22 pieces, O has 20.
const C4_DRAW = [
  'X', 'O', 'X', 'O', 'X', 'O', 'X',
  'X', 'O', 'X', 'O', 'X', 'O', 'X',
  'O', 'X', 'O', 'X', 'O', 'X', 'O',
  'O', 'X', 'O', 'X', 'O', 'X', 'O',
  'X', 'O', 'X', 'O', 'X', 'O', 'X',
  'X', 'O', 'X', 'O', 'X', 'O', 'X',
];

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
  assert.equal(L.playMove(st, 0, 6, typeRng('hex')).ok, true);
  assert.equal(st.flash.kind, 'draw');
  assert.equal(st.squares[0].owner, null);
  assert.equal(st.squares[0].mini.type, 'hex');
});

// ================================ Battleship ================================
test('bs: one hidden ship of 1 to 4 cells, across or down, always inside the 4x4 grid', () => {
  assert.deepEqual(oneMove().ship, [0]);
  assert.deepEqual(L.newMini('bs', seq(pick(3, 4), pick(1, 2), pick(0, 1), pick(2, 4))).ship, [2, 6, 10, 14], 'a Battleship down column 3');
  assert.deepEqual(L.newMini('bs', seq(pick(2, 4), pick(0, 2), pick(3, 4), pick(1, 2))).ship, [13, 14, 15], 'a Submarine across the bottom row');
  const lens = new Set(), dirs = new Set(), rng = lcg(31);
  for (let k = 0; k < 400; k++) {
    const m = L.newMini('bs', rng);
    assert.equal(m.ship.length, m.len);
    assert.ok(m.len >= 1 && m.len <= 4);
    assert.ok(m.ship.every(c => Number.isInteger(c) && c >= 0 && c < 16));
    const rows = new Set(m.ship.map(c => Math.floor(c / 4))), cols = new Set(m.ship.map(c => c % 4));
    assert.ok(rows.size === 1 || cols.size === 1, 'in a straight line');
    const span = rows.size === 1 ? m.ship.map(c => c % 4) : m.ship.map(c => Math.floor(c / 4));
    assert.equal(Math.max(...span) - Math.min(...span), m.len - 1, 'no gaps, no wrapping');
    lens.add(m.len); if (m.len > 1) dirs.add(rows.size === 1 ? 'across' : 'down');
    assert.equal(m.revealed.length, 16); assert.deepEqual(m.hits, []);
  }
  assert.deepEqual([...lens].sort(), [1, 2, 3, 4]); assert.equal(dirs.size, 2);
  assert.deepEqual(L.BS.names, { 4: 'Battleship', 3: 'Submarine', 2: 'Destroyer', 1: 'Patrol Boat' });
  assert.equal(L.bsPlacements(1).length, 16); assert.equal(L.bsPlacements(4).length, 8);
});

test('bs: a shot is a hit or a miss; cells cannot be fired at twice; the shot on the last part sinks it', () => {
  const m = bsAt(5, 6, 7);
  assert.deepEqual(L.applyMove(m, 'X', 0), { ok: true, outcome: 'continue', note: 'miss' });
  assert.equal(m.revealed[0], 'X');
  assert.equal(L.applyMove(m, 'O', 0).reason, 'taken');
  for (const bad of [-1, 16, 'a', null, 1.5]) assert.equal(L.applyMove(m, 'O', bad).reason, 'bad');
  assert.deepEqual(L.applyMove(m, 'O', 6), { ok: true, outcome: 'continue', note: 'hit', again: true }, 'a hit fires again');
  assert.deepEqual(L.applyMove(m, 'X', 5), { ok: true, outcome: 'continue', note: 'hit', again: true });
  assert.deepEqual(m.hits, [6, 5]);
  const pm = L.publicMini(m);
  assert.deepEqual(Object.keys(pm).sort(), ['hits', 'len', 'revealed', 'type'], 'the ship\'s cells stay hidden');
  const sink = L.applyMove(m, 'O', 7);
  assert.deepEqual(sink, { ok: true, outcome: 'win', cells: [5, 6, 7], note: 'sunk' });
});

test('bs: a hit fires again until a miss or the sinking shot; whoever hits the final segment claims the square', () => {
  const st = matchWith(['bs', 'ttt']);
  st.squares[0].mini = bsAt(1, 5, 9);
  let f = turn(st, 0, 1);
  assert.equal(f.note, 'hit'); assert.equal(f.kind, 'again', 'a hit keeps the turn');
  assert.equal(st.turn, 'X'); assert.equal(st.lock, 0, 'locked into the same square'); assert.equal(st.screen, 'mini');
  assert.equal(L.playMove(st, 1, 0).reason, 'locked', 'no playing elsewhere meanwhile');
  f = turn(st, 0, 2);
  assert.equal(f.note, 'miss'); assert.equal(f.kind, 'move', 'a miss ends it');
  assert.equal(st.turn, 'O'); assert.equal(st.lock, null);
  f = turn(st, 0, 5);
  assert.equal(f.kind, 'again'); assert.equal(st.turn, 'O');
  f = turn(st, 0, 9);
  assert.equal(f.kind, 'claim'); assert.equal(f.by, 'O'); assert.equal(f.hit, true);
  assert.equal(st.squares[0].owner, 'O');
  assert.deepEqual(st.squares[0].mini.winCells, [1, 5, 9], 'the whole ship is revealed');
  // a timed-out shot fires once: even a hit ends the turn
  const t = matchWith(['bs', 'ttt']);
  t.squares[0].mini = bsAt(0, 1, 2, 3); t.timer = L.newTimer(60);
  for (let k = 1; k < 9; k++) t.squares[k].owner = k % 2 ? 'X' : 'O';
  t.squares[3].owner = null; t.squares[3].mini = L.newMini('ttt', lcg(1)); t.squares[3].mini.cells = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
  for (let k = 0; k < 6; k++) {
    t.turn = 'X'; t.lock = null; t.timer.streak = { X: 0, O: 0 };
    const before = t.squares[0].mini.hits.length;
    const r = L.timeoutMove(t, lcg(k));
    assert.equal(r.ok, true); assert.equal(r.square, 0);
    L.endFlash(t);
    if (t.squares[0].owner) break;
    assert.equal(t.lock, null, 'no bonus shot after a timeout'); assert.equal(t.turn, 'O');
    if (t.squares[0].mini.hits.length > before) break;
  }
});

test('bs: firing at every cell always sinks the ship (no draw possible)', () => {
  const rng = lcg(41);
  for (let g = 0; g < 50; g++) {
    const m = L.newMini('bs', rng);
    let r;
    for (let c = 0; c < 16; c++) { r = L.applyMove(m, c % 2 ? 'O' : 'X', c); if (r.outcome === 'win') break; }
    assert.equal(r.outcome, 'win');
  }
});

test('bs: the computer fires where the ship can still fit, around a hit once there is one', () => {
  // a Destroyer hit at cell 5: only the four cells next to it can hold the rest
  const m = bsAt(5, 9);
  L.applyMove(m, 'O', 5);
  for (let k = 0; k < 20; k++) {
    const b = L.localBest(L.publicMini(m), 'X', lcg(k));
    assert.ok([1, 4, 6, 9].includes(b.move), `next to the hit (${b.move})`);
    assert.equal(b.q, 1 / 4, 'one of four placements, and that shot sinks it');
  }
  // misses rule cells out: with 1, 4 and 6 missed, 9 is the only place left
  for (const c of [1, 4, 6]) L.applyMove(m, 'O', c);
  assert.deepEqual(L.bsCandidates(L.publicMini(m)), [[5, 9]]);
  assert.deepEqual(L.localBest(L.publicMini(m), 'X', lcg(1)), { move: 9, q: 1, shared: true });
  // a Destroyer (2) with nothing fired yet: the middle cells fit the most placements
  for (let k = 0; k < 10; k++) {
    const first = L.localBest(L.publicMini(bsAt(0, 1)), 'X', lcg(k)).move;
    assert.ok([5, 6, 9, 10].includes(first), `the middle (${first})`);
  }
  // a Battleship (4) whose middle misses leave only the edges
  const edge = bsAt(0, 4, 8, 12);
  for (const c of [5, 6, 9, 10]) L.applyMove(edge, 'O', c);
  const pe = L.publicMini(edge);
  assert.equal(L.bsCandidates(pe).length, 4, 'two rows and two columns along the edges');
  assert.ok(L.bsCandidates(pe).flat().includes(L.localBest(pe, 'X', lcg(2)).move));
  // the computer finishes a ship when it can: a 3-ship with two hits and one end missed
  const sub = bsAt(4, 5, 6);
  L.applyMove(sub, 'O', 4); L.applyMove(sub, 'O', 5); L.applyMove(sub, 'O', 7);
  const st = cpuMatch('X', [sub, 'ttt', 'ttt']);
  const mv = L.cpuMove(st, lcg(4));
  assert.equal(mv.square, 0); assert.equal(mv.move, 6);
});

test('bs: an old 3x3 game is moved into the top-left of the 4x4 grid as a Patrol Boat', () => {
  const old = { type: 'bs', hidden: 4, revealed: ['X', null, null, null, null, 'O', null, null, null], last: 5 };
  L.upgradeMini(old);
  assert.equal(old.revealed.length, 16);
  assert.deepEqual(old.ship, [5]); assert.equal(old.len, 1); assert.equal(old.last, 6);
  assert.equal(old.revealed[0], 'X'); assert.equal(old.revealed[6], 'O'); assert.deepEqual(old.hits, []);
  assert.equal(L.applyMove(old, 'X', 5).outcome, 'win');
  const pub = { type: 'bs', revealed: new Array(9).fill(null), last: null };   // an online square with its ship hidden
  L.upgradeMini(pub);
  assert.equal(pub.len, 1); assert.equal(pub.revealed.length, 16); assert.ok(!('ship' in pub));
});

// ================================== Wordle ==================================
test('wordle: the hidden word comes from a list of common words, all of them valid guesses', () => {
  assert.ok(L.WORDS5.length >= 200, `only ${L.WORDS5.length} words`);
  assert.equal(new Set(L.WORDS5).size, L.WORDS5.length, 'duplicates in the list');
  for (const w of L.WORDS5) {
    assert.match(w, /^[a-z]{5}$/, w);
    assert.ok(L.VALID5.has(w.toUpperCase()), `${w} is not in the valid-guess list`);
  }
  const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  assert.equal(m.word, 'CRANE');
  assert.deepEqual(m.guesses, []);
  for (let k = 0; k < 100; k++) assert.ok(L.WORDS5.includes(L.newMini('wordle', Math.random).word.toLowerCase()));
});

test('wordle: the valid-guess list holds several thousand real 5-letter words', () => {
  assert.ok(L.VALID5.size >= 5000, `only ${L.VALID5.size} valid words`);
  for (const w of L.VALID5) assert.match(w, /^[A-Z]{5}$/, w);
  for (const w of ['CRANE', 'ABOUT', 'HOUSE', 'MOUSE', 'LOUSE', 'QUEUE', 'ZEBRA', 'PIZZA', 'FJORD']) assert.ok(L.VALID5.has(w), w);
  for (const w of ['ZZZZZ', 'AEIOU', 'QQQQQ', 'XKCDS', 'ABCDE']) assert.ok(!L.VALID5.has(w), `${w} should not be a word`);
});

test('wordle: feedback marks follow the standard rules, duplicates included', () => {
  assert.deepEqual(L.wordleMarks('CRANE', 'CRANE'), ['g', 'g', 'g', 'g', 'g']);
  assert.deepEqual(L.wordleMarks('NACRE', 'CRANE'), ['y', 'y', 'y', 'y', 'g']);
  assert.deepEqual(L.wordleMarks('LLAMA', 'ALLEY'), ['y', 'g', 'y', 'x', 'x']);
  assert.deepEqual(L.wordleMarks('EERIE', 'BREAD'), ['y', 'x', 'y', 'x', 'x']);
  assert.deepEqual(L.wordleMarks('ZZZZZ', 'CRANE'), ['x', 'x', 'x', 'x', 'x']);
});

test('wordle: real words are accepted in any case, non-words and malformed guesses are rejected', () => {
  const m = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  for (const bad of ['CRAN', 'CRANES', 'CR4NE', 'CRAN ', 12345, null, ['C', 'R', 'A', 'N', 'E']]) {
    assert.deepEqual(L.applyMove(m, 'X', bad), { ok: false, reason: 'bad' }, `guess ${JSON.stringify(bad)}`);
  }
  for (const nonword of ['ZZZZZ', 'zzzzz', 'ABCDE', 'QQQQQ']) {
    assert.deepEqual(L.applyMove(m, 'X', nonword), { ok: false, reason: 'notword' }, nonword);
  }
  assert.equal(m.guesses.length, 0, 'rejected guesses leave no trace');
  assert.deepEqual(L.applyMove(m, 'X', 'mouse'), { ok: true, outcome: 'continue', note: 'guess' });
  assert.deepEqual(m.guesses[0], { by: 'X', word: 'MOUSE', marks: ['x', 'x', 'x', 'x', 'g'] });
  assert.equal(L.applyMove(m, 'O', 'about').outcome, 'continue');
  assert.deepEqual(m.guesses[1].marks, ['y', 'x', 'x', 'x', 'x']);
  assert.equal(L.applyMove(m, 'O', 'crane').outcome, 'win');
  assert.equal(m.guesses.length, 3, 'every real guess stays on record');
});

test('wordle: an invalid guess does not use up the turn', () => {
  const st = matchWith(['wordle', 'ttt']);
  st.squares[0].mini = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  st.draft = 'ZZZZZ';
  const before = JSON.stringify(st);
  assert.deepEqual(L.playMove(st, 0, 'ZZZZZ'), { ok: false, reason: 'notword' });
  assert.equal(JSON.stringify(st), before, 'nothing changed: same turn, no flash, the typed letters kept');
  assert.equal(st.turn, 'X');
  assert.equal(st.flash, null);
  assert.equal(st.moves, 0);
  assert.equal(turn(st, 0, 'MOUSE').kind, 'move', 'the same player then makes a real guess');
  assert.equal(st.turn, 'O');
  assert.equal(st.moves, 1);
});

test('wordle: a player may keep guessing on consecutive turns and the turn passes each time', () => {
  const st = matchWith(['wordle', 'ttt']);
  st.squares[0].mini = L.newMini('wordle', wordRng(L.WORDS5, 'house'));
  turn(st, 0, 'MOUSE'); turn(st, 1, 0);
  turn(st, 0, 'LOUSE'); turn(st, 1, 1);
  const f = turn(st, 0, 'HOUSE');
  assert.equal(f.kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
  assert.deepEqual(st.squares[0].mini.guesses.map(g => g.by), ['X', 'X', 'X']);
  assert.equal(st.draft, '', 'typed letters are cleared after a move');
});

// ================================== Hangman ==================================
test('hangman: the embedded list holds unique common words of 5 to 7 letters', () => {
  assert.ok(L.WORDS_HANG.length >= 100, `only ${L.WORDS_HANG.length} words`);
  assert.equal(new Set(L.WORDS_HANG).size, L.WORDS_HANG.length);
  for (const w of L.WORDS_HANG) assert.match(w, /^[a-z]{5,7}$/, w);
  assert.equal(L.newMini('hangman', wordRng(L.WORDS_HANG, 'banana')).word, 'BANANA');
});

test('hangman: a right letter reveals every copy and grants another guess, a wrong one ends the turn', () => {
  const m = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  for (const bad of ['AB', '1', '', 5, null]) assert.equal(L.applyMove(m, 'X', bad).ok, false, `letter ${bad}`);
  assert.deepEqual(L.applyMove(m, 'X', 'p'), { ok: true, outcome: 'continue', note: 'hit', again: true });
  assert.deepEqual(m.letters, [{ l: 'P', by: 'X', hit: true }]);
  assert.deepEqual(L.applyMove(m, 'X', 'P'), { ok: false, reason: 'taken' });
  assert.deepEqual(L.applyMove(m, 'X', 'Z'), { ok: true, outcome: 'continue', note: 'miss' });
  assert.equal(L.applyMove(m, 'O', 'A').again, true);
  assert.equal(L.applyMove(m, 'O', 'L').again, true);
  const r = L.applyMove(m, 'O', 'E');
  assert.equal(r.outcome, 'win', 'revealing the final letter wins');
  assert.equal(r.again, undefined);
});

test('hangman: the bonus guess keeps the turn and locks the player to that square', () => {
  const st = matchWith(['hangman', 'ttt']);
  st.squares[0].mini = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  const r = L.playMove(st, 0, 'P');
  assert.equal(r.ok, true);
  assert.equal(st.flash.kind, 'again');
  assert.equal(st.flash.next, 'X');
  assert.equal(st.turn, 'X', 'turn does not pass');
  assert.equal(st.lock, 0);
  L.endFlash(st);
  assert.equal(st.screen, 'mini', 'stays in the mini-game');
  assert.equal(st.zoom, 0);
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'locked' }, 'cannot move elsewhere');
  assert.equal(L.playMove(st, 0, 'Z').ok, true);
  assert.equal(st.flash.kind, 'move');
  assert.equal(st.turn, 'X', 'the miss ends the move; the turn passes as the board comes back');
  assert.equal(st.done.next, 'O');
  assert.equal(st.lock, null);
  L.endFlash(st);
  assert.equal(st.screen, 'board');
  assert.equal(st.turn, 'O');
});

test('hangman: one player can reveal the whole word in a single turn (lopsided) and claims the square', () => {
  const st = matchWith(['hangman']);
  st.squares[0].mini = L.newMini('hangman', wordRng(L.WORDS_HANG, 'zebra'));
  for (const l of ['Z', 'E', 'B', 'R']) {
    assert.equal(turn(st, 0, l).kind, 'again');
    assert.equal(st.turn, 'X');
  }
  const f = turn(st, 0, 'A');
  assert.equal(f.kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(st.lock, null, 'lock clears on the win');
  assert.equal(st.turn, 'O');
  assert.equal(st.moves, 5);
});

// =================================== Hex ===================================
const hx = (r, c) => r * L.HEX_N + c;

test('hex: neighbours follow the shifted-row layout', () => {
  assert.deepEqual(sorted(L.hexNeighbors(hx(1, 1))), sorted([hx(1, 0), hx(1, 2), hx(0, 1), hx(2, 1), hx(0, 2), hx(2, 0)]));
  assert.ok(!L.hexNeighbors(hx(1, 1)).includes(hx(0, 0)), 'up-left is not adjacent');
  assert.ok(!L.hexNeighbors(hx(1, 1)).includes(hx(2, 2)), 'down-right is not adjacent');
  assert.deepEqual(sorted(L.hexNeighbors(hx(0, 0))), sorted([hx(0, 1), hx(1, 0)]));
  assert.deepEqual(sorted(L.hexNeighbors(hx(3, 3))), sorted([hx(3, 2), hx(2, 3)]));
});

test('hex: X wins with a straight row, lopsided with no O cells', () => {
  const m = mini('hex');
  for (const c of [0, 1, 2]) assert.equal(L.applyMove(m, 'X', hx(1, c)).outcome, 'continue');
  const r = L.applyMove(m, 'X', hx(1, 3));
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), [hx(1, 0), hx(1, 1), hx(1, 2), hx(1, 3)]);
});

test('hex: O wins with a straight column, and the same cells would not win for X', () => {
  const m = mini('hex');
  for (const r of [0, 1, 2]) L.applyMove(m, 'O', hx(r, 2));
  assert.equal(L.applyMove(m, 'O', hx(3, 2)).outcome, 'win');
  const x = mini('hex');
  for (const r of [0, 1, 2, 3]) assert.equal(L.applyMove(x, 'X', hx(r, 2)).outcome, 'continue', 'a column is not left-to-right');
  const o = mini('hex');
  for (const c of [0, 1, 2, 3]) assert.equal(L.applyMove(o, 'O', hx(1, c)).outcome, 'continue', 'a row is not top-to-bottom');
});

test('hex: a diagonal is connected one way and not the other', () => {
  const m = mini('hex');
  for (const [r, c] of [[3, 0], [2, 1], [1, 2]]) assert.equal(L.applyMove(m, 'X', hx(r, c)).outcome, 'continue');
  const win = L.applyMove(m, 'X', hx(0, 3));
  assert.equal(win.outcome, 'win');
  assert.deepEqual(sorted(win.cells), sorted([hx(3, 0), hx(2, 1), hx(1, 2), hx(0, 3)]));
  const n = mini('hex');
  for (const [r, c] of [[0, 0], [1, 1], [2, 2], [3, 3]]) assert.equal(L.applyMove(n, 'X', hx(r, c)).outcome, 'continue');
  assert.equal(L.hexPath(n.cells, 'X'), null);
});

test('hex: a winding path is found and reported edge to edge', () => {
  const m = mini('hex');
  const cells = [hx(0, 0), hx(1, 0), hx(1, 1), hx(0, 2), hx(0, 3)];
  let r;
  for (const c of cells) r = L.applyMove(m, 'X', c);
  assert.equal(r.outcome, 'win');
  const p = r.cells;
  assert.equal(p[0] % L.HEX_N, L.HEX_N - 1, 'path starts on the right edge');
  assert.equal(p[p.length - 1] % L.HEX_N, 0, 'path ends on the left edge');
  for (let k = 1; k < p.length; k++) assert.ok(L.hexNeighbors(p[k - 1]).includes(p[k]), 'consecutive path cells touch');
  const b = mini('hex');
  for (const c of [hx(0, 0), hx(1, 0), hx(0, 2), hx(0, 3)]) L.applyMove(b, 'X', c);
  L.applyMove(b, 'O', hx(1, 1));
  assert.equal(L.hexPath(b.cells, 'X'), null);
  assert.equal(L.applyMove(b, 'X', hx(1, 1)).ok, false, 'taken cells are rejected');
});

// ============================== Higher / lower ==============================
test('hilo: the number comes from the rng, guesses narrow the range, the number wins', () => {
  for (let k = 0; k < 20; k++) assert.equal(L.newMini('hilo', seq(pick(k, 20))).target, k + 1);
  const m = L.newMini('hilo', seq(pick(12, 20)));   // target 13
  assert.equal(m.target, 13);
  assert.equal(L.applyMove(m, 'X', 0).ok, false);
  assert.equal(L.applyMove(m, 'X', 21).ok, false);
  assert.equal(L.applyMove(m, 'X', 2.5).ok, false);
  assert.deepEqual(L.applyMove(m, 'X', 10), { ok: true, outcome: 'continue', note: 'higher' });
  assert.equal(m.lo, 11); assert.equal(m.hi, 20);
  assert.deepEqual(L.applyMove(m, 'X', 15), { ok: true, outcome: 'continue', note: 'lower' });
  assert.equal(m.hi, 14);
  assert.equal(L.applyMove(m, 'O', 10).ok, false, 'outside the remaining range');
  assert.equal(L.applyMove(m, 'O', 13).outcome, 'win');
  assert.deepEqual(m.guesses.map(g => [g.by, g.n, g.res]), [['X', 10, 'higher'], ['X', 15, 'lower'], ['O', 13, 'hit']]);
});

test('hilo: guessing inside the range always ends the game, for every target', () => {
  for (let t = 1; t <= 20; t++) {
    const m = L.newMini('hilo', seq(pick(t - 1, 20)));
    let r, n = 0;
    do { r = L.applyMove(m, 'X', m.lo); n++; } while (r.outcome !== 'win' && n < 25);
    assert.equal(r.outcome, 'win', `target ${t}`);
    assert.equal(n, t, 'counting up from 1 takes exactly t guesses');
  }
});

// ================================ Dice race ================================
test('dice: a roll of 1 to 6 comes from the rng and moves the roller, reaching or passing the finish (space 16) wins', () => {
  const m = mini('dice');
  assert.deepEqual(L.applyMove(m, 'X', 1, seq(pick(3, 6))), { ok: true, outcome: 'continue', note: 'roll' });
  assert.deepEqual(m.totals, { X: 4, O: 0 });
  assert.deepEqual(m.last, { by: 'X', roll: 4 });
  L.applyMove(m, 'O', 1, seq(pick(5, 6)));
  assert.deepEqual(m.totals, { X: 4, O: 6 });
  L.applyMove(m, 'X', 'whatever', seq(pick(5, 6)));   // the move value is ignored, only the roll matters
  L.applyMove(m, 'X', 1, seq(pick(4, 6)));
  assert.equal(m.totals.X, 15, 'on the last numbered space, not finished yet');
  assert.equal(L.applyMove(m, 'X', 1, seq(pick(0, 6))).outcome, 'win');   // 4 + 6 + 5 + 1 = 16: the finish
  assert.deepEqual(m.totals, { X: 16, O: 6 });
  const far = mini('dice');
  L.applyMove(far, 'O', 1, seq(pick(5, 6))); L.applyMove(far, 'O', 1, seq(pick(5, 6)));
  assert.equal(L.applyMove(far, 'O', 1, seq(pick(5, 6))).outcome, 'win', 'passing the finish wins too');
  assert.equal(far.totals.O, 18);
  const seen = new Set();
  for (let k = 0; k < 500; k++) { const d = mini('dice'); L.applyMove(d, 'X', 1, Math.random); seen.add(d.last.roll); }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
});

test('dice: three straight rolls by one player can win before the other ever rolls (lopsided)', () => {
  const st = matchWith(['dice', 'ttt']);
  turn(st, 0, 1, seq(pick(5, 6))); turn(st, 1, 0);
  turn(st, 0, 1, seq(pick(5, 6))); turn(st, 1, 1);
  const f = turn(st, 0, 1, seq(pick(3, 6)));
  assert.equal(f.kind, 'claim');
  assert.deepEqual(st.squares[0].mini.totals, { X: 16, O: 0 });
});

// ================================== Memory ==================================
function pairOf(cards) {
  const seen = new Map();
  let pair = null;
  cards.forEach((c, i) => { const k = c.s + '/' + c.c; if (seen.has(k)) pair = [seen.get(k), i]; else seen.set(k, i); });
  return pair;
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

// ================================== Candy race ==================================
test('candy: twelve random colours with the same colour never within two spaces of itself', () => {
  const rng = lcg(3);
  const seen = new Set();
  for (let k = 0; k < 10000; k++) {
    const track = L.candyTrack(rng);
    assert.equal(track.length, L.CANDY.len);
    for (let i = 0; i < track.length; i++) {
      assert.ok(L.CANDY.colors.includes(track[i]));
      if (i >= 1) assert.notEqual(track[i], track[i - 1], `track ${track.join(',')}: repeat at ${i}`);
      if (i >= 2) assert.notEqual(track[i], track[i - 2], `track ${track.join(',')}: repeat two apart at ${i}`);
      seen.add(track[i]);
    }
  }
  assert.deepEqual([...seen].sort(), [...L.CANDY.colors].sort(), 'every colour gets used');
  const m = mini('candy');
  for (let i = 2; i < m.track.length; i++) assert.ok(new Set(m.track.slice(i - 2, i + 1)).size === 3, 'newMini uses the spaced track');
  assert.deepEqual(m.pos, { X: -1, O: -1 });
});

test('candy: the token hops to the next space of the spun colour, sharing a space is fine', () => {
  const m = Object.assign(mini('candy'), { track: ['red', 'blue', 'green', 'red', 'blue', 'yellow', 'red', 'green', 'blue', 'red', 'yellow', 'green'] });
  assert.deepEqual(L.applyMove(m, 'X', 1, colorRng('blue')), { ok: true, outcome: 'continue', note: 'spin' });
  assert.equal(m.pos.X, 1);
  assert.deepEqual(m.last, { by: 'X', color: 'blue', from: -1, to: 1 });
  L.applyMove(m, 'X', 1, colorRng('red'));    // next red after space 1 is 3
  assert.equal(m.pos.X, 3);
  L.applyMove(m, 'O', 1, colorRng('red'));    // O from the start: first red is 0
  assert.equal(m.pos.O, 0);
  L.applyMove(m, 'O', 1, colorRng('red'));
  assert.equal(m.pos.O, 3, 'both tokens on space 4');
  L.applyMove(m, 'X', 1, colorRng('yellow')); // 5
  assert.equal(m.pos.X, 5);
});

test('candy: no space of that colour ahead means the finish, which wins', () => {
  const m = Object.assign(mini('candy'), { track: ['red', 'blue', 'green', 'red', 'blue', 'yellow', 'red', 'green', 'blue', 'red', 'yellow', 'green'] });
  m.pos.X = 9;                                // the last blue is 8
  assert.equal(L.applyMove(m, 'X', 1, colorRng('blue')).outcome, 'win');
  assert.equal(m.pos.X, L.CANDY.len);
  const n = Object.assign(mini('candy'), { track: ['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow'] });
  assert.equal(L.applyMove(n, 'O', 1, colorRng('blue')).outcome, 'win', 'a colour missing from the track finishes at once');
  assert.equal(L.applyMove(n, 'X', 1, colorRng('red')).outcome, 'continue');
  assert.equal(n.pos.X, 0);
});

test('candy: X can spin on consecutive turns and win before O ever spins (lopsided)', () => {
  const st = matchWith(['candy', 'ttt']);
  st.squares[0].mini.track = ['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow'];
  turn(st, 0, 1, colorRng('red')); turn(st, 1, 0);
  assert.equal(st.squares[0].mini.pos.X, 0);
  const f = turn(st, 0, 1, colorRng('blue'));   // none ahead
  assert.equal(f.kind, 'claim');
  assert.equal(f.color, 'blue');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(st.squares[0].mini.pos.O, -1);
});

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

// ================================ Setup / match flow ================================
test('setup: the app opens on the main menu with default names and every game ticked', () => {
  const st = L.newState(lcg(1));
  assert.equal(st.v, 4);
  assert.equal(st.screen, 'menu', 'the main menu comes first');
  assert.deepEqual(st.setup.names, { X: 'X', O: 'O' });
  assert.deepEqual(L.enabledGames(st.setup), L.TYPES);
  assert.equal(L.TYPES.length, 36);
  assert.ok(st.setup.games.coins && st.setup.games.pig && st.setup.games.hunt && st.setup.games.snakes && st.setup.games.bump, 'the newer games are on by default');
  assert.ok(st.setup.games.bj && st.setup.games.bus && st.setup.games.rl, 'and the card games and the wheel too');
  assert.ok(L.TEST_TYPES.every(t => st.setup.games[t] && L.TYPES.includes(t)), 'the games on test are in the pool and on by default (for the admin, who alone sees them)');
  assert.deepEqual(L.releasedTypes({}), L.TYPES.filter(t => !L.TEST_TYPES.includes(t)), 'released: everything but the games on test');
  assert.deepEqual(L.releasedTypes({ trivia: true, ttt: false }), L.TYPES.filter(t => (t === 'trivia' || !L.TEST_TYPES.includes(t)) && t !== 'ttt'), 'the database overrides the code either way');
  assert.deepEqual(L.allowedTypes({}, true), L.TYPES, 'the admin: every game');
  const g = Object.fromEntries(L.TYPES.map(t => [t, true]));
  L.restrictGames(g, L.releasedTypes({}));
  assert.ok(L.TEST_TYPES.every(t => g[t] === false) && g.ttt === true, 'a setup cut down to the released games');
  assert.ok(!L.TYPES.includes('dice'), 'Snakes and Ladders took the Dice race\'s place');
  assert.ok(!L.TYPES.includes('hexapawn') && !('hexapawn' in st.setup.games), 'Hexapawn is out of the pool and the Advanced list');
  assert.deepEqual(L.OLD_TYPES, ['dice', 'hexapawn'], 'no longer dealt, still played in older matches');
  for (const t of L.TYPES) assert.ok(L.INFO[t] && L.INFO[t].name && L.INFO[t].hint, `info for ${t}`);
  assert.equal(L.playerName(st, 'X'), 'X');
});

test('setup: Start needs at least one game, tidies the names and builds nine squares from the ticked games', () => {
  const st = L.newState(lcg(2));
  for (const t of L.TYPES) st.setup.games[t] = false;
  const before = JSON.stringify(st);
  assert.equal(L.startMatch(st, lcg(2)), false);
  assert.equal(JSON.stringify(st), before, 'nothing changes without a game');
  st.setup.games.hex = true;
  st.setup.names = { X: '  Alice  ', O: '' };
  assert.equal(L.startMatch(st, lcg(2)), true);
  assert.equal(st.screen, 'board');
  assert.equal(st.turn, 'X');
  assert.deepEqual(st.setup.names, { X: 'Alice', O: 'O' }, 'trimmed, empty falls back to the mark');
  assert.equal(L.playerName(st, 'X'), 'Alice');
  assert.deepEqual(st.games, ['hex']);
  assert.equal(st.squares.length, 9);
  for (const sq of st.squares) { assert.equal(sq.owner, null); assert.equal(sq.mini.type, 'hex'); }
  st.setup.names.O = 'A very long name indeed';
  L.startMatch(st, lcg(2));
  assert.equal(st.setup.names.O.length, L.NAME_MAX, 'names are capped');
});

test('setup: unticked games never appear, in fresh squares or in draw resets', () => {
  const allowed = ['ttt', 'bs', 'snakes'];
  const rng = lcg(77);
  const seen = new Set();
  for (let k = 0; k < 300; k++) {
    const st = L.newMatch(rng, { games: allowed });
    assert.deepEqual(st.games, allowed);
    st.squares.forEach(s => seen.add(s.mini.type));
    // draw a tic-tac-toe square and watch what it resets to
    st.squares[0].mini = L.newMini('ttt', rng);
    for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
    st.turn = TTT_DRAW[8];
    assert.equal(L.playMove(st, 0, 8, rng).ok, true);
    assert.equal(st.flash.kind, 'draw');
    seen.add(st.squares[0].mini.type);
  }
  assert.deepEqual([...seen].sort(), [...allowed].sort());
  const single = L.newMatch(lcg(8), { games: ['memory'] });
  assert.ok(single.squares.every(s => s.mini.type === 'memory'));
  const named = L.newMatch(lcg(8), { names: { X: 'Ann', O: 'Ben' } });
  assert.equal(L.playerName(named, 'O'), 'Ben');
});

test('removed games are gone from assignment, resets and the rules', () => {
  for (const t of REMOVED) {
    assert.ok(!L.TYPES.includes(t), t);
    assert.equal(L.INFO[t], undefined);
    assert.throws(() => L.newMini(t, Math.random));
  }
  const rng = lcg(42);
  const seen = new Set();
  for (let k = 0; k < 500; k++) L.newMatch(rng).squares.forEach(s => seen.add(s.mini.type));
  for (let k = 0; k < 300; k++) {
    const st = matchWith(['ttt'], rng);
    for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
    st.turn = TTT_DRAW[8];
    L.playMove(st, 0, 8, rng);
    seen.add(st.squares[0].mini.type);
  }
  assert.deepEqual([...seen].sort(), [...L.TYPES].sort());
  for (const t of REMOVED) assert.ok(!seen.has(t));
});

test('turns alternate, and a player may keep moving in the same mini-game', () => {
  const st = matchWith(['ttt', 'ttt']);
  assert.equal(turn(st, 0, 0).kind, 'move');
  assert.equal(st.turn, 'O');
  assert.equal(st.screen, 'board');
  assert.equal(st.flash, null);
  assert.equal(st.zoom, null);
  turn(st, 1, 0);                      // O plays elsewhere
  assert.equal(st.turn, 'X');
  turn(st, 0, 1);                      // X back in square 0 although O never moved there
  turn(st, 1, 1);
  const f = turn(st, 0, 2);
  assert.equal(f.kind, 'claim');
  assert.equal(f.by, 'X');
  assert.equal(f.winner, 'X');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(st.squares[0].mini.cells.filter(c => c === 'X').length, 3);
  assert.equal(st.squares[0].mini.cells.filter(c => c === 'O').length, 0);
  assert.equal(st.moves, 5);
  assert.equal(st.lastSquare, 0);
  assert.equal(st.lastBy, 'X');
  assert.equal(st.winner, null);
});

test('moves are refused while a result is showing, on claimed squares, and after the match ends', () => {
  const st = matchWith(['ttt', 'ttt']);
  assert.equal(L.playMove(st, 0, 0).ok, true);
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'busy' });
  L.endFlash(st, true);                           // the result held a moment longer (Memory's cards turning back)
  assert.equal(L.endFlash(st), false);
  assert.equal(st.screen, 'mini');
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'done' }, 'the move is made: nothing more while its result is on show');
  assert.deepEqual(L.playMove(st, 0, 1), { ok: false, reason: 'done' });
  L.leaveSquare(st);
  assert.equal(st.turn, 'O');
  st.squares[1].owner = 'O';
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'claimed' });
  assert.equal(L.playMove(st, 9, 0).ok, false);
  st.winner = 'O';
  assert.deepEqual(L.playMove(st, 0, 1), { ok: false, reason: 'over' });
});

test('a rejected move changes nothing, including the turn', () => {
  const st = matchWith(['ttt']);
  const before = JSON.stringify(st);
  assert.equal(L.playMove(st, 0, 42).ok, false);
  assert.equal(JSON.stringify(st), before);
});

test('three claimed squares in a row win the match', () => {
  const st = matchWith(['bs', 'bs', 'bs', 'ttt']);
  for (let i = 0; i < 3; i++) st.squares[i].mini = oneMove();
  assert.equal(turn(st, 0, 0).kind, 'claim');
  turn(st, 3, 0);
  assert.equal(turn(st, 1, 0).kind, 'claim');
  turn(st, 3, 1);
  const r = L.playMove(st, 2, 0);
  assert.equal(r.ok, true);
  assert.equal(st.flash.kind, 'match');
  assert.equal(st.winner, 'X');
  assert.deepEqual(st.winLine, [0, 1, 2]);
  assert.equal(st.winReason, 'line');
  L.endFlash(st);
  assert.equal(st.screen, 'win');
  assert.equal(L.playMove(st, 3, 2).ok, false);
});

test('every main-board line is detected', () => {
  for (const line of L.LINES) {
    const st = L.newMatch(lcg(3));
    for (const i of line) st.squares[i].owner = 'O';
    assert.deepEqual(L.mainResult(st.squares), { winner: 'O', line, reason: 'line' });
  }
  const st = L.newMatch(lcg(3));
  assert.equal(L.mainResult(st.squares), null);
  st.squares[0].owner = 'X'; st.squares[1].owner = 'O';
  assert.equal(L.mainResult(st.squares), null);
});

test('once neither player can still make three in a row, the match is a draw there and then', () => {
  // O O X / X O O / O X [ ] : O could still win at 8; X claims it and no line is left for anyone
  let st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'bs']);
  ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X'].forEach((o, i) => { st.squares[i].owner = o; });
  st.squares[8].mini = oneMove();
  st.turn = 'X';
  assert.equal(L.mainResult(st.squares), null, 'O can still make a line: play on');
  assert.equal(L.playMove(st, 8, 0).ok, true);
  assert.equal(st.flash.kind, 'match');
  assert.equal(st.winner, 'draw'); assert.equal(st.winReason, 'blocked'); assert.equal(st.winLine, null);
  assert.deepEqual(st.counts, { X: 4, O: 5 }, 'no "most squares" any more');
  L.endFlash(st);
  assert.equal(st.screen, 'win');
  assert.equal(L.playMove(st, 8, 0).reason, 'over');
  // X O X / O X _ / O _ O : only O's bottom row is open; X takes square 7 and it is a draw with square 5 never played
  st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'bs', 'ttt']);
  ['X', 'O', 'X', 'O', 'X', null, 'O', null, 'O'].forEach((o, i) => { st.squares[i].owner = o; });
  st.squares[7].mini = oneMove();
  st.turn = 'X';
  assert.equal(L.mainResult(st.squares), null);
  assert.equal(L.lineOpen(st.squares, 'O'), true); assert.equal(L.lineOpen(st.squares, 'X'), false);
  L.playMove(st, 7, 0);
  assert.equal(st.winner, 'draw', 'a draw with a square still open');
  assert.equal(st.squares[5].owner, null);
  // the screenshot's board: four each, the last square cannot give anyone a line
  const sq = owners => owners.map(o => ({ owner: o, mini: L.newMini('ttt', lcg(1)) }));
  assert.equal(L.mainResult(sq([null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O'])).winner, 'draw');
  // a line still wins, even on a board where the other side is shut out
  assert.deepEqual(L.mainResult(sq(['X', 'X', 'X', 'O', 'O', null, null, null, null])), { winner: 'X', line: [0, 1, 2], reason: 'line' });
  // the old rule, kept for checking results from before: most squares on a full board
  assert.deepEqual(L.majorityResult(sq(['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])), { winner: 'O', line: null, reason: 'majority', counts: { X: 4, O: 5 } });
  assert.equal(L.majorityResult(sq(['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null])), null, 'only a full board');
});

test('after a match the setup is kept for the next one', () => {
  const st = L.newMatch(lcg(5), { names: { X: 'Ann', O: 'Ben' }, games: ['ttt', 'hex'] });
  st.squares[0].mini = oneMove(); st.squares[1].mini = oneMove(); st.squares[2].mini = oneMove();
  turn(st, 0, 0); turn(st, 3, 0); turn(st, 1, 0); turn(st, 3, 1); turn(st, 2, 0);
  assert.equal(st.screen, 'win');
  st.screen = 'setup';                       // what "New match" does
  assert.deepEqual(st.setup.names, { X: 'Ann', O: 'Ben' });
  assert.deepEqual(L.enabledGames(st.setup), ['ttt', 'hex']);
  assert.equal(L.startMatch(st, lcg(6)), true);
  assert.equal(st.winner, null);
  assert.equal(st.moves, 0);
  assert.ok(st.squares.every(s => !s.owner && ['ttt', 'hex'].includes(s.mini.type)));
});

// ================================ After a move ================================
test('after a move the result shows, then the board comes back on its own and the turn passes', () => {
  const st = matchWith(['ttt', 'bs', 'ttt']);
  assert.equal(L.playMove(st, 0, 4).ok, true);
  assert.equal(st.turn, 'X', 'still X while the result plays');
  assert.equal(st.done, st.flash, 'the move is on record for the handoff');
  assert.equal(st.done.next, 'O');
  assert.equal(L.leaveSquare(st), false, 'nothing leaves while the result is playing');
  assert.deepEqual(L.playMove(st, 0, 5), { ok: false, reason: 'busy' });
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'busy' });
  assert.equal(L.endFlash(st), true);
  assert.equal(st.screen, 'board', 'the board is back');
  assert.equal(st.zoom, null);
  assert.equal(st.flash, null);
  assert.equal(st.done, null);
  assert.equal(st.turn, 'O', 'and the turn has passed');
  assert.equal(st.stamp, null, 'nothing was claimed');
  assert.equal(st.moves, 1);
  assert.equal(L.playMove(st, 0, 5).ok, true, 'O can move');
  assert.equal(st.flash.by, 'O');
  L.endFlash(st);
  assert.equal(st.turn, 'X');
});

test('the result can be held a moment longer: then the board follows and the turn passes', () => {
  const st = matchWith(['memory', 'ttt']);
  const cards = st.squares[0].mini.cards;
  let a = 0, b = 1;
  if (cards[a].s === cards[b].s && cards[a].c === cards[b].c) b = 2;   // avoid the pair
  assert.equal(L.playMove(st, 0, [a, b]).ok, true);
  L.endFlash(st, true);
  assert.equal(st.screen, 'mini', 'the two cards turn back over first');
  assert.equal(st.turn, 'X');
  assert.ok(st.done);
  assert.deepEqual(L.playMove(st, 1, 0), { ok: false, reason: 'done' });
  assert.equal(L.leaveSquare(st), true);
  assert.equal(st.screen, 'board');
  assert.equal(st.turn, 'O');
  assert.deepEqual(st.squares[0].mini.seen.slice().sort(), [a, b].sort(), 'the cards shown are remembered');
});

test('just looking at a square, or at a claimed one, never passes the turn', () => {
  const st = matchWith(['ttt', 'bs']);
  st.squares[1].owner = 'O';
  st.screen = 'mini'; st.zoom = 1;                  // what tapping a square does
  assert.equal(L.leaveSquare(st), true);
  assert.equal(st.turn, 'X');
  assert.equal(st.screen, 'board');
  assert.equal(st.moves, 0);
  st.screen = 'mini'; st.zoom = 0;
  L.leaveSquare(st);
  assert.equal(st.turn, 'X');
});

test('a claim stamps in on the board as it comes back', () => {
  const st = matchWith(['bs', 'ttt']);
  st.squares[0].mini = oneMove();
  L.playMove(st, 0, 0);
  assert.equal(st.flash.kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
  L.endFlash(st);
  assert.equal(st.screen, 'board');
  assert.equal(st.stamp, 0, 'the mark stamps onto square 1');
  assert.equal(st.turn, 'O');
  st.screen = 'mini'; st.zoom = 0;                  // O looks at the claimed square
  L.leaveSquare(st);
  assert.equal(st.stamp, null, 'the stamp plays once');
  assert.equal(st.turn, 'O');
});

test('a bonus move keeps the player in the square until the move ends', () => {
  const st = matchWith(['pig', 'ttt']);
  const die = (...faces) => seq(...faces.map(n => pick(n - 1, 6)));
  L.playMove(st, 0, 'roll', die(3));
  assert.equal(st.done, null, 'a roll is not the end of the move');
  L.endFlash(st);
  assert.equal(st.screen, 'mini');
  assert.equal(L.leaveSquare(st), false, 'the turn in progress has to be finished');
  assert.equal(L.playMove(st, 0, 'bank').ok, true);
  assert.equal(st.done.next, 'O');
  assert.equal(st.turn, 'X');
  L.endFlash(st);
  assert.equal(st.lock, null);
  assert.equal(st.screen, 'board');
  assert.equal(st.turn, 'O');
});

test('a match-winning move goes straight to the win screen', () => {
  const st = matchWith(['bs', 'bs', 'bs', 'ttt']);
  for (let i = 0; i < 3; i++) st.squares[i].mini = oneMove();
  turn(st, 0, 0); turn(st, 3, 0); turn(st, 1, 0); turn(st, 3, 1);
  assert.equal(st.turn, 'X');
  L.playMove(st, 2, 0);
  assert.equal(st.winner, 'X');
  assert.equal(st.done, null);
  L.endFlash(st);
  assert.equal(st.screen, 'win');
  assert.equal(L.leaveSquare(st), false);
});

test('a new match clears any result still on show', () => {
  const st = matchWith(['ttt']);
  L.playMove(st, 0, 0); L.endFlash(st, true);
  assert.ok(st.done);
  st.screen = 'setup';
  assert.equal(L.startMatch(st, lcg(4)), true);
  assert.equal(st.done, null);
  assert.equal(st.stamp, null);
  assert.equal(st.turn, 'X');
});

// a legal random move for any mini-game
function randomMove(m, rng, p) {
  const pickFrom = a => a[Math.floor(rng() * a.length)];
  const empties = (arr, ok) => arr.map((c, k) => (ok(c) ? k : -1)).filter(k => k >= 0);
  switch (m.type) {
    case 'ttt': case 'hex': return pickFrom(empties(m.cells, c => !c));
    case 'c4': return pickFrom(Array.from({ length: L.C4.cols }, (_, c) => c).filter(c => !m.cells[c]));
    case 'hexapawn': return pickFrom(L.hpMoves(m.cells, p));
    case 'mastermind': return pickFrom(L.mmCandidates(L.publicMini(m))).slice();   // a random code still possible: legal, and the square gets cracked
    case 'bs': return pickFrom(empties(m.revealed, c => !c));
    case 'wordle': return rng() < 0.2 ? m.word : pickFrom(L.WORDS5).toUpperCase();
    case 'hangman': return pickFrom('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !m.letters.some(x => x.l === l)));
    case 'dice': case 'candy': return 1;
    case 'snakes': return 'roll';
    case 'bump': return 'spin';
    case 'hilo': return m.lo + Math.floor(rng() * (m.hi - m.lo + 1));
    case 'memory': { const a = Math.floor(rng() * 9); let b = Math.floor(rng() * 8); if (b >= a) b++; return [a, b]; }
    case 'coins': return 'flip';
    case 'pig': {
      if (!m.turn) return 'roll';
      if (m.turn.rolls.length >= L.RISKY.maxRolls || m.bank[p] + m.turn.pot >= L.RISKY.goal) return 'bank';
      return rng() < 0.5 ? 'roll' : 'bank';
    }
    case 'hunt': return pickFrom(empties(m.dug, c => !c));
    case 'bj': return !m.hand ? 'deal' : pickFrom(m.hand.cards.length === 2 ? ['hit', 'stand', 'double'] : ['hit', 'stand']);
    case 'bus': return pickFrom(L.BUS.guesses[m.prog[p].length]);
    case 'rl': {
      const r = rng();
      if (r < 0.1) return 'zero';
      if (r < 0.55) return pickFrom(['g1', 'g2', 'g3']);
      const nums = [];
      while (nums.length < 8) { const n = 1 + Math.floor(rng() * 24); if (!nums.includes(n)) nums.push(n); }
      return nums;
    }
    case 'bullseye': return { x: Math.round(rng() * 1000) / 1000, y: Math.round(rng() * 1000) / 1000 };
    case 'echo': { const seq = m.seqs[p][Math.min(m.level[p], 3)]; return rng() < 0.5 ? seq.slice() : seq.slice(0, Math.floor(rng() * seq.length)).concat(Math.floor(rng() * 4)); }
    case 'plinko': return Math.floor(rng() * 7);
    case 'pong': return { aim: rng() * 2 - 1, power: rng() };
    case 'trivia': { if (!m.ask) return 'auto'; const left = [0, 1, 2, 3].filter(k => !(m.crossed || []).includes(k)); return left.length ? left[Math.floor(rng() * left.length)] : 'auto'; }
    case 'oddone': return Math.floor(rng() * m.grid[p].n * m.grid[p].n);
    case 'dash': case 'lane': return rng() < 0.3 ? 'auto' : L.runAuto(m, p, rng);   // a timed-out run, or a short run as the engine itself makes one
    case 'golf': case 'pool': case 'bowling': return L.physRandom(m, p, rng);        // a random gentle shot
    default: return L.randomLegalMove(m, p, rng);                                       // the newer games: the engine's own random move
  }
  throw new Error('no move for ' + m.type);
}

test('random play over many matches always finishes, never shows a removed game, and keeps state plain JSON', () => {
  const rng = lcg(2024);
  const types = new Set();
  for (let game = 0; game < 60; game++) {
    const st = L.newMatch(rng);
    st.squares.forEach(s => types.add(s.mini.type));
    let guard = 0;
    while (!st.winner && guard++ < 5000) {
      const cands = st.squares.map((s, i) => (!s.owner && L.canMove(s.mini, st.turn) ? i : -1)).filter(i => i >= 0);
      const i = st.lock != null ? st.lock : cands[Math.floor(rng() * cands.length)];
      assert.ok(i != null, 'the player to move always has somewhere to play');
      const m = st.squares[i].mini;
      const r = L.playMove(st, i, randomMove(m, rng, st.turn), rng);
      assert.equal(r.ok, true, `${m.type}: ${r.reason}`);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
      if (st.flash.kind === 'again') assert.equal(st.lock, i);
      else assert.equal(st.lock, null);
      if (st.flash.newType) types.add(st.flash.newType);
      const mover = st.turn, again = st.flash.kind === 'again', pass = !!st.flash.pass;
      L.endFlash(st);
      if (!st.winner) {
        assert.equal(st.done, null);
        assert.equal(st.screen, again ? 'mini' : 'board');
        assert.equal(st.turn, again || pass ? mover : L.other(mover), 'the turn passes as the board comes back (unless the other side has no move anywhere)');
      }
    }
    assert.ok(st.winner, 'random play finishes a match');
    assert.equal(st.screen, 'win');
  }
  assert.deepEqual([...types].sort(), [...L.TYPES].sort(), 'every current game type showed up');
  for (const t of REMOVED) assert.ok(!types.has(t));
});

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
const tttOf = (...cells) => Object.assign(mini('ttt'), { cells: cells.map(c => c || null) });

test('setup: each side is a Human or Computer slot; a computer is called Computer; any combination plays', () => {
  const st = L.newState(lcg(1));
  assert.equal(st.setup.mode, 'two');
  assert.deepEqual(st.setup.players, { X: 'human', O: 'human' }, 'two people by default');
  assert.equal(L.cpuSide(st.setup), null);
  st.setup.players.O = 'cpu';
  L.syncNames(st.setup);
  assert.equal(L.cpuSide(st.setup), 'O');
  assert.deepEqual(st.setup.names, { X: 'X', O: L.CPU_NAME }, 'a computer slot is called Computer');
  st.setup.players.X = 'cpu';
  L.syncNames(st.setup);
  assert.equal(L.cpuSide(st.setup), 'XO', 'the computer can play both sides');
  assert.deepEqual(st.setup.names, { X: L.CPU_NAME, O: L.CPU_NAME });
  st.setup.names.X = 'HAL';
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'HAL', 'a typed name stays');
  st.setup.players.X = 'human';
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'HAL');
  st.setup.names.X = L.CPU_NAME;
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'X', 'a human slot drops the default computer name');
  for (const [players, cpu] of [[{ X: 'human', O: 'human' }, null], [{ X: 'human', O: 'cpu' }, 'O'], [{ X: 'cpu', O: 'human' }, 'X'], [{ X: 'cpu', O: 'cpu' }, 'XO']]) {
    const m = L.newMatch(lcg(3), { players });
    assert.equal(m.cpu, cpu, JSON.stringify(players));
    assert.equal(m.turn, 'X', 'X always moves first');
  }
  // setups saved before the slots: "vs Computer, you play O" becomes a Computer X slot
  const old = L.newMatch(lcg(3), { mode: 'cpu', human: 'O' });
  assert.equal(old.cpu, 'X');
  assert.deepEqual(old.setup.players, { X: 'cpu', O: 'human' });
  assert.equal(old.setup.mode, 'two');
  assert.deepEqual(L.normSetup({ mode: 'cpu', human: 'X', names: {} }).players, { X: 'human', O: 'cpu' });
  assert.equal(L.cpuSide({ mode: 'online', players: { X: 'cpu', O: 'cpu' } }), null, 'never in online play');
  assert.equal(L.newMatch(lcg(3)).cpu, null);
});

test('the public view of every mini-game holds nothing hidden', () => {
  const rng = lcg(9);
  for (const t of L.TYPES) {
    const m = L.newMini(t, rng);
    const pm = L.publicMini(m);
    const text = JSON.stringify(pm);
    assert.equal(pm.type, t);
    if (t === 'wordle' || t === 'hangman') assert.ok(!text.includes(m.word), `${t}: the word is hidden`);
    if (t === 'hilo') assert.ok(!('target' in pm));
    if (t === 'bs') assert.ok(!('ship' in pm) && pm.len === m.len, 'the ship\'s size is shown, not its place');
    if (t === 'hunt') assert.ok(!('treasure' in pm));
    if (t === 'memory') assert.ok(pm.cards.every(c => c === null), 'no card is known before any is shown');
    if (t === 'mastermind') assert.ok(!('code' in pm), 'the code is hidden');
    if (t === 'hangman') assert.ok(pm.pattern.every(ch => ch === null));
  }
  // what has been shown is public: a found letter, a dug cell's distance, a card once flipped
  const h = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  L.applyMove(h, 'X', 'P');
  assert.deepEqual(L.publicMini(h).pattern, [null, 'P', 'P', null, null]);
  const u = L.newMini('hunt', seq(pick(14, 36)));
  L.applyMove(u, 'X', 0);
  assert.equal(L.publicMini(u).clues[0], 3, 'four steps away: Cool, the band and not the distance');
  assert.equal(L.publicMini(u).clues[1], null);
  const mem = mini('memory');
  L.applyMove(mem, 'X', [3, 5]);
  const pmem = L.publicMini(mem);
  assert.deepEqual(pmem.seen, [3, 5]);
  assert.deepEqual(pmem.cards[3], mem.cards[3]);
  assert.equal(pmem.cards[0], null);
});

test('the computer cannot tell hidden information apart: same public view, same move', () => {
  const rng = lcg(5);
  const twins = [
    () => [L.newMini('wordle', wordRng(L.WORDS5, 'crane')), L.newMini('wordle', wordRng(L.WORDS5, 'house'))],
    () => [L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple')), L.newMini('hangman', wordRng(L.WORDS_HANG, 'melon'))],
    () => [L.newMini('hilo', seq(pick(2, 20))), L.newMini('hilo', seq(pick(17, 20)))],
    () => [bsAt(0, 1, 2), bsAt(13, 14, 15)],
    () => [L.newMini('hunt', seq(pick(0, 25))), L.newMini('hunt', seq(pick(24, 25)))],
    () => { const a = mini('memory'), b = mini('memory', lcg(77)); return [a, b]; },
  ];
  for (const make of twins) {
    const [a, b] = make();
    assert.equal(a.type, b.type);
    const sa = cpuMatch('X', [a, 'ttt', 'ttt']), sb = cpuMatch('X', [b, 'ttt', 'ttt']);
    for (let k = 0; k < 3; k++) {
      const ma = L.cpuMove(sa, lcg(k)), mb = L.cpuMove(sb, lcg(k));
      assert.deepEqual(mb, ma, `${a.type}: the move only depends on what can be seen`);
      // make the same move in both and compare again (hidden results may differ; only public parts may steer)
      const r = L.playMove(sa, ma.square, ma.move, lcg(k + 50)); L.endFlash(sa);
      L.playMove(sb, mb.square, mb.move, lcg(k + 50)); L.endFlash(sb);
      if (!r.ok || sa.winner || sb.winner || sa.squares[ma.square].owner || sb.squares[mb.square].owner) break;
      sa.turn = 'X'; sb.turn = 'X'; sa.lock = null; sb.lock = null;
      if (JSON.stringify(L.publicMini(sa.squares[0].mini)) !== JSON.stringify(L.publicMini(sb.squares[0].mini))) break;   // the clues now differ
    }
  }
});

test('the computer only ever makes legal moves, from any position and in bonus moves', () => {
  const rng = lcg(606);
  let moves = 0;
  for (let game = 0; game < 25; game++) {
    const st = L.newMatch(rng);
    // some random play by both sides first, then the computer takes over each side in turn
    for (let k = 0; k < 8 && !st.winner; k++) {
      const cands = st.squares.map((s, i) => (!s.owner && L.canMove(s.mini, st.turn) ? i : -1)).filter(i => i >= 0);
      const i = st.lock != null ? st.lock : cands[Math.floor(rng() * cands.length)];
      assert.equal(L.playMove(st, i, randomMove(st.squares[i].mini, rng, st.turn), rng).ok, true);
      L.endFlash(st);
    }
    let guard = 0;
    while (!st.winner && guard++ < 400) {
      const m = L.cpuMove(st, rng);
      assert.ok(m && Number.isInteger(m.square), 'a square is chosen');
      assert.equal(st.squares[m.square].owner, null, 'never a claimed square');
      if (st.lock != null) assert.equal(m.square, st.lock, 'a bonus move stays in its square');
      const r = L.playMove(st, m.square, m.move, rng);
      assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
      moves++;
      L.endFlash(st);
    }
    assert.ok(st.winner, 'the match finishes');
  }
  assert.ok(moves > 500);
});

test('square values: a match-winning square first, then one the opponent would win, then open lines', () => {
  const st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].owner = 'X'; st.squares[1].owner = 'X';
  assert.equal(L.squareValue(st.squares, 2, 'X'), L.AI.win);
  assert.ok(L.squareValue(st.squares, 2, 'O') >= L.AI.block && L.squareValue(st.squares, 2, 'O') < L.AI.win);
  st.squares[3].owner = 'O'; st.squares[4].owner = 'O';
  assert.equal(L.squareValue(st.squares, 5, 'O'), L.AI.win);
  assert.ok(L.squareValue(st.squares, 5, 'X') >= L.AI.block);
  assert.ok(L.squareValue(st.squares, 2, 'X') > L.squareValue(st.squares, 5, 'X'), 'winning beats blocking');
  // a square on no open line for either side is worth almost nothing
  const dead = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  ['X', 'O', 'X', 'O', null, 'X', 'O', 'X', 'O'].forEach((o, i) => { dead.squares[i].owner = o; });
  assert.ok(L.squareValue(dead.squares, 4, 'X') < 1.5, `dead centre worth ${L.squareValue(dead.squares, 4, 'X')}`);
  const fresh = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  assert.ok(L.squareValue(fresh.squares, 4, 'X') > L.squareValue(fresh.squares, 1, 'X'), 'the centre sits on more open lines');
});

test('the computer always takes a square that wins the match, in any game that allows it', () => {
  // X owns 0 and 1; square 2 can be claimed at once in several games; square 5 is a tempting ttt threat
  const wins = [
    tttOf('X', 'X', null, 'O', null, null, null, null, null),
    Object.assign(mini('hilo'), { lo: 7, hi: 7, target: 7, guesses: [{ by: 'O', n: 6, res: 'higher' }, { by: 'O', n: 8, res: 'lower' }] }),
    Object.assign(mini('pig'), { bank: { X: 16, O: 0 }, turn: { by: 'X', rolls: [5], pot: 5 } }),
    Object.assign(L.newMini('hex', lcg(1)), { cells: ['X', 'X', 'X', null, null, null, null, null, null, null, null, null, null, null, null, null] }),
  ];
  for (const sq2 of wins) {
    const st = cpuMatch('X', ['ttt', 'ttt', sq2, 'ttt', 'ttt', tttOf('O', 'O', null), 'ttt', 'ttt', 'ttt'], ['X', 'X']);
    if (sq2.type === 'pig') st.lock = 2;
    const m = L.cpuMove(st, cpuRng());
    assert.equal(m.square, 2, `${sq2.type}: goes for the match`);
    const r = L.playMove(st, m.square, m.move, cpuRng());
    assert.equal(r.ok, true);
    assert.equal(st.winner, 'X', `${sq2.type}: and wins it`);
  }
  // a known Memory pair and a Wordle with one word left also win on the spot
  const mem = mini('memory');
  const pairIdx = (() => { const seen = new Map(); let p = null; mem.cards.forEach((c, i) => { const k = c.s + c.c; if (seen.has(k)) p = [seen.get(k), i]; else seen.set(k, i); }); return p; })();
  mem.seen = pairIdx.slice();
  const stm = cpuMatch('X', ['ttt', 'ttt', mem, 'ttt', 'ttt', tttOf('O', 'O', null)], ['X', 'X']);
  const mm = L.cpuMove(stm, cpuRng());
  assert.equal(mm.square, 2);
  assert.deepEqual(mm.move.slice().sort(), pairIdx.slice().sort());
  const w = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  for (const g of ['CRANK', 'CRATE']) L.applyMove(w, 'O', g);
  const cands = L.wordleCandidates(L.publicMini(w));
  if (cands.length === 1) {
    const stw = cpuMatch('X', ['ttt', 'ttt', w, 'ttt', 'ttt', tttOf('O', 'O', null)], ['X', 'X']);
    const mw = L.cpuMove(stw, cpuRng());
    assert.equal(mw.square, 2);
    assert.equal(mw.move, 'CRANE');
  }
});

test('the computer always defends a square the opponent is one move from winning the match with', () => {
  // O owns 3 and 4; square 5 holds the opponent's threat in a game that can be blocked
  const threats = [
    [tttOf('O', 'O', null, 'X', null, null, null, null, null), 2],
    [(() => { const c = mini('c4'); for (const [p, col] of [['O', 0], ['O', 1], ['O', 2], ['X', 0], ['X', 1]]) L.applyMove(c, p, col); return c; })(), 3],
    [Object.assign(L.newMini('hex', lcg(1)), { cells: ['O', null, null, null, 'O', null, null, null, 'O', null, null, null, null, null, null, null] }), 12],
  ];
  for (const [sq5, block] of threats) {
    // elsewhere X has its own progress to tempt it away: square 0 is a ttt with two X marks
    const st = cpuMatch('X', [tttOf('X', 'X', null, 'O', 'O', null), 'ttt', 'ttt', 'ttt', 'ttt', sq5, 'ttt', 'ttt', 'ttt'], [null, null, null, 'O', 'O']);
    const m = L.cpuMove(st, cpuRng());
    assert.equal(m.square, 5, `${sq5.type}: defends the threatened square`);
    assert.equal(m.move, block, `${sq5.type}: with the blocking move`);
    assert.equal(L.playMove(st, m.square, m.move, cpuRng()).ok, true);
  }
  // ...unless it can win the match itself right now
  const st = cpuMatch('X', ['ttt', 'ttt', tttOf('X', 'X', null), 'ttt', 'ttt', tttOf('O', 'O', null), 'ttt', 'ttt', 'ttt'], ['X', 'X', null, 'O', 'O']);
  const m = L.cpuMove(st, cpuRng());
  assert.equal(m.square, 2, 'winning comes first');
  assert.equal(m.move, 2);
  L.playMove(st, m.square, m.move);
  assert.equal(st.winner, 'X');
});

test('tic-tac-toe tactics: win now, else block, else take the best minimax move', () => {
  const win = L.localBest({ type: 'ttt', cells: ['X', 'X', null, 'O', 'O', null, null, null, null] }, 'X', cpuRng());
  assert.equal(win.move, 2); assert.equal(win.win, true);
  const block = L.localBest({ type: 'ttt', cells: ['O', 'O', null, 'X', null, null, null, null, null] }, 'X', cpuRng());
  assert.equal(block.move, 2);
  const fork = L.localBest({ type: 'ttt', cells: ['X', null, null, null, 'O', null, null, null, 'X'] }, 'O', cpuRng());
  assert.ok([1, 3, 5, 7].includes(fork.move), 'O must take an edge against the corner fork');
  const empty = L.localBest({ type: 'ttt', cells: new Array(9).fill(null) }, 'X', cpuRng());
  assert.equal(empty.move, 4, 'the centre from an empty board');
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

test('hex tactics: connects when one cell short and blocks the opponent\'s last link', () => {
  const cells = ['X', 'X', 'X', null, null, null, null, null, null, null, null, null, null, null, null, null];
  assert.equal(L.hexDist(cells, 'X'), 1);
  const win = L.localBest({ type: 'hex', cells }, 'X', cpuRng());
  assert.equal(win.move, 3); assert.equal(win.win, true);
  const block = L.localBest({ type: 'hex', cells }, 'O', cpuRng());
  assert.equal(block.move, 3, 'O takes the last cell of the row');
  const col = ['O', null, null, null, 'O', null, null, null, 'O', null, null, null, null, null, null, null];   // down the left edge: only cell 12 finishes it
  assert.equal(L.hexDist(col, 'O'), 1);
  assert.equal(L.localBest({ type: 'hex', cells: col }, 'X', cpuRng()).move, 12);
  const fork = [null, 'O', null, null, null, 'O', null, null, null, 'O', null, null, null, null, null, null];     // two cells finish it: nothing stops O
  assert.equal(L.hexDist(fork, 'O'), 1);
  assert.ok(L.localBest({ type: 'hex', cells: fork }, 'X', cpuRng()).v < -500, 'X knows the square is lost');
  assert.equal(L.hexDist(new Array(16).fill(null), 'X'), 4);
  assert.equal(L.hexDist(['O', 'O', 'O', 'O', null, null, null, null, null, null, null, null, null, null, null, null], 'O'), 3, 'a row does not help O');
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

test('wordle tactics: guesses stay consistent with the feedback and the last word is taken', () => {
  const w = L.newMini('wordle', wordRng(L.WORDS5, 'crane'));
  L.applyMove(w, 'O', 'CRATE');
  const cand = L.wordleCandidates(L.publicMini(w));
  assert.ok(cand.includes('CRANE'));
  assert.ok(cand.every(x => x.startsWith('CRA') && x.endsWith('E') && x[3] !== 'T'));
  const st = cpuMatch('X', [w, 'ttt']);
  const mv = L.cpuMove(st, cpuRng());
  assert.ok(cand.includes(mv.move), `guess ${mv.move} fits`);
  assert.equal(L.playMove(st, 0, mv.move).ok, true);
  const fresh = L.localBest(L.publicMini(L.newMini('wordle', wordRng(L.WORDS5, 'house'))), 'X', cpuRng());
  assert.ok(L.VALID5.has(fresh.move) && L.WORDS5.includes(fresh.move.toLowerCase()), 'the opening guess is a real common word');
});

test('hangman tactics: the letter most common among the words still possible, and a known word is finished in one move', () => {
  const h = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  const pm = L.publicMini(h);
  const cand = L.hangmanCandidates(pm);
  assert.ok(cand.includes('APPLE') && cand.every(x => x.length === 5));
  const count = {};
  for (const x of cand) for (const ch of new Set(x)) count[ch] = (count[ch] || 0) + 1;
  const top = Math.max(...Object.values(count));
  const mv = L.localBest(pm, 'X', cpuRng()).move;
  assert.equal(count[mv], top, `${mv} is a most common letter`);
  // narrowed to one word: every guess hits and the square is claimed in a single move
  for (const l of ['A', 'P']) L.applyMove(h, 'O', l);
  L.applyMove(h, 'O', 'Z');
  const left = L.hangmanCandidates(L.publicMini(h));
  if (left.length === 1) {
    const st = cpuMatch('X', [h, 'ttt']);
    let guard = 0, f;
    do { const m = L.cpuMove(st, cpuRng()); f = L.playMove(st, m.square, m.move).flash; L.endFlash(st); } while (f.kind === 'again' && guard++ < 10);
    assert.equal(f.kind, 'claim');
    assert.equal(st.squares[0].owner, 'X');
  }
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

test('coin flip, higher/lower and pig tactics', () => {
  const coins = L.localBest({ type: 'coins', coins: ['X', 'O', 'O', '?', 'O'] }, 'X', cpuRng());
  assert.equal(coins.move, 'flip');
  assert.equal(coins.q, 0, 'four to turn: no chance of finishing this move');
  assert.equal(L.localBest({ type: 'coins', coins: ['X', 'X', 'X', 'X', '?'] }, 'X', cpuRng()).q, 0.5);
  assert.equal(L.localBest({ type: 'hilo', lo: 1, hi: 20, guesses: [] }, 'X', cpuRng()).move, 10);
  assert.equal(L.localBest({ type: 'hilo', lo: 11, hi: 20, guesses: [] }, 'X', cpuRng()).move, 15);
  assert.equal(L.localBest({ type: 'hilo', lo: 7, hi: 7, guesses: [] }, 'X', cpuRng()).q, 1);
  const pig = (bank, oppBank, turn) => L.localBest({ type: 'pig', bank: { X: bank, O: oppBank }, turn }, 'X', cpuRng()).move;
  assert.equal(pig(0, 0, null), 'roll', 'a move starts with a roll');
  assert.equal(pig(0, 0, { by: 'X', rolls: [3], pot: 3 }), 'roll', 'keeps rolling with a small pot');
  assert.equal(pig(0, 0, { by: 'X', rolls: [6, 4], pot: 10 }), 'bank', 'banks around 8 to 10');
  assert.equal(pig(0, 10, { by: 'X', rolls: [6, 4], pot: 10 }), 'roll', 'bolder when behind');
  assert.equal(pig(10, 0, { by: 'X', rolls: [4, 3], pot: 7 }), 'bank', 'safer when ahead');
  assert.equal(pig(0, 0, { by: 'X', rolls: [1, 2, 3, 4], pot: 10 }), 'bank', 'too many bust numbers');
  assert.equal(pig(0, 0, { by: 'X', rolls: [1, 2, 3, 4, 5, 6], pot: 21 }), 'bank', 'never a seventh roll');
  assert.equal(pig(16, 0, { by: 'X', rolls: [5], pot: 5 }), 'bank', 'always banks a win');
  assert.equal(pig(19, 0, { by: 'X', rolls: [2], pot: 2 }), 'bank');
  assert.equal(pig(15, 0, { by: 'X', rolls: [5], pot: 5 }), 'roll', '20 is one short of 21');
});

test('candy race and dice race: the odds are read from the public state', () => {
  const E = L.candyExpected(['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow']);
  assert.ok(E[0] > 1 && E[0] < 4, `start: ${E[0]} spins expected`);
  assert.ok(E[12] >= 1 && E[12] < E[0], 'closer to the finish, fewer spins');
  assert.equal(E[13], 0);
  const noBlue = L.localBest({ type: 'candy', track: ['red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'green', 'yellow'], pos: { X: 9, O: -1 } }, 'X', cpuRng());
  assert.equal(noBlue.q, 0.5, 'blue or red from space 10 goes straight to the finish');
  assert.equal(L.localBest({ type: 'dice', totals: { X: 12, O: 0 } }, 'X', cpuRng()).q, 3 / 6, 'four spaces short: a 4, 5 or 6 finishes');
  assert.equal(L.localBest({ type: 'dice', totals: { X: 0, O: 0 } }, 'X', cpuRng()).q, 0);
  assert.ok(L.needsOf({ type: 'dice', totals: { X: 12, O: 0 } }, 'X') < L.needsOf({ type: 'dice', totals: { X: 0, O: 0 } }, 'X'));
  assert.equal(L.winChance(0, 3), 1); assert.equal(L.winChance(3, 0), 0); assert.equal(L.winChance(2, 2), 0.5); assert.equal(L.winChance(Infinity, Infinity), 0.5);
});

test('the computer prefers finishing a square it is close to over one it is far from, and ignores lost squares', () => {
  const close = tttOf('X', 'X', null, 'O', null, null, null, null, null);      // one move from claiming
  const far = tttOf(null, null, null, null, null, null, null, null, null);
  const lost = tttOf('O', 'O', null, 'X', 'O', 'X', 'X', null, null);         // O finishes at 2 or 8: nothing X does saves it
  const st = cpuMatch('X', [far, close, 'dice', lost, 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  const m = L.cpuMove(st, cpuRng());
  assert.equal(m.square, 1);
  assert.equal(m.move, 2);
  // with the near square gone, disrupting a square O is about to take beats an empty square
  st.squares[1].owner = 'X';
  st.squares[3].mini = tttOf('O', 'O', null, 'X', null, null, null, null, 'X');   // one threat, and the block builds X a line
  const m2 = L.cpuMove(st, cpuRng());
  assert.equal(m2.square, 3, 'disrupts the square O is about to take');
  assert.equal(m2.move, 2);
  // the lost square never draws a move while anything else is open
  st.squares[3].mini = lost;
  for (let k = 0; k < 3; k++) {
    const mk = L.cpuMove(st, lcg(k));
    assert.notEqual(mk.square, 3, 'no move wasted on a lost square');
  }
});

test('computer against computer: matches finish, every move is legal, and the state stays plain JSON', () => {
  const rng = lcg(2025);
  const winners = { X: 0, O: 0, draw: 0 }, seen = new Set();
  for (let game = 0; game < 8; game++) {
    const st = L.newMatch(rng, { mode: 'cpu', human: game % 2 ? 'X' : 'O' });
    assert.equal(st.cpu, game % 2 ? 'O' : 'X');
    st.cpu = null;                                   // both sides are played by cpuMove below
    let guard = 0;
    while (!st.winner && guard++ < 600) {
      const m = L.cpuMove(st, rng);
      const r = L.playMove(st, m.square, m.move, rng);
      assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
      seen.add(st.flash.type);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
      L.endFlash(st);
    }
    assert.ok(st.winner, `match ${game} finishes (${guard} moves)`);
    assert.equal(st.screen, 'win');
    winners[st.winner]++;
    if (st.winner === 'draw') assert.equal(st.winReason, 'blocked', 'a draw: no line left for either side');
  }
  assert.equal(winners.X + winners.O + winners.draw, 8);
  assert.ok(seen.size >= 8, `the computer played ${seen.size} different games`);
});


// ---- the online turn clock: a random legal move on a timeout, a loss on the second in a row ----
test('newTimer and the timer options', () => {
  assert.deepEqual(L.TIMER_OPTIONS, [0, 60], 'a friend game: no limit or 1 minute');
  assert.deepEqual([0, 60, 30, 180, 45, null].map(L.normTimer), [0, 60, 60, 60, 0, 0], 'an older 30 s or 3 min room becomes 1 minute');
  const t = L.newTimer(60);
  assert.deepEqual(t, { limit: 60, deadline: null, for: null, pausedAt: null, timeouts: { X: 0, O: 0 }, streak: { X: 0, O: 0 }, bankNext: false });
  assert.equal(L.newTimer(0).limit, 0);
  assert.equal(L.newTimer().limit, 0);
  const st = L.newMatch(lcg(1), { mode: 'online', timer: 60 });
  assert.equal(st.timer.limit, 60, 'an online match keeps the chosen limit');
  assert.equal(L.newMatch(lcg(1), { mode: 'online', timer: 30 }).timer.limit, 60);
  const two = L.newMatch(lcg(1), { mode: 'two', timer: 60 });
  assert.equal(two.timer.limit, 0, 'local matches have no clock');
  const bad = L.newMatch(lcg(1), { mode: 'online', timer: 45 });
  assert.equal(bad.timer.limit, 0, 'an unknown limit means no limit');
});

test('randomLegalMove is legal in every mini-game, many times over', () => {
  const rng = lcg(77);
  for (const type of L.TYPES) {
    for (let k = 0; k < 40; k++) {
      const mini = L.newMini(type, rng);
      // play a few random moves first so the position is not always fresh
      let p = 'X';
      for (let j = 0; j < 3; j++) {
        if (!L.canMove(mini, p)) break;
        const m = L.randomLegalMove(mini, p, rng);
        const r = L.applyMove(mini, p, m, rng);
        assert.equal(r.ok, true, `${type}: random move ${JSON.stringify(m)} refused (${r.reason})`);
        if (r.outcome !== 'continue') break;
        if (!r.again) p = L.other(p);
      }
    }
  }
});

test('a random wordle move is a dictionary word, a random hangman letter is unguessed, pig banks a pot it holds', () => {
  const rng = lcg(5);
  const w = L.newMini('wordle', rng);
  for (let k = 0; k < 20; k++) assert.ok(L.VALID5.has(L.randomLegalMove(w, 'X', rng)), 'a word from the dictionary');
  const h = L.newMini('hangman', rng);
  h.letters.push({ l: 'A', hit: false }, { l: 'E', hit: true });
  for (let k = 0; k < 30; k++) assert.ok(!['A', 'E'].includes(L.randomLegalMove(h, 'X', rng)), 'never a letter already tried');
  const pg = L.newMini('pig', rng);
  assert.equal(L.randomLegalMove(pg, 'X', rng), 'roll', 'nothing to bank yet');
  pg.turn = { by: 'X', pot: 7, rolls: 2 };
  assert.equal(L.randomLegalMove(pg, 'X', rng), 'bank');
  assert.equal(L.randomLegalMove(pg, 'O', rng), 'roll', 'the other player has no pot');
  const mem = L.newMini('memory', rng);
  for (let k = 0; k < 30; k++) { const [a, b] = L.randomLegalMove(mem, 'X', rng); assert.notEqual(a, b); assert.ok(a >= 0 && a < 9 && b >= 0 && b < 9); }
});

test('a timeout plays a random legal move, marks it, and the turn passes', () => {
  const st = matchWith(['ttt', 'c4', 'hex', 'bs', 'hunt', 'hilo', 'coins', 'dice', 'candy']);
  st.timer = L.newTimer(30);
  const r = L.timeoutMove(st, lcg(3));
  assert.equal(r.ok, true);
  assert.ok(st.flash, 'the move plays out like any other');
  assert.equal(st.flash.timeout, true, 'the result says it was forced');
  assert.equal(st.flash.square, r.square);
  assert.equal(st.timer.timeouts.X, 1);
  assert.equal(st.timer.streak.X, 1);
  assert.equal(st.moves, 1);
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'O', 'the turn passes');
  // O moves in time: O's streak stays 0; X's timeout streak is untouched by O's move
  const t2 = L.timeoutMove(st, lcg(4));
  assert.equal(t2.ok, true);
  assert.equal(st.timer.streak.O, 1);
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'X');
  // X plays in time now: the streak resets
  const open = st.squares.findIndex((sq, i) => !sq.owner && sq.mini.type === 'ttt' && st.lock == null);
  if (open >= 0 && st.lock == null) {
    const m = L.randomLegalMove(st.squares[open].mini, 'X', lcg(9));
    const rr = L.playMove(st, open, m, lcg(9));
    assert.equal(rr.ok, true);
    assert.equal(st.flash.timeout, false);
    assert.equal(st.timer.streak.X, 0, 'a move made in time clears the streak');
    assert.equal(st.timer.timeouts.X, 1, 'the count of timeouts stays');
  }
});

test('a second timeout in a row loses the match at once', () => {
  const st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.timer = L.newTimer(30);
  assert.equal(L.timeoutMove(st, lcg(1)).ok, true);          // X times out
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'O');
  const o = L.randomLegalMove(st.squares[8].mini, 'O', lcg(2));
  assert.equal(L.playMove(st, 8, o, lcg(2)).ok, true);        // O plays in time
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'X');
  const r = L.timeoutMove(st, lcg(3));                         // X times out again
  assert.deepEqual(r, { ok: true, lost: 'X' });
  assert.equal(st.winner, 'O');
  assert.equal(st.winReason, 'timeout');
  assert.equal(st.winLine, null);
  assert.equal(st.screen, 'win');
  assert.equal(st.flash, null);
  assert.equal(st.timer.timeouts.X, 2);
  assert.equal(L.timeoutMove(st, lcg(4)).ok, false, 'nothing more once the match is over');
  assert.equal(L.playMove(st, 0, 4, lcg(4)).ok, false);
});

test('timeouts by the two players do not add up to a loss; only a player\'s own consecutive ones do', () => {
  const st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.timer = L.newTimer(30);
  for (let k = 0; k < 2; k++) {
    const r = L.timeoutMove(st, lcg(10 + k));
    assert.equal(r.ok, true); assert.equal(r.lost, undefined);
    L.endFlash(st); L.leaveSquare(st);
  }
  assert.equal(st.winner, null);
  assert.deepEqual(st.timer.streak, { X: 1, O: 1 });
  assert.deepEqual(st.timer.timeouts, { X: 1, O: 1 });
});

test('a timed-out hangman letter never earns another go, even when it hits', () => {
  const st = matchWith(['hangman', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.timer = L.newTimer(30);
  st.lock = 0;                                                  // the player is already in the hangman square
  const word = st.squares[0].mini.word;
  // an rng that always picks the first unguessed letter: steer it to a hit
  const first = word[0];
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const rng = seq(0, pick(letters.indexOf(first), letters.length), 0.5);
  const r = L.timeoutMove(st, rng);
  assert.equal(r.ok, true);
  assert.equal(r.square, 0);
  assert.equal(r.move, first);
  assert.ok(st.squares[0].mini.letters.some(x => x.l === first && x.hit), 'the letter hit');
  assert.equal(st.flash.kind === 'again', false, 'no bonus move');
  L.endFlash(st); L.leaveSquare(st);
  assert.equal(st.turn, 'O', 'the turn passes');
  assert.equal(st.lock, null);
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

test('a timeout mid-bonus-move stays in the locked square', () => {
  const st = matchWith(['ttt', 'memory', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.timer = L.newTimer(30);
  st.lock = 1;
  const r = L.timeoutMove(st, lcg(8));
  assert.equal(r.ok, true);
  assert.equal(r.square, 1, 'the only square open to a locked player');
});

test('timeouts over every kind of game keep the state legal and plain', () => {
  const rng = lcg(31337);
  const seen = new Set();
  for (let game = 0; game < 6; game++) {
    const st = L.newMatch(rng, { mode: 'online', timer: 30, games: L.TYPES.filter(t => !['echo', 'trivia', 'oddone'].includes(t)) });   // (a timed-out attempt at those three is always a failed one: a square of theirs never falls to timeouts)
    let guard = 0;
    while (!st.winner && guard++ < 3000) {
      const open = st.squares.map((q, i) => (q.owner ? -1 : i)).filter(i => i >= 0);
      if (guard > 400 && st.lock == null && open.every(i => ['wordle', 'mastermind'].includes(st.squares[i].mini.type))) {
        // only long-shot squares are left (a random word or code rarely cracks them): the forced move finds the secret
        const m = st.squares[open[0]].mini;
        assert.equal(L.playMove(st, open[0], m.type === 'wordle' ? m.word.toLowerCase() : m.code.slice(), rng, { forced: true }).ok, true);
      } else if (st.timer.bankNext) { st.timer.bankNext = false; assert.equal(L.playMove(st, st.lock, 'bank', rng, { forced: true }).ok, true); }
      else {
        const r = L.timeoutMove(st, rng);
        assert.equal(r.ok, true, `timeout move failed: ${r.reason}`);
        if (r.lost) break;
        seen.add(st.flash.type);
        // the clock alternates with a timely move so the match does not end on streaks straight away
        st.timer.streak[st.flash.by] = game % 2 ? st.timer.streak[st.flash.by] : 0;
      }
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
      L.endFlash(st); L.leaveSquare(st);
    }
    assert.ok(st.winner, `match ${game} ends (${guard} moves)`);
  }
  assert.ok(seen.size >= 6, `timeouts were played in ${seen.size} different games`);
});


// ---- online match records: the public state and the secrets apart, moves applied to the pair ----
const SECRET_KEYS = { wordle: 'word', hangman: 'word', hilo: 'target', bs: 'ship', hunt: 'treasure', memory: 'cards', mastermind: 'code' , trivia: 'answer', oddone: 'pos' };
test('a match record keeps every secret out of the public state and puts it back for a move', () => {
  const rng = lcg(11);
  for (const type of L.TYPES) {
    const st = matchWith([type, 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], rng);
    st.id = 'm1'; st.seq = 0; st.recent = [];
    const rec = L.matchRecord(st);
    const pub = rec.state.squares[0].mini;
    const key = SECRET_KEYS[type];
    if (key) {
      assert.ok(rec.secrets[0], `${type}: a secret is kept`);
      if (type === 'hangman') assert.match(pub.word, /^_+$/, 'hangman shows only the length');
      else if (type === 'memory') assert.ok(pub.cards.every(c => c === null), 'no card is known');
      else assert.ok(!(key in pub), `${type}: ${key} is not public`);
      if (type === 'hunt') assert.equal(pub.clues.length, 36);
    } else assert.equal(rec.secrets[0], undefined, `${type}: nothing to hide`);
    assert.deepEqual(JSON.parse(JSON.stringify(rec)), rec, 'plain JSON');
    const full = L.fullState(rec);
    const mini = full.squares[0].mini;
    if (key) assert.deepEqual(mini[key], st.squares[0].mini[key], `${type}: the secret is back`);
    if (type === 'hunt') assert.equal(mini.clues, undefined);
    assert.equal(full.turn, 'X'); assert.equal(full.flash, null); assert.equal(full.screen, 'board');
  }
});

test('an online move is checked for the turn and the rules, then settled: the turn passes and the move is on record', () => {
  const st = matchWith(['ttt', 'wordle', 'hangman', 'pig', 'memory', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(3));
  st.squares[1].mini.word = 'CRANE'; st.squares[2].mini.word = 'APPLE';
  st.id = 'm'; st.seq = 0; st.recent = [];
  let rec = L.matchRecord(st);
  assert.equal(L.applyOnlineMove(rec, 'O', 0, 4, lcg(1)).reason, 'turn', 'not O\'s turn');
  assert.equal(L.applyOnlineMove(rec, 'X', 1, 'zzzzz', lcg(1)).reason, 'notword');
  let r = L.applyOnlineMove(rec, 'X', 0, 4, lcg(1));
  assert.equal(r.ok, true);
  assert.equal(r.rec.state.turn, 'O', 'the turn passed at once');
  assert.equal(r.rec.state.seq, 1); assert.equal(r.rec.state.moves, 1);
  assert.equal(r.entries.length, 1);
  const e = r.entries[0];
  assert.equal(e.seq, 1); assert.equal(e.by, 'X'); assert.equal(e.square, 0); assert.equal(e.kind, 'move'); assert.equal(e.next, 'O');
  assert.equal(e.after.mini.cells[4], 'X', 'the square as it was after the move');
  assert.deepEqual(r.rec.state.recent, [e]);
  assert.equal(r.rec.state.squares[0].mini.cells[4], 'X');
  rec = r.rec;
  // a wordle guess: the word stays secret, the marks are public
  r = L.applyOnlineMove(rec, 'O', 1, 'crate', lcg(2));
  assert.equal(r.ok, true);
  assert.equal(r.rec.state.squares[1].mini.guesses[0].marks.join(''), 'gggxg');
  assert.ok(!('word' in r.rec.state.squares[1].mini));
  assert.equal(r.rec.secrets[1].word, 'CRANE');
  assert.equal(r.entries[0].word, 'CRATE');
  rec = r.rec;
  // a hangman hit: a bonus move, the lock stays, the turn does not pass
  r = L.applyOnlineMove(rec, 'X', 2, 'P', lcg(2));
  assert.equal(r.ok, true);
  assert.equal(r.entries[0].kind, 'again'); assert.equal(r.rec.state.turn, 'X'); assert.equal(r.rec.state.lock, 2);
  assert.equal(r.rec.state.squares[2].mini.word, '_PP__');
  rec = r.rec;
  assert.equal(L.applyOnlineMove(rec, 'X', 0, 0, lcg(2)).reason, 'locked', 'the bonus move is owed in that square');
  r = L.applyOnlineMove(rec, 'X', 2, 'Z', lcg(2));
  assert.equal(r.ok, true); assert.equal(r.rec.state.turn, 'O'); assert.equal(r.rec.state.lock, null);
  rec = r.rec;
  // memory: the pick shows one card to both, the move shows two
  r = L.applyOnlinePick(rec, 'O', 4, 3);
  assert.equal(r.ok, true); assert.equal(r.rec.state.pick, 3); assert.equal(r.rec.state.pickSq, 4);
  assert.ok(r.rec.state.squares[4].mini.cards[3], 'the picked card is up'); assert.equal(r.rec.state.squares[4].mini.cards[0], null);
  assert.equal(L.applyOnlinePick(rec, 'X', 4, 3).reason, 'turn');
  r = L.applyOnlinePick(r.rec, 'O', 4, 3);
  assert.equal(r.rec.state.pick, null, 'tapped again: turned back');
  r = L.applyOnlineMove(rec, 'O', 4, [3, 5], lcg(4));
  assert.equal(r.ok, true);
  assert.deepEqual(r.rec.state.squares[4].mini.seen.slice().sort(), [3, 5]);
  assert.equal(r.rec.state.squares[4].mini.cards.filter(Boolean).length, 2);
  assert.equal(r.rec.state.pick, null);
  rec = r.rec;
  assert.ok(rec.state.recent.length <= L.RECENT_MAX);
  // pig: a roll keeps the turn, the bank passes it
  r = L.applyOnlineMove(rec, 'X', 3, 'roll', seq(0.2));
  assert.equal(r.ok, true);
  if (r.entries[0].note !== 'bust') { assert.equal(r.rec.state.turn, 'X'); assert.equal(r.rec.state.lock, 3); r = L.applyOnlineMove(r.rec, 'X', 3, 'bank', lcg(1)); assert.equal(r.ok, true); }
  assert.equal(r.rec.state.turn, 'O'); assert.equal(r.rec.state.lock, null);
});

test('the record keeps at most the last few moves, and a claim or a win is settled in the record', () => {
  let st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(5));
  st.id = 'm'; st.seq = 0; st.recent = [];
  let rec = L.matchRecord(st);
  const moves = [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2]];   // X claims square 0 on the fifth move
  let r;
  for (const [sq, cell] of moves) { r = L.applyOnlineMove(rec, rec.state.turn, sq, cell, lcg(1)); assert.equal(r.ok, true, r.reason); rec = r.rec; }
  assert.equal(rec.state.squares[0].owner, 'X');
  assert.equal(r.entries[0].kind, 'claim'); assert.equal(r.entries[0].after.owner, 'X');
  assert.equal(rec.state.turn, 'O');
  for (let k = 0; k < 12; k++) { const t = rec.state.turn; const sq = rec.state.squares.findIndex(q => !q.owner && q.mini.cells.some(c => !c)); const cell = rec.state.squares[sq].mini.cells.findIndex(c => !c); r = L.applyOnlineMove(rec, t, sq, cell, lcg(k)); assert.equal(r.ok, true); rec = r.rec; }
  assert.equal(rec.state.recent.length, L.RECENT_MAX);
  assert.equal(rec.state.recent[L.RECENT_MAX - 1].seq, rec.state.seq);
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

test('each move on the record carries its square as it was before (for the playback) and as the move left it', () => {
  let st = matchWith(['ttt', 'pig', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(8));
  st.id = 'm'; st.seq = 0; st.recent = []; st.timer = L.newTimer(30);
  st.squares[0].mini.cells = ['X', 'X', null, 'O', 'O', null, null, null, null];
  let rec = L.matchRecord(st);
  const was = JSON.parse(JSON.stringify(rec.state.squares[0]));
  let r = L.applyOnlineMove(rec, 'X', 0, 2, lcg(1));
  assert.equal(r.ok, true);
  const e = r.entries[0];
  assert.equal(e.kind, 'claim');
  assert.deepEqual(e.before, was, 'before: the square as the record had it, unclaimed');
  assert.equal(e.before.owner, null); assert.equal(e.after.owner, 'X');
  assert.deepEqual(r.rec.state.recent[0].before, was, 'kept on the record');
  // a timeout: the forced roll's square before, and the bank that follows starts where the roll left it
  rec = r.rec;
  const st2 = L.fullState(rec); st2.lock = 1; st2.turn = 'O'; st2.timer.deadline = 1;   // O's time runs out in Risky Rolls: a roll, then the bank
  rec = L.matchRecord(st2);
  const was1 = JSON.parse(JSON.stringify(rec.state.squares[1]));
  r = L.applyOnlineTimeout(rec, () => 0.9);                      // a 6 (a first roll never busts), then the bank
  assert.equal(r.ok, true); assert.equal(r.entries.length, 2);
  assert.deepEqual(r.entries[0].before, was1);
  assert.deepEqual(r.entries[1].before, r.entries[0].after, 'the bank starts from the roll');
});

test('Risky Rolls: a bank that wins the square is still a bank (the phones show it as one, the die left alone)', () => {
  const st = matchWith(['pig', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], lcg(8));
  st.squares[0].mini.bank = { X: 18, O: 0 }; st.squares[0].mini.turn = { by: 'X', rolls: [1, 3], pot: 4 }; st.lock = 0;
  const r = L.playMove(st, 0, 'bank', lcg(1));
  assert.equal(r.ok, true); assert.equal(r.flash.kind, 'claim'); assert.equal(r.flash.note, 'bank');
  assert.equal(st.squares[0].mini.last.roll, 3, 'the last number rolled stays the last roll');
});

test('a new online match comes from the lobby settings and a rematch starts over with the same ones', () => {
  const setup = { names: { X: 'Hosty', O: 'Guesty' }, games: Object.fromEntries(L.TYPES.map(t => [t, t === 'ttt' || t === 'wordle'])), timer: 60 };
  const rec = L.newOnlineMatch(setup, lcg(9), 'abc');
  assert.ok(rec);
  assert.equal(rec.state.id, 'abc'); assert.equal(rec.state.seq, 0); assert.deepEqual(rec.state.recent, []);
  assert.equal(rec.state.timer.limit, 60); assert.equal(rec.state.turn, 'X'); assert.equal(rec.state.moves, 0);
  assert.ok(rec.state.squares.every(sq => ['ttt', 'wordle'].includes(sq.mini.type)));
  assert.deepEqual(rec.state.games, ['ttt', 'wordle']);
  assert.ok(!rec.state.setup, 'the names live in the room, not the record');
  const none = L.newOnlineMatch({ games: Object.fromEntries(L.TYPES.map(t => [t, false])) }, lcg(9), 'x');
  assert.equal(none, null, 'no games: no match');
});


// ================================ Hexapawn ================================
// cells run row by row from the top: row 0 is O's home row, row 3 is X's; X moves up, O moves down
const hp = (...pairs) => { const c = new Array(12).fill(null); for (let k = 0; k < pairs.length; k += 2) c[pairs[k]] = pairs[k + 1]; return { type: 'hexapawn', cells: c, last: null }; };
const hpAt = (row, col) => row * 3 + col;

test('hexapawn: three pawns each on the home rows, two empty rows between them', () => {
  const m = mini('hexapawn');
  assert.deepEqual(m.cells, ['O', 'O', 'O', null, null, null, null, null, null, 'X', 'X', 'X']);
  assert.deepEqual(L.hpMoves(m.cells, 'X'), [[9, 6], [10, 7], [11, 8]], 'X can only step straight up');
  assert.deepEqual(L.hpMoves(m.cells, 'O'), [[0, 3], [1, 4], [2, 5]], 'O can only step straight down');
  assert.ok(!L.TYPES.includes('hexapawn') && L.OLD_TYPES.includes('hexapawn'), 'no longer dealt; an older match still plays it');
  assert.equal(L.INFO.hexapawn.name, 'Hexapawn', 'its name stays for older matches, history and stats');
  assert.equal(L.defaultSetup().games.hexapawn, undefined, 'not in the Advanced list');
});

test('games no longer dealt (Hexapawn, the Dice race): never in a new match or Find Match, never dealt by a reset, even for an older match whose list still names them', () => {
  const OLD = L.OLD_TYPES, rng = lcg(77);
  for (let k = 0; k < 300; k++) for (const sq of L.newMatch(rng).squares) assert.ok(!OLD.includes(sq.mini.type), sq.mini.type);
  const all = Object.fromEntries(L.TYPES.concat(OLD).map(t => [t, true]));            // a setup or room saved with them still ticked
  for (let k = 0; k < 100; k++) for (const sq of L.newOnlineMatch({ games: all }, rng, 'm' + k).state.squares) assert.ok(!OLD.includes(sq.mini.type));
  const st0 = L.newState(lcg(5)); Object.assign(st0.setup.games, { hexapawn: true, dice: true });
  assert.ok(L.startMatch(st0, rng) && st0.squares.every(sq => !OLD.includes(sq.mini.type)) && !st0.games.some(t => OLD.includes(t)));
  // resets in an older match: its list names Hexapawn and the Dice race; draws reset to the games still dealt
  for (const list of [L.TYPES.concat(OLD), ['hexapawn', 'ttt'], ['hexapawn'], ['dice', 'hexapawn']]) {
    const seen = new Set();
    for (let k = 0; k < 120; k++) {
      const st = matchWith(['ttt'], rng);
      st.games = list.slice();
      for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
      st.turn = TTT_DRAW[8];
      L.playMove(st, 0, 8, rng);
      seen.add(st.squares[0].mini.type);
    }
    assert.ok(![...seen].some(t => OLD.includes(t)), `${list}: reset to ${[...seen]}`);
    if (list.length === 2 && list.includes('ttt')) assert.deepEqual([...seen], ['ttt'], 'the rest of that match\'s list');
    if (!list.some(t => L.TYPES.includes(t))) assert.ok(seen.size > 5, 'nothing left in its list: any game still dealt');
  }
});

test('an older match with a Hexapawn square still plays it to the end: moves, the computer, a timed-out move, the record', () => {
  const rng = lcg(31);
  const st = matchWith(['hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], rng);
  st.games = L.TYPES.concat(['hexapawn']);
  assert.equal(L.playMove(st, 0, [9, 6], rng).ok, true, 'a step forward');
  // the record for an online match (hidden values apart) and back
  const rec = L.matchRecord(st);
  const back = L.fullState(rec);
  assert.equal(back.squares[0].mini.type, 'hexapawn');
  assert.deepEqual(back.squares[0].mini.cells, st.squares[0].mini.cells);
  // the computer picks a legal Hexapawn move when that square is its best
  const cpu = L.newMatch(rng); cpu.cpu = 'O'; cpu.turn = 'O';
  cpu.squares.forEach((sq, i) => { sq.mini = i ? Object.assign(L.newMini('ttt', rng), { cells: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'] }) : hp(hpAt(2, 0), 'X', hpAt(1, 1), 'O'); sq.owner = i ? 'X' : null; });
  const owners = [null, 'O', 'O', 'X', 'X', 'O', 'O', 'X', 'X'];                    // eight squares claimed, no line yet (O could still make one through it): only the Hexapawn square is open
  cpu.squares.forEach((sq, i) => { sq.owner = owners[i]; });
  assert.equal(L.mainResult(cpu.squares), null);
  const plan = L.cpuMove(cpu, rng);
  assert.equal(plan.square, 0);
  assert.ok(L.hpMoves(cpu.squares[0].mini.cells, 'O').some(([a, b]) => a === plan.move[0] && b === plan.move[1]), 'a legal move');
  // a timed-out turn there makes a random legal move
  const t = L.randomLegalMove(hp(hpAt(3, 1), 'X', hpAt(0, 1), 'O'), 'X', rng);
  assert.ok(L.hpMoves(hp(hpAt(3, 1), 'X', hpAt(0, 1), 'O').cells, 'X').some(([a, b]) => a === t[0] && b === t[1]));
});

test('hexapawn: pawns cannot move backward, sideways, two squares, diagonally into an empty square, or capture straight ahead', () => {
  // X on row 2 col 1 with an O pawn straight ahead; another O pawn diagonally ahead on the left
  const m = hp(hpAt(2, 1), 'X', hpAt(1, 1), 'O', hpAt(1, 0), 'O', hpAt(0, 2), 'O');
  const before = m.cells.slice();
  for (const [to, why] of [[hpAt(3, 1), 'backward'], [hpAt(2, 0), 'sideways left'], [hpAt(2, 2), 'sideways right'], [hpAt(1, 1), 'capture straight ahead'],
    [hpAt(1, 2), 'diagonally into an empty square'], [hpAt(0, 1), 'two squares'], [hpAt(3, 0), 'diagonally backward']]) {
    assert.deepEqual(L.applyMove(m, 'X', [hpAt(2, 1), to]), { ok: false, reason: 'illegal' }, why);
  }
  assert.deepEqual(L.applyMove(m, 'X', [hpAt(1, 1), hpAt(0, 1)]), { ok: false, reason: 'illegal' }, "not the other side's pawn");
  assert.deepEqual(L.applyMove(m, 'O', [hpAt(1, 1), hpAt(0, 1)]), { ok: false, reason: 'illegal' }, 'O cannot move up');
  assert.equal(L.applyMove(m, 'X', [hpAt(2, 1)]).ok, false);
  assert.equal(L.applyMove(m, 'X', 'up').ok, false);
  assert.deepEqual(m.cells, before, 'nothing moved');
  assert.deepEqual(L.hpMoves(m.cells, 'X'), [[hpAt(2, 1), hpAt(1, 0)]], 'its only move is the diagonal capture');
  const r = L.applyMove(m, 'X', [hpAt(2, 1), hpAt(1, 0)]);
  assert.equal(r.ok, true); assert.equal(r.outcome, 'continue'); assert.equal(r.note, 'capture');
  assert.equal(m.cells[hpAt(1, 0)], 'X'); assert.equal(m.cells[hpAt(2, 1)], null);
  assert.deepEqual(m.last, { from: hpAt(2, 1), to: hpAt(1, 0), by: 'X', capture: true });
});

test('hexapawn win 1: a pawn reaching the opposite home row claims the square', () => {
  const m = hp(hpAt(1, 1), 'X', hpAt(0, 0), 'O', hpAt(0, 2), 'O');
  const r = L.applyMove(m, 'X', [hpAt(1, 1), hpAt(0, 1)]);
  assert.equal(r.outcome, 'win'); assert.equal(r.note, 'through'); assert.deepEqual(r.cells, [hpAt(0, 1)]);
  const o = hp(hpAt(2, 2), 'O', hpAt(3, 1), 'X', hpAt(3, 0), 'X');   // O gets through by capturing onto X's home row
  const r2 = L.applyMove(o, 'O', [hpAt(2, 2), hpAt(3, 1)]);
  assert.equal(r2.outcome, 'win'); assert.equal(r2.note, 'through');
});

test('hexapawn: leaving the other side without a move wins nothing; when neither can move the square resets', () => {
  // X steps in front of O's only pawn: O is blocked, and so is X
  const st = matchWith(['hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = hp(hpAt(3, 0), 'X', hpAt(1, 0), 'O');
  const f = turn(st, 0, [hpAt(3, 0), hpAt(2, 0)], typeRng('ttt'));
  assert.equal(f.kind, 'draw', 'nobody can move: no winner'); assert.equal(f.note, 'stuck');
  assert.equal(st.squares[0].owner, null);
  assert.equal(st.squares[0].mini.type, 'ttt', 'the square resets with a new mini-game');
  assert.deepEqual(st.sqlog[0], { t: 'hexapawn', end: 'draw', w: null, X: 1, O: 0 });
  // capturing the last pawn does not win either: the pawn still has to get through
  const w = hp(hpAt(2, 1), 'X', hpAt(3, 2), 'X', hpAt(1, 0), 'O');
  assert.deepEqual(L.applyMove(w, 'X', [hpAt(2, 1), hpAt(1, 0)]), { ok: true, outcome: 'continue', note: 'capture' });
  assert.equal(w.cells.includes('O'), false);
  assert.equal(L.canMove(w, 'O'), false); assert.equal(L.canMove(w, 'X'), true);
  const r = L.applyMove(w, 'X', [hpAt(1, 0), hpAt(0, 0)]);
  assert.equal(r.outcome, 'win'); assert.equal(r.note, 'through', 'the far row is the only win');
});

test('hexapawn: a player with no move just plays elsewhere; being stuck never loses the square', () => {
  // X steps forward into a blocked spot of its own accord: X is stuck, but O can still move, so nothing is decided
  const m = hp(hpAt(3, 0), 'X', hpAt(1, 0), 'O', hpAt(0, 2), 'O', hpAt(0, 1), 'O');
  const r = L.applyMove(m, 'X', [hpAt(3, 0), hpAt(2, 0)]);
  assert.equal(r.outcome, 'continue');
  assert.equal(L.canMove(m, 'X'), false, 'X is stuck');
  assert.equal(L.canMove(m, 'O'), true);
  // O moves a pawn next to X's diagonal: X can capture again, so still nothing decided
  const freed = JSON.parse(JSON.stringify(m));
  const r2 = L.applyMove(freed, 'O', [hpAt(0, 1), hpAt(1, 1)]);
  assert.equal(r2.outcome, 'continue', 'the move freed X');
  assert.equal(L.canMove(freed, 'X'), true);
  // ...and a move that leaves X stuck does not win it for O any more
  const r3 = L.applyMove(m, 'O', [hpAt(0, 2), hpAt(1, 2)]);
  assert.equal(r3.outcome, 'continue'); assert.equal(L.canMove(m, 'X'), false);

  // in a match: a stuck player plays elsewhere, and cannot be made to move in that square
  const st = matchWith(['hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = hp(hpAt(2, 0), 'X', hpAt(1, 0), 'O', hpAt(0, 2), 'O');
  st.turn = 'X';
  assert.equal(L.anyMove(st, 'X'), true, 'X still has the other squares');
  assert.equal(L.playMove(st, 0, [hpAt(2, 0), hpAt(1, 0)], lcg(1)).ok, false);
  for (let k = 0; k < 6; k++) assert.notEqual(L.cpuMove(st, lcg(k)).square, 0, 'the computer plays elsewhere');
  st.timer = L.newTimer(30);
  for (let k = 0; k < 6; k++) {
    const copy = JSON.parse(JSON.stringify(st));
    const t = L.timeoutMove(copy, lcg(k));
    assert.equal(t.ok, true); assert.notEqual(t.square, 0, 'a timed-out random move goes elsewhere too');
  }
  assert.equal(st.squares[0].owner, null, 'being stuck lost nothing');
  // with no other square open, X has no move anywhere and is skipped
  for (let i = 1; i < 9; i++) st.squares[i].owner = [null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O'][i];
  assert.equal(L.anyMove(st, 'X'), false);
  assert.equal(L.anyMove(st, 'O'), true);
});

test('hexapawn tactics: full minimax takes a win now, stops the other side getting through, and plays every legal move only', () => {
  const win = L.localBest(L.publicMini(hp(hpAt(1, 1), 'X', hpAt(0, 0), 'O', hpAt(2, 2), 'O')), 'X', cpuRng());
  assert.equal(win.move[0], hpAt(1, 1)); assert.equal(Math.floor(win.move[1] / 3), 0, 'onto the far row (a step or a capture)'); assert.equal(win.win, true);
  // O threatens to reach X's home row from row 2; X must capture it
  const block = L.localBest(L.publicMini(hp(hpAt(2, 1), 'O', hpAt(3, 0), 'X', hpAt(3, 2), 'X', hpAt(0, 0), 'O')), 'X', cpuRng());
  assert.ok(block.move[1] === hpAt(2, 1), `X captures the runner (played ${JSON.stringify(block.move)})`);
  // from the start, with only the far row winning, perfect play on both sides locks the pawns: the square resets
  const start = mini('hexapawn').cells;
  assert.equal(L.hpSolve(start, 'X').v, 0);
  assert.equal(L.hpSolve(start, 'O').v, 0);
  // leaving the other side stuck is worth nothing by itself
  const lock = L.hpMovesValued(hp(hpAt(3, 0), 'X', hpAt(1, 0), 'O').cells, 'X');
  assert.deepEqual(lock.map(m => m.v), [0], 'a move that only blocks both sides: a reset');
  assert.equal(L.hpNeeds(start, 'X'), 3); assert.equal(L.hpNeeds(start, 'O'), 3, 'an even start: three rows each');
  const close = hp(hpAt(1, 1), 'X', hpAt(3, 0), 'X', hpAt(0, 0), 'O', hpAt(0, 2), 'O').cells;   // (a second X pawn, so O capturing one does not end it)
  assert.equal(L.hpNeeds(close, 'X'), 1, 'one step from the far row'); assert.equal(L.hpNeeds(close, 'O'), 3);
  const blocked = hp(hpAt(2, 0), 'X', hpAt(1, 0), 'O', hpAt(0, 2), 'O').cells;
  assert.equal(L.hpNeeds(blocked, 'X'), 3, 'a stuck player needs one more than its distance');
  // every move the computer picks over many games is legal
  const rng = lcg(55);
  for (let g = 0; g < 30; g++) {
    const m = mini('hexapawn');
    let p = g % 2 ? 'O' : 'X', guard = 0;
    while (guard++ < 30) {
      if (!L.canMove(m, 'X') && !L.canMove(m, 'O')) break;            // locked: the square would reset
      if (!L.canMove(m, p)) { p = L.other(p); continue; }
      const b = L.localBest(L.publicMini(m), p, rng);
      const r = L.applyMove(m, p, b.move);
      assert.equal(r.ok, true, `${p} ${JSON.stringify(b.move)} (${r.reason})`);
      if (r.outcome === 'win') break;
      p = L.other(p);
    }
    assert.ok(guard < 30, 'the game ends');
  }
});

test('hexapawn at the board level: a square nearly won is worth more than a fresh one', () => {
  const near = hp(hpAt(1, 1), 'X', hpAt(0, 0), 'O', hpAt(2, 2), 'O');
  const st = cpuMatch('X', [near, 'hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  const m = L.cpuMove(st, cpuRng());
  assert.equal(m.square, 0, 'it goes for the square it can win at once');
  assert.equal(m.move[0], hpAt(1, 1)); assert.equal(Math.floor(m.move[1] / 3), 0);
  const g = L.moveGain(L.publicMini(near), 'X', L.localBest(L.publicMini(near), 'X', cpuRng()));
  assert.ok(g > 0.4, `claiming it is a big gain (${g.toFixed(2)})`);
});

test('hexapawn through playMove: the result carries the slide and the capture for the animation', () => {
  const st = matchWith(['hexapawn', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt']);
  st.squares[0].mini = hp(hpAt(2, 1), 'X', hpAt(1, 0), 'O', hpAt(0, 2), 'O', hpAt(3, 2), 'X');
  const r = L.playMove(st, 0, [hpAt(2, 1), hpAt(1, 0)], lcg(1));
  assert.equal(r.ok, true);
  assert.equal(st.flash.type, 'hexapawn');
  assert.equal(st.flash.from, hpAt(2, 1)); assert.equal(st.flash.to, hpAt(1, 0)); assert.equal(st.flash.capture, true);
  L.endFlash(st);
  assert.equal(st.turn, 'O');
  // the public view and the online record carry the board as is (nothing hidden)
  const rec = L.matchRecord(Object.assign(st, { id: 'h', seq: 0, recent: [] }));
  assert.deepEqual(rec.state.squares[0].mini.cells, st.squares[0].mini.cells);
  assert.equal(rec.secrets[0], undefined);
});


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

test('engine: pure and seeded: the same seed plays the same match, and nothing random happens without an rng', () => {
  const play = seed => { const rng = E.makeRng(seed), st = E.newMatch(rng); for (let k = 0; k < 40 && !st.winner; k++) { const c = E.cpuMove(st, rng); E.playMove(st, c.square, c.move, rng); while (st.flash) E.endFlash(st, false) || E.leaveSquare(st); } return JSON.stringify(st.squares); };
  assert.equal(play('seed-1'), play('seed-1'), 'same seed, same match');
  assert.notEqual(play('seed-1'), play('seed-2'), 'another seed, another match');
  const r = E.makeRng(42);
  for (let k = 0; k < 1000; k++) { const v = r(); assert.ok(v >= 0 && v < 1); }
  assert.throws(() => E.newState(), /needs an rng/);
  assert.throws(() => E.playMove(E.newMatch(E.makeRng(1)), 0, 0), /needs an rng/);
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'engine.js'), 'utf8');
  const code = src.replace(/\/\/.*$/gm, '');                       // the code, without its comments
  assert.ok(!/Math\.random|Date\.now|performance\.now|\bdocument\.|\bwindow\.|localStorage/.test(code), 'no clock, no Math.random, no page in the engine');
});
test('engine: every top-level name is exported for the server', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'engine.js'), 'utf8');
  const names = [...src.matchAll(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*))/gm)].map(m => m[1] || m[2]);
  for (const n of names) assert.ok(n in E, `${n} is not exported`);
});
test('engine: the turn clock allows for the playback of the moves just made', () => {
  const st = { turn: 'O', winner: null, timer: E.newTimer(60) };
  E.armClock(st, [], 1000);
  assert.equal(st.timer.deadline, 61000); assert.equal(st.timer.for, 'O');
  const e = { type: 'ttt', kind: 'move', square: 0 };
  E.armClock(st, [e], 1000);
  assert.equal(st.timer.deadline, 61000 + E.PLAY.spot + E.playMs(e) + E.PLAY.flash.move);
  st.winner = 'X'; E.armClock(st, [e], 1000);
  assert.equal(st.timer.deadline, null, 'no clock once the match is over');
});
test('engine: resigning hands the match to the other side', () => {
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' } }, E.makeRng(5), 'g1');
  const r = E.applyOnlineResign(rec, 'X');
  assert.ok(r.ok); assert.equal(r.rec.state.winner, 'O'); assert.equal(r.rec.state.winReason, 'resign'); assert.equal(r.rec.state.resigned, 'X');
  assert.equal(E.applyOnlineResign(r.rec, 'O').reason, 'over', 'only once');
});

// ---- stats: turns per mini-game, how each one ended ----
test('stats: each mini-game counts the turns each side spent in it, bonus moves within a turn counting once', () => {
  const st = matchWith(['pig', 'ttt', 'bs', 'hangman']);
  st.squares[2].mini = bsAt(4, 5);
  st.squares[3].mini = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  turn(st, 0, 'roll', die(3)); turn(st, 0, 'roll', die(4)); turn(st, 0, 'bank');   // X: one turn of Risky Rolls, three moves
  turn(st, 2, 4); turn(st, 2, 5);                                                    // O: a hit, then the bonus shot sinks it, one turn
  turn(st, 3, 'P'); turn(st, 3, 'Z');                                                // X: a hit and a bonus miss, one turn
  assert.deepEqual(st.squares[0].mv, { X: 1, O: 0 });
  assert.deepEqual(st.squares[3].mv, { X: 1, O: 0 });
  assert.deepEqual(st.sqlog, [{ t: 'bs', end: 'won', w: 'O', X: 0, O: 1 }]);
  // a drawn square resets: its count goes to the log and the new game starts from zero
  st.squares[1].mini = tttOf('X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null);
  st.turn = 'X';
  turn(st, 1, 8, typeRng('ttt'));
  assert.deepEqual(st.sqlog[1], { t: 'ttt', end: 'draw', w: null, X: 1, O: 0 });
  assert.deepEqual(st.squares[1].mv, { X: 0, O: 0 });
  const s = L.matchStats(st);
  assert.deepEqual(s.squares.map(e => `${e.t}:${e.end}:${e.X}/${e.O}`), ['bs:won:0/1', 'ttt:draw:1/0', 'pig:open:1/0', 'hangman:open:1/0']);
  assert.equal(s.turns, 4);
  assert.equal(s.winner, null);
  // the counts travel with an online record
  st.id = 'm'; st.seq = 0; st.recent = [];
  const back = L.fullState(L.matchRecord(st));
  assert.deepEqual(back.sqlog, st.sqlog);
  assert.deepEqual(back.squares[0].mv, { X: 1, O: 0 });
});

test('timeouts: Coin flip flips, Battleship fires at an open cell, Risky Rolls banks once 21 is reached', () => {
  const st = matchWith(['coins', 'bs', 'pig']);
  st.timer = L.newTimer(30);
  for (let k = 0; k < 40; k++) {
    const m = L.randomLegalMove(st.squares[1].mini, 'X', lcg(k));
    assert.ok(Number.isInteger(m) && m >= 0 && m < 16 && !st.squares[1].mini.revealed[m]);
  }
  assert.equal(L.randomLegalMove(st.squares[0].mini, 'X'), 'flip');
  st.squares[2].mini = Object.assign(mini('pig'), { bank: { X: 18, O: 0 }, turn: { by: 'X', rolls: [4], pot: 4 } });
  st.lock = 2;
  const r = L.timeoutMove(st, lcg(5));
  assert.equal(r.ok, true); assert.equal(r.move, 'bank');
  assert.equal(st.squares[2].owner, 'X');
});

// ============================ Snakes and Ladders ============================
// Each rule checked on its own (not through snlValid), on many boards from many seeds.
test('snakes: 50,000 boards, every one keeps every placement rule', () => {
  const rows = k => Math.floor((k - 1) / 5);
  const seen = new Set();
  for (let k = 0; k < 50000; k++) {
    const b = L.snlBoard(L.makeRng('snl' + k));
    assert.equal(b.ladders.length, 2, 'two ladders'); assert.equal(b.snakes.length, 2, 'two snakes');
    const ends = [];
    for (const [a, c] of b.ladders) { assert.ok(c > a, `a ladder goes up (${a}->${c})`); ends.push(a, c); }
    for (const [a, c] of b.snakes) { assert.ok(c < a, `a snake goes down (${a}->${c})`); ends.push(a, c); }
    for (const [a, c] of b.ladders.concat(b.snakes)) {
      assert.ok(Math.abs(c - a) >= 3, `spans at least 3 spaces (${a}->${c})`);
      assert.notEqual(rows(a), rows(c), `crosses rows (${a}->${c})`);
      assert.notEqual(a, 1, 'nothing starts on space 1');
      assert.ok(a >= 1 && a <= 19 && c >= 1 && c <= 19, `nothing touches the top space (${a}->${c})`);
    }
    assert.equal(new Set(ends).size, 8, `no shared ends (${JSON.stringify(b)})`);
    const starts = b.ladders.concat(b.snakes).map(x => x[0]), finishes = b.ladders.concat(b.snakes).map(x => x[1]);
    assert.ok(starts.every(a => !finishes.includes(a)), 'nothing starts where another ends');
    assert.equal(L.snlValid(b), true);
    seen.add(JSON.stringify(b));
  }
  assert.ok(seen.size > 40000, `boards vary (${seen.size} different)`);
  // the checker itself refuses each kind of broken board
  const ok = { ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 12]] };
  assert.equal(L.snlValid(ok), true);
  for (const bad of [
    { ladders: [[1, 8], [9, 17]], snakes: [[14, 6], [19, 12]] },     // starts on 1
    { ladders: [[3, 20], [9, 17]], snakes: [[14, 6], [19, 12]] },    // touches the top
    { ladders: [[3, 5], [9, 17]], snakes: [[14, 6], [19, 12]] },     // too short
    { ladders: [[6, 9], [11, 17]], snakes: [[14, 4], [19, 12]] },    // one row (6 to 9)
    { ladders: [[3, 8], [8, 17]], snakes: [[14, 6], [19, 12]] },     // starts where another ends
    { ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 6]] },      // a shared end
    { ladders: [[8, 3], [9, 17]], snakes: [[14, 6], [19, 12]] },     // a ladder going down
  ]) assert.equal(L.snlValid(bad), false, JSON.stringify(bad));
});

test('snakes: a roll hops up from the start, then a ladder lifts and a snake drops; reaching or passing 20 wins', () => {
  const m = Object.assign(mini('snakes'), { ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 12]], pos: { X: 0, O: 0 } });
  assert.deepEqual(L.applyMove(m, 'X', 'roll', seq(pick(0, 6))), { ok: true, outcome: 'continue', note: 'roll' });
  assert.deepEqual(m.last, { by: 'X', roll: 1, from: 0, land: 1, to: 1, via: null }, 'a 1 from the start lands on space 1');
  assert.deepEqual(L.applyMove(m, 'X', 'roll', seq(pick(1, 6))), { ok: true, outcome: 'continue', note: 'ladder' });
  assert.deepEqual(m.last, { by: 'X', roll: 2, from: 1, land: 3, to: 8, via: 'ladder' }, 'up the ladder from 3 to 8');
  assert.equal(m.pos.X, 8);
  assert.deepEqual(L.applyMove(m, 'O', 'roll', seq(pick(5, 6))).note, 'roll');
  assert.equal(m.pos.O, 6, 'landing on a snake\'s tail does nothing');
  L.applyMove(m, 'O', 'roll', seq(pick(1, 6)));
  assert.equal(m.pos.O, 8, 'two pieces may share a space');
  assert.equal(L.applyMove(m, 'X', 'roll', seq(pick(5, 6))).note, 'snake');
  assert.deepEqual(m.last, { by: 'X', roll: 6, from: 8, land: 14, to: 6, via: 'snake' }, 'down the snake from 14 to 6');
  m.pos.X = 17;
  assert.deepEqual(L.applyMove(m, 'X', 'roll', seq(pick(2, 6))), { ok: true, outcome: 'win' }, '17 + 3 = 20: the top');
  m.pos.O = 18;
  assert.equal(L.applyMove(m, 'O', 'roll', seq(pick(5, 6))).outcome, 'win', 'passing the top wins too');
  assert.equal(m.pos.O, 20);
  m.pos.O = 13;
  assert.equal(L.applyMove(m, 'O', 'roll', seq(pick(5, 6))).note, 'snake', 'the snake at 19 still bites');
  assert.equal(m.pos.O, 12);
  assert.equal(L.applyMove(m, 'O', 1).ok, false, 'the move is a roll');
  const rolls = new Set();
  for (let k = 0; k < 600; k++) { const d = mini('snakes', L.makeRng('s' + k)); L.applyMove(d, 'X', 'roll', L.makeRng('r' + k)); rolls.add(d.last.roll); }
  assert.deepEqual([...rolls].sort(), [1, 2, 3, 4, 5, 6]);
});

test('snakes: the odds and expected rolls come from the board; random play always finishes', () => {
  const b = { type: 'snakes', ladders: [[3, 8], [9, 17]], snakes: [[14, 6], [19, 12]], pos: { X: 0, O: 0 } };
  const E = L.snlExpected(b), plain = L.snlExpected({ type: 'snakes', ladders: [], snakes: [], pos: { X: 0, O: 0 } });
  assert.equal(E[20], 0);
  assert.ok(E[0] > 1 && E[0] < plain[0] + 3, `from the start: ${E[0].toFixed(2)} rolls`);
  assert.ok(E[17] < E[13], 'higher up, fewer rolls (17 vs 13)');
  assert.equal(L.localBest(Object.assign({}, b, { pos: { X: 16, O: 0 } }), 'X', cpuRng()).q, 3 / 6, '4, 5 or 6 reaches the top');
  assert.equal(L.localBest(b, 'X', cpuRng()).move, 'roll');
  assert.equal(L.randomLegalMove(L.newMini('snakes', lcg(3)), 'O'), 'roll');
  for (let k = 0; k < 200; k++) {
    const m = L.newMini('snakes', L.makeRng('play' + k)), r = L.makeRng('roll' + k);
    let n = 0, out;
    do { out = L.applyMove(m, n % 2 ? 'O' : 'X', 'roll', r); n++; } while (out.outcome !== 'win' && n < 2000);
    assert.equal(out.outcome, 'win');
  }
});

// ================================== Bump ==================================
test('bump: a spin of 1, 2 or 3 hops forward; landing on the other piece sends it home; reaching the Finish wins', () => {
  const m = mini('bump');
  assert.deepEqual(m.pos, { X: 0, O: 0 }, 'both start at Home');
  assert.deepEqual(L.applyMove(m, 'X', 'spin', seq(pick(1, 3))), { ok: true, outcome: 'continue', note: 'spin' });
  assert.deepEqual(m.last, { by: 'X', spin: 2, from: 0, to: 2, bumped: false });
  assert.deepEqual(L.applyMove(m, 'O', 'spin', seq(pick(1, 3))), { ok: true, outcome: 'continue', note: 'bump' }, 'O lands on X');
  assert.deepEqual(m.pos, { X: 0, O: 2 }, 'X is back at Home');
  assert.equal(m.last.bumped, true);
  L.applyMove(m, 'X', 'spin', seq(pick(2, 3)));
  assert.deepEqual(m.pos, { X: 3, O: 2 }, 'hopping past a piece does not bump it');
  L.applyMove(m, 'O', 'spin', seq(pick(2, 3)));
  assert.deepEqual(m.pos, { X: 3, O: 5 });
  m.pos.X = 7;
  assert.deepEqual(L.applyMove(m, 'X', 'spin', seq(pick(2, 3))), { ok: true, outcome: 'win' }, '7 + 3 = 10: the Finish');
  m.pos = { X: 9, O: 1 };
  assert.equal(L.applyMove(m, 'X', 'spin', seq(pick(2, 3))).outcome, 'win', 'passing the Finish wins too');
  assert.equal(m.pos.X, 10);
  m.pos = { X: 8, O: 9 };
  assert.equal(L.applyMove(m, 'O', 'spin', seq(pick(0, 3))).outcome, 'win');
  assert.equal(m.last.bumped, false, 'the Finish bumps nobody');
  assert.equal(L.applyMove(m, 'X', 'roll').ok, false, 'the move is a spin');
  const spins = { 1: 0, 2: 0, 3: 0 };
  for (let k = 0; k < 3000; k++) { const d = mini('bump'); L.applyMove(d, 'X', 'spin', L.makeRng('b' + k)); spins[d.last.spin]++; }
  for (const v of [1, 2, 3]) assert.ok(spins[v] > 850 && spins[v] < 1150, `even odds (${JSON.stringify(spins)})`);
  assert.equal(L.localBest({ type: 'bump', pos: { X: 8, O: 0 } }, 'X', cpuRng()).q, 2 / 3, '2 or 3 finishes from 8');
  assert.equal(L.localBest({ type: 'bump', pos: { X: 0, O: 0 } }, 'X', cpuRng()).q, 0);
  assert.equal(L.randomLegalMove(mini('bump'), 'X'), 'spin');
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

// =============================== Local seating ===============================
test('local setup: player 1 picks X, O or Random; player 2 (a person or the computer) gets the other side', () => {
  const seat = (local, rng) => { const s = L.defaultSetup(); s.local = local; L.seatLocal(s, rng || lcg(1)); return s; };
  let s = seat({ pick: 'X', p2: 'human', n1: 'Ann', n2: 'Bob' });
  assert.deepEqual([s.names, s.players, s.human], [{ X: 'Ann', O: 'Bob' }, { X: 'human', O: 'human' }, 'X']);
  s = seat({ pick: 'O', p2: 'cpu', n1: 'Ann', n2: '' });
  assert.deepEqual([s.names, s.players, s.human], [{ X: 'Computer', O: 'Ann' }, { X: 'cpu', O: 'human' }, 'O']);
  assert.equal(L.cpuSide(s), 'X', 'the computer plays X and moves first');
  s = seat({ pick: 'X', p2: 'human', n1: '', n2: '' });
  assert.deepEqual(s.names, { X: 'X', O: 'O' }, 'a blank name is the side\'s letter');
  const sides = new Set(), r = lcg(9);
  for (let k = 0; k < 40; k++) { const t = seat({ pick: 'random', p2: 'cpu', n1: 'Ann', n2: '' }, r); sides.add(t.human); assert.equal(t.names[t.human], 'Ann'); assert.equal(t.players[t.human], 'human'); assert.equal(t.players[t.human === 'X' ? 'O' : 'X'], 'cpu'); }
  assert.deepEqual([...sides].sort(), ['O', 'X'], 'Random draws both sides');
  // a rematch: the same choice, Random drawn again (startMatch keeps the seats it is given)
  const st = L.newState(lcg(3));
  st.setup.local = { pick: 'O', p2: 'human', n1: 'Ann', n2: 'Bob' };
  for (let k = 0; k < 3; k++) { L.seatLocal(st.setup, lcg(k)); L.startMatch(st, lcg(k)); assert.deepEqual(st.setup.names, { X: 'Bob', O: 'Ann' }); assert.equal(st.cpu, null); }
  // older setups: the computer, if any, becomes player 2; two computers can no longer happen
  const old = (players, names) => L.normLocal({ players, names });
  assert.deepEqual(old({ X: 'cpu', O: 'human' }, { X: 'Computer', O: 'Zed' }), { pick: 'O', p2: 'cpu', n1: 'Zed', n2: '' });
  assert.deepEqual(old({ X: 'human', O: 'human' }, { X: 'Ann', O: 'O' }), { pick: 'X', p2: 'human', n1: 'Ann', n2: '' });
  assert.deepEqual(old({ X: 'cpu', O: 'cpu' }, { X: 'Computer', O: 'Computer' }), { pick: 'X', p2: 'cpu', n1: '', n2: '' }, 'computer vs computer: player 1 is a person');
  assert.deepEqual(L.normLocal({ local: { pick: 'Q', p2: 'robot', n1: 5 } }), { pick: 'X', p2: 'human', n1: '5', n2: '' }, 'junk is tidied');
});
