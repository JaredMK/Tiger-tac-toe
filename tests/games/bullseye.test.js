'use strict';
// Bullseye: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

/* ===================================== Bullseye ===================================== */
test('bullseye: a small board on a field, a bullseye in its middle; a throw is where two lines stopped; bullseye 3, board 1, off 0; first to 5; the board moves after every throw', () => {
  const m = E.newMini('bullseye', lcg(1)), c = m.cfg, B = E.BULLS;
  assert.deepEqual(c, E.BULL_DEFAULTS, 'dealt with the config of the day (here the defaults)');
  assert.ok(c.bull < c.board && c.board <= 12, `a small board (${c.board} of ${B.w} across) with a smaller bullseye (${c.bull})`);
  const inside = pos => pos[0] - c.board >= 0 && pos[0] + c.board <= B.w && pos[1] - c.board >= 0 && pos[1] + c.board <= B.h;
  assert.ok(inside(m.pos), 'the whole board on the field');
  const aim = (pos, dx, dy) => ({ x: (pos[0] + dx) / B.w, y: (pos[1] + dy) / B.h });
  // a bullseye: 3, and X's lines get faster; O's untouched
  let pos = m.pos.slice();
  assert.deepEqual(E.applyMove(m, 'X', aim(pos, 0.5, -0.5), lcg(2)), { ok: true, outcome: 'continue', note: 'bull' });
  assert.deepEqual([m.pts.X, m.speed.X, m.speed.O], [3, c.ramp, 1]);
  assert.deepEqual(m.last.pos, pos, 'the throw was scored where the board was');
  assert.ok(Math.hypot(m.pos[0] - pos[0], m.pos[1] - pos[1]) >= Math.min(B.minMove, 30) && inside(m.pos), `then the board moves on (${pos} -> ${m.pos})`);
  // the board (outside the bullseye): 1
  pos = m.pos.slice();
  assert.equal(E.applyMove(m, 'O', aim(pos, c.bull + 1, 0), lcg(3)).note, 'board'); assert.deepEqual([m.pts.O, m.speed.O], [1, c.ramp]);
  // off the board: 0, and nothing gets faster
  pos = m.pos.slice();
  assert.equal(E.applyMove(m, 'O', aim(pos, 0, c.board + 0.5), lcg(4)).note, 'miss'); assert.deepEqual([m.pts.O, m.speed.O], [1, c.ramp]);
  // the edges: on the bullseye's rim is the bullseye; on the board's rim is the board
  pos = m.pos.slice();
  assert.equal(E.bullsScore(c, pos, (pos[0] + c.bull) / B.w, pos[1] / B.h).pts, 3);
  assert.equal(E.bullsScore(c, pos, (pos[0] + c.board) / B.w, pos[1] / B.h).pts, 1);
  assert.equal(E.bullsScore(c, pos, (pos[0] + c.board + 0.01) / B.w, pos[1] / B.h).pts, 0);
  // X: 3 + 1 + 1 = 5 takes the square
  pos = m.pos.slice(); E.applyMove(m, 'X', aim(pos, 0, c.bull + 1), lcg(5));
  pos = m.pos.slice(); const w = E.applyMove(m, 'X', aim(pos, -(c.bull + 1), 0), lcg(6));
  assert.deepEqual([w.outcome, m.pts.X], ['win', 5]);
  for (const bad of [0.5, { x: -0.1, y: 0.5 }, { x: 0.5, y: 1.2 }, { x: 'a', y: 0.5 }, { x: 0.5 }, null, 'x']) assert.equal(E.applyMove(E.newMini('bullseye', lcg(9)), 'O', bad).ok, false, `refused: ${JSON.stringify(bad)}`);
  // the lines: cfg.sweep ms across at the start, cfg.ramp times faster per scoring throw
  assert.equal(E.bullsPeriod(c, 1), c.sweep); assert.equal(E.bullsPeriod(c, 2), c.sweep / 2);
  assert.ok(c.sweep < 2200, 'faster than the old marker (2.2 s across)');
  // the board's spots: always whole on the field, a fair way from the last, and spread round it
  const r = lcg(7); let p0 = E.bullsSpot(c, null, r), sumX = 0;
  for (let k = 0; k < 500; k++) { const p1 = E.bullsSpot(c, p0, r); assert.ok(inside(p1)); assert.ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) >= B.minMove - 1e-9); sumX += p1[0]; p0 = p1; }
  assert.ok(Math.abs(sumX / 500 - B.w / 2) < 6, 'left and right alike');
});

test('bullseye: the config (board, bullseye, sweep, ramp) is checked value by value and copied into each square as dealt; older squares carry on', () => {
  E.setBullsConfig({ board: 12, bull: 3, sweep: 1000, ramp: 1.2 });
  const m = E.newMini('bullseye', lcg(1));
  assert.deepEqual(m.cfg, { board: 12, bull: 3, sweep: 1000, ramp: 1.2 });
  E.setBullsConfig({ board: 99, bull: 'x', sweep: 100, ramp: 1.1 });
  assert.deepEqual(E.bullsConfig(), Object.assign({}, E.BULL_DEFAULTS, { ramp: 1.1 }), 'anything off its range is the default');
  E.setBullsConfig({ board: 6, bull: 8 });
  assert.ok(E.bullsConfig().bull < E.bullsConfig().board, 'the bullseye never as big as the board');
  E.setBullsConfig(null);
  assert.deepEqual(m.cfg, { board: 12, bull: 3, sweep: 1000, ramp: 1.2 }, 'a square keeps the values it was dealt with');
  assert.deepEqual(E.newMini('bullseye', lcg(2)).cfg, E.BULL_DEFAULTS);
  // a square from before (the bar and its hits) plays on as a board in the middle, its hits as points
  const old = { type: 'bullseye', hits: { X: 2, O: 1 }, speed: { X: 1.5, O: 1 }, last: { by: 'X', at: 0.5, hit: true } };
  E.upgradeMini(old);
  assert.deepEqual([old.pts, old.pos, old.hits, old.cfg], [{ X: 2, O: 1 }, [50, 60], undefined, E.BULL_DEFAULTS]);
  assert.equal(E.applyMove(old, 'X', { x: 0.5, y: 0.5 }, lcg(3)).note, 'bull');
});

test('bullseye: the computer lands a bullseye about 15%, the board 45% and misses 40% at the start, slipping as its lines speed up; a timeout throws nothing', () => {
  const rng = lcg(5), count = speed => {
    const c = { 3: 0, 1: 0, 0: 0 };
    for (let k = 0; k < 4000; k++) { const m = E.newMini('bullseye', rng); m.speed.X = speed; const r = E.localBest(E.publicMini(m), 'X', rng); c[E.bullsScore(m.cfg, m.pos, r.move.x, r.move.y).pts]++; }
    return { bull: c[3] / 4000, board: c[1] / 4000, miss: c[0] / 4000 };
  };
  const start = count(1);
  assert.ok(Math.abs(start.bull - 0.15) < 0.025 && Math.abs(start.board - 0.45) < 0.03 && Math.abs(start.miss - 0.4) < 0.03, JSON.stringify(start));
  const fast = count(2);
  assert.ok(fast.miss > start.miss + 0.1, `worse when faster (${JSON.stringify(fast)})`);
  // throws to 5, alone on a square: about 5-7
  const throws = [];
  for (let g = 0; g < 1500; g++) {
    const r = lcg(1000 + g), m = E.newMini('bullseye', r);
    let n = 0;
    while (m.pts.X < 5 && n < 60) { assert.equal(E.applyMove(m, 'X', E.localBest(E.publicMini(m), 'X', r).move, r).ok, true); n++; }
    throws.push(n);
  }
  const mean = throws.reduce((a, b) => a + b, 0) / throws.length;
  assert.ok(mean > 5 && mean < 7.5, `the computer takes ${mean.toFixed(2)} throws to 5`);
  const st = E.newMatch(lcg(8), { games: ['bullseye'], mode: 'online', timer: 30 });
  const before = JSON.stringify(st.squares.map(q => q.mini.pts));
  const t = E.timeoutMove(st, lcg(9));
  assert.deepEqual([t.ok, t.missed, st.flash], [true, 'X', null], 'no throw made for the player');
  assert.equal(JSON.stringify(st.squares.map(q => q.mini.pts)), before);
  const mv = E.randomLegalMove(E.newMini('bullseye', lcg(1)), 'X', lcg(2));
  assert.ok(mv.x >= 0 && mv.x <= 1 && mv.y >= 0 && mv.y <= 1, 'both lines somewhere on the field');
});

/* ===================================== Darts (Bullseye) ===================================== */
test('darts: the lines sweep 25% faster than before (1.04 s across); each throw keeps the sweep it was made at', () => {
  assert.equal(E.BULL_DEFAULTS.sweep, 1040);
  const rng = E.makeRng('dart'), m = E.newMini('bullseye', rng);
  E.applyMove(m, 'X', { x: m.pos[0] / E.BULLS.w, y: m.pos[1] / E.BULLS.h }, rng);   // dead centre: a bullseye, and X's lines speed up
  assert.equal(m.last.per, 1040);
  assert.ok(m.speed.X > 1);
  E.applyMove(m, 'X', { x: 0.01, y: 0.01 }, rng);
  assert.equal(m.last.per, Math.round(1040 / m.speed.X), 'the next throw at the faster sweep');
});
test('darts: someone else\'s throw replays its aim, each line stopping exactly where it was stopped, before the dart flies', () => {
  for (const [x, y] of [[0.02, 0.98], [0.39, 0.4], [0.4, 0.41], [0.73, 0.12], [1, 0]]) {
    const A = E.bullsAim({ x, y, per: 1040 });
    // a line sweeping from its edge, back and forth, for `it` passes: where it ends
    const end = it => { const k = Math.floor(it), f = it - k; return k % 2 ? 1 - f : f; };
    assert.ok(Math.abs(end(A.vx.it) - x) < 0.002, `the sideways line stops at ${x} (${end(A.vx.it)})`);
    assert.ok(Math.abs(end(A.vy.it) - y) < 0.002, `the up-down line stops at ${y} (${end(A.vy.it)})`);
    assert.ok(A.t1 > 0 && A.h0 > A.t1 && A.t2 > A.h0 && A.fly > A.t2, 'in order: the first line stops, then the second starts and stops, then the dart');
    assert.equal(A.t1, Math.round(1040 * A.vx.it)); assert.equal(A.t2 - A.h0, Math.round(A.perY * A.vy.it));
  }
  // the move's time includes the aim (the turn clock waits for it to play)
  const st = E.newMatch(E.makeRng('dclock'), { games: Object.fromEntries(E.TYPES.map(t => [t, t === 'bullseye'])) });
  E.playMove(st, 4, { x: 0.3, y: 0.7 }, E.makeRng('dc'));
  assert.equal(E.playMs(st.flash), E.bullsAim(st.flash.bull).fly + E.BULLT.fly + E.BULLT.hold + (st.flash.kind === 'claim' ? 600 : 0));
});

test('bullseye: the admin\'s Mini-game Settings deal a square that plays by them (points to win, bullseye points, the computer\'s rates)', () => {
  E.setTune('bullseye', { goal: 3, bullPts: 5, aiBull: 50, aiBoard: 0 });
  const m = E.newMini('bullseye', lcg(3));
  assert.deepEqual(m.tune, { goal: 3, bullPts: 5, aiBull: 50, aiBoard: 0 });
  E.setTune('bullseye', null);
  const pos = m.pos.slice(), res = E.applyMove(m, 'X', { x: pos[0] / E.BULLS.w, y: pos[1] / E.BULLS.h }, lcg(4));
  assert.deepEqual([m.pts.X, res.outcome, res.note], [5, 'win', 'bull'], 'a bullseye scores 5, and 3 wins (the dealt values, after the settings changed back)');
  const rng = lcg(9); let hit = 0, board = 0;
  for (let k = 0; k < 400; k++) { const g = E.newMini('bullseye', rng); g.tune = { aiBull: 50, aiBoard: 0 }; const r = E.localBest(E.publicMini(g), 'X', rng), s = E.bullsScore(g.cfg, g.pos, r.move.x, r.move.y).pts; if (s === 3) hit++; else if (s) board++; }
  assert.ok(hit > 150 && hit < 250 && board === 0, `the computer at its set rates (${hit} bullseyes, ${board} board)`);
});
