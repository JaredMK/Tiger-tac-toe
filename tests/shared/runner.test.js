'use strict';
// What the runners (Dash, Lane Rush, Flap, Chopper) share, tested once for all of them (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const square = (type, seed, from = 0) => ({ type, cfg: E.runConfig(type), seed: { X: seed, O: seed + 1 }, dist: { X: from, O: 0 }, runs: { X: 0, O: 0 }, crashes: { X: [], O: [] } });
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('flap and chopper: a tap flaps (about 1.2 m up), the sky stops the bird, the ground is a crash only past the grace stretch; held the chopper climbs, let go it drops, never faster than its limit', () => {
  const sim = E.runStart(square('flap', 5), 'X');
  assert.equal(sim.y, E.FLAP.h / 2);
  E.runJump(sim); let top = sim.y;
  for (let k = 0; k < 30; k++) { E.runStep(sim, 1 / 60); top = Math.max(top, sim.y); }
  assert.ok(Math.abs(top - E.FLAP.h / 2 - E.FLAP.vy ** 2 / (2 * E.FLAP.g)) < 0.06, `a flap rises ${top - E.FLAP.h / 2}`);
  for (let k = 0; k < 40; k++) { E.runJump(sim); E.runStep(sim, 1 / 30); }
  assert.ok(sim.y <= E.FLAP.h - E.FLAP.box.h / 2 + 1e-9 && !sim.crash, 'the sky stops it');
  const ch = E.runStart(square('chopper', 5), 'X'), y0 = ch.y;
  for (let k = 0; k < 30; k++) E.runStep(ch, 1 / 60);
  assert.equal(ch.y, y0, 'it hovers before the first press');
  E.runJump(ch); for (let k = 0; k < 30; k++) E.runStep(ch, 1 / 60);
  assert.ok(ch.vy > 0 && ch.vy <= E.CHOP.vmax + 1e-9, `climbing at ${ch.vy}`);
  E.runRelease(ch); for (let k = 0; k < 30; k++) E.runStep(ch, 1 / 60);
  assert.ok(ch.vy < 0, 'let go: it drops');
});

test('flap and chopper: the grace stretch is safe with no input, from the start or a saved distance; the crash after it is one the check accepts', () => {
  for (const type of ['flap', 'chopper']) for (let s = 1; s <= 15; s++) for (const f of [0, 0.1375, 0.48, 0.905]) {
    const from = Math.round(f * E.runConfig(type).target * 10) / 10, mini = square(type, s * 31, from), sim = E.runStart(mini, 'X');
    while (!sim.crash && !sim.done && sim.d < from + sim.grace - 0.01) E.runStep(sim, 1 / 60);
    assert.equal(sim.crash, null, `${type} ${s} from ${from}: no crash in the grace stretch`);
    while (!sim.crash && !sim.done) E.runStep(sim, 1 / 60);
    assert.equal(E.runCheck(mini, 'X', E.runResult(sim, false)), null, `${type}: the crash is accepted`);
  }
});

test('flap and chopper: a result is checked: no crash inside the grace stretch, never faster than the course, the finish and a timed-out run accepted', () => {
  for (const type of ['flap', 'chopper']) {
    const mini = square(type, 9, 200), cfg = mini.cfg, g = E.runGrace(cfg, 200), t = d => Math.round(E.runSecs(cfg, 200, d) * 1000);
    assert.equal(E.runCheck(mini, 'X', { dist: 200 + g * 0.5, ms: t(200 + g * 0.5) }), 'course', 'a crash in the grace stretch');
    assert.equal(E.runCheck(mini, 'X', { dist: 200 + g + 30, ms: t(200 + g + 30) }), null, 'a crash past it');
    assert.equal(E.runCheck(mini, 'X', { dist: 200 + g + 30, ms: Math.round(t(200 + g + 30) * 0.5) }), 'fast');
    assert.equal(E.runCheck(mini, 'X', { dist: cfg.target, ms: t(cfg.target) }), null, 'the finish');
    assert.equal(E.runCheck(mini, 'X', { dist: 200 + g * 0.5, ms: t(200 + g * 0.5), out: true }), null, 'the turn ran out mid-run');
    assert.equal(E.runCheck(mini, 'X', { dist: 150, ms: 0 }), 'bad', 'behind the saved distance');
    const auto = E.runAuto(mini, 'X', lcg(3));
    assert.equal(E.runCheck(mini, 'X', auto), null, 'a timed-out player\'s run');
  }
});

test('flap and chopper: the computer finishes in about 4-5 flights (3 to 6)', () => {
  for (const type of ['flap', 'chopper']) {
    const rng = lcg(17), counts = [];
    for (let s = 0; s < 300; s++) {
      const mini = square(type, s + 1);
      let n = 0;
      while (mini.dist.X < mini.cfg.target && n < 40) { const r = E.applyMove(Object.assign(mini, { last: null }), 'X', E.runAi(mini, 'X', rng).move, rng); assert.equal(r.ok, true, r.reason); n++; }
      counts.push(n);
    }
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    assert.ok(mean >= 3 && mean <= 6, `${type}: ${mean.toFixed(2)} flights on average`);
  }
});

test('flap and chopper: a whole square between two computers, through the shared engine', () => {
  for (const type of ['flap', 'chopper']) {
    const st = E.newMatch(lcg(4), { games: [type] }), rr = lcg(5);
    let n = 0;
    while (!st.squares[4].owner && n++ < 60) {
      st.lock = 4;
      const m = E.cpuMove(st, rr), r = E.playMove(st, 4, m.move, rr);
      assert.equal(r.ok, true, `${type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
      E.endFlash(st);
    }
    assert.ok(st.squares[4].owner, `${type}: decided in ${n} moves`);
  }
});

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
