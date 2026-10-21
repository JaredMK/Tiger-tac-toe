'use strict';
// What the attention games (Headcount, Flash, Snapshot) share, tested once for all of them (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== the rules ===================================== */
test('attention games: one round a move; right moves the player on a level, wrong does not; a fresh round each time; out of time counts as wrong; first to 3 right wins', () => {
  for (const type of E.ATT_TYPES) {
    const m = E.newMini(type, lcg(3));
    assert.deepEqual(m.right, { X: 0, O: 0 }); assert.equal(m.round.X.level, 0); assert.equal(m.round.O.level, 0);
    for (const bad of ['x', -1, null, type === 'snapshot' ? [99] : 100, type === 'snapshot' ? [0, 0] : 1.5]) assert.equal(E.applyMove(m, 'X', bad, lcg(1)).ok, false, `${type}: ${JSON.stringify(bad)} refused`);
    const r0 = m.round.X;
    let res = E.applyMove(m, 'X', E.attWrong(type, r0, lcg(2)), lcg(4));
    assert.deepEqual([res.ok, res.outcome, res.note, m.right.X, m.last.correct], [true, 'continue', 'wrong', 0, false], `${type}: wrong, no progress`);
    assert.deepEqual(m.last.truth, E.attTruth(type, r0), 'the right answer, for the result'); assert.notDeepEqual(m.round.X, r0, 'a fresh round'); assert.equal(m.round.X.level, 0);
    res = E.applyMove(m, 'X', 'auto', lcg(5));
    assert.deepEqual([res.ok, m.last.correct, m.last.answer, m.right.X], [true, false, null, 0], `${type}: out of time is wrong`);
    for (let k = 1; k <= 3; k++) {
      const lv = m.round.X.level;
      res = E.applyMove(m, 'X', E.attTruth(type, m.round.X), lcg(10 + k));
      assert.equal(m.last.correct, true); assert.equal(m.right.X, k); assert.equal(m.last.level, lv);
      if (k < 3) { assert.equal(res.outcome, 'continue'); assert.equal(m.round.X.level, k, 'the next level'); }
    }
    assert.equal(res.outcome, 'win'); assert.equal(m.right.O, 0, 'each player\'s own progress');
    assert.equal(E.randomLegalMove(E.newMini(type, lcg(6)), 'X', lcg(7)), 'auto');
  }
});

test('attention games: Start holds the player to the square (online too); a timeout then answers that round, wrong; the answer counts as the turn\'s move', () => {
  for (const type of E.ATT_TYPES) {
    const st = E.newMatch(lcg(21), { games: [type] });
    st.turn = 'X'; st.lock = null;
    const i = 4, j = 2, r0 = st.squares[i].mini.round.X;
    assert.equal(E.attStart(st, i, 'O').reason, 'turn', 'not the other player');
    assert.equal(E.attStart(st, i, 'X').ok, true); assert.equal(st.lock, i);
    assert.equal(E.attStart(st, j, 'X').reason, 'locked', 'no other round once started');
    assert.equal(E.playMove(st, j, E.attTruth(type, st.squares[j].mini.round.X), lcg(22)).reason, 'locked', 'no move anywhere else');
    st.timer = E.newTimer(60);
    const t = E.timeoutMove(st, lcg(23));
    assert.deepEqual([t.ok, t.square], [true, i], `${type}: out of time, in the square started`);
    assert.deepEqual([st.squares[i].mini.last.answer, st.squares[i].mini.last.correct, st.squares[i].mini.right.X], [null, false, 0], 'wrong');
    assert.deepEqual(st.squares[i].mini.last.round, r0, 'the round started');
    assert.deepEqual(st.squares[i].mv, { X: 1, O: 0 }, 'counted as the turn\'s move');
    E.endFlash(st); assert.equal(st.lock, null); assert.equal(st.turn, 'O');
    // online: Start through the server, then the timeout
    const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: Object.fromEntries(E.TYPES.map(g => [g, g === type])), timer: E.normTimer(60) }, lcg(24), 'g');
    const turn = rec.state.turn, k = 6;
    assert.equal(E.applyOnlineStart(rec, E.other(turn), k).ok, false);
    const s1 = E.applyOnlineStart(rec, turn, k);
    assert.equal(s1.ok, true); assert.equal(s1.rec.state.lock, k);
    const to = E.applyOnlineTimeout(s1.rec, lcg(25));
    assert.equal(to.ok, true); assert.equal(to.entries[0].square, k, 'the timeout answers the round started');
    assert.deepEqual([to.rec.state.squares[k].mini.last.correct, to.rec.state.squares[k].mini.last.answer, to.rec.state.lock], [false, null, null]);
  }
});

test('attention games: the move\'s playback (someone else\'s round at full length, their answer, the result); the timed-out turn skips the round; dealt in a match and played to the end by the computer', () => {
  for (const type of E.ATT_TYPES) {
    const st = E.newMatch(lcg(8), { games: [type] });
    const i = st.squares.findIndex(q => q.mini.type === type), r = st.squares[i].mini.round.X;
    E.playMove(st, i, E.attTruth(type, r), lcg(9));
    assert.deepEqual([st.flash.att.correct, st.flash.att.truth, st.flash.att.right.X], [true, E.attTruth(type, r), 1]);
    assert.equal(E.playMs(st.flash), E.attMs(type, r) + E.ATT.pause + E.ATT.show, `${type}: the round, a pause, the result`);
    E.endFlash(st);
    st.timer = E.newTimer(60); const t = E.timeoutMove(st, lcg(10));
    assert.equal(t.ok, true); assert.equal(st.flash.att.correct, false); assert.equal(E.playMs(st.flash), E.ATT.show, 'timed out: no round to replay');
    // the computer against itself
    const m = E.newMatch(lcg(20), { games: [type] }), ra = lcg(30), rb = lcg(40); let n = 0;   // (one stream each: a fresh lcg's first draw is never below 0.23, so the computer would never hit a 20% chance)
    while (!m.winner && n++ < 600) { if (m.flash) E.endFlash(m); if (m.winner) break; const c = E.cpuMove(m, ra); const res = E.playMove(m, c.square, c.move, rb); assert.equal(res.ok, true, `${type}: ${JSON.stringify(c.move)}`); }
    assert.ok(m.winner, `${type}: a match of it played to the end (${n} moves)`);
  }
});

test('attention games: the admin\'s values, checked one by one (off its range: the default); new rounds by them', () => {
  E.setHeadConfig({ n1lo: 3, n1hi: 3, cross1: 99999, gap1: 'x' });
  assert.equal(E.headConfig().n1lo, 3); assert.equal(E.headConfig().cross1, E.HEAD_DEFAULTS.cross1); assert.equal(E.headConfig().gap1, E.HEAD_DEFAULTS.gap1);
  assert.equal(E.attTruth('headcount', E.headRound(0, lcg(1))), 3, 'three to count, as set');
  E.setHeadConfig({ n2lo: 9, n2hi: 4 }); assert.ok(E.headConfig().n2hi >= E.headConfig().n2lo, 'a range kept the right way round');
  E.setHeadConfig(null);
  E.setFlashConfig({ ms1: 700, n1: 10 }); const f = E.flashRound(0, lcg(2)); assert.deepEqual([f.ms, f.items.length], [700, 10]); E.setFlashConfig(null);
  E.setSnapConfig({ c1: 3, r1: 3, k1: 20, show: 3000, wait: 0 }); const s = E.snapRound(0, lcg(3)); assert.deepEqual([s.c, s.r, s.cells.length, s.show, s.wait], [3, 3, 7, 3000, 0], 'never more cells than the grid allows; no countdown, as set'); E.setSnapConfig(null);
  assert.deepEqual(E.snapConfig(), E.SNAP_DEFAULTS);
  assert.ok(E.TEST_TYPES.includes('headcount') && E.TEST_TYPES.includes('flash') && E.TEST_TYPES.includes('snapshot'), 'admin only to begin with');
});

test('headcount, snapshot: the admin\'s Mini-game Settings deal a square the computer plays by (its right answers at each level)', () => {
  for (const type of ['headcount', 'snapshot']) {
    E.setTune(type, { ai1: 100, ai3: 0 });
    const m = E.newMini(type, lcg(5));
    E.setTune(type, null);
    const rng = lcg(6);
    assert.deepEqual(E.localBest(E.publicMini(m), 'X', rng).move, E.attTruth(type, m.round.X), `${type}: level 1, always right`);
    m.right.X = 2; m.round.X = E.attRound(type, 2, lcg(7));
    for (let k = 0; k < 10; k++) assert.notDeepEqual(E.localBest(E.publicMini(m), 'X', rng).move, E.attTruth(type, m.round.X), `${type}: level 3, never right`);
  }
});
