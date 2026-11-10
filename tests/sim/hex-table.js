'use strict';
// Hex's book (src/games/hex/table.js): node tests/sim/hex-table.js   (about a minute; --check compares)
// The 5x5 game solved with the computer's own search (ai.js hexSolver, here with a large table and no limit): the
// value of every opening, and the winner's move in every position the search at the board (HEX_SOLVE.cap positions,
// a fresh table) would not finish, along every line the other side can choose. A position is written as the mover
// sees it (the mover as X; ai.js hexKey). An entry: w or l (the mover wins or loses the square from there), then
// the cell, or s for the swap; a lone stone that may be taken has the swap first where that is the move, then the
// stone to play when it may not be.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
require('../engine.js');                                         // (the engine first: the modules load in its order)
const A = require('../../src/games/hex/ai.js');
const FILE = path.join(__dirname, '../../src/games/hex/table.js');
const big = A.hexSolver(22), small = A.hexSolver(16), CAP = A.HEX_SOLVE.cap;
big.start();
const cell = b => 31 - Math.clz32(b), FULL = (1 << 25) - 1;
const book = new Map(), seen = new Set();
const put = (X, O, win, m) => { const k = A.hexKey(X, O); book.set(k.key, (win ? 'w' : 'l') + (m === 's' ? 's' : k.h ? 24 - m : m)); return k; };
// the mover (X) in a position the board's search does not finish: its entry, and on along every answer
function line(X, O) {
  const k = A.hexKey(X, O);
  if (seen.has(k.key)) return;
  seen.add(k.key);
  small.start(CAP);
  if (small.move(k.X, k.O, 0).v !== 0) return;                   // solved at the board (as it searches there: the position as its key has it)
  const r = big.move(X, O, 0);
  if (r.v > 0) { put(X, O, true, cell(r.b)); answers(X | r.b, O); } else put(X, O, false, cell(big.trap(X, O, 0).b));
}
function answers(X, O) { let e = FULL & ~(X | O); while (e) { const b = e & -e; e ^= b; line(X, O | b); } }
// the openings: X's stone on k with O to move and no swap
const wins = [];
for (let k = 0; k < 25; k++) if (big.value(1 << k, 0, 1) < 0) wins.push(k);
assert.deepEqual(wins, A.HEX_WIN, 'the winning openings as ai.js has them');
// the empty board: the opening that wins whatever the answer
const sure = wins.filter(k => !wins.includes((k % 5) * 5 + Math.floor(k / 5)));
assert.deepEqual(sure, [3, 21]);
put(0, 0, true, 3); answers(1 << 3, 0);
// a lone stone of the other side (O's, on j): take it (it wins when an X stone there, O to move, does), or play on
let swaps = 0;
for (let j = 0; j < 25; j++) {
  const O = 1 << j, r = big.move(0, O, 0), taken = big.value(O, 0, 1) < 0, k = A.hexKey(0, O);
  seen.add(k.key);
  const stone = r.v > 0 ? 'w' + (k.h ? 24 - cell(r.b) : cell(r.b)) : 'l' + (k.h ? 24 - cell(big.trap(0, O, 0).b) : cell(big.trap(0, O, 0).b));
  if (r.v > 0) { book.set(k.key, stone); answers(r.b, O); }
  else if (taken) { book.set(k.key, 'ws,' + stone); swaps++; answers(O, 0); }
  else book.set(k.key, stone);
  assert.ok(r.v > 0 || taken || sure.includes((j % 5) * 5 + Math.floor(j / 5)), 'the second player wins every opening but the two');
}
const text = [...book.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => k + '=' + v);
const rows = []; for (let i = 0; i < text.length; i += 12) rows.push(text.slice(i, i + 12).join(' '));
const out = `// Hex: the book (written by tests/sim/hex-table.js; do not edit by hand). The solved 5x5 game: the winner's move in
// every position the search at the board would not finish (ai.js HEX_SOLVE.cap), along every line the other side can
// choose. key=entry: the position as the mover sees it (ai.js hexKey); w or l (the mover wins or loses the square),
// then the cell, or s for the swap (a lone stone: the swap, then the stone to play when it may not be taken).
// ${book.size} positions.
export const HEX_BOOK = \`
${rows.join('\n')}
\`.replace(/\\s+/g, ' ').trim();
`;
if (process.argv.includes('--check')) { const same = fs.readFileSync(FILE, 'utf8') === out; console.log(same ? 'table.js is up to date' : 'table.js differs'); process.exit(same ? 0 : 1); }
fs.writeFileSync(FILE, out);
console.log(`${book.size} positions (${swaps} swaps), ${out.length} bytes; ${big.nodes()} positions searched`);
