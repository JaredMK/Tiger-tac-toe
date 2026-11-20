'use strict';
// Simulations: Road Race (slow, never part of npm test: `npm run sim -- rally`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. The computer's lapses of attention stand in
// for a driver's: real play decides the road's width and how fast the car turns.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/rally/rules.js');
const { duel, line } = require('./duel.js');

test('rally: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('rally', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('rally: laps finished by level and set; by setting', () => {
  const rate = (level, t) => { E.setTune('rally', t || null); try { let ok = 0; const N = 1500; for (let k = 0; k < N; k++) { const m = E.newMini('rally', E.makeRng('t' + k)), c = R.rallyCfg(m); if (R.rallyDrive(c, R.rallyTrack(m, 'X'), E.makeRng(level + k), c.ai[level] / 100).run.done) ok++; } return (100 * ok / N).toFixed(1) + '%'; } finally { E.setTune('rally', null); } };
  console.log(`  laps finished: Easy ${rate('easy')}, Normal ${rate('normal')}, Hard ${rate('hard')}; Normal on gentle ${rate('normal', { tracks: 'gentle' })}, on twisty ${rate('normal', { tracks: 'twisty' })}; a perfect hand ${rate('normal', { aiLapse: 0 })}, on twisty ${rate('normal', { aiLapse: 0, tracks: 'twisty' })}`);
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('rally', a, b, 3000, t)));
  T('the defaults, 3,000 squares', null); T('1 lap', { laps: 1 }); T('3 laps', { laps: 3 }); T('road 30 wide', { width: 30 }); T('road 40 wide', { width: 40 }); T('speed 80', { speed: 80 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
