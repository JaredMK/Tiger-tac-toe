'use strict';
// Run with:  node --test
// Flap and Chopper: the two flying runners on the runner engine (courses, the flight, the checks, the
// computer), and scripted pilots that see the course as the screen shows it and react late: a fair
// course is one they finish.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const square = (type, seed, from = 0) => ({ type, cfg: E.runConfig(type), seed: { X: seed, O: seed + 1 }, dist: { X: from, O: 0 }, runs: { X: 0, O: 0 }, crashes: { X: [], O: [] } });
// Flap: aim a little below the middle of the next gap; flap when, from what it saw `lag` ago, it would sink below it.
function flyFlap(mini, lag) {
  const sim = E.runStart(mini, 'X'), dt = 1 / 60, hist = [];
  for (let n = 0; !sim.crash && !sim.done && n < 60 * 400; n++) {
    hist.push({ y: sim.y, vy: sim.vy }); while (hist.length > Math.round(lag / dt) + 1) hist.shift();
    const o = sim.course.find(q => q.at + E.FLAP.post > sim.d - E.FLAP.box.w / 2), want = o ? o.gy - o.gh * 0.12 : E.FLAP.h / 2;
    const seen = hist[0];
    if (seen.y + seen.vy * 0.12 - 0.5 * E.FLAP.g * 0.0144 < want && sim.vy < 1.5) E.runJump(sim);
    E.runStep(sim, dt);
  }
  return sim;
}
// Chopper: the middle of the corridor just ahead, or the roomier side of a block (chosen once); held while,
// from where it is now (what it saw, then its own presses since), it would stop below that.
function flyChopper(mini, lag) {
  const sim = E.runStart(mini, 'X'), dt = 1 / 60, hist = [], k = Math.round(lag / dt);
  let down = false;
  for (let n = 0; !sim.crash && !sim.done && n < 60 * 400; n++) {
    hist.push({ y: sim.y, vy: sim.vy, down }); while (hist.length > k + 1) hist.shift();
    let y = hist[0].y, vy = hist[0].vy;
    for (let j = 1; j < hist.length; j++) { const a = sim.flown || sim.d >= sim.from + sim.grace ? (hist[j - 1].down ? E.CHOP.up : -E.CHOP.down) : 0; vy = Math.max(-E.CHOP.vmax, Math.min(E.CHOP.vmax, vy + a * dt)); y += vy * dt; }
    const v = E.runSpeed(sim.cfg, sim.d);
    let lo = -Infinity, hi = Infinity;
    for (let t = 0.05; t <= 0.6; t += 0.05) { const [f, c] = E.runWalls(sim, sim.d + v * t); lo = Math.max(lo, f); hi = Math.min(hi, c); }
    let want = (lo + hi) / 2;
    const b = sim.course.find(q => q.at + E.CHOP.bw > sim.d - 0.8 && q.at < sim.d + v);
    if (b) {
      if (!b.side) { let f = -Infinity, c = Infinity; for (let x = b.at - 4; x <= b.at + E.CHOP.bw + 1.5; x += 0.5) { const w = E.runWalls(sim, x); f = Math.max(f, w[0]); c = Math.min(c, w[1]); } b.side = b.y - f > c - (b.y + b.bh) ? 'below' : 'above'; b.f = f; b.c = c; }
      want = b.side === 'below' ? (b.f + b.y) / 2 : (b.y + b.bh + b.c) / 2;
    }
    want = Math.max(lo + 0.55, Math.min(hi - 0.55, want));
    const stop = vy > 0 ? vy * vy / (2 * E.CHOP.down) : -vy * vy / (2 * E.CHOP.up);
    if (y + stop < want && !down) { E.runJump(sim); down = true; } else if (y + stop >= want && down) { E.runRelease(sim); down = false; }
    E.runStep(sim, dt);
  }
  return sim;
}

test('flap: posts every 9-13 m, each gap of the mix\'s size, its middle within reach of the last one\'s and clear of the ground and sky', () => {
  for (let s = 1; s <= 60; s++) {
    const mini = square('flap', s * 101), course = E.runCourse(mini, 'X');
    assert.ok(course.length > 40 && course.length < 70, `${course.length} posts (600 m)`);
    course.forEach((o, k) => {
      assert.ok(Object.values(E.FLAP.gaps).includes(o.gh));
      assert.ok(o.gy - o.gh / 2 >= E.FLAP.margin - 1e-6 && o.gy + o.gh / 2 <= E.FLAP.h - E.FLAP.margin + 1e-6, 'clear of the ground and the sky');
      if (k) { assert.ok(o.at - course[k - 1].at >= 9 - 0.01 && o.at - course[k - 1].at <= 13 + 0.01, 'spacing'); assert.ok(Math.abs(o.gy - course[k - 1].gy) <= E.FLAP.shift + 0.01, 'within reach'); }
    });
    assert.deepEqual(E.runCourse(mini, 'X'), course, 'the same course every time (seeded)');
  }
});

test('chopper: the cave narrows from 7.6 m to 4.4 m and stays in the sky; every block leaves room to pass, all the way in', () => {
  const cfg = E.runConfig('chopper');
  assert.equal(E.caveHeight(cfg, 0), E.CHOP.cave0); assert.equal(E.caveHeight(cfg, cfg.target), E.CHOP.cave1);
  for (let s = 1; s <= 40; s++) {
    const mini = square('chopper', s * 977), cave = E.runCave(mini, 'X'), course = E.runCourse(mini, 'X');
    for (let d = 0; d <= cfg.target; d += 2.5) { const [f, c] = E.caveWalls(cave, cfg, d); assert.ok(f >= -0.01 && c <= E.CHOP.h + 0.01 && c - f >= E.CHOP.cave1 - 2 * E.CHOP.wave - 0.01, `walls at ${d}: ${f} ${c}`); }
    for (const o of course) {
      let f = -Infinity, c = Infinity;
      for (let x = o.at - 4; x <= o.at + E.CHOP.bw + 1.5; x += 0.25) { const w = E.caveWalls(cave, cfg, x); f = Math.max(f, w[0]); c = Math.min(c, w[1]); }
      assert.ok(Math.max(o.y - f, c - (o.y + o.bh)) >= E.CHOP.room - 0.05, `block at ${o.at}: room ${o.y - f} below, ${c - o.y - o.bh} above`);
    }
  }
});

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

test('flap: a pilot that reacts 0.12 s late finishes every course', () => {
  for (let s = 1; s <= 25; s++) { const sim = flyFlap(square('flap', s * 7919), 0.12); assert.ok(sim.done, `course ${s}: crashed at ${Math.round(sim.d)} m (${sim.crash && sim.crash.ob.k})`); }
});

test('chopper: a pilot that reacts 0.1 s late finishes nearly every course (the rest late on, where it is narrow and fast)', () => {
  let fin = 0; const late = [];
  for (let s = 1; s <= 25; s++) { const sim = flyChopper(square('chopper', s * 7919), 0.1); if (sim.done) fin++; else late.push(Math.round(sim.d)); }
  assert.ok(fin >= 23, `${fin}/25 finished (crashes at ${late})`);
  assert.ok(late.every(d => d > 600), `crashes only late on (${late})`);
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
