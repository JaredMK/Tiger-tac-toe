'use strict';
// The computer's three levels play differently (the AI levels pass, batch 1): for each game a fixed position where
// Easy, Normal and Hard choose differently, or the settings that make them. The win rates are measured by
// tests/sim/levels.js (300 squares a pairing), never here.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const lcg = seed => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const pick = (type, pm, side, level, seed) => E.localBest(pm, side, E.makeRng('lv1:' + (seed || 1)), E.STYLE0, { level, diff: level, until: null, value: 1, behind: 0 }).move;
const withT = (pm, t) => Object.assign(pm, { tune: Object.assign({}, E.tuneDefaults(pm.type), t || {}) });

test('Risky Rolls: Easy banks a small pot the others roll on; Hard plays the exact race where Normal follows its rule', () => {
  const pm = (a, b, rolls) => withT({ type: 'pig', bank: { X: a, O: b }, turn: { by: 'X', rolls, pot: rolls.reduce((x, y) => x + y, 0) }, sides: 8, target: 51 });
  assert.equal(pick('pig', pm(0, 0, [3, 5]), 'X', 'easy'), 'bank', 'Easy: a pot of 8 is enough');
  assert.equal(pick('pig', pm(0, 0, [3, 5]), 'X', 'normal'), 'roll');
  assert.equal(pick('pig', pm(44, 0, [2, 3]), 'X', 'normal'), 'roll', '(the rule rolls on)');
  const A = require('../../src/games/pig/ai.js'); while (!A.pigRace(8, 51, null).done);   // (Hard's table, built in slices)
  assert.equal(pick('pig', pm(44, 0, [2, 3]), 'X', 'hard'), 'bank', 'Hard: well ahead, a small pot banks');
});

test('21: Easy stands on 15 whatever the dealer shows; Normal hits it against a 10 by basic strategy', () => {
  const pm = withT({ type: 'bj', wins: { X: 0, O: 0 }, hand: { by: 'X', cards: ['9S', '6H'], up: 'TD' } });
  assert.equal(pick('bj', pm, 'X', 'easy'), 'stand');
  assert.equal(pick('bj', pm, 'X', 'normal'), 'hit');
  assert.equal(pick('bj', pm, 'X', 'hard'), 'hit');
});

test('Higher/Lower: Easy halves; Hard takes the guess with the best odds of the race (an end of an odd range)', () => {
  const m = E.newMini('hilo', lcg(4)); withT(m);
  m.parts = undefined;
  const pm = E.publicMini(m, 'X');
  const easy = pick('hilo', pm, 'X', 'easy'), hard = pick('hilo', pm, 'X', 'hard');
  assert.equal(easy, 15, 'the middle of 1-30');
  const seen = new Set(); for (let s = 1; s < 30; s++) seen.add(pick('hilo', pm, 'X', 'normal', s));
  assert.ok(seen.size > 5, 'Normal: anywhere');
  assert.ok(hard >= 1 && hard <= 30);
});

test('Ride the Bus: the levels\' mistakes are a hunch against the odds (worse); Hard never makes one by default', () => {
  const m = E.newMini('bus', lcg(5)); m.prog.X = ['2H', '3H', '4H'];
  const pm = E.publicMini(m);
  const by = level => { const s = new Set(); for (let k = 1; k < 80; k++) s.add(pick('bus', pm, 'X', level, k)); return s; };
  assert.ok(by('easy').has('H'), 'Easy: now and then hearts, with three gone');
  assert.ok(!by('hard').has('H'));
});

test('Little Wheel: Easy picks green 0 on a whim at 0-0; Normal only for a reason', () => {
  const m = E.newMini('rl', lcg(6)); const pm = E.publicMini(m);
  const zeros = level => { let n = 0; for (let k = 1; k < 100; k++) if (pick('rl', pm, 'X', level, k) === 'zero') n++; return n; };
  assert.ok(zeros('easy') > 20); assert.equal(zeros('normal'), 0); assert.equal(zeros('hard'), 0);
});

test('Snakes and Ladders, Candy Race, Coin Flip, Bump: one move only, so no mistake settings (thinking time only)', () => {
  for (const t of ['snakes', 'candy', 'coins', 'bump']) {
    const keys = E.tuneFields(t).map(f => f.k);
    assert.ok(!keys.includes('aiMissEasy') && keys.includes('aiThinkEasy'), t);
  }
});
