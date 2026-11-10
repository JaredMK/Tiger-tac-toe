'use strict';
// Takeover's opening book (src/games/takeover/table.js): node tests/sim/takeover-table.js
// The 5x5 game is solved by the computer's own search (ai.js takeSolve: the exact result with the players moving in
// turn); only the first move and the answer to a lone first move take long enough (up to a few hundred ms) to be
// worth a table: the empty board and every board with one move on it, either side to move, each with the moves
// ai.js takeBest chooses between. Keys: the mover's cells and the other side's, as bit masks.
const fs = require('node:fs'), path = require('node:path');
require('../engine.js');                                           // (the engine first: the modules load in its order)
const A = require('../../src/games/takeover/ai.js');
const N = 25, near = i => { const r = Math.floor(i / 5), c = i % 5; let m = 1 << i; if (r > 0) m |= 1 << (i - 5); if (r < 4) m |= 1 << (i + 5); if (c > 0) m |= 1 << (i - 1); if (c < 4) m |= 1 << (i + 1); return m; };
const book = {}, put = (me, opp) => { const b = A.takeBest(me, opp); book[me + ':' + opp] = `{ w: ${b.win ? 1 : 0}, m: [${b.moves.join(', ')}] }`; };
put(0, 0);
for (let i = 0; i < N; i++) { put(0, near(i)); put(near(i), 0); }
const first = A.takeRoot(0, 0).filter(x => x.v > 0).map(x => x.i);
const lines = Object.keys(book).map(k => `  '${k}': ${book[k]},`);
const out = `// Takeover: the opening book (written by tests/sim/takeover-table.js; do not edit by hand). For the empty 5x5 board and a board
// with one move played (the key: the mover's cells and the other side's, as bit masks), from the solved game: w, whether
// the mover takes the square, and m, the moves Hard chooses between. The first player wins the empty board with ${first.join(', ')}.
export const TAKE_BOOK = {
${lines.join('\n')}
};
`;
if (process.argv.includes('--check')) { const same = fs.readFileSync(path.join(__dirname, '../../src/games/takeover/table.js'), 'utf8') === out; console.log(same ? 'table.js is up to date' : 'table.js differs'); process.exit(same ? 0 : 1); }
fs.writeFileSync(path.join(__dirname, '../../src/games/takeover/table.js'), out);
console.log(`${Object.keys(book).length} positions; first-move wins: ${first.join(', ')}`);
