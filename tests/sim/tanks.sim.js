'use strict';
// Simulations: Tank Duel (slow, never part of npm test: `npm run sim -- tanks`). The computer against itself, 500
// squares at Normal (the batch's standard: a mean and a median of 3 to 6 turns each, the first mover 45-60%, no square
// in a turn or two), then by setting and by level. The computer's error on the angle and the power stands in for a
// player's eye: real play decides the blast's reach and a hit's worth.
// December 2026, the defaults (health 100, a direct hit 40, a blast beside the hull 70% of that falling to nothing 9
// away, a crater of 5, wind up to 8, Normal off by 3.5 degrees and 5 points of power): Normal v Normal 4.8 turns each
// (median 4.5), the winner's 5.1, the first mover 54% over the 500 and 56% over 4,000, no draws. A hit never takes more
// than 40 of 100, so no square ends before a player's third shot (asserted). By setting (1,500 squares each): health 80
// 3.5 turns (57%), 120 5.6 (55%); a direct hit 50 3.5 (57%), 30 6.4 (55%); splash 100% 4.2 (57%), 50% 5.3 (55%); blast 6
// 5.2 (55%), 12 4.4 (57%); crater 8 5.0 (58%), none 4.75 (58%); no wind 4.6 (57%), to 15 4.8 (56%); flat 4.4 (59%), hills
// 150% 5.2 (56%); no fuel 4.7 (57%); Go again on success 3.3 turns (57%).
// The first mover's 55-58% is the duel's own: both fire the same shots in turn, and it barely moves with any setting.
// Hard (3 degrees and 4 points, three quarters of that once it has seen a shot fall, and it picks the shot that
// forgives its error: a flat hard one where the way is clear) is a marksman: Hard v Hard 3.2 turns each and the first
// mover 65% (with little left to chance, whoever fires first wins more: printed, not asserted, and not a handicap to
// be set against); Hard beats Normal about four squares in five (88% moving first, 72% moving second), Normal beats
// Easy two in three (73% and 61%); Easy v Easy 6.0 turns, 55%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { duel, line } = require('./duel.js');

test('tanks: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('tanks', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`);
  assert.ok(r.each >= 3 && r.each <= 6, `mean turns ${r.each}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
  // no square in a player's first turn or two: the shortest of 300 more
  let least = 99, early = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('tanks-early:' + g), m = E.newMini('tanks', rng), n = { X: 0, O: 0 }; let p = 'X';
    for (let k = 0; k < 400; k++) { n[p]++; const r2 = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng); if (r2.outcome !== 'continue') { const w = r2.winner || p; least = Math.min(least, n[w]); if (n[w] <= 2) early++; break; } p = p === 'X' ? 'O' : 'X'; }
  }
  console.log(`  the winner's fewest turns in 300 squares: ${least}; won within two turns: ${early}`);
  assert.equal(early, 0); assert.ok(least >= 3);
});
test('tanks: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 1500) => console.log(line(label, duel('tanks', a, b, n, t)));
  T('the defaults, 4,000 squares', null, 'normal', 'normal', 4000);
  T('health 80', { health: 80 }); T('health 120', { health: 120 }); T('a direct hit 50', { hitDmg: 50 }); T('a direct hit 30', { hitDmg: 30 });
  T('splash 100%', { splash: 100 }); T('splash 50%', { splash: 50 }); T('blast 6', { blast: 6 }); T('blast 12', { blast: 12 }); T('crater 8', { crater: 8 }); T('no crater', { crater: 0 });
  T('no wind', { windMin: 0, windMax: 0 }); T('wind to 15', { windMax: 15 }); T('flat ground', { hills: 0 }); T('hills 150%', { hills: 150 }); T('no fuel', { fuel: 0 });
  T('Go again on success', { again: 'on' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard'); T('Normal v Easy', null, 'normal', 'easy'); T('Easy v Normal', null, 'easy', 'normal');
});
