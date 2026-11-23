'use strict';
// Simulations: Treasure Hunt by Hint difficulty (slow, never part of npm test: `npm run sim -- hunt`). The computer
// against itself, 500 squares at Normal at each setting (rules.js HUNT_HINTS: normal Hot 1, Warm 2-3, Cool 4-5, Cold 6+;
// hard Hot 1-2, Warm 3-5, Cool 6-8, Cold 9+; harder Hot 1-3, Warm 4-6, Cold 7+), Shared (the default) and Race.
// Treasure Hunt does not meet the batch's 3-6 turns each and says so here instead of asserting it: a Shared square is one
// race for one treasure on clues both players read, so Normal v Normal runs a median 2 turns each at the default hints
// (1.7 on average, first mover 43%), 2 at hard (1.9, 50%) and 2.5 at harder (2.3, 48%); Race 2.5 / 2.5 / 3.25 turns each,
// the first mover 66% / 60% / 55% (a longer race evens it out). What it asserts: every square ends, the Shared first mover
// within 40-60% at every setting, and each harder setting longer than the one before (Shared turns each; one player's digs
// alone: 3.4 / 3.8-3.9 / 4.5 at Normal, 3.3 / 3.8 / 4.1-4.2 at Hard). The computer's estimate of the digs left (ai.js
// HUNT_PACE) is fitted here: Normal's digs from the cells still possible, as a share of the default's information a dig.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const { duel, line } = require('./duel.js');

const HINTS = ['normal', 'hard', 'harder'];
test('hunt: 500 squares at Normal by Hint difficulty: the first mover and the turns each (Shared, the default; Race)', () => {
  const each = {};
  for (const hints of HINTS) {
    const r = duel('hunt', 'normal', 'normal', 500, { hints });
    console.log(line(`Normal v Normal, Shared, ${hints} hints`, r));
    assert.equal(r.open, 0); assert.ok(r.first >= 0.4 && r.first <= 0.6, `${hints}: first mover ${r.first}`);
    each[hints] = r.each;
    const race = duel('hunt', 'normal', 'normal', 500, { hints, mode: 'race' });
    console.log(line(`Normal v Normal, Race, ${hints} hints`, race));
    assert.equal(race.open, 0);
  }
  assert.ok(each.normal < each.hard && each.hard < each.harder, `harder is longer: ${HINTS.map(h => each[h].toFixed(2)).join(' < ')}`);
});

// One player alone (a Race square, X's grid only): the digs to find the treasure, over N dealt treasures.
function solo(hints, level, N) {
  E.setTune('hunt', { hints, mode: 'race' });
  let all = 0, edge = 0, ne = 0;
  try {
    for (let k = 0; k < N; k++) {
      const rng = E.makeRng(`hunt-solo:${hints}:${k}`), m = E.newMini('hunt', rng);
      let d = 0, r;
      do { const b = E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level, until: null }); r = E.applyMove(m, 'X', b.move, rng); d++; } while (r.outcome !== 'win' && d < 40);
      assert.equal(r.outcome, 'win');
      all += d; if (E.rulesOf('hunt').huntEdge(m.tg.X, 6)) { edge += d; ne++; }
    }
  } finally { E.setTune('hunt', null); }
  return { all: all / N, edge: edge / ne, inside: (all - edge) / (N - ne) };
}
test('hunt: one player alone by Hint difficulty: each harder setting takes more digs (Normal and Hard); an edge treasure stays the quicker', () => {
  for (const level of ['normal', 'hard']) {
    const s = HINTS.map(h => solo(h, level, level === 'hard' ? 200 : 400));
    HINTS.forEach((h, k) => console.log(`  ${level}, ${h} hints: ${s[k].all.toFixed(2)} digs (edge ${s[k].edge.toFixed(2)}, inside ${s[k].inside.toFixed(2)})`));
    assert.ok(s[0].all < s[1].all && s[1].all < s[2].all, `${level}: ${s.map(x => x.all.toFixed(2)).join(' < ')}`);
    for (const x of s) assert.ok(x.edge < x.inside, 'the race deals both treasures on the edge or both inside: still the right split');
  }
});

test('hunt: the computer\'s estimate of the digs left by Hint difficulty (ai.js HUNT_PACE) against the digs Normal takes', () => {
  const { HUNT_PACE } = require('../../src/games/hunt/ai.js');
  const fit = hints => {                                         // 1 + log2(cells still possible) / D, D by least squares
    E.setTune('hunt', { hints, mode: 'race' });
    let sxy = 0, sxx = 0;
    try {
      for (let k = 0; k < 600; k++) {
        const rng = E.makeRng(`hunt-fit:${hints}:${k}`), m = E.newMini('hunt', rng), seen = [];
        let r;
        do { const pm = E.publicMini(m, 'X'); seen.push(E.huntCandidates(pm, 'X').length); r = E.applyMove(m, 'X', E.localBest(pm, 'X', rng, {}, { level: 'normal', until: null }).move, rng); } while (r.outcome !== 'win');
        seen.forEach((c, i) => { if (c >= 2) { const x = Math.log2(c), y = seen.length - i; sxy += x * (y - 1); sxx += x * x; } });
      }
    } finally { E.setTune('hunt', null); }
    return sxx / sxy;
  };
  const D = Object.fromEntries(HINTS.map(h => [h, fit(h)]));
  for (const h of HINTS) {
    const pace = D[h] / D.normal;
    console.log(`  ${h} hints: D ${D[h].toFixed(3)}, a dig ${pace.toFixed(3)} of the default's (HUNT_PACE ${HUNT_PACE[h]})`);
    assert.ok(Math.abs(pace - HUNT_PACE[h]) < 0.07, `${h}: measured ${pace.toFixed(3)} against ${HUNT_PACE[h]}`);
  }
});
