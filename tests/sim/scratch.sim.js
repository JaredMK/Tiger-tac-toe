'use strict';
// Simulations: Scratch & Match. Slow, so never part of npm test:
// npm run sim -- scratch
// (Before the auto-scratch of November 2026 a pair in a line left its third frosted: the numbers below are from then.) The settings (meta.js TUNE) were picked here (November 2026): 6 pictures, one picture three times along a line, two
// pairs and two singles among the decoys. Normal against Normal (the obvious third panel, else any): the winner takes
// about 5.0 scratches, the first mover wins about 59%; Hard against Hard (every card still possible weighed): about 4.3
// scratches, the first mover about 58%; a lone card takes Normal about 6.0 scratches and Hard about 5.2. Two lines a
// card (lines: 2) is quicker (about 4.1 scratches) but the first mover edges over 60%.
// After the auto-scratch (a pair in a line opens its third in the same move) the same layout is quicker and favours the first
// mover more: Normal v Normal winner 3.8 scratches, first mover 59%; Hard v Hard 3.2 and 63%; a lone card Normal 4.7, Hard 3.8
// (no layout of the settings gets the winner to 4: tried 6 to 8 pictures, 0 to 3 pairs). The bounds below are the targets.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/scratch/ai.js');

function race(lvX, lvO, N, tag) {
  let first = 0, wTurns = 0, allTurns = 0, lone = 0;
  for (let g = 0; g < N; g++) {
    const rng = E.makeRng(`scratch-sim-${tag}-${g}`), m = E.newMini('scratch', rng);
    let p = 'X'; const n = { X: 0, O: 0 };
    for (let k = 0; k < 40; k++) {
      const b = A.best(E.publicMini(m), p, rng, {}, { level: p === 'X' ? lvX : lvO, until: null }), r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok);
      n[p]++;
      if (r.outcome === 'win') { if (p === 'X') first++; wTurns += n[p]; allTurns += n.X + n.O; break; }
      p = p === 'X' ? 'O' : 'X';
    }
    const solo = E.newMini('scratch', E.makeRng(`scratch-solo-${tag}-${g}`));
    let k = 0;
    for (; k < 9; k++) if (E.applyMove(solo, 'X', A.best(E.publicMini(solo), 'X', rng, {}, { level: lvX, until: null }).move, rng).outcome === 'win') break;
    lone += k + 1;
  }
  return { first: first / N, winner: wTurns / N, both: allTurns / N, lone: lone / N };
}
const say = (name, r) => console.log(`Scratch & Match, ${name}: first mover wins ${(100 * r.first).toFixed(1)}%; the winner's scratches ${r.winner.toFixed(2)} (both players ${r.both.toFixed(1)}); a lone card in ${r.lone.toFixed(2)}`);

test('scratch: whole squares, Normal against Normal over many dealt squares: the first mover under 60%, the winner about 4 to 6 scratches', () => {
  const r = race('normal', 'normal', 20000, 'nn');
  say('Normal v Normal', r);
  assert.ok(r.first < 0.6, `first-mover win rate under 60% (${(100 * r.first).toFixed(1)}%)`);
  assert.ok(r.winner >= 4 && r.winner <= 6, `about 4 to 6 scratches for the winner (${r.winner.toFixed(2)})`);
});
test('scratch: Hard against Hard: the first mover under 60%, the winner about 4 to 6 scratches; needs matches Hard\'s own lone card', () => {
  const r = race('hard', 'hard', 6000, 'hh');
  say('Hard v Hard', r);
  assert.ok(r.first < 0.6, `first-mover win rate under 60% (${(100 * r.first).toFixed(1)}%)`);
  assert.ok(r.winner >= 4 && r.winner <= 6, `about 4 to 6 scratches for the winner (${r.winner.toFixed(2)})`);
  const n0 = A.needs(E.publicMini(E.newMini('scratch', E.makeRng('needs'))), 'X');
  console.log(`a fresh card: needs ${n0.toFixed(2)}`);
  assert.ok(Math.abs(n0 - r.lone) < 0.6, `needs about Hard's lone card (${n0.toFixed(2)} against ${r.lone.toFixed(2)})`);
});
test('scratch: Hard against Normal: Hard wins most squares', () => {
  const r = race('hard', 'normal', 3000, 'hn');
  say('Hard (first) v Normal', r);
  assert.ok(r.first > 0.6, `Hard ahead (${(100 * r.first).toFixed(1)}%)`);
});
