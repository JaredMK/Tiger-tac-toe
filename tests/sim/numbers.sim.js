'use strict';
// Simulations: Number Target (slow, never part of npm test: `npm run sim -- numbers`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's chance of finding the way in
// an attempt stands in for a head for figures: real play decides the target's range and the seconds.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/numbers/rules.js');
const { duel, line } = require('./duel.js');

test('numbers: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('numbers', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('numbers: every puzzle can be solved in three steps; how many steps the shortest way takes', () => {
  const by = [0, 0, 0, 0], N = 3000; let none = 0;
  for (let g = 0; g < N; g++) { const m = E.newMini('numbers', E.makeRng('p' + g)); let d = 0; for (let k = 1; k <= 3 && !d; k++) if (R.numbersSolve(m.pz, k)) d = k; if (!d) none++; by[d]++; }
  console.log(`  ${N} puzzles: shortest way 1 step ${(100 * by[1] / N).toFixed(1)}%, 2 steps ${(100 * by[2] / N).toFixed(1)}%, 3 steps ${(100 * by[3] / N).toFixed(1)}%; unsolved ${none}`);
  assert.equal(none, 0);
});
test('numbers: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('numbers', a, b, 4000, t)));
  T('the defaults, 4,000 squares', null); T('1 attempt each a puzzle', { attempts: 1 }); T('3 attempts each', { attempts: 3 }); T('a head that finds the way 20% of the time', { aiPct: 20 }); T('30% of the time', { aiPct: 30 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
