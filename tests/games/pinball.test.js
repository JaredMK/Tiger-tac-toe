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
  assert.ok(P.PIN_LAYOUTS.length >= 4, `at least four layouts (${P.PIN_LAYOUTS.length})`);
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

test('pinball: a square dealt before the rework (a layout or a spot that is no longer there) still plays: its numbers come round to a layout and seven different spots of it, and the square can be won', () => {
  for (const k of [4, 5, 6]) for (const t of [[0, 1, 2, 3, 4, 5, 6], [6, 7, 8, 9, 10, 11, 12], [12, 12, 12, 3, 9, 0, 1]]) {
    const old = { type: 'pinball', cfg: E.pinConfig(), table: { k, t }, lit: { X: [0, 0, 0, 0, 0, 0, 0], O: [0, 0, 0, 0, 0, 0, 0] }, balls: { X: 0, O: 0 }, last: null }, tb = P.pinTable(old);
    assert.equal(tb.k, k % P.PIN_LAYOUTS.length); assert.equal(tb.targets.length, 7); assert.equal(new Set(tb.targets.map(x => x.name)).size, 7, 'seven different spots');
    assert.deepEqual(P.pinLayoutCheck(tb), [], `layout ${k} with spots ${t}: sound`);
  }
});
test('pinball: the move\'s check — a ball is its inputs: the computer\'s ball goes in; a ball without them (a recording, hits alone) is refused; the ball is plain arithmetic, the same every time', () => {
  const mini = E.newMini('pinball', E.makeRng('chk')), mv = E.fingAi(mini, 'X', E.makeRng('real'));
  assert.ok(typeof mv.log === 'string' && mv.steps > 0 && mv.rec === undefined, 'the move is the inputs, no recording');
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(mini)), 'X', mv, E.makeRng('a')).ok, true, 'a real ball');
  for (const bad of [{ hits: mv.hits, ms: mv.ms, end: mv.end, rec: 'x' }, { hits: [[0, 1]], ms: 1000, end: 'drain' }, null, 7]) { const r = E.applyMove(JSON.parse(JSON.stringify(mini)), 'X', bad, E.makeRng('b')); assert.equal(r.ok, false); assert.ok(r.reason === 'log' || r.reason === 'bad', `refused (${r.reason})`); }
  const again = E.fingAi(mini, 'X', E.makeRng('real'));
  assert.deepEqual(again, mv, 'the same hand on the same table: the same ball');
  // sine and cosine by arithmetic (the flippers' angles): right to 1e-10 at any angle (what matters is that it is the same arithmetic everywhere)
  for (let a = -7; a <= 7; a += 0.013) { assert.ok(Math.abs(P.dsin(a) - Math.sin(a)) < 1e-10, `sin ${a}`); assert.ok(Math.abs(P.dcos(a) - Math.cos(a)) < 1e-10, `cos ${a}`); }
});
test('pinball: the flippers — a ball rolling down a resting flipper leaves across the table when it is flipped out at the tip, more and more nearly straight up further in, and over the lower half as a slower lob just inside of straight up (never back over its own side into the slingshot, which it clears); the angle never falls and the speed rises along the flipper (the same on both flippers, mirrored); a ball by the pivot is only carried up; a held flipper cradles the ball without a jitter; a ball dropped on a resting flipper bounces dead', () => {
  const F = PIN.flip, tb = P.pinAllSpots(0, E.pinConfig()), set = (w, x, y, vx, vy) => { w.inPlay = true; w.launchedAt = 0; w.gateOn = true; w.ball.position.x = x; w.ball.position.y = y; w.ball.velocity.x = vx; w.ball.velocity.y = vy; };
  const shot = (rho, side) => {
    const w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)), sg = side === 'L' ? 1 : -1, ca = Math.cos(F.rest), sa = Math.sin(F.rest), rs = PIN.ballR + F.rb + (F.rt - F.rb) * rho / F.len;
    set(w, F[side][0] + sg * (ca * rho + sa * rs), F[side][1] + sa * rho - ca * rs, sg * ca * 60, sa * 60);
    w.flip[side].on = true;
    for (let k = 0; k < 480; k++) { P.pinStep(w, 1 / 480); if (w.flip[side].struck) return { ang: Math.atan2(w.ball.velocity.x * sg, -w.ball.velocity.y) * 180 / Math.PI, sp: Math.hypot(w.ball.velocity.x, w.ball.velocity.y), ms: w.t * 1000 }; }
    return null;
  };
  let last = null;
  for (let rho = 4.5; rho <= 19.5; rho += 1.5) {
    const l = shot(rho, 'L'), r = shot(rho, 'R');
    assert.ok(l && r, `struck at ${rho}`);
    assert.ok(Math.abs(l.ang - r.ang) < 1e-6 && Math.abs(l.sp - r.sp) < 1e-6, 'the two flippers mirror each other');
    assert.ok(l.ms < 60, `the ball leaves within the swing (${l.ms.toFixed(0)} ms)`);
    assert.ok(l.ang > 2.5, `never back over its own side (${l.ang.toFixed(1)} at ${rho})`);
    if (last) { assert.ok(l.ang >= last.ang - 1e-9 && l.ang < last.ang + 9, `the angle never falls, and rises smoothly, along the flipper (${last.ang.toFixed(1)} -> ${l.ang.toFixed(1)} at ${rho})`); assert.ok(l.sp > last.sp, 'faster towards the tip'); }
    last = l;
  }
  assert.ok(shot(6, 'L').ang < 4 && shot(6, 'L').sp < 320 && shot(19.5, 'L').ang > 35 && shot(19.5, 'L').sp > 400, 'the lower half: a slow lob just inside of straight up; the tip: fast, across the table');
  for (const rho of [4.5, 6, 7.5, 9]) {                               // the lob clears the slingshot over the flipper's base: nothing pinches, nothing kicks it back
    const w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)), ca = Math.cos(F.rest), sa = Math.sin(F.rest), rs = PIN.ballR + F.rb + (F.rt - F.rb) * rho / F.len;
    set(w, F.L[0] + ca * rho + sa * rs, F.L[1] + sa * rho - ca * rs, ca * 60, sa * 60); w.flip.L.on = true;
    let top = 999; for (let k = 0; k < 150; k++) { P.pinStep(w, 1 / 480); top = Math.min(top, w.ball.position.y); }
    assert.ok(!w.events.some(e => e.k === 'sling') && top < 110, `flipped at ${rho} from the pivot: up past the slingshot (to y ${top.toFixed(0)})`);
  }
  {                                                                  // by the pivot (the inlane's mouth): carried up, never struck, and back to the cradle
    const w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)); set(w, 14.8, 126, 0, 30); w.flip.L.on = true;
    for (let k = 0; k < 480 * 3; k++) P.pinStep(w, 1 / 480);
    const at = [w.ball.position.x, w.ball.position.y];
    w.flip.L.on = false; for (let k = 0; k < 10; k++) P.pinStep(w, 1 / 480); w.flip.L.on = true;   // let go for a moment and flipped again at once
    let struck = false; for (let k = 0; k < 480 * 3; k++) { P.pinStep(w, 1 / 480); if (w.flip.L.struck) struck = true; }
    assert.ok(!struck && Math.hypot(w.ball.position.x - at[0], w.ball.position.y - at[1]) < 0.5 && !w.over, 'a cradled ball flipped again at once is carried, and sits where it sat');
  }
  // the cradle
  const w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)); set(w, 14.8, 126, 0, 30); w.flip.L.on = true;
  let moved = 0, at = null;
  for (let k = 0; k < 480 * 5; k++) { P.pinStep(w, 1 / 480); if (w.t > 3) { if (at) moved = Math.max(moved, Math.hypot(w.ball.position.x - at[0], w.ball.position.y - at[1])); at = [w.ball.position.x, w.ball.position.y]; } }
  assert.ok(!w.over && moved < 1e-6 && w.nudges === 0, `the ball sits still on the held flipper (moves ${moved} a step)`);
  assert.ok(Math.hypot(w.ball.position.x - F.L[0], w.ball.position.y - F.L[1]) < 9, 'by the pivot, against the guide');
  // a dead bounce
  const d = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)); set(d, F.L[0] + 12, F.L[1] - 14, 0, 180);
  let up = 0; for (let k = 0; k < 120; k++) { P.pinStep(d, 1 / 480); up = Math.max(up, -d.ball.velocity.y); }
  assert.ok(up < 80, `no more than a soft bounce off a resting flipper (${up.toFixed(0)} units a second up)`);
});
test('pinball: lit targets stay lit, for that player only; lighting all seven wins the square', () => {
  const st = E.newMatch(lcg(3), { games: ['pinball'] }), i = 4, mini = st.squares[i].mini;
  let balls = 0;
  while (!st.squares[i].owner && balls < 80) {
    const p = st.turn, before = mini.lit[p].slice(), other = mini.lit[E.other(p)].slice();
    const out = E.playMove(st, i, E.fingAi(mini, p, E.makeRng('lit' + balls)), E.makeRng('x' + balls));
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
  assert.deepEqual(r2.events, a.result.events, 'the same events at the same moments'); assert.deepEqual([w2.ball.position, w2.ball.velocity], [a.w.ball.position, a.w.ball.velocity], 'to the last bit');
  const move = { hits: a.result.hits, ms: a.result.ms, end: a.result.end, log: a.log, steps: a.steps };
  const c = E.pinReplayCheck(mini, 'X', move);
  assert.equal(c.why, null); assert.equal(c.diff, false); assert.deepEqual(c.sim.hits, a.result.hits);
  // the server's result stands whatever the phone says: a hit claimed that the ball never made is not lit (and noted)
  const far = TB.targets.find(t => !a.result.hits.some(h => h[0] === t.id));
  if (far) {
    const m2 = JSON.parse(JSON.stringify(mini)), forged = Object.assign({}, move, { hits: move.hits.concat([[far.id, 0.1]]) });
    const r = E.applyMove(m2, 'X', forged, E.makeRng('x'));
    assert.equal(r.ok, true); assert.equal(m2.lit.X[far.id], 0, 'the forged hit is not lit'); assert.equal(m2.last.diff, true, 'the claim differed from the ball');
    assert.deepEqual(m2.last.hits.map(h => h[0]), a.result.hits.map(h => h[0])); assert.equal(m2.last.log, a.log, 'the inputs ride the move (the other phone replays the ball from them)'); assert.equal(m2.last.rec, undefined, 'no recording');
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
  assert.deepEqual([again.hits, again.ms, again.end, again.events], [rw.hits, rw.ms, rw.end, rw.events], 'frames of any length: the same ball from the log');
  assert.ok(w.log.some(([, v]) => v === 4 + 71), 'the launch power kept to a hundredth (as the launch itself uses it)');
});

test('pinball: the launch — on every layout, at every power from 0.3 to full with no flipper input, the ball enters the playfield (touches a bumper, a slingshot or a target, or comes down to the flippers), never leaves the outline or sits in a wall, never passes back through the shut gate and never comes to rest; a full-power launch touches a bumper, a slingshot or a target before any drain in at least 85% of launches', () => {
  // (tests/sim/pinball-launch.sim.js: 50 balls at every strength on every layout; the November 2026 table: every
  // launch runs the arch to the stop and comes back off it into a top lane (the skill shot) and the bumpers:
  // every ball entered, 98-100% touched something at every strength, none looped straight to the drain, none
  // tunnelled or stuck; so 85% of full-power launches touching, over 8 deals across the layouts, is a floor
  // under what the table does, and one odd deal never fails the build)
  const { dealTable, launchTrial } = require('../pinball-launch.js');
  let full = 0, fullTouched = 0, balls = 0;
  for (let k = 0; k < P.PIN_LAYOUTS.length; k++) for (let s = 0; s < 2; s++) {
    const tb = dealTable(k, E.makeRng(`launch${k}:${s}`));
    for (let p = 3; p <= 10; p++) {
      const r = launchTrial(tb, p / 10, 8), who = `${tb.name} (deal ${s}) at power ${(p / 10).toFixed(1)}`;   // (8 s: a ball still bouncing about the bumpers then counts as played)
      balls++;
      assert.equal(r.tunnel, null, `${who}: the ball stays on the table and out of the walls (${r.tunnel})`);
      assert.ok(r.entered, `${who}: the ball enters the playfield (${r.end})`);
      assert.notEqual(r.end, 'stuck', `${who}: the ball never comes to rest`);
      assert.notEqual(r.end, 'fellBack', `${who}: the launch clears the gate`);
      if (p === 10) { full++; if (r.touched) fullTouched++; }
    }
  }
  assert.equal(balls, P.PIN_LAYOUTS.length * 2 * 8);
  assert.ok(fullTouched >= full * 0.85, `a full-power launch touches a bumper, a slingshot or a target before any drain: ${fullTouched} of ${full}`);
  // the weakest launch clears the gate too (the lip and the guards then feed it in like any other)
  for (let k = 0; k < P.PIN_LAYOUTS.length; k++) { const r = launchTrial(dealTable(k, E.makeRng('weak' + k)), 0, 8); assert.ok(r.entered && !r.tunnel, `${P.PIN_LAYOUTS[k].name}: the weakest launch plays (${r.end})`); }
});
test('pinball: the time limit (November 2026, TUNE maxSecs, 30 s by default, from Start): at the limit the ball ends as a drain, the targets lit so far kept; played through again on the server it is the same ball, and the move goes in', () => {
  assert.equal(E.tuneFields('pinball').find(f => f.k === 'maxSecs').def, PIN.maxSecs, 'the setting and the simulation share the default');
  E.setTune('pinball', { maxSecs: 5 });
  let mini;
  try { mini = E.newMini('pinball', E.makeRng('cap')); } finally { E.setTune('pinball', null); }
  assert.deepEqual(mini.tune, { maxSecs: 5 });
  const TB = P.pinTable(mini);
  assert.equal(TB.maxSecs, 5); assert.equal(P.pinTable(E.newMini('pinball', E.makeRng('cap2'))).maxSecs, 30);
  let a = null;
  for (let i = 0; i < 40 && !a; i++) { const r = P.pinAi(TB, mini.cfg, mini.lit.X, E.makeRng('cap-ai' + i)); if (r.w.events.some(e => e.cap)) a = r; }
  assert.ok(a, 'a ball that lasts to the limit');
  assert.ok(Math.abs(a.w.t - 5) < 0.01, `ended at the limit (${a.w.t.toFixed(3)} s)`); assert.equal(a.result.end, 'drain');
  const move = { hits: a.result.hits, ms: a.result.ms, end: a.result.end, log: a.log, steps: a.steps };
  const c = E.pinReplayCheck(mini, 'X', move);
  assert.equal(c.why, null); assert.equal(c.diff, false, 'the server\'s ball ends at the limit too');
  const m2 = JSON.parse(JSON.stringify(mini)), r = E.applyMove(m2, 'X', move, E.makeRng('cap-x'));
  assert.equal(r.ok, true); assert.equal(r.outcome, 'continue');
  assert.deepEqual(m2.lit.X.map((v, k) => (v ? k : -1)).filter(k => k >= 0), a.result.hits.map(h => h[0]).sort((x, y) => x - y), 'its targets kept');
});
test('pinball: the move\'s flash carries the ball\'s inputs and no recording; replayed from them bit by bit (as the other phone plays it, frame by frame) it is the same ball; the level reaches the computer\'s hand (hard lights more a ball than easy)', () => {
  const st = E.newMatch(lcg(11), { games: ['pinball'] }), i = 4, p = st.turn, mini0 = JSON.parse(JSON.stringify(st.squares[i].mini));
  const mv = E.fingAi(st.squares[i].mini, p, E.makeRng('flash'));
  assert.equal(E.playMove(st, i, mv, E.makeRng('f')).ok, true);
  const fg = st.flash.fing;
  assert.ok(fg && fg.type === 'pinball' && fg.log === mv.log && fg.steps === mv.steps && fg.rec === undefined, 'the flash: the inputs, no recording');
  const log = P.pinLogUnpack(fg.log, fg.steps), w = P.pinNew(P.pinTable(mini0), mini0.cfg, mini0.lit[p]), rng = E.makeRng('chunks');
  let at = 0;
  while (w.n < fg.steps && !w.over) { at = Math.min(fg.steps, at + 1 + Math.floor(rng() * 40)); P.pinReplayTo(w, log, at); assert.ok(w.n <= at); }
  const r = P.pinResult(w);
  assert.deepEqual([r.hits.map(h => h[0]), r.ms, r.end], [fg.hits.map(h => h[0]), fg.ms, fg.end], 'the same ball, stepped on in pieces');
  assert.equal(P.pinEnd(w), fg.end);
  const pub = E.publicMini(st.squares[i].mini, p);
  assert.ok(pub.last && pub.last.log === undefined && pub.last.rec === undefined, 'the square\'s public view carries neither');
  // the levels
  const lit = lv => { let n = 0; for (let s = 0; s < 60; s++) { const m = E.newMini('pinball', E.makeRng('lv' + s)); n += E.fingAi(m, 'X', E.makeRng('lvb' + s), lv).hits.length; } return n; };
  const easy = lit('easy'), normal = lit('normal'), hard = lit('hard');
  assert.ok(easy < normal && normal < hard, `easy ${easy} < normal ${normal} < hard ${hard} targets over 60 first balls`);
  assert.deepEqual(E.aiOf('pinball').best(E.newMini('pinball', E.makeRng('q')), 'X', E.makeRng('r'), null, { level: 'hard' }).move, { fing: true, level: 'hard' }, 'the level goes with the ball');
});
test('pinball: a ball that goes down an outlane before any flipper has touched it since its launch comes back to the plunger (whenever it happens); once a flipper has had it, an outlane is a drain like any other; between the flippers it is a drain either way', () => {
  const tb = P.pinAllSpots(0, Object.assign(E.pinConfig(), { save: 0 })), drop = (x, touched) => { const w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)); P.pinLaunch(w, 0.5); P.pinRun(w, 100, {}); w.launchedAt = w.t - 20; w.touched = touched; w.ball.position.x = x; w.ball.position.y = PIN.drain - 2; w.ball.velocity.x = 0; w.ball.velocity.y = 200; for (let k = 0; k < 4; k++) P.pinRun(w, 20, {}); return w; };
  for (const x of [5.7, P.PIN.mid * 2 - 5.7]) {
    const a = drop(x, false); assert.ok(!a.over && !a.inPlay && a.events.some(e => e.k === 'save' && e.out), `an outlane (x ${x}), untouched: saved`);
    for (let k = 0; k < 60; k++) P.pinRun(a, 20, {}); assert.ok(a.inPlay && a.events.some(e => e.k === 'launch' && e.auto), 'and launched again by the table');
    const b = drop(x, true); assert.ok(b.over && P.pinEnd(b) === 'drain', 'after a flipper has had it: a drain');
  }
  assert.ok(drop(P.PIN.mid, false).over, 'between the flippers: a drain, touched or not');
  // a flipper's touch is noted by the ball's own contact with it (at rest too: the player had their chance)
  const w = P.pinNew(tb, tb.cfg, tb.targets.map(() => 0)); P.pinLaunch(w, 0.5); P.pinRun(w, 100, {}); assert.equal(w.touched, false);
  w.ball.position.x = PIN.flip.L[0] + 12; w.ball.position.y = PIN.flip.L[1] - 10; w.ball.velocity.x = 0; w.ball.velocity.y = 100; P.pinRun(w, 200, {}); assert.equal(w.touched, true);
});
