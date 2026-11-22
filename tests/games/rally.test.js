'use strict';
// Road Race (December 2026, v 2: a closed circuit from above and a steering wheel): its rules and computer (npm test).
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
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime], ['admin', 'skill', '1.30.0', false, true]);
  assert.ok(E.FIND_MATCH_HOLD.includes('rally'), 'how fast the steps were played is the phone\'s word');
  assert.deepEqual(E.tuneFields('rally').map(f => f.k), ['laps', 'speed', 'turn', 'width', 'tracks', 'travel', 'aiLapse', 'aiLapseHard', 'aiLapseEasy']);
  const m = E.newMini('rally', E.makeRng('a')), c = R.rallyCfg(m);
  assert.deepEqual([c.laps, c.speed, c.half, c.set, c.travel, c.rot.length], [2, 26, 6, 'mixed', 20, 2 * L + 1]);
  assert.ok(Math.abs(c.turn - 170 * Math.PI / 180) < 1e-12); assert.equal(c.rot[L][0], 0, 'the wheel straight: no turn'); assert.ok(Math.abs(c.rot[L][1] - 1) < 1e-15);
  assert.deepEqual([m.v, m.laps, m.n, m.last, Number.isInteger(m.seed)], [2, { X: 0, O: 0 }, { X: 0, O: 0 }, null, true]);
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

test('rally: a move is its steering, checked strictly; laps count; first to 2 laps; a square from before is dealt again', () => {
  const m = E.newMini('rally', E.makeRng('c')), c = R.rallyCfg(m), tr = R.rallyTrack(m);
  let r = E.applyMove(m, 'X', { log: [[0, L]], steps: 400 }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.laps.X, m.last.by, m.last.done, m.last.crash, m.last.from, m.last.to, m.n.X], ['continue', 'crash', false, 0, 'X', false, true, 0, 0, 1]);
  assert.ok(m.last.pct < 20 && m.last.at.length === 4 && m.last.at.every(Number.isFinite));
  r = E.applyMove(m, 'O', { log: [], steps: 0 }, E.makeRng('x')); assert.deepEqual([r.ok, r.note, m.last.pct, m.last.crash, m.n.O], [true, 'crash', 0, false, 1], 'an attempt never driven: nothing');
  const before = JSON.stringify(m);
  for (const bad of [null, 'x', 7, {}, { log: [], steps: -1 }, { log: [[0, 2]], steps: 1.5 }, { log: [[5, 3], [3, 2]], steps: 9 }, { log: [[5, 3], [5, 2]], steps: 9 }, { log: [[0, L + 1]], steps: 9 }, { log: [[0, -L - 1]], steps: 9 }, { log: [[0, 0.5]], steps: 9 }, { log: [[-1, 1]], steps: 9 }, { log: [[0.5, 1]], steps: 9 }, { log: 'x', steps: 9 }, { log: [[0]], steps: 9 }, { log: [[0, 1, 2]], steps: 9 }, { log: [], steps: 1e6 }, { log: Array.from({ length: R.RALLY.maxLog + 1 }, (_, k) => [k, k % 2]), steps: 9 }, { steps: 9 }]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad).slice(0, 60));
  assert.equal(JSON.stringify(m), before, 'a refused move changes nothing');
  const lap = () => { const d = R.rallyDrive(c, tr, E.makeRng('steady'), 0); return E.applyMove(m, 'X', { log: d.log, steps: d.steps }, E.makeRng('x')); };
  r = lap(); assert.deepEqual([r.outcome, r.note, m.laps.X, m.last.done, m.last.pct, m.last.from, m.last.to], ['continue', 'lap', 1, true, 100, 0, 1]);
  r = lap(); assert.deepEqual([r.outcome, r.note, m.laps.X, m.laps.O], ['win', 'won', 2, 0]);
  // a road up the screen from before the rework
  const old = { type: 'rally', seed: 5, laps: { X: 1, O: 0 }, n: { X: 2, O: 1 }, last: null };
  assert.equal(R.stale(old), true); assert.equal(R.stale(E.newMini('rally', E.makeRng('d'))), false);
  assert.deepEqual(E.applyMove(old, 'X', { log: [], steps: 5 }, E.makeRng('x')), { ok: false, reason: 'stale' });
  const st = E.newMatch(E.makeRng('i'), { games: ['rally'] }); st.squares[3].mini = JSON.parse(JSON.stringify(old));
  const full = E.fullState(JSON.parse(JSON.stringify(E.matchRecord(st))));
  assert.deepEqual([full.squares[3].mini.v, full.squares[3].mini.laps], [2, { X: 0, O: 0 }], 'dealt again as the record is read');
});

test('rally: the computer by level, its moves always legal; the flash carries the steering; a timeout plays nothing; a square ends, and for a player driving alone', () => {
  const rate = level => { let ok = 0; for (let k = 0; k < 240; k++) { const t = E.newMini('rally', E.makeRng('q' + (k % 40))), rng = E.makeRng(level + k), r = E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng); assert.ok(r.ok); if (t.last.done) ok++; } return ok / 240; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e < n && n < h && e > 0.03 && h < 0.92, `laps finished: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}: never a perfect driver`);
  const st = E.newMatch(E.makeRng('i'), { games: ['rally'] }), p = st.turn, mv = { log: [[3, 2], [9, -1]], steps: 60 };
  assert.ok(E.playMove(st, 4, mv, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.rr).sort(), ['at', 'by', 'crash', 'done', 'from', 'log', 'pct', 'steps', 'to']);
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
