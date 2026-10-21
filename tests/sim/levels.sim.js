'use strict';
// The computer's levels against each other: Hard against Normal (and Easy against Normal) over many whole
// matches, sides swapped every match, every game but the physics ones. Slow: npm run sim -- levels
// (LEVELS_N=500 for the full run; LEVELS_BUDGET the ms a Hard decision may take, 100 by default; LEVELS_PHYSICS=1
// deals the physics games too).
const test = require('node:test');
const assert = require('node:assert/strict');
const { engine, runMany } = require('../../scripts/ai-arena.js');

const N = Number(process.env.LEVELS_N || 100), BUDGET = Number(process.env.LEVELS_BUDGET || 100), PHYSICS = process.env.LEVELS_PHYSICS === '1';
engine(PHYSICS);
async function versus(a, b) {
  const jobs = Array.from({ length: N }, (_, k) => ({ seed: `levels:${a}:${b}:${k}`, levels: { X: k % 2 ? b : a, O: k % 2 ? a : b }, budget: BUDGET, physics: PHYSICS }));
  const rs = await runMany(jobs);
  let w = 0, l = 0, d = 0, moves = 0, ms = 0, none = 0;
  rs.forEach((r, k) => { const me = k % 2 ? 'O' : 'X'; moves += r.moves; ms += r.ms; if (r.winner === 'none') none++; else if (r.winner === 'draw') d++; else if (r.winner === me) w++; else l++; });
  const dec = w + l + d;
  console.log(`${a} vs ${b}: ${N} matches, ${a} won ${w} (${(100 * w / dec).toFixed(1)}%), lost ${l}, drew ${d}${none ? `, ${none} unfinished` : ''}; ${(moves / N).toFixed(0)} moves a match, ${(ms / N / 1000).toFixed(1)} s a match`);
  return { w, l, d, dec };
}
test(`levels: Hard against Normal over ${N} matches (${BUDGET} ms a decision)`, async () => {
  const r = await versus('hard', 'normal');
  assert.ok(r.w > r.l, `Hard wins more than it loses (${r.w} to ${r.l})`);
});
test(`levels: Easy against Normal over ${N} matches`, async () => {
  const r = await versus('easy', 'normal');
  assert.ok(r.w < r.l, `Easy loses more than it wins (${r.w} to ${r.l})`);
});
