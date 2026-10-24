'use strict';
// Pinball: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Pinball ===================================== */
const PIN = P.PIN;

test('pinball: every layout passes the layout check at every target size the settings allow (no two elements overlapping or within a unit, nothing outside the table, no pocket a ball can rest in, room for the ball at every spot): an overlap fails the build', () => {
  assert.ok(P.PIN_LAYOUTS.length >= 6, `at least six layouts (${P.PIN_LAYOUTS.length})`);
  for (let k = 0; k < P.PIN_LAYOUTS.length; k++) {
    assert.ok(P.PIN_LAYOUTS[k].spots.length >= E.PINB.targets + 3, `${P.PIN_LAYOUTS[k].name}: spots to deal from (${P.PIN_LAYOUTS[k].spots.length})`);
    for (const size of [E.PINB_LIMITS.size[0], E.PINB_LIMITS.size[1]]) {   // (the smallest and the largest: clearance shrinks with size, and a pocket a target makes shows at one or the other)
      const problems = P.pinLayoutCheck(P.pinAllSpots(k, Object.assign(E.pinConfig(), { size })));
      assert.deepEqual(problems, [], `${P.PIN_LAYOUTS[k].name} at size ${size}`);
    }
  }
  // the check itself: a rail laid across a bumper, and two rails making a wedge, are caught
  const tb = P.pinAllSpots(0, E.pinConfig()); tb.walls = tb.walls.concat([[tb.bumpers[0][0] - 8, tb.bumpers[0][1], tb.bumpers[0][0] + 8, tb.bumpers[0][1], 2.4]]);
  assert.ok(P.pinLayoutCheck(tb).some(x => /apart/.test(x)), 'an overlap is reported');
  const tw = P.pinAllSpots(0, E.pinConfig()); tw.walls = tw.walls.concat([[30, 90, 40, 100, 2.4], [50, 90, 40, 100, 2.4]]); tw.joints = tw.joints.concat([[40, 100, 1.2], [30, 90, 1.2], [50, 90, 1.2]]);
  assert.ok(P.pinLayoutCheck(tw).some(x => /can rest/.test(x)), 'a pocket is reported');
});
test('pinball: a square deals a layout at random and seven of its spots, no two the same; the dealt table passes the layout check; a square from before the layouts plays the classic table', () => {
  const seen = new Set(), spots = new Set();
  for (let s = 0; s < 150; s++) {
    const mini = E.newMini('pinball', E.makeRng('deal' + s));
    assert.ok(mini.table && Number.isInteger(mini.table.k) && mini.table.k >= 0 && mini.table.k < P.PIN_LAYOUTS.length, 'a layout');
    assert.equal(mini.table.t.length, E.PINB.targets); assert.equal(new Set(mini.table.t).size, E.PINB.targets, 'seven different spots');
    assert.ok(mini.table.t.every(i => P.PIN_LAYOUTS[mini.table.k].spots[i]), 'spots the layout has');
    assert.equal(mini.lit.X.length, E.PINB.targets);
    seen.add(mini.table.k); mini.table.t.forEach(i => spots.add(mini.table.k + ':' + i));
    const tb = P.pinTable(mini);
    assert.equal(tb.targets.length, E.PINB.targets);
    if (s < 12) assert.deepEqual(P.pinLayoutCheck(tb), [], `dealt table ${s} (${tb.name}) is sound`);
  }
  assert.equal(seen.size, P.PIN_LAYOUTS.length, `every layout comes up (${[...seen].sort().join(',')})`);
  assert.ok(spots.size > P.PIN_LAYOUTS.length * 8, 'the spots vary');
  const old = { type: 'pinball', cfg: E.pinConfig(), lit: { X: [0, 0, 0, 0, 0, 0, 0], O: [0, 0, 0, 0, 0, 0, 0] }, balls: { X: 0, O: 0 }, last: null };
  const tb = P.pinTable(old);
  assert.equal(tb.k, 0); assert.equal(tb.targets.length, 7); assert.deepEqual(tb.targets.map(t => t.name), P.PIN_CLASSIC.map(i => P.PIN_LAYOUTS[0].spots[i].name));
});

test('pinball: the move\'s checks — a real ball passes; a faked one (teleport, too fast, a hit far from its target, a hit already lit, a time that does not match) does not', () => {
  const mini = E.newMini('pinball', E.makeRng('chk')), TB = P.pinTable(mini), r = P.pinAi(TB, mini.cfg, mini.lit.X, E.makeRng('real')).result;
  const m = { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end };
  assert.equal(E.pinCheck(mini, 'X', m), null, 'a real ball');
  const fr = P.pinUnpack(r.rec);
  const tweak = f => P.pinPack(f(fr.map(x => x.slice())));
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { rec: tweak(a => { a[Math.floor(a.length / 2)][0] = 5; a[Math.floor(a.length / 2)][1] = 20; return a; }) })), 'jump', 'a teleport');
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { ms: m.ms * 2 })), 'time', 'more time than the recording');
  if (m.hits.length) {
    const [id, t] = m.hits[0];
    assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { hits: [[id, Math.max(0, t - 3)]].concat(m.hits.slice(1)) })), 'hit', 'a hit at the wrong moment');
    const lit = JSON.parse(JSON.stringify(mini)); lit.lit.X[id] = 1;
    assert.equal(E.pinCheck(lit, 'X', m), 'hit', 'a target already lit');
  }
  const far = TB.targets.find(t => !m.hits.some(h => h[0] === t.id));
  if (far) assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { hits: m.hits.concat([[far.id, 0.1]]) })), 'hit', 'a hit with the ball nowhere near');
  assert.equal(E.pinCheck(mini, 'X', Object.assign({}, m, { rec: 'zz!' })), 'bad');
});
test('pinball: lit targets stay lit, for that player only; lighting all seven wins the square', () => {
  const st = E.newMatch(lcg(3), { games: ['pinball'] }), i = 4, mini = st.squares[i].mini;
  let balls = 0;
  while (!st.squares[i].owner && balls < 40) {
    const p = st.turn, before = mini.lit[p].slice(), other = mini.lit[E.other(p)].slice();
    const r = P.pinAi(P.pinTable(mini), mini.cfg, mini.lit[p], E.makeRng('lit' + balls)).result;
    const out = E.playMove(st, i, { hits: r.hits, ms: r.ms, rec: r.rec, end: r.end }, E.makeRng('x' + balls));
    assert.equal(out.ok, true, out.reason);
    const now = st.squares[i].mini.lit;
    before.forEach((v, k) => { if (v) assert.equal(now[p][k], 1, 'a lit target stays lit'); });
    assert.deepEqual(now[E.other(p)], other, 'the other player\'s targets are untouched');
    E.endFlash(st); balls++;
  }
  assert.ok(st.squares[i].owner, 'someone lit all seven');
  assert.ok(st.squares[i].mini.lit[st.squares[i].owner].every(Boolean));
});

test('pinball: its settings (TUNE) are dealt into the square: fewer targets; the computer\'s hand', () => {
  E.setTune('pinball', { targets: 4, aiReact0: 100, aiReact1: 150, aiJitter: 20 });
  const mini = E.newMini('pinball', E.makeRng('tune'));
  E.setTune('pinball', null);
  assert.deepEqual(mini.tune, { targets: 4, aiReact0: 100, aiReact1: 150, aiJitter: 20 });
  assert.equal(mini.table.t.length, 4); assert.equal(mini.lit.X.length, 4); assert.equal(P.pinTable(mini).targets.length, 4);
  assert.equal(E.fingGoal(mini), 4);
  const mv = E.fingAi(mini, 'X', E.makeRng('ai')), r = E.applyMove(mini, 'X', mv);
  assert.equal(r.ok, true, 'the computer\'s ball passes the check');
  assert.ok(mini.lit.X.length === 4 && mini.balls.X === 1);
});

test('pinball: a ball is its inputs (the log: the flippers as they change, each launch and its power, at their steps): played through again from them it is the same ball (hits, time, recording); the server takes its own ball, never the phone\'s claim; a log out of shape is refused', () => {
  const mini = E.newMini('pinball', E.makeRng('log')), TB = P.pinTable(mini);
  const a = P.pinAi(TB, mini.cfg, mini.lit.X, E.makeRng('real-log'));
  assert.ok(typeof a.log === 'string' && a.log.length > 0 && a.steps > 0 && a.steps === a.w.n, 'the computer\'s ball logs its inputs');
  const log = P.pinLogUnpack(a.log, a.steps);
  assert.ok(log && log.some(([, v]) => v >= 4) && log.some(([, v]) => v < 4), 'a launch and some flipping');
  assert.deepEqual(P.pinLogPack(log), a.log, 'the log reads back as it was');
  const w2 = P.pinReplay(TB, mini.cfg, mini.lit.X, log, a.steps), r2 = P.pinResult(w2);
  assert.deepEqual([r2.hits, r2.ms, r2.end, w2.n], [a.result.hits, a.result.ms, a.result.end, a.steps], 'the same ball again');
  assert.equal(r2.rec, a.result.rec, 'the same recording');
  const move = { hits: a.result.hits, ms: a.result.ms, end: a.result.end, log: a.log, steps: a.steps };
  const c = E.pinReplayCheck(mini, 'X', move);
  assert.equal(c.why, null); assert.equal(c.diff, false); assert.deepEqual(c.sim.hits, a.result.hits);
  // the server's result stands whatever the phone says: a hit claimed that the ball never made is not lit (and noted)
  const far = TB.targets.find(t => !a.result.hits.some(h => h[0] === t.id));
  if (far) {
    const m2 = JSON.parse(JSON.stringify(mini)), forged = Object.assign({}, move, { hits: move.hits.concat([[far.id, 0.1]]) });
    const r = E.applyMove(m2, 'X', forged, E.makeRng('x'));
    assert.equal(r.ok, true); assert.equal(m2.lit.X[far.id], 0, 'the forged hit is not lit'); assert.equal(m2.last.diff, true, 'the claim differed from the ball');
    assert.deepEqual(m2.last.hits.map(h => h[0]), a.result.hits.map(h => h[0])); assert.equal(m2.last.rec, a.result.rec, 'the server\'s own recording rides the move');
  }
  const m3 = JSON.parse(JSON.stringify(mini));
  assert.equal(E.applyMove(m3, 'X', move, E.makeRng('y')).ok, true); assert.equal(m3.last.diff, undefined, 'an honest claim: nothing noted');
  for (const bad of [{ log: 'zz!', steps: 10 }, { log: a.log, steps: 0 }, { log: a.log, steps: 1e9 }, { log: a.log + ',1:zz', steps: a.steps }, { log: 7, steps: 5 }]) assert.equal(E.pinReplayCheck(mini, 'X', Object.assign({}, move, bad)).why, 'bad', `refused: ${JSON.stringify(bad).slice(0, 40)}`);
  assert.equal(P.pinLogUnpack('a:1,5:0,-1:3', 1000), null, 'a step going backwards'); assert.equal(P.pinLogUnpack('a:1,5:2z', 1000), null, 'a value out of range'); assert.deepEqual(P.pinLogUnpack('', 10), []);
  // a ball the phone plays in frames of any length logs the same inputs a replay applies: launch, flips held and let go
  const w = P.pinNew(TB, mini.cfg, mini.lit.X);
  P.pinRun(w, 300, { L: false, R: false }); P.pinLaunch(w, 0.7137); P.pinRun(w, 16.7, { L: true, R: false }); P.pinRun(w, 33.3, { L: true, R: true }); P.pinRun(w, 9, { L: false, R: false });
  let k = 0; while (!w.over && k++ < 60 * 20) P.pinRun(w, 1000 / 60 + (k % 3) * 2.5, { L: k % 40 < 8, R: k % 50 < 9 });
  const rw = P.pinResult(w), again = P.pinResult(P.pinReplay(TB, mini.cfg, mini.lit.X, P.pinLogUnpack(P.pinLogPack(w.log), w.n), w.n));
  assert.deepEqual([again.hits, again.ms, again.end, again.rec], [rw.hits, rw.ms, rw.end, rw.rec], 'frames of any length: the same ball from the log');
  assert.ok(w.log.some(([, v]) => v === 4 + 71), 'the launch power kept to a hundredth (as the launch itself uses it)');
});
