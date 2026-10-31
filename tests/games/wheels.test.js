'use strict';
// Risky Spins: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const A = require('../../src/games/wheels/ai.js');
const { timeoutClose } = require('../../src/core/board.js');
const S = E.SKULL;

/* ===================================== Risky Spins ===================================== */
test('wheels: push your luck: a spin\'s points go into the pot and the turn goes on; Bank adds the pot; a skull loses it; first to 30', () => {
  assert.deepEqual(E.WHEEL_DEFAULTS, { target: 30, lowSkulls: 2, midSkulls: 4, highSkulls: 5, lowLo: 1, lowHi: 4, midLo: 2, midHi: 7, highLo: 3, tensMin: 1, tensMax: 1, gap: 0.4 });
  const rng = E.makeRng('wh-rules'), m = E.newMini('wheels', rng);
  assert.equal(m.target, 30); assert.equal(m.v, 2); assert.deepEqual(m.pts, { X: 0, O: 0 }); assert.equal(m.turn, null);
  for (const w of E.WHEELS) assert.equal(m.wheels[w].length, 10);
  assert.deepEqual(E.wheelsCheck(m.wheels), []);
  for (const bad of ['huge', 0, null, ['high']]) assert.equal(E.applyMove(m, 'X', bad, rng).ok, false);
  assert.equal(E.applyMove(m, 'X', 'bank', rng).ok, false, 'no pot: nothing to bank');
  // a fixed set: the stops are the rng's, so each spin is checked against its segment
  let busts = 0, banks = 0, r = null, p = 'X';
  for (let k = 0; k < 2000 && !(r && r.outcome === 'win'); k++) {
    const before = m.pts[p], pot0 = m.turn ? m.turn.pot : 0;
    if (pot0 >= 6 || (m.turn && m.pts[p] + pot0 >= 30)) {
      r = E.applyMove(m, p, 'bank', rng);
      assert.ok(r.ok); assert.equal(m.pts[p], before + pot0); assert.equal(m.turn, null); banks++;
      assert.equal(r.outcome === 'win', m.pts[p] >= 30);
      if (r.outcome !== 'win') p = p === 'X' ? 'O' : 'X';
      continue;
    }
    const w = E.WHEELS[k % 3];
    r = E.applyMove(m, p, w, rng);
    assert.ok(r.ok); assert.equal(m.pts[p], before, 'a spin never touches the score');
    const v = m.wheels[w][m.last.seg];
    assert.ok(m.last.at > m.last.seg / 10 && m.last.at < (m.last.seg + 1) / 10, 'the stop is inside its segment');
    if (v === S) { assert.equal(r.note, 'bust'); assert.equal(m.turn, null); assert.equal(m.last.pot, pot0); assert.ok(!r.again); busts++; p = p === 'X' ? 'O' : 'X'; }
    else { assert.ok(r.again); assert.equal(m.turn.pot, pot0 + v); assert.equal(m.turn.by, p); assert.equal(E.applyMove(m, p === 'X' ? 'O' : 'X', 'low', rng).ok, false, 'the other waits'); }
  }
  assert.equal(r.outcome, 'win'); assert.ok(busts > 0 && banks > 0);
  // enough to win: only Bank is left
  const e = E.newMini('wheels', E.makeRng('wh-enough'));
  e.pts.X = 28; e.turn = { by: 'X', pot: 3, n: 1 };
  assert.equal(E.applyMove(e, 'X', 'high', rng).reason, 'enough');
  assert.equal(E.applyMove(e, 'X', 'bank', rng).outcome, 'win');
  const other = E.newMini('wheels', E.makeRng('wh-other'));
  assert.notDeepEqual(other.wheels, m.wheels, 'each square its own wheels');
});

test('wheels: the admin\'s settings (config/wheels) are dealt into the square; a config from before the skulls is the defaults', () => {
  const rng = E.makeRng('wh-cfg');
  E.setWheelsConfig({ target: 40, lowSkulls: 2, midSkulls: 3, highSkulls: 5, lowHi: 3, midHi: 99, gap: 'x' });
  const m2 = E.newMini('wheels', rng);
  assert.equal(m2.target, 40); assert.ok(m2.wheels.low.every(v => v === S || v <= 3), 'the admin\'s range for the low wheel');
  assert.equal(E.skullsOf(m2.wheels.low), 2); assert.equal(E.skullsOf(m2.wheels.high), 5);
  assert.deepEqual(E.wheelsCheck(m2.wheels, E.wheelsConfig()), []);
  assert.equal(E.wheelsConfig().midHi, 7, 'off its range: the default');
  E.setWheelsConfig({ target: 18, tensMin: 1, tensMax: 2, smallMax: 2 });   // (the old game's settings)
  assert.equal(E.newMini('wheels', rng).target, 30);
  E.setWheelsConfig(null);
  // a square from before the skulls (no v): its old rule to its end, each spin's points straight onto the score
  const old = { type: 'wheels', target: 18, wheels: { high: [10, 0, 0, 0, 1, 0, 0, 0, 0, 0], mid: [5, 0, 2, 1, 0, 3, 0, 2, 0, 5], low: [3, 2, 3, 3, 2, 4, 3, 2, 3, 3] }, pts: { X: 3, O: 0 }, spins: { X: 1, O: 0 }, rest: {}, last: null };
  const r = E.applyMove(old, 'O', 'low', rng);
  assert.ok(r.ok && !r.again); assert.equal(old.pts.O, old.wheels.low[old.last.seg]);
  assert.equal(A.best(E.publicMini(old), 'X', rng, {}, {}).move !== 'bank', true);
  // older still: two segments sized to their chances
  const older = { type: 'wheels', cfg: { target: 18, high: { a: 10, pa: 45, b: 0 }, mid: { a: 7, pa: 50, b: 1 }, low: { a: 3, pa: 60, b: 4 } }, pts: { X: 3, O: 0 }, spins: { X: 1, O: 0 }, last: null };
  E.upgradeMini(older);
  assert.deepEqual(older.wheels.mid, [7, 7, 7, 7, 7, 1, 1, 1, 1, 1]); assert.equal(E.applyMove(older, 'O', 'low', rng).ok, true);
});

test('wheels: 1,000 dealt sets keep every rule; the spins land evenly; a timeout banks the pot, a random move spins the low wheel', () => {
  const avg = { high: 0, mid: 0, low: 0 };
  for (let k = 0; k < 1000; k++) {
    const w = E.wheelsDeal(E.makeRng('set' + k), E.WHEEL_DEFAULTS), h = E.wheelAvg(w.high), md = E.wheelAvg(w.mid), l = E.wheelAvg(w.low);
    assert.deepEqual(E.wheelsCheck(w), [], `set ${k}: ${JSON.stringify(w)}`);
    assert.deepEqual([E.skullsOf(w.low), E.skullsOf(w.mid), E.skullsOf(w.high)], [2, 4, 5], 'the skulls: the riskier, the more');
    assert.equal(w.high.filter(v => v === 10).length, 1, 'high: one 10');
    assert.ok(!w.mid.includes(10) && !w.low.includes(10), 'only the high wheel has a 10');
    assert.ok(w.low.every(v => v === S || (v >= 1 && v <= 4)) && w.mid.every(v => v === S || (v >= 2 && v <= 7)) && w.high.every(v => v === S || v >= 3));
    assert.ok(l < md && md < h && md - l >= 0.4 - 1e-9 && h - md >= 0.4 - 1e-9, 'the averages rise with the risk, 0.4 apart');
    avg.high += h / 1000; avg.mid += md / 1000; avg.low += l / 1000;
  }
  console.log(`Risky Spins: 1,000 sets, all rules kept; average values: high ${avg.high.toFixed(2)}, medium ${avg.mid.toFixed(2)}, low ${avg.low.toFixed(2)}`);
  const rng = E.makeRng('wh-odds'), vals = [S, 1, 2, 3, 4, 5, 6, 7, 8, 10], hit = new Array(10).fill(0), N = 30000;
  for (let k = 0; k < N; k++) { const s = E.wheelSpin(vals, rng); hit[s.seg]++; assert.equal(s.v, vals[s.seg]); }
  hit.forEach((h, k) => assert.ok(Math.abs(h / N - 0.1) < 0.008, `segment ${k}: ${(100 * h / N).toFixed(1)}%`));
  const m = E.newMini('wheels', rng);
  assert.equal(E.randomLegalMove(m, 'X', rng), 'low');
  assert.equal(timeoutClose(m, 'X'), null, 'no pot: nothing played');
  m.turn = { by: 'X', pot: 7, n: 2 };
  assert.equal(timeoutClose(m, 'X'), 'bank'); assert.equal(E.randomLegalMove(m, 'X', rng), 'bank');
});

test('wheels: the computer banks by its pot, the wheel\'s risk and the score gap; enough to win, it banks', () => {
  const wheels = { high: [S, 7, 9, S, S, 3, 10, S, 6, S], mid: [2, 5, S, 5, 3, S, 6, S, S, 7], low: [4, 1, 1, 2, S, 3, S, 1, 2, 2] };
  assert.deepEqual(E.wheelsCheck(wheels), []);
  const rng = E.makeRng('wh-ai'), mk = (a, b, pot) => ({ type: 'wheels', v: 2, target: 30, wheels, pts: { X: a, O: b }, spins: { X: 0, O: 0 }, turn: pot ? { by: 'X', pot, n: 1 } : null });
  const pick = (a, b, pot, level) => A.best(mk(a, b, pot), 'X', rng, {}, { level: level || 'normal', until: null }).move;
  for (const lv of ['normal', 'hard']) {
    assert.notEqual(pick(0, 0, 0, lv), 'bank', `${lv}: no pot, a spin`);
    assert.equal(pick(25, 10, 6, lv), 'bank', `${lv}: enough to win, it banks`);
    assert.equal(pick(10, 10, 20, lv), 'bank', `${lv}: a big pot, it banks`);
  }
  assert.equal(pick(0, 0, 0), 'high', 'no pot at risk: the wheel that adds the most');
  const risk = w => E.skullsOf(wheels[w]);   // the more it has at risk, the safer the wheel (never a riskier one for a bigger pot)
  let last = 10;
  for (let pot = 1; pot < 30; pot++) { const w = pick(0, 20, pot); if (w === 'bank') break; assert.ok(risk(w) <= last, `pot ${pot}: ${w}`); last = risk(w); }
  assert.equal(last, risk('low'), 'a pot well at risk: the low-risk wheel');
  // the bank-at pot grows with the gap: behind, it keeps spinning on a pot it banks when level or ahead
  const bankAt = (a, b) => { for (let pot = 1; pot < 30; pot++) if (pick(a, b, pot) === 'bank') return pot; return 30; };
  assert.ok(bankAt(0, 20) > bankAt(10, 10) && bankAt(10, 10) >= bankAt(20, 0), `bank at: behind ${bankAt(0, 20)}, level ${bankAt(10, 10)}, ahead ${bankAt(20, 0)}`);
  // Hard: the exact race; further behind it banks later
  const hAt = (a, b) => { for (let pot = 1; pot < 30; pot++) if (pick(a, b, pot, 'hard') === 'bank') return pot; return 30; };
  assert.ok(hAt(0, 25) > hAt(15, 15), `Hard bank at: far behind ${hAt(0, 25)}, level ${hAt(15, 15)}`);
  // its q: this spin's chance of reaching the target
  const b = A.best(mk(24, 0, 0), 'X', rng, {}, {});
  assert.equal(b.q, mk(24, 0, 0).wheels[b.move].filter(v => v >= 6).length / 10);
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

test('wheels: whole squares, computer against computer: Normal and Hard both finish, the first mover under 60%, Hard ahead of Normal', () => {
  const play = (seed, lx, lo) => {
    const rng = E.makeRng('wq' + seed), m = E.newMini('wheels', rng);
    let p = 'X';
    for (let k = 0; k < 3000; k++) {
      const pm = E.publicMini(m), b = A.best(pm, p, rng, {}, { level: p === 'X' ? lx : lo, until: null });
      const r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok, JSON.stringify([b, m.turn, m.pts]));
      if (r.outcome === 'win') return p;
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
    throw new Error('no end');
  };
  let x = 0, h = 0;
  for (let s = 0; s < 300; s++) { if (play(s, 'normal', 'normal') === 'X') x++; if (play('h' + s, 'hard', 'normal') === 'X') h++; if (play('n' + s, 'normal', 'hard') === 'O') h++; }
  assert.ok(x / 300 < 0.62, `the first mover with Normal: ${(100 * x / 300).toFixed(1)}%`);
  assert.ok(h / 600 > 0.6, `Hard against Normal: ${(100 * h / 600).toFixed(1)}%`);
});
