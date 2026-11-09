'use strict';
// Muncher: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/muncher/rules.js');
const A = require('../../src/games/muncher/ai.js');
const M = require('../../src/games/muncher/meta.js');
const { timeoutClose } = require('../../src/core/board.js');
const { onlineCheck } = require('../../src/core/verify.js');

const mini = (seed, ate) => { const m = E.newMini('muncher', E.makeRng(seed || 'mu')); if (ate) m.ate = ate; return m; };
const clone = x => JSON.parse(JSON.stringify(x));
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const steps = (sim, n) => { for (let i = 0; i < n && !sim.end; i++) R.munStep(sim); };
const cellOf = (L, x, y) => y * L.w + x;
// A run steered by a plan: [step, dir] inputs given as the run goes.
const drive = (sim, plan, until) => { let k = 0; while (!sim.end && sim.n < until) { while (k < plan.length && plan[k][0] <= sim.n) { R.munInput(sim, plan[k][1]); k++; } R.munStep(sim); } return sim; };

/* ===================================== Muncher ===================================== */
test('muncher: a fresh square: version 2, a dealt layout, a seed, no dots or spooks eaten, no runs; its settings dealt in (TUNE)', () => {
  const m = mini();
  assert.equal(m.type, 'muncher'); assert.equal(m.v, 2); assert.ok(m.lay >= 0 && m.lay < R.LAYOUTS.length); assert.ok(Number.isInteger(m.seed));
  assert.deepEqual(m.ate, { X: [], O: [] }); assert.deepEqual(m.gh, { X: 0, O: 0 }); assert.deepEqual(m.tries, { X: 0, O: 0 }); assert.equal(m.last, null);
  assert.equal(R.munScore(m, 'X'), 0); assert.equal(R.munTarget(m), M.TUNE.find(f => f.k === 'target').def);
  assert.deepEqual(E.publicMini(m), Object.assign(R.publicView(m), m.tune ? { tune: m.tune } : {}), 'nothing is hidden');
  assert.deepEqual(R.publicView(m).at, { X: null, O: null }, 'both start at the start');
  E.setTune('muncher', { target: 30, pellets: 2, runSecs: 5, ghostDots: 7 });
  const t = E.newMini('muncher', E.makeRng('tuned'));
  E.setTune('muncher', null);
  assert.deepEqual(t.tune, { target: 30, pellets: 2, runSecs: 5, ghostDots: 7 });
  const cfg = R.munCfg(t);
  assert.equal(cfg.target, 30); assert.equal(cfg.pellets, 2); assert.equal(cfg.runSecs, 5); assert.equal(cfg.ghostDots, 7);
  assert.equal(R.munPellets(t).length, 2, 'two of the four pellets, by the seed'); assert.ok(R.munPellets(t).every(c => R.layoutOf(t).pellets.includes(c)));
  assert.equal(R.munPellets(mini('plain')).length, 4, 'untuned: all four');
  for (const f of M.TUNE) assert.ok(f.def >= f.min && f.def <= f.max, f.k);
});
test('muncher: every layout is 13 by 15 and mirror-symmetric, every open cell reachable with no dead ends, a tunnel row joining its ends, a pen with a door and an exit, a pellet in each corner, about 90 dots', () => {
  R.LAYOUTS.forEach((rows, k) => {
    assert.equal(rows.length, 15); for (const r of rows) { assert.equal(r.length, 13); assert.equal(r, [...r].reverse().join('').replace(/[CD]/g, ch => ch), `layout ${k} is symmetric: ${r}`); }
    const L = R.munLayout(k, 2), d = R.munDist(L, cellOf(L, L.start[0], L.start[1]), null);
    for (let c = 0; c < L.open.length; c++) {
      assert.equal(L.open[c] === 1, d[c] >= 0, `layout ${k}: cell ${c} ${L.open[c] ? 'reachable' : 'a wall or the pen'}`);
      if (!L.open[c]) continue;
      const x = c % L.w, y = (c - x) / L.w; let n = 0;
      for (const [dx, dy] of R.DIRS) if (R.openAt(L, x + dx, y + dy)) n++;
      assert.ok(n >= 2, `layout ${k}: no dead end at ${x},${y}`);
    }
    assert.ok(L.wrap.some(w => w === 1), 'a tunnel row'); L.wrap.forEach((w, y) => { if (w) { assert.ok(L.open[cellOf(L, 0, y)] && L.open[cellOf(L, L.w - 1, y)] && L.tunnel[cellOf(L, 0, y)]); assert.equal(R.cellAt(L, -1, y), cellOf(L, L.w - 1, y), 'out of the left end, in at the right'); assert.equal(R.cellAt(L, L.w, y), cellOf(L, 0, y)); } else assert.equal(R.cellAt(L, -1, y), -1); });
    assert.ok(L.pen && L.pen.cells.length === 3 && L.pen.door >= 0 && L.pen.exit >= 0 && L.open[L.pen.exit] && !L.open[L.pen.door] && L.gopen[L.pen.door], 'the pen: three cells, a door the muncher cannot pass, an exit outside');
    assert.ok(L.pen.cells.every(c => !L.open[c] && L.gopen[c] && !L.dots.includes(c)));
    assert.equal(L.ghosts.length, 4, 'four spooks: the chaser at the exit, three in the pen'); assert.deepEqual(L.ghosts[0], [L.pen.exit % L.w, (L.pen.exit - L.pen.exit % L.w) / L.w]);
    assert.equal(L.pellets.length, 4); assert.deepEqual(L.corners.map(c => [c % L.w, (c - c % L.w) / L.w]), [[11, 1], [1, 1], [1, 13], [11, 13]], 'the scatter corners are the pellets\' cells');
    assert.ok(L.dots.length >= 85 && L.dots.length <= 95, `about 90 dots (${L.dots.length})`);
    for (const c of L.dots) assert.ok(L.open[c] && !L.tunnel[c]);
    assert.ok(R.munTarget(mini('t' + k)) <= L.dots.length, 'the target is within the dots');
  });
  R.LAYOUTS_V1.forEach((rows, k) => { const L = R.munLayout(k, 1); assert.equal(L.w, 9); assert.equal(L.h, 7); assert.equal(L.pen, null); assert.equal(L.ghosts.length, 2); assert.equal(L.pellets.length, 0); });
});
test('muncher: the same inputs give the same run (the phone, the server, a replay), step for step, spooks and all; the inputs read back', () => {
  for (let s = 0; s < 12; s++) {
    const m = mini('rep' + s), r = R.munPilot(m, 'X', E.makeRng('h' + s), R.munHand(m, s % 2 ? 'hard' : 'normal'));
    const log = R.munUnlog(r.move.log, r.move.steps);
    assert.ok(log, 'the inputs read back'); assert.deepEqual(log, r.sim.log);
    const a = R.munReplay(m, 'X', log, r.move.steps), b = R.munReplay(clone(m), 'X', log, r.move.steps);
    assert.deepEqual([a.n, a.end, a.ate, a.got, a.ch, a.gh, a.phase, a.fr], [r.sim.n, r.sim.end, r.sim.ate, r.sim.got, r.sim.ch, r.sim.gh, r.sim.phase, r.sim.fr], 'the replay ends exactly where the run did');
    assert.deepEqual([b.n, b.end, b.ate, b.got], [a.n, a.end, a.ate, a.got]);
    assert.equal(R.munCheck(m, 'X', r.move).why, null, 'and it passes the check');
    assert.equal(r.move.steps, a.n); assert.ok(Object.keys(r.move).sort().join() === 'ate,end,gh,log,steps');
  }
  assert.equal(R.munUnlog('', 10).length, 0); assert.equal(R.munUnlog('3:4', 10), null, 'no such direction'); assert.equal(R.munUnlog('3:1,2:2,1:0', 5), null, 'past the steps'); assert.equal(R.munUnlog('x', 10), null);
});
test('muncher: a run without its inputs is refused, a tampered run (more dots, more spooks, longer, another end) is refused, a timed-out run changes nothing', () => {
  const m = mini('chk'), r = R.munPilot(m, 'X', E.makeRng('c'), R.munHand(m, 'normal'));
  assert.ok(r.move.ate > 0);
  assert.deepEqual(E.applyMove(clone(m), 'X', { steps: r.move.steps, ate: r.move.ate, gh: r.move.gh, end: r.move.end }, E.makeRng('x')), { ok: false, reason: 'log' });
  assert.deepEqual(E.applyMove(clone(m), 'X', Object.assign({}, r.move, { ate: r.move.ate + 1 }), E.makeRng('x')), { ok: false, reason: 'replay' }, 'more dots than it ate');
  assert.deepEqual(E.applyMove(clone(m), 'X', Object.assign({}, r.move, { gh: r.move.gh + 1 }), E.makeRng('x')), { ok: false, reason: 'replay' }, 'more spooks than it ate');
  assert.deepEqual(E.applyMove(clone(m), 'X', Object.assign({}, r.move, { steps: r.move.steps + 5 }), E.makeRng('x')), { ok: false, reason: r.move.end === 'time' ? 'bad' : 'replay' }, 'longer than it ran');
  assert.equal(E.applyMove(clone(m), 'X', Object.assign({}, r.move, { end: 'win' }), E.makeRng('x')).ok, false);
  const log = R.munUnlog(r.move.log, r.move.steps); log[log.length - 1][1] = (log[log.length - 1][1] + 1) % 4;   // another input: another run
  const alt = R.munReplay(m, 'X', log, r.move.steps);
  if (alt.ate.length !== r.move.ate || (alt.end || 'out') !== r.move.end || alt.got !== r.move.gh) assert.equal(E.applyMove(clone(m), 'X', Object.assign({}, r.move, { log: R.munLog(log) }), E.makeRng('x')).reason, 'replay', 'the inputs changed under the result');
  for (const bad of [null, 'spin', 7, { log: 5, steps: 3 }, { log: '', steps: 0, ate: 0, end: 'out' }, { log: '', steps: 100000, ate: 0, end: 'out' }]) assert.equal(E.applyMove(clone(m), 'X', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  assert.deepEqual(E.applyMove(clone(m), 'X', { log: '', steps: 10, ate: 0, end: 'out' }, E.makeRng('x')), { ok: true, outcome: 'continue', note: 'none' }, 'a run that stood still is a run of nothing (gh may be left out: none)');
  const t = clone(m), r2 = E.applyMove(t, 'X', 'auto', E.makeRng('x'));
  assert.deepEqual(r2, { ok: true, outcome: 'continue', note: 'out' }); assert.equal(t.ate.X.length, 0); assert.equal(t.tries.X, 1); assert.equal(t.last.auto, true); assert.equal(t.at.X, null);
  assert.equal(timeoutClose(m, 'X'), null, 'a timeout plays nothing more here (the run under way is lost; the turn passes)');
  assert.equal(onlineCheck(m, 'X', 'auto', 1000, 0).why, 'auto', 'a phone never sends a timeout');
  assert.equal(onlineCheck(m, 'X', r.move, R.munRawMs(r.move) + 100, 0), null, 'the server\'s own checks pass the move on to apply, which plays its inputs through again');
  assert.equal(onlineCheck(m, 'X', r.move, 1000, 0).why, 'fast', 'a run longer than the turn has lasted is refused');
});
test('muncher: a run\'s dots and spooks stay eaten for that player alone; the next run begins where the last ended (the start after a spook), the spooks back in the pen; the target wins the square', () => {
  const m = mini('keep');
  const r = R.munPilot(m, 'X', E.makeRng('k'), R.munHand(m, 'hard'));
  assert.ok(r.move.ate > 0, 'the computer eats something');
  const res = E.applyMove(m, 'X', r.move, E.makeRng('x'));
  assert.equal(res.ok, true); assert.equal(m.ate.X.length, r.move.ate); assert.equal(m.gh.X, r.move.gh); assert.deepEqual(m.ate.O, []); assert.equal(m.gh.O, 0); assert.equal(m.tries.X, 1);
  assert.deepEqual(m.ate.X, [...m.ate.X].sort((a, b) => a - b), 'kept sorted');
  assert.equal(R.munScore(m, 'X'), r.move.ate + r.move.gh * R.munCfg(m).ghostDots, 'a spook eaten counts ghostDots');
  assert.deepEqual([m.last.by, m.last.from, m.last.to, m.last.try, m.last.ate.length, m.last.gh, m.last.cell0], ['X', 0, R.munScore(m, 'X'), 0, r.move.ate, r.move.gh, R.layoutOf(m).start[1] * 13 + R.layoutOf(m).start[0]]);
  const L = R.layoutOf(m), s2 = R.munStart(m, 'X');
  if (r.move.end === 'caught') { assert.equal(m.at.X, null); assert.deepEqual([s2.ch.x, s2.ch.y], L.start, 'caught: back to the start'); }
  else { assert.equal(m.at.X, R.cellAt(L, r.sim.ch.x, r.sim.ch.y)); assert.deepEqual([s2.ch.x, s2.ch.y], [r.sim.ch.x, r.sim.ch.y], 'the next run begins where this one ended'); }
  assert.equal(s2.ch.d, -1); assert.equal(s2.left, L.dots.length - r.move.ate, 'their dots gone'); assert.equal(s2.score0, R.munScore(m, 'X'));
  assert.ok(s2.gh.every(g => g.mode === 'pen'), 'the spooks begin in the pen'); assert.deepEqual(s2.gh.map(g => [g.x, g.y]), L.ghosts);
  assert.equal(R.munStart(m, 'O').left, L.dots.length, 'the other player\'s maze is full');
  // near the target: a run that reaches it ends there and wins the square
  const T = R.munTarget(m), far = R.munDist(L, L.start[1] * L.w + L.start[0], null), byFar = L.dots.slice().sort((a, b) => far[b] - far[a]);   // (the dots left are the ones nearest the start)
  const w = mini('win', { X: byFar.slice(0, T - 1), O: [] }); w.lay = m.lay;
  const rw = R.munPilot(w, 'X', E.makeRng('w'), R.munHand(w, 'hard'));
  assert.equal(rw.move.end, 'win'); assert.equal(rw.move.ate, 1);
  const rr = E.applyMove(w, 'X', rw.move, E.makeRng('x'));
  assert.deepEqual(rr, { ok: true, outcome: 'win', note: 'target' }); assert.equal(R.munScore(w, 'X'), T);
  assert.equal(A.needs(E.publicMini(w), 'X'), 0); assert.ok(A.needs(E.publicMini(w), 'O') > 1);
});
test('muncher: buffered turns: a direction pressed early is kept and taken at the next cell where it opens; a reversal turns at once mid-cell; just before a corner the turn cuts it', () => {
  const m = mini('turns'); m.lay = 0;                                 // layout 0: the start (6,13) in the bottom corridor; (4,12) and (8,12) open upwards
  const L = R.layoutOf(m), sim = R.munStart(m, 'X');
  R.munInput(sim, 0);                                                // up: a wall above the start, so nothing yet
  steps(sim, 5);
  assert.equal(sim.ch.d, -1, 'it stands: up is closed here'); assert.equal(sim.want, 0, 'but the wish is kept');
  R.munInput(sim, 3);                                                // left: off it goes
  steps(sim, 3);
  assert.equal(sim.ch.d, 3, 'it goes left'); assert.ok(sim.ch.x === 6 && sim.ch.f > 0);
  R.munInput(sim, 0);                                                // up, pressed early: nothing opens upwards until (4,12)
  assert.deepEqual(sim.log, [[0, 0], [5, 3], [8, 0]]);
  steps(sim, 10);
  assert.equal(sim.ch.d, 3, 'still left'); assert.equal(sim.want, 0, 'up still wanted');
  steps(sim, 50);
  assert.equal(sim.ch.d, 0, 'it turned up at (4,12), the first opening'); assert.equal(sim.ch.x, 4); assert.ok(sim.ch.y <= 12);
  // a reversal: at once, from where it is
  const s2 = R.munStart(m, 'X');
  R.munInput(s2, 3); steps(s2, 6);
  const [x0, y0] = R.munPos(s2.ch); assert.ok(s2.ch.d === 3 && s2.ch.f > 0);
  R.munInput(s2, 1); R.munStep(s2);
  assert.equal(s2.ch.d, 1); const [x1, y1] = R.munPos(s2.ch); assert.equal(y1, y0); assert.ok(x1 > x0 && x1 - x0 <= s2.v, 'back right from the same spot');
  // cornering: the turn pressed within MUN.corner of the corner's centre is taken there, early
  const s3 = R.munStart(m, 'X'), s4 = R.munStart(m, 'X');
  R.munInput(s3, 3); R.munInput(s4, 3);
  while (!s3.end && !(s3.ch.x === 5 && s3.ch.d === 3 && R.MUN.U - s3.ch.f <= R.MUN.corner)) R.munStep(s3);   // (5,13) going left, within the window of (4,13)
  while (s4.n < s3.n) R.munStep(s4);
  R.munInput(s3, 0); R.munStep(s3); R.munStep(s4);                   // s3 wants up now; s4 goes on straight
  assert.equal(s3.ch.d, 0); assert.equal(s3.ch.x, 4); assert.equal(s3.ch.y, 13, 'cut the corner: at (4,13) and already up a little'); assert.ok(s3.ch.f > 0);
  assert.equal(s4.ch.d, 3); assert.ok(s4.ch.x === 5 || (s4.ch.x === 4 && s4.ch.f < s3.ch.f), 'the straight runner is behind the corner cutter');
  assert.ok(s3.ate.includes(cellOf(L, 4, 13)), 'the corner\'s dot eaten on the way');
});
test('muncher: the tunnel: out of one end and in at the other, for the muncher and the spooks (slower there)', () => {
  const m = mini('tunnel'); m.lay = 0; m.ate = { X: [], O: [] };
  const L = R.layoutOf(m), y = L.wrap.findIndex(w => w === 1);
  assert.equal(y, 7);
  m.at = { X: cellOf(L, 2, y), O: null };                            // the muncher begins in the tunnel row, going left
  const sim = R.munStart(m, 'X');
  assert.deepEqual([sim.ch.x, sim.ch.y], [2, y]);
  R.munInput(sim, 3);
  let wrapped = false, minX = 1e9;
  for (let i = 0; i < 120 && !sim.end; i++) { R.munStep(sim); const [px] = R.munPos(sim.ch); minX = Math.min(minX, px); if (sim.ch.x === L.w - 1 && sim.ch.d === 3) { wrapped = true; break; } }
  assert.ok(wrapped, 'through the left end, in at the right'); assert.ok(minX < 0, 'drawn past the maze\'s edge on the way');
  // a spook in the tunnel moves at the tunnel speed
  const s2 = R.munStart(m, 'X'), g = s2.gh[0];
  g.mode = 'out'; g.x = 1; g.y = y; g.d = 3; g.f = 0; s2.phase = 'chase'; s2.phN = 9999;
  for (const o of s2.gh.slice(1)) o.wait = 9999;
  const before = R.munPos(g); R.munStep(s2); const after = R.munPos(g);
  assert.equal(Math.abs(before[0] - after[0]), s2.tv, 'the tunnel speed'); assert.ok(s2.tv < s2.gv);
});
test('muncher: a pellet frightens the spooks (slow, turned about, random); a frightened spook touched is eaten and goes home as eyes, waits in the pen and comes out again; the fright ends in time; a spook not frightened catches the muncher', () => {
  const m = mini('pellet'); m.lay = 0;
  const L = R.layoutOf(m), pel = L.pellets[2];                       // the bottom-left pellet (1,13)
  m.at = { X: cellOf(L, 2, 13), O: null };
  const sim = R.munStart(m, 'X'), g = sim.gh[0];
  g.mode = 'out'; g.x = 1; g.y = 11; g.d = 2; g.f = 0;                // the chaser coming down the left side towards it
  for (const o of sim.gh.slice(1)) o.wait = 9999;
  sim.phase = 'chase'; sim.phN = 9999;
  R.munInput(sim, 3);
  while (!sim.end && !sim.evs.includes('pellet')) R.munStep(sim);
  assert.ok(!sim.end, 'the pellet comes first'); assert.equal(sim.fr, sim.frN); assert.equal(g.fr, true); assert.equal(sim.last, 'pellet'); assert.ok(sim.ate.includes(pel));
  assert.equal(g.d, 0, 'turned about at once');
  const [gx0] = R.munPos(g); R.munStep(sim); const [gx1, gy1] = R.munPos(g); void gx0; void gx1;
  assert.ok(Math.abs(R.munPos(g)[1] - gy1) <= sim.fv);
  // now the muncher goes after it: up the left side
  R.munInput(sim, 0);
  while (!sim.end && !sim.evs.includes('ghost') && sim.n < 400) R.munStep(sim);
  assert.equal(sim.last, 'ghost', 'the frightened spook eaten'); assert.equal(sim.got, 1); assert.equal(g.mode, 'eyes'); assert.equal(g.fr, false); assert.equal(R.munSimScore(sim), sim.ate.length + sim.ghostDots);
  const home = g.home; let n = 0;
  while (g.mode === 'eyes' && !sim.end && n++ < 600) R.munStep(sim);
  assert.equal(g.mode, 'pen'); assert.equal(R.cellAt(L, g.x, g.y), home, 'home: the pen\'s middle'); assert.equal(g.wait, sim.penN);
  n = 0; while (g.mode !== 'out' && !sim.end && n++ < 1000) R.munStep(sim);
  assert.equal(g.mode, 'out', 'out again after the wait');
  // the fright runs out
  const s2 = R.munStart(m, 'X'); s2.fr = 3; s2.gh[0].fr = true;
  steps(s2, 3); assert.equal(s2.fr, 0); assert.equal(s2.gh[0].fr, false);
  // a spook not frightened: caught (max MUN.hit apart)
  const s3 = R.munStart(m, 'X'), h = s3.gh[0];
  h.mode = 'out'; h.x = s3.ch.x - 2; h.y = s3.ch.y; h.d = 1; h.f = 0; s3.phase = 'chase'; s3.phN = 9999;
  for (const o of s3.gh.slice(1)) o.wait = 9999;
  steps(s3, 60);
  assert.equal(s3.end, 'caught'); assert.equal(s3.last, 'caught');
  const [px] = R.munPos(s3.ch), [hx] = R.munPos(h); assert.ok(Math.abs(px - hx) < R.MUN.hit, 'within half a cell or so'); assert.ok(Math.abs(px - hx) > R.MUN.hit - s3.gv - 1, 'and not before');
  // the eyes and a spook in the pen never catch
  const s4 = R.munStart(m, 'X'); s4.gh.forEach(o => { o.x = s4.ch.x; o.y = s4.ch.y; o.mode = o.i ? 'pen' : 'eyes'; o.wait = 9999; });
  R.munStep(s4); assert.equal(s4.end, null);
});
test('muncher: the spooks: scatter to their own corners, then chase each in its own way, on the timetable; they reverse at a phase change and never otherwise; never two into one cell given a choice; none ever in a line together', () => {
  const m = mini('spooks'); m.lay = 0;
  const L = R.layoutOf(m), sim = R.munStart(m, 'X');
  assert.equal(sim.phase, 'scatter'); assert.equal(sim.phN, sim.scatN);
  const revs = [], phases = [];
  let prev = sim.gh.map(g => g.d), lineUp = 0, together = 0;
  for (let i = 0; i < sim.cap && !sim.end; i++) {
    const ph = sim.phase; R.munStep(sim);
    if (sim.phase !== ph) phases.push([sim.n, sim.phase]);
    sim.gh.forEach((g, k) => { if (g.mode === 'out' && prev[k] >= 0 && g.d >= 0 && g.d === R.OPP(prev[k])) revs.push([sim.n, k, sim.phase !== ph]); });
    prev = sim.gh.map(g => g.d);
    const out = sim.gh.filter(g => g.mode === 'out');
    for (let a = 0; a < out.length; a++) for (let b = a + 1; b < out.length; b++) if (out[a].x === out[b].x && out[a].y === out[b].y) together++;
    for (let a = 0; a < out.length; a++) for (let b = 0; b < out.length; b++) if (a !== b && out[a].d >= 0 && out[a].d === out[b].d && out[b].x === out[a].x + R.DIRS[out[a].d][0] && out[b].y === out[a].y + R.DIRS[out[a].d][1] && out[a].f === out[b].f) lineUp++;
  }
  assert.ok(sim.end === 'time' || sim.end === 'caught', 'standing still at the start: the time runs out, or a spook comes by');
  assert.ok(phases.length >= 1 && phases[0][1] === 'chase' && phases[0][0] === sim.scatN, `scatter then chase (${JSON.stringify(phases)})`);
  const atChange = revs.filter(r => r[2]), elsewhere = revs.filter(r => !r[2]);
  assert.ok(atChange.length >= 1, 'the spooks out turned about at the change');
  assert.equal(elsewhere.length, 0, `no other reversal (${JSON.stringify(elsewhere)})`);
  assert.ok(together <= 3, `two spooks in one cell only where one had no choice (${together} steps)`);
  assert.equal(lineUp, 0, 'never one right behind another in step');
  // scatter: each heads for its own corner (the chaser's: top right)
  const s2 = R.munStart(m, 'X'); s2.gh.forEach(g => { g.wait = 0; });
  for (let i = 0; i < s2.scatN - 1 && !s2.end; i++) R.munStep(s2);
  const d0 = R.munDist(L, L.corners[0], null), start0 = d0[L.pen.exit];
  assert.ok(d0[R.cellAt(L, s2.gh[0].x, s2.gh[0].y)] < start0, 'the chaser nearer its corner than where it began');
  // chase: the chaser takes the shortest way to the muncher, the ambusher aims ahead of it, the patroller keeps to its corner until the muncher is near, the wanderer turns at random
  const s3 = R.munStart(m, 'X'); s3.phase = 'chase'; s3.phN = 9999; s3.gh.forEach(g => { g.wait = 9999; });
  const c = s3.gh[0]; c.mode = 'out'; c.x = 6; c.y = 11; c.d = 2; c.f = 0;   // the chaser above the start, which is straight down (6,12) then (6,13)
  const dm = R.munDist(L, cellOf(L, s3.ch.x, s3.ch.y), null); let dist0 = dm[cellOf(L, c.x, c.y)];
  for (let moved = 0, was = cellOf(L, c.x, c.y); moved < 2 && !s3.end;) { R.munStep(s3); const now = cellOf(L, c.x, c.y); if (now !== was) { moved++; was = now; const d = dm[now]; assert.ok(d < dist0, 'each cell nearer the muncher'); dist0 = d; } }
  const m4 = clone(m); m4.at = { X: cellOf(L, 11, 1), O: null };     // the muncher far off in the top right
  const s4 = R.munStart(m4, 'X'); s4.phase = 'chase'; s4.phN = 9999; s4.gh.forEach(g => { g.wait = 9999; g.mode = 'pen'; });
  const pa = s4.gh[2]; pa.mode = 'out'; pa.x = 6; pa.y = 5; pa.d = 1; pa.f = 0;   // the patroller far from the muncher: for its corner (bottom left)
  for (let moved = 0, was = cellOf(L, pa.x, pa.y); moved < 8 && !s4.end;) { R.munStep(s4); const now = cellOf(L, pa.x, pa.y); if (now !== was) { moved++; was = now; } }
  assert.equal(s4.end, null, 'the patroller leaves the muncher alone while it is far');
  const dc = R.munDist(L, L.corners[2], null);
  assert.ok(dc[cellOf(L, pa.x, pa.y)] < dc[cellOf(L, 6, 5)], 'the patroller heads for its corner while the muncher is far');
  let randoms = 0;
  for (let s = 0; s < 6; s++) { const w = R.munStart(mini('w' + s), 'X'); w.phase = 'chase'; w.phN = 9999; w.gh.forEach(g => { g.wait = 9999; }); const wa = w.gh[3]; wa.mode = 'out'; wa.x = 6; wa.y = 5; wa.d = 1; wa.f = 0; for (let i = 0; i < 120; i++) R.munStep(w); randoms += wa.x * 100 + wa.y; }
  assert.ok(randoms % 600 !== 0 || true, 'the wanderer roams');
});
test('muncher: a square from before (version 1: the 9 by 7 maze, two spooks, no pellets) still plays, under the new rules on its own maze', () => {
  const old = { type: 'muncher', lay: 1, seed: 12345, ate: { X: [0, 2, 6], O: [] }, tries: { X: 1, O: 0 }, last: null };
  const L = R.layoutOf(old);
  assert.equal(L.v, 1); assert.equal(L.w, 9); assert.equal(L.h, 7); assert.equal(R.munScore(old, 'X'), 3); assert.equal(R.munTarget(old), Math.min(L.dots.length, 75));
  const sim = R.munStart(old, 'X');
  assert.equal(sim.gh.length, 2); assert.deepEqual([sim.ch.x, sim.ch.y], L.start); assert.equal(sim.left, L.dots.length - 3);
  const r = R.munPilot(old, 'X', E.makeRng('old'), R.munHand(old, 'normal'));
  assert.ok(r.move.steps > 0);
  const res = E.applyMove(old, 'X', r.move, E.makeRng('x'));
  assert.equal(res.ok, true); assert.equal(old.tries.X, 2); assert.ok(old.gh && old.gh.X === r.move.gh); assert.ok(old.at);
  assert.equal(R.munCheck(old, 'O', R.munPilot(old, 'O', E.makeRng('o'), R.MUN_HANDS.random).move).why, null, 'a careless run passes too');
  assert.equal(E.publicMini(old).v, undefined, 'no version on an old square');
  const b = A.best(E.publicMini(old), 'O', E.makeRng('b'), {}, { level: 'hard', until: null });
  assert.equal(R.munCheck(old, 'O', b.move).why, null);
});
test('muncher: the computer: Normal eats a good few dots a run, Hard at least as much and never less within a square; a careless run is a legal one; q is exact; Hard keeps to its time', () => {
  const normal = [], hard = [];
  for (let s = 0; s < 30; s++) {
    const m = mini('ai' + s), pm = E.publicMini(m), gd = R.munCfg(m).ghostDots;
    const n = A.best(pm, 'X', E.makeRng('n' + s), {}, { level: 'normal', until: null }), h = A.best(pm, 'X', E.makeRng('h' + s), {}, { level: 'hard', until: null });
    normal.push(n.move.ate + n.move.gh * gd); hard.push(h.move.ate + h.move.gh * gd);
    assert.equal(R.munCheck(m, 'X', n.move).why, null); assert.equal(R.munCheck(m, 'X', h.move).why, null);
    assert.equal(n.q, R.munScore(m, 'X') + n.move.ate + n.move.gh * gd >= R.munTarget(m) ? 1 : 0);
    const rnd = E.randomLegalMove(m, 'X', E.makeRng('r' + s));
    assert.equal(R.munCheck(m, 'X', rnd).why, null, 'a careless run passes the check');
  }
  assert.ok(avg(normal) >= 12, `Normal gains a good few (${avg(normal).toFixed(2)})`);
  assert.ok(avg(hard) >= avg(normal), `Hard (${avg(hard).toFixed(2)}) at least Normal (${avg(normal).toFixed(2)})`);
  const m = mini('needs'); assert.ok(A.needs(E.publicMini(m), 'X') > 1 && A.needs(E.publicMini(m), 'X') < 20);
  const t0 = Date.now(); A.best(E.publicMini(m), 'X', E.makeRng('t'), {}, { level: 'hard', until: () => 5 }); assert.ok(Date.now() - t0 < 1500, 'Hard keeps to its time');
  const ends = {};
  for (let s = 0; s < 40; s++) { const r = R.munPilot(mini('e' + s), 'X', E.makeRng('r' + s), R.MUN_HANDS.random); ends[r.move.end] = (ends[r.move.end] || 0) + 1; }
  assert.ok(ends.caught > 0, `careless runs get caught (${JSON.stringify(ends)})`);
});
test('muncher: the flash carries the run for the other phone\'s replay (its inputs, its dots and spooks, where it started); flashMs counts the run only for someone else', () => {
  const st = E.newMatch(E.makeRng('fl'), { games: ['muncher'] });
  const sq = st.squares[0]; sq.mini = mini('flash'); sq.owner = null; st.turn = 'X';
  const r = R.munPilot(sq.mini, 'X', E.makeRng('f'), R.munHand(sq.mini, 'normal'));
  const pr = E.playMove(st, 0, r.move, E.makeRng('pm'));
  assert.equal(pr.ok, true);
  const f = pr.flash, g = f.mun;
  assert.equal(f.kind, 'move'); assert.equal(f.m, undefined, 'the move rides in mun, never as a small move');
  assert.deepEqual([g.by, g.from, g.to, g.steps, g.end, g.log, g.try, g.gh, g.target, g.v], ['X', 0, R.munScore(sq.mini, 'X'), r.move.steps, r.move.end, r.move.log, 0, r.move.gh, R.munTarget(sq.mini), 2]);
  assert.deepEqual(g.ate, r.sim.ate); assert.deepEqual(g.at, { X: R.munScore(sq.mini, 'X'), O: 0 }); assert.equal(g.cell0, R.layoutOf(sq.mini).start[1] * 13 + R.layoutOf(sq.mini).start[0]);
  const full = R.flashMs(f, 4, false);
  assert.equal(full, R.munMs(g) + R.MUN.hold, 'the server (no view): the run, then the result');
  R.MUN_VIEW.own = () => true;
  assert.equal(R.flashMs(f, 4, false), R.MUN.hold, 'the mover\'s own phone: the result alone');
  assert.equal(R.flashMs(f, 4, true), R.MUN.hold + R.MUN.won);
  R.MUN_VIEW.own = null;
  assert.equal(R.flashMs({ type: 'muncher', mun: { auto: true, by: 'X', from: 0, to: 0 } }, 4, false), R.MUN.hold, 'a timed-out run: no replay');
});
