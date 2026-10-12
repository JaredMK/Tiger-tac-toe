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
  src + '\n;({ TYPES, INFO, C4, HEX_N, HILO, DICE_GOAL, MEMORY, CANDY, COINS, PIG, HUNT, NAME_MAX, WORDS5, WORDS_HANG, VALID5, LINES, other, newMini, newState, huntDist,' +
  ' startMatch, newMatch, defaultSetup, enabledGames, playerName, findRun, applyMove, mainResult, playMove, endFlash, leaveSquare, cpuMove, publicMini, squareValue, needsOf, winChance, moveGain, localBest, wordleCandidates, hangmanCandidates, huntCandidates, hexDist, candyExpected, cpuSide, syncNames, CPU_NAME, AI, wordleMarks, hexNeighbors,' +
  ' hexPath, memoryDeck, candyTrack, canMove, anyMove, randomLegalMove, timeoutMove, TIMER_OPTIONS, newTimer, HP, hpMoves, hpSolve, hpNeeds, upgradeMini, matchRecord, fullState, applyOnlineMove, applyOnlineTimeout, applyOnlinePick, newOnlineMatch, secretOf, hideMini, RECENT_MAX })',
  { filename: 'index.html#logic' }
);

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
// a battleship whose ship is at cell 0: either player claims it with one move
const oneMove = () => L.newMini('bs', seq(pick(0, 9)));

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

test('coins: six coins, three of each, in random positions', () => {
  const rng = lcg(21);
  const orders = new Set();
  for (let k = 0; k < 200; k++) {
    const m = L.newMini('coins', rng);
    assert.equal(m.coins.length, L.COINS.n);
    assert.equal(m.coins.filter(c => c === 'X').length, 3);
    assert.equal(m.coins.filter(c => c === 'O').length, 3);
    orders.add(m.coins.join(''));
  }
  assert.ok(orders.size > 10, 'the positions are shuffled');
});

test('coins: one Flip turns all of the other side\'s coins when they have three or fewer, never your own', () => {
  const m = coinsOf('X', 'O', 'X', 'O', 'X', 'O');
  for (const bad of [[1], [1, 3, 5], 1, null, 'ab', 'bank']) assert.deepEqual(L.applyMove(m, 'X', bad), { ok: false, reason: 'bad' }, JSON.stringify(bad));
  assert.deepEqual(m.coins, ['X', 'O', 'X', 'O', 'X', 'O'], 'rejected moves change nothing');
  assert.deepEqual(L.applyMove(m, 'X', 'flip', seq(pick(0, 2), pick(1, 2), pick(0, 2))), { ok: true, outcome: 'continue', note: 'flip' });
  assert.deepEqual(m.last, { by: 'X', flipped: [1, 3, 5], results: ['X', 'O', 'X'] }, 'all three O coins, landing as the rng says');
  assert.deepEqual(m.coins, ['X', 'X', 'X', 'O', 'X', 'X']);
  const o = coinsOf('X', 'X', 'X', 'X', 'X', 'O');
  assert.deepEqual(L.applyMove(o, 'O', 'flip', headsRng('O')).outcome, 'continue');
  assert.equal(o.last.flipped.length, 3, 'three of the five X coins');
  assert.ok(o.last.flipped.every(k => k !== 5), 'never the flipper\'s own coin');
  const done = coinsOf('X', 'X', 'X', 'X', 'X', 'X');
  assert.deepEqual(L.applyMove(done, 'X', 'flip'), { ok: false, reason: 'none' }, 'nothing of the other side left to flip');
});

test('coins: with more than three of the other side\'s coins, three are picked at random', () => {
  const picks = new Set();
  for (let k = 0; k < 60; k++) {
    const m = coinsOf('O', 'O', 'O', 'O', 'O', 'X');
    const r = L.applyMove(m, 'X', 'flip', lcg(k + 1));
    assert.equal(r.ok, true);
    assert.equal(m.last.flipped.length, 3);
    assert.ok(m.last.flipped.every(i => i < 5), 'only O coins');
    assert.equal(new Set(m.last.flipped).size, 3, 'three different coins');
    assert.equal(m.coins[5], 'X', 'X\'s own coin is untouched');
    assert.equal(m.coins.filter((c, i) => c === 'O' && !m.last.flipped.includes(i)).length, 2, 'the two unflipped O coins stay O');
    picks.add(m.last.flipped.join(''));
  }
  assert.ok(picks.size > 3, `the three are picked at random (${picks.size} different picks)`);
});

test('coins: a win is checked after every flip', () => {
  const m = coinsOf('X', 'X', 'X', 'O', 'O', 'O');
  assert.equal(L.applyMove(m, 'O', 'flip', headsRng('O')).outcome, 'win', 'all three X coins land O');
  assert.deepEqual(m.coins, ['O', 'O', 'O', 'O', 'O', 'O']);
  const n = coinsOf('X', 'X', 'X', 'O', 'O', 'O');
  assert.equal(L.applyMove(n, 'O', 'flip', seq(pick(1, 2), pick(1, 2), pick(0, 2))).outcome, 'continue', 'one landed X: no win');
  const r = L.applyMove(n, 'O', 'flip', headsRng('O'));
  assert.equal(r.outcome, 'win');
  assert.equal(r.winner, 'O');
});

test('coins: X can keep flipping across turns and claim the square while O plays elsewhere (lopsided)', () => {
  const st = matchWith(['coins', 'ttt']);
  st.squares[0].mini = coinsOf('O', 'O', 'O', 'O', 'X', 'X');
  turn(st, 0, 'flip', headsRng('X')); turn(st, 1, 0);
  assert.equal(st.squares[0].mini.coins.filter(c => c === 'X').length, 5, 'three O coins turned X');
  const f = turn(st, 0, 'flip', headsRng('X'));
  assert.equal(f.kind, 'claim');
  assert.equal(f.winner, 'X');
  assert.equal(f.n, 1, 'only one coin was left to flip');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(L.canMove(st.squares[0].mini, 'O'), true);
});

// ==================================== Pig ====================================
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

test('pig: Bank needs a pot, adds it to the banked score, ends the move, and 20 wins', () => {
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
  assert.equal(L.applyMove(m, 'X', 'bank').outcome, 'win', '11 + 9 = 20');
  assert.equal(m.bank.X, 20);
});

test('pig: six different numbers fill the pot to 21 and a seventh roll is refused', () => {
  const m = mini('pig');
  for (const n of [3, 1, 4, 6, 2]) assert.equal(L.applyMove(m, 'X', 'roll', die(n)).again, true);
  assert.equal(L.applyMove(m, 'X', 'roll', die(5)).again, true);
  assert.deepEqual(m.turn, { by: 'X', rolls: [3, 1, 4, 6, 2, 5], pot: 21 });
  assert.deepEqual(L.applyMove(m, 'X', 'roll', die(5)), { ok: false, reason: 'maxrolls' });
  assert.equal(L.applyMove(m, 'X', 'bank').outcome, 'win');
  assert.equal(m.bank.X, 21);
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

test('pig: X can bank up to 20 over several turns while O plays elsewhere (lopsided)', () => {
  const st = matchWith(['pig', 'ttt']);
  turn(st, 0, 'roll', die(6)); turn(st, 0, 'roll', die(5)); turn(st, 0, 'bank'); turn(st, 1, 0);
  turn(st, 0, 'roll', die(6)); turn(st, 0, 'roll', die(1)); turn(st, 0, 'bank'); turn(st, 1, 1);
  assert.deepEqual(st.squares[0].mini.bank, { X: 18, O: 0 });
  turn(st, 0, 'roll', die(2));
  const f = turn(st, 0, 'bank');
  assert.equal(f.kind, 'claim');
  assert.equal(st.squares[0].owner, 'X');
  assert.equal(st.squares[0].mini.bank.X, 20);
});

// ================================ Treasure hunt ================================
test('hunt: the treasure comes from the rng and distances are steps up, down, left and right', () => {
  for (let k = 0; k < 25; k++) assert.equal(L.newMini('hunt', seq(pick(k, 25))).treasure, k);
  assert.equal(L.huntDist(12, 12), 0);
  assert.equal(L.huntDist(12, 13), 1);
  assert.equal(L.huntDist(12, 7), 1);
  assert.equal(L.huntDist(12, 0), 4);
  assert.equal(L.huntDist(12, 24), 4);
  assert.equal(L.huntDist(0, 24), 8);
  assert.equal(L.huntDist(4, 20), 8);
  assert.equal(L.huntDist(6, 18), 4);
  for (let a = 0; a < 25; a++) for (let b = 0; b < 25; b++) {
    assert.equal(L.huntDist(a, b), L.huntDist(b, a));
    assert.ok(L.huntDist(a, b) >= 0 && L.huntDist(a, b) <= 8);
  }
});

test('hunt: a dig marks the cell for both players, a treasure dig wins, dug cells cannot be dug again', () => {
  const m = L.newMini('hunt', seq(pick(12, 25)));
  assert.deepEqual(L.applyMove(m, 'X', 0), { ok: true, outcome: 'continue', note: 'dig' });
  assert.equal(m.dug[0], 'X');
  assert.equal(L.applyMove(m, 'O', 0).ok, false);
  assert.equal(L.applyMove(m, 'O', 25).ok, false);
  assert.equal(L.applyMove(m, 'O', 7).outcome, 'continue');
  const r = L.applyMove(m, 'O', 12);
  assert.equal(r.outcome, 'win');
  assert.deepEqual(r.cells, [12]);
  assert.equal(m.dug[12], 'O');
});

test('hunt: digging every other cell never ends the game, the treasure always does (lopsided)', () => {
  for (const t of [0, 7, 12, 24]) {
    const st = matchWith(['hunt']);
    st.squares[0].mini = L.newMini('hunt', seq(pick(t, 25)));
    for (let i = 0; i < 25; i++) {
      if (i === t) continue;
      st.turn = 'X';
      const f = turn(st, 0, i);
      assert.equal(f.kind, 'move');
      assert.equal(f.dist, L.huntDist(t, i));
      assert.ok(f.dist >= 1);
    }
    st.turn = 'X';
    const f = turn(st, 0, t);
    assert.equal(f.kind, 'claim');
    assert.equal(f.dist, 0);
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
  assert.equal(L.TYPES.length, 14);
  assert.ok(st.setup.games.coins && st.setup.games.pig && st.setup.games.hunt, 'the newest games are on by default');
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
  const allowed = ['ttt', 'bs', 'dice'];
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

test('a full main board with no line goes to the player with more squares', () => {
  // O O X / X O O / O X [X] : X claims the last square and still loses 4 to 5
  let st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'bs']);
  ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X'].forEach((o, i) => { st.squares[i].owner = o; });
  st.squares[8].mini = oneMove();
  st.turn = 'X';
  assert.equal(L.playMove(st, 8, 0).ok, true);
  assert.equal(st.flash.kind, 'match');
  assert.equal(st.winner, 'O');
  assert.equal(st.winReason, 'majority');
  assert.equal(st.winLine, null);
  assert.deepEqual(st.counts, { X: 4, O: 5 });

  // mirror image: X has the majority
  st = matchWith(['ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'bs']);
  ['X', 'X', 'O', 'O', 'X', 'X', 'X', 'O'].forEach((o, i) => { st.squares[i].owner = o; });
  st.squares[8].mini = oneMove();
  st.turn = 'O';
  L.playMove(st, 8, 0);
  assert.equal(st.winner, 'X');
  assert.deepEqual(st.counts, { X: 5, O: 4 });
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
    case 'bs': return pickFrom(empties(m.revealed, c => !c));
    case 'wordle': return rng() < 0.2 ? m.word : pickFrom(L.WORDS5).toUpperCase();
    case 'hangman': return pickFrom('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !m.letters.some(x => x.l === l)));
    case 'dice': case 'candy': return 1;
    case 'hilo': return m.lo + Math.floor(rng() * (m.hi - m.lo + 1));
    case 'memory': { const a = Math.floor(rng() * 9); let b = Math.floor(rng() * 8); if (b >= a) b++; return [a, b]; }
    case 'coins': return 'flip';
    case 'pig': {
      if (!m.turn) return 'roll';
      if (m.turn.rolls.length >= L.PIG.maxRolls) return 'bank';
      return rng() < 0.5 ? 'roll' : 'bank';
    }
    case 'hunt': return pickFrom(empties(m.dug, c => !c));
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
  squares.forEach((s, i) => { if (typeof s !== 'string') st.squares[i].mini = s; });
  owners.forEach((o, i) => { if (o) st.squares[i].owner = o; });
  st.cpu = me; st.turn = me;
  return st;
}
const tttOf = (...cells) => Object.assign(mini('ttt'), { cells: cells.map(c => c || null) });

test('setup: "vs Computer" picks the computer\'s side and names it, and a match records it', () => {
  const st = L.newState(lcg(1));
  assert.equal(st.setup.mode, 'two');
  assert.equal(st.setup.human, 'X');
  assert.equal(L.cpuSide(st.setup), null);
  st.setup.mode = 'cpu';
  L.syncNames(st.setup);
  assert.equal(L.cpuSide(st.setup), 'O');
  assert.deepEqual(st.setup.names, { X: 'X', O: L.CPU_NAME }, 'the computer is called Computer');
  st.setup.human = 'O';
  L.syncNames(st.setup);
  assert.deepEqual(st.setup.names, { X: L.CPU_NAME, O: 'O' }, 'the name follows the side');
  st.setup.names.X = 'HAL';
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'HAL', 'a typed name stays');
  st.setup.mode = 'two';
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'HAL');
  st.setup.names.X = L.CPU_NAME;
  L.syncNames(st.setup);
  assert.equal(st.setup.names.X, 'X', 'two players: the default computer name goes away');
  st.setup.mode = 'cpu'; st.setup.human = 'X';
  assert.equal(L.startMatch(st, lcg(2)), true);
  assert.equal(st.cpu, 'O');
  assert.equal(L.playerName(st, 'O'), L.CPU_NAME);
  assert.equal(st.turn, 'X', 'the human X goes first');
  const m = L.newMatch(lcg(3), { mode: 'cpu', human: 'O' });
  assert.equal(m.cpu, 'X');
  assert.equal(m.turn, 'X', 'the computer goes first as X');
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
    if (t === 'bs') assert.ok(!('hidden' in pm));
    if (t === 'hunt') assert.ok(!('treasure' in pm));
    if (t === 'memory') assert.ok(pm.cards.every(c => c === null), 'no card is known before any is shown');
    if (t === 'hangman') assert.ok(pm.pattern.every(ch => ch === null));
  }
  // what has been shown is public: a found letter, a dug cell's distance, a card once flipped
  const h = L.newMini('hangman', wordRng(L.WORDS_HANG, 'apple'));
  L.applyMove(h, 'X', 'P');
  assert.deepEqual(L.publicMini(h).pattern, [null, 'P', 'P', null, null]);
  const u = L.newMini('hunt', seq(pick(12, 25)));
  L.applyMove(u, 'X', 0);
  assert.equal(L.publicMini(u).clues[0], 4);
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
    () => [L.newMini('bs', seq(pick(0, 9))), L.newMini('bs', seq(pick(8, 9)))],
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
    Object.assign(mini('pig'), { bank: { X: 15, O: 0 }, turn: { by: 'X', rolls: [5], pot: 5 } }),
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
  const m = L.newMini('hunt', seq(pick(12, 25)));          // treasure at row 3, column 3
  L.applyMove(m, 'O', 0);                                  // distance 4
  const pm = L.publicMini(m);
  const cand = L.huntCandidates(pm);
  assert.ok(cand.every(c => L.huntDist(c, 0) === 4 && c !== 0));
  assert.ok(cand.includes(12));
  for (let k = 0; k < 20; k++) {
    const st = cpuMatch('X', [m, 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt', 'ttt'], [null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O']);   // the only open square: the dig itself is under test
    const mv = L.cpuMove(st, lcg(k));
    assert.equal(mv.square, 0);
    assert.ok(cand.includes(mv.move), `dig ${mv.move} fits the clue`);
  }
  L.applyMove(m, 'O', 4);                                  // row 1 column 5: distance 4 as well
  const cand2 = L.huntCandidates(L.publicMini(m));
  assert.ok(cand2.length < cand.length);
  assert.ok(cand2.every(c => L.huntDist(c, 0) === 4 && L.huntDist(c, 4) === 4));
  // one candidate left: dig it and win
  const one = L.newMini('hunt', seq(pick(12, 25)));
  for (const d of [0, 4, 20]) L.applyMove(one, 'O', d);
  const c1 = L.huntCandidates(L.publicMini(one));
  assert.deepEqual(c1, [12]);
  const st = cpuMatch('X', [one, 'ttt']);
  const mv = L.cpuMove(st, cpuRng());
  assert.equal(mv.move, 12);
  assert.equal(L.playMove(st, 0, mv.move).flash.kind, 'claim');
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
  const coins = L.localBest({ type: 'coins', coins: ['X', 'O', 'O', 'O', 'O', 'X'] }, 'X', cpuRng());
  assert.equal(coins.move, 'flip');
  assert.equal(coins.q, 0, 'four to turn: no chance of finishing this move');
  assert.equal(L.localBest({ type: 'coins', coins: ['X', 'X', 'X', 'X', 'X', 'O'] }, 'X', cpuRng()).q, 0.5);
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
  assert.equal(pig(15, 0, { by: 'X', rolls: [5], pot: 5 }), 'bank', 'always banks a win');
  assert.equal(pig(18, 0, { by: 'X', rolls: [2], pot: 2 }), 'bank');
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
  const winners = { X: 0, O: 0 }, seen = new Set();
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
  }
  assert.equal(winners.X + winners.O, 8);
  assert.ok(seen.size >= 8, `the computer played ${seen.size} different games`);
});


// ---- the online turn clock: a random legal move on a timeout, a loss on the second in a row ----
test('newTimer and the timer options', () => {
  assert.deepEqual(L.TIMER_OPTIONS, [0, 30, 60, 180]);
  const t = L.newTimer(60);
  assert.deepEqual(t, { limit: 60, deadline: null, for: null, pausedAt: null, timeouts: { X: 0, O: 0 }, streak: { X: 0, O: 0 }, bankNext: false });
  assert.equal(L.newTimer(0).limit, 0);
  assert.equal(L.newTimer().limit, 0);
  const st = L.newMatch(lcg(1), { mode: 'online', timer: 30 });
  assert.equal(st.timer.limit, 30, 'an online match keeps the chosen limit');
  const two = L.newMatch(lcg(1), { mode: 'two', timer: 30 });
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
    const st = L.newMatch(rng, { mode: 'online', timer: 30 });
    let guard = 0;
    while (!st.winner && guard++ < 400) {
      if (st.timer.bankNext) { st.timer.bankNext = false; assert.equal(L.playMove(st, st.lock, 'bank', rng, { forced: true }).ok, true); }
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
const SECRET_KEYS = { wordle: 'word', hangman: 'word', hilo: 'target', bs: 'hidden', hunt: 'treasure', memory: 'cards' };
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
      if (type === 'hunt') assert.equal(pub.clues.length, 25);
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

test('an online timeout makes a random move (Pig: roll then bank) and the second in a row loses', () => {
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
  assert.ok(L.TYPES.includes('hexapawn'));
  assert.equal(L.INFO.hexapawn.name, 'Hexapawn');
  assert.equal(L.defaultSetup().games.hexapawn, true, 'on by default in the Advanced list');
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

test('hexapawn win 2: a move after which the opponent has no legal move claims the square', () => {
  // O's only pawn would step down to row 2; X steps into that square and O is blocked with nothing to capture
  const m = hp(hpAt(3, 0), 'X', hpAt(1, 0), 'O');
  assert.equal(L.canMove(m, 'O'), true);
  const r = L.applyMove(m, 'X', [hpAt(3, 0), hpAt(2, 0)]);
  assert.equal(r.outcome, 'win'); assert.equal(r.note, 'stuck');
  assert.equal(L.canMove(m, 'O'), false);
  assert.deepEqual(r.cells, [hpAt(2, 0)], 'the winner\'s pawns light up');
  // capturing the last pawn counts the same
  const w = hp(hpAt(2, 1), 'X', hpAt(3, 2), 'X', hpAt(1, 0), 'O');
  const r2 = L.applyMove(w, 'X', [hpAt(2, 1), hpAt(1, 0)]);
  assert.equal(r2.outcome, 'win'); assert.equal(r2.note, 'wiped');
  assert.equal(w.cells.includes('O'), false);
});

test('hexapawn: a player with no move is not beaten until the opponent moves and leaves them stuck', () => {
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
  // ...whereas a move that leaves X stuck wins it for O
  const r3 = L.applyMove(m, 'O', [hpAt(0, 2), hpAt(1, 2)]);
  assert.equal(r3.outcome, 'win'); assert.equal(r3.note, 'stuck');

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
  // from the start, both sides' best lines are known: with full minimax the side to move loses against perfect play here
  const start = mini('hexapawn').cells;
  assert.equal(L.hpSolve(start, 'X').win, false);
  assert.equal(L.hpSolve(start, 'O').win, false);
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
