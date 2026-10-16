'use strict';
// Run with:  node --test
// Patterns, Risk Wheels and Sniff in the shared engine (engine.js): the rules, the hidden parts, the
// timeouts, the computer, and the checks on each game's numbers.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

// Play whole turns until the match is over: the computer on both sides.
function cpuMatch(games, seed, guard = 900) {
  const rng = E.makeRng('trio' + seed), st = E.newMatch(rng, { games });
  let n = 0;
  while (!st.winner && n++ < guard) {
    const m = E.cpuMove(st, rng);
    const r = E.playMove(st, m.square, m.move, rng);
    assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
    E.endFlash(st);
  }
  return { st, n };
}
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));

/* ===================================== Patterns ===================================== */
test('patterns: 1,000 puzzles, every one with exactly one option that fits its rule and no two options alike', () => {
  const rng = E.makeRng('pat-1000'), kinds = {}, fams = {};
  let last = null, middle = 0;
  for (let k = 0; k < 1000; k++) {
    const g = E.patPuzzle(rng, last);
    assert.ok(g, 'a puzzle every time');
    last = g.puz.fam;
    const { puz, answer } = g;
    assert.equal(puz.opts.length, 4, 'four options');
    assert.equal(puz.seq.filter(x => x == null).length, 1, 'one gap');
    assert.equal(new Set(puz.opts.map(E.patKey)).size, 4, `no duplicate options: ${g.rule}`);
    assert.deepEqual(E.patFitting(puz, puz.opts), [answer], `exactly one fits: ${g.rule} ${JSON.stringify(puz)}`);
    if (puz.seq.indexOf(null) !== puz.seq.length - 1) middle++;
    kinds[g.rule.replace(' (gap)', '')] = 1; fams[puz.fam] = (fams[puz.fam] || 0) + 1;
  }
  for (const k of ['add', 'subtract', 'multiply', 'alternate', 'squares', 'fibonacci', 'two sequences', 'turn', 'sides', 'size', 'colour', 'fill', 'dots add', 'dots double', 'dots triangle', 'dots +2 -1']) assert.ok(kinds[k], `the ${k} kind comes up`);
  assert.ok(fams.num > 300 && fams.shape > 300 && fams.dots > 120, `every family often: ${JSON.stringify(fams)}`);
  assert.ok(middle > 150 && middle < 350, `missing-middle puzzles about a quarter of the time (${middle})`);
});
test('patterns: a wrong pick is crossed out for both and the puzzle stays; the right one scores and a new puzzle comes; 3 right wins', () => {
  const rng = E.makeRng('pat-rules'), m = E.newMini('patterns', rng), first = JSON.stringify(m.puz);
  const wrong = [0, 1, 2, 3].filter(k => k !== m.answer);
  let r = E.applyMove(m, 'X', wrong[0], rng);
  assert.equal(r.ok, true); assert.equal(r.outcome, 'continue'); assert.equal(r.note, 'wrong');
  assert.deepEqual(m.crossed, [wrong[0]]); assert.equal(JSON.stringify(m.puz), first, 'the same puzzle');
  assert.equal('right' in m.last, false, 'a wrong pick never carries the answer');
  assert.equal(E.applyMove(m, 'O', wrong[0], rng).reason, 'crossed', 'a crossed-out option cannot be picked again');
  r = E.applyMove(m, 'O', wrong[1], rng);
  assert.deepEqual(m.crossed, [wrong[0], wrong[1]], 'crossed out for both');
  r = E.applyMove(m, 'X', m.answer, rng);
  assert.equal(r.note, 'right'); assert.equal(m.right.X, 1); assert.deepEqual(m.crossed, []);
  assert.notEqual(JSON.stringify(m.puz), first, 'a new puzzle for the next turn');
  for (const bad of [-1, 4, 1.5, 'a', null]) assert.equal(E.applyMove(m, 'O', bad, rng).ok, false, `refused: ${bad}`);
  E.applyMove(m, 'X', m.answer, rng);
  r = E.applyMove(m, 'X', m.answer, rng);
  assert.equal(r.outcome, 'win', 'the third right answer wins');
});
test('patterns: online the answer stays on the server; a timeout is one wrong pick, never the answer', () => {
  const rng = E.makeRng('pat-secret');
  for (let k = 0; k < 200; k++) {
    const m = E.newMini('patterns', rng), hidden = JSON.parse(JSON.stringify(m));
    E.hideMini(hidden);
    assert.equal('answer' in hidden, false); assert.equal('rule' in hidden, false);
    assert.equal(E.applyMove(hidden, 'X', 0, rng).reason, 'secret', 'a phone without the answer cannot judge');
    assert.deepEqual(E.secretOf(m), { answer: m.answer, rule: m.rule });
    assert.equal(E.randomLegalMove(m, 'X', rng), 'auto');
    const r = E.applyMove(m, 'X', 'auto', rng);
    assert.equal(r.note, 'wrong'); assert.equal(m.crossed.length, 1); assert.notEqual(m.crossed[0], m.answer);
  }
  // the flash for a wrong pick: no answer in it
  const st = E.newMatch(rng, { games: only('patterns') }), i = 4, mini = st.squares[i].mini;
  E.playMove(st, i, [0, 1, 2, 3].find(k => k !== mini.answer), rng);
  assert.equal('right' in st.flash.pat, false); assert.equal(st.flash.pat.correct, false);
});
test('patterns: the computer is right about 60% of the time and never picks a crossed-out option', () => {
  const rng = E.makeRng('pat-ai');
  let right = 0, n = 0;
  for (let k = 0; k < 3000; k++) {
    const m = E.newMini('patterns', rng);
    if (k % 3) E.applyMove(m, 'O', [0, 1, 2, 3].find(j => j !== m.answer), rng);
    const b = E.localBest(E.publicMini(m, 'X'), 'X', rng);
    assert.ok(!(m.crossed || []).includes(b.move), 'never a crossed-out option');
    n++; if (b.move === m.answer) right++;
  }
  assert.ok(Math.abs(right / n - 0.6) < 0.035, `right ${(100 * right / n).toFixed(1)}%`);
});

/* ===================================== Risk Wheels ===================================== */
test('wheels: each player\'s own points; one wheel spun a move; first to 18; the admin\'s values in the square', () => {
  assert.deepEqual(E.WHEEL_DEFAULTS, { target: 18, high: { a: 10, pa: 45, b: 0 }, mid: { a: 7, pa: 50, b: 1 }, low: { a: 3, pa: 60, b: 4 } });
  const rng = E.makeRng('wh-rules'), m = E.newMini('wheels', rng);
  assert.deepEqual(m.cfg, E.WHEEL_DEFAULTS); assert.deepEqual(m.pts, { X: 0, O: 0 });
  for (const bad of ['huge', 0, null, ['high']]) assert.equal(E.applyMove(m, 'X', bad, rng).ok, false);
  let r;
  for (let k = 0; k < 200 && (!r || r.outcome !== 'win'); k++) {
    const p = k % 2 ? 'O' : 'X', before = m.pts[p], w = E.WHEELS[k % 3];
    r = E.applyMove(m, p, w, rng);
    const c = m.cfg[w];
    assert.equal(m.pts[p] - before, m.last.hitA ? c.a : c.b);
    assert.ok(m.last.hitA ? m.last.at < c.pa / 100 : m.last.at > c.pa / 100, 'the stop is in its segment');
    assert.equal(r.outcome === 'win', m.pts[p] >= 18);
  }
  assert.equal(r.outcome, 'win');
  E.setWheelsConfig({ target: 30, high: { a: 12, pa: 40, b: 0 }, mid: { a: 99, pa: 50, b: 1 }, low: 'x' });
  const m2 = E.newMini('wheels', rng);
  assert.equal(m2.cfg.target, 30); assert.deepEqual(m2.cfg.high, { a: 12, pa: 40, b: 0 });
  assert.equal(m2.cfg.mid.a, 7, 'off its range: the default'); assert.deepEqual(m2.cfg.low, E.WHEEL_DEFAULTS.low);
  E.setWheelsConfig(null);
  assert.deepEqual(E.newMini('wheels', rng).cfg, E.WHEEL_DEFAULTS);
});
test('wheels: the spins land at the odds; a timeout spins the low-risk wheel', () => {
  const rng = E.makeRng('wh-odds'), cfg = E.wheelsConfig();
  for (const w of E.WHEELS) {
    let hits = 0; const N = 20000;
    for (let k = 0; k < N; k++) { const s = E.wheelSpin(cfg, w, rng); if (s.hitA) hits++; assert.ok(s.at >= 0 && s.at < 1); }
    assert.ok(Math.abs(hits / N - cfg[w].pa / 100) < 0.012, `${w}: ${(100 * hits / N).toFixed(1)}% vs ${cfg[w].pa}%`);
  }
  assert.equal(E.randomLegalMove(E.newMini('wheels', rng), 'X', rng), 'low');
});
test('wheels: the computer plays safe ahead, takes the risk behind or when the other is close, and reaches for 18 when near', () => {
  const rng = E.makeRng('wh-ai'), pick = (a, b) => E.localBest({ type: 'wheels', cfg: E.wheelsConfig(), pts: { X: a, O: b }, spins: { X: 0, O: 0 } }, 'X', rng).move;
  assert.equal(pick(15, 3), 'low', '15 needs 3: the low wheel always gets there');
  assert.equal(pick(12, 2), 'low', 'well ahead: safe');
  assert.equal(pick(13, 9), 'mid', 'needs 5 with the other coming: the best single chance of 18');
  assert.equal(pick(9, 12), 'high', 'needs 9: only the high wheel reaches it at once');
  assert.equal(pick(0, 14), 'high', 'far behind with the other near the end: the risk');
  assert.equal(pick(6, 16), 'high', 'the other wins next turn: the long shot');
  // the q it gives is this spin's chance of reaching the target
  const b = E.localBest({ type: 'wheels', cfg: E.wheelsConfig(), pts: { X: 8, O: 12 }, spins: { X: 0, O: 0 } }, 'X', rng);
  assert.equal(b.move, 'high'); assert.equal(b.q, 0.45);
});
test('wheels: simulated strategies (always high, medium, low, the computer\'s, random): spins to 18 alone and head to head', () => {
  const cfg = E.wheelsConfig(), rng = E.makeRng('wh-sim'), T = cfg.target;
  const strat = { high: () => 'high', mid: () => 'mid', low: () => 'low', random: () => E.WHEELS[Math.floor(rng() * 3)], ai: (a, b) => E.wheelsTable(cfg).best[a][b] };
  const solo = {};
  for (const [k, f] of Object.entries(strat)) {
    let sum = 0; const N = 4000;
    for (let g = 0; g < N; g++) { let a = 0, n = 0; while (a < T) { const s = E.wheelSpin(cfg, f(a, 0), rng); a += s.v; n++; } sum += n; }
    solo[k] = sum / N;
  }
  // alone: the low wheel (3 or 4) needs 5 spins, often 6; the high one two 10s at 45% (about 4.4); the computer, which
  // plays for the duel, in between
  assert.ok(solo.low > 5.5 && solo.low < 5.85 && solo.high > 4.2 && solo.high < 4.7 && solo.mid > 5 && solo.mid < 5.6 && solo.ai < solo.mid, JSON.stringify(solo));
  const duel = (fx, fo) => { let a = 0, b = 0; for (let k = 0; ; k++) { if (k % 2 === 0) { a += E.wheelSpin(cfg, fx(Math.min(a, T - 1), Math.min(b, T - 1)), rng).v; if (a >= T) return 'X'; } else { b += E.wheelSpin(cfg, fo(Math.min(b, T - 1), Math.min(a, T - 1)), rng).v; if (b >= T) return 'O'; } } };
  for (const k of ['high', 'mid', 'low', 'random']) {
    let ai = 0; const N = 3000;
    for (let g = 0; g < N; g++) { if (duel(strat.ai, strat[k]) === 'X') ai++; if (duel(strat[k], strat.ai) === 'O') ai++; }
    assert.ok(ai / (2 * N) > 0.5, `the computer beats "always ${k}" (${(100 * ai / (2 * N)).toFixed(1)}%)`);
  }
});

/* ===================================== Sniff ===================================== */
test('sniff: a 5x5 field, the dog at least 3 steps from the treasure; a step is hotter or colder, always right; onto it wins', () => {
  const rng = E.makeRng('sn-rules');
  for (let k = 0; k < 2000; k++) {
    const m = E.newMini('sniff', rng);
    assert.ok(E.sniffDist(m.dog, m.treasure) >= 3, 'at least 3 steps away');
    assert.equal(m.dog, m.start);
    let r, n = 0;
    while (!r || r.outcome !== 'win') {
      const d = E.randomLegalMove(m, n % 2 ? 'O' : 'X', rng), from = m.dog;
      assert.ok(E.sniffDirs(from).includes(d), 'a legal step');
      r = E.applyMove(m, n % 2 ? 'O' : 'X', d, rng);
      assert.equal(r.ok, true);
      const hot = E.sniffDist(m.dog, m.treasure) < E.sniffDist(from, m.treasure);
      assert.equal(m.last.hot, hot, 'hotter or colder: always right');
      assert.equal(m.trail[m.trail.length - 1].hot, hot ? 1 : 0);
      assert.equal(r.outcome === 'win', m.dog === m.treasure);
      if (++n > 500) assert.fail('never found');
    }
  }
  const m = E.newMini('sniff', rng);
  for (const bad of ['up', 3, null]) assert.equal(E.applyMove(m, 'X', bad, rng).ok, false);
  // off the edge: refused
  const corner = Object.assign(E.newMini('sniff', rng), { dog: 0, start: 0, treasure: 24 });
  assert.equal(E.applyMove(corner, 'X', 'N', rng).ok, false); assert.equal(E.applyMove(corner, 'X', 'W', rng).ok, false);
  assert.deepEqual(E.sniffDirs(0).sort(), ['E', 'S']);
});
test('sniff: online the treasure stays on the server; the computer\'s view has the trail, never the treasure', () => {
  const rng = E.makeRng('sn-secret'), m = E.newMini('sniff', rng);
  const pub = E.publicMini(m, 'X');
  assert.equal('treasure' in pub, false);
  const hidden = JSON.parse(JSON.stringify(m)); E.hideMini(hidden);
  assert.equal('treasure' in hidden, false);
  assert.equal(E.applyMove(hidden, 'X', E.sniffDirs(hidden.dog)[0], rng).reason, 'secret');
  assert.deepEqual(E.secretOf(m), { treasure: m.treasure });
});
test('sniff: the computer walks toward cells still consistent with every hotter and colder', () => {
  const rng = E.makeRng('sn-ai');
  let steps = 0, games = 0, inCands = 0, moves = 0;
  for (let g = 0; g < 600; g++) {
    const m = E.newMini('sniff', rng);
    let r = null, n = 0;
    while (!r || r.outcome !== 'win') {
      const p = n % 2 ? 'O' : 'X', pm = E.publicMini(m, p), cands = E.sniffCands(pm);
      assert.ok(cands.includes(m.treasure), 'the treasure is always among the cells still possible');
      const b = E.localBest(pm, p, rng);
      if (cands.includes(E.sniffStep(m.dog, b.move))) inCands++;
      moves++;
      r = E.applyMove(m, p, b.move, rng); n++;
      assert.ok(n < 60, 'found in good time');
    }
    steps += n; games++;
  }
  assert.ok(steps / games < 9, `about ${(steps / games).toFixed(1)} moves to find it`);
  assert.ok(inCands / moves > 0.4, `steps onto a possible cell ${(100 * inCands / moves).toFixed(0)}% of the time`);
});

/* ===================================== all three ===================================== */
test('patterns, wheels and sniff: computer-vs-computer matches finish, the state stays plain JSON, every square settles', () => {
  for (const g of ['patterns', 'wheels', 'sniff']) for (let s = 0; s < 6; s++) {
    const { st, n } = cpuMatch(only(g), g + s);
    assert.ok(st.winner, `${g}: a result (${n} moves)`);
  }
  for (let s = 0; s < 6; s++) { const games = Object.fromEntries(E.TYPES.map(t => [t, ['patterns', 'wheels', 'sniff', 'ttt'].includes(t)])); assert.ok(cpuMatch(games, 'mix' + s).st.winner); }
});
test('patterns, wheels and sniff: admin only until released', () => {
  for (const t of ['patterns', 'wheels', 'sniff']) {
    assert.ok(E.TEST_TYPES.includes(t)); assert.equal(E.isReleased(t, {}), false);
    assert.ok(!E.releasedTypes({}).includes(t)); assert.ok(E.allowedTypes({}, true).includes(t));
    assert.equal(E.isReleased(t, { [t]: true }), true);
  }
});
