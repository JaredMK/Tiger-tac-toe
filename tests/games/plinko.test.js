'use strict';
// Plinko: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

/* ===================================== Plinko ===================================== */
test('plinko: seven slots, six rows, seven bins; the path is drawn at the drop; the walls turn the chip inward; the odds from every slot', () => {
  const m = E.newMini('plinko', lcg(3));
  const r = E.applyMove(m, 'X', 3, lcg(4));
  assert.equal(r.ok, true);
  assert.equal(m.last.path.length, 6);
  const x = 6 + m.last.path.reduce((t, right) => t + (right ? 1 : -1), 0);
  assert.equal(m.last.bin, x / 2, 'the bin is where the path leads');
  for (let k = 0; k < 300; k++) { const mm = E.newMini('plinko', lcg(k)); E.applyMove(mm, 'O', k % 7, lcg(k * 7 + 1)); assert.ok(mm.last.bin >= 0 && mm.last.bin <= 6 && Number.isInteger(mm.last.bin), 'always a bin'); }
  for (const bad of [-1, 7, 2.5, 'x']) assert.equal(E.applyMove(m, 'X', bad).ok, false);
  // the odds: every row sums to one, the middle is the most likely from the middle, the walls pile up beside them
  const rows = [];
  for (let s = 0; s < 7; s++) { const o = E.plinkoOdds(s); assert.ok(Math.abs(o.reduce((a, b) => a + b, 0) - 1) < 1e-9); rows.push(o.map(v => Math.round(v * 100))); }
  console.log('Plinko: the chance (%) of each bin from each slot');
  rows.forEach((row, s) => console.log(`  slot ${s}: ${row.map(v => String(v).padStart(3)).join('')}`));
  assert.deepEqual(rows[3], [2, 9, 23, 31, 23, 9, 2]);
  assert.deepEqual(rows[0], [31, 47, 19, 3, 0, 0, 0], 'from the edge: more often one in than straight down');
  // simulated drops agree with the table
  const rng = lcg(11), hit = new Array(7).fill(0), N = 20000;
  for (let k = 0; k < N; k++) hit[E.plinkoPath(3, rng).bin]++;
  hit.forEach((h, b) => assert.ok(Math.abs(h / N - E.plinkoOdds(3)[b]) < 0.02, `bin ${b}: ${h / N} (table ${E.plinkoOdds(3)[b]})`));
});
test('plinko: bins worth 5, 3, 3, 2, 2, 1, 1 in a random order per square; each player\'s own points, first to 12; the target from the config', () => {
  const orders = new Set();
  for (let k = 0; k < 200; k++) {
    const m = E.newMini('plinko', lcg(k + 100));
    assert.deepEqual(m.vals.slice().sort((a, b) => b - a), [5, 3, 3, 2, 2, 1, 1]);
    orders.add(m.vals.join(''));
    assert.deepEqual(m.pts, { X: 0, O: 0 }); assert.equal(m.target, 12);
    assert.deepEqual(m.used, [false, false, false, false, false, false, false]);
    assert.ok(m.bonus.r >= 2 && m.bonus.r <= 6 && m.bonus.x % 2 === (m.bonus.r - 1) % 2 && m.bonus.x >= 0 && m.bonus.x <= 12, 'the bonus peg is a peg, below the top row');
  }
  assert.ok(orders.size > 50, `the order is drawn per square (${orders.size} orders in 200)`);
  E.setPlinkoConfig({ target: 20 }); assert.equal(E.newMini('plinko', lcg(1)).target, 20, 'the admin\'s target, copied into the square');
  E.setPlinkoConfig({ target: 999 }); assert.equal(E.newMini('plinko', lcg(1)).target, 12, 'out of range: the default');
  E.setPlinkoConfig(null); assert.equal(E.newMini('plinko', lcg(1)).target, 12);
  // points add up per player: the bin's value, +2 when the chip touched the bonus peg
  const m = E.newMini('plinko', lcg(7)), rng = lcg(8);
  let X = 0, O = 0, turn = 'X';
  for (let k = 0; k < 40 && !(X >= 12 || O >= 12); k++) {
    const slot = E.plinkoOpen(m)[0], b = { ...m.bonus }, r = E.applyMove(m, turn, slot, rng);
    assert.equal(r.ok, true);
    const touched = E.plinkoTouches(slot, m.last.path)[b.r - 1] === b.x;
    assert.equal(m.last.hit, touched); assert.equal(m.last.pts, m.vals[m.last.bin] + (touched ? 2 : 0));
    if (turn === 'X') X += m.last.pts; else O += m.last.pts;
    assert.deepEqual(m.pts, { X, O });
    assert.equal(r.outcome, m.pts[turn] >= 12 ? 'win' : 'continue');
    if (touched) assert.notDeepEqual(m.bonus, b, 'a new bonus peg once hit'); else assert.deepEqual(m.bonus, b, 'the bonus peg stays until hit');
    turn = turn === 'X' ? 'O' : 'X';
  }
  assert.ok(X >= 12 || O >= 12, 'someone reached 12');
});
test('plinko: a slot used by either player is locked until all seven have been used, then they all reopen', () => {
  const m = E.newMini('plinko', lcg(21)), rng = lcg(22);
  m.target = 999;
  for (const [k, slot] of [3, 0, 6, 1, 5, 2].entries()) {
    assert.equal(E.applyMove(m, k % 2 ? 'O' : 'X', slot, rng).ok, true);
    assert.equal(E.applyMove(m, k % 2 ? 'X' : 'O', slot, rng).reason, 'used', `slot ${slot}: locked for the other player too`);
    assert.equal(m.last.reset, false);
  }
  assert.deepEqual(E.plinkoOpen(m), [4], 'one left');
  assert.equal(E.applyMove(m, 'X', 4, rng).ok, true);
  assert.equal(m.last.reset, true); assert.deepEqual(E.plinkoOpen(m), [0, 1, 2, 3, 4, 5, 6], 'all seven used: all open again');
  for (let k = 0; k < 50; k++) { const mm = E.newMini('plinko', lcg(k)); mm.used = [true, true, false, true, true, false, true]; assert.ok([2, 5].includes(E.randomLegalMove(mm, 'X', lcg(k))), 'a random move (a timeout) only from an open slot'); }
});
test('plinko: the computer drops from the open slot with the most points to expect, the bonus peg counted', () => {
  for (let k = 0; k < 300; k++) {
    const m = E.newMini('plinko', lcg(k + 500));
    m.used = Array.from({ length: 7 }, (_, s) => (k % 3 === 0 ? false : (s * 7 + k) % 4 === 0));
    if (m.used.every(Boolean)) m.used[0] = false;
    const open = E.plinkoOpen(m), plan = E.localBest(E.publicMini(m), 'X', lcg(k));
    assert.ok(open.includes(plan.move), 'an open slot');
    // the expectation by hand, every path counted
    const exp = s => E.plinkoWays(s).reduce((t, w) => t + w.p * (m.vals[w.bin] + (E.plinkoTouches(s, w.path)[m.bonus.r - 1] === m.bonus.x ? 2 : 0)), 0);
    assert.ok(Math.abs(exp(plan.move) - Math.max(...open.map(exp))) < 1e-9, `the best open slot (${plan.move}: ${exp(plan.move).toFixed(3)})`);
  }
  // the bonus peg counts: a peg straight below a slot two rows down is worth +1 on average from it
  const m = E.newMini('plinko', lcg(9)); m.vals = [1, 1, 1, 1, 1, 1, 1]; m.bonus = { x: 6, r: 3 };
  assert.ok(Math.abs(E.plinkoExp(m, 3) - 2) < 1e-9, 'half the paths from the middle touch it: 1 + 2 x 0.5');
  assert.equal(E.localBest(E.publicMini(m), 'O', lcg(1)).move, 3);
});
test('plinko: a square from before (a WIN bin) becomes a points square', () => {
  const old = { type: 'plinko', win: 2, last: { by: 'X', slot: 1, path: [true, true, true, true, true, true], bin: 2, win: true } };
  E.upgradeMini(old);
  assert.deepEqual(old.vals, [3, 3, 5, 2, 2, 1, 1]); assert.deepEqual(old.pts, { X: 0, O: 0 }); assert.equal(old.target, 12); assert.equal(old.win, undefined);
  assert.equal(E.applyMove(old, 'X', 2, lcg(1)).ok, true);
});
