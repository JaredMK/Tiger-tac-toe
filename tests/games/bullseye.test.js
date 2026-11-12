'use strict';
// Bullseye: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));
const B = E.BULLS, at = (dx, dy) => E.bullsAimAt(B.at[0] + dx, B.at[1] + dy);   // (the move that stops the two lines at that offset from the board's middle)

/* ===================================== Bullseye ===================================== */
test('bullseye: a board on the wall with three rings; a throw is where two lines stopped, { x, y }; bullseye 3, inner ring 2, outer ring 1, off 0; first to 7; every dart stays in', () => {
  const m = E.newMini('bullseye', lcg(1)), c = m.cfg;
  assert.deepEqual([m.v, c, m.pts, m.speed, m.darts, m.n], [3, E.BULL_DEFAULTS, { X: 0, O: 0 }, { X: 1, O: 1 }, [], 0], 'dealt with the config of the day (here the defaults)');
  assert.ok(c.bull < c.mid && c.mid < c.board && c.board * 2 >= B.w * 0.6 && c.board * 2 <= B.w * 0.72, `a board that fills the wall, ${c.board * 2} of its ${B.w} across, its rings inside one another`);
  assert.ok(B.at[1] + c.board * 1.08 < B.wall && B.at[1] - c.board * 1.08 > 0 && B.hand[1] > B.wall && B.hand[1] - (B.at[1] + c.board) > 15, 'the whole board on the wall, the hand well below it');
  for (const hi of [E.BULL_LIMITS.board[1]]) assert.ok(B.at[1] - hi * 1.08 >= 0 && B.at[1] + hi * 1.08 < B.wall && B.at[0] - hi * 1.08 > 0, 'the biggest board the settings allow still fits the wall');
  // the lines cross at a wall point: the fractions of its width and of its height
  assert.deepEqual(E.bullsPoint(0.5, 0.5), [50, 42]); assert.deepEqual(E.bullsPoint(1, 1), [B.w, B.wall]);
  // dead centre: the bullseye, 3; X's lines get faster, O's untouched
  assert.deepEqual(E.applyMove(m, 'X', at(0, 0), lcg(2)), { ok: true, outcome: 'continue', note: 'bull' });
  assert.deepEqual([m.pts.X, m.last.zone, m.last.pts, m.speed.X, m.speed.O], [3, 'bull', 3, c.ramp, 1]);
  assert.ok(Math.hypot(m.last.x - B.at[0], m.last.y - B.at[1]) < 0.2 && m.last.fx === at(0, 0).x && m.last.fy === at(0, 0).y, 'the dart lands exactly where the lines cross: no scatter');
  // the inner ring 2, the outer ring 1, off the board 0 (nothing gets faster for a miss)
  assert.equal(E.applyMove(m, 'O', at(c.bull + 2, 0), lcg(3)).note, 'board'); assert.deepEqual([m.pts.O, m.last.zone, m.speed.O], [2, 'mid', c.ramp]);
  assert.equal(E.applyMove(m, 'O', at(0, c.mid + 3), lcg(4)).note, 'board'); assert.deepEqual([m.pts.O, m.last.zone], [3, 'board']);
  const fast = m.speed.O;
  assert.equal(E.applyMove(m, 'O', at(-(c.board + 3), 0), lcg(5)).note, 'miss'); assert.deepEqual([m.pts.O, m.last.zone, m.speed.O], [3, 'miss', fast]);
  // the rings' edges: on a ring's rim is that ring
  assert.equal(E.bullsScore(c, B.at[0] + c.bull, B.at[1]).pts, 3);
  assert.equal(E.bullsScore(c, B.at[0] + c.bull + 0.01, B.at[1]).pts, 2);
  assert.equal(E.bullsScore(c, B.at[0], B.at[1] - c.mid).pts, 2);
  assert.equal(E.bullsScore(c, B.at[0], B.at[1] - c.mid - 0.01).pts, 1);
  assert.equal(E.bullsScore(c, B.at[0] - c.board, B.at[1]).pts, 1);
  assert.equal(E.bullsScore(c, B.at[0] - c.board - 0.01, B.at[1]).pts, 0);
  // every dart stays where it landed, in order, its thrower's
  assert.deepEqual(m.darts.map(d => d[0]), ['X', 'O', 'O', 'O']); assert.equal(m.n, 4);
  assert.deepEqual(m.darts[3].slice(1), [m.last.x, m.last.y]);
  // X: 3 + 3 + 1 = 7 takes the square
  E.applyMove(m, 'X', at(0, 0), lcg(6));
  const w = E.applyMove(m, 'X', at(0, c.mid + 3), lcg(7));
  assert.deepEqual([w.outcome, m.pts.X], ['win', 7]);
  for (const bad of [0.5, { aim: 0, power: 0.5 }, { x: -0.1, y: 0.5 }, { x: 0.5, y: 1.2 }, { x: 'a', y: 0.5 }, { x: 0.5 }, { x: NaN, y: 0.5 }, null, 'x']) assert.equal(E.applyMove(E.newMini('bullseye', lcg(9)), 'O', bad, lcg(1)).ok, false, `refused: ${JSON.stringify(bad)}`);
  // only the last few darts are kept; the count goes on
  const many = E.newMini('bullseye', lcg(1));
  many.tune = Object.assign({}, many.tune, { goal: 12 });
  for (let k = 0; k < B.keep + 5; k++) E.applyMove(many, k % 2 ? 'O' : 'X', at(-(c.board + 6), 0), lcg(k));
  assert.deepEqual([many.darts.length, many.n], [B.keep, B.keep + 5]);
  // what the players see: everything (nothing is hidden), but not the last throw's own record
  const pub = E.publicMini(m);
  assert.deepEqual([pub.v, pub.cfg, pub.pts, pub.speed, pub.darts.length, pub.n, pub.last], [3, c, { X: 7, O: 3 }, m.speed, 6, 6, undefined]);
});

test('bullseye: the lines: cfg.sweep ms across at the start, as fast up and down, the thrower\'s own getting faster per scoring throw; each throw keeps the sweep it was made at', () => {
  const c = E.BULL_DEFAULTS;
  assert.equal(E.bullsPeriod(c, 1), c.sweep); assert.equal(E.bullsPeriod(c, 2), c.sweep / 2);
  assert.equal(E.bullsPeriodY(1000), Math.round(1000 * B.wall / B.w), 'the same speed up and down: the wall is not as tall as it is wide');
  assert.ok(c.sweep < 1040, 'faster than the first version\'s sweep (the board is bigger)');
  // a line back and forth, a period each way, from its edge
  assert.deepEqual([0, 250, 500, 750, 1000, 1500, 2000].map(t => E.bullsWave(t, 1000)), [0, 0.25, 0.5, 0.75, 1, 0.5, 0]);
  const m = E.newMini('bullseye', lcg(1));
  E.applyMove(m, 'X', at(0, 0), lcg(2));
  assert.equal(m.last.per, c.sweep); assert.ok(m.speed.X > 1);
  E.applyMove(m, 'X', at(0, 0), lcg(3));
  assert.equal(m.last.per, Math.round(c.sweep / c.ramp), 'the next throw at the faster sweep');
  assert.equal(E.applyMove(m, 'O', { x: 0.01, y: 0.01 }, lcg(4)).note, 'miss'); assert.equal(m.last.per, c.sweep, 'O\'s are untouched');
});

test('bullseye: the config (the board\'s three rings, the sweep, the speed-up) is checked value by value and copied into each square as dealt; older squares carry on', () => {
  E.setBullsConfig({ board: 24, mid: 12, bull: 5, sweep: 900, ramp: 1.2 });
  const m = E.newMini('bullseye', lcg(1));
  assert.deepEqual(m.cfg, { board: 24, mid: 12, bull: 5, sweep: 900, ramp: 1.2 });
  E.setBullsConfig({ board: 99, mid: 12, bull: 'x', sweep: 100, ramp: 1.1 });
  assert.deepEqual(E.bullsConfig(), Object.assign({}, E.BULL_DEFAULTS, { mid: 12, ramp: 1.1 }), 'anything off its range is the default');
  E.setBullsConfig({ board: 10, mid: 14, bull: 9 });
  assert.ok(E.bullsConfig().bull < E.bullsConfig().mid && E.bullsConfig().mid < E.bullsConfig().board, 'each ring inside the one round it');
  E.setBullsConfig({ board: 9, bull: 2.5, sweep: 1040, ramp: 1.12 });
  assert.deepEqual(E.bullsConfig(), Object.assign({}, E.BULL_DEFAULTS, { sweep: 1040, ramp: 1.12 }), 'a stored config from the small moving board (no inner ring): its speeds are read, its radii are not this board\'s');
  E.setBullsConfig({ board: 28, mid: 15, bull: 6 });
  assert.deepEqual(E.bullsConfig(), { board: 28, mid: 15, bull: 6, sweep: E.BULL_DEFAULTS.sweep, ramp: E.BULL_DEFAULTS.ramp }, 'the flick\'s config (rings alone): the lines at the defaults');
  E.setBullsConfig(null);
  assert.deepEqual(m.cfg, { board: 24, mid: 12, bull: 5, sweep: 900, ramp: 1.2 }, 'a square keeps the values it was dealt with');
  assert.deepEqual(E.newMini('bullseye', lcg(2)).cfg, E.BULL_DEFAULTS);
  // a square from the flick (v 2: { aim, power }): its points, rings and darts stay; the lines are new
  const flick = { type: 'bullseye', v: 2, cfg: { board: 28, mid: 15, bull: 6 }, pts: { X: 3, O: 1 }, darts: [['X', 50, 38], ['O', 40, 30]], n: 2, last: { by: 'O', aim: 0.1, power: 0.4, x: 40, y: 30, d: 12, zone: 'board', pts: 1 } };
  E.upgradeMini(flick);
  assert.deepEqual([flick.v, flick.pts, flick.cfg, flick.speed, flick.darts.length, flick.n, flick.last], [3, { X: 3, O: 1 }, { board: 28, mid: 15, bull: 6, sweep: E.BULL_DEFAULTS.sweep, ramp: E.BULL_DEFAULTS.ramp }, { X: 1, O: 1 }, 2, 2, null]);
  assert.equal(E.applyMove(flick, 'X', at(0, 0), lcg(3)).ok, true); assert.equal(flick.darts.length, 3);
  // a square from the small moving board (no v): its points and its own speeds stay, the board is on the wall from here
  const old = { type: 'bullseye', cfg: { board: 9, bull: 2.5, sweep: 1040, ramp: 1.12 }, pts: { X: 3, O: 1 }, speed: { X: 1.12, O: 1.12 }, pos: [30, 70], last: { by: 'O', x: 0.3, y: 0.6, at: [30, 72], d: 2, pts: 1, pos: [30, 70], per: 1040 } };
  E.upgradeMini(old);
  assert.deepEqual([old.v, old.pts, old.cfg, old.speed, old.darts, old.n, old.last, old.pos], [3, { X: 3, O: 1 }, Object.assign({}, E.BULL_DEFAULTS, { sweep: 1040, ramp: 1.12 }), { X: 1.12, O: 1.12 }, [], 0, null, undefined]);
  assert.equal(E.applyMove(old, 'X', at(0, 0), lcg(3)).ok, true);
  // and one not yet upgraded is upgraded by its first throw
  const raw = { type: 'bullseye', v: 2, cfg: { board: 32, mid: 17.5, bull: 6.5 }, pts: { X: 2, O: 0 }, darts: [], n: 0, last: null };
  assert.deepEqual(E.publicMini(raw).pts, { X: 2, O: 0 });
  assert.equal(E.applyMove(raw, 'O', at(0, 0), lcg(3)).ok, true); assert.deepEqual([raw.v, raw.darts.length, raw.pts.X], [3, 1, 2]);
  // a square from the very first version (the bar and its hits) plays on too, its hits as points
  const bar = { type: 'bullseye', hits: { X: 2, O: 1 }, speed: { X: 1.5, O: 1 }, last: { by: 'X', at: 0.5, hit: true } };
  E.upgradeMini(bar);
  assert.deepEqual([bar.v, bar.pts, bar.hits, bar.cfg, bar.speed], [3, { X: 2, O: 1 }, undefined, E.BULL_DEFAULTS, { X: 1.5, O: 1 }]);
});

test('bullseye: someone else\'s throw replays its aim, each line stopping exactly where it was stopped, before the dart flies', () => {
  for (const [x, y] of [[0.02, 0.98], [0.39, 0.4], [0.4, 0.41], [0.73, 0.12], [1, 0]]) {
    const A = E.bullsAim({ fx: x, fy: y, per: 1000 });
    assert.ok(A.vx.it <= 1 && A.vy.it <= 1, 'each line goes straight to where it stopped, never past it and back');
    assert.ok(Math.abs(A.vx.it - x) < 0.002 || x < 0.05, `the sideways line stops at ${x} (${A.vx.it})`);
    assert.ok(Math.abs(A.vy.it - y) < 0.002 || y < 0.05, `the up-down line stops at ${y} (${A.vy.it})`);
    assert.ok(A.t1 > 0 && A.h0 > A.t1 && A.t2 > A.h0 && A.fly > A.t2, 'in order: the first line stops, then the second starts and stops, then the dart');
    assert.equal(A.t1, Math.round(1000 * A.vx.it)); assert.equal(A.t2 - A.h0, Math.round(A.perY * A.vy.it));
    assert.equal(A.perY, E.bullsPeriodY(1000));
  }
});

test('bullseye: the throw\'s time: someone else\'s aim first, the flight, the dart sticking; a timeout throws nothing', () => {
  const st = E.newMatch(E.makeRng('dclock'), { games: Object.fromEntries(E.TYPES.map(t => [t, t === 'bullseye'])) });
  E.playMove(st, 4, at(8, -6), E.makeRng('dc'));
  const f = st.flash;
  assert.equal(E.playMs(f), E.bullsAim(f.bull).fly + E.BULLT.fly + E.BULLT.stick + (f.kind === 'claim' ? 600 : 0), 'the move\'s time includes the aim (the turn clock waits for it to play)');
  assert.ok(E.BULLT.fly >= 350 && E.BULLT.fly <= 600 && E.BULLT.stick <= 350, 'a quick flight, a short quiver: no wait that is not the throw');
  assert.deepEqual(E.bullsPlan(900), { pre: 900, hit: 900 + E.BULLT.fly, end: 900 + E.BULLT.fly + E.BULLT.stick });
  const g = f.bull, mini = st.squares[4].mini;
  assert.deepEqual([g.x, g.y, g.fx, g.fy, g.pts, g.zone, g.k, g.total, g.per], [mini.last.x, mini.last.y, mini.last.fx, mini.last.fy, mini.last.pts, mini.last.zone, 1, mini.pts, mini.cfg.sweep], 'the flash carries the throw, its lines, its landing, what it scored and the sweep it ran at');
  const st2 = E.newMatch(lcg(8), { games: ['bullseye'], mode: 'online', timer: 30 });
  const before = JSON.stringify(st2.squares.map(q => [q.mini.pts, q.mini.darts]));
  const t = E.timeoutMove(st2, lcg(9));
  assert.deepEqual([t.ok, t.missed, st2.flash], [true, 'X', null], 'no throw made for the player');
  assert.equal(JSON.stringify(st2.squares.map(q => [q.mini.pts, q.mini.darts])), before);
  const mv = E.randomLegalMove(E.newMini('bullseye', lcg(1)), 'X', lcg(2));
  assert.ok(mv.x >= 0 && mv.x <= 1 && mv.y >= 0 && mv.y <= 1, 'both lines somewhere on the wall');
});

test('bullseye: balance by Monte Carlo: the computer takes 4 to 6 throws, the first mover under 60%, a steady finger beats a loose one, and nobody wins in two', () => {
  const rng = lcg(5);
  const solo = (ms, G) => {                                        // a hand alone on a square: each tap off by a timing error (ms, as Cup Pong's careful flick), which is a distance of the line's speed
    let tot = 0, least = 99;
    for (let g = 0; g < G; g++) {
      const m = E.newMini('bullseye', rng); let n = 0;
      while (m.pts.X < E.tune(m).goal && n < 80) { const u = B.w / E.bullsPeriod(m.cfg, m.speed.X); E.applyMove(m, 'X', at(gauss(rng) * ms * u, gauss(rng) * ms * u), rng); n++; }
      tot += n; least = Math.min(least, n);
    }
    return { mean: tot / G, least };
  };
  const perfect = solo(0, 800), steady = solo(45, 1500), casual = solo(70, 1500), loose = solo(100, 1500);
  const play = (level, G) => {
    let tot = 0, first = 0, least = 99;
    for (let g = 0; g < G; g++) {
      const m = E.newMini('bullseye', rng), n = { X: 0, O: 0 }; let p = 'X';
      for (;;) { const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, null, { level }).move, rng); n[p]++; if (r.outcome === 'win') break; p = p === 'X' ? 'O' : 'X'; }
      tot += n[p]; if (p === 'X') first++; least = Math.min(least, n[p]);
    }
    return { mean: tot / G, first: first / G, least };
  };
  const normal = play('normal', 3000), hard = play('hard', 1500), easy = play('easy', 1000);
  console.log(`Bullseye: alone to 7: perfect timing ${perfect.mean.toFixed(2)} throws, a steady finger (45 ms) ${steady.mean.toFixed(2)}, a casual one (70 ms) ${casual.mean.toFixed(2)}, a loose one (100 ms) ${loose.mean.toFixed(2)}; the computer: Normal's winner ${normal.mean.toFixed(2)} throws, first mover ${(normal.first * 100).toFixed(1)}%; Hard ${hard.mean.toFixed(2)}, ${(hard.first * 100).toFixed(1)}%; Easy ${easy.mean.toFixed(2)}`);
  assert.ok(perfect.least === 3 && steady.least >= 3 && hard.least >= 3, 'never in two throws (3 a dart at most, 7 to win)');
  assert.equal(perfect.mean, 3, 'perfect timing: a bullseye every time, three throws');
  assert.ok(steady.mean > 3.1 && steady.mean < 4, `a steady finger (${steady.mean})`);
  assert.ok(casual.mean > 3.8 && casual.mean < 5.2, `a casual one (${casual.mean})`);
  assert.ok(loose.mean > casual.mean + 1, `a loose one is well behind (${loose.mean})`);
  assert.ok(normal.mean >= 4 && normal.mean <= 6, `Normal's winner (${normal.mean})`);
  assert.ok(normal.first < 0.6, `the first mover (${normal.first})`);
  assert.ok(hard.mean < normal.mean - 0.2 && easy.mean > normal.mean + 0.5, 'Hard is sharper, Easy looser');
  assert.ok(hard.first < 0.65, `Hard against Hard, the first mover (${hard.first})`);
});

test('bullseye: the computer stops its lines at its rates (12% bullseyes, 42% inner ring or better, 80% on the board at the start), slipping as its lines speed up', () => {
  const rng = lcg(5), count = speed => {
    const c = { 3: 0, 2: 0, 1: 0, 0: 0 };
    for (let k = 0; k < 4000; k++) { const m = E.newMini('bullseye', rng); m.speed.X = speed; const r = E.localBest(E.publicMini(m), 'X', rng, null, { level: 'normal' }), [x, y] = E.bullsPoint(r.move.x, r.move.y); c[E.bullsScore(m.cfg, x, y).pts]++; }
    return { bull: c[3] / 4000, mid: c[2] / 4000, board: c[1] / 4000, miss: c[0] / 4000 };
  };
  const start = count(1);
  assert.ok(Math.abs(start.bull - 0.12) < 0.025 && Math.abs(start.mid - 0.3) < 0.03 && Math.abs(start.board - 0.38) < 0.03 && Math.abs(start.miss - 0.2) < 0.03, JSON.stringify(start));
  const fast = count(2);
  assert.ok(fast.miss > start.miss + 0.05, `worse when faster (${JSON.stringify(fast)})`);
  // q: the chance this dart takes the square: none while more than a bullseye short, a real one once within reach
  const pub = E.publicMini(E.newMini('bullseye', lcg(1)));
  assert.equal(E.localBest(pub, 'X', rng, null, { level: 'normal' }).q, 0);
  const near = E.newMini('bullseye', lcg(2)); near.pts.X = 6;
  assert.ok(E.localBest(E.publicMini(near), 'X', rng, null, { level: 'normal' }).q > 0.5);
  assert.ok(E.needsOf(E.publicMini(near), 'X') === 1 && E.needsOf(pub, 'X') >= 4 && E.needsOf(pub, 'X') <= 7, 'the throws it still needs');
  // the levels: Easy a fifth looser, Hard an eighth sharper
  const hit = level => { let n = 0; for (let k = 0; k < 3000; k++) { const m = E.newMini('bullseye', rng), r = E.localBest(E.publicMini(m), 'X', rng, null, { level }), [x, y] = E.bullsPoint(r.move.x, r.move.y); if (E.bullsScore(m.cfg, x, y).pts) n++; } return n / 3000; };
  assert.ok(hit('easy') < hit('normal') - 0.05 && hit('hard') > hit('normal') + 0.04);
});

test('bullseye: the admin\'s Mini-game Settings deal a square that plays by them (points to win, bullseye points, the computer\'s rates); the rates are checked together', () => {
  const M = require('../../src/games/bullseye/meta.js');
  E.setTune('bullseye', { goal: 3, bullPts: 5, aiBull: 50, aiMid: 50, aiBoard: 50 });
  const m = E.newMini('bullseye', lcg(3));
  assert.deepEqual(m.tune, { goal: 3, bullPts: 5, aiBull: 50, aiMid: 50, aiBoard: 50 });
  E.setTune('bullseye', null);
  const res = E.applyMove(m, 'X', at(0, 0), lcg(4));
  assert.deepEqual([m.pts.X, res.outcome, res.note], [5, 'win', 'bull'], 'a bullseye scores 5, and 3 wins (the dealt values, after the settings changed back)');
  const rng = lcg(9); let hit = 0, other = 0;
  for (let k = 0; k < 600; k++) { const g = E.newMini('bullseye', rng); g.tune = { aiBull: 50, aiMid: 50, aiBoard: 50 }; const r = E.localBest(E.publicMini(g), 'X', rng, null, { level: 'normal' }), [x, y] = E.bullsPoint(r.move.x, r.move.y), s = E.bullsScore(g.cfg, x, y).pts; if (s === 3) hit++; else if (s) other++; }
  assert.ok(hit > 240 && hit < 360 && other === 0, `the computer at its set rates (${hit} bullseyes, ${other} other hits of 600)`);
  assert.deepEqual(E.tuneNorm('bullseye', { aiBull: 20, aiMid: 50, aiBoard: 85, flickMin: 0.6 }), { aiBull: 20, aiMid: 50, aiBoard: 85 }, 'the flick\'s settings are gone');
  assert.equal(M.tuneCheck({ aiBull: 20, aiMid: 50, aiBoard: 85 }), null);
  assert.match(M.tuneCheck({ aiBull: 30, aiMid: 20, aiBoard: 85 }), /can't be more/);
  assert.match(M.tuneCheck({ aiBull: 10, aiMid: 90, aiBoard: 85 }), /can't be more/);
});
