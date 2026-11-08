'use strict';
// Simulations: Star Swarm. Slow, so never part of npm test:
// npm run sim -- swarm
// The settings (meta.js TUNE) were picked here (November 2026): see the figures printed by the run and the notes in
// meta.js. SWARM_N sets the squares played (default 600).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/swarm/ai.js');
const R = require('../../src/games/swarm/rules.js');
const mean = a => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);

test('star swarm: whole squares, the computer against itself, over many dealt squares: the first mover under 60%, the winner about 4 to 6 runs', () => {
  const N = Number(process.env.SWARM_N) || 600, tune = process.env.SWARM_TUNE ? JSON.parse(process.env.SWARM_TUNE) : null;
  let first = 0, wRuns = 0, allRuns = 0;
  const kills = [], secs = [], ends = {};
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng('swarm-sim' + g), m = E.newMini('swarm', rng);
    if (tune) m.tune = tune;
    let p = 'X';
    for (let k = 0; k < 200; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: 'normal', until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok, r.reason);
      kills.push(m.last.n); secs.push(m.last.steps * R.SW.step); ends[m.last.end] = (ends[m.last.end] || 0) + 1;
      if (r.outcome === 'win') { if (p === 'X') first++; wRuns += m.tries[p]; allRuns += m.tries.X + m.tries.O; break; }
      p = p === 'X' ? 'O' : 'X';
    }
  }
  const fm = first / N, w = wRuns / N, solo = A.needs(E.publicMini(E.newMini('swarm', E.makeRng('solo'))), 'X');
  console.log(`Star Swarm: first mover wins ${(100 * fm).toFixed(1)}%; the winner's runs ${w.toFixed(2)} (both players ${(allRuns / N).toFixed(1)}); a run shoots down ${mean(kills).toFixed(2)} on average and lasts ${mean(secs).toFixed(1)} s; ends ${JSON.stringify(ends)}; needs from a fresh square ${solo.toFixed(2)}`);
  assert.ok(fm < 0.6, `first-mover win rate under 60% (${(100 * fm).toFixed(1)}%)`);
  assert.ok(w >= 4 && w <= 6, `about 4 to 6 runs for the winner (${w.toFixed(2)})`);
});
test('star swarm: Hard shoots down more than Normal over the same squares', () => {
  const N = 40, ks = { normal: [], hard: [] };
  for (const level of ['normal', 'hard']) for (let s = 0; s < N; s++) { const m = E.newMini('swarm', E.makeRng('lv' + s)); m.tune = { target: 200 }; ks[level].push(R.swarmAi(m, 'X', E.makeRng('h' + s), level).move.n); }
  console.log(`Star Swarm: a run at Normal ${mean(ks.normal).toFixed(1)} enemies, at Hard ${mean(ks.hard).toFixed(1)} (target out of reach)`);
  assert.ok(mean(ks.hard) > mean(ks.normal) * 1.2, 'Hard well ahead of Normal');
});
