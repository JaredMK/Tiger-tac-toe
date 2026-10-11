'use strict';
// Run with:  node --test
// Exercises the pure game logic embedded in index.html (the <script id="logic"> block).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const src = html.match(/<script id="logic">([\s\S]*?)<\/script>/)[1];
const L = vm.runInThisContext(
  src + '\n;({ TYPES, INFO, C3, NIM_START, LINES, other, newMini, newMatch, findRun, applyMove, mainResult, playMove, endFlash })',
  { filename: 'index.html#logic' }
);

// ---- helpers ----
// rng that yields a fixed sequence of values in [0, 1)
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
// rng value that makes randInt(rng, n) return k
const pick = (k, n) => (k + 0.5) / n;
const typeRng = type => seq(pick(L.TYPES.indexOf(type), 4), 0.5);
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

function matchWith(types, rng = lcg(7)) {
  const st = L.newMatch(rng);
  types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
  return st;
}
// make one full turn and clear the result overlay, as the UI does
function turn(st, i, m, rng) {
  const r = L.playMove(st, i, m, rng || lcg(99));
  assert.equal(r.ok, true, `move ${m} in square ${i} should be accepted (${r.reason})`);
  const flash = st.flash;
  L.endFlash(st);
  return flash;
}
const sorted = a => a.slice().sort((x, y) => x - y);

// =============================== Tic-tac-toe ===============================
test('ttt: X wins with three consecutive moves while O has no pieces (lopsided)', () => {
  const m = L.newMini('ttt', Math.random);
  assert.equal(L.applyMove(m, 'X', 0).outcome, 'continue');
  assert.equal(L.applyMove(m, 'X', 1).outcome, 'continue');
  const r = L.applyMove(m, 'X', 2);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), [0, 1, 2]);
  assert.equal(m.cells.filter(c => c === 'O').length, 0);
});

test('ttt: every row, column and diagonal is detected', () => {
  for (const line of L.LINES) {
    const m = L.newMini('ttt', Math.random);
    let r;
    for (const c of line) r = L.applyMove(m, 'O', c);
    assert.equal(r.outcome, 'win', `line ${line}`);
    assert.deepEqual(sorted(r.cells), sorted(line));
  }
});

test('ttt: occupied and out-of-range cells are rejected', () => {
  const m = L.newMini('ttt', Math.random);
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
  const m = L.newMini('ttt', Math.random);
  for (let i = 0; i < 8; i++) assert.equal(L.applyMove(m, TTT_DRAW[i], i).outcome, 'continue');
  assert.equal(L.applyMove(m, TTT_DRAW[8], 8).outcome, 'draw');
  assert.equal(m.cells.filter(c => c === 'O').length, 5);
});

test('ttt: a drawn square resets to a fresh random mini-game and stays unclaimed', () => {
  const st = matchWith(['ttt']);
  for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
  st.turn = TTT_DRAW[8];
  const r = L.playMove(st, 0, 8, typeRng('c3'));
  assert.equal(r.ok, true);
  assert.equal(st.flash.kind, 'draw');
  assert.equal(st.flash.newType, 'c3');
  assert.equal(st.flash.drawn.cells.every(Boolean), true, 'overlay keeps the full board');
  assert.equal(st.squares[0].owner, null);
  assert.equal(st.squares[0].mini.type, 'c3');
  assert.equal(st.squares[0].mini.cells.every(c => c === null), true, 'fresh board');
  assert.equal(st.turn, L.other(TTT_DRAW[8]), 'turn still passes after a draw');
  assert.equal(st.winner, null);
});

test('ttt: a draw can also reset to the same game type', () => {
  const st = matchWith(['ttt']);
  for (let i = 0; i < 8; i++) st.squares[0].mini.cells[i] = TTT_DRAW[i];
  st.turn = TTT_DRAW[8];
  L.playMove(st, 0, 8, typeRng('ttt'));
  assert.equal(st.squares[0].mini.type, 'ttt');
  assert.equal(st.squares[0].mini.cells.every(c => c === null), true);
});

// ================================ Connect 3 ================================
const c3idx = (row, col) => row * L.C3.cols + col; // row 0 = top, row 5 = bottom

test('c3: pieces drop to the lowest open cell of the column', () => {
  const m = L.newMini('c3', Math.random);
  L.applyMove(m, 'X', 2);
  assert.equal(m.cells[c3idx(5, 2)], 'X');
  L.applyMove(m, 'O', 2);
  assert.equal(m.cells[c3idx(4, 2)], 'O');
  assert.equal(m.last, c3idx(4, 2));
});

test('c3: X stacks three in one column on consecutive turns (lopsided vertical win)', () => {
  const m = L.newMini('c3', Math.random);
  assert.equal(L.applyMove(m, 'X', 2).outcome, 'continue');
  assert.equal(L.applyMove(m, 'X', 2).outcome, 'continue');
  const r = L.applyMove(m, 'X', 2);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([c3idx(5, 2), c3idx(4, 2), c3idx(3, 2)]));
});

test('c3: horizontal win on the bottom row', () => {
  const m = L.newMini('c3', Math.random);
  L.applyMove(m, 'O', 0); L.applyMove(m, 'O', 1);
  const r = L.applyMove(m, 'O', 2);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), [c3idx(5, 0), c3idx(5, 1), c3idx(5, 2)]);
});

test('c3: diagonal wins in both directions', () => {
  // rising to the right: X at (5,0) (4,1) (3,2)
  let m = L.newMini('c3', Math.random);
  L.applyMove(m, 'X', 0);
  L.applyMove(m, 'O', 1); L.applyMove(m, 'X', 1);
  L.applyMove(m, 'O', 2); L.applyMove(m, 'O', 2);
  let r = L.applyMove(m, 'X', 2);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([c3idx(5, 0), c3idx(4, 1), c3idx(3, 2)]));
  // rising to the left: X at (5,4) (4,3) (3,2)
  m = L.newMini('c3', Math.random);
  L.applyMove(m, 'X', 4);
  L.applyMove(m, 'O', 3); L.applyMove(m, 'X', 3);
  L.applyMove(m, 'O', 2); L.applyMove(m, 'O', 2);
  r = L.applyMove(m, 'X', 2);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), sorted([c3idx(5, 4), c3idx(4, 3), c3idx(3, 2)]));
});

test('c3: a full column and bad columns are rejected', () => {
  const m = L.newMini('c3', Math.random);
  for (let k = 0; k < 6; k++) assert.equal(L.applyMove(m, k % 2 ? 'O' : 'X', 0).outcome, 'continue');
  assert.deepEqual(L.applyMove(m, 'X', 0), { ok: false, reason: 'full' });
  assert.equal(L.applyMove(m, 'X', 5).ok, false);
  assert.equal(L.applyMove(m, 'X', -1).ok, false);
});

// One of the 8 full 5x6 boards with no three in a row; X has 16 pieces, O has 14.
const C3_DRAW = [
  'X', 'O', 'X', 'O', 'X',
  'X', 'O', 'X', 'O', 'X',
  'O', 'X', 'O', 'X', 'O',
  'O', 'X', 'O', 'X', 'O',
  'X', 'O', 'X', 'O', 'X',
  'X', 'O', 'X', 'O', 'X',
];

test('c3: filling the board with no three in a row is a draw (lopsided 16 vs 14)', () => {
  const m = L.newMini('c3', Math.random);
  let last;
  for (let col = 0; col < L.C3.cols; col++) {
    for (let row = L.C3.rows - 1; row >= 0; row--) {
      last = L.applyMove(m, C3_DRAW[c3idx(row, col)], col);
      assert.equal(last.ok, true);
    }
  }
  assert.equal(last.outcome, 'draw');
  assert.deepEqual(m.cells, C3_DRAW);
  assert.equal(m.cells.filter(c => c === 'X').length, 16);
});

test('c3: a drawn square resets through playMove', () => {
  const st = matchWith(['c3']);
  const m = st.squares[0].mini;
  for (let col = 0; col < L.C3.cols; col++) {
    for (let row = L.C3.rows - 1; row >= 0; row--) {
      if (row === 0 && col === 4) break;
      L.applyMove(m, C3_DRAW[c3idx(row, col)], col);
    }
  }
  st.turn = C3_DRAW[c3idx(0, 4)];
  assert.equal(L.playMove(st, 0, 4, typeRng('nim')).ok, true);
  assert.equal(st.flash.kind, 'draw');
  assert.equal(st.squares[0].owner, null);
  assert.equal(st.squares[0].mini.type, 'nim');
  assert.equal(st.squares[0].mini.stones, L.NIM_START);
});

// ================================ Battleship ================================
test('bs: the hidden cell comes from the rng and is inside the grid', () => {
  for (let k = 0; k < 9; k++) assert.equal(L.newMini('bs', seq(pick(k, 9))).hidden, k);
  for (let k = 0; k < 200; k++) {
    const h = L.newMini('bs', Math.random).hidden;
    assert.ok(Number.isInteger(h) && h >= 0 && h <= 8);
  }
});

test('bs: misses stay marked, cannot be revealed twice, and the hit wins', () => {
  const m = L.newMini('bs', seq(pick(4, 9)));
  const r1 = L.applyMove(m, 'X', 0);
  assert.deepEqual(r1, { ok: true, outcome: 'continue', note: 'miss' });
  assert.equal(m.revealed[0], 'X');
  assert.equal(L.applyMove(m, 'O', 0).ok, false);
  assert.equal(L.applyMove(m, 'O', 8).outcome, 'continue');
  const hit = L.applyMove(m, 'O', 4);
  assert.equal(hit.outcome, 'win');
  assert.deepEqual(hit.cells, [4]);
});

test('bs: one player revealing every cell on consecutive turns always ends in a hit (no draw possible)', () => {
  for (let h = 0; h < 9; h++) {
    const m = L.newMini('bs', seq(pick(h, 9)));
    for (let c = 0; c < 9; c++) {
      if (c === h) continue;
      assert.equal(L.applyMove(m, 'X', c).outcome, 'continue');
    }
    assert.equal(m.revealed.filter(Boolean).length, 8);
    assert.equal(L.applyMove(m, 'X', h).outcome, 'win');
  }
});

// =================================== Nim ===================================
test('nim: only 1, 2 or 3 stones can be taken, never more than remain', () => {
  const m = L.newMini('nim', Math.random);
  for (const bad of [0, 4, -1, 1.5, '2']) assert.equal(L.applyMove(m, 'X', bad).ok, false, `take ${bad}`);
  m.stones = 2;
  assert.deepEqual(L.applyMove(m, 'X', 3), { ok: false, reason: 'too-many' });
  assert.equal(m.stones, 2);
});

test('nim: 3, 3, 3, 1 by the same player takes the last stone and wins (lopsided)', () => {
  const m = L.newMini('nim', Math.random);
  assert.deepEqual(L.applyMove(m, 'X', 3), { ok: true, outcome: 'continue', note: 'took' });
  assert.equal(m.stones, 7);
  L.applyMove(m, 'X', 3); L.applyMove(m, 'X', 3);
  assert.equal(m.stones, 1);
  assert.deepEqual(m.last, { by: 'X', n: 3 });
  assert.equal(L.applyMove(m, 'X', 1).outcome, 'win');
  assert.equal(m.stones, 0);
});

test('nim: taking exactly the remaining stones wins', () => {
  const m = L.newMini('nim', Math.random);
  m.stones = 2;
  assert.equal(L.applyMove(m, 'O', 2).outcome, 'win');
});

// ============================ Match flow / main board ============================
test('newMatch: nine unclaimed squares, each with a random mini-game, X to move', () => {
  const st = L.newMatch();
  assert.equal(st.turn, 'X');
  assert.equal(st.screen, 'board');
  assert.equal(st.squares.length, 9);
  for (const sq of st.squares) {
    assert.equal(sq.owner, null);
    assert.ok(L.TYPES.includes(sq.mini.type));
  }
  const seen = new Set();
  const rng = lcg(1);
  for (let k = 0; k < 50; k++) L.newMatch(rng).squares.forEach(s => seen.add(s.mini.type));
  assert.deepEqual([...seen].sort(), [...L.TYPES].sort());
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
  L.endFlash(st);
  assert.equal(L.endFlash(st), false);
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
  const st = matchWith(['nim', 'nim', 'nim', 'ttt']);
  for (let i = 0; i < 3; i++) st.squares[i].mini.stones = 1;
  assert.equal(turn(st, 0, 1).kind, 'claim');
  turn(st, 3, 0);
  assert.equal(turn(st, 1, 1).kind, 'claim');
  turn(st, 3, 1);
  const r = L.playMove(st, 2, 1);
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

test('a full main board with no line goes to the player with more squares', () => {
  // O O X / X O O / O X [X] : X claims the last square and still loses 4 to 5
  let st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'nim']);
  ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X'].forEach((o, i) => { st.squares[i].owner = o; });
  st.squares[8].mini.stones = 1;
  st.turn = 'X';
  assert.equal(L.playMove(st, 8, 1).ok, true);
  assert.equal(st.flash.kind, 'match');
  assert.equal(st.winner, 'O');
  assert.equal(st.winReason, 'majority');
  assert.equal(st.winLine, null);
  assert.deepEqual(st.counts, { X: 4, O: 5 });

  // mirror image: X has the majority
  st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'nim']);
  ['X', 'X', 'O', 'O', 'X', 'X', 'X', 'O'].forEach((o, i) => { st.squares[i].owner = o; });
  st.squares[8].mini.stones = 1;
  st.turn = 'O';
  L.playMove(st, 8, 1);
  assert.equal(st.winner, 'X');
  assert.deepEqual(st.counts, { X: 5, O: 4 });
});

test('state stays a plain JSON-serialisable object through a whole match', () => {
  const rng = lcg(2024);
  const st = L.newMatch(rng);
  let guard = 0;
  while (!st.winner && guard++ < 2000) {
    const open = st.squares.map((s, i) => (s.owner ? -1 : i)).filter(i => i >= 0);
    const i = open[Math.floor(rng() * open.length)];
    const mini = st.squares[i].mini;
    let m;
    if (mini.type === 'ttt') { const e = mini.cells.map((c, k) => (c ? -1 : k)).filter(k => k >= 0); m = e[Math.floor(rng() * e.length)]; }
    else if (mini.type === 'c3') { const e = [0, 1, 2, 3, 4].filter(c => !mini.cells[c]); m = e[Math.floor(rng() * e.length)]; }
    else if (mini.type === 'bs') { const e = mini.revealed.map((c, k) => (c ? -1 : k)).filter(k => k >= 0); m = e[Math.floor(rng() * e.length)]; }
    else m = 1 + Math.floor(rng() * Math.min(3, mini.stones));
    const r = L.playMove(st, i, m, rng);
    assert.equal(r.ok, true);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
    L.endFlash(st);
  }
  assert.ok(st.winner, 'random play finishes a match');
  assert.equal(st.screen, 'win');
});
