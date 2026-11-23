'use strict';
// Road Race (December 2026, v 2: a closed circuit from above and a steering wheel; v 3: a crash keeps the lap's
// progress, the next attempt setting off from where the car left the road): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');
const R = require('../../src/games/rally/rules.js');
const M = require('../../src/games/rally/meta.js');

const L = R.RALLY.lock;
// two stretches of a polyline cross (proper crossing of segments a-b and c-d)
const side = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
const cross = (a, b, c, d) => side(...a, ...b, ...c) * side(...a, ...b, ...d) < 0 && side(...c, ...d, ...a) * side(...c, ...d, ...b) < 0;
// a steady hand, forwards or (dir -1) the wrong way round: the wheel that would carry the car through a point ahead
const hand = (c, tr, dir = 1) => (S, w) => { const q = ((S.i + dir * c.look) % tr.n + tr.n) % tr.n, dx = tr.x[q] - S.x, dy = tr.y[q] - S.y; return Math.round(Math.max(-1, Math.min(1, 2 * (S.hx * dy - S.hy * dx) / (dx * dx + dy * dy) * c.speed / c.turn)) * L); };

test('rally: Admin only, skill, real time, held out of Find Match; its settings; a new square', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime], ['admin', 'skill', '1.31.0', false, true]);
  assert.ok(E.FIND_MATCH_HOLD.includes('rally'), 'how fast the steps were played is the phone\'s word');
  assert.deepEqual(E.tuneFields('rally').map(f => f.k), ['laps', 'speed', 'turn', 'width', 'tracks', 'travel', 'aiLapse', 'aiLapseHard', 'aiLapseEasy']);
  const m = E.newMini('rally', E.makeRng('a')), c = R.rallyCfg(m);
  assert.deepEqual([c.laps, c.speed, c.half, c.set, c.travel, c.rot.length], [3, 26, 6, 'mixed', 20, 2 * L + 1]);
  assert.ok(Math.abs(c.turn - 170 * Math.PI / 180) < 1e-12); assert.equal(c.rot[L][0], 0, 'the wheel straight: no turn'); assert.ok(Math.abs(c.rot[L][1] - 1) < 1e-15);
  assert.deepEqual([m.v, m.laps, m.pos, m.n, m.last, Number.isInteger(m.seed)], [3, { X: 0, O: 0 }, { X: 0, O: 0 }, { X: 0, O: 0 }, null, true]);
  assert.deepEqual([R.rallyFrom(m, 'X'), R.rallyFrom(m, 'O')], [0, 0], 'both set off from the line');
  assert.equal(E.secretOf(m), null, 'nothing hidden: the circuit comes from the seed on show');
});

test('rally: the rules\' own path keeps to plain arithmetic (no Math.sin or its kin: the same on every phone and the server)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../src/games/rally/rules.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.equal(/Math\.(sin|cos|tan|asin|acos|atan2?|hypot|pow|exp|log\w*|cbrt|sinh|cosh|tanh|random)\b/.test(src), false);
  for (const a of [-7, -3.2, -1.5708, -0.3, 0, 0.01, 0.7, 1.5708, 2.4, 3.1416, 5, 9.9]) { assert.ok(Math.abs(R.dsin(a) - Math.sin(a)) < 1e-9, `dsin ${a}`); assert.ok(Math.abs(R.dcos(a) - Math.cos(a)) < 1e-9, `dcos ${a}`); }
});

test('rally: every circuit: the same wherever worked out, closed, never crossing itself, inside the frame, its corners gentle enough for the car, its stretches apart; a steady hand laps it', () => {
  const seen = new Set();
  for (const tune of [{ tracks: 'mixed' }, { tracks: 'gentle' }, { tracks: 'twisty' }, { tracks: 'twisty', width: 16 }, { tracks: 'twisty', width: 9 }, { tracks: 'mixed', speed: 45, turn: 120 }, { tracks: 'twisty', speed: 20, turn: 280, width: 8 }]) {
    E.setTune('rally', tune);
    try {
      for (let g = 0; g < 16; g++) {
        const m = E.newMini('rally', E.makeRng('r' + g)), c = R.rallyCfg(m), tr = R.rallyTrack(m), n = tr.n, label = `${JSON.stringify(tune)} circuit ${g}`;
        const again = R.rallyTrack(JSON.parse(JSON.stringify(m))); assert.deepEqual([again.n, again.x, again.y], [tr.n, tr.x, tr.y], 'the same circuit from the same square');
        seen.add(tr.x.slice(0, 6).map(v => v.toFixed(3)).join());
        assert.ok(n >= 150 && n <= 500 && Math.abs(tr.len - n * R.RALLY.sp) < n * 0.02, `${label}: ${n} points round ${tr.len.toFixed(1)}`);
        for (let i = 0; i < n; i++) {                              // closed and evenly walked; inside the frame with grass to spare
          const j = (i + 1) % n, d = Math.hypot(tr.x[j] - tr.x[i], tr.y[j] - tr.y[i]);
          assert.ok(d > 0.8 * R.RALLY.sp && d < 1.2 * R.RALLY.sp, `${label}: step ${i} is ${d.toFixed(3)} long`);
          assert.ok(tr.x[i] - c.half >= R.RALLY.edge - 0.01 && tr.x[i] + c.half <= R.RALLY.W - R.RALLY.edge + 0.01 && tr.y[i] - c.half >= R.RALLY.edge - 0.01 && tr.y[i] + c.half <= R.RALLY.H - R.RALLY.edge + 0.01, `${label}: point ${i} in the frame`);
        }
        const P = []; for (let i = 0; i < n; i += 3) P.push([tr.x[i], tr.y[i]]); P.push(P[0]);
        for (let a = 0; a + 1 < P.length; a++) for (let b = a + 2; b + 1 < P.length; b++) assert.equal(cross(P[a], P[a + 1], P[b], P[b + 1]), false, `${label}: crosses itself`);
        const tight = R.rallyTightest(tr), sharpest = c.speed / c.turn;
        assert.ok(tight >= R.RALLY.grip * sharpest - 1e-9 && tight > c.half + 3.99, `${label}: tightest corner ${tight.toFixed(1)} against the car's ${sharpest.toFixed(1)}`);
        assert.ok(R.rallyApart(tr, 2 * c.half + R.RALLY.gap) >= 2 * c.half + R.RALLY.gap, `${label}: two stretches too near`);
        const S = R.rallyStart(tr); assert.ok(Math.abs(S.hx * S.hx + S.hy * S.hy - 1) < 1e-12 && S.x === tr.x[0] && S.y === tr.y[0] && S.cum === 0);
        const clean = R.rallyRun(c, tr, null, null, hand(c, tr));
        assert.deepEqual([clean.done, clean.crash, clean.pct], [true, false, 100], `${label}: a steady hand gets round`);
        assert.ok(clean.step < R.rallySteps(c, tr) && Math.abs(clean.step - tr.len / c.speed * R.RALLY.hz) < 0.08 * clean.step, `${label}: a lap in ${clean.step} steps`);
        const d = R.rallyDrive(c, tr, E.makeRng('steady'), 0); assert.equal(d.run.done, true, `${label}: the computer, paying attention, gets round`);
      }
    } finally { E.setTune('rally', null); }
  }
  assert.ok(seen.size > 60, `the circuits differ (${seen.size})`);
});

test('rally: the attempt is driven again from its steering: the same log, the same run; off the road is a crash; a lap is the whole way round in order', () => {
  const m = E.newMini('rally', E.makeRng('b')), c = R.rallyCfg(m), tr = R.rallyTrack(m), d = R.rallyDrive(c, tr, E.makeRng('steady'), 0);
  assert.equal(d.run.done, true); assert.ok(d.log.length > 10 && R.rallyLogOk(d.log, d.steps), `a lap's steering: ${d.log.length} changes`);
  const a = R.rallyRun(c, tr, d.log, d.steps), b = R.rallyRun(R.rallyCfg(JSON.parse(JSON.stringify(m))), R.rallyTrack(JSON.parse(JSON.stringify(m))), JSON.parse(JSON.stringify(d.log)), d.steps);
  assert.deepEqual(a, d.run, 'the log drives the lap its hand drove'); assert.deepEqual(b, a, 'and again, to the last bit');
  const short = R.rallyRun(c, tr, d.log, 120); assert.deepEqual([short.done, short.crash, short.step], [false, false, 120], 'an attempt left early: as far as it got'); assert.ok(short.pct > 5 && short.pct < 40);
  for (const w of [L, -L]) { const off = R.rallyRun(c, tr, [[0, w]], 2000); assert.deepEqual([off.done, off.crash], [false, true], 'full lock from the line: off the road'); assert.ok(off.step > 8 && off.step < 80, `in ${off.step} steps`); }
  const none = R.rallyRun(c, tr, [], 5000); assert.deepEqual([none.done, none.crash], [false, true], 'no hand on the wheel: straight on into the grass');
  // cutting across: a car set down on the far side of the circuit has left its own stretch of road, lap or no lap
  const S = R.rallyStart(tr); for (let k = 0; k < 30; k++) R.rallyStep(c, tr, S, hand(c, tr)(S, 0));
  const far = Math.floor(tr.n * 0.75); S.x = tr.x[far]; S.y = tr.y[far];
  assert.equal(R.rallyStep(c, tr, S, 0), 'crash'); assert.ok(S.cum < tr.n * 0.2);
  // the infield: turned in off the road, the attempt is over where it left, never a lap
  let cut = null; for (const w of [L, -L]) { const r = R.rallyRun(c, tr, [[20, w]], 3000); if (!cut || r.step > cut.step) cut = r; }
  assert.deepEqual([cut.done, cut.crash], [false, true]); assert.ok(cut.pct < 30);
  // the wrong way round: all the way, and it is no lap (the attempt runs out of time)
  const T = R.rallyStart(tr); T.hx = -T.hx; T.hy = -T.hy; let end = null, most = 0;
  for (let k = 0; k < 4 * tr.n && !end; k++) { end = R.rallyStep(c, tr, T, hand(c, tr, -1)(T, 0)); most = Math.min(most, T.cum); if (most <= -tr.n - 5) break; }
  assert.equal(end, null, 'backwards round the whole circuit: on the road, and never a lap'); assert.ok(most <= -tr.n - 5);
  const cap = R.rallyRun(c, tr, null, null, () => 0); assert.equal(cap.crash, true);
  assert.equal(R.rallySteps(c, tr), Math.ceil(R.RALLY.over * tr.len / c.speed * R.RALLY.hz), 'an attempt may last 1.6 laps\' worth of time');
});

test('rally: a move is its steering, checked strictly; laps count; first to 3 laps; a square from before is dealt again', () => {
  const m = E.newMini('rally', E.makeRng('c')), c = R.rallyCfg(m), tr = R.rallyTrack(m);
  let r = E.applyMove(m, 'X', { log: [[0, L]], steps: 400 }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.laps.X, m.last.by, m.last.done, m.last.crash, m.last.from, m.last.to, m.last.p0, m.n.X], ['continue', 'crash', false, 0, 'X', false, true, 0, 0, 0, 1]);
  assert.ok(m.last.pct < 20 && m.last.at.length === 4 && m.last.at.every(Number.isFinite));
  const crashedAt = m.pos.X; assert.ok(crashedAt > 2 && crashedAt < tr.n * 0.2, `the crash is kept: ${crashedAt}`);
  r = E.applyMove(m, 'O', { log: [], steps: 0 }, E.makeRng('x')); assert.deepEqual([r.ok, r.note, m.last.pct, m.last.crash, m.n.O, m.pos.O, m.pos.X], [true, 'crash', 0, false, 1, 0, crashedAt], 'an attempt never driven: nothing, and nothing of the other player\'s');
  const before = JSON.stringify(m);
  for (const bad of [null, 'x', 7, {}, { log: [], steps: -1 }, { log: [[0, 2]], steps: 1.5 }, { log: [[5, 3], [3, 2]], steps: 9 }, { log: [[5, 3], [5, 2]], steps: 9 }, { log: [[0, L + 1]], steps: 9 }, { log: [[0, -L - 1]], steps: 9 }, { log: [[0, 0.5]], steps: 9 }, { log: [[-1, 1]], steps: 9 }, { log: [[0.5, 1]], steps: 9 }, { log: 'x', steps: 9 }, { log: [[0]], steps: 9 }, { log: [[0, 1, 2]], steps: 9 }, { log: [], steps: 1e6 }, { log: Array.from({ length: R.RALLY.maxLog + 1 }, (_, k) => [k, k % 2]), steps: 9 }, { steps: 9 }]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad).slice(0, 60));
  assert.equal(JSON.stringify(m), before, 'a refused move changes nothing');
  const lap = () => { const d = R.rallyDrive(c, tr, E.makeRng('steady'), 0, R.rallyFrom(m, 'X')); return E.applyMove(m, 'X', { log: d.log, steps: d.steps }, E.makeRng('x')); };
  r = lap(); assert.deepEqual([r.outcome, r.note, m.laps.X, m.last.done, m.last.pct, m.last.from, m.last.to, m.last.p0, m.pos.X], ['continue', 'lap', 1, true, 100, 0, 1, crashedAt, 0], 'on from the crash to the line: a lap, and the next from the line');
  r = lap(); assert.deepEqual([r.outcome, r.note, m.laps.X, m.last.p0, m.pos.X], ['continue', 'lap', 2, 0, 0]);
  r = lap(); assert.deepEqual([r.outcome, r.note, m.laps.X, m.laps.O], ['win', 'won', 3, 0]);
  // a road up the screen from before the rework
  const old = { type: 'rally', seed: 5, laps: { X: 1, O: 0 }, n: { X: 2, O: 1 }, last: null };
  assert.equal(R.stale(old), true); assert.equal(R.stale(E.newMini('rally', E.makeRng('d'))), false);
  assert.deepEqual(E.applyMove(old, 'X', { log: [], steps: 5 }, E.makeRng('x')), { ok: false, reason: 'stale' });
  const st = E.newMatch(E.makeRng('i'), { games: ['rally'] }); st.squares[3].mini = JSON.parse(JSON.stringify(old));
  const full = E.fullState(JSON.parse(JSON.stringify(E.matchRecord(st))));
  assert.deepEqual([full.squares[3].mini.v, full.squares[3].mini.laps, full.squares[3].mini.pos], [3, { X: 0, O: 0 }, { X: 0, O: 0 }], 'dealt again as the record is read');
});

// a steady hand driving `k` steps from where p got to, then full lock: the steering (the crash a few steps after)
const crashAfter = (c, tr, from, k, side = 1) => { const d = R.rallyDrive(c, tr, E.makeRng('steady'), 0, from), log = d.log.filter(e => e[0] < k); log.push([k, side * L]); return { log, steps: k + 400 }; };
test('rally: a crash keeps the place the car left the road; the next attempt sets off there, in the middle of the road and pointing along it', () => {
  const m = E.newMini('rally', E.makeRng('keep')), c = R.rallyCfg(m), tr = R.rallyTrack(m), n = tr.n;
  const mv = crashAfter(c, tr, 0, 300), run = R.rallyRun(c, tr, mv.log, mv.steps);
  assert.deepEqual([run.done, run.crash], [false, true]); assert.ok(run.cum > n * 0.3 && run.cum < n * 0.8, `got ${run.cum} of ${n}`);
  const r = E.applyMove(m, 'X', mv, E.makeRng('x'));
  assert.deepEqual([r.note, m.pos.X, m.last.pct, m.last.p0, m.pos.O], ['crash', run.cum, Math.round(100 * run.cum / n), 0, 0], 'the lap\'s road so far is kept (the other player\'s is their own)');
  // where the car left the road: the centre line's point it was nearest as it went off
  const off = Math.hypot(tr.x[m.pos.X] - run.x, tr.y[m.pos.X] - run.y); assert.ok(off > c.lim && off < c.lim + 2, `${off.toFixed(2)} from the kept point`);
  for (const at of [m.pos.X, 1, n - 1, Math.floor(n / 2), -5]) {      // set down on the centre line, pointing along the road, the racing way
    const S = R.rallyStart(tr, at), i = (at % n + n) % n, a = (i + 1) % n, b = (i + n - 1) % n;
    assert.deepEqual([S.x, S.y, S.i, S.cum, S.k, S.end], [tr.x[i], tr.y[i], i, at, 0, null], `at ${at}`);
    const fx = tr.x[a] - tr.x[b], fy = tr.y[a] - tr.y[b], f = Math.hypot(fx, fy);
    assert.ok(Math.abs(S.hx * S.hx + S.hy * S.hy - 1) < 1e-12 && (S.hx * fx + S.hy * fy) / f > 0.99999, `at ${at}: along the road`);
    assert.ok((S.hx * (tr.x[a] - tr.x[i]) + S.hy * (tr.y[a] - tr.y[i])) > 0.9, `at ${at}: the racing way, never back`);
  }
  // the next attempt sets off there: a hand that steers through it drives on from the kept point, not the line
  const from = R.rallyFrom(m, 'X'), next = R.rallyRun(c, tr, null, 30, (S, w) => 0, from);
  assert.ok(Math.hypot(next.x - tr.x[from], next.y - tr.y[from]) < 30 * c.v + 1e-9 && Math.hypot(next.x - tr.x[0], next.y - tr.y[0]) > 20, 'on from the crash');
  // the lap counts only once the whole way round is done: driven to just short of the line, it is not one
  const d = R.rallyDrive(c, tr, E.makeRng('steady'), 0, from); assert.equal(d.run.done, true);
  const rest = (n - from) * R.RALLY.sp / c.v; assert.ok(d.steps > 0.85 * rest && d.steps < 1.1 * rest && d.steps < 0.8 * tr.len / c.v, `the rest of the lap only: ${d.steps} steps for ${n - from} points`);
  const short = E.applyMove(JSON.parse(JSON.stringify(m)), 'X', { log: d.log, steps: d.steps - 6 }, E.makeRng('x'));
  assert.equal(short.note, 'crash', 'stopped short of the line: no lap');
  const k2 = JSON.parse(JSON.stringify(m)); E.applyMove(k2, 'X', { log: d.log, steps: d.steps - 6 }, E.makeRng('x'));
  assert.deepEqual([k2.laps.X, k2.last.done, k2.last.crash], [0, false, false]); assert.ok(k2.pos.X > n - 6 && k2.pos.X < n, `waiting just before the line: ${k2.pos.X}`);
  const lap = E.applyMove(m, 'X', { log: d.log, steps: d.steps }, E.makeRng('x'));
  assert.deepEqual([lap.note, m.laps.X, m.pos.X, m.last.pct, m.last.p0], ['lap', 1, 0, 100, from], 'round to the line: a lap, and the next attempt from the line');
  // the whole way round in order, across attempts: three crashes on, then the line
  const t = E.newMini('rally', E.makeRng('keep')); let p = 0;
  for (const k of [90, 140, 120]) { E.applyMove(t, 'O', crashAfter(c, tr, R.rallyFrom(t, 'O'), k, k === 140 ? -1 : 1), E.makeRng('x')); assert.ok(t.pos.O > p, `on: ${p} to ${t.pos.O}`); assert.equal(t.laps.O, 0); p = t.pos.O; }
  const end = R.rallyDrive(c, tr, E.makeRng('steady'), 0, p); E.applyMove(t, 'O', { log: end.log, steps: end.steps }, E.makeRng('x'));
  assert.deepEqual([t.laps.O, t.pos.O, t.n.O, t.laps.X, t.pos.X], [1, 0, 4, 0, 0]);
  // a crash on the line itself waits just before it; a car more than a lap behind the line is kept within one
  assert.deepEqual([R.rallyKeep(tr, n), R.rallyKeep(tr, n + 3), R.rallyKeep(tr, 0), R.rallyKeep(tr, -4), R.rallyKeep(tr, -n), R.rallyKeep(tr, -n - 7)], [n - 1, n - 1, 0, -4, 0, -7]);
  assert.equal(Object.is(R.rallyKeep(tr, -0), -0), false, 'never a -0 on the record');
});

test('rally: the attempt from a kept place is driven again exactly as the phone drove it (the server\'s re-drive)', () => {
  for (let g = 0; g < 12; g++) {
    const m = E.newMini('rally', E.makeRng('re' + g)), c = R.rallyCfg(m), tr = R.rallyTrack(m), hand = R.rallyDrive(c, tr, E.makeRng('h' + g), 3, 0);
    m.pos.X = Math.max(1, Math.min(tr.n - 2, Math.round(hand.run.cum * (g % 2 ? 1 : 0.5))));
    // the phone: the rules' own steps from the kept place, the wheel from a hand, noted whenever it changes
    const S = R.rallyStart(tr, R.rallyFrom(m, 'X')), log = [], rng = E.makeRng('w' + g); let w = 0;
    while (S.k < 900 && !S.end) { const want = Math.round(Math.max(-1, Math.min(1, (rng() - 0.5) * 0.6 + (S.k % 120 < 60 ? 0.2 : -0.2))) * L); if (want !== w) { w = want; log.push([S.k, w]); } R.rallyStep(c, tr, S, w); }
    const server = JSON.parse(JSON.stringify(m)), r = E.applyMove(server, 'X', JSON.parse(JSON.stringify({ log, steps: S.k })), E.makeRng('x'));
    assert.ok(r.ok); const q = v => Math.round(v * 100) / 100 + 0;
    assert.deepEqual(server.last.at, [q(S.x), q(S.y), q(S.hx), q(S.hy)], `square ${g}: where it ended`);
    assert.deepEqual([server.last.crash, server.last.done, server.last.p0], [S.end === 'crash', S.end === 'lap', m.pos.X]);
    assert.equal(server.pos.X, S.end === 'lap' ? 0 : R.rallyKeep(tr, S.cum), `square ${g}: the place kept`);
    const run = R.rallyRun(c, tr, log, S.k, null, m.pos.X); assert.deepEqual([run.x, run.y, run.hx, run.hy, run.cum], [S.x, S.y, S.hx, S.hy, S.cum], 'to the last bit');
  }
});

test('rally: a square dealt as v 2 plays on as before: every attempt from the line, nothing kept, two laps', () => {
  const m = E.newMini('rally', E.makeRng('v2')); delete m.pos; m.v = 2; m.laps.X = 1;
  const c = R.rallyCfg(m), tr = R.rallyTrack(m);
  assert.deepEqual([R.stale(m), c.laps, R.rallyFrom(m, 'X')], [false, 2, 0]);
  let r = E.applyMove(m, 'X', crashAfter(c, tr, 0, 200), E.makeRng('x'));
  assert.deepEqual([r.ok, r.note, 'pos' in m, R.rallyFrom(m, 'X'), m.last.p0], [true, 'crash', false, 0, 0], 'a crash keeps nothing');
  const st = E.newMatch(E.makeRng('i'), { games: ['rally'] }); st.squares[3].mini = JSON.parse(JSON.stringify(m));
  const full = E.fullState(JSON.parse(JSON.stringify(E.matchRecord(st))));
  assert.deepEqual([full.squares[3].mini.v, full.squares[3].mini.laps.X, full.squares[3].mini.n.X], [2, 1, 1], 'not dealt again: it plays on');
  const d = R.rallyDrive(c, tr, E.makeRng('steady'), 0); r = E.applyMove(m, 'X', { log: d.log, steps: d.steps }, E.makeRng('x'));
  assert.deepEqual([r.outcome, m.laps.X, m.last.p0], ['win', 2, 0], 'a whole lap from the line, and its two laps win');
  E.setTune('rally', { laps: 4 }); try { const t = E.newMini('rally', E.makeRng('v2b')); t.v = 2; delete t.pos; assert.equal(R.rallyCfg(t).laps, 4, 'a v 2 square dealt with laps of its own keeps them'); } finally { E.setTune('rally', null); }
});


test('rally: the turns still needed follow the road still to drive (the computer\'s race and the board\'s lead)', () => {
  const A = require('../../src/games/rally/ai.js'), m = E.newMini('rally', E.makeRng('needs')), n = R.rallyTrack(m).n;
  const at = (laps, pos) => { m.laps.X = laps; m.pos.X = pos; return A.needs(m, 'X'); };
  assert.equal(at(0, 0), 6, 'three laps from the line: a turn a lap and a crash a lap at Normal');
  assert.ok(at(0, Math.round(n / 2)) < at(0, 0) && at(0, n - 1) < at(0, Math.round(n / 2)) && at(2, n - 1) > 1 && at(2, n - 1) < 1.01);
  assert.equal(at(3, 0), 0);
  m.laps.X = 2; m.pos.X = Math.round(n * 0.8); const near = A.best(m, 'X', E.makeRng('b'), {}, { level: 'normal' }).q; m.pos.X = 0; const far = A.best(m, 'X', E.makeRng('b'), {}, { level: 'normal' }).q;
  assert.ok(near > far && far > 0.3 && near < 1, `the chance this turn takes the square: ${far.toFixed(2)} from the line, ${near.toFixed(2)} from 80%`);
  m.laps.X = 1; assert.equal(A.best(m, 'X', E.makeRng('b'), {}, { level: 'normal' }).q, 0);
  const v2 = { type: 'rally', v: 2, seed: m.seed, laps: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; assert.equal(A.needs(v2, 'X'), 2 * 2.7, 'a v 2 square: two laps, each from the line');
});

test('rally: the computer by level, its moves always legal; the flash carries the steering; a timeout plays nothing; a square ends, and for a player driving alone', () => {
  const rate = level => { let ok = 0; for (let k = 0; k < 240; k++) { const t = E.newMini('rally', E.makeRng('q' + (k % 40))), rng = E.makeRng(level + k), r = E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng); assert.ok(r.ok); if (t.last.done) ok++; } return ok / 240; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e < n && n < h && e > 0.03 && h < 0.92, `laps finished: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}: never a perfect driver`);
  const st = E.newMatch(E.makeRng('i'), { games: ['rally'] }), p = st.turn, mv = { log: [[3, 2], [9, -1]], steps: 60 };
  assert.ok(E.playMove(st, 4, mv, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.rr).sort(), ['at', 'by', 'crash', 'done', 'from', 'log', 'p0', 'pct', 'steps', 'to']);
  assert.deepEqual([st.flash.rr.log, st.flash.rr.steps, st.squares[4].mini.last.log], [mv.log, 60, undefined], 'the steering rides the flash, not the square');
  assert.equal(R.rallyShowMs(st.flash.rr), R.RALLY.pre + 1000 + R.RALLY.end); assert.ok(E.playMs(st.flash) >= R.rallyShowMs(st.flash.rr), 'the flash lasts the whole drive');
  assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  assert.deepEqual(E.publicMini(st.squares[4].mini), st.squares[4].mini);
  for (let g = 0; g < 30; g++) {                                   // whole squares, by level; then one side never driving
    const rng = E.makeRng('w' + g), t = E.newMini('rally', rng), level = ['easy', 'normal', 'hard'][g % 3], alone = g >= 21; let q = 'X', won = null;
    for (let k = 0; k < 1500 && !won; k++) {
      const mv2 = alone && q === 'O' ? { log: [], steps: 0 } : g % 5 === 4 ? E.randomLegalMove(t, q, rng) : E.localBest(E.publicMini(t), q, rng, {}, { level }).move;
      const r = E.applyMove(t, q, mv2, rng); assert.ok(r.ok, `${level}: ${r.reason}`);
      if (r.outcome === 'win') won = r.winner || q; q = q === 'X' ? 'O' : 'X';
    }
    assert.ok(won, `square ${g} ends`); if (alone) assert.equal(won, 'X');
  }
});
