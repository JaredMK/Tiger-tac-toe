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
