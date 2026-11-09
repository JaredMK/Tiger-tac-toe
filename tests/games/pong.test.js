'use strict';
// Cup Pong: its rules, its flick, its AI and its view's flight, test by test (npm test). The engine is the one the
// page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/pong/rules.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const gauss = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

/* ===================================== Cup Pong ===================================== */
test('cup pong: an aim and a power; the ball lands with a little scatter; a good aim sinks about half, rims some, and sinking all three cups wins', () => {
  const m = E.newMini('pong', lcg(5));
  const rng = lcg(6);
  let sunk = 0, rims = 0, N = 4000;
  for (let k = 0; k < N; k++) { const a = E.pongAimAt(0), t = E.pongThrow([true, true, true], a.aim, a.power, rng); if (t.sunk) sunk++; else if (t.rim) rims++; }
  console.log(`Cup Pong: a throw aimed at the front cup sinks ${(sunk / N * 100).toFixed(1)}%, rims out ${(rims / N * 100).toFixed(1)}%`);
  assert.ok(sunk / N >= 0.45 && sunk / N <= 0.58, `the make rate of a perfect aim (${sunk / N})`);
  assert.ok(rims / N > 0.1 && rims / N < 0.35, `rim bounces that fall off (${rims / N})`);
  let r = E.applyMove(m, 'X', { aim: 0, power: 0.6 }, lcg(7));
  assert.equal(r.ok, true);
  assert.ok(['sunk', 'rim', 'miss'].includes(r.note));
  assert.ok(Math.abs(m.last.y - E.pongDist(0.6)) < 0.25 && Math.abs(m.last.x) < 0.25, 'lands about where it was thrown');
  const far = E.applyMove(m, 'O', { aim: 1, power: 1 }, lcg(8));
  assert.ok(far.ok && m.last.x > 0.2 && m.last.cup === null && m.last.note !== 'sunk', 'thrown hard to the right: off the rack');
  for (const bad of [{ aim: 'x', power: 1 }, {}, 5, [1, 1]]) assert.equal(E.applyMove(m, 'X', bad).ok, false);
  assert.equal(E.applyMove(m, 'X', { aim: 9, power: -2 }, lcg(9)).ok, true, 'out-of-range numbers are clamped');
  assert.ok(m.last.aim === 1 && m.last.power === 0);
  // play on until X has sunk all three
  const mm = E.newMini('pong', lcg(5)), rr = lcg(12);
  let n = 0, win = null;
  while (n++ < 200 && !win) { const a = E.pongAimAt(mm.cups.X.indexOf(true)); const res = E.applyMove(mm, 'X', a, rr); if (res.outcome === 'win') win = res; }
  assert.ok(win && mm.cups.X.every(c => !c) && mm.cups.O.every(c => c), 'X\'s cups all down, O\'s all up');
  assert.equal(E.applyMove(mm, 'X', 'auto', rr).ok, true, 'a timed-out throw (the server\'s) is a random one');
  // a random legal move is a real throw at a standing cup (a phone never sends 'auto': core/verify.js)
  const g2 = E.newMini('pong', lcg(3)), rm = E.randomLegalMove(g2, 'X', lcg(4));
  assert.ok(rm && typeof rm === 'object' && Number.isFinite(rm.aim) && Number.isFinite(rm.power), 'a throw, not auto');
  assert.equal(E.onlineCheck(g2, 'X', rm, Date.now(), null), null, 'the server takes it from a phone');
  assert.deepEqual(E.onlineCheck(g2, 'X', 'auto', Date.now(), null), { why: 'auto' });
});

test('pong: the computer at each level: Normal aims at a cup and makes about half, Easy fewer, Hard picks the best spot and makes more; the last cup still goes down often enough', () => {
  const rates = {};
  for (const level of ['easy', 'normal', 'hard']) {
    const rr = lcg(21); let made = 0, last = 0;
    for (let k = 0; k < 1500; k++) {
      const g = E.newMini('pong', lcg(k)), b = E.aiOf('pong').best(E.publicMini(g), 'X', rr, null, { level });
      assert.ok(Number.isFinite(b.move.aim) && Number.isFinite(b.move.power) && b.q >= 0 && b.q <= 1);
      if (E.applyMove(g, 'X', b.move, rr).note === 'sunk') made++;
      const h = E.newMini('pong', lcg(k)); h.cups.X[0] = false; h.cups.X[1] = false;
      if (E.applyMove(h, 'X', E.aiOf('pong').best(E.publicMini(h), 'X', rr, null, { level }).move, rr).outcome === 'win') last++;
    }
    rates[level] = { made: made / 1500, last: last / 1500 };
  }
  console.log(`Cup Pong: the computer makes ${Object.entries(rates).map(([l, r]) => `${l} ${(r.made * 100).toFixed(1)}% (last cup ${(r.last * 100).toFixed(1)}%)`).join(', ')}`);
  assert.ok(rates.normal.made > 0.4 && rates.normal.made < 0.56, `Normal's make rate (${rates.normal.made})`);
  assert.ok(rates.easy.made < rates.normal.made - 0.05, `Easy makes fewer (${rates.easy.made})`);
  assert.ok(rates.hard.made > rates.normal.made + 0.03, `Hard makes more (${rates.hard.made})`);
  assert.ok(rates.normal.last > 0.3, `the last cup (${rates.normal.last})`);
  const b = E.localBest(E.publicMini(E.newMini('pong', lcg(1))), 'X', lcg(2));
  assert.ok(b && b.move && Number.isFinite(b.move.aim), 'the main board\'s computer gets a throw');
  assert.ok(E.aiOf('pong').needs({ cups: { X: [true, true, false], O: [true, true, true] } }, 'X') < E.aiOf('pong').needs({ cups: { X: [true, true, true], O: [true, true, true] } }, 'X'));
});

test('pong: balance by Monte Carlo: an accurate throw sinks about half, a careful player about a third, and the winner needs 4 to 6 throws with the first mover under 60%', () => {
  const t = E.tuneLive('pong'), rng = lcg(77), N = 20000;
  let acc = 0, careful = 0;
  for (let k = 0; k < N; k++) {
    const a = E.pongAimAt(k % 3);
    if (E.pongThrow([true, true, true], a.aim + gauss(rng) * 0.012, a.power + gauss(rng) * 0.018, rng, t).sunk) acc++;   // the computer's own hand
    if (E.pongThrow([true, true, true], a.aim + gauss(rng) * 0.2, a.power + gauss(rng) * 0.1, rng, t).sunk) careful++;   // a careful person's flick
  }
  let tot = 0, first = 0, M = 3000, most = 0;
  for (let m = 0; m < M; m++) {
    const g = E.newMini('pong', lcg(m)), n = { X: 0, O: 0 }; let p = 'X', w = null;
    while (!w) { n[p]++; const res = E.applyMove(g, p, E.aiOf('pong').best(E.publicMini(g), p, rng, null, { level: 'normal' }).move, rng); if (res.outcome === 'win') w = p; p = p === 'X' ? 'O' : 'X'; }
    tot += n[w]; most = Math.max(most, n[w]); if (w === 'X') first++;
  }
  console.log(`Cup Pong: accurate ${(acc / N * 100).toFixed(1)}%, careful ${(careful / N * 100).toFixed(1)}%; the winner throws ${(tot / M).toFixed(2)} times (most ${most}), the first mover wins ${(first / M * 100).toFixed(1)}%`);
  assert.ok(acc / N > 0.42 && acc / N < 0.58, `an accurate throw (${acc / N})`);
  assert.ok(careful / N > 0.25 && careful / N < 0.45, `a careful player (${careful / N})`);
  assert.ok(tot / M >= 4 && tot / M <= 6.2, `throws for the winner (${tot / M})`);
  assert.ok(first / M < 0.6, `the first mover (${first / M})`);
});

test('pong: the admin\'s Mini-game Settings deal a square that plays by them (no scatter, every rim ball in, the computer dead on)', () => {
  E.setTune('pong', { spread: 0.02, rimIn: 100, aiAim: 0, aiPower: 0 });
  const m = E.newMini('pong', lcg(5));
  E.setTune('pong', null);
  assert.deepEqual(m.tune, { spread: 0.02, rimIn: 100, aiAim: 0, aiPower: 0 });
  const rng = lcg(6); let n = 0, res;
  while (n++ < 30 && !(res && res.outcome === 'win')) res = E.applyMove(m, 'X', E.localBest(E.publicMini(m), 'X', rng).move, rng);
  assert.equal(res.outcome, 'win', `the computer, dead on with little scatter, sinks all three (${n} throws)`);
  assert.ok(n <= 8);
});

test('pong: the flick maps exactly: speed to distance (monotonic, flickMin near, flickMax far), angle to the lateral landing (monotonic, symmetric, straight up straight), a swipe at a drawn cup lands on it, and the table\'s own settings steer it', () => {
  const G = R.pongGeom(360, 350), t = E.tuneLive('pong');
  assert.ok(G.s(0) > G.s(1), 'the far end is drawn smaller');
  const near = R.pongProject(G, -R.TABLE.x, R.TABLE.y0), far = R.pongProject(G, -R.TABLE.x, R.TABLE.y1);
  assert.ok(near.Y > far.Y && near.X < far.X, 'the table a trapezoid: wider and lower at the near end');
  // speed → distance
  let prev = -1;
  for (let v = 0; v <= 3; v += 0.05) { const f = R.pongFlick(G, 0, 100, v, t); assert.ok(f.power >= prev - 1e-9, `power never falls as the flick gets faster (${v})`); prev = f.power; }
  assert.equal(R.pongFlick(G, 0, 100, t.flickMin, t).power, 0, 'flickMin: the shortest throw');
  assert.equal(R.pongFlick(G, 0, 100, t.flickMax, t).power, 1, 'flickMax: the longest');
  assert.equal(R.pongFlick(G, 0, 100, 9, t).power, 1, 'and no further');
  const mid = R.pongFlick(G, 0, 100, (t.flickMin + t.flickMax) / 2, t);
  assert.ok(Math.abs(mid.power - 0.5) < 0.01, 'half way between: half power');
  assert.equal(R.pongFlick(R.pongGeom(360, 700), 0, 100, (t.flickMin + t.flickMax) / 2, t).power, mid.power, 'the same flick on a taller canvas: the same throw (a thumb\'s speed is not the screen\'s)');
  // angle → lateral
  prev = -2;
  for (let dx = -120; dx <= 120; dx += 5) { const f = R.pongFlick(G, dx, 100, 1, t); assert.ok(f.aim >= prev, `aim never falls as the swipe turns right (${dx})`); prev = f.aim; }
  assert.equal(R.pongFlick(G, 0, 100, 1, t).aim, 0, 'straight up: straight ahead');
  for (const dx of [10, 25, 50]) assert.equal(R.pongFlick(G, dx, 100, 1, t).aim, -R.pongFlick(G, -dx, 100, 1, t).aim, 'left and right mirror');
  assert.equal(R.pongFlick(G, 170, 100, 1, t).aim, 1); assert.equal(R.pongFlick(G, -170, 100, 1, t).aim, -1);   // (a wide swipe, still a throw: the widest aim)
  // a swipe pointed at a drawn cup lands on that cup
  const Hs = R.pongProject(G, ...R.PONG.hand);
  for (const k of [0, 1, 2]) {
    const [cx, cy] = R.PONG.cups[k], C = R.pongProject(G, cx, cy, 0), a = E.pongAimAt(k), v = t.flickMin + a.power * (t.flickMax - t.flickMin);
    const f = R.pongFlick(G, C.X - Hs.X, Hs.Y - C.Y, v, t), th = f.aim * R.PONG.angle, d = E.pongDist(f.power);
    assert.ok(Math.hypot(Math.sin(th) * d - cx, Math.cos(th) * d - cy) < 0.004, `cup ${k}: lands on it (${Math.sin(th) * d}, ${Math.cos(th) * d})`);
    const L = R.pongProject(G, Math.sin(th) * d, Math.cos(th) * d, 0);
    assert.ok(Math.abs(Math.atan2(L.X - Hs.X, Hs.Y - L.Y) - Math.atan2(C.X - Hs.X, Hs.Y - C.Y)) < 0.002, 'the landing lies on the swipe\'s ray');
  }
  // not a throw: too short, or sideways
  assert.equal(R.pongFlick(G, 0, 10, 2, t), null); assert.equal(R.pongFlick(G, 200, 100, 2, t), null); assert.equal(R.pongFlick(G, 0, -50, 2, t), null);
  // the table's own settings (TUNE): the speed range and the angle's gain
  const t2 = Object.assign({}, t, { flickMin: 1, flickMax: 2, angleGain: 2 });
  assert.equal(R.pongFlick(G, 0, 100, 1, t2).power, 0); assert.equal(R.pongFlick(G, 0, 100, 2, t2).power, 1);
  assert.ok(R.pongFlick(G, 20, 100, 1, t2).aim > R.pongFlick(G, 20, 100, 1, t).aim, 'more gain: the same swipe aims wider');
  // the move it makes is plain and in range
  const f = R.pongFlick(G, 17, 90, 1.2, t);
  assert.deepEqual(f, JSON.parse(JSON.stringify(f))); assert.ok(f.aim >= -1 && f.aim <= 1 && f.power >= 0 && f.power <= 1);
});

test('pong: the throw and its record are deterministic (the same inputs and rng, the same landing, the same flash), and the flash carries what the animation needs for every outcome', () => {
  for (let k = 0; k < 50; k++) {
    const a = E.newMini('pong', lcg(k)), b = E.newMini('pong', lcg(k)), mv = { aim: (k % 7 - 3) / 4, power: 0.4 + (k % 5) / 10 };
    E.applyMove(a, 'X', mv, lcg(500 + k)); E.applyMove(b, 'X', mv, lcg(500 + k));
    assert.deepEqual(a, b);
    const fa = {}, fb = {}; R.moveFlash(mv, 'X', null, 0, a, fa); R.moveFlash(mv, 'X', null, 0, b, fb);
    assert.deepEqual(fa, fb);
  }
  const off = (x, y) => x > 0.5 || x < -0.5 || y > 1 || y < 0;
  const seen = { make: 0, rimIn: 0, rimOut: 0, miss: 0 };
  const st = E.newMatch(E.makeRng('pongfx'), { games: Object.fromEntries(E.TYPES.map(t => [t, t === 'pong'])) });
  for (let k = 0; k < 600; k++) {
    const m = E.newMini('pong', lcg(k)), rng = lcg(1000 + k), p = k % 2 ? 'O' : 'X';
    if (k % 3 === 0) m.cups[p][k % 3] = false;
    const target = m.cups[p].indexOf(true), a = E.pongAimAt(target);
    const mv = k % 4 === 3 ? { aim: rng() * 2 - 1, power: rng() } : { aim: a.aim + (rng() - 0.5) * 0.4, power: a.power + (rng() - 0.5) * 0.3 };
    const before = m.cups[p].slice();
    E.applyMove(m, p, mv, rng);
    const f = {}; R.moveFlash(null, p, null, 0, m, f); const g = f.pong, P = R.pongPlan(g);
    assert.ok(JSON.stringify(g) === JSON.stringify(JSON.parse(JSON.stringify(g))), 'plain JSON (it rides the move online)');
    assert.equal(P.hit, E.PONG.fly); assert.equal(P.pre, 0);
    const Q = R.pongPlan(g, E.PONG.pre);
    assert.ok(Q.pre === E.PONG.pre && Q.hit === P.hit + E.PONG.pre && Q.end === P.end + E.PONG.pre && Q.res === P.res + E.PONG.pre, 'someone else\'s flick first: everything that much later');
    if (g.sunk) {
      seen[g.rim ? 'rimIn' : 'make']++;
      assert.equal(g.ox, undefined, 'a make rolls nowhere');
      if (g.rim) assert.ok(Number.isFinite(g.ra)); else assert.equal(g.ra, undefined);
      assert.ok(P.splash > P.hit && P.lift > P.splash && P.end > P.lift && P.res === P.splash, 'down into the cup, the splash, the cup lifted off');
      assert.equal(m.cups[p][g.cup], false);
    } else {
      seen[g.rim ? 'rimOut' : 'miss']++;
      assert.ok(Number.isFinite(g.ox) && Number.isFinite(g.oy) && off(g.ox, g.oy), `it rolls off the table (${g.ox}, ${g.oy})`);
      assert.ok(P.roll >= E.PONG.rollMin && P.roll <= E.PONG.rollMax && P.end === P.bounce + P.roll);
      const fx = g.rim ? g.bx : g.x, fy = g.rim ? g.by : g.y;
      if (g.rim) {
        const [cx, cy] = E.PONG.cups[g.cup];
        assert.ok(Math.abs(g.ra - Math.atan2(g.x - cx, g.y - cy)) < 0.001, 'the rim struck where the ball came down on it');
        assert.ok(Number.isFinite(g.bx) && Number.isFinite(g.by) && Math.hypot(g.bx - cx, g.by - cy) >= 0.198, 'it pops off the rim');
        assert.ok(before.every((up, q) => !up || Math.hypot(g.bx - E.PONG.cups[q][0], g.by - E.PONG.cups[q][1]) >= 0.138), 'and comes down on the table, not in a cup');
        assert.ok(P.bounce === P.hit + E.PONG.hop);
      } else assert.ok(P.bounce === P.hit && g.ra === undefined);
      for (let s = 1; s <= 20; s++) {                                // the roll passes no standing cup (beyond the one it starts beside, which it rolls away from)
        const x = fx + (g.ox - fx) * s / 20, y = fy + (g.oy - fy) * s / 20;
        before.forEach((up, q) => { if (up) { const d = Math.hypot(x - E.PONG.cups[q][0], y - E.PONG.cups[q][1]), d0 = Math.hypot(fx - E.PONG.cups[q][0], fy - E.PONG.cups[q][1]); assert.ok(d >= Math.min(0.14, d0) - 0.002, `rolls clear of cup ${q}`); } });
      }
    }
    assert.ok(R.flashMs({ pong: g }, 4, false) >= P.end && R.flashMs({ pong: g }, 4, true) === R.flashMs({ pong: g }, 4, false) + 600, 'the move\'s time covers the whole animation');
  }
  assert.ok(Object.values(seen).every(n => n > 10), `every outcome seen (${JSON.stringify(seen)})`);
  E.playMove(st, 4, { aim: 0, power: 0.55 }, E.makeRng('pf'));
  assert.ok(st.flash.pong && st.flash.type === 'pong');
  assert.equal(E.playMs(st.flash), R.pongPlan(st.flash.pong).end + E.PONG.settle + (st.flash.kind === 'claim' ? 600 : 0));
});

// The view (src/games/pong/view.js) in Node, the browser's names stubbed: the flight it draws from the flash, someone
// else's flick shown first, the replay hooks for the shared system, the words and sounds, and the miniature.
test('pong view: the ball flies from the hand to where the throw came down, up and over, and is gone once the move is over; a replay\'s flick comes first; the hooks, words, sounds and miniature', async () => {
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
  for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
    try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
  }
  const win = new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {} }) : k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
  Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });
  E.setPhysics(null);                                              // (the page's own first deal, as ui/app.js loads, has no physics game in it: a Mini Golf square dealt there reads app.js's state before it exists)
  const V = await import('../../src/games/pong/view.js');
  const { state } = await import('../../src/ui/app.js');
  E.setPhysics(require('../physics.js'));
  const G = R.pongGeom(360, 350), H = E.PONG.hand;
  for (const [mv, want] of [[{ aim: 0, power: 0.54 }, null], [{ aim: 0.2, power: 0.3 }, 'miss'], [{ aim: 0, power: 1 }, 'miss']]) {
    const m = E.newMini('pong', lcg(11)); E.setTune('pong', { spread: 0.02 }); const mm = E.newMini('pong', lcg(11)); E.setTune('pong', null);
    E.applyMove(want ? m : mm, 'X', mv, lcg(3));
    const sq = want ? m : mm, f = {}; R.moveFlash(mv, 'X', null, 0, sq, f); const g = f.pong, P = R.pongPlan(g);
    if (want) assert.equal(g.sunk, false);
    const b0 = V.ballAt(G, g, P, 0, H), bm = V.ballAt(G, g, P, P.hit / 2, H), bh = V.ballAt(G, g, P, P.hit - 1, H);
    assert.deepEqual([b0.x, b0.y, b0.z], H, 'from the hand');
    assert.ok(bm.z > H[2] + 0.2 && bm.z > bh.z, 'up and over');
    assert.ok(Math.abs(bh.x - g.x) < 0.02 && Math.abs(bh.y - g.y) < 0.02 || g.rim, 'comes down where the throw landed');
    assert.equal(V.ballAt(G, g, P, P.end + E.PONG.settle, H), null, 'gone once the move is over');
    const Q = R.pongPlan(g, E.PONG.pre), bp = V.ballAt(G, g, Q, E.PONG.pre / 2, H);
    assert.deepEqual([bp.x, bp.y, bp.z], H, 'a replay: in the hand while the flick shows');
    assert.deepEqual(V.ballAt(G, g, Q, E.PONG.pre + P.hit / 2, H), bm, 'then the same flight, that much later');
    for (let t = 0; t < P.end; t += 37) { const b = V.ballAt(G, g, P, t, H); if (b) { const p = R.pongProject(G, b.x, b.y, b.z); assert.ok(p.Y > 0 && p.Y < G.H && p.X > -40 && p.X < G.W + 40, `on the canvas at ${t} ms (${p.X}, ${p.Y})`); } }
  }
  // a make: down into the cup through its opening (inCup), nothing after the splash
  let made = null;
  for (let k = 0; k < 200 && !made; k++) { const m = E.newMini('pong', lcg(k)); E.applyMove(m, 'X', E.pongAimAt(0), lcg(k)); if (m.last.sunk && !m.last.rim) { const f = {}; R.moveFlash(null, 'X', null, 0, m, f); made = f.pong; } }
  const P = R.pongPlan(made);
  assert.equal(V.ballAt(G, made, P, P.hit + E.PONG.drop * 0.9, H).inCup, 0);
  assert.equal(V.ballAt(G, made, P, P.splash, H), null);
  // the replay hooks (ui/replay.js): the computer's flick from its move, the log's flick taken
  const log = V.replay.synth({ aim: -0.25, power: 0.61 });
  assert.deepEqual(log, [[0, 'pong', 'aim=-0.25|power=0.61']]);
  assert.deepEqual(E.repNorm(log), log, 'a log the shared system accepts');
  assert.equal(V.replay.input('pong', 'aim=-0.25|power=0.61', { sq: 4, by: 'O', list: log, k: 1 }), true);
  assert.equal(V.replay.input('pong', 'nonsense', { sq: 4, by: 'O' }), false);
  // words and sounds
  assert.equal(V.pongWord({ sunk: true }), 'Splash!'); assert.equal(V.pongWord({ rim: true }), 'Rim out'); assert.equal(V.pongWord({}), 'Miss');
  Object.assign(state, { online: null, cpu: null });
  const snd = f => { const out = []; V.sounds(f, (n, ms) => out.push([n, ms])); return out; };
  assert.deepEqual(snd({ type: 'pong', by: 'X', pong: made }), [['pongThrow', 0], ['splash', P.splash]]);
  const miss = { x: 0.2, y: 0.7, cup: null, rim: false, sunk: false, ox: 0.56, oy: 1.0, aim: 0.5, power: 0.3 }, PM = R.pongPlan(miss);
  assert.deepEqual(snd({ type: 'pong', by: 'X', pong: miss }), [['pongThrow', 0], ['thud', PM.bounce], ['pongRoll', PM.bounce + 120]]);
  const rim = Object.assign({}, miss, { cup: 0, rim: true, ra: 0.3, bx: 0.2, by: 0.6 }), PR = R.pongPlan(rim);
  assert.deepEqual(snd({ type: 'pong', by: 'X', pong: rim }).slice(0, 3), [['pongThrow', 0], ['clink', PR.hit], ['thud', PR.bounce]]);
  const SND = require('../../src/audio/sound.js');
  for (const n of ['pongThrow', 'pongRoll', 'clink', 'splash', 'thud']) assert.ok(SND.SFX[n], `the sound ${n} exists`);
  const fs = require('node:fs'), md = fs.readFileSync(require('node:path').join(__dirname, '..', '..', 'SOUNDS.md'), 'utf8');
  assert.ok(md.includes('`pongThrow`') && md.includes('`pongRoll`'), 'listed in SOUNDS.md');
  // the miniature: a picture (the table and both racks), public information, each sunk cup a ring
  const m3 = E.newMini('pong', lcg(2)); m3.cups.X[1] = false;
  const html = V.miniature(m3, false);
  assert.match(html, /class="tpg"/); assert.equal((html.match(/class="c X"/g) || []).length, 2); assert.equal((html.match(/class="c O"/g) || []).length, 3); assert.equal((html.match(/class="cs"/g) || []).length, 1);
  assert.doesNotMatch(html, /undefined|NaN/);
  assert.match(V.moveText({ pong: made }, 'X'), /sank a cup/);
});
