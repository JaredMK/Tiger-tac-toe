'use strict';
// Simulations: Muncher. Slow, so never part of npm test:
// npm run sim -- muncher
// The settings (meta.js TUNE) were picked here (November 2026, the 13 by 15 maze): see the figures in the report at the
// end of each test. The balance targets are for Normal play (the Normal computer against itself: about 4 to 6 runs for
// the winner, the first mover under 60%); Hard against Hard is a shorter race.
// MUN_SWEEP=1 sweeps a few settings (ghostSpeed, target, runSecs) on fewer squares and prints each.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/muncher/ai.js');
const R = require('../../src/games/muncher/rules.js');

function squares(level, N, tuneWith) {
  let first = 0, wRuns = 0, allRuns = 0, ate = 0, gh = 0, runs = 0, caught = 0;
  const byTry = [];
  for (let g = 0; g < N; g++) {
    if (tuneWith) E.setTune('muncher', tuneWith);
    const rng = E.makeRng('mun-sim' + level + g), m = E.newMini('muncher', rng);
    E.setTune('muncher', null);
    let p = 'X';
    for (let k = 0; k < 200; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level, until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok, r.reason);
      ate += b.move.ate; gh += b.move.gh; runs++; if (b.move.end === 'caught') caught++;
      const t = m.tries[p] - 1; byTry[t] = byTry[t] || { n: 0, g: 0, c: 0 }; byTry[t].n++; byTry[t].g += (m.last.to - m.last.from); if (b.move.end === 'caught') byTry[t].c++;
      if (r.outcome === 'win') { if (p === 'X') first++; wRuns += m.tries[p]; allRuns += m.tries.X + m.tries.O; break; }
      p = p === 'X' ? 'O' : 'X';
    }
  }
  return { first: first / N, wRuns: wRuns / N, allRuns: allRuns / N, ate: ate / runs, gh: gh / runs, caught: caught / runs, byTry: byTry.slice(0, 7).map(t => `${(t.g / t.n).toFixed(0)}/${(100 * t.c / t.n).toFixed(0)}%`).join(' ') };
}
const say = (name, s) => console.log(`Muncher (${name}): first mover wins ${(100 * s.first).toFixed(1)}%; the winner's runs ${s.wRuns.toFixed(2)} (both players ${s.allRuns.toFixed(1)}); a run eats ${s.ate.toFixed(1)} dots and ${s.gh.toFixed(2)} spooks, ${(100 * s.caught).toFixed(0)}% end on a spook; by run (gain/caught): ${s.byTry}`);
if (process.env.MUN_SWEEP) {
  test('muncher: a sweep of settings (Normal)', () => {
    const N = Number(process.env.MUN_SWEEP) > 1 ? Number(process.env.MUN_SWEEP) : 200;
    for (const t of JSON.parse(process.env.MUN_TUNES || '[{}]')) say('Normal ' + JSON.stringify(t), squares('normal', N, t));
  });
} else {
  test('muncher: whole squares, the Normal computer against itself: the first mover under 60%, the winner about 4 to 6 runs', () => {
    const N = 1000, s = squares('normal', N);
    say('Normal', s);
    assert.ok(s.first < 0.6, `first-mover win rate under 60% (${(100 * s.first).toFixed(1)}%)`);
    assert.ok(s.wRuns >= 4 && s.wRuns <= 6, `about 4 to 6 runs for the winner (${s.wRuns.toFixed(2)})`);
  });
  test('muncher: Hard against Hard: a run is worth more than Normal\'s, the square is decided sooner', () => {
    const N = 200, h = squares('hard', N), n = squares('normal', N);
    say('Hard', h);
    assert.ok(h.ate + h.gh * 5 > n.ate + n.gh * 5, 'Hard gains more a run');
    assert.ok(h.wRuns < n.wRuns, 'and gets there in fewer runs');
  });
  test('muncher: the computer\'s guess at the dots a run gains (ai.js MUN_GAIN) is near what a Normal run gains over a square', () => {
    const s = squares('normal', 300), gain = s.ate + s.gh * 5;
    console.log(`Muncher: a Normal run gains ${gain.toFixed(2)} dots over a square (MUN_GAIN ${A.MUN_GAIN})`);
    assert.ok(Math.abs(gain - A.MUN_GAIN) < 4);
  });
}
