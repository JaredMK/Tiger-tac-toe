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

/* ===================================== the log and the replay ===================================== */
test('runners: a run goes in whole fixed steps (the rest of a frame carries over); the inputs it takes are logged at their steps, releases only when something was held; the log reads back, or not at all', () => {
  E.setRunConfig(null);
  assert.equal(E.runLogOf([[10, 'j'], [13, 'r'], [13, 'L'], [66, 'l']]), 'a:j,3:r,0:L,1h:l');
  assert.deepEqual(E.runUnlog('a:j,3:r,0:L,1h:l', 100), [[10, 'j'], [13, 'r'], [13, 'L'], [66, 'l']]);
  assert.deepEqual(E.runUnlog('', 5), [], 'no inputs at all');
  for (const bad of ['a:x', 'a:j,', ':j', 'a:J', '1h:l', 'a:j;3:r', 'zzzzzzz:j', 'a:j,-1:r', 5, null, 'a'.repeat(E.RUN.logMax + 1)]) assert.equal(E.runUnlog(bad, 50), null, `refused: ${JSON.stringify(bad).slice(0, 30)}`);
  const sim = E.runStart(mini('dash', 'steps'), 'X');
  assert.deepEqual([sim.n, sim.acc, sim.rec], [0, 0, []]);
  E.runStep(sim, 1 / 60); assert.equal(sim.n, 4, 'a 60 Hz frame is four whole steps'); assert.ok(sim.acc < 1e-9);
  E.runStep(sim, 0.01); assert.equal(sim.n, 6); E.runStep(sim, 0.01); assert.equal(sim.n, 8); E.runStep(sim, 0.01); assert.equal(sim.n, 11, 'the rest of a frame carries over (2.4 steps: 2, 2, then 3)');
  assert.ok(Math.abs(sim.t - 11 / 240) < 1e-9, 'the time is the steps\'');
  assert.equal(E.runRelease(sim), false, 'nothing held: no release to log');
  assert.ok(E.runJump(sim)); E.runStep(sim, 0.06); assert.equal(E.runRelease(sim), true); assert.ok(!E.runJump(sim), 'in the air');
  assert.deepEqual(sim.rec, [[11, 'j'], [25, 'r']], 'the jump at step 11, the release 14 steps on');
  const ln = E.runStart(mini('lane', 'steps'), 'X');
  E.runStep(ln, 1 / 30); assert.ok(E.runLane(ln, 1)); for (let k = 0; k < 3; k++) E.runStep(ln, 0.1); assert.ok(!E.runLane(ln, 1), 'no lane further right'); assert.ok(E.runLane(ln, -1)); assert.ok(E.runLane(ln, -1), 'a second change, mid-change');
  assert.deepEqual(ln.rec, [[8, 'L'], [80, 'l'], [80, 'l']], 'the changes taken (a second one mid-change too), never one refused');
});

test('runners: the same log replays to the same run on a fresh sim; the computer\'s move for every runner carries a log that replays to its end; the check accepts it and refuses a log whose end, steps or finish do not match', () => {
  E.setRunConfig(null);
  const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (const t of E.RUN_TYPES) {
    const rng = lcg(3);
    for (let s = 0; s < 12; s++) {
      const m = mini(t, 'rep-' + t + s);
      let n = 0;
      while (m.dist.X < m.cfg.target && n++ < 12) {
        const mv = E.runAi(E.publicMini(m), 'X', rng).move;
        assert.ok(typeof mv.log === 'string' && Number.isInteger(mv.steps) && mv.steps > 0, `${t}: a log and its steps (${JSON.stringify(mv).slice(0, 60)})`);
        const log = E.runUnlog(mv.log, mv.steps), sim = E.runReplay(m, 'X', log, mv.steps), again = E.runReplay(m, 'X', log, mv.steps);
        assert.equal(sim.n, mv.steps); assert.equal(E.r2(Math.min(m.cfg.target, sim.d)), mv.dist, `${t}: the replay ends where the move says`);
        assert.equal(sim.done, mv.dist >= m.cfg.target); assert.ok(sim.done || sim.crash, 'at a crash or the finish');
        assert.deepEqual([again.n, again.d, again.y, again.crash], [sim.n, sim.d, sim.y, sim.crash], 'the same again on a fresh sim');
        assert.equal(E.runCheck(m, 'X', mv), null, `${t}: the computer's move passes (${JSON.stringify(mv).slice(0, 80)})`);
        if (n === 1) {
          assert.equal(E.runCheck(m, 'X', Object.assign({}, mv, { dist: E.r2(mv.dist + 0.5) })), mv.dist + 0.5 > m.cfg.target ? 'bad' : 'replay', 'another end');
          assert.equal(E.runCheck(m, 'X', Object.assign({}, mv, { steps: mv.steps - 1 })), 'replay', 'a step short: the run has not ended there');
          assert.equal(E.runCheck(m, 'X', Object.assign({}, mv, { steps: mv.steps + 1 })), 'replay', 'a step long: it ended before');
          if (!sim.done) assert.equal(E.runCheck(m, 'X', Object.assign({}, mv, { dist: m.cfg.target, ms: mv.ms * 10 })), 'replay', 'a finish the log does not reach');
          assert.equal(E.runCheck(m, 'X', Object.assign({}, mv, { log: mv.log + ',zz:q' })), 'bad', 'a malformed log');
          assert.equal(E.runCheck(m, 'X', Object.assign({}, mv, { steps: mv.steps + 0.5 })), 'bad');
          assert.equal(E.runCheck(m, 'X', Object.assign({}, mv, { log: 7 })), 'bad', 'a log that is not a string');
          if (t !== 'chopper') assert.equal(E.runCheck(m, 'X', { dist: mv.dist, ms: mv.ms }), null, 'without the log: the crash checked against the course, as before');
        }
        const r = E.applyMove(m, 'X', mv, rng);
        assert.equal(r.ok, true, r.reason);
        assert.equal(m.last.log, mv.log); assert.equal(m.last.steps, mv.steps, 'the square keeps the log of the last run');
        assert.equal(E.publicMini(m).last, undefined, 'the public view does not carry it');
      }
    }
  }
  // a run of the page's own kind: inputs between frames, the result's log replays to the same end
  const m = mini('dash', 'page'), live = E.runStart(m, 'X');
  for (let k = 0; k < 2000 && !live.crash && !live.done; k++) { if (k % 50 === 20) E.runJump(live); if (k % 50 === 24) E.runRelease(live); E.runStep(live, 1 / 60); }
  const res = E.runResult(live, false), rep = E.runReplay(m, 'X', E.runUnlog(res.log, res.steps), res.steps);
  assert.ok(res.log.length > 0 && res.steps === live.n);
  assert.deepEqual([rep.n, E.r2(Math.min(m.cfg.target, rep.d)), !!rep.crash], [res.steps, res.dist, !!live.crash]);
  assert.equal(E.runCheck(m, 'X', res), null);
  assert.equal(E.runCheck(m, 'X', Object.assign({}, res, { log: res.log.replace(/^[^,]*,/, '') })), 'replay', 'an input dropped: another run');
});

test('runners: a move from a page before the log (no log at all) is checked as it always was: by its distance against the course and its time', () => {
  E.setRunConfig(null);
  const m = mini('dash', 'legacy'), c = E.runCourse(m, 'X'), cfg = m.cfg, first = c[0];
  const okMs = (a, b) => Math.round(E.runSecs(cfg, a, b) * 1000);
  assert.equal(E.runCheck(m, 'X', { dist: first.at + 0.1, ms: okMs(0, first.at + 0.1) + 50 }), null, 'a crash at the first hazard');
  assert.equal(E.runCheck(m, 'X', { dist: (c[0].at + c[1].at) / 2, ms: 99999 }), 'course', 'a crash where there is nothing');
  assert.equal(E.runCheck(m, 'X', { dist: first.at + 0.1, ms: 10 }), 'fast');
  assert.equal(E.runCheck(m, 'X', { dist: cfg.target, ms: okMs(0, cfg.target) }), null, 'the finish');
  assert.equal(E.runCheck(m, 'X', { dist: 30, ms: 99999, out: true }), null, 'cut short by the clock');
  const r = E.applyMove(m, 'X', { dist: first.at + 0.1, ms: okMs(0, first.at + 0.1) + 50 });
  assert.equal(r.ok, true); assert.equal(m.last.log, undefined, 'no log kept'); assert.equal(m.last.steps, undefined);
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
  assert.equal(a.cfg.target, E.RUN_DEFAULTS.dash.target, 'the square dealt earlier keeps its own');
  assert.ok(E.runCourse(b, 'X').every(o => o.k === 'rock' || o.k === 'flyer'), 'the obstacle mix as set');
  assert.ok(E.runCourse(mini('lane', 'cfg-c'), 'O').every(o => o.cars.filter(Boolean).length === 1), 'one car a row when "two" has no weight');
  E.setRunConfig({ dash: { mix: { rock: 0, crate: 0, spike: 0, flyer: 0, pair: 0 } } });
  assert.deepEqual(E.runConfig('dash').mix, E.RUN_DEFAULTS.dash.mix, 'a mix with no weight at all is the default mix');
  E.setRunConfig(null);
});

/* ===================================== the course ===================================== */
test('runners: the speed is tied to the distance; the time a stretch takes and the distance a time allows agree', () => {
  const cfg = E.RUN_DEFAULTS.dash;
  assert.equal(E.runSpeed(cfg, 0), cfg.v0); assert.equal(E.runSpeed(cfg, 400), cfg.v0 + cfg.ramp * 4, 'resuming at 400 m runs at 400 m speed');
  const t = E.runSecs(cfg, 200, 500);
  assert.ok(Math.abs(E.runAfter(cfg, 200, t) - 500) < 1e-6, 'after that long, the run is there');
  assert.ok(E.runSecs(cfg, 0, 100) > E.runSecs(cfg, 900, 1000), 'the last hundred metres go by faster than the first');
  const flat = Object.assign({}, cfg, { ramp: 0 });
  assert.equal(E.runSecs(flat, 0, 80), 80 / cfg.v0); assert.equal(E.runAfter(flat, 0, 10), 10 * cfg.v0, 'with no ramp, a plain constant speed');
  const g0 = E.runGrace(cfg, 0), g7 = E.runGrace(cfg, 700);
  assert.ok(Math.abs(g0 - E.runAfter(cfg, 0, 2)) < 1e-9 && g7 > g0, 'the grace stretch is two seconds at the run\'s speed: longer further along');
});

/* ===================================== the move ===================================== */
test('runners: a move is a run from the saved distance; the crash point is the new saved distance; the speed and the grace stretch follow; the target takes the square', () => {
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
        (from < 100 ? first : from > 0.6 * mm.cfg.target ? late : []).push(mm.dist.X - from);
        n++;
      }
      runs += n;
    }
    const avg = runs / squares, mean = a => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(avg >= 3.8 && avg <= 5.2, `${t}: the computer finishes in ${avg.toFixed(2)} runs on average`);
    assert.ok(mean(late) < mean(first), `${t}: its runs are shorter further along (${mean(first).toFixed(0)} m from the start, ${mean(late).toFixed(0)} m past 60% of the way)`);
    console.log(`${t}: the computer finishes in ${avg.toFixed(2)} runs; a run from the start ${mean(first).toFixed(0)} m, past 60% of the way ${mean(late).toFixed(0)} m`);
  }
});

test('one course per square for both players (Dash, Lane Rush, Flap, Chopper, Sky Hop, Scoop Stack), in a match and in Super Chaos; each player\'s distance stays their own', () => {
  for (const t of ['dash', 'lane', 'flap', 'chopper', 'skyhop', 'scoop']) {
    for (const sc of [false, true]) {
      const st = E.newMatch(E.makeRng('course ' + t));
      const m = sc ? (E.scSquareMini(st, st.squares[0], t, E.makeRng('sc ' + t)), st.squares[0].mini) : mini(t, 'c ' + t);
      assert.equal(m.seed.X, m.seed.O, `${t}${sc ? ' (Super Chaos)' : ''}: one seed`);
      const layout = p => (t === 'skyhop' ? E.hopCourse(m.cfg, m.seed[p]) : t === 'scoop' ? E.scoopItems(m.cfg, m.seed[p], 0, 0) : t === 'chopper' ? [E.runCourse(m, p), E.runCave(m, p)] : E.runCourse(m, p));
      assert.deepEqual(layout('O'), layout('X'), `${t}: the same obstacles for both`);
      assert.notDeepEqual(mini(t, 'other ' + t).seed, m.seed, `${t}: another square, another course`);
    }
  }
  // a run moves only the mover's distance, on the shared course
  const m = mini('dash', 'race');
  for (let k = 0; k < 4; k++) assert.equal(E.applyMove(m, 'X', 'auto', E.makeRng('run' + k)).ok, true);
  assert.ok(m.dist.X > 0 && m.dist.O === 0, `X ${m.dist.X}, O ${m.dist.O}`);
});
