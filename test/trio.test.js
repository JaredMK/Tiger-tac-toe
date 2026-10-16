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
test('wheels: simulated strategies over 1,000 dealt sets (always high, medium, low, the computer\'s, random): spins to 18 alone and head to head', () => {
  const rng = E.makeRng('wh-sim'), sets = Array.from({ length: 1000 }, (_, k) => E.wheelsDeal(E.makeRng('sim' + k), E.WHEEL_DEFAULTS)), T = 18;
  const strat = { high: () => 'high', mid: () => 'mid', low: () => 'low', random: () => E.WHEELS[Math.floor(rng() * 3)], ai: (w, a, b) => E.wheelsTable(T, w).best[a][b] };
  const solo = {};
  for (const [k, f] of Object.entries(strat)) {
    let sum = 0, n = 0;
    for (const w of sets) for (let g = 0; g < 3; g++) { let a = 0, spins = 0; while (a < T && spins < 400) { a += E.wheelSpin(w[f(w, a, 0)], rng).v; spins++; } sum += spins; n++; }
    solo[k] = sum / n;
  }
  console.log('Risk Wheels: average spins to 18 alone over 1,000 sets: ' + Object.entries(solo).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(', '));
  assert.ok(solo.low < solo.mid && solo.mid < solo.high, 'alone, the steadier the sooner (the averages in order)');
  const duel = (w, fx, fo) => { let a = 0, b = 0; for (let k = 0; k < 2000; k++) { if (k % 2 === 0) { a += E.wheelSpin(w[fx(w, Math.min(a, T - 1), Math.min(b, T - 1))], rng).v; if (a >= T) return 'X'; } else { b += E.wheelSpin(w[fo(w, Math.min(b, T - 1), Math.min(a, T - 1))], rng).v; if (b >= T) return 'O'; } } return null; };
  const rates = {};
  for (const k of ['high', 'mid', 'low', 'random']) {
    let ai = 0, n = 0;
    for (const w of sets.slice(0, 400)) for (let g = 0; g < 2; g++) { if (duel(w, strat.ai, strat[k]) === 'X') ai++; if (duel(w, strat[k], strat.ai) === 'O') ai++; n += 2; }
    rates[k] = ai / n;
    assert.ok(ai / n > 0.5, `the computer beats "always ${k}" (${(100 * ai / n).toFixed(1)}%)`);
  }
  console.log('Risk Wheels: the computer\'s wins head to head: ' + Object.entries(rates).map(([k, v]) => `vs ${k} ${(100 * v).toFixed(1)}%`).join(', '));
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
test('sniff: no memory on the board: the square keeps only the last 3 steps (the computer\'s memory); the word shows about 2 s', () => {
  const rng = E.makeRng('sn-mem'), m = Object.assign(E.newMini('sniff', rng), { dog: 0, start: 0, treasure: 24 });
  for (const d of ['E', 'E', 'S', 'S', 'W']) E.applyMove(m, 'X', d, rng);
  assert.equal(m.trail.length, 3, 'only the last 3 steps');
  assert.deepEqual(m.trail.map(t => [t.f, t.t]), [[2, 7], [7, 12], [12, 11]]);
  const pm = E.publicMini(m);
  assert.equal(pm.trail.length, 3);
  // the cells the computer still suspects: what the 3 steps say, not the earlier ones (cell 0, where it started, is forgotten)
  const c = E.sniffCands(pm);
  assert.ok(!c.includes(11) && !c.includes(12) && !c.includes(7) && !c.includes(2), 'not where it stood in those steps');
  assert.ok(c.includes(0) || c.every(x => x !== 0), 'the start is no longer known');
  const st = E.newMatch(rng, { games: ['sniff'] }), sq = st.squares[0].mini, d = E.sniffDirs(sq.dog)[0];
  E.playMove(st, 0, d, rng);
  assert.equal(E.playMs(st.flash), E.SNIFF.step + E.SNIFF.hold + (st.flash.kind === 'claim' ? 900 : 0));
  assert.ok(E.SNIFF.hold >= 1800 && E.SNIFF.hold <= 2200, 'the word: about 2 seconds');
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
