'use strict';
// Tic-Tac-Toe: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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

// O O X / X O O / O X X : full, no line, O has 5 and X has 4 (impossible with strict alternation)
const TTT_DRAW = ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'];

// X O X / O O X / _ X O : one cell left, but every line holds an X and an O
const TTT_BLOCKED = ['X', 'O', 'X', 'O', 'O', 'X', null, 'X', 'O'];

// ================================ Computer player ================================
const cpuRng = () => lcg(314);

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
