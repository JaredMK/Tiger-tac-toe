'use strict';
// Roulette: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = Object.assign({}, require('../engine.js'));
{ const set = E.setTune; E.setTune = (t, c) => set(t, Object.assign({ again: 'on' }, c)); }   // ("Go again on success" on: these tests play the success that keeps the turn; the default, off, has its own test)
E.setTune('rl', null);

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
  assert.deepEqual(E.applyMove(m, 'X', 'g2', at(13)), { ok: true, outcome: 'continue', note: 'hit', again: true }, 'a hit: the same player spins again (a hot streak)');
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

test('roulette: a timeout bets nothing; the turn is missed', () => {
  for (let seed = 1; seed < 10; seed++) {
    const st = E.newMatch(lcg(seed), { games: ['rl'], mode: 'online', timer: 60 });
    const r = E.timeoutMove(st, lcg(seed));
    assert.deepEqual([r, st.flash, st.squares.every(q => !q.mini.last)], [{ ok: true, missed: 'X' }, null, true]);
  }
});

test('roulette: the admin\'s settings (hits to win, the computer\'s bets on 0) are dealt into the square and played by', () => {
  E.setTune('rl', { goal: 3, zeroCrit: 0, zeroBehind: 100 });
  const m = E.newMini('rl', E.makeRng('rl-tune'));
  E.setTune('rl', null);
  assert.deepEqual(m.tune, { again: 'on', goal: 3, zeroCrit: 0, zeroBehind: 100 });
  m.hits.X = 1;
  let r;
  do r = E.applyMove(m, 'X', 'g1', E.makeRng('rl-' + m.spins.length + ':' + m.hits.X)); while (m.hits.X < 2 && m.spins.length < 6);
  assert.equal(m.hits.X, 2);
  assert.equal(r.outcome, 'continue', 'two hits: not yet, with three to win');
  const pm = E.publicMini(m); pm.hits = { X: 0, O: 2 };
  assert.equal(E.localBest(pm, 'X', E.makeRng('rl-ai'), null, { value: 0, behind: 2 }).move, 'zero', 'behind: always 0');
});

test('roulette: the Hard computer bets green 0 or a group by the chance of winning the square\'s race (a hit spins again: a hot streak)', () => {
  const A = require('../../src/games/rl/ai.js'), ctx = { level: 'hard', until: null, value: 2, behind: 0 };
  const pm = (x, o, goal) => ({ type: 'rl', hits: { X: x, O: o }, tune: goal ? { goal, again: 'on' } : { again: 'on' } });
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) assert.ok(['g1', 'g2', 'g3'].includes(A.best(pm(0, 0), 'X', lcg(i), {}, ctx).move), 'level: a group');
  assert.ok(['g1', 'g2', 'g3'].includes(A.best(pm(0, 1), 'X', lcg(1), {}, Object.assign({}, ctx, { value: E.AI.block + 1 })).move), 'two hits to win: a group even a hit behind on a square that matters');
  for (const [x, o, g] of [[0, 3, 4], [1, 3, 4], [2, 3, 4], [0, 1, 4], [0, 2, 3]]) assert.ok(A.best(pm(x, o, g), 'X', lcg(1), {}, ctx).move !== 'zero', `${x} to ${o} of ${g}: a group (a hit spins again, so a run of hits beats 1 in 25)`);
  assert.ok(performance.now() - t0 < 60, 'under 60 ms');
  for (const g of [2, 3, 4]) assert.equal(A.rlRace(g).zero.some(Boolean), false, `${g} hits to win: green 0 never`);
  const r = A.rlRace(4), P = r.P;
  assert.ok(P[0 * 4 + 3] > 0.12 && P[0 * 4 + 3] < 0.13, 'none to three, to move: ' + P[3].toFixed(3));
  assert.ok(P[3 * 4 + 0] > 0.91 && P[3 * 4 + 0] < 0.92, 'three to none, to move: ' + P[12].toFixed(3));
  assert.ok(Math.abs(P[0] - 0.530) < 0.002, 'the first to bet: ' + P[0].toFixed(3));
  // the race by hand, goal 2: a hit and then another in the same turn takes it
  const h = 8 / 25, P2 = A.rlRace(2).P;
  assert.ok(Math.abs(P2[1 * 2 + 1] - (h + (1 - h) * (1 - P2[1 * 2 + 1]))) < 1e-9, 'one each: a hit takes it, a miss hands over');
  assert.ok(Math.abs(P2[0] - (h * P2[1 * 2 + 0] + (1 - h) * (1 - P2[0]))) < 1e-9, 'none each: a hit spins again from one to none');
  const q = A.best(pm(0, 1), 'X', lcg(1), {}, Object.assign({}, ctx, { value: E.AI.block + 1 })).q;
  assert.ok(Math.abs(q - h * h) < 1e-9, 'q: both hits in this turn');
});

test('roulette: a hot streak: a hit keeps the turn (spin again, online too), a miss passes it, the square won ends it; a timeout owed a spin spins nothing; Super Chaos spins once a round', () => {
  const at = n => () => (E.RL.wheel.indexOf(n) + 0.5) / 25;
  const st = E.newMatch(lcg(3), { games: ['rl'] }), p = st.turn, o = p === 'X' ? 'O' : 'X';
  E.playMove(st, 0, 'g1', at(3));
  assert.deepEqual([st.flash.kind, st.flash.rl.hit], ['again', true], 'a hit: the turn goes on');
  E.endFlash(st); assert.deepEqual([st.turn, st.lock, st.screen], [p, 0, 'mini']);
  assert.equal(E.playMove(st, 1, 'g1', at(3)).reason, 'locked');
  E.playMove(st, 0, 'g1', at(20));
  assert.deepEqual([st.flash.kind, st.flash.rl.hit], ['move', false], 'a miss');
  E.endFlash(st); assert.deepEqual([st.turn, st.lock], [o, null], 'the turn passes');
  // online: two hits in a row take the square in one turn
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'rl'])), rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, lcg(4), 'rls'), q = rec.state.turn;
  let r = E.applyOnlineMove(rec, q, 4, 'g2', at(10));
  assert.deepEqual([r.entries[0].kind, r.rec.state.turn, r.rec.state.lock], ['again', q, 4]);
  // (a timeout here: nothing spun for them, the turn passes and it is not a miss)
  const t = E.applyOnlineTimeout(r.rec, at(10)), tf = E.fullState(t.rec);
  assert.deepEqual([t.entries, tf.turn, tf.lock, tf.timer.miss.kind, tf.squares[4].mini.hits[q], tf.squares[4].mini.spins.length], [[], q === 'X' ? 'O' : 'X', null, 'ended', 1, 1]);
  r = E.applyOnlineMove(r.rec, q, 4, [1, 2, 3, 4, 5, 6, 7, 8], at(7));
  assert.deepEqual([r.entries[0].kind, r.rec.state.squares[4].owner, r.rec.state.turn], ['claim', q, q === 'X' ? 'O' : 'X'], 'the second hit: the square');
  const m = E.newMini('rl', lcg(1)); m.spin = 5;
  assert.deepEqual(require('../../src/games/rl/rules.js').scApply(m, 'X', 'g1', lcg(1)), { ok: true, outcome: 'continue', note: 'hit' }, 'Super Chaos: a hit on the round\'s spin is the round\'s move (no streak)');
});

test('rl: the computer varies its picks: the three groups and sets of 8 numbers of its own, all legal, never one pattern', () => {
  const E2 = require('../engine.js');
  let v = 11; const r = () => { v = (v * 1664525 + 1013904223) >>> 0; return v / 4294967296; };
  const kinds = new Set(), sets = new Set();
  for (let k = 0; k < 200; k++) {
    const m = E2.newMini('rl', r), mv = E2.localBest(E2.publicMini(m), 'X', r, null, { level: 'normal', until: null }).move;
    if (Array.isArray(mv)) { kinds.add('set'); sets.add(mv.join()); assert.equal(mv.length, 8); assert.equal(new Set(mv).size, 8); assert.ok(mv.every(n => n >= 1 && n <= 24)); }
    else kinds.add(mv);
    assert.ok(E2.applyMove(m, 'X', mv, r).ok, 'a legal pick');
  }
  for (const g of ['g1', 'g2', 'g3', 'set']) assert.ok(kinds.has(g), `picks ${g}`);
  assert.ok(sets.size > 50, `sets of 8 vary (${sets.size})`);
});
