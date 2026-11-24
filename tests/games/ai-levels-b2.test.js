'use strict';
// The computer's three levels in a batch of games (the AI levels pass, November 2026): each level plays differently. Where
// the levels differ in strength, a short seeded pairing (tests/sim/levels.js pairing: the same squares every run) has the
// higher level ahead; where a game is luck and difficulty can barely matter, the levels still choose differently on a
// fixed position, or (pure luck, nothing to choose) carry no mistake rate at all. The 300-square figures are the levels
// sim's: node tests/sim/levels.js <ids> 300.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const { pairing } = require('../sim/levels.js');

// Hard v Easy over a few seeded squares: Hard takes more than `least` of the decided ones.
const AHEAD = { lane: 0.6, flap: 0.6, takeover: 0.6, flood: 0.6, shelves: 0.6, patterns: 0.6, scratch: 0.6, combo: 0.55, wheels: 0.55, seating: 0.55, districts: 0.6, dominoes: 0.55 };
for (const [g, least] of Object.entries(AHEAD)) {
  test(`${g}: Hard beats Easy on seeded squares (its levels play differently)`, () => {
    const r = pairing(g, 'hard', 'easy', 30, null, { seed: 'b2' });
    assert.ok(r.hiRate > least, `Hard's share ${(100 * r.hiRate).toFixed(0)}% (${r.hiWins}-${r.loWins}, ${r.draws} drawn)`);
  });
}

test('runners (Lane Rush, Flap, Chopper): each level its own runs to finish, Hard\'s runs the longest', () => {
  for (const g of ['lane', 'flap', 'chopper']) {
    const t = E.tuneDefaults(g);
    assert.ok(t.aiRunsHard < t.aiRuns && t.aiRuns < t.aiRunsEasy, `${g}: runs to finish, Hard < Normal < Easy`);
    const A = require(`../../src/games/${g}/ai.js`), len = lv => { let s = 0; for (let k = 0; k < 24; k++) { const m = E.newMini(g, E.makeRng(g + k)); s += A.best(E.publicMini(m, 'X'), 'X', E.makeRng('r' + k), {}, { level: lv }).move.dist; } return s; };
    const h = len('hard'), n = len('normal'), e = len('easy');
    assert.ok(h > n && n > e, `${g}: the distance a run goes, Hard ${h.toFixed(0)} > Normal ${n.toFixed(0)} > Easy ${e.toFixed(0)}`);
  }
});

test('Mini Golf and Bowling: each level its own hand (aim and power error, timing error), Hard the steadiest', () => {
  const g = E.tuneDefaults('golf');
  assert.ok(g.aiAimHard < g.aiAim && g.aiAim < g.aiAimEasy && g.aiPowHard < g.aiPow && g.aiPow < g.aiPowEasy);
  const GA = require('../../src/games/golf/ai.js'), pm = E.publicMini(E.newMini('golf', E.makeRng('g1')), 'X');
  assert.equal(E.tune(GA.golfLevel(pm, 'hard')).aiAim, g.aiAimHard); assert.equal(E.tune(GA.golfLevel(pm, 'easy')).aiPow, g.aiPowEasy);
  assert.equal(GA.golfLevel(pm, 'normal'), pm, 'Normal: the square as dealt (its keys from before the levels)');
  const b = E.tuneDefaults('bowling'), BA = require('../../src/games/bowling/ai.js'), bm = E.newMini('bowling', E.makeRng('b1'));
  assert.ok(b.aiMsHard < b.aiMs && b.aiMs < b.aiMsEasy);
  assert.deepEqual(['easy', 'normal', 'hard'].map(l => BA.errMs(bm, l)), [b.aiMsEasy, b.aiMs, b.aiMsHard]);
});

test('pure luck (Krabs, Apple Pick, War, Rock Paper Scissors): nothing to choose, so no mistake rate; a thinking time each level', () => {
  for (const g of ['craps', 'apple', 'war', 'rps']) {
    const keys = E.tuneFields(g).map(f => f.k);
    assert.equal(E.slipMode(g), null, g);
    assert.ok(!keys.some(k => k.startsWith('aiMiss')), `${g}: no mistake rate`);
    assert.ok(['aiThinkEasy', 'aiThinkNormal', 'aiThinkHard'].every(k => keys.includes(k)), `${g}: thinking times`);
  }
});

test('the old level-blind mistake rate is gone, folded into the levels\' (one mistake rate, never two stacked)', () => {
  for (const g of ['takeover', 'flood', 'seating', 'districts', 'shelves', 'roads', 'wheels', 'shut', 'combo', 'bglite', 'poker', 't31']) {
    const keys = E.tuneFields(g).map(f => f.k);
    assert.ok(!keys.includes('miss'), `${g}: no level-blind miss`);
    assert.ok(['aiMissEasy', 'aiMissNormal', 'aiMissHard'].every(k => keys.includes(k)), `${g}: the levels' mistake rates`);
    assert.equal(E.slipMode(g), g === 'seating' ? 'random' : 'own', `${g}: its own weaker move (Seating: any free seat)`);
  }
});

test('mostly luck, the levels still choose differently: Shut the Box\'s tiles, Ship Captain & Crew\'s keep, Risky Spins\' bank', () => {
  const sh = E.newMini('shut', E.makeRng('s')); sh.roll = { by: 'X', d: [3, 4] };
  const pick = (m, t, lv, seed) => E.localBest(E.publicMini(m, 'X'), 'X', E.makeRng(seed), {}, { level: lv, diff: lv }).move;
  const easy = new Set(), normal = new Set();
  for (let k = 0; k < 20; k++) { easy.add(JSON.stringify(pick(sh, 'shut', 'easy', 'e' + k))); normal.add(JSON.stringify(pick(sh, 'shut', 'normal', 'n' + k))); }
  assert.equal(normal.size, 1, 'Normal: its rule of thumb'); assert.ok(easy.size > 1 && !easy.has([...normal][0]), 'Easy: any other tiles');
  const sc = E.newMini('scc', E.makeRng('c')); sc.turn = { by: 'X', lv: 3, n: 1, cargo: [2, 3], dice: [6, 5, 4, 2, 3] };
  assert.deepEqual(['easy', 'normal'].map(lv => E.localPlain(E.publicMini(sc, 'X'), 'X', E.makeRng('k'), {}, { level: lv }).move), ['keep', 'roll'], 'a cargo of 5: Easy keeps it, Normal rolls again');
  const wh = E.newMini('wheels', E.makeRng('w')); wh.turn = { by: 'X', pot: 9, n: 3 };
  const W = lv => E.localPlain(E.publicMini(wh, 'X'), 'X', E.makeRng('w'), {}, { level: lv }).move;
  assert.equal(W('easy'), 'bank', 'Easy: cautious, banks a pot of 9'); assert.notEqual(W('normal'), 'bank', 'Normal pushes on');
});
