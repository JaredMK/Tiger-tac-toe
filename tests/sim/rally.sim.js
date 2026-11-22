'use strict';
// Simulations: Road Race (slow, never part of npm test: `npm run sim -- rally`). The computer against itself, 500
// squares at Normal (the standard), then by level and by setting. The computer's lapses of attention stand in for a
// driver's: real play decides the road's width, the car's speed and how sharply it turns. A lap is all or nothing
// and two laps win, so the squares' lengths spread widely (a circuit with more bends is harder for a hand that
// lapses): the mean is held to 3-6 turns each and the median too, the first mover to 45-60%.
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
test('rally: laps finished by level and set; a lap\'s length; by setting', () => {
  const rate = (level, t) => { E.setTune('rally', t || null); try { let ok = 0, secs = 0, log = 0; const N = 1200; for (let k = 0; k < N; k++) { const m = E.newMini('rally', E.makeRng('t' + (k % 150))), c = R.rallyCfg(m), d = R.rallyDrive(c, R.rallyTrack(m), E.makeRng(level + k), c.ai[level] / 100); if (d.run.done) { ok++; secs += d.steps / R.RALLY.hz; log += d.log.length; } } return { pct: (100 * ok / N).toFixed(1) + '%', secs: (secs / ok).toFixed(1), log: Math.round(log / ok) }; } finally { E.setTune('rally', null); } };
  const n = rate('normal');
  console.log(`  laps finished: Easy ${rate('easy').pct}, Normal ${n.pct}, Hard ${rate('hard').pct}; Normal on gentle ${rate('normal', { tracks: 'gentle' }).pct}, on twisty ${rate('normal', { tracks: 'twisty' }).pct}; a hand that never lapses ${rate('normal', { aiLapse: 0 }).pct}, on twisty ${rate('normal', { aiLapse: 0, tracks: 'twisty' }).pct}`);
  console.log(`  a lap: ${n.secs} s, its steering ${n.log} changes of the wheel`);
  const T = (label, t, a = 'normal', b = 'normal', N = 1000) => console.log(line(label, duel('rally', a, b, N, t)));
  T('the defaults, 3,000 squares', null, 'normal', 'normal', 3000); T('1 lap', { laps: 1 }); T('3 laps', { laps: 3 }); T('gentle circuits', { tracks: 'gentle' }); T('twisty circuits', { tracks: 'twisty' });
  T('road 10 wide', { width: 10 }); T('road 14 wide', { width: 14 }); T('speed 32', { speed: 32 }); T('speed 20', { speed: 20 }); T('turn 220 a second', { turn: 220 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
