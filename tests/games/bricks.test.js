'use strict';
// Brick Break: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/bricks/rules.js');
const A = require('../../src/games/bricks/ai.js');
const M = require('../../src/games/bricks/meta.js');
const { timeoutClose } = require('../../src/core/board.js');
const { onlineCheck } = require('../../src/core/verify.js');
E.setPhysics(require('../physics.js'));
const clone = v => JSON.parse(JSON.stringify(v));
const mini = seed => E.newMini('bricks', E.makeRng('brk-' + (seed || 1)));
const go = (m, p, seed, level) => R.brkAi(m, p, E.makeRng('go-' + seed), R.brkHand(m, level || 'normal'));

/* ===================================== Brick Break ===================================== */
test('bricks: a square deals one 5x7 wall for each player, both whole, no goes taken, its serves seeded', () => {
  const m = mini();
  assert.equal(m.type, 'bricks'); assert.equal(m.wall.X.length, 35); assert.equal(m.wall.O.length, 35);
  assert.ok(m.wall.X.every(b => b === 1) && m.wall.O.every(b => b === 1));
  assert.deepEqual(m.tries, { X: 0, O: 0 }); assert.equal(m.last, null);
  assert.equal(m.seed.X, m.seed.O); assert.ok(Number.isInteger(m.seed.X));
  assert.equal(R.brkTotal(m), 35); assert.equal(R.brkLeft(m, 'X'), 35); assert.equal(R.brkBroken(m, 'O'), 0);
  assert.deepEqual(R.brkCfg(m), Object.fromEntries(M.TUNE.map(f => [f.k, f.def])), 'dealt with the defaults');
  assert.equal(E.canMove(m, 'X'), true);
});
test('bricks: the serve is the same for the same square, player and go, and differs between them', () => {
  const m = mini(3), a = R.brkServe(m, 'X'), b = R.brkServe(clone(m), 'X');
  assert.equal(a, b);
  assert.ok(Math.abs(a) >= R.BRK.serve[0] * Math.PI / 180 - 1e-9 && Math.abs(a) <= R.BRK.serve[1] * Math.PI / 180 + 1e-9, 'within the serve angles');
  const seen = new Set();
  for (let k = 0; k < 8; k++) for (const p of ['X', 'O']) seen.add(R.brkServe(m, p, k).toFixed(6));
  assert.ok(seen.size > 8, 'different goes, different serves');
  const sim = R.brkStart(m, 'X');
  for (let n = 0; n < 200; n++) { R.brkStep(sim, null); if (sim.last === 'serve') break; }
  assert.equal(sim.last, 'serve'); assert.ok(sim.vy > 0 && Math.abs(sim.t - R.BRK.grace) < 0.02, 'served upward once the grace is up');
});
test('bricks: the same inputs give the same go (the phone, the server, a replay), step for step, and it passes the check', () => {
  for (let s = 0; s < 10; s++) {
    const m = mini(100 + s), r = go(m, 'X', s);
    const log = R.brkUnlog(r.move.log, r.move.steps);
    assert.ok(log, 'the inputs read back');
    const a = R.brkReplay(m, 'X', log, r.move.steps), b = R.brkReplay(clone(m), 'X', log, r.move.steps);
    assert.deepEqual([a.n, a.x, a.y, a.broke, a.end], [r.sim.n, r.sim.x, r.sim.y, r.sim.broke, r.sim.end], 'the replay ends exactly where the go did');
    assert.deepEqual([b.n, b.x, b.y, b.broke], [a.n, a.x, a.y, a.broke]);
    assert.equal(R.brkCheck(m, 'X', r.move).why, null);
  }
});
test('bricks: a go that is not as said is refused: a wrong count, a wrong end, extra steps, a bad log, too long', () => {
  const m = mini(7), r = go(m, 'X', 7), mv = r.move;
  assert.equal(E.applyMove(clone(m), 'X', Object.assign({}, mv, { n: mv.n + 1 }), E.makeRng('x')).reason, 'replay');
  assert.equal(E.applyMove(clone(m), 'X', Object.assign({}, mv, { end: mv.end === 'miss' ? 'out' : 'miss' }), E.makeRng('x')).reason, 'replay');
  assert.equal(E.applyMove(clone(m), 'X', Object.assign({}, mv, { steps: mv.steps + 5 }), E.makeRng('x')).reason, 'replay');
  assert.equal(E.applyMove(clone(m), 'X', Object.assign({}, mv, { log: 'zz' }), E.makeRng('x')).reason, 'bad');
  assert.equal(E.applyMove(clone(m), 'X', Object.assign({}, mv, { steps: R.brkMaxSteps(R.brkCfg(m)) + 1 }), E.makeRng('x')).reason, 'bad');
  for (const bad of [null, 'roll', 5, { fing: true }, { log: mv.log }, ['x']]) assert.equal(E.applyMove(clone(m), 'X', bad, E.makeRng('x')).ok, false);
  assert.equal(E.applyMove(clone(m), 'X', mv, E.makeRng('x')).ok, true, 'as sent: taken');
});
test('bricks: a go breaks bricks off that player\'s wall only, which stay broken; the goes count; the words note the gain', () => {
  const m = mini(11), r = go(m, 'X', 11), res = E.applyMove(m, 'X', r.move, E.makeRng('a'));
  assert.equal(res.ok, true); assert.equal(res.outcome, 'continue');
  assert.equal(R.brkBroken(m, 'X'), r.move.n); assert.equal(R.brkBroken(m, 'O'), 0);
  assert.ok(r.move.n > 0, 'the hand breaks something from a fresh wall');
  assert.equal(res.note, 'up');
  assert.deepEqual(m.tries, { X: 1, O: 0 });
  assert.equal(m.last.by, 'X'); assert.equal(m.last.from, 0); assert.equal(m.last.to, r.move.n); assert.equal(m.last.try, 0); assert.deepEqual(m.last.broke, r.sim.broke); assert.equal(m.last.log, r.move.log);
  for (const k of r.sim.broke) assert.equal(m.wall.X[k], 0);
  const before = m.wall.X.slice(), r2 = go(m, 'X', 12), res2 = E.applyMove(m, 'X', r2.move, E.makeRng('b'));
  assert.equal(res2.ok, true);
  for (let k = 0; k < 35; k++) if (!before[k]) assert.equal(m.wall.X[k], 0, 'a broken brick stays broken');
  assert.equal(R.brkBroken(m, 'X'), r.move.n + r2.move.n);
  const pv = E.publicMini(m);
  assert.equal(pv.last.log, undefined, 'the inputs do not ride the square'); assert.deepEqual(pv.wall, m.wall);
});
test('bricks: the wall cleared wins the square; a timed-out go (auto) changes nothing but counts the go', () => {
  const m = mini(21);
  m.wall.X = m.wall.X.map((b, k) => (k < 34 ? 0 : 1));                // one brick left for X
  let won = null;
  for (let s = 0; s < 12 && !won; s++) { const mm = clone(m), r = go(mm, 'X', 200 + s, 'hard'), res = E.applyMove(mm, 'X', r.move, E.makeRng('w')); if (res.outcome === 'win') { won = { res, mm, r }; } }
  assert.ok(won, 'the last brick goes within a few goes');
  assert.equal(won.res.note, 'clear'); assert.equal(won.r.move.end, 'clear'); assert.equal(R.brkLeft(won.mm, 'X'), 0);
  assert.equal(R.brkLeft(won.mm, 'O'), 35, 'O\'s wall untouched');
  const t = clone(m), res = E.applyMove(t, 'X', 'auto', E.makeRng('t'));
  assert.deepEqual([res.ok, res.outcome, res.note], [true, 'continue', 'out']);
  assert.deepEqual(t.wall, m.wall); assert.equal(t.tries.X, 1); assert.equal(t.last.auto, true);
  assert.equal(timeoutClose(m, 'X'), null, 'a go under way when the time runs out: nothing more is played (the turn passes, not a miss; the go is not sent)');
});
test('bricks: the moves ride the flash for the other phone: the inputs, the bricks broken, the result; its length', () => {
  const m = mini(31), r = go(m, 'O', 31), st = { squares: [{ owner: null, mini: m }] };
  E.applyMove(m, 'O', r.move, E.makeRng('f'));
  const flash = { kind: 'move', by: 'O', next: 'O', square: 0, type: 'bricks', note: 'up', pass: null, timeout: false };
  R.moveFlash(r.move, 'O', null, 0, m, flash);
  assert.equal(flash.brk.by, 'O'); assert.equal(flash.brk.log, r.move.log); assert.deepEqual(flash.brk.broke, r.sim.broke); assert.equal(flash.brk.total, 35); assert.deepEqual(flash.brk.at, { X: 0, O: r.move.n });
  assert.equal(R.flashMs(flash, 4, false), R.brkMs(flash.brk) + R.BRK.end[r.move.end] + 500, 'the replay, its end, then the result');
  assert.equal(R.brkRaw(flash.brk), Math.round(r.move.steps * R.BRK.step * 1000));
  assert.equal(R.flashMs({ type: 'bricks', timeout: true, brk: { auto: true } }, 4, false), 500);
  assert.equal(E.repMove(r.move), undefined, 'the move is its inputs: never pressed as a control');
  void st;
});
test('bricks: online the server\'s check holds a go to its inputs and to the time the turn has lasted (core/verify.js TIMED_RUN_TYPES), then the rules play it through again; no auto from a phone', () => {
  const m = mini(41), r = go(m, 'X', 41), ms = E.timedRunMs(m, 'X', r.move);
  assert.equal(ms, Math.round(r.move.steps * R.BRK.step * 1000));
  assert.equal(onlineCheck(m, 'X', r.move, ms + 1000, 0), null, 'a go within the turn');
  assert.deepEqual(onlineCheck(m, 'X', r.move, 1000, 0), { why: 'fast' }, 'a go longer than the turn has lasted');
  assert.deepEqual(onlineCheck(m, 'X', { steps: r.move.steps, n: r.move.n, end: r.move.end }, ms + 1000, 0), { why: 'log' }, 'a go without its inputs');
  assert.deepEqual(onlineCheck(m, 'X', 'auto', 1000, 0), { why: 'auto' });
});
test('bricks: the computer: Hard breaks more than Normal, Normal more than Easy; its move applies; needs falls as the wall goes', () => {
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length, n = { easy: [], normal: [], hard: [] };
  for (let s = 0; s < 16; s++) for (const level of ['easy', 'normal', 'hard']) n[level].push(go(mini(300 + s), 'X', 300 + s, level).move.n);
  assert.ok(avg(n.hard) > avg(n.normal) && avg(n.normal) > avg(n.easy), `hard ${avg(n.hard)} > normal ${avg(n.normal)} > easy ${avg(n.easy)}`);
  const m = mini(51), pm = E.publicMini(m);
  for (const level of ['easy', 'normal', 'hard']) {
    const b = A.best(pm, 'X', E.makeRng('b' + level), {}, { level });
    assert.ok(b.move && typeof b.move.log === 'string' && b.q > 0);
    assert.equal(E.applyMove(clone(m), 'X', b.move, E.makeRng('c')).ok, true, 'from the public square: the same go the full one takes');
  }
  assert.equal(A.needs(pm, 'X'), 35 / A.BRK_GAIN);
  const half = clone(m); half.wall.X = half.wall.X.map((b, k) => (k % 2 ? 0 : 1));
  assert.ok(A.needs(half, 'X') < A.needs(m, 'X'));
  assert.equal(A.needs({ type: 'bricks', wall: { X: [0, 0, 1], O: [1, 1, 1] } }, 'X'), 1);
  const r = E.randomLegalMove(m, 'X', E.makeRng('r'));
  assert.equal(E.applyMove(clone(m), 'X', r, E.makeRng('r2')).ok, true, 'a careless go is still a go');
});
test('bricks: the ball never leaves the field, never skims level for ever, and a go ends by a miss, the wall cleared or the time', () => {
  for (let s = 0; s < 6; s++) {
    const m = mini(400 + s), sim = R.brkStart(m, 'X'), cfg = R.brkCfg(m);
    while (!sim.end) {
      R.brkStep(sim, 5 + 4 * Math.sin(sim.t * 0.7));
      assert.ok(sim.x >= R.BRK.r - 1e-9 && sim.x <= R.BRK.w - R.BRK.r + 1e-9 && sim.y <= R.BRK.h - R.BRK.r + 1e-9);
      if (sim.flying) assert.ok(Math.abs(sim.vy) >= R.brkSpeed(cfg, sim.t) * 0.18 - 1e-9, 'never level');
    }
    assert.ok(['miss', 'clear', 'out'].includes(sim.end));
    assert.ok(sim.t <= cfg.runSecs + R.BRK.step * 2);
  }
});
test('bricks: its settings (TUNE) are dealt into the square: the wall\'s size, the ball, the paddle, the computer\'s hand', () => {
  E.setTune('bricks', { rows: 3, cols: 4, speed: 10, paddle: 3, runSecs: 12, aiReact0: 50, aiReact1: 50, aiAim: 0, aiLapse: 0 });
  const m = E.newMini('bricks', E.makeRng('tune'));
  E.setTune('bricks', null);
  assert.equal(m.wall.X.length, 12); assert.equal(R.brkCfg(m).speed, 10); assert.equal(R.brkStart(m, 'X').half, 1.5);
  assert.deepEqual(R.brkHand(m, 'normal'), { react: [0.05, 0.05], aim: 0, lapse: 0, steer: false });
  const r = go(m, 'X', 1, 'hard'), res = E.applyMove(m, 'X', r.move, E.makeRng('t'));
  assert.equal(res.ok, true); assert.ok(r.move.steps * R.BRK.step <= 12 + 0.1);
  assert.equal(R.brkMaxSteps(R.brkCfg(m)), 12 * 120 + R.BRK.slackSteps);
});
test('bricks: meta: admin only, 1.5.0, a 60 s turn, real time, not in Super Chaos, the explainer in the house format', () => {
  assert.equal(M.release, 'admin'); assert.equal(M.minVersion, '1.5.0'); assert.equal(M.turnSecs, 60); assert.equal(M.realTime, true); assert.equal(M.superChaos, false); assert.equal(M.category, 'skill');
  assert.ok(M.explainer.name && M.explainer.play && M.explainer.win);
  assert.ok(E.TEST_TYPES.includes('bricks') && E.TYPES.includes('bricks'));
});
