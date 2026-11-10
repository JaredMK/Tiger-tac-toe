'use strict';
// Treasure Hunt, a Shared square: the first dig of a fresh grid, solved (about half a second for 6x6; never part of npm test):
//   node tests/sim/hunt-table.js [n]
// Every open cell is weighed at every position (a dig outside the cells it may be in too, and the waits: a dig that
// splits nothing), to the end. It prints each first dig's worth for the first mover and checks the cells
// src/games/hunt/ai.js opens with (HUNT_OPEN) against the best.
(async () => {
  await import('../../src/core/engine.js');
  const A = await import('../../src/games/hunt/ai.js');
  const n = Number(process.argv[2] || 6), t0 = Date.now(), vals = A.huntFirstDigs(n);
  let top = 0; for (const [, v] of vals) if (v > top) top = v;
  const bestCells = vals.filter(x => x[1] >= top - 1e-9).map(x => x[0]);
  for (let r = 0; r < n; r++) console.log(vals.slice(r * n, r * n + n).map(x => (100 * x[1]).toFixed(2)).join('  '));
  console.log(`${n}x${n}: the best first digs ${JSON.stringify(bestCells)} (${(100 * top).toFixed(2)}%), ${Date.now() - t0} ms`);
  const book = A.HUNT_FIRST[n];
  if (book) { const ok = JSON.stringify(book) === JSON.stringify(bestCells); console.log(ok ? 'HUNT_OPEN agrees' : `HUNT_OPEN differs: ${JSON.stringify(book)}`); if (!ok) process.exit(1); }
})();
