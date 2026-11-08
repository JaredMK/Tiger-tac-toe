'use strict';
// Muncher: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/muncher/rules.js');
const A = require('../../src/games/muncher/ai.js');
const M = require('../../src/games/muncher/meta.js');
const { timeoutClose } = require('../../src/core/board.js');
const { onlineCheck } = require('../../src/core/verify.js');

const mini = (seed, ate) => { const m = E.newMini('muncher', E.makeRng(seed || 'mu')); if (ate) m.ate = ate; return m; };
const clone = x => JSON.parse(JSON.stringify(x));
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

/* ===================================== Muncher ===================================== */
test('muncher: a fresh square: a dealt layout, a seed, no dots eaten, no runs; its settings dealt in (TUNE)', () => {
  const m = mini();
  assert.equal(m.type, 'muncher'); assert.ok(m.lay >= 0 && m.lay < R.LAYOUTS.length); assert.ok(Number.isInteger(m.seed));
  assert.deepEqual(m.ate, { X: [], O: [] }); assert.deepEqual(m.tries, { X: 0, O: 0 }); assert.equal(m.last, null);
  assert.equal(R.munScore(m, 'X'), 0); assert.equal(R.munTarget(m), Math.min(M.TUNE.find(f => f.k === 'target').def, R.munLayout(m.lay).dots.length));
  assert.deepEqual(E.publicMini(m), Object.assign(R.publicView(m), m.tune ? { tune: m.tune } : {}), 'nothing is hidden');
  E.setTune('muncher', { target: 9, ghosts: 1, runSecs: 5 });
  const t = E.newMini('muncher', E.makeRng('tuned'));
  E.setTune('muncher', null);
  assert.deepEqual(t.tune, { target: 9, ghosts: 1, runSecs: 5 });
  const cfg = R.munCfg(t);
  assert.equal(cfg.target, 9); assert.equal(cfg.ghosts, 1); assert.equal(cfg.runSecs, 5);
  assert.equal(R.munStart(t, 'X').gh.length, 1, 'one spook');
  assert.equal(R.munCfg(E.newMini('muncher', E.makeRng('plain'))).ghosts, 2, 'untuned: two');
});
test('muncher: every layout is 9 by 7, its open cells all reachable from the start, the spooks on open cells, a dot on every other open cell', () => {
  R.LAYOUTS.forEach((rows, k) => {
    assert.equal(rows.length, R.MUN.h); for (const r of rows) assert.equal(r.length, R.MUN.w);
    const L = R.munLayout(k), d = R.munDist(L, L.start[1] * R.MUN.w + L.start[0], null);
    for (let c = 0; c < L.open.length; c++) assert.equal(L.open[c] === 1, d[c] >= 0, `layout ${k}: cell ${c} ${L.open[c] ? 'reachable' : 'a wall'}`);
    assert.ok(L.ghosts.length >= 2 && L.ghosts.every(([x, y]) => R.openAt(L, x, y)));
    assert.ok(L.dots.length >= 18 && L.dots.length <= 30, `about 20 dots (${L.dots.length})`);
    for (const c of L.dots) { const x = c % R.MUN.w, y = (c - x) / R.MUN.w; assert.equal((x + y) % 2, 0); assert.ok(L.open[c]); }
    assert.ok(R.munTarget(mini('t' + k)) <= L.dots.length, 'the target is within the dots');
  });
});
test('muncher: the same inputs give the same run (the phone, the server, a replay), step for step; the inputs read back', () => {
  for (let s = 0; s < 12; s++) {
    const m = mini('rep' + s), r = R.munPilot(m, 'X', E.makeRng('h' + s), R.munHand(m, s % 2 ? 'hard' : 'normal'));
    const log = R.munUnlog(r.move.log, r.move.steps);
    assert.ok(log, 'the inputs read back'); assert.deepEqual(log, r.sim.log);
    const a = R.munReplay(m, 'X', log, r.move.steps), b = R.munReplay(clone(m), 'X', log, r.move.steps);
    assert.deepEqual([a.n, a.end, a.ate, a.ch, a.gh], [r.sim.n, r.sim.end, r.sim.ate, r.sim.ch, r.sim.gh], 'the replay ends exactly where the run did');
    assert.deepEqual([b.n, b.end, b.ate], [a.n, a.end, a.ate]);
    assert.equal(R.munCheck(m, 'X', r.move).why, null, 'and it passes the check');
  }
  assert.equal(R.munUnlog('', 10).length, 0); assert.equal(R.munUnlog('3:4', 10), null, 'no such direction'); assert.equal(R.munUnlog('3:1,2:2,1:0', 5), null, 'past the steps'); assert.equal(R.munUnlog('x', 10), null);
});
test('muncher: a run without its inputs is refused, a run that does not play out as said is refused, a timed-out run changes nothing', () => {
  const m = mini('chk'), r = R.munPilot(m, 'X', E.makeRng('c'), R.munHand(m, 'normal'));
  assert.deepEqual(E.applyMove(clone(m), 'X', { steps: r.move.steps, ate: r.move.ate, end: r.move.end }, E.makeRng('x')), { ok: false, reason: 'log' });
  assert.deepEqual(E.applyMove(clone(m), 'X', Object.assign({}, r.move, { ate: r.move.ate + 1 }), E.makeRng('x')), { ok: false, reason: 'replay' }, 'more dots than it ate');
  assert.deepEqual(E.applyMove(clone(m), 'X', Object.assign({}, r.move, { steps: r.move.steps + 5 }), E.makeRng('x')), { ok: false, reason: r.move.end === 'time' ? 'bad' : 'replay' }, 'longer than it ran');
  assert.deepEqual(E.applyMove(clone(m), 'X', Object.assign({}, r.move, { end: 'win' }), E.makeRng('x')).ok, false);
  for (const bad of [null, 'spin', 7, { log: 5, steps: 3 }, { log: '', steps: 0, ate: 0, end: 'out' }, { log: '', steps: 100000, ate: 0, end: 'out' }]) assert.equal(E.applyMove(clone(m), 'X', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  assert.deepEqual(E.applyMove(clone(m), 'X', { log: '', steps: 10, ate: 0, end: 'out' }, E.makeRng('x')), { ok: true, outcome: 'continue', note: 'none' }, 'a run that stood still is a run of nothing');
  const t = clone(m), r2 = E.applyMove(t, 'X', 'auto', E.makeRng('x'));
  assert.deepEqual(r2, { ok: true, outcome: 'continue', note: 'out' }); assert.equal(t.ate.X.length, 0); assert.equal(t.tries.X, 1); assert.equal(t.last.auto, true);
  assert.equal(timeoutClose(m, 'X'), null, 'a timeout plays nothing more here (the run under way is lost; the turn passes)');
  assert.equal(onlineCheck(m, 'X', 'auto', 1000, 0).why, 'auto', 'a phone never sends a timeout');
  assert.equal(onlineCheck(m, 'X', r.move, 1000, 0), null, 'the server\'s own checks pass the move on to apply, which plays its inputs through again');
});
test('muncher: a run\'s dots stay eaten for that player alone; the next run starts clean (the muncher and the spooks back at their starts); the target wins the square', () => {
  const m = mini('keep');
  const r = R.munPilot(m, 'X', E.makeRng('k'), R.munHand(m, 'hard'));
  assert.ok(r.move.ate > 0, 'the computer eats something');
  const res = E.applyMove(m, 'X', r.move, E.makeRng('x'));
  assert.equal(res.ok, true); assert.equal(m.ate.X.length, r.move.ate); assert.deepEqual(m.ate.O, []); assert.equal(m.tries.X, 1);
  assert.deepEqual(m.ate.X, [...m.ate.X].sort((a, b) => a - b), 'kept sorted');
  assert.deepEqual([m.last.by, m.last.from, m.last.to, m.last.try, m.last.ate.length], ['X', 0, r.move.ate, 0, r.move.ate]);
  const s2 = R.munStart(m, 'X'), L = R.munLayout(m.lay);
  assert.deepEqual([s2.ch.x, s2.ch.y, s2.ch.d], [L.start[0], L.start[1], -1]); assert.equal(s2.left, L.dots.length - r.move.ate, 'their dots gone'); assert.equal(s2.score0, r.move.ate);
  assert.equal(R.munStart(m, 'O').left, L.dots.length, 'the other player\'s maze is full');
  // near the target: a run that reaches it ends there and wins the square
  const T = R.munTarget(m), far = R.munDist(L, L.start[1] * R.MUN.w + L.start[0], null), byFar = L.dots.slice().sort((a, b) => far[b] - far[a]);   // (the dots left are the ones nearest the start)
  const w = mini('win', { X: byFar.slice(0, T - 1), O: [] }); w.lay = m.lay;
  const rw = R.munPilot(w, 'X', E.makeRng('w'), R.munHand(w, 'hard'));
  assert.equal(rw.move.end, 'win'); assert.equal(rw.move.ate, 1);
  const rr = E.applyMove(w, 'X', rw.move, E.makeRng('x'));
  assert.deepEqual(rr, { ok: true, outcome: 'win', note: 'target' }); assert.equal(w.ate.X.length, T);
  assert.equal(A.needs(E.publicMini(w), 'X'), 0); assert.ok(A.needs(E.publicMini(w), 'O') > 1);
});
test('muncher: a spook catches the muncher (max-norm within MUN.hit), the time runs out, the maze empties; a reversal turns at once mid-cell', () => {
  const m = mini('ends'), ends = {};
  for (let s = 0; s < 60; s++) { const r = R.munPilot(mini('e' + s), 'X', E.makeRng('r' + s), R.MUN_HANDS.random); ends[r.move.end] = (ends[r.move.end] || 0) + 1; }
  assert.ok(ends.caught > 0, `careless runs get caught (${JSON.stringify(ends)})`);
  const still = R.munStart(m, 'X');
  for (let n = 0; n < still.cap && !still.end; n++) R.munStep(still);
  assert.ok(still.end === 'time' || still.end === 'caught', 'standing still at the start: the time runs out, or a spook comes by');
  assert.ok(still.n <= still.cap); assert.equal(still.ate.length, 0); assert.ok(still.n > still.graceN, 'nothing touches it in the grace');
  E.setTune('muncher', { target: 5 });
  const five = E.newMini('muncher', E.makeRng('five'));
  E.setTune('muncher', null);
  assert.equal(R.munTarget(five), 5, 'the target as dealt (never below its setting\'s least)');
  const sim = R.munStart(m, 'X');
  R.munInput(sim, 3); for (let n = 0; n < 4; n++) R.munStep(sim);   // left a little (the start's corridor runs left and right: a wall above it)
  const [x0, y0] = R.munPos(sim.ch); assert.ok(sim.ch.d === 3 && sim.ch.f > 0);
  R.munInput(sim, 1);
  R.munStep(sim);   // back right: turned at once, from where it was
  assert.equal(sim.ch.d, 1); const [x1, y1] = R.munPos(sim.ch); assert.equal(y1, y0); assert.ok(x1 > x0 && x1 - x0 <= sim.v);
  assert.deepEqual(sim.log, [[0, 3], [4, 1]]);
});
test('muncher: the computer: Normal eats a few dots a run, Hard at least as many on average and never fewer within a square; a careless run is a legal one; q is exact', () => {
  const normal = [], hard = [];
  for (let s = 0; s < 40; s++) {
    const m = mini('ai' + s), pm = E.publicMini(m);
    const n = A.best(pm, 'X', E.makeRng('n' + s), {}, { level: 'normal', until: null }), h = A.best(pm, 'X', E.makeRng('h' + s), {}, { level: 'hard', until: null });
    normal.push(n.move.ate); hard.push(h.move.ate);
    assert.equal(R.munCheck(m, 'X', n.move).why, null); assert.equal(R.munCheck(m, 'X', h.move).why, null);
    assert.equal(n.q, R.munScore(m, 'X') + n.move.ate >= R.munTarget(m) ? 1 : 0);
    const rnd = E.randomLegalMove(m, 'X', E.makeRng('r' + s));
    assert.equal(R.munCheck(m, 'X', rnd).why, null, 'a careless run passes the check');
  }
  assert.ok(avg(normal) >= 2, `Normal eats some (${avg(normal).toFixed(2)})`);
  assert.ok(avg(hard) >= avg(normal), `Hard (${avg(hard).toFixed(2)}) at least Normal (${avg(normal).toFixed(2)})`);
  const m = mini('needs'); assert.ok(A.needs(E.publicMini(m), 'X') > 1 && A.needs(E.publicMini(m), 'X') < 20);
  const t0 = Date.now(); A.best(E.publicMini(m), 'X', E.makeRng('t'), {}, { level: 'hard', until: () => 5 }); assert.ok(Date.now() - t0 < 1500, 'Hard keeps to its time');
});
test('muncher: the flash carries the run for the other phone\'s replay (its inputs, its dots, where it started); flashMs counts the run only for someone else', () => {
  const st = E.newMatch(E.makeRng('fl'), { games: ['muncher'] });
  const sq = st.squares[0]; sq.mini = mini('flash'); sq.owner = null; st.turn = 'X';
  const r = R.munPilot(sq.mini, 'X', E.makeRng('f'), R.munHand(sq.mini, 'normal'));
  const pr = E.playMove(st, 0, r.move, E.makeRng('pm'));
  assert.equal(pr.ok, true);
  const f = pr.flash, g = f.mun;
  assert.equal(f.kind, 'move'); assert.equal(f.m, undefined, 'the move rides in mun, never as a small move');
  assert.deepEqual([g.by, g.from, g.to, g.steps, g.end, g.log, g.try, g.target], ['X', 0, r.move.ate, r.move.steps, r.move.end, r.move.log, 0, R.munTarget(sq.mini)]);
  assert.deepEqual(g.ate, r.sim.ate); assert.deepEqual(g.at, { X: r.move.ate, O: 0 });
  const full = R.flashMs(f, 4, false);
  assert.equal(full, R.munMs(g) + R.MUN.hold, 'the server (no view): the run, then the result');
  R.MUN_VIEW.own = () => true;
  assert.equal(R.flashMs(f, 4, false), R.MUN.hold, 'the mover\'s own phone: the result alone');
  assert.equal(R.flashMs(f, 4, true), R.MUN.hold + R.MUN.won);
  R.MUN_VIEW.own = null;
  assert.equal(R.flashMs({ type: 'muncher', mun: { auto: true, by: 'X', from: 0, to: 0 } }, 4, false), R.MUN.hold, 'a timed-out run: no replay');
});
