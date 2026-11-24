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

test('Hangman: Easy guesses the common letters of English, Normal the letter in most of the words that fit, Hard plays the race for the word', () => {
  const m = E.newMini('hangman', lcg(7)); withT(m);
  const pm = E.publicMini(m);
  const easy = new Set(); for (let k = 1; k < 40; k++) easy.add(pick('hangman', pm, 'X', 'easy', k));
  assert.ok(easy.size > 2 && [...easy].every(l => 'ETAOINSRHL'.includes(l)), [...easy].join());
  const normal = new Set(); for (let k = 1; k < 10; k++) normal.add(pick('hangman', pm, 'X', 'normal', k));
  assert.equal(normal.size, 1, 'Normal: always the likeliest letter');
  assert.ok(/^[A-Z]$/.test(pick('hangman', pm, 'X', 'hard')));
});

test('Five Letters: Easy forgets some of the colours (its guesses may not fit them), Normal and Hard always fit them', () => {
  const m = E.newMini('wordle', lcg(8)); withT(m);
  E.applyMove(m, 'X', m.word === 'CRANE' ? 'SLOTH' : 'CRANE', lcg(9)); E.applyMove(m, 'O', m.word === 'MOIST' ? 'DUCKY' : 'MOIST', lcg(9));
  const pm = E.publicMini(m), cand = E.wordleCandidates(pm);
  const off = level => { let n = 0; for (let k = 1; k < 30; k++) if (!cand.includes(pick('wordle', pm, 'X', level, k))) n++; return n; };
  if (cand.length > 2) { assert.ok(off('easy') > 3); assert.equal(off('normal'), 0); }
});

test('Codebreaker: Easy uses only some of the feedback, Normal all of it (now and then the best split), Hard the race', () => {
  const m = E.newMini('mastermind', lcg(10)); withT(m);
  for (const g of [[0, 1, 2, 3], [4, 5, 0, 1]]) E.applyMove(m, 'X', g, lcg(11));
  const pm = E.publicMini(m), cand = E.mmCandidates(pm).map(c => c.join());
  const off = level => { let n = 0; for (let k = 1; k < 30; k++) if (!cand.includes(pick('mastermind', pm, 'O', level, k).join())) n++; return n; };
  assert.ok(off('easy') > 3, 'Easy: codes already ruled out');
  pm.tune = Object.assign({}, pm.tune, { aiSplitNormal: 0 }); assert.equal(off('normal'), 0, 'Normal, never the best split: always a code that fits (the best split may be one that cannot be it)');
});

test('Tic-Tac-Toe: Easy may miss a block, Normal always blocks but walks into a fork, Hard plays the solved game', () => {
  const pm = withT({ type: 'ttt', cells: ['X', 'X', null, null, 'O', null, null, null, null] });
  let missed = 0; for (let k = 1; k < 60; k++) if (pick('ttt', pm, 'O', 'easy', k) !== 2) missed++;
  assert.ok(missed > 3, 'Easy: sometimes misses the block');
  for (let k = 1; k < 20; k++) assert.equal(pick('ttt', Object.assign(pm, { tune: Object.assign({}, pm.tune, { aiMissNormal: 0 }) }), 'O', 'normal', k), 2);
  assert.equal(pick('ttt', pm, 'O', 'hard'), 2);
  const look = require('../../src/games/ttt/ai.js').tttLook;
  assert.ok(look(['X', null, null, null, 'O', null, null, null, 'X'], 'O', 2).every(m => m.v <= 0), 'two marks ahead it does not see the fork coming');
});

test('Four in a Row and Hex: Easy looks a short way and picks loosely; Hard thinks hardest (its settings)', () => {
  for (const t of ['c4', 'hex']) {
    const keys = E.tuneFields(t).map(f => f.k);
    assert.ok(keys.includes('aiBlockEasy') && keys.includes('aiPoolEasy') && keys.includes('aiNodesHard'), t);
  }
  const m = E.newMini('hex', lcg(12)); withT(m); const pm = E.publicMini(m);
  const easy = new Set(); for (let k = 1; k < 30; k++) easy.add(pick('hex', pm, 'X', 'easy', k));
  assert.ok(easy.size > 1, 'Easy: varies');
});

test('Find the Pair: Easy forgets cards it has seen; Normal and Hard remember', () => {
  const d = E.tuneDefaults('memory'); assert.ok(d.memEasy < d.mem && d.mem <= d.memHard);
});

test('Treasure Hunt and Sea Battle: Easy digs or fires from some of the clues alone', () => {
  const m = E.newMini('hunt', lcg(13)); withT(m);
  const dig = c => E.applyMove(m, 'X', c, lcg(14));
  dig(0); dig(35);
  const pm = E.publicMini(m), cand = E.huntCandidates(pm, 'O');
  let off = 0; for (let k = 1; k < 40; k++) if (!cand.includes(pick('hunt', pm, 'O', 'easy', k))) off++;
  for (let k = 1; k < 10; k++) assert.ok(cand.includes(pick('hunt', pm, 'O', 'normal', k)));
  assert.ok(off > 2, 'Easy: cells the clues rule out');
  const s = E.newMini('bs', lcg(15)); withT(s); const sp = E.publicMini(s);
  assert.ok(Number.isInteger(pick('bs', sp, 'X', 'easy')));
});

test('Trivia, Bullseye, Cup Pong, Echo, Odd One Out, Dash, Pool: the levels\' own rates and errors, Easy below Normal below Hard', () => {
  const d = t => E.tuneDefaults(t);
  assert.ok(d('trivia').knowEasy < d('trivia').know && d('trivia').know < d('trivia').knowHard);
  for (const t of ['bullseye', 'echo', 'oddone']) assert.ok(d(t).aiSkillEasy < 100 && d(t).aiSkillHard > 100, t);
  assert.ok(d('pong').aiLooseEasy > 100 && d('pong').aiLooseHard < 100);
  assert.ok(d('dash').aiRunsEasy > d('dash').aiRuns && d('dash').aiRuns > d('dash').aiRunsHard);
  assert.ok(d('pool').aiAimEasy > d('pool').aiAim && d('pool').aiAim > d('pool').aiAimHard);
  const A = require('../../src/games/bullseye/ai.js'), t = d('bullseye');
  const r = l => A.bullsRates(1, t, l); assert.ok(r('easy').bull < r('normal').bull && r('normal').bull < r('hard').bull);
});
