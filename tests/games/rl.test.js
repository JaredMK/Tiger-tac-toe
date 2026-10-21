'use strict';
// Roulette: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Roulette ===================================== */
test('roulette: the wheel holds 1-24 (odd red, even black, alternating) and a green 0', () => {
  assert.deepEqual(E.RL.wheel.slice().sort((a, b) => a - b), Array.from({ length: 25 }, (_, k) => k));
  const w = E.RL.wheel.filter(n => n);
  for (let k = 1; k < w.length; k++) assert.notEqual(E.rlRed(w[k]), E.rlRed(w[k - 1]), 'red and black alternate round the wheel');
  assert.equal(E.rlRed(0), false);
});

test('roulette: every bet scores right, and the 0 rules', () => {
  const C = E.rlCovers;
  const nums = [1, 4, 7, 10, 13, 16, 19, 22];
  for (let n = 0; n <= 24; n++) {
    assert.equal(C(nums, n), nums.includes(n), `numbers, ${n}`);
    assert.equal(C('g1', n), n >= 1 && n <= 8); assert.equal(C('g2', n), n >= 9 && n <= 16); assert.equal(C('g3', n), n >= 17 && n <= 24);
    assert.equal(C('zero', n), n === 0);
  }
  assert.deepEqual(E.rlBet([22, 1, 4, 7, 10, 13, 16, 19]), nums, 'numbers sorted');
  for (const bad of [[1, 2, 3, 4, 5, 6, 7], [1, 1, 2, 3, 4, 5, 6, 7], [0, 1, 2, 3, 4, 5, 6, 7], [1, 2, 3, 4, 5, 6, 7, 25], 'g4', 'red', null, [1.5, 2, 3, 4, 5, 6, 7, 8]]) assert.equal(E.rlBet(bad), null, JSON.stringify(bad));
  // through the move: the spin lands where the rng says (pocket k round the wheel)
  const at = n => () => (E.RL.wheel.indexOf(n) + 0.5) / 25;
  let m = E.newMini('rl', lcg(1));
  assert.deepEqual(E.applyMove(m, 'X', 'g2', at(13)), { ok: true, outcome: 'continue', note: 'hit' });
  assert.deepEqual(E.applyMove(m, 'X', 'g2', at(0)), { ok: true, outcome: 'continue', note: 'miss' }, '0 on a group: a miss');
  assert.deepEqual(E.applyMove(m, 'O', nums, at(0)), { ok: true, outcome: 'continue', note: 'miss' }, '0 on numbers: a miss');
  assert.deepEqual(E.applyMove(m, 'O', 'zero', at(5)), { ok: true, outcome: 'continue', note: 'miss' });
  assert.deepEqual(m.hits, { X: 1, O: 0 });
  assert.deepEqual(E.applyMove(m, 'X', nums, at(22)), { ok: true, outcome: 'win', note: 'hit' }, 'the second hit takes the square');
  m = E.newMini('rl', lcg(1));
  assert.deepEqual(E.applyMove(m, 'O', 'zero', at(0)), { ok: true, outcome: 'win', note: 'zero' }, 'a bet on 0, landing on 0: at once');
  assert.deepEqual(m.hits, { X: 0, O: 0 });
  assert.equal(E.applyMove(m, 'X', [1, 2, 3], at(1)).reason, 'bad');
});

test('roulette: many spins land evenly; a group or 8 numbers hit 8 in 25, green 0 one in 25', () => {
  const rng = lcg(424242), N = 100000, count = new Array(25).fill(0);
  let g = 0, n8 = 0, z = 0;
  for (let k = 0; k < N; k++) {
    const m = E.newMini('rl', lcg(1)), bet = k % 3 === 0 ? 'g3' : k % 3 === 1 ? [2, 3, 5, 8, 13, 17, 20, 24] : 'zero';
    E.applyMove(m, 'X', bet, rng);
    count[m.last.n]++;
    if (m.last.hit) { if (bet === 'zero') z++; else if (Array.isArray(bet)) n8++; else g++; }
  }
  for (let n = 0; n < 25; n++) assert.ok(Math.abs(count[n] / N - 1 / 25) < 0.004, `pocket ${n}: ${count[n] / N}`);
  assert.ok(Math.abs(g / (N / 3) - 8 / 25) < 0.012, `group ${g / (N / 3)}`);
  assert.ok(Math.abs(n8 / (N / 3) - 8 / 25) < 0.012, `numbers ${n8 / (N / 3)}`);
  assert.ok(Math.abs(z / (N / 3) - 1 / 25) < 0.006, `zero ${z / (N / 3)}`);
});

test('roulette: the computer bets a group as a rule, green 0 when the other side is a hit from a square that matters or it is well behind', () => {
  const pm = (x, o) => ({ type: 'rl', hits: { X: x, O: o } });
  const zeros = (p, ctx, n = 400) => { let k = 0; const rng = lcg(5); for (let i = 0; i < n; i++) if (E.localBest(p, 'X', rng, null, ctx).move === 'zero') k++; return k / n; };
  assert.equal(zeros(pm(0, 0), { value: 2, behind: 0 }), 0, 'level: never');
  assert.equal(zeros(pm(0, 1), { value: 2, behind: 0 }), 0, 'behind in an ordinary square: never');
  const crit = zeros(pm(0, 1), { value: E.AI.block + 1, behind: 0 });
  assert.ok(crit > 0.25 && crit < 0.55, `one hit from a square that matters: sometimes (${crit})`);
  const far = zeros(pm(0, 1), { value: 2, behind: 3 });
  assert.ok(far > 0.12 && far < 0.4, `well behind: now and then (${far})`);
  for (let i = 0; i < 50; i++) assert.ok(['g1', 'g2', 'g3'].includes(E.localBest(pm(1, 0), 'X', lcg(i), null, { value: 2, behind: 0 }).move));
});

test('roulette: a timeout bets a random group', () => {
  const seen = new Set();
  for (let seed = 1; seed < 40; seed++) {
    const st = E.newMatch(lcg(seed), { games: ['rl'], mode: 'online', timer: 60 });
    const r = E.timeoutMove(st, lcg(seed));
    assert.ok(['g1', 'g2', 'g3'].includes(r.move)); seen.add(r.move);
  }
  assert.equal(seen.size, 3);
});

test('roulette: the admin\'s settings (hits to win, the computer\'s bets on 0) are dealt into the square and played by', () => {
  E.setTune('rl', { goal: 3, zeroCrit: 0, zeroBehind: 100 });
  const m = E.newMini('rl', E.makeRng('rl-tune'));
  E.setTune('rl', null);
  assert.deepEqual(m.tune, { goal: 3, zeroCrit: 0, zeroBehind: 100 });
  m.hits.X = 1;
  let r;
  do r = E.applyMove(m, 'X', 'g1', E.makeRng('rl-' + m.spins.length + ':' + m.hits.X)); while (m.hits.X < 2 && m.spins.length < 6);
  assert.equal(m.hits.X, 2);
  assert.equal(r.outcome, 'continue', 'two hits: not yet, with three to win');
  const pm = E.publicMini(m); pm.hits = { X: 0, O: 2 };
  assert.equal(E.localBest(pm, 'X', E.makeRng('rl-ai'), null, { value: 0, behind: 2 }).move, 'zero', 'behind: always 0');
});

test('roulette: the Hard computer bets green 0 or a group by the chance of winning the square\'s race', () => {
  const A = require('../../src/games/rl/ai.js'), ctx = { level: 'hard', until: null, value: 2, behind: 0 };
  const pm = (x, o, goal) => ({ type: 'rl', hits: { X: x, O: o }, tune: goal ? { goal } : undefined });
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) assert.ok(['g1', 'g2', 'g3'].includes(A.best(pm(0, 0), 'X', lcg(i), {}, ctx).move), 'level: a group');
  assert.ok(['g1', 'g2', 'g3'].includes(A.best(pm(0, 1), 'X', lcg(1), {}, Object.assign({}, ctx, { value: E.AI.block + 1 })).move), 'two hits to win: a group even a hit behind on a square that matters');
  assert.equal(A.best(pm(0, 3, 4), 'X', lcg(1), {}, ctx).move, 'zero', 'four hits to win, none to three: green 0 (1 in 25 now beats four hits before their one)');
  assert.equal(A.best(pm(1, 3, 4), 'X', lcg(1), {}, ctx).move, 'zero', 'three hits to their one: still green 0'); assert.ok(A.best(pm(2, 3, 4), 'X', lcg(1), {}, ctx).move !== 'zero', 'two to their one: a group'); assert.ok(A.best(pm(0, 1, 4), 'X', lcg(1), {}, ctx).move !== 'zero');
  assert.equal(A.best(pm(0, 2, 3), 'X', lcg(1), {}, ctx).move, 'zero', 'three hits to win, none to two');
  assert.ok(performance.now() - t0 < 60, 'under 60 ms');
  const r = A.rlRace(4), P = r.P;
  assert.ok(P[0 * 4 + 3] > 0.11 && P[0 * 4 + 3] < 0.12, 'none to three, to move: ' + P[3].toFixed(3));
  assert.ok(P[3 * 4 + 0] > 0.92 && P[3 * 4 + 0] < 0.93, 'three to none, to move: ' + P[12].toFixed(3));
  assert.ok(Math.abs(P[0] - 0.526) < 0.002, 'the first to bet: ' + P[0].toFixed(3));
  assert.equal(A.rlRace(2).zero.some(Boolean), false, 'two hits to win: green 0 never');
  assert.equal(A.best(pm(0, 1), 'X', lcg(1), {}, Object.assign({}, ctx, { value: E.AI.block + 1 })).q, 0);
});
