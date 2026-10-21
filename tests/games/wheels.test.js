'use strict';
// Risk Wheels: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

/* ===================================== Risk Wheels ===================================== */
test('wheels: each square deals three wheels of ten; each player\'s own points; one wheel spun a move; first to 18; the admin\'s values in the square', () => {
  assert.deepEqual(E.WHEEL_DEFAULTS, { target: 18, tensMin: 1, tensMax: 2, smallMax: 2, smallTop: 2, midLo: 0, midHi: 8, lowLo: 1, lowHi: 4, gap: 0.4 });
  const rng = E.makeRng('wh-rules'), m = E.newMini('wheels', rng);
  assert.equal(m.target, 18); assert.deepEqual(m.pts, { X: 0, O: 0 });
  for (const w of E.WHEELS) assert.equal(m.wheels[w].length, 10);
  assert.deepEqual(E.wheelsCheck(m.wheels), []);
  for (const bad of ['huge', 0, null, ['high']]) assert.equal(E.applyMove(m, 'X', bad, rng).ok, false);
  let r;
  for (let k = 0; k < 300 && (!r || r.outcome !== 'win'); k++) {
    const p = k % 2 ? 'O' : 'X', before = m.pts[p], w = E.WHEELS[k % 3];
    r = E.applyMove(m, p, w, rng);
    assert.equal(m.pts[p] - before, m.wheels[w][m.last.seg], 'the segment\'s points');
    assert.ok(m.last.at > m.last.seg / 10 && m.last.at < (m.last.seg + 1) / 10, 'the stop is inside its segment');
    assert.equal(r.outcome === 'win', m.pts[p] >= 18);
  }
  assert.equal(r.outcome, 'win');
  const other = E.newMini('wheels', E.makeRng('wh-other'));
  assert.notDeepEqual(other.wheels, m.wheels, 'each square its own wheels');
  E.setWheelsConfig({ target: 30, lowHi: 3, midHi: 99, gap: 'x' });
  const m2 = E.newMini('wheels', rng);
  assert.equal(m2.target, 30); assert.ok(m2.wheels.low.every(v => v <= 3), 'the admin\'s range for the low wheel');
  assert.deepEqual(E.wheelsCheck(m2.wheels, E.wheelsConfig()), []);
  assert.equal(E.wheelsConfig().midHi, 8, 'off its range: the default');
  E.setWheelsConfig(null);
  assert.equal(E.newMini('wheels', rng).target, 18);
  // a square from before (two segments sized to their chances): ten segments, the first value on its share
  const old = { type: 'wheels', cfg: { target: 18, high: { a: 10, pa: 45, b: 0 }, mid: { a: 7, pa: 50, b: 1 }, low: { a: 3, pa: 60, b: 4 } }, pts: { X: 3, O: 0 }, spins: { X: 1, O: 0 }, last: null };
  E.upgradeMini(old);
  assert.deepEqual(old.wheels.mid, [7, 7, 7, 7, 7, 1, 1, 1, 1, 1]); assert.equal(old.target, 18); assert.equal(E.applyMove(old, 'O', 'low', rng).ok, true);
});
test('wheels: 1,000 dealt sets keep every rule (the medium wheel with two 5s or more); the spins land evenly; a timeout spins the low-risk wheel', () => {
  const tens = { 1: 0, 2: 0 }, avg = { high: 0, mid: 0, low: 0 };
  for (let k = 0; k < 1000; k++) {
    const w = E.wheelsDeal(E.makeRng('set' + k), E.WHEEL_DEFAULTS), h = E.wheelAvg(w.high), md = E.wheelAvg(w.mid), l = E.wheelAvg(w.low);
    assert.deepEqual(E.wheelsCheck(w), [], `set ${k}: ${JSON.stringify(w)}`);
    // the rules, spelled out once more
    const nt = w.high.filter(v => v === 10).length, small = w.high.filter(v => v && v !== 10);
    assert.ok(nt >= 1 && nt <= 2 && small.length <= 2 && small.every(v => v <= 2), 'high: one or two 10s, the rest 0s but at most two small values');
    assert.ok(!w.mid.includes(10) && Math.max(...w.mid) > Math.max(...w.low), 'mid: no 10s, its top above low\'s');
    assert.ok(w.mid.filter(v => v === 5).length >= 2, 'mid: at least two 5s');
    assert.ok(w.low.every(v => v >= 1 && v <= 4) && new Set(w.low).size >= 2, 'low: 1-4, at least two values');
    assert.ok(h < md && md < l && md - h >= 0.4 - 1e-9 && l - md >= 0.4 - 1e-9, 'the averages in order, 0.4 apart');
    tens[nt]++; avg.high += h / 1000; avg.mid += md / 1000; avg.low += l / 1000;
  }
  console.log(`Risk Wheels: 1,000 sets, all rules kept; one 10 in ${tens[1]}, two in ${tens[2]}; average of the averages: high ${avg.high.toFixed(2)}, medium ${avg.mid.toFixed(2)}, low ${avg.low.toFixed(2)}`);
  const rng = E.makeRng('wh-odds'), vals = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10], hit = new Array(10).fill(0), N = 30000;
  for (let k = 0; k < N; k++) { const s = E.wheelSpin(vals, rng); hit[s.seg]++; assert.equal(s.v, vals[s.seg]); }
  hit.forEach((h, k) => assert.ok(Math.abs(h / N - 0.1) < 0.008, `segment ${k}: ${(100 * h / N).toFixed(1)}%`));
  assert.equal(E.randomLegalMove(E.newMini('wheels', rng), 'X', rng), 'low');
});
test('wheels: the computer works out each wheel\'s chance of reaching the target first and takes more risk when behind', () => {
  const wheels = { high: [10, 0, 0, 0, 1, 0, 0, 0, 0, 0], mid: [5, 0, 2, 1, 0, 3, 0, 2, 0, 5], low: [3, 2, 3, 3, 2, 4, 3, 2, 3, 3] };
  assert.deepEqual(E.wheelsCheck(wheels), []);
  const rng = E.makeRng('wh-ai'), pick = (a, b) => E.localBest({ type: 'wheels', target: 18, wheels, pts: { X: a, O: b }, spins: { X: 0, O: 0 } }, 'X', rng).move;
  assert.equal(pick(16, 3), 'low', 'needs 2: the low wheel always gets there');
  assert.equal(pick(12, 2), 'low', 'well ahead: safe');
  assert.equal(pick(0, 15), 'high', 'far behind with the other near the end: the risk');
  assert.equal(pick(8, 17), 'high', 'the other wins next turn: the long shot');
  // more risk the further behind: over every score, the risky wheels' share grows with the gap
  const T = E.wheelsTable(18, wheels), risky = gap => { let n = 0, r = 0; for (let a = 0; a < 18; a++) for (let b = 0; b < 18; b++) if (b - a === gap) { n++; if (T.best[a][b] !== 'low') r++; } return n ? r / n : 0; };
  assert.ok(risky(8) > risky(0) && risky(0) >= risky(-8), `behind 8: ${risky(8).toFixed(2)}, level: ${risky(0).toFixed(2)}, ahead 8: ${risky(-8).toFixed(2)}`);
  // its q: this spin's chance of reaching the target
  const b = E.localBest({ type: 'wheels', target: 18, wheels, pts: { X: 8, O: 17 }, spins: { X: 0, O: 0 } }, 'X', rng);
  assert.equal(b.move, 'high'); assert.equal(b.q, 0.1);
});

test('wheels: the computer\'s mistake rate is dealt into the square and played by', () => {
  E.setTune('wheels', { miss: 60 });
  const m = E.newMini('wheels', E.makeRng('wh-tune'));
  E.setTune('wheels', null);
  assert.deepEqual(m.tune, { miss: 60 });
  const rng = E.makeRng('wh-miss'), seen = new Set(), plain = new Set();
  const pm = E.publicMini(m), pm0 = Object.assign({}, pm, { tune: undefined });
  for (let k = 0; k < 60; k++) { seen.add(E.localBest(pm, 'X', rng).move); plain.add(E.localBest(pm0, 'X', rng).move); }
  assert.equal(plain.size, 1); assert.ok(seen.size > 1);
});
