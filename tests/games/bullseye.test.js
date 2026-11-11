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
const B = E.BULLS, at = (dx, dy) => E.bullsAimAt(B.at[0] + dx, B.at[1] + dy);
const exact = () => { E.setTune('bullseye', { spread: 0 }); const m = E.newMini('bullseye', lcg(1)); E.setTune('bullseye', null); return m; };   // a square with no scatter: a dart lands where it is thrown

/* ===================================== Bullseye ===================================== */
test('bullseye: a board on the wall with three rings; a throw is a flick, { aim, power }; bullseye 3, inner ring 2, outer ring 1, off 0; first to 7; every dart stays in', () => {
  const m = exact(), c = m.cfg;
  assert.deepEqual([m.v, c, m.pts, m.darts, m.n], [2, E.BULL_DEFAULTS, { X: 0, O: 0 }, [], 0], 'dealt with the config of the day (here the defaults)');
  assert.ok(c.bull < c.mid && c.mid < c.board && c.board * 2 >= B.w * 0.6 && c.board * 2 <= B.w * 0.72, `a board that fills the wall, ${c.board * 2} of its ${B.w} across, its rings inside one another`);
  assert.ok(B.at[1] + c.board * 1.08 < B.wall && B.at[1] - c.board * 1.08 > 0 && B.hand[1] > B.wall && B.hand[1] - (B.at[1] + c.board) > 15, 'the whole board on the wall, the hand well below it');
  for (const hi of [E.BULL_LIMITS.board[1]]) assert.ok(B.at[1] - hi * 1.08 >= 0 && B.at[1] + hi * 1.08 < B.wall && B.at[0] - hi * 1.08 > 0, 'the biggest board the settings allow still fits the wall');
  // dead centre: the bullseye, 3
  assert.deepEqual(E.applyMove(m, 'X', at(0, 0), lcg(2)), { ok: true, outcome: 'continue', note: 'bull' });
  assert.deepEqual([m.pts.X, m.last.zone, m.last.pts], [3, 'bull', 3]);
  assert.ok(Math.hypot(m.last.x - B.at[0], m.last.y - B.at[1]) < 0.2, 'no scatter: it lands where it was thrown');
  // the inner ring 2, the outer ring 1, off the board 0
  assert.equal(E.applyMove(m, 'O', at(c.bull + 2, 0), lcg(3)).note, 'board'); assert.deepEqual([m.pts.O, m.last.zone], [2, 'mid']);
  assert.equal(E.applyMove(m, 'O', at(0, c.mid + 3), lcg(4)).note, 'board'); assert.deepEqual([m.pts.O, m.last.zone], [3, 'board']);
  assert.equal(E.applyMove(m, 'O', at(-(c.board + 3), 0), lcg(5)).note, 'miss'); assert.deepEqual([m.pts.O, m.last.zone], [3, 'miss']);
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
  for (const bad of [0.5, { x: 0.5, y: 0.5 }, { aim: 'a', power: 0.5 }, { aim: 0.1 }, { aim: NaN, power: 1 }, null, 'x']) assert.equal(E.applyMove(E.newMini('bullseye', lcg(9)), 'O', bad, lcg(1)).ok, false, `refused: ${JSON.stringify(bad)} (the old two-line stop too)`);
  // a throw off its range is kept to it
  const far = E.newMini('bullseye', lcg(3)); E.applyMove(far, 'X', { aim: 9, power: -4 }, lcg(4));
  assert.deepEqual([far.last.aim, far.last.power], [1, 0]);
  // only the last few darts are kept; the count goes on
  const many = exact();
  many.tune = Object.assign({}, many.tune, { goal: 12 });
  for (let k = 0; k < B.keep + 5; k++) E.applyMove(many, k % 2 ? 'O' : 'X', at(-(c.board + 6), 0), lcg(k));
  assert.deepEqual([many.darts.length, many.n], [B.keep, B.keep + 5]);
  // what the players see: everything (nothing is hidden), but not the last throw's own record
  const pub = E.publicMini(m);
  assert.deepEqual([pub.v, pub.cfg, pub.pts, pub.darts.length, pub.n, pub.last], [2, c, { X: 7, O: 3 }, 6, 6, undefined]);
});

test('bullseye: the dart lands where the flick sends it, give or take the square\'s scatter (the move\'s rng: the server\'s online)', () => {
  const m = E.newMini('bullseye', lcg(1)), spread = E.tune(m).spread, rng = lcg(77), N = 4000;
  assert.equal(spread, 5);
  let sx = 0, sy = 0, vx = 0, vy = 0;
  const a = at(6, -9), [tx, ty] = E.bullsPoint(a.aim, a.power);
  assert.ok(Math.hypot(tx - (B.at[0] + 6), ty - (B.at[1] - 9)) < 0.25, 'the throw aimed at a wall point is thrown at it');
  for (let k = 0; k < N; k++) { const [x, y] = E.bullsThrow(a.aim, a.power, rng, E.tune(m)); sx += x - tx; sy += y - ty; vx += (x - tx) ** 2; vy += (y - ty) ** 2; }
  assert.ok(Math.abs(sx / N) < 0.2 && Math.abs(sy / N) < 0.2, 'centred on the aim');
  assert.ok(Math.abs(Math.sqrt(vx / N) - spread) < 0.2 && Math.abs(Math.sqrt(vy / N) - spread) < 0.2, `scattered by ${spread} either way`);
  // the same throw with the same rng is the same dart (the phones and the server agree)
  assert.deepEqual(E.bullsThrow(0.1, 0.5, lcg(5), { spread: 5 }), E.bullsThrow(0.1, 0.5, lcg(5), { spread: 5 }));
  // the distance: power 0 drops it at the thrower's feet, power 1 sends it over the wall's top; the board from about a sixth to two thirds of the way
  assert.deepEqual(E.bullsPoint(0, 0), B.hand.slice());
  assert.ok(E.bullsPoint(0, 1)[1] < 0, 'the hardest flick flies over the wall');
  const lo = at(0, m.cfg.board).power, mid = at(0, 0).power, hi = at(0, -m.cfg.board).power;
  assert.ok(lo > 0.1 && lo < 0.25 && mid > 0.33 && mid < 0.5 && hi > 0.55 && hi < 0.75 && at(0, 0).aim === 0, `the board's bottom, middle and top at ${lo}, ${mid}, ${hi} of the flick's range`);
  // the widest throw reaches past the board's sides
  assert.ok(E.bullsPoint(1, mid)[0] > B.at[0] + m.cfg.board && E.bullsPoint(-1, mid)[0] < B.at[0] - m.cfg.board);
});

test('bullseye: the flick maps exactly and predictably: the swipe\'s line is the throw\'s line, the finger\'s speed its height', () => {
  const t = E.tuneDefaults('bullseye');
  assert.equal(E.bullsFlick(0, 10, 1, t), null, 'too short: not a throw');
  assert.equal(E.bullsFlick(100, 40, 1, t), null, 'sideways: not a throw');
  assert.equal(E.bullsFlick(0, -80, 1, t), null, 'downwards: not a throw');
  assert.deepEqual(E.bullsFlick(0, 120, (t.flickMin + t.flickMax) / 2, t), { aim: 0, power: 0.5 }, 'straight up at the middle speed: straight up, half way');
  // the dart is thrown along the line the finger drew: the aimed point lies on the ray from the hand at the swipe's angle
  for (const [dx, dy] of [[30, 120], [-45, 90], [10, 200], [-80, 160], [60, 110]]) {
    const r = E.bullsFlick(dx, dy, 1.1, t), [x, y] = E.bullsPoint(r.aim, r.power);
    assert.ok(Math.abs(Math.atan2(x - B.hand[0], B.hand[1] - y) - Math.atan2(dx, dy)) < 0.002, `(${dx}, ${dy}): the throw's angle is the swipe's`);
    assert.equal(r.power, E.bullsFlick(0, 80, 1.1, t).power, 'the height is the speed\'s alone, whatever the direction or the swipe\'s length');
  }
  // left and right alike; never wider than the widest throw
  assert.equal(E.bullsFlick(40, 100, 1, t).aim, -E.bullsFlick(-40, 100, 1, t).aim);
  assert.equal(E.bullsFlick(170, 100, 1, t).aim, 1);
  // the speed: flickMin the lowest throw, flickMax the highest, straight between, and no more beyond
  assert.equal(E.bullsFlick(0, 100, t.flickMin, t).power, 0); assert.equal(E.bullsFlick(0, 100, 0.01, t).power, 0);
  assert.equal(E.bullsFlick(0, 100, t.flickMax, t).power, 1); assert.equal(E.bullsFlick(0, 100, 9, t).power, 1);
  let prev = -1;
  for (let v = t.flickMin; v <= t.flickMax + 1e-9; v += 0.1) { const p = E.bullsFlick(0, 100, v, t).power; assert.ok(p > prev, 'faster is higher'); prev = p; }
  // the admin's feel: a higher top speed needs a faster flick; the gain widens the angle
  assert.ok(E.bullsFlick(0, 100, 1.2, Object.assign({}, t, { flickMax: 3 })).power < E.bullsFlick(0, 100, 1.2, t).power);
  assert.ok(E.bullsFlick(20, 100, 1, Object.assign({}, t, { angleGain: 2 })).aim > E.bullsFlick(20, 100, 1, t).aim * 1.8);
  // the scene on the screen: one scale, the whole of it on the canvas at any phone's size
  for (const [W, H] of [[330, 380], [366, 590], [300, 300], [600, 500]]) {
    const G = E.bullsGeom(W, H);
    assert.ok(G.ox >= -1e-9 && G.oy >= -1e-9 && G.ox + B.w * G.k <= W + 1e-9 && G.oy + B.h * G.k <= H + 1e-9, `${W}x${H}: the scene fits`);
  }
});

test('bullseye: the config (the board\'s three rings) is checked value by value and copied into each square as dealt; older squares carry on', () => {
  E.setBullsConfig({ board: 24, mid: 12, bull: 5 });
  const m = E.newMini('bullseye', lcg(1));
  assert.deepEqual(m.cfg, { board: 24, mid: 12, bull: 5 });
  E.setBullsConfig({ board: 99, mid: 12, bull: 'x' });
  assert.deepEqual(E.bullsConfig(), Object.assign({}, E.BULL_DEFAULTS, { mid: 12 }), 'anything off its range is the default');
  E.setBullsConfig({ board: 10, mid: 14, bull: 9 });
  assert.ok(E.bullsConfig().bull < E.bullsConfig().mid && E.bullsConfig().mid < E.bullsConfig().board, 'each ring inside the one round it');
  E.setBullsConfig({ board: 9, bull: 2.5, sweep: 1040, ramp: 1.12 });
  assert.deepEqual(E.bullsConfig(), E.BULL_DEFAULTS, 'a stored config from before the rework (no inner ring: the small moving board) is ignored');
  E.setBullsConfig(null);
  assert.deepEqual(m.cfg, { board: 24, mid: 12, bull: 5 }, 'a square keeps the values it was dealt with');
  assert.deepEqual(E.newMini('bullseye', lcg(2)).cfg, E.BULL_DEFAULTS);
  // a square from before the rework (the board that moved, the two lines): its points stay, the board on the wall from here
  const old = { type: 'bullseye', cfg: { board: 9, bull: 2.5, sweep: 1040, ramp: 1.12 }, pts: { X: 3, O: 1 }, speed: { X: 1.12, O: 1.12 }, pos: [30, 70], last: { by: 'O', x: 0.3, y: 0.6, at: [30, 72], d: 2, pts: 1, pos: [30, 70], per: 1040 } };
  E.upgradeMini(old);
  assert.deepEqual([old.v, old.pts, old.cfg, old.darts, old.n, old.last, old.pos, old.speed], [2, { X: 3, O: 1 }, E.BULL_DEFAULTS, [], 0, null, undefined, undefined]);
  assert.equal(E.applyMove(old, 'X', at(0, 0), lcg(3)).ok, true);
  // and one not yet upgraded is upgraded by its first throw
  const raw = { type: 'bullseye', cfg: { board: 9, bull: 2.5, sweep: 1040, ramp: 1.12 }, pts: { X: 2, O: 0 }, speed: { X: 1, O: 1 }, pos: [50, 60], last: null };
  assert.deepEqual(E.publicMini(raw).pts, { X: 2, O: 0 });
  assert.equal(E.applyMove(raw, 'O', at(0, 0), lcg(3)).ok, true); assert.deepEqual([raw.v, raw.darts.length, raw.pts.X], [2, 1, 2]);
  // a square from the very first version (the bar and its hits) plays on too, its hits as points
  const bar = { type: 'bullseye', hits: { X: 2, O: 1 }, speed: { X: 1.5, O: 1 }, last: { by: 'X', at: 0.5, hit: true } };
  E.upgradeMini(bar);
  assert.deepEqual([bar.v, bar.pts, bar.hits, bar.cfg], [2, { X: 2, O: 1 }, undefined, E.BULL_DEFAULTS]);
});

test('bullseye: the throw\'s time: someone else\'s flick first, the flight, the dart sticking; a timeout throws nothing', () => {
  const st = E.newMatch(E.makeRng('dclock'), { games: Object.fromEntries(E.TYPES.map(t => [t, t === 'bullseye'])) });
  E.playMove(st, 4, at(0, 0), E.makeRng('dc'));
  const f = st.flash;
  assert.equal(E.playMs(f), E.BULLT.pre + E.BULLT.fly + E.BULLT.stick + (f.kind === 'claim' ? 600 : 0));
  assert.ok(E.BULLT.fly >= 350 && E.BULLT.fly <= 600 && E.BULLT.stick <= 350, 'a quick flight, a short quiver: no wait that is not the throw');
  assert.deepEqual(E.bullsPlan(280), { pre: 280, hit: 280 + E.BULLT.fly, end: 280 + E.BULLT.fly + E.BULLT.stick });
  const g = f.bull, mini = st.squares[4].mini;
  assert.deepEqual([g.x, g.y, g.pts, g.zone, g.k, g.total], [mini.last.x, mini.last.y, mini.last.pts, mini.last.zone, 1, mini.pts], 'the flash carries the throw, its landing and what it scored');
  const st2 = E.newMatch(lcg(8), { games: ['bullseye'], mode: 'online', timer: 30 });
  const before = JSON.stringify(st2.squares.map(q => [q.mini.pts, q.mini.darts]));
  const t = E.timeoutMove(st2, lcg(9));
  assert.deepEqual([t.ok, t.missed, st2.flash], [true, 'X', null], 'no throw made for the player');
  assert.equal(JSON.stringify(st2.squares.map(q => [q.mini.pts, q.mini.darts])), before);
  const mv = E.randomLegalMove(E.newMini('bullseye', lcg(1)), 'X', lcg(2));
  assert.ok(Math.abs(mv.aim) <= 1 && mv.power >= 0 && mv.power <= 1, 'a random throw is a real one');
});

test('bullseye: balance by Monte Carlo: the computer takes 4 to 6 throws, the first mover under 60%, a careful finger beats a sloppy one, and nobody wins in two', () => {
  const rng = lcg(5);
  const solo = (ea, ep, G) => {                                    // a hand alone on a square: its error on the aim and the power (as Cup Pong's careful flick)
    let tot = 0, least = 99;
    for (let g = 0; g < G; g++) { const m = E.newMini('bullseye', rng); let n = 0; while (m.pts.X < E.tune(m).goal && n < 80) { const a = at(0, 0); E.applyMove(m, 'X', { aim: a.aim + gauss(rng) * ea, power: a.power + gauss(rng) * ep }, rng); n++; } tot += n; least = Math.min(least, n); }
    return { mean: tot / G, least };
  };
  const perfect = solo(0, 0, 1500), careful = solo(0.072 / B.angle, 0.1, 1500), sloppy = solo(0.15 / B.angle, 0.2, 1500);   // (the aim's error in radians: 4 and 8.5 degrees)
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
  console.log(`Bullseye: alone to 7: perfect aim ${perfect.mean.toFixed(2)} throws, a careful flick ${careful.mean.toFixed(2)}, a sloppy one ${sloppy.mean.toFixed(2)}; the computer: Normal's winner ${normal.mean.toFixed(2)} throws, first mover ${(normal.first * 100).toFixed(1)}%; Hard ${hard.mean.toFixed(2)}, ${(hard.first * 100).toFixed(1)}%; Easy ${easy.mean.toFixed(2)}, ${(easy.first * 100).toFixed(1)}%`);
  assert.ok(perfect.least >= 3 && careful.least >= 3 && hard.least >= 3, 'never in two throws (3 a dart at most, 7 to win)');
  assert.ok(perfect.mean > 3 && perfect.mean < 3.6, `a perfect aim still needs the scatter's luck (${perfect.mean})`);
  assert.ok(careful.mean > 3.6 && careful.mean < 5.2, `a careful flick (${careful.mean})`);
  assert.ok(sloppy.mean > careful.mean + 1.5, `a sloppy one is well behind (${sloppy.mean})`);
  assert.ok(normal.mean >= 4 && normal.mean <= 6, `Normal's winner (${normal.mean})`);
  assert.ok(normal.first < 0.6, `the first mover (${normal.first})`);
  assert.ok(hard.mean < normal.mean - 0.5 && easy.mean > normal.mean + 1.5, 'Hard is sharper, Easy looser');
  assert.ok(hard.first < 0.65, `Hard against Hard, the first mover (${hard.first})`);
});

test('bullseye: the computer aims at the bullseye with its error; its sums of what a throw scores are the same every time', () => {
  const m = E.newMini('bullseye', lcg(1)), t = E.tune(m), pub = E.publicMini(m);
  const o = E.bullsOdds(m.cfg, t, E.bullsErr(t, 'normal'));
  assert.equal(o, E.bullsOdds(m.cfg, t, E.bullsErr(t, 'normal')), 'kept');
  assert.ok(Math.abs(Object.values(o.p).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.ok(o.ev > 0.9 && o.ev < 1.6, `about a point and a bit a throw (${o.ev})`);
  assert.ok(E.bullsOdds(m.cfg, t, E.bullsErr(t, 'hard')).ev > o.ev && E.bullsOdds(m.cfg, t, E.bullsErr(t, 'easy')).ev < o.ev);
  const rng = lcg(31); let sx = 0, sy = 0; const N = 2000;
  for (let k = 0; k < N; k++) { const r = E.localBest(pub, 'X', rng, null, { level: 'normal' }), [x, y] = E.bullsPoint(r.move.aim, r.move.power); sx += x - B.at[0]; sy += y - B.at[1]; assert.ok(r.q >= 0 && r.q <= 0.95); }
  assert.ok(Math.abs(sx / N) < 1.6 && Math.abs(sy / N) < 1.6, 'centred on the bullseye');
  // q: the chance this dart takes the square: none while more than a bullseye short, a real one once within reach
  assert.equal(E.localBest(pub, 'X', rng, null, { level: 'normal' }).q, 0);
  const near = E.newMini('bullseye', lcg(2)); near.pts.X = 6;
  assert.ok(E.localBest(E.publicMini(near), 'X', rng, null, { level: 'normal' }).q > 0.6);
  assert.ok(E.needsOf(E.publicMini(near), 'X') === 1 && E.needsOf(pub, 'X') >= 4 && E.needsOf(pub, 'X') <= 7, 'the throws it still needs');
});

test('bullseye: the admin\'s Mini-game Settings deal a square that plays by them (points to win, bullseye points, the scatter, the computer\'s aim)', () => {
  E.setTune('bullseye', { goal: 3, bullPts: 5, spread: 0, aiErr: 0 });
  const m = E.newMini('bullseye', lcg(3));
  assert.deepEqual(m.tune, { goal: 3, bullPts: 5, spread: 0, aiErr: 0 });
  E.setTune('bullseye', null);
  const res = E.applyMove(m, 'X', at(0, 0), lcg(4));
  assert.deepEqual([m.pts.X, res.outcome, res.note], [5, 'win', 'bull'], 'a bullseye scores 5, and 3 wins (the dealt values, after the settings changed back)');
  const rng = lcg(9), g = E.newMini('bullseye', rng); g.tune = { aiErr: 0, spread: 0 };
  for (let k = 0; k < 50; k++) { const r = E.localBest(E.publicMini(g), 'X', rng, null, { level: 'normal' }), [x, y] = E.bullsPoint(r.move.aim, r.move.power); assert.ok(Math.hypot(x - B.at[0], y - B.at[1]) < 0.3, 'no error: dead centre'); }
  assert.deepEqual(E.tuneNorm('bullseye', { flickMin: 0.6, flickMax: 2.2, angleGain: 1.5, aiBull: 20 }), { flickMin: 0.6, flickMax: 2.2, angleGain: 1.5 }, 'the flick\'s feel is the admin\'s; the old rates are gone');
});
