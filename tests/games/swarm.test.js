'use strict';
// Star Swarm: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/swarm/rules.js');
const A = require('../../src/games/swarm/ai.js');
const M = require('../../src/games/swarm/meta.js');
const { timeoutClose } = require('../../src/core/board.js');
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const mini = (seed, n0, tune) => Object.assign({ type: 'swarm', seed: { X: seed, O: seed }, score: { X: n0 || 0, O: 0 }, tries: { X: 0, O: 0 }, last: null }, tune ? { tune } : {});
const cfg = () => E.tuneLive('swarm');

test('star swarm: the square as dealt (the registry, its meta, its settings)', () => {
  const m = E.newMini('swarm', E.makeRng('deal'));
  assert.equal(m.type, 'swarm'); assert.deepEqual(m.score, { X: 0, O: 0 }); assert.deepEqual(m.tries, { X: 0, O: 0 }); assert.equal(m.seed.X, m.seed.O);
  assert.equal(M.turnSecs, 60); assert.equal(M.realTime, true); assert.equal(M.category, 'skill'); assert.equal(M.superChaos, false); assert.equal(M.minVersion, '1.5.0'); assert.equal(M.release, 'admin');
  assert.ok(E.TYPES.includes('swarm')); assert.ok(E.TEST_TYPES.includes('swarm'), 'admin only by default');
  assert.equal(R.swarmGoal(m), cfg().target);
  assert.match(M.explainer.win, /\{target\}/, 'the explainer shows the target from TUNE');
});
test('star swarm: the same inputs give the same run (the phone, the server, a replay), step for step, and it passes the check', () => {
  for (let s = 0; s < 10; s++) {
    const m = mini(100 + s, s * 7), r = R.swarmAi(m, 'X', E.makeRng('d' + s), s % 2 ? 'hard' : 'normal');
    const log = E.fingUnlog(r.move.log, r.move.steps, Math.ceil(R.SW.w * R.SW.q));
    assert.ok(log, 'the inputs read back');
    const a = R.swarmReplay(m, 'X', log, r.move.steps), b = R.swarmReplay(JSON.parse(JSON.stringify(m)), 'X', log, r.move.steps);
    assert.deepEqual([a.n, a.x, a.kills, a.end, a.foes.length, a.shots.length], [r.sim.n, r.sim.x, r.sim.kills, r.sim.end, r.sim.foes.length, r.sim.shots.length], 'the replay ends exactly where the run did');
    assert.deepEqual([b.n, b.x, b.kills, b.end], [a.n, a.x, a.kills, a.end]);
    assert.equal(R.swarmCheck(m, 'X', r.move).why, null);
  }
});
test('star swarm: a run that does not match its inputs is refused (more points, a longer run, a different end, a bad log, too long)', () => {
  const m = mini(5), r = R.swarmAi(m, 'X', E.makeRng('t'), 'normal'), mv = r.move;
  assert.equal(R.swarmCheck(m, 'X', Object.assign({}, mv, { n: mv.n + 1 })).why, 'replay');
  assert.equal(R.swarmCheck(m, 'X', Object.assign({}, mv, { steps: mv.steps + 5 })).why, 'replay');
  assert.equal(R.swarmCheck(m, 'X', Object.assign({}, mv, { end: mv.end === 'hit' ? 'out' : 'hit' })).why, 'replay');
  assert.equal(R.swarmCheck(m, 'X', Object.assign({}, mv, { log: 'nonsense!' })).why, 'bad');
  assert.equal(R.swarmCheck(m, 'X', Object.assign({}, mv, { steps: R.swarmMaxSteps(cfg()) + 1 })).why, 'bad');
  assert.equal(R.swarmCheck(m, 'X', 'auto').why, 'bad'); assert.equal(R.swarmCheck(m, 'X', null).why, 'bad');
  assert.deepEqual(E.onlineCheck(m, 'X', 'auto', 1000, 0), { why: 'auto' }, 'no timeout from a phone');
  assert.equal(E.applyMove(m, 'X', Object.assign({}, mv, { n: mv.n + 1 })).ok, false);
});
test('star swarm: a run adds its points to the total (capped at the target), a timed-out run adds nothing, the target wins', () => {
  const m = mini(9), r = R.swarmAi(m, 'X', E.makeRng('p'), 'hard');
  const res = E.applyMove(m, 'X', r.move);
  assert.equal(res.ok, true); assert.equal(m.score.X, Math.min(cfg().target, r.move.n)); assert.equal(m.tries.X, 1);
  assert.equal(m.last.by, 'X'); assert.equal(m.last.from, 0); assert.equal(m.last.to, m.score.X); assert.equal(m.last.n, r.move.n); assert.equal(m.last.try, 0); assert.equal(typeof m.last.log, 'string');
  assert.equal(res.outcome, m.score.X >= cfg().target ? 'win' : 'continue');
  const o = E.applyMove(m, 'O', 'auto');
  assert.deepEqual([o.ok, o.outcome, o.note, m.score.O, m.tries.O, m.last.auto], [true, 'continue', 'out', 0, 1, true]);
  assert.equal(timeoutClose(m, 'O'), null, 'a square only opened: a missed turn, nothing played for the player');
  const near = mini(12, cfg().target - 1), rn = R.swarmAi(near, 'X', E.makeRng('n'), 'normal');
  assert.equal(rn.move.end, 'top', 'one point away: the first burst ends the run at the target');
  const w = E.applyMove(near, 'X', rn.move);
  assert.deepEqual([w.ok, w.outcome, w.note, near.score.X], [true, 'win', 'top', cfg().target]);
  assert.equal(E.randomLegalMove(m, 'X', E.makeRng('r')), 'auto');
});
test('star swarm: the waves ramp (closer together and faster after the ramp), the darts and saucers come later, nothing for the grace', () => {
  const c = cfg(), eg = [], lg = [], ev = [], lv = [];
  for (let s = 0; s < 10; s++) {
    const w = R.swarmWaves(c, 'w' + s, s);
    assert.ok(w.length > 20 && w[0].T >= R.SW.grace, 'a run\'s worth of enemies, none in the grace');
    const early = w.filter(e => e.T < 2), late = w.filter(e => e.T > c.ramp + 2 && e.T < c.maxSecs);
    early.slice(1).forEach((e, i) => eg.push(e.T - early[i].T)); late.slice(1).forEach((e, i) => lg.push(e.T - late[i].T));
    early.forEach(e => ev.push(e.v)); late.forEach(e => lv.push(e.v));
    assert.ok(early.length >= 2 && early.every(e => e.k === 'drift'), 'jellies alone for the first 2 s'); assert.ok(w.every(e => e.k !== 'shooter' || e.T >= 6), 'no saucer before 6 s');
    assert.ok(late.some(e => e.k !== 'drift'), 'darts or saucers later on');
    for (const e of w) assert.ok(e.x0 >= R.SW.edge && e.x0 <= R.SW.w - R.SW.edge, 'inside the sky');
  }
  assert.ok(avg(lg) < avg(eg), 'closer together after the ramp'); assert.ok(avg(lv) > avg(ev), 'faster after the ramp');
  assert.deepEqual(R.swarmWaves(c, 'same', 1), R.swarmWaves(c, 'same', 1), 'the same seed and run: the same waves');
  assert.notDeepEqual(R.swarmWaves(c, 'same', 1), R.swarmWaves(c, 'same', 2), 'the next run: new waves');
});
test('star swarm: a hit ends the run (an enemy, or a bolt), a run never lasts past the cap, the ship stays inside the sky', () => {
  const ends = {}, hits = {};
  for (let s = 0; s < 30; s++) {
    const m = mini(300 + s, 0, { target: 300 }), r = R.swarmAi(m, 'X', E.makeRng('e' + s), s % 3 ? 'normal' : 'hard');
    ends[r.move.end] = (ends[r.move.end] || 0) + 1;
    if (r.sim.hit) hits[r.sim.hit.k] = (hits[r.sim.hit.k] || 0) + 1;
    assert.ok(r.move.steps <= R.swarmMaxSteps(r.sim.cfg)); assert.ok(r.sim.x >= R.SW.edge && r.sim.x <= R.SW.w - R.SW.edge);
    assert.ok(r.move.n >= 0 && r.sim.downed <= r.move.n);
  }
  assert.ok(ends.hit > 0, `runs end on a hit (${JSON.stringify(ends)})`);
  assert.ok(Object.keys(hits).length >= 2, `more than one kind of enemy gets the ship (${JSON.stringify(hits)})`);
  const still = R.swarmStart(mini(1), 'X');                        // a ship that never moves: an enemy gets it in the end, or the cap
  while (!still.end) R.swarmStep(still, null);
  assert.ok(still.end === 'hit' || still.end === 'out');
  assert.ok(still.t <= still.cfg.maxSecs + 1e-9);
});
test('star swarm: points by kind (jellies 1, darts 2, saucers 3), and the public view keeps the log back', () => {
  assert.deepEqual(R.SW_WORTH, { drift: 1, swoop: 2, shooter: 3 });
  const m = mini(21), r = R.swarmAi(m, 'X', E.makeRng('k'), 'hard');
  assert.equal(r.sim.ev.reduce((s, e) => s + e.w, 0), r.move.n, 'the bursts add up to the points');
  E.applyMove(m, 'X', r.move);
  const pub = E.publicMini(m);
  assert.equal(pub.last.log, undefined); assert.equal(pub.last.n, r.move.n); assert.equal(pub.score.X, m.score.X);
});
test('star swarm: the flash carries the run for the other phone (its length in flashMs), and the move\'s words', () => {
  const m = mini(33), r = R.swarmAi(m, 'X', E.makeRng('f'), 'normal');
  const st = E.newMatch(E.makeRng('st'), { games: ['swarm'] });
  st.squares[0].mini = m; st.turn = 'X';
  const res = E.playMove(st, 0, r.move, E.makeRng('pm'));
  assert.equal(res.ok, true);
  const f = st.flash;
  assert.equal(f.type, 'swarm'); assert.equal(f.swarm.log, r.move.log); assert.equal(f.swarm.steps, r.move.steps); assert.equal(f.swarm.goal, cfg().target); assert.equal(f.swarm.from, 0); assert.equal(f.swarm.try, 0);
  assert.equal(R.flashMs(f, 4, false), R.swarmMs(f.swarm) + R.SW.hold);
  assert.equal(R.swarmMs({ steps: 120 * 45 }), R.SW.replayMax, 'a long run replays faster, in 30 s at most');
  assert.equal(R.flashMs({ swarm: { auto: true } }, 4, false), R.SW.hold);
  assert.equal(R.flashMs({ swarm: f.swarm, timeout: true }, 4, true), R.SW.hold + 600);
});
test('star swarm: its settings (TUNE) are dealt into the square and read by the rules and the computer\'s hand', () => {
  E.setTune('swarm', { target: 12, maxSecs: 10, aiReact0: 100, aiReact1: 100, aiAim: 0, aiLapse: 0 });
  const m = E.newMini('swarm', E.makeRng('tune'));
  E.setTune('swarm', null);
  assert.deepEqual(m.tune, { target: 12, maxSecs: 10, aiReact0: 100, aiReact1: 100, aiAim: 0, aiLapse: 0 });
  assert.equal(R.swarmGoal(m), 12);
  assert.deepEqual(R.swarmHand(m, 'normal'), { react: [0.1, 0.1], aim: 0, lapse: 0, look: R.SW_HAND.normal.look, sway: false });
  assert.deepEqual(R.swarmHand(m, 'hard'), R.SW_HAND.hard);
  const r = R.swarmAi(m, 'X', E.makeRng('ai'), 'normal');
  assert.ok(r.move.steps <= 10 * 120, 'the run keeps to the square\'s cap');
  assert.equal(E.applyMove(m, 'X', r.move).ok, true);
});
test('star swarm: the computer (needs and best) at both levels, through the engine\'s cpuMove', () => {
  const pm = E.publicMini(mini(44));
  assert.equal(A.needs(pm, 'X'), Math.max(1, cfg().target / A.SW_GAIN));
  assert.equal(A.needs(E.publicMini(mini(44, cfg().target)), 'X'), 1);
  for (const level of ['normal', 'hard']) {
    const b = A.best(pm, 'X', E.makeRng('b' + level), {}, { level, until: null });
    assert.ok(b.move && typeof b.move.log === 'string' && b.q > 0 && b.q <= 1);
    assert.equal(R.swarmCheck(mini(44), 'X', b.move).why, null, 'the computer\'s run passes the check');
  }
  const st = E.newMatch(E.makeRng('cm'), { games: ['swarm'], players: { X: 'cpu', O: 'human' }, level: 'hard' });
  st.turn = 'X';
  const mv = E.cpuMove(st, E.makeRng('mv'), null, { level: 'hard' });
  assert.ok(mv && Number.isInteger(mv.square) && mv.move && mv.move.log != null);
  assert.equal(E.playMove(st, mv.square, mv.move, E.makeRng('pl')).ok, true);
});
