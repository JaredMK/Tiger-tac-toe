'use strict';
// Shell Game (games/shell/rules.js; an attention game: games/shared/attention.js): the deal and the levels, the shuffle
// (the same from its round on every machine; every cup's motion continuous; swaps at the same moment never share a cup
// or reach across each other; the cup behind always shows over the one in front), the pick (right: a level on; wrong:
// the level kept; "Go again" keeps the turn), what stays the server's until Start, the timing of an answer, the
// computer's chances and the presets.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const lcg = s => E.makeRng('shell-test:' + s);
const withTune = (t, fn) => { E.setTune('shell', t); try { return fn(); } finally { E.setTune('shell', null); } };
const roundOf = (name, level, seed) => E.shellRound(level, lcg(seed), Object.assign({}, E.tuneDefaults('shell'), E.shellPreset(name)));

test('shell: its registry entry (Admin only, More skill, the newest client, real time, held back from Find Match)', () => {
  const m = E.metaOf('shell');
  assert.deepEqual([m.release, m.category, m.minVersion, m.realTime, !!m.superChaos], ['admin', 'skill', '1.22.0', true, false]);   // (1.22.0: the client that brought it; 1.23.0 is Backgammon Lite's v 4)
  assert.ok(E.TEST_TYPES.includes('shell') && E.ATT_TYPES.includes('shell') && E.FIND_MATCH_HOLD.includes('shell'));
  assert.equal(m.explainer.win, 'Pick right {levels} times.');
  assert.deepEqual(E.shellPreset('Normal'), Object.fromEntries(Object.entries(E.tuneDefaults('shell')).filter(([k]) => /^(c|ms|sw|pr|far|rp|sh|ai)\d$/.test(k))), 'Normal is the defaults');
});

test('shell: the deal: each player their own round at level 1 (3 cups), their own ball and seed; three levels, 3, 4 and 5 cups', () => {
  const m = E.newMini('shell', lcg(1));
  assert.deepEqual(m.right, { X: 0, O: 0 }); assert.deepEqual(m.started, { X: null, O: null });
  for (const p of ['X', 'O']) { const r = m.round[p]; assert.deepEqual([r.level, r.n, r.ms, r.k, r.pairs, r.far, r.ramp, r.show], [0, 3, 300, 7, 0, 0, 25, 1200]); assert.ok(r.ball >= 0 && r.ball < 3 && Number.isInteger(r.seed)); }
  assert.notEqual(m.round.X.seed, m.round.O.seed, 'a seed each');
  assert.equal(E.attGoal(m), 3);
  assert.deepEqual([0, 1, 2].map(l => E.shellLevel(E.tuneDefaults('shell'), l).n), [3, 4, 5]);
});

test('shell: a round is its values alone: the same swaps, moments and end every time; another seed, another shuffle', () => {
  for (let s = 0; s < 40; s++) {
    const r = roundOf('Normal', s % 5, 'd' + s), a = E.shellPlan(r), b = E.shellPlan(JSON.parse(JSON.stringify(r)));
    assert.deepEqual(a, b);
    assert.equal(a.steps.length, r.k); assert.equal(a.t0, r.show + E.SHELL.beat); assert.equal(a.ms, a.end + E.SHELL.settle);
    assert.equal(E.attMs('shell', r), a.ms); assert.equal(E.attTruth('shell', r), a.ballAt);
    assert.deepEqual(a.at.slice().sort((x, y) => x - y), Array.from({ length: r.n }, (_, i) => i), 'every cup ends at a place of its own');
    assert.equal(a.at[r.ball], a.ballAt, 'the ball is where its cup is');
  }
  const r = roundOf('Normal', 2, 'x');
  assert.notDeepEqual(E.shellPlan(r).steps, E.shellPlan(Object.assign({}, r, { seed: r.seed + 1 })).steps);
});

test('shell: the tempo rises through the shuffle by the ramp; a far swap takes a little longer; the steps follow one another with barely a pause', () => {
  const r = { level: 0, n: 3, ball: 0, seed: 7, ms: 300, k: 9, pairs: 0, far: 0, ramp: 50, show: 1000 }, st = E.shellPlan(r).steps;
  assert.equal(st[0].d, 300); assert.equal(st[8].d, 200, 'the last swap half as fast again');
  for (let i = 1; i < st.length; i++) { assert.ok(st[i].d <= st[i - 1].d); const gap = st[i].t0 - (st[i - 1].t0 + st[i - 1].d); assert.ok(gap >= 0 && gap <= st[i - 1].d * E.SHELL.gap + 1, `a short gap (${gap} ms)`); }
  const far = E.shellPlan({ level: 0, n: 5, ball: 0, seed: 3, ms: 300, k: 30, pairs: 0, far: 1, ramp: 0, show: 1000 }).steps;
  assert.ok(far.some(s => s.sw[0][1] - s.sw[0][0] > 1), 'swaps between cups that are not neighbours');
  for (const s of far) assert.equal(s.d, Math.round(300 * (1 + E.SHELL.farSlow * (s.sw[0][1] - s.sw[0][0] - 1))));
  assert.ok(E.shellPlan({ level: 0, n: 5, ball: 0, seed: 3, ms: 300, k: 30, pairs: 0, far: 0, ramp: 0, show: 1000 }).steps.every(s => s.sw[0][1] - s.sw[0][0] === 1), 'neighbours alone where the level says so');
});

test('shell: swaps at the same moment never share a cup and never reach across each other; a pair may swap straight back', () => {
  let both = 0, back = 0, steps = 0;
  for (let s = 0; s < 300; s++) {
    const r = roundOf(['Normal', 'Brutal'][s % 2], 2 + (s % 3), 'p' + s), plan = E.shellPlan(r);
    let prev = null;
    for (const st of plan.steps) {
      steps++;
      assert.ok(st.sw.length <= 1 + r.pairs, 'no more at once than the level allows');
      if (st.sw.length > 1) both++;
      for (const [a, b, front] of st.sw) { assert.ok(a >= 0 && a < b && b < r.n && b - a <= E.SHELL.span && (front === 0 || front === 1)); }
      for (let i = 0; i < st.sw.length; i++) for (let j = i + 1; j < st.sw.length; j++) { const x = st.sw[i], y = st.sw[j]; assert.ok(x[1] < y[0] || y[1] < x[0], `swaps ${x} and ${y} lie apart`); }
      if (prev && prev[0] === st.sw[0][0] && prev[1] === st.sw[0][1]) back++;
      prev = st.sw[0];
    }
  }
  assert.ok(both > steps * 0.1, `swaps at the same moment happen (${both} of ${steps} steps)`);
  assert.ok(back > steps * 0.1 && back < steps * 0.35, `a pair swapping straight back (${back} of ${steps})`);
});

test('shell: nothing teleports and nothing is hidden: every cup moves continuously, stands exactly on a place between swaps, and where two cups are close along the row the one behind shows over the one in front', () => {
  for (let s = 0; s < 60; s++) {
    const r = roundOf(['Gentle', 'Normal', 'Brutal'][s % 3], s % 5, 'c' + s), plan = E.shellPlan(r), DT = 4;
    let last = E.shellAt(r, 0);
    assert.deepEqual(last.map(q => [q.x, q.z]), Array.from({ length: r.n }, (_, i) => [i, 0]), 'the cups in their row to begin with');
    const fastest = Math.min(...plan.steps.map(st => st.d / Math.max(...st.sw.map(x => x[1] - x[0]))));   // ms a place, at the quickest
    const maxDx = (Math.PI / 2) * (DT / fastest) * 1.05 + 1e-6, maxDz = (Math.PI * E.shellArc(E.SHELL.span) * DT) / Math.min(...plan.steps.map(st => st.d)) * 1.05 + 1e-6;
    for (let t = DT; t <= plan.ms + 40; t += DT) {
      const now = E.shellAt(r, t);
      for (let c = 0; c < r.n; c++) {
        assert.ok(Math.abs(now[c].x - last[c].x) <= maxDx, `cup ${c} at ${t} ms moved ${Math.abs(now[c].x - last[c].x).toFixed(3)} places in ${DT} ms`);
        assert.ok(Math.abs(now[c].z - last[c].z) <= maxDz, `cup ${c} at ${t} ms: its arc is continuous`);
        if (!now[c].u) { assert.ok(Number.isInteger(now[c].x) && now[c].z === 0 && now[c].v === 0, 'standing: exactly on a place, on the row'); }
      }
      for (let a = 0; a < r.n; a++) for (let b = a + 1; b < r.n; b++) {
        const dx = Math.abs(now[a].x - now[b].x), dz = Math.abs(now[a].z - now[b].z);
        if (dx < 0.5) assert.ok(dz >= 0.6, `cups ${a} and ${b} at ${t} ms: ${dx.toFixed(2)} places apart along the row, ${dz.toFixed(2)} cup heights apart across it`);
      }
      last = now;
    }
    assert.deepEqual(last.map(q => q.x), plan.at, 'the cups end where the plan says');
  }
});

test('shell: the ball is on show under its lifted cup, then covered, before the first swap', () => {
  const r = roundOf('Normal', 0, 'lift'), plan = E.shellPlan(r);
  assert.equal(E.shellLift(r, 0), 0); assert.equal(E.shellLift(r, E.SHELL.lift + 1), 1); assert.equal(E.shellLift(r, r.show - E.SHELL.drop - 1), 1);
  assert.ok(E.shellLift(r, r.show - 50) < 0.2); assert.equal(E.shellLift(r, r.show), 0);
  assert.ok(plan.steps[0].t0 >= r.show + E.SHELL.beat, 'no cup moves until the ball is covered and a beat has passed');
});

test('shell: a right pick moves a level on (more cups), a wrong one keeps the level with a fresh shuffle; the turn ends either way; the last level wins the square', () => {
  const m = E.newMini('shell', lcg(2));
  const first = m.round.X, wrong = (E.attTruth('shell', first) + 1) % first.n;
  let r = E.applyMove(m, 'X', wrong, lcg(3));
  assert.deepEqual([r.ok, r.outcome, r.note, !!r.again], [true, 'continue', 'wrong', false]);
  assert.equal(m.right.X, 0); assert.equal(m.round.X.level, 0); assert.equal(m.round.X.n, 3); assert.notEqual(m.round.X.seed, first.seed, 'a new shuffle at the same level');
  assert.deepEqual([m.last.correct, m.last.answer, m.last.truth, m.last.round.seed], [false, wrong, E.attTruth('shell', first), first.seed]);
  r = E.applyMove(m, 'X', E.attTruth('shell', m.round.X), lcg(4));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.right.X, m.round.X.level, m.round.X.n], ['continue', 'right', false, 1, 1, 4]);
  r = E.applyMove(m, 'X', E.attTruth('shell', m.round.X), lcg(5));
  assert.deepEqual([r.outcome, m.right.X, m.round.X.n], ['continue', 2, 5]);
  assert.deepEqual(m.right.O, 0, 'the other player\'s progress is their own');
  r = E.applyMove(m, 'X', E.attTruth('shell', m.round.X), lcg(6));
  assert.deepEqual([r.outcome, m.right.X], ['win', 3]);
  for (const bad of [-1, 3, 1.5, '1', null, [0]]) assert.equal(E.applyMove(E.newMini('shell', lcg(7)), 'X', bad, lcg(8)).ok, false, `not a cup: ${JSON.stringify(bad)}`);
  assert.equal(E.applyMove(E.newMini('shell', lcg(7)), 'X', 'auto', lcg(8)).note, 'wrong', 'no pick in time: wrong');
});

test('shell: the admin\'s settings: the levels to win (1 to 5), the cups of each, each level\'s shuffle; a square keeps the values it was dealt with', () => {
  withTune({ levels: 1, c1: 2 }, () => { const m = E.newMini('shell', lcg(9)); assert.equal(E.attGoal(m), 1); assert.equal(m.round.X.n, 2); assert.equal(E.applyMove(m, 'X', E.attTruth('shell', m.round.X), lcg(1)).outcome, 'win'); });
  const m5 = withTune({ levels: 5, c4: 7, c5: 2, ms2: 150, sw2: 20, pr2: 2, far2: 'no', rp2: 0, sh2: 2000 }, () => E.newMini('shell', lcg(10)));
  assert.equal(E.attGoal(m5), 5, 'kept by the square once the settings are back to the defaults');
  const seen = [];
  for (let k = 0; k < 5; k++) { seen.push(m5.round.X.n); const r = E.applyMove(m5, 'X', E.attTruth('shell', m5.round.X), lcg('w' + k)); assert.equal(r.outcome, k === 4 ? 'win' : 'continue'); if (k === 0) assert.deepEqual([m5.round.X.ms, m5.round.X.k, m5.round.X.pairs, m5.round.X.far, m5.round.X.ramp, m5.round.X.show], [150, 20, 2, 0, 0, 2000]); }
  assert.deepEqual(seen, [3, 4, 5, 7, 2]);
  for (const f of E.gameFields('shell')) assert.ok(f.opts ? f.opts.includes(f.def) : f.min <= f.def && f.def <= f.max, f.k);
  assert.ok(E.gameFields('shell').some(f => f.k === 'levels' && f.min === 1 && f.max === 5) && E.gameFields('shell').filter(f => /^c\d$/.test(f.k)).every(f => f.min === 2 && f.max === 7));
  assert.deepEqual(E.gameFields('shell').filter(f => /^pr\d$/.test(f.k)).map(f => [f.min, f.max]), Array(5).fill([0, 2]));
});

test('shell: "Go again on success" (off by default): on, a right pick keeps the turn and the next level waits for its Start; never after a wrong pick, the winning one or a timeout', () => {
  assert.equal(E.tuneDefaults('shell').again, 'off');
  const st = withTune({ again: 'on' }, () => E.newMatch(lcg(11), { games: ['shell'] }));
  const i = 0, mini = st.squares[i].mini, p = st.turn;
  assert.equal(E.attStart(st, i, p, 1000).ok, true);
  let r = E.playMove(st, i, E.attTruth('shell', mini.round[p]), lcg(12));
  assert.deepEqual([r.ok, st.flash.kind, st.lock, mini.started[p], mini.right[p]], [true, 'again', i, null, 1], 'the turn kept, held to the square, the next round not begun');
  E.endFlash(st);
  assert.equal(st.turn, p);
  assert.equal(E.rulesOf('shell').timeoutClose(mini, p), null, 'held with no round begun: a timeout plays nothing');
  st.timer = E.newTimer(30);
  const t = E.timeoutMove(st, lcg(13));
  assert.deepEqual([t.ok, !!t.ended, st.turn === p, mini.right[p]], [true, true, false, 1], 'the turn passes, the level kept, not a missed turn');
  const m2 = withTune({ again: 'on' }, () => E.newMini('shell', lcg(14)));
  assert.equal(!!E.applyMove(m2, 'X', (E.attTruth('shell', m2.round.X) + 1) % 3, lcg(1)).again, false, 'a wrong pick ends the turn');
  m2.right.X = 2; m2.round.X = E.shellRound(2, lcg(2), E.tune(m2));
  const w = E.applyMove(m2, 'X', E.attTruth('shell', m2.round.X), lcg(3));
  assert.deepEqual([w.outcome, !!w.again], ['win', false]);
  const m3 = E.newMini('shell', lcg(15)); m3.started.X = 5;
  assert.equal(E.rulesOf('shell').timeoutClose(m3, 'X'), 'auto', 'a round begun and out of time: a failed one');
});

test('shell online: the round is the server\'s until Start (the record shows the cups alone: never the ball\'s place or the seed); a pick comes after the shuffle has played and in time', () => {
  const T = 1700000000000, st = E.newMatch(lcg(16), { games: ['shell'] }), mini = st.squares[0].mini;
  st.id = 's1'; st.seq = 0; st.recent = [];
  let rec = E.matchRecord(st);
  for (const p of ['X', 'O']) assert.deepEqual(rec.state.squares[0].mini.round[p], { level: 0, n: 3, hidden: true });
  assert.ok(!/"(ball|seed)"/.test(JSON.stringify(rec.state)), 'nothing of a round in the public state');
  assert.deepEqual(rec.secrets[0].round, mini.round);
  assert.equal(E.attStart(st, 0, 'X', T).ok, true);
  rec = E.matchRecord(st);
  assert.deepEqual(rec.state.squares[0].mini.round.X, mini.round.X, 'X\'s round shows once started'); assert.equal(rec.state.squares[0].mini.round.O.hidden, true);
  const ms = E.attMs('shell', mini.round.X), pick = E.attTruth('shell', mini.round.X);
  assert.deepEqual(E.onlineCheck(Object.assign({}, mini, { started: { X: null, O: null } }), 'X', pick, T, null), { why: 'start' }, 'no pick before Start');
  assert.deepEqual(E.onlineCheck(mini, 'X', pick, T + 500, null), { why: 'fast' }, 'a pick while the cups are still moving: refused');
  assert.equal(E.onlineCheck(mini, 'X', pick, T + ms + 800, null), null, 'after the shuffle: taken');
  assert.deepEqual(E.onlineCheck(mini, 'X', pick, T + ms + E.SHELL.answerMs + E.ATT.slackMs + 1, null), { why: null, move: 'auto' }, 'too late: out of time');
});

test('shell: the computer is right as often as its level\'s setting says; its misses are another cup', () => {
  const m = withTune({ ai1: 100, ai2: 0 }, () => E.newMini('shell', lcg(17))), rng = lcg(18);
  for (let k = 0; k < 20; k++) assert.equal(E.localBest(E.publicMini(m), 'X', rng).move, E.attTruth('shell', m.round.X), 'level 1 at 100%: always right');
  m.right.X = 1; m.round.X = E.shellRound(1, lcg(19), E.tune(m));
  for (let k = 0; k < 40; k++) { const mv = E.localBest(E.publicMini(m), 'X', rng).move; assert.ok(Number.isInteger(mv) && mv >= 0 && mv < m.round.X.n && mv !== E.attTruth('shell', m.round.X), 'level 2 at 0%: a cup, never the right one'); }
  const d = E.newMini('shell', lcg(20)); let ok = 0; const N = 3000, r2 = lcg(21);
  for (let k = 0; k < N; k++) if (E.localBest(E.publicMini(d), 'X', r2).move === E.attTruth('shell', d.round.X)) ok++;
  assert.ok(Math.abs(ok / N - 0.8) < 0.04, `level 1 by default: 80% (${(100 * ok / N).toFixed(1)}%)`);
  assert.ok(E.aiOf('shell').needs(E.publicMini(d), 'X') > 3 && E.aiOf('shell').needs(E.publicMini(d), 'X') < 8, 'about 5 turns to win by its own chances');
});

test('shell: the presets (Gentle, Normal, Brutal): every value one its setting takes; more cups each level; Gentle slower than Normal, Brutal faster', () => {
  const F = Object.fromEntries(E.gameFields('shell').map(f => [f.k, f]));
  assert.deepEqual(Object.keys(E.SHELL_PRESETS), ['Gentle', 'Normal', 'Brutal']);
  for (const name of Object.keys(E.SHELL_PRESETS)) {
    const v = E.shellPreset(name);
    assert.equal(Object.keys(v).length, 8 * E.SHELL_MAX, `${name}: every level's eight values`);
    for (const k of Object.keys(v)) { assert.ok(F[k], `${name}.${k}: a setting`); assert.equal(E.tuneValue(F[k], v[k]), v[k], `${name}.${k}: ${v[k]} is in its range, on its step`); }
    const L = E.SHELL_PRESETS[name];
    for (let i = 1; i < L.length; i++) { assert.ok(L[i].c > L[i - 1].c, 'more cups each level'); assert.ok(L[i].ms <= L[i - 1].ms && L[i].ai <= L[i - 1].ai, 'no slower, the computer no surer'); }
  }
  for (let i = 0; i < E.SHELL_MAX; i++) assert.ok(E.SHELL_PRESETS.Gentle[i].ms > E.SHELL_PRESETS.Normal[i].ms && E.SHELL_PRESETS.Normal[i].ms > E.SHELL_PRESETS.Brutal[i].ms - (i > 1 ? 31 : 0));
});
