'use strict';
// Simulations: Backgammon Lite. Slow, so never part of npm test:
// npm run sim -- bglite
// The settings (meta.js TUNE) were picked here (reworked November 2026: the pieces start on their own first point, bear
// off only from the home zone, a double is four moves), the computer against itself (Normal), 800 squares each:
//   length 6: home 2 5.18 turns a player, home 3 4.43, home 4 4.22; length 7: 4.92 / 4.19 / 3.98; length 8: 5.35 / 4.43 /
//   4.12; length 9: 6.60 / 5.25 / 4.67 (the opener's single die on). Without the single die the first mover won 51-60%
//   (length 8, home 3: 55.5%); with it, 46-53%. Picked: 8 points, a home zone of 3, the opening roll one die: about
//   4.4 turns a player, the first mover about 49%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/bglite/ai.js');

function square(seed, lx, lo) {
  const rng = E.makeRng(seed), m = E.newMini('bglite', rng), lv = { X: lx, O: lo }, turns = { X: 1, O: 0 };
  let p = 'X';
  for (let k = 0; k < 3000; k++) {
    const b = A.best(E.publicMini(m), p, rng, {}, { level: lv[p], until: null }), r = E.applyMove(m, p, b.move, rng);
    assert.ok(r.ok, r.reason);
    if (r.outcome === 'win') return { w: p, turns };
    if (!r.again) { p = p === 'X' ? 'O' : 'X'; turns[p]++; }
  }
  throw new Error('no end');
}
function run(N, lx, lo, tag) {
  let first = 0, wT = 0, all = 0;
  for (let g = 0; g < N; g++) { const r = square(`bgl-${tag}-${g}`, lx, lo); if (r.w === 'X') first++; wT += r.turns[r.w]; all += r.turns.X + r.turns.O; }
  return { fm: first / N, w: wT / N, avg: all / N / 2 };
}
test('bglite: whole squares, Normal against Normal: about 3 to 6 turns a player, the first mover under 60%', () => {
  const r = run(4000, 'normal', 'normal', 'nn');
  console.log(`Backgammon Lite, Normal v Normal: the first mover wins ${(100 * r.fm).toFixed(1)}%; the winner takes ${r.w.toFixed(2)} turns; ${r.avg.toFixed(2)} turns a player`);
  assert.ok(r.fm < 0.6, `first mover ${(100 * r.fm).toFixed(1)}%`);
  assert.ok(r.avg >= 3 && r.avg <= 6, `turns a player ${r.avg.toFixed(2)}`);
});
test('bglite: Hard against Hard, Hard against Normal, Normal against Easy', () => {
  const hh = run(500, 'hard', 'hard', 'hh'), hn = run(500, 'hard', 'normal', 'hn'), nh = run(500, 'normal', 'hard', 'nh'), ne = run(1500, 'normal', 'easy', 'ne'), en = run(1500, 'easy', 'normal', 'en');
  const hard = (hn.fm + (1 - nh.fm)) / 2, norm = (ne.fm + (1 - en.fm)) / 2;
  console.log(`Hard v Hard: first mover ${(100 * hh.fm).toFixed(1)}%, ${hh.avg.toFixed(2)} turns a player; Hard wins ${(100 * hard).toFixed(1)}% against Normal; Normal wins ${(100 * norm).toFixed(1)}% against Easy`);
  assert.ok(hard > 0.48, 'Hard at least holds its own against Normal');
  assert.ok(norm > 0.6, 'Normal well ahead of Easy');
  assert.ok(hh.avg >= 3 && hh.avg <= 6);
});
