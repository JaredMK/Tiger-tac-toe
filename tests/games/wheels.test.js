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
  assert.deepEqual(E.WHEEL_DEFAULTS, { target: 30, lowSkulls: 2, highSkulls: 5, lowLo: 1, lowHi: 4, highLo: 6, tensMin: 1, tensMax: 1, gap: 0.4, evSpread: 10 });
  assert.deepEqual(E.WHEELS, ['high', 'low'], 'a new square: two wheels'); assert.deepEqual(E.WHEELS_ALL, ['high', 'mid', 'low']);
  const rng = E.makeRng('wh-rules'), m = E.newMini('wheels', rng);
  assert.equal(m.target, 30); assert.equal(m.v, 2); assert.deepEqual(m.pts, { X: 0, O: 0 }); assert.equal(m.turn, null);
  assert.deepEqual(Object.keys(m.wheels).sort(), ['high', 'low'], 'exactly two wheels'); assert.deepEqual(E.wheelsOf(m), ['high', 'low']);
  for (const w of E.WHEELS) assert.equal(m.wheels[w].length, 10);
  assert.equal(E.applyMove(m, 'X', 'mid', rng).reason, 'bad', 'no medium wheel on a new square');
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
    const w = E.WHEELS[k % 2];
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
  E.setWheelsConfig({ target: 40, lowSkulls: 2, midSkulls: 3, highSkulls: 5, lowHi: 3, highLo: 99, midHi: 99, gap: 'x' });   // (a stored config may still carry the medium wheel's settings: read without them)
  const m2 = E.newMini('wheels', rng);
  assert.equal(m2.target, 40); assert.ok(m2.wheels.low.every(v => v === S || v <= 3), 'the admin\'s range for the low wheel');
  assert.equal(E.skullsOf(m2.wheels.low), 2); assert.equal(E.skullsOf(m2.wheels.high), 5);
  assert.deepEqual(E.wheelsCheck(m2.wheels, Object.assign(E.wheelsConfig(), { evSpread: null })), [], 'every rule but the turns\' spread (these ranges may never allow 10%: the closest set)');
  assert.equal(E.wheelsConfig().highLo, 6, 'off its range: the default'); assert.ok(!('midSkulls' in E.wheelsConfig()) && !('midHi' in E.wheelsConfig()), 'the medium wheel\'s settings are gone');
  assert.deepEqual(Object.keys(m2.wheels).sort(), ['high', 'low']);
  assert.equal(E.wheelsConfig().evSpread, 10, 'none set: the default spread');
  E.setWheelsConfig(Object.assign({}, E.WHEEL_DEFAULTS, { evSpread: 4 }));   // the admin's spread: dealt within it
  for (let k = 0; k < 40; k++) { const m = E.newMini('wheels', rng); assert.ok(E.wheelsSpread(m.wheels, 30) <= 0.04 + 1e-9, `spread ${E.wheelsSpread(m.wheels, 30)}`); }
  E.setWheelsConfig(Object.assign({}, E.WHEEL_DEFAULTS, { lowSkulls: 0, highSkulls: 7, lowLo: 3, lowHi: 6, highLo: 1, evSpread: 1 }));   // ranges that never allow it: the closest set, the other rules kept
  { const g = E.wheelsConfig(), w = E.newMini('wheels', rng).wheels; assert.deepEqual(E.wheelsCheck(w, Object.assign({}, g, { evSpread: null })), []); assert.ok(E.wheelsSpread(w, 30) > 0.01); }
  E.setWheelsConfig({ target: 18, tensMin: 1, tensMax: 2, smallMax: 2 });   // (the old game's settings)
  assert.equal(E.newMini('wheels', rng).target, 30);
  { // the stored node as wheels2 wrote it (the medium wheel's keys and all): the same two-wheel deal as the defaults
    const stored = { target: 30, lowSkulls: 2, midSkulls: 4, highSkulls: 5, lowLo: 1, lowHi: 4, midLo: 4, midHi: 7, highLo: 6, tensMin: 1, tensMax: 1, gap: 0.4, evSpread: 10 };
    E.setWheelsConfig(stored); assert.deepEqual(E.wheelsConfig(), E.WHEEL_DEFAULTS);
    for (let k = 0; k < 20; k++) { const m = E.newMini('wheels', E.makeRng('old-cfg' + k)); assert.deepEqual(Object.keys(m.wheels).sort(), ['high', 'low']); assert.deepEqual(E.wheelsCheck(m.wheels), []); }
  }
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
  const avg = { high: 0, low: 0 };
  for (let k = 0; k < 1000; k++) {
    const w = E.wheelsDeal(E.makeRng('set' + k), E.WHEEL_DEFAULTS), h = E.wheelAvg(w.high), l = E.wheelAvg(w.low);
    assert.deepEqual(Object.keys(w).sort(), ['high', 'low'], 'two wheels, never a medium one');
    assert.deepEqual(E.wheelsCheck(w), [], `set ${k}: ${JSON.stringify(w)}`);
    assert.deepEqual([E.skullsOf(w.low), E.skullsOf(w.high)], [2, 5], 'the skulls: the riskier, the more');
    assert.equal(w.high.filter(v => v === 10).length, 1, 'high: one 10');
    assert.ok(!w.low.includes(10), 'only the high wheel has a 10');
    assert.ok(w.low.every(v => v === S || (v >= 1 && v <= 4)) && w.high.every(v => v === S || v >= 6));
    assert.ok(l < h && h - l >= 0.4 - 1e-9, 'the average rises with the risk, 0.4 apart');
    avg.high += h / 1000; avg.low += l / 1000;
  }
  console.log(`Risky Spins: 1,000 sets, all rules kept; average values: high ${avg.high.toFixed(2)}, low ${avg.low.toFixed(2)}`);
  assert.deepEqual(E.wheelsCheck({ high: [10, S, 7, S, 8, S, 9, S, S, 6], mid: [5, S, 6, 4, S, 7, S, S, 5, 6], low: [2, 3, 1, S, 2, 4, S, 2, 3, 2] }), ['shape'], 'a three-wheel set is not a new deal');
  assert.deepEqual(E.wheelsCheck({ high: [10, S, 7, S, 8, S, 9, S, S, 6], low: [2, 3, 1, S, 2, 4, S, 2, 3, 2] }), [], 'the known-good set (when the admin\'s ranges allow none) keeps the default rules');
  const rng = E.makeRng('wh-odds'), vals = [S, 1, 2, 3, 4, 5, 6, 7, 8, 10], hit = new Array(10).fill(0), N = 30000;
  for (let k = 0; k < N; k++) { const s = E.wheelSpin(vals, rng); hit[s.seg]++; assert.equal(s.v, vals[s.seg]); }
  hit.forEach((h, k) => assert.ok(Math.abs(h / N - 0.1) < 0.008, `segment ${k}: ${(100 * h / N).toFixed(1)}%`));
  const m = E.newMini('wheels', rng);
  assert.equal(E.randomLegalMove(m, 'X', rng), 'low');
  assert.equal(timeoutClose(m, 'X'), null, 'no pot: nothing played');
  m.turn = { by: 'X', pot: 7, n: 2 };
  assert.equal(timeoutClose(m, 'X'), 'bank'); assert.equal(E.randomLegalMove(m, 'X', rng), 'bank');
});

// The computer on both kinds of square: the two wheels a new square has, and the three of one dealt before November 2026.
const TWO = { high: [S, 9, 6, 8, 10, S, S, S, 8, S], low: [4, 3, S, 1, 2, 2, 4, 3, S, 1] };
const THREE = { high: [S, 9, 6, 8, 10, S, S, S, 8, S], mid: [7, S, S, 4, 6, 7, 5, 4, S, S], low: [4, 3, S, 1, 2, 2, 4, 3, S, 1] };
for (const [name, wheels] of [['two wheels', TWO], ['an old three-wheel square', THREE]]) {
  test(`wheels: the computer banks by its pot, the wheel's risk and the score gap; enough to win, it banks (${name})`, () => {
    if (wheels === TWO) assert.deepEqual(E.wheelsCheck(wheels), []);
    const rng = E.makeRng('wh-ai'), mk = (a, b, pot) => ({ type: 'wheels', v: 2, target: 30, wheels, pts: { X: a, O: b }, spins: { X: 0, O: 0 }, turn: pot ? { by: 'X', pot, n: 1 } : null });
    const pick = (a, b, pot, level) => A.best(mk(a, b, pot), 'X', rng, {}, { level: level || 'normal', until: null }).move;
    for (const lv of ['normal', 'hard']) {
      assert.notEqual(pick(0, 0, 0, lv), 'bank', `${lv}: no pot, a spin`);
      assert.ok(Object.keys(wheels).includes(pick(0, 0, 0, lv)), `${lv}: a wheel the square has`);
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
    // the mistake rate spins any wheel the square has, never one it has not
    const seen = new Set(); for (let k = 0; k < 80; k++) seen.add(A.best(Object.assign(mk(0, 0, 0), { tune: { miss: 100 } }), 'X', rng, {}, {}).move);
    assert.deepEqual([...seen].sort(), Object.keys(wheels).sort());
  });
}

// A square dealt with three wheels (before November 2026) and still in a match plays out with its three wheels: the rules, the
// computer (Normal and Hard) and the replay's flash all handle the medium one.
test('wheels: an old three-wheel square (v 2) plays out as dealt: its medium wheel spins, banks, busts and wins', () => {
  const mk = () => ({ type: 'wheels', v: 2, target: 30, wheels: JSON.parse(JSON.stringify(THREE)), pts: { X: 0, O: 0 }, spins: { X: 0, O: 0 }, turn: null, rest: { high: 0, mid: 0, low: 0 }, last: null });
  const m = mk(), rng = E.makeRng('old3');
  assert.deepEqual(E.wheelsOf(m), ['high', 'mid', 'low']);
  let r = E.applyMove(m, 'X', 'mid', rng);
  assert.ok(r.ok); assert.equal(m.last.w, 'mid'); assert.equal(m.last.v, m.wheels.mid[m.last.seg]); assert.ok(m.rest.mid > 0);
  assert.ok(E.wheelsSpread(m.wheels, 30) > 0, 'its three wheels measure');
  assert.equal(E.applyMove(m, 'X', 'nope', rng).reason, 'bad');
  // whole squares, every level pairing, to the end
  for (const [lx, lo] of [['normal', 'normal'], ['hard', 'normal'], ['normal', 'hard']]) for (let s = 0; s < 12; s++) {
    const q = mk(), g = E.makeRng('o3-' + lx + lo + s), used = new Set(); let p = 'X', win = null;
    for (let k = 0; k < 3000 && !win; k++) {
      const b = A.best(E.publicMini(q), p, g, {}, { level: p === 'X' ? lx : lo, until: null });
      assert.ok(['bank', 'high', 'mid', 'low'].includes(b.move), b.move); if (b.move !== 'bank') used.add(b.move);
      const t = E.applyMove(q, p, b.move, g); assert.ok(t.ok, JSON.stringify([b, q.turn]));
      if (t.outcome === 'win') win = p; else if (!t.again) p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(win, 'the square ends');
    assert.deepEqual(Object.keys(q.wheels), ['high', 'mid', 'low'], 'still its three wheels');
  }
  // the public view and a Super Chaos merge keep its three wheels
  assert.deepEqual(Object.keys(E.publicMini(m).wheels), ['high', 'mid', 'low']);
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
  assert.ok(h / 600 > 0.53, `Hard against Normal: ${(100 * h / 600).toFixed(1)}%`);
});

// The balance (November 2026): each wheel alone, its best turn (spun until the next spin risks more than it adds, then
// banked) banks about the same, so the choice is the risk style, never one better wheel; the risk still rises with the values.
test('wheels: the two wheels are worth the same a turn (within 10%) on every dealt square, the riskier with the bigger values', () => {
  const T = 30, N = 2000, sum = { high: 0, low: 0 }, K = { high: 0, low: 0 };
  let worst = 0;
  for (let k = 0; k < N; k++) {
    const w = E.wheelsDeal(E.makeRng('bal' + k), E.WHEEL_DEFAULTS), t = {};
    for (const x of E.WHEELS) {
      t[x] = E.wheelTurn(w[x], T);
      // its bank-at pot is the best one: no other K banks more on average (checked by brute force on a sample)
      if (k < 100) for (let k2 = 1; k2 <= T; k2++) assert.ok(turnAt(w[x], k2) <= t[x].E + 1e-9, `set ${k} ${x}: K ${k2} beats ${t[x].K}`);
      sum[x] += t[x].E / N; K[x] += t[x].K / N;
    }
    const sp = E.wheelsSpread(w, T); worst = Math.max(worst, sp);
    assert.ok(sp <= 0.1 + 1e-9, `set ${k}: the turns ${E.WHEELS.map(x => t[x].E.toFixed(2)).join(' / ')}`);
    assert.ok(t.low.r < t.high.r, 'the riskier wheel, the more skulls');
    assert.ok(E.wheelAvg(w.low) < E.wheelAvg(w.high), 'and the bigger values');
    assert.ok(Math.max(...w.low) < 10 && w.high.includes(10), 'only the high wheel has a 10');
  }
  const m = Object.values(sum);
  assert.ok(Math.max(...m) / Math.min(...m) - 1 < 0.05, `on average within 5%: ${E.WHEELS.map(x => x + ' ' + sum[x].toFixed(2)).join(', ')}`);
  for (const x of E.WHEELS) assert.ok(sum[x] > 3.6 && sum[x] < 4.6, `${x}: about 4 points a turn (${sum[x].toFixed(2)})`);
  console.log(`Risky Spins: ${N} sets, the best turn alone: ${E.WHEELS.map(x => `${x} ${sum[x].toFixed(2)} (bank at ${K[x].toFixed(1)})`).join(', ')}; the widest spread ${(100 * worst).toFixed(1)}%`);
});
function turnAt(v, K) {   // a turn on one wheel, banking once the pot reaches K: its expected bank (brute force)
  const vals = v.filter(x => x !== S), g = new Float64Array(K + 11);
  for (let P = K + 10; P >= 0; P--) { if (P >= K) { g[P] = P; continue; } let s = 0; for (const x of vals) s += g[Math.min(K + 10, P + x)]; g[P] = s / v.length; }
  return g[0];
}

test('wheels: the deploy sets the live config/wheels to these defaults once (scripts/set-releases.js: wheels3 is the two-wheel set)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', '..', 'scripts', 'set-releases.js'), 'utf8');
  const get = id => { const m = src.match(new RegExp(`\\{ id: '${id}', path: 'config/wheels', value: (\\{[^}]*\\}) \\}`)); assert.ok(m, 'the set ' + id); return new Function(`return (${m[1]});`)(); };
  assert.deepEqual(get('wheels3'), E.WHEEL_DEFAULTS);
  assert.ok(src.indexOf("id: 'wheels3'") > src.indexOf("id: 'wheels2'"), 'wheels3 after wheels2: the last one wins');
  const w2 = get('wheels2');   // the three-wheel set (applied once, before): the same numbers, with the medium wheel's
  for (const k of Object.keys(E.WHEEL_DEFAULTS)) assert.equal(w2[k], E.WHEEL_DEFAULTS[k], k);
});

test('wheels: a client has the game only from 1.4.0 (a two-wheel square is more than 1.3.0 or older could draw)', () => {
  assert.equal(E.CLIENT_VERSION, '1.14.0', 'the November 2026 batch of games (Muncher, Star Swarm, Brick Break, Snake) is 1.5.0; Muncher\'s new maze and move shape 1.6.0; Seating\'s rework 1.7.0');
  assert.equal(E.minVersionOf('wheels'), '1.4.0'); assert.equal(E.minVersionOf('apple'), '1.3.0', 'Apple Pick keeps its own');
  assert.ok(E.clientHas({ v: '1.4.0', p: 'web' }, 'wheels')); assert.ok(!E.clientHas({ v: '1.3.0', p: 'ios' }, 'wheels')); assert.ok(!E.clientHas({ v: '1.2.0', p: 'ios' }, 'wheels'));
});
