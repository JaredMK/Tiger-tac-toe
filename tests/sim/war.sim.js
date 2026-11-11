'use strict';
// Simulations: War. Slow, so never part of npm test:
// npm run sim -- war
// The settings (meta.js TUNE) were picked here (November 2026): 3 rounds to win, a war won worth 2: the winner takes about
// 4.4 flips (both players about 8.3 together), the first mover wins about 56%, and a square sees a war about every other
// time (a flip ties about one time in seventeen). 2 rounds was 2.9 flips and 59%; 4 rounds 6.1 flips and 55%. With the hot
// streak (a round won goes again, November 2026): the winner 4.45 flips, the first mover 56.8%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/war/ai.js');

test('war: whole squares, the computer against itself, over many dealt squares: the first mover under 60%, the winner about 4 to 6 flips', () => {
  const N = 20000;
  let first = 0, wFlips = 0, allFlips = 0, wars = 0, won = 0, flips = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('war-sim' + g), m = E.newMini('war', rng);
    let p = 'X';
    for (let k = 0; k < 400; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: 'normal', until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok);
      flips++; wars += m.last.wars; if (m.last.result === 'win') won++;
      if (r.outcome === 'win') { if (p === 'X') first++; wFlips += m.flips[p]; allFlips += m.flips.X + m.flips.O; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';   // (a round won goes again)
    }
  }
  const fm = first / N, w = wFlips / N;
  console.log(`War: first mover wins ${(100 * fm).toFixed(1)}%; the winner's flips ${w.toFixed(2)} (both players ${(allFlips / N).toFixed(1)}); ${(100 * won / flips).toFixed(1)}% of flips win the round; ${(wars / N).toFixed(2)} wars a square`);
  assert.ok(fm < 0.6, `first-mover win rate under 60% (${(100 * fm).toFixed(1)}%)`);
  assert.ok(w >= 4 && w <= 6, `about 4 to 6 flips for the winner (${w.toFixed(2)})`);
});
