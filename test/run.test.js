'use strict';
// Run with:  node --test
// The runner games in the shared engine (engine.js): Dash and Lane Rush. A move is one run along a
// seeded course; the engine checks what a run may be, steps the run itself, and plays the computer.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));
// Play whole turns until the match is over: the computer on both sides.
function cpuMatch(games, seed, guard = 900) {
  const rng = lcg(seed), st = E.newMatch(rng, { games });
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
// Step a run until a condition holds (or it ends), in frames of 1/60 s.
function runUntil(sim, cond, max = 20000) { for (let k = 0; k < max && !sim.crash && !sim.done && !cond(sim); k++) E.runStep(sim, 1 / 60); return sim; }
const runOut = sim => runUntil(sim, () => false);

/* ===================================== the config ===================================== */
test('runners: one difficulty config per game, checked value by value, copied into each square as it is dealt (a change applies to new squares only)', () => {
  E.setRunConfig(null);
  assert.deepEqual(E.runConfig('dash'), E.RUN_DEFAULTS.dash); assert.deepEqual(E.runConfig('lane'), E.RUN_DEFAULTS.lane);
  const a = mini('dash', 'cfg-a');
  assert.deepEqual(a.cfg, E.RUN_DEFAULTS.dash, 'the square carries the config it was dealt with');
  E.setRunConfig({ dash: { target: 600, v0: 12, ramp: 2, gapMin: 30, gapMax: 20, mix: { rock: 50, crate: 0, spike: 0, flyer: 50, pair: 0 } }, lane: { target: 'x', v0: 99, ramp: -1, gapMin: 40, mix: { one: 100, two: 0 } } });
  const d = E.runConfig('dash'), l = E.runConfig('lane');
  assert.deepEqual(d, { target: 600, v0: 12, ramp: 2, gapMin: 30, gapMax: 32, mix: { rock: 50, crate: 0, spike: 0, flyer: 50, pair: 0 } }, 'the values as given; a gap range that is backwards is opened up');
  assert.deepEqual(l, { target: 1000, v0: 27, ramp: 2.7, gapMin: 40, gapMax: 42, mix: { one: 100, two: 0 } }, 'a value off its range, or missing, is the default (and a default spacing below the minimum given is opened up)');
  const b = mini('dash', 'cfg-b');
  assert.equal(b.cfg.target, 600, 'a new square plays by the new config');
  assert.equal(a.cfg.target, 1000, 'the square dealt earlier keeps its own');
  assert.ok(E.runCourse(b, 'X').every(o => o.k === 'rock' || o.k === 'flyer'), 'the obstacle mix as set');
  assert.ok(E.runCourse(mini('lane', 'cfg-c'), 'O').every(o => o.cars.filter(Boolean).length === 1), 'one car a row when "two" has no weight');
  E.setRunConfig({ dash: { mix: { rock: 0, crate: 0, spike: 0, flyer: 0, pair: 0 } } });
  assert.deepEqual(E.runConfig('dash').mix, E.RUN_DEFAULTS.dash.mix, 'a mix with no weight at all is the default mix');
  E.setRunConfig(null);
});

/* ===================================== the course ===================================== */
test('runners: the speed is tied to the distance; the time a stretch takes and the distance a time allows agree', () => {
  const cfg = E.RUN_DEFAULTS.dash;
  assert.equal(E.runSpeed(cfg, 0), 8); assert.equal(E.runSpeed(cfg, 700), 8 + 1.5 * 7, 'resuming at 700 m runs at 700 m speed');
  const t = E.runSecs(cfg, 200, 500);
  assert.ok(Math.abs(E.runAfter(cfg, 200, t) - 500) < 1e-6, 'after that long, the run is there');
  assert.ok(E.runSecs(cfg, 0, 100) > E.runSecs(cfg, 900, 1000), 'the last hundred metres go by faster than the first');
  const flat = Object.assign({}, cfg, { ramp: 0 });
  assert.equal(E.runSecs(flat, 0, 80), 10); assert.equal(E.runAfter(flat, 0, 10), 80, 'with no ramp, a plain constant speed');
  const g0 = E.runGrace(cfg, 0), g7 = E.runGrace(cfg, 700);
  assert.ok(Math.abs(g0 - E.runAfter(cfg, 0, 2)) < 1e-9 && g7 > g0, 'the grace stretch is two seconds at the run\'s speed: longer further along');
});

test('dash: a fixed, seeded course per player per square: ground hazards, low flyers and pairs, spaced within the config\'s gaps, up to the target', () => {
  E.setRunConfig(null);
  const m = mini('dash', 'course');
  const cx = E.runCourse(m, 'X'), co = E.runCourse(m, 'O');
  assert.deepEqual(E.runCourse(m, 'X'), cx, 'the same course every time');
  assert.notDeepEqual(cx, co, 'each player their own');
  assert.notDeepEqual(E.runCourse(mini('dash', 'other'), 'X'), cx, 'another square, another course');
  const cfg = m.cfg;
  assert.ok(cx[0].at >= E.runGrace(cfg, 0) + 5, 'nothing in the opening grace stretch');
  assert.ok(cx[cx.length - 1].at < cfg.target, 'the last one before the finish');
  for (let k = 1; k < cx.length; k++) {
    const gap = cx[k].at - cx[k - 1].at;
    if (cx[k].pair === 2) assert.ok(gap > 2 && gap < 9, `a pair's two hazards are a jump apart (${gap})`);
    else assert.ok(gap >= cfg.gapMin - 0.01 && gap <= cfg.gapMax + 0.01, `obstacles ${k - 1} and ${k} are ${gap} m apart`);
  }
  const kinds = new Set(cx.map(o => o.k));
  assert.ok(['rock', 'crate', 'spike', 'flyer'].every(k => kinds.has(k)), `every kind comes up (${[...kinds].join(' ')})`);
  assert.ok(cx.some(o => o.pair === 1) && cx.filter(o => o.pair === 1).length === cx.filter(o => o.pair === 2).length, 'pairs come in twos');
  for (const o of cx) assert.ok(E.DASH_OBS[o.k], `a known hazard: ${o.k}`);
});

test('lane rush: rows of one or two cars, never a row fully blocked, and the open lane always within reach of the row before', () => {
  E.setRunConfig(null);
  for (let s = 0; s < 60; s++) {
    const m = mini('lane', 'lane' + s);
    for (const p of ['X', 'O']) {
      const rows = E.runCourse(m, p);
      assert.ok(rows.length > 15, 'a course of rows');
      let prevOpen = null;
      for (const r of rows) {
        assert.equal(r.cars.length, 3);
        const open = [0, 1, 2].filter(l => !r.cars[l]);
        assert.ok(open.length >= 1 && open.length <= 2, 'one or two cars: at least one lane open');
        if (prevOpen) assert.ok(open.some(o => prevOpen.some(q => Math.abs(o - q) <= 1)), `row at ${r.at}: an open lane next to one of the row before`);
        prevOpen = open;
      }
      for (let k = 1; k < rows.length; k++) assert.ok(rows[k].at - rows[k - 1].at >= m.cfg.gapMin - 0.01, 'rows at least the minimum gap apart');
    }
  }
});

/* ===================================== the run ===================================== */
test('dash: the runner runs on its own; a hazard not jumped is a crash at the hazard; a tap clears a rock, a crate and a spike; a flyer is hit by a jump and passed on the ground', () => {
  E.setRunConfig(null);
  const m = mini('dash', 'sim');
  const fresh = course => Object.assign(E.runStart(m, 'X'), { course, i: 0 });
  // no input: the first hazard stops the run, just in front of it
  let sim = runOut(fresh([{ at: 40, k: 'rock' }]));
  assert.ok(sim.crash && sim.crash.at >= 40 - E.DASH.box.w && sim.crash.at <= 40.5, `a crash at the rock (${sim.crash && sim.crash.at})`);
  assert.equal(sim.crash.ob.k, 'rock');
  // a tap just before each ground hazard clears it
  for (const k of ['rock', 'crate', 'spike']) {
    sim = fresh([{ at: 40, k }]);
    runUntil(sim, s => s.d >= 40 - 0.3 * E.runSpeed(s.cfg, s.d));
    assert.ok(E.runJump(sim), 'the press launches');
    E.runStep(sim, 0.06); E.runRelease(sim);                  // a tap: let go after 60 ms
    runUntil(sim, s => s.d > 46);
    assert.ok(!sim.crash, `a tap clears a ${k}`);
    assert.ok(!sim.air, 'and the runner is back on the ground');
  }
  // the jump's height: a tap about 1.5 m, a hold about 2.3 m
  const apex = hold => { const s = fresh([]); E.runJump(s); let top = 0; for (let t = 0; t < 1.2; t += 1 / 240) { E.runStep(s, 1 / 240); if (!hold && t >= 0.06) E.runRelease(s); top = Math.max(top, s.y); } return top; };
  assert.ok(apex(false) > 1.3 && apex(false) < 1.7, `a tap peaks at ${apex(false).toFixed(2)} m`);
  assert.ok(apex(true) > 2.0 && apex(true) < 2.6, `a hold peaks at ${apex(true).toFixed(2)} m`);
  assert.ok(!E.runJump(Object.assign(fresh([]), { air: true })), 'no jump while in the air');
  // a flyer: jumping into it is a crash; staying on the ground passes under
  sim = fresh([{ at: 40, k: 'flyer' }]);
  runUntil(sim, s => s.d >= 40 - 0.3 * E.runSpeed(s.cfg, s.d)); E.runJump(sim);
  runUntil(sim, s => s.d > 46);
  assert.ok(sim.crash && sim.crash.ob.k === 'flyer', 'a jump hits the flyer');
  sim = runUntil(fresh([{ at: 40, k: 'flyer' }]), s => s.d > 46);
  assert.ok(!sim.crash, 'on the ground, the flyer passes overhead');
  // the finish: the target ends the run
  sim = runOut(fresh([]));
  assert.ok(sim.done && sim.d === m.cfg.target, 'the run finishes at the target');
  assert.deepEqual(E.runResult(sim), { dist: m.cfg.target, ms: Math.round(sim.t * 1000), out: false });
});

test('dash: a pair needs a well-timed long jump (or two quick ones); a single tap on the first lands on the second', () => {
  E.setRunConfig(null);
  const m = mini('dash', 'pair');
  const at = 60, v = E.runSpeed(m.cfg, at), gap = 1.0 + 0.15 * v;
  const course = [{ at, k: 'rock', pair: 1 }, { at: at + 1 + gap, k: 'rock', pair: 2 }];
  const go = (lead, hold) => { const s = Object.assign(E.runStart(m, 'X'), { course, i: 0 }); runUntil(s, x => x.d >= at - lead * v); E.runJump(s); if (!hold) { E.runStep(s, 0.06); E.runRelease(s); } runUntil(s, x => x.d > at + 12); return s; };
  assert.ok(go(0.25, false).crash, 'one tap: over the first, into the second');
  assert.ok(!go(0.2, true).crash, 'a well-timed hold clears both');
  assert.ok(go(0.05, true).crash && go(0.5, true).crash, 'too late or too early, it does not');
  assert.ok(E.runCourse(m, 'O').some(o => o.pair), 'pairs are part of the course');
});

test('lane rush, harder again: half as fast again and about a third more cars, through the config, a lane always open; a driver seeing only the screen, a quarter-second late, still gets through', () => {
  E.setRunConfig(null);
  const cfg = E.runConfig('lane');
  assert.deepEqual([cfg.v0, cfg.ramp], [27, 2.7], 'half as fast again (18 to 27 m/s, the ramp likewise)');
  const count = c => { let cars = 0; for (let k = 0; k < 300; k++) { const m = mini('lane', 'traffic' + k); m.cfg = c; for (const o of E.runCourse(m, 'X')) cars += o.cars.filter(Boolean).length; } return cars / 300; };
  const ratio = count(cfg) / count({ target: 1000, v0: 18, ramp: 1.8, gapMin: 18.8, gapMax: 34.4, mix: { one: 55, two: 45 } });
  assert.ok(ratio > 1.25 && ratio < 1.5, `about a third more cars a course (x${ratio.toFixed(2)})`);
  // every row leaves a lane open, one the car can reach from wherever it passed the row before in the time there is
  for (let k = 0; k < 200; k++) {
    const m = mini('lane', 'reach' + k), rows = E.runCourse(m, 'X');
    rows.forEach((r, i) => {
      const open = [0, 1, 2].filter(l => !r.cars[l]); assert.ok(open.length >= 1, 'a lane open');
      if (!i) return;
      const was = [0, 1, 2].filter(l => !rows[i - 1].cars[l]), t = E.runSecs(m.cfg, rows[i - 1].at, r.at);
      if (t < E.LANE_TIGHT) assert.ok(was.every(q => open.includes(q)), `rows ${t.toFixed(2)} s apart: no change needed`);
      else if (t < E.LANE_NEAR) assert.ok(was.every(q => open.some(o => Math.abs(o - q) <= 1)), `rows ${t.toFixed(2)} s apart: one change at most from anywhere`);
    });
  }
  // the driver: sees what the page shows (34 m of road, the car 82% down: 27.9 m ahead), acts 0.25 s late
  const VIEW = 0.82 * 34, react = 0.25;
  const drive = m => {
    const sim = E.runStart(m, 'X'), rows = sim.course, hist = [];
    while (!sim.crash && !sim.done) {
      hist.push([sim.t, sim.d]);
      let seen = -Infinity; for (const [t, d] of hist) { if (t <= sim.t - react) seen = d; else break; }
      const known = rows.filter(o => o.at <= seen + VIEW && o.at > sim.d - E.LANE.box), cur = Math.round(sim.lane);
      if (known.length && sim.laneT >= 1 && !rows.some(o => Math.abs(o.at - sim.d) < E.LANE.box + 0.6)) {
        const open = r => [0, 1, 2].filter(l => !r.cars[l]), a = open(known[0]), b = known[1] ? open(known[1]) : null;
        const cost = l => Math.abs(l - cur) * 10 + (b ? Math.min(...b.map(q => Math.abs(q - l))) : 0);
        const want = a.slice().sort((x, y) => cost(x) - cost(y))[0];
        if (want !== cur) E.runLane(sim, want > cur ? 1 : -1);
      }
      E.runStep(sim, 1 / 60);
    }
    return sim;
  };
  let fin = 0;
  for (let k = 0; k < 40; k++) { const s = drive(mini('lane', 'react' + k)); if (s.done) fin++; }
  assert.equal(fin, 40, `every course driven to the finish (${fin}/40)`);
  // at the finish line's speed a row is still on screen over a reaction and a lane change before the car reaches it
  const vEnd = E.runSpeed(cfg, cfg.target);
  assert.ok(VIEW / vEnd > react + E.LANE.switchSecs, `${(VIEW / vEnd).toFixed(2)} s of warning at ${vEnd} m/s`);
});

test('lane rush: the car drives on; a car ahead in its lane is a crash; a change into a car is a crash; a change away in time passes', () => {
  E.setRunConfig(null);
  const m = mini('lane', 'sim');
  const fresh = course => Object.assign(E.runStart(m, 'X'), { course, i: 0 });
  let sim = runOut(fresh([{ at: 50, cars: [false, true, false] }]));
  assert.ok(sim.crash && Math.abs(sim.crash.at - 50) < E.LANE.box + 0.1, `a crash at the car ahead (${sim.crash && sim.crash.at})`);
  sim = fresh([{ at: 50, cars: [false, true, false] }]);
  runUntil(sim, s => s.d >= 50 - 1.2 * E.runSpeed(s.cfg, s.d));
  assert.ok(E.runLane(sim, -1), 'a swipe left');
  runUntil(sim, s => s.d > 56);
  assert.ok(!sim.crash && sim.lane === 0, 'in the left lane, past the car');
  assert.ok(!E.runLane(sim, -1), 'no lane further left');
  sim = fresh([{ at: 50, cars: [true, false, false] }]);
  runUntil(sim, s => s.d >= 50 - 0.5 * E.runSpeed(s.cfg, s.d));
  E.runLane(sim, -1);
  runUntil(sim, s => s.d > 56);
  assert.ok(sim.crash, 'switching into a car is a crash');
  // a change takes LANE.switchSecs: the car is between lanes meanwhile
  sim = fresh([]); E.runLane(sim, 1); for (let k = 0; k < 6; k++) E.runStep(sim, E.LANE.switchSecs / 12);
  assert.ok(E.runLaneX(sim) > 1.3 && E.runLaneX(sim) < 1.7, `mid-change (${E.runLaneX(sim)})`);
  runUntil(sim, s => s.laneT >= 1); assert.equal(E.runLaneX(sim), 2);
  assert.ok(runOut(fresh([])).done, 'an empty course: the finish');
});

/* ===================================== the move ===================================== */
test('runners: a move is a run from the saved distance; the crash point is the new saved distance; the speed and the grace stretch follow; 1,000 m takes the square', () => {
  E.setRunConfig(null);
  const m = mini('dash', 'move');
  const c = E.runCourse(m, 'X'), cfg = m.cfg;
  const first = c[0];
  const r1 = E.applyMove(m, 'X', { dist: first.at + 0.1, ms: Math.round(E.runSecs(cfg, 0, first.at + 0.1) * 1000) + 50 });
  assert.deepEqual(r1, { ok: true, outcome: 'continue', note: 'crash' });
  assert.equal(m.dist.X, Math.round((first.at + 0.1) * 100) / 100); assert.equal(m.runs.X, 1); assert.deepEqual(m.crashes.X, [Math.round(first.at + 0.1)]);
  assert.deepEqual([m.dist.O, m.runs.O], [0, 0], 'the other player untouched');
  assert.equal(m.last.by, 'X'); assert.equal(m.last.from, 0); assert.equal(m.last.done, false);
  // the retry: from the crash point, the course the same past the grace stretch
  const sim = E.runStart(m, 'X');
  assert.equal(sim.d, m.dist.X); assert.equal(sim.grace, E.runGrace(cfg, m.dist.X));
  assert.ok(sim.course.every(o => o.at >= m.dist.X + sim.grace) && sim.course.length < c.length, 'the obstacles within the grace stretch are left out of this run');
  assert.deepEqual(sim.course, c.filter(o => o.at >= m.dist.X + sim.grace), 'the rest of the course is as it was');
  // the time ran out mid-run: the run ends there, anywhere, and the distance is saved
  const r2 = E.applyMove(m, 'X', { dist: m.dist.X + 30, ms: Math.round(E.runSecs(cfg, m.dist.X, m.dist.X + 30) * 1000) + 10, out: true });
  assert.deepEqual(r2, { ok: true, outcome: 'continue', note: 'out' });
  assert.equal(m.last.out, true); assert.equal(m.runs.X, 2);
  // the finish
  const far = E.applyMove(m, 'O', { dist: cfg.target, ms: Math.round(E.runSecs(cfg, 0, cfg.target) * 1000) });
  assert.deepEqual(far, { ok: true, outcome: 'win', note: 'finish' });
  assert.equal(m.dist.O, cfg.target); assert.equal(m.last.done, true); assert.deepEqual(m.crashes.O, [], 'a finish is no crash');
});

test('runners: the server\'s checks: more distance than the time allows, a crash where there is nothing, a crash inside the grace stretch, backwards or past the target are refused', () => {
  E.setRunConfig(null);
  const m = mini('lane', 'check'), cfg = m.cfg, rows = E.runCourse(m, 'X');
  const okMs = (a, b) => Math.round(E.runSecs(cfg, a, b) * 1000);
  const row = rows[3];
  assert.equal(E.runCheck(m, 'X', { dist: row.at, ms: okMs(0, row.at) }), null, 'a crash at a row, in the time it takes');
  assert.equal(E.runCheck(m, 'X', { dist: row.at, ms: okMs(0, row.at) * 1.5 }), null, 'slower is fine (a slow phone)');
  assert.equal(E.runCheck(m, 'X', { dist: row.at, ms: okMs(0, row.at) * 0.5 }), 'fast', 'faster than the course allows is not');
  assert.equal(E.runCheck(m, 'X', { dist: (rows[3].at + rows[4].at) / 2, ms: 99999 }), 'course', 'a crash between two rows: nothing to crash into');
  assert.equal(E.runCheck(m, 'X', { dist: cfg.target, ms: okMs(0, cfg.target) }), null, 'the finish needs no obstacle');
  assert.equal(E.runCheck(m, 'X', { dist: (rows[3].at + rows[4].at) / 2, ms: 99999, out: true }), null, 'nor does a run the clock ended');
  assert.equal(E.runCheck(m, 'X', { dist: cfg.target + 1, ms: 99999 }), 'bad');
  m.dist.X = 300;
  assert.equal(E.runCheck(m, 'X', { dist: 250, ms: 1000 }), 'bad', 'no going backwards');
  const inGrace = rows.find(r => r.at > 300 && r.at < 300 + E.runGrace(cfg, 300) - 1);
  if (inGrace) assert.equal(E.runCheck(m, 'X', { dist: inGrace.at, ms: 99999 }), 'course', 'a row inside the grace stretch is not there to crash into');
  for (const bad of [null, 'x', 5, {}, { dist: 'a', ms: 1 }, { dist: 400, ms: -1 }, { dist: NaN, ms: 1 }]) assert.equal(E.applyMove(m, 'X', bad).ok, false, `refused: ${JSON.stringify(bad)}`);
  assert.equal(E.applyMove(m, 'X', { dist: 500, ms: 10 }).reason, 'fast');
});

test('runners: a timed-out player who never started gets a run that crashes after a short random distance; the computer\'s runs finish in about 4-5, shorter when it is faster', () => {
  E.setRunConfig(null);
  for (const t of ['dash', 'lane']) {
    const m = mini(t, 'auto-' + t), c = E.runCourse(m, 'X'), g = E.runGrace(m.cfg, 0);
    const lens = [];
    for (let k = 0; k < 40; k++) {
      const mm = JSON.parse(JSON.stringify(m)), rng = E.makeRng('auto' + k);
      assert.equal(E.randomLegalMove(mm, 'X', rng), 'auto');
      const r = E.applyMove(mm, 'X', 'auto', rng);
      assert.equal(r.ok, true); assert.equal(r.outcome, 'continue');
      assert.ok(mm.dist.X > g && mm.dist.X < g + 80 + m.cfg.gapMax, `a short run (${mm.dist.X})`);
      assert.ok(c.some(o => Math.abs(o.at - mm.dist.X) < 1), 'that crashed at an obstacle');
      lens.push(mm.dist.X);
    }
    assert.ok(new Set(lens).size >= 2, `random (${[...new Set(lens)].join(' ')})`);
    // the computer: many squares, each run to the finish
    let runs = 0, squares = 300, first = [], late = [];
    const rng = lcg(77);
    for (let s = 0; s < squares; s++) {
      const mm = mini(t, 'ai-' + t + s);
      let n = 0;
      while (mm.dist.X < mm.cfg.target && n < 40) {
        const from = mm.dist.X, ai = E.localBest(E.publicMini(mm), 'X', rng);
        assert.ok(ai.q >= 0 && ai.q <= 1);
        const r = E.applyMove(mm, 'X', ai.move, rng);
        assert.equal(r.ok, true, `the computer's run holds up (${r.reason})`);
        (from < 100 ? first : from > 600 ? late : []).push(mm.dist.X - from);
        n++;
      }
      runs += n;
    }
    const avg = runs / squares, mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(avg >= 3.8 && avg <= 5.2, `${t}: the computer finishes in ${avg.toFixed(2)} runs on average`);
    assert.ok(mean(late) < mean(first), `${t}: its runs are shorter further along (${mean(first).toFixed(0)} m from the start, ${mean(late).toFixed(0)} m past 600)`);
    console.log(`${t}: the computer finishes in ${avg.toFixed(2)} runs; a run from the start ${mean(first).toFixed(0)} m, past 600 m ${mean(late).toFixed(0)} m`);
  }
});

test('runners: the public view, the flash, the playback time, the stats log, and the match data', () => {
  E.setRunConfig(null);
  const st = E.newMatch(lcg(5), { games: ['dash', 'lane'] });
  const i = st.squares.findIndex(s => s.mini.type === 'dash');
  const m = st.squares[i].mini;
  const pm = E.publicMini(m);
  assert.deepEqual(Object.keys(pm).sort(), ['cfg', 'dist', 'runs', 'seed', 'type'], 'the seed is public: the course is no secret');
  assert.equal(E.secretOf(m), null);
  const ob = E.runCourse(m, 'X')[1];
  const r = E.playMove(st, i, { dist: ob.at, ms: Math.round(E.runSecs(m.cfg, 0, ob.at) * 1000) }, lcg(1));
  assert.equal(r.ok, true);
  assert.deepEqual(st.flash.run, { from: 0, to: ob.at, ms: Math.round(E.runSecs(m.cfg, 0, ob.at) * 1000), out: false, done: false, dist: { X: ob.at, O: 0 }, runs: { X: 1, O: 0 }, target: 1000 });
  assert.equal(E.playMs(st.flash), E.RUNT.bar + E.RUNT.hold);
  E.endFlash(st);
  m.dist.O = 999; m.runs.O = 3; m.crashes.O = [120, 410, 760];
  st.turn = 'O';
  const w = E.playMove(st, i, { dist: 1000, ms: 200 }, lcg(2));
  assert.equal(w.flash.kind, 'claim'); assert.equal(E.playMs(w.flash), E.RUNT.bar + E.RUNT.hold + 600);
  assert.deepEqual(st.sqlog[st.sqlog.length - 1], { t: 'dash', end: 'won', w: 'O', X: 1, O: 1, run: { runs: { X: 1, O: 4 }, dist: { X: Math.round(ob.at), O: 1000 }, crashes: { X: [Math.round(ob.at)], O: [120, 410, 760] } } }, 'the square\'s log carries its runs and crashes for the tuning');
  const stats = E.matchStats(st);
  assert.deepEqual(stats.squares[0].run.runs, { X: 1, O: 4 });
  E.endFlash(st);
  const j = st.squares.findIndex(s => s.mini.type === 'lane' && !s.owner);
  st.turn = 'X';
  E.playMove(st, j, 'auto', lcg(3)); E.endFlash(st);
  const open = E.matchStats(st).squares.find(e => e.end === 'open' && e.t === 'lane');
  assert.ok(open && open.run && open.run.runs.X === 1 && open.run.crashes.X.length === 1, 'a square still open reports its runs too');
});

test('runners: the computer against the computer finishes matches of Dash, of Lane Rush and of both with the rest', () => {
  E.setRunConfig(null);
  for (const [games, seed] of [[['dash'], 1], [['lane'], 2], [['dash', 'lane'], 3], [['dash', 'lane', 'ttt', 'bullseye', 'pong'], 4]]) {
    const { st, n } = cpuMatch(games, seed);
    assert.ok(st.winner, `${games.join('+')}: a winner after ${n} moves`);
    assert.ok(n < 400);
    for (const sq of st.squares) if (sq.owner && E.RUN_TYPES.includes(sq.mini.type)) assert.equal(sq.mini.dist[sq.owner], sq.mini.cfg.target, 'a claimed runner square: its owner at the target');
  }
  assert.ok(E.TEST_TYPES.includes('dash') && E.TEST_TYPES.includes('lane'), 'both admin only to begin with');
  assert.ok(E.TYPES.includes('dash') && E.TYPES.includes('lane'));
});
