'use strict';
// Four in a Row's opening book (src/games/c4/table.js): node tests/sim/c4-table.js   (slow: about 1.5 s a position)
// For every position Hard can meet in its first plies (ai.js C4_BOOK_PLIES) when it follows the table and the
// other side plays anything, moving first or second: the column its own search (ai.js c4Deep) chooses with
// BOOK_NODES positions instead of a move's C4_DEEP.nodes. Not the solved game: a longer look by the same judge.
// The empty board is the middle column (the solved game's one winning opening).
const fs = require('node:fs'), path = require('node:path');
require('../engine.js');                                         // (the engine first: the modules load in its order)
const A = require('../../src/games/c4/ai.js'), R = require('../../src/games/c4/rules.js'), L = require('../../src/games/shared/lines.js');
const FILE = path.join(__dirname, '../../src/games/c4/table.js');
const BOOK_NODES = Number(process.env.BOOK_NODES || 2000000), cap = Object.assign({}, A.C4_DEEP, { nodes: BOOK_NODES });
const book = new Map(), other = p => (p === 'X' ? 'O' : 'X');
const over = (cells, p) => !!L.findRun(cells, 7, 6, 4, p) || cells.every(Boolean);
function line(cells, me, plies) {   // me to move: its entry, then on along every answer
  const k = A.c4Key(cells, me);
  let col;
  if (book.has(k.key)) col = k.flip ? 6 - book.get(k.key) : book.get(k.key);
  else { col = cells.some(Boolean) ? A.c4Deep(cells, me, null, cap).moves[0].i : 3; book.set(k.key, k.flip ? 6 - col : col); if (book.size % 20 === 0) process.stderr.write(book.size + ' '); }
  if (plies + 2 > A.C4_BOOK_PLIES) return;
  const a = cells.slice(); a[R.c4Drop(a, col)] = me;
  if (over(a, me)) return;
  for (let c = 0; c < 7; c++) { const at = R.c4Drop(a, c); if (at < 0) continue; const b = a.slice(); b[at] = other(me); if (!over(b, other(me))) line(b, me, plies + 2); }
}
const empty = new Array(42).fill(null);
line(empty, 'X', 0);
for (let c = 0; c < 7; c++) { const b = empty.slice(); b[R.c4Drop(b, c)] = 'X'; line(b, 'O', 1); }
const text = [...book.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => k + '=' + v);
const rows = []; for (let i = 0; i < text.length; i += 8) rows.push(text.slice(i, i + 8).join(' '));
const out = `// Four in a Row: the opening book (written by tests/sim/c4-table.js; do not edit by hand). key=column: the mover's
// pieces and the other side's as masks (ai.js c4Key), and the column Hard's own search chooses with ${BOOK_NODES} positions.
// ${book.size} positions: every one Hard can meet in its first ${A.C4_BOOK_PLIES} plies when it follows the table.
export const C4_BOOK = \`
${rows.join('\n')}
\`.replace(/\\s+/g, ' ').trim();
`;
fs.writeFileSync(FILE, out);
console.log(`\n${book.size} positions, ${out.length} bytes`);
