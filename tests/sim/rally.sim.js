'use strict';
// Simulations: Road Race (slow, never part of npm test: `npm run sim -- rally`). The computer against itself, 500
// squares at Normal (the standard), then by level and by setting. The computer's lapses of attention stand in for a
// driver's: real play decides the road's width, the car's speed and how sharply it turns.
// Since v 3 a crash keeps the lap's progress (the next attempt sets off where the car left the road), so every turn
// gets somewhere: a turn is a lap's line crossed or a crash, and three laps win (two, as when every attempt began at
// the line, gave 2.97 turns each, median 3, the first mover 59.6%). At the defaults, Normal v Normal: 4.84 turns each
// (median 4.5), the winner's 5.12 (median 5), the first mover 56.6% over these 500 squares, 58.9% over 3,000 (each
// turn adding about the same keeps the first mover near the top of the range: more laps or a harder road take it
// down, but only with more turns). Normal crashes once in a lap's worth of road (0.99), Hard 0.45 times, Easy 1.4
// times, a hand that never lapses never (still 36%, 64%, 22% and 100% of the laps from the line come round whole); no
// attempt from a kept place crashes before it has got 10 points on. By setting (1,000 squares each): 2 laps 3.0 turns
// (median 3), 62%; 4 laps 6.7 (6.5), 58%; gentle circuits 3.5, 62%; twisty 5.1, 60%; road 10 wide 5.6, 59%, 14 wide
// 4.5, 61%; speed 32 5.4, 59%, speed 20 3.7, 63%; turn 220 a second 4.6, 59%; Hard v Hard 3.5 turns, 65%; Easy v
// Easy 5.9, 61%; Hard beats Normal (Hard first 88%, Normal first 29%). The mean is held to 3-6 turns each and the
// median too, the first mover to 45-60%.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/rally/rules.js');
const { duel, line } = require('./duel.js');

test('rally: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('rally', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.equal(r.draws, 0);
  assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`);
  assert.ok(r.each >= 3 && r.each <= 6, `mean turns each ${r.each}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns each ${r.eachMed}`);
});
test('rally: crashes in a lap\'s worth of road, by level and setting; laps done from the line alone; by setting', () => {
  // a player driving alone, to the laps of the square: the crashes for each lap driven, the share of attempts that set
  // off from the line and came round without one, and the attempts that crashed before getting 10 points on
  const crashes = (level, t) => {
    E.setTune('rally', t || null);
    try {
      let crash = 0, laps = 0, whole = 0, fromLine = 0, stuck = 0;
      for (let g = 0; g < 200; g++) {
        const m = E.newMini('rally', E.makeRng('crash' + g)), c = R.rallyCfg(m), tr = R.rallyTrack(m), rng = E.makeRng(level + g);
        for (let k = 0; k < 60; k++) {
          const p0 = R.rallyFrom(m, 'X'), d = R.rallyDrive(c, tr, rng, c.ai[level] / 100, p0), r = E.applyMove(m, 'X', { log: d.log, steps: d.steps }, rng);
          if (p0 === 0) { fromLine++; if (m.last.done) whole++; }
          if (m.last.done) laps++; else if (m.last.crash) { crash++; if (R.rallyFrom(m, 'X') - p0 < 10) stuck++; }
          if (r.outcome === 'win') break;
        }
      }
      return `${(crash / laps).toFixed(2)} a lap (${(100 * whole / fromLine).toFixed(0)}% of laps from the line whole, ${stuck} stuck)`;
    } finally { E.setTune('rally', null); }
  };
  console.log(`  crashes: Easy ${crashes('easy')}, Normal ${crashes('normal')}, Hard ${crashes('hard')}; Normal on gentle ${crashes('normal', { tracks: 'gentle' })}, on twisty ${crashes('normal', { tracks: 'twisty' })}; a hand that never lapses ${crashes('normal', { aiLapse: 0 })}`);
  const T = (label, t, a = 'normal', b = 'normal', N = 1000) => console.log(line(label, duel('rally', a, b, N, t)));
  T('the defaults, 3,000 squares', null, 'normal', 'normal', 3000); T('2 laps', { laps: 2 }); T('4 laps', { laps: 4 }); T('gentle circuits', { tracks: 'gentle' }); T('twisty circuits', { tracks: 'twisty' });
  T('road 10 wide', { width: 10 }); T('road 14 wide', { width: 14 }); T('speed 32', { speed: 32 }); T('speed 20', { speed: 20 }); T('turn 220 a second', { turn: 220 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
