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
  src + '\n;({ TYPES, INFO, C4, HEX_N, HILO, DICE_GOAL, MEMORY, CANDY, NAME_MAX, WORDS5, WORDS_HANG, VALID5, LINES, other, newMini, newState,' +
  ' startMatch, newMatch, defaultSetup, enabledGames, playerName, findRun, applyMove, mainResult, playMove, endFlash, wordleMarks, hexNeighbors,' +
  ' hexPath, memoryDeck, candyTrack, canMove, anyMove })',
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
const REMOVED = ['nim', 'chomp', 'obstruction', 'tug', 'othello', 'hexapawn'];

function matchWith(types, rng = lcg(7)) {
  const st = L.newMatch(rng);
  types.forEach((t, i) => { st.squares[i].mini = L.newMini(t, rng); });
  return st;
}
// make one full turn and clear the result overlay, as the UI does
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
  assert.equal(st.turn, L.other(TTT_DRAW[8]), 'turn still passes after a draw');
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
  assert.equal(L.applyMove(m, 'X', 5).ok, false);
  assert.equal(L.applyMove(m, 'X', -1).ok, false);
});

// A full 5x6 board with no three in a row (so no four either); X has 16 pieces, O has 14.
const C4_DRAW = [
  'X', 'O', 'X', 'O', 'X',
  'X', 'O', 'X', 'O', 'X',
  'O', 'X', 'O', 'X', 'O',
  'O', 'X', 'O', 'X', 'O',
  'X', 'O', 'X', 'O', 'X',
  'X', 'O', 'X', 'O', 'X',
];

test('c4: filling the board with no four in a row is a draw (lopsided 16 vs 14)', () => {
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
  assert.equal(m.cells.filter(c => c === 'X').length, 16);
});

test('c4: a drawn square resets through playMove', () => {
  const st = matchWith(['c4']);
  const m = st.squares[0].mini;
  for (let col = 0; col < L.C4.cols; col++) {
    for (let row = L.C4.rows - 1; row >= 0; row--) {
      if (row === 0 && col === 4) break;
      L.applyMove(m, C4_DRAW[c4idx(row, col)], col);
    }
  }
  st.turn = C4_DRAW[c4idx(0, 4)];
  assert.equal(L.playMove(st, 0, 4, typeRng('hex')).ok, true);
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
  assert.equal(st.turn, 'O');
  assert.equal(st.lock, null);
  L.endFlash(st);
  assert.equal(st.screen, 'board');
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
test('dice: a roll of 1 to 6 comes from the rng and adds to the roller, first to 15 wins', () => {
  const m = mini('dice');
  assert.deepEqual(L.applyMove(m, 'X', 1, seq(pick(3, 6))), { ok: true, outcome: 'continue', note: 'roll' });
  assert.deepEqual(m.totals, { X: 4, O: 0 });
  assert.deepEqual(m.last, { by: 'X', roll: 4 });
  L.applyMove(m, 'O', 1, seq(pick(5, 6)));
  assert.deepEqual(m.totals, { X: 4, O: 6 });
  L.applyMove(m, 'X', 'whatever', seq(pick(5, 6)));   // the move value is ignored, only the roll matters
  L.applyMove(m, 'X', 1, seq(pick(4, 6)));
  assert.equal(L.applyMove(m, 'X', 1, seq(pick(0, 6))).outcome, 'win');   // 4 + 6 + 5 + 1 = 16 >= 15
  assert.deepEqual(m.totals, { X: 16, O: 6 });
  const seen = new Set();
  for (let k = 0; k < 500; k++) { const d = mini('dice'); L.applyMove(d, 'X', 1, Math.random); seen.add(d.last.roll); }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
});

test('dice: three straight rolls by one player can win before the other ever rolls (lopsided)', () => {
  const st = matchWith(['dice', 'ttt']);
  turn(st, 0, 1, seq(pick(5, 6))); turn(st, 1, 0);
  turn(st, 0, 1, seq(pick(5, 6))); turn(st, 1, 1);
  const f = turn(st, 0, 1, seq(pick(2, 6)));
  assert.equal(f.kind, 'claim');
  assert.deepEqual(st.squares[0].mini.totals, { X: 15, O: 0 });
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

// ================================ Setup / match flow ================================
test('setup: the app opens on the setup screen with default names and every game ticked', () => {
  const st = L.newState(lcg(1));
  assert.equal(st.v, 4);
  assert.equal(st.screen, 'setup');
  assert.deepEqual(st.setup.names, { X: 'X', O: 'O' });
  assert.deepEqual(L.enabledGames(st.setup), L.TYPES);
  assert.equal(L.TYPES.length, 10);
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

// a legal random move for any mini-game
function randomMove(m, rng) {
  const pickFrom = a => a[Math.floor(rng() * a.length)];
  const empties = (arr, ok) => arr.map((c, k) => (ok(c) ? k : -1)).filter(k => k >= 0);
  switch (m.type) {
    case 'ttt': case 'hex': return pickFrom(empties(m.cells, c => !c));
    case 'c4': return pickFrom([0, 1, 2, 3, 4].filter(c => !m.cells[c]));
    case 'bs': return pickFrom(empties(m.revealed, c => !c));
    case 'wordle': return rng() < 0.2 ? m.word : pickFrom(L.WORDS5).toUpperCase();
    case 'hangman': return pickFrom('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(l => !m.letters.some(x => x.l === l)));
    case 'dice': case 'candy': return 1;
    case 'hilo': return m.lo + Math.floor(rng() * (m.hi - m.lo + 1));
    case 'memory': { const a = Math.floor(rng() * 9); let b = Math.floor(rng() * 8); if (b >= a) b++; return [a, b]; }
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
      const r = L.playMove(st, i, randomMove(m, rng), rng);
      assert.equal(r.ok, true, `${m.type}: ${r.reason}`);
      assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
      if (st.flash.kind === 'again') assert.equal(st.lock, i);
      else assert.equal(st.lock, null);
      if (st.flash.newType) types.add(st.flash.newType);
      L.endFlash(st);
    }
    assert.ok(st.winner, 'random play finishes a match');
    assert.equal(st.screen, 'win');
  }
  assert.deepEqual([...types].sort(), [...L.TYPES].sort(), 'every current game type showed up');
  for (const t of REMOVED) assert.ok(!types.has(t));
});
