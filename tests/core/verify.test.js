'use strict';
// What the server holds a phone's move to beyond the game's rules (core/verify.js onlineCheck; security review F3):
// never a timeout of the phone's making, a run with its inputs and no longer than the turn, an attempt after Start
// with its inputs and no longer than the time since, an attention game's answer after Start and in time (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const T = 1700000000000;
test('verify: a timeout move from a phone is refused for every game but Odd One Out (whose pick timer only counts against the sender)', () => {
  for (const t of E.TYPES) {
    const m = E.newMini(t, E.makeRng('v' + t));
    const r = E.onlineCheck(m, 'X', 'auto', T, T - 5000);
    if (E.AUTO_FROM_PHONE.includes(t)) assert.equal(r, null, `${t}: its own 'auto'`); else assert.deepEqual(r, { why: 'auto' }, `${t}: no 'auto' from a phone`);
  }
  assert.deepEqual(E.AUTO_FROM_PHONE, ['oddone']);
  assert.deepEqual(E.onlineCheck(null, 'X', 1, T, null), { why: 'bad' });
  assert.equal(E.onlineCheck(E.newMini('ttt', E.makeRng('t')), 'X', 4, T, T - 1000), null, 'any other game: the rules alone');
});
test('verify: a run carries its input log and is no longer than the turn or round has lasted (plus the slack)', () => {
  for (const t of E.RUN_TYPES) {
    const m = E.newMini(t, E.makeRng('r' + t)), real = E.runAi(m, 'X', E.makeRng('ai' + t)).move;
    assert.ok(typeof real.log === 'string', `${t}: the computer's run has a log`);
    assert.deepEqual(E.onlineCheck(m, 'X', { dist: real.dist, ms: real.ms }, T, T - real.ms - 1000), { why: 'log' }, `${t}: a run without its log`);
    assert.deepEqual(E.onlineCheck(m, 'X', 'x', T, T - 60000), { why: 'bad' });
    assert.equal(E.onlineCheck(m, 'X', real, T, T - real.ms - 1000), null, `${t}: the run, in the time the turn has lasted`);
    assert.equal(E.onlineCheck(m, 'X', real, T, T - real.ms + E.RUN.clockSlackMs - 1), null, 'within the slack');
    assert.deepEqual(E.onlineCheck(m, 'X', real, T, T - real.ms + E.RUN.clockSlackMs + 1), { why: 'fast' }, `${t}: longer than the turn has lasted`);
    assert.deepEqual(E.onlineCheck(m, 'X', real, T, T), { why: 'fast' }, 'the turn just begun');
    assert.equal(E.onlineCheck(m, 'X', real, T, null), null, 'no clock (a friend room without a timer): the log alone');
  }
});
test('verify: a timed run (Muncher, Star Swarm, Brick Break, Snake) carries its inputs and, by its steps, is no longer than the turn or round has lasted (plus the slack); no server Start, the turn\'s start is its clock', () => {
  assert.deepEqual(E.TIMED_RUN_TYPES, ['muncher', 'swarm', 'bricks', 'snake']);
  for (const t of E.TIMED_RUN_TYPES) {
    assert.ok(!E.RUN_TYPES.includes(t) && !E.FINGER_TYPES.includes(t) && !E.ATT_TYPES.includes(t), `${t}: its own kind`);
    const m = E.newMini(t, E.makeRng('tr' + t)), rng = E.makeRng('ai' + t);
    const real = t === 'muncher' ? E.munPilot(m, 'X', rng, E.MUN_HANDS.normal).move
      : t === 'swarm' ? E.swarmAi(m, 'X', rng, 'normal').move
        : t === 'bricks' ? E.brkAi(m, 'X', rng, E.brkHand(m, 'normal')).move
          : E.snakeAi(m, 'X', rng, E.snakeHand(m, 'normal')).move;
    assert.ok(typeof real.log === 'string', `${t}: the computer's run has a log`);
    const ms = E.timedRunMs(m, 'X', real);
    const want = t === 'muncher' ? Math.round(real.steps * 1000 / E.MUN.hz) : t === 'swarm' ? Math.round(real.steps * E.SW.step * 1000) : t === 'bricks' ? Math.round(real.steps * E.BRK.step * 1000) : E.snakeCheck(m, 'X', real).sim.ms;
    assert.equal(ms, want, `${t}: the run's length from its steps and the game's step`);
    assert.ok(ms > 500 && ms <= 60000, `${t}: a real run's length (${ms} ms)`);
    const noLog = Object.assign({}, real); delete noLog.log;
    assert.deepEqual(E.onlineCheck(m, 'X', noLog, T, T - ms - 1000), { why: 'log' }, `${t}: a run without its log`);
    assert.deepEqual(E.onlineCheck(m, 'X', Object.assign({}, real, { log: 7 }), T, T - ms - 1000), { why: 'log' }, `${t}: a log that is not one`);
    assert.deepEqual(E.onlineCheck(m, 'X', 'x', T, T - 60000), { why: 'bad' });
    assert.deepEqual(E.onlineCheck(m, 'X', 'auto', T, T - 60000), { why: 'auto' }, `${t}: no timeout from a phone`);
    assert.equal(E.onlineCheck(m, 'X', real, T, T - ms - 1000), null, `${t}: the run, in the time the turn has lasted`);
    assert.equal(E.onlineCheck(m, 'X', real, T, T - ms + E.RUN.clockSlackMs - 1), null, 'within the slack');
    assert.deepEqual(E.onlineCheck(m, 'X', real, T, T - ms + E.RUN.clockSlackMs + 1), { why: 'fast' }, `${t}: longer than the turn has lasted`);
    assert.deepEqual(E.onlineCheck(m, 'X', real, T, T), { why: 'fast' }, 'the turn just begun');
    assert.equal(E.onlineCheck(m, 'X', real, T, null), null, 'no clock (a friend room without a timer): the log alone');
    assert.equal(m.started, undefined, `${t}: no server Start to wait for`);
    const r = E.applyMove(m, 'X', real, E.makeRng('a'));
    assert.equal(r.ok, true, `${t}: the run goes in by the rules`);
  }
  // Snake's ticks shrink with every apple of the run: its length is the ticks played through, not ticks times the first tick
  const sm = E.newMini('snake', E.makeRng('tr-snake2')), sr = E.snakeAi(sm, 'X', E.makeRng('ai-snake2'), E.snakeHand(sm, 'normal')).move;
  const sim = E.snakeCheck(sm, 'X', sr).sim;
  assert.equal(E.timedRunMs(sm, 'X', sr), sim.ms);
  if (sim.eaten > 0) assert.ok(sim.ms < sr.ticks * E.tune(sm).tick, 'shorter than the ticks at the first length');
  assert.equal(E.timedRunMs(sm, 'X', { log: 'zz', ticks: 10, n: 0, end: 'wall' }), Math.round(10 * E.tune(sm).minTick), 'a run that does not play: its ticks at the shortest tick (apply refuses it)');
});
test('verify: an attempt comes after Start (the server\'s stamp), with its inputs, and lasts no longer than the time since Start; Pinball\'s inputs are its log too', () => {
  for (const t of E.FINGER_TYPES) {
    const m = E.newMini(t, E.makeRng('f' + t));
    const real = t === 'pinball' ? (() => { const a = E.PHYSICS.lib.pinAi(E.PHYSICS.lib.pinTable(m), m.cfg, m.lit.X, E.makeRng('p')); return { hits: a.result.hits, ms: a.result.ms, end: a.result.end, log: a.log, steps: a.steps }; })() : E.fingAi(m, 'X', E.makeRng('ai' + t));
    const ms = t === 'pinball' ? (real.steps / E.PHYSICS.lib.PIN.hz) * 1000 : real.steps * E.FING.step * 1000;
    assert.deepEqual(E.onlineCheck(m, 'X', real, T, T - 60000), { why: 'start' }, `${t}: no Start`);
    assert.deepEqual(E.onlineCheck(m, 'X', { fing: true }, T, null), { why: 'bad' }, 'the computer\'s placeholder');
    const st = { squares: [{ owner: null, mini: m }], turn: 'X', lock: null, winner: null };
    assert.equal(E.attStart(st, 0, 'X', T - ms - 500).ok, true); assert.equal(m.started.X, T - ms - 500);
    assert.equal(E.attStart(st, 0, 'X', T).ok, true); assert.equal(m.started.X, T - ms - 500, 'a Start again keeps the first stamp (the same clock)');
    assert.equal(E.onlineCheck(m, 'X', real, T, null), null, `${t}: the attempt, after Start, in the time since`);
    m.started.X = T - ms + E.FING.slackMs + 1;
    assert.deepEqual(E.onlineCheck(m, 'X', real, T, null), { why: 'fast' }, `${t}: longer than the time since Start`);
    m.started.X = T - 60000;
    if (t === 'pinball') { const noLog = { hits: real.hits, ms: real.ms, end: real.end, rec: 'x' }; assert.deepEqual(E.onlineCheck(m, 'X', noLog, T, null), { why: 'log' }, 'Pinball: a recording is no proof, the inputs are'); }
    const r = E.applyMove(m, 'X', real, E.makeRng('a'));
    assert.equal(r.ok, true); assert.equal(m.started.X, null, `${t}: the attempt in, the next needs its own Start`);
  }
});
test('verify: an attention game\'s answer comes after Start and within the round\'s time plus the answer window, else it counts as out of time (a wrong answer)', () => {
  for (const t of E.ATT_TYPES) {
    const m = E.newMini(t, E.makeRng('a' + t)), truth = E.attTruth(t, m.round.X);
    assert.deepEqual(E.onlineCheck(m, 'X', truth, T, null), { why: 'start' }, `${t}: no Start`);
    const st = { squares: [{ owner: null, mini: m }], turn: 'X', lock: null, winner: null };
    assert.equal(E.attStart(st, 0, 'X', T).ok, true);
    const len = E.attMs(t, m.round.X), win = E.ATT.answerMs[t];
    assert.equal(E.onlineCheck(m, 'X', truth, T + len + win, null), null, `${t}: in time`);
    assert.equal(E.onlineCheck(m, 'X', truth, T + len + win + E.ATT.slackMs, null), null, 'within the slack');
    assert.deepEqual(E.onlineCheck(m, 'X', truth, T + len + win + E.ATT.slackMs + 1, null), { why: null, move: 'auto' }, `${t}: too late: out of time`);
    const r = E.applyMove(m, 'X', 'auto', E.makeRng('z'));
    assert.deepEqual([r.ok, m.last.answer, m.last.correct, m.started.X], [true, null, false, null], `${t}: out of time is a wrong answer; the next round needs its own Start`);
  }
});
