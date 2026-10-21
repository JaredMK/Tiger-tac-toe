'use strict';
// Cup Pong: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

/* ===================================== Cup Pong ===================================== */
test('cup pong: an aim and a power; the ball lands with a little scatter; a good aim sinks about 40-50% of throws, rims some, and sinking all three cups wins', () => {
  const m = E.newMini('pong', lcg(5));
  const rng = lcg(6);
  let sunk = 0, rims = 0, N = 4000;
  for (let k = 0; k < N; k++) { const a = E.pongAimAt(0), t = E.pongThrow([true, true, true], a.aim, a.power, rng); if (t.sunk) sunk++; else if (t.rim) rims++; }
  console.log(`Cup Pong: a throw aimed at the front cup sinks ${(sunk / N * 100).toFixed(1)}%, rims out ${(rims / N * 100).toFixed(1)}%`);
  assert.ok(sunk / N >= 0.4 && sunk / N <= 0.5, `the make rate of a good aim (${sunk / N})`);
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
  assert.equal(E.applyMove(mm, 'X', 'auto', rr).ok, true, 'a timed-out throw is a random one');
  // the computer: aimed at a cup still standing, about 45% made
  let made = 0;
  for (let k = 0; k < 2000; k++) { const g = E.newMini('pong', lcg(k)); const b = E.localBest(E.publicMini(g), 'X', rr); const res = E.applyMove(g, 'X', b.move, rr); if (res.note === 'sunk' || res.outcome === 'win') made++; }
  console.log(`Cup Pong: the computer makes ${(made / 2000 * 100).toFixed(1)}% on a full rack`);
  assert.ok(made / 2000 > 0.38 && made / 2000 < 0.52, `the computer's make rate (${made / 2000})`);
  let last = 0;                                                       // one cup left: the harder shot, still made often enough to finish
  for (let k = 0; k < 2000; k++) { const g = E.newMini('pong', lcg(k)); g.cups.X[0] = false; g.cups.X[1] = false; const b = E.localBest(E.publicMini(g), 'X', rr); if (E.applyMove(g, 'X', b.move, rr).outcome === 'win') last++; }
  assert.ok(last / 2000 > 0.25, `the last cup (${last / 2000})`);
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

test('pong: the flash carries what the throw\'s animation needs, for each outcome (the rim point, where it pops to, where it rolls off), and the move\'s time covers it all', () => {
  const R = require('../../src/games/pong/rules.js');
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
    assert.deepEqual(f, (() => { const h = {}; R.moveFlash(null, p, null, 0, m, h); return h; })(), 'the same throw, the same flash');
    assert.ok(JSON.stringify(g) === JSON.stringify(JSON.parse(JSON.stringify(g))), 'plain JSON (it rides the move online)');
    assert.equal(P.hit, E.PONG.fly);
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
      // the roll passes no standing cup (beyond the one it starts beside, which it rolls away from)
      for (let s = 1; s <= 20; s++) {
        const x = fx + (g.ox - fx) * s / 20, y = fy + (g.oy - fy) * s / 20;
        before.forEach((up, q) => { if (up) { const d = Math.hypot(x - E.PONG.cups[q][0], y - E.PONG.cups[q][1]), d0 = Math.hypot(fx - E.PONG.cups[q][0], fy - E.PONG.cups[q][1]); assert.ok(d >= Math.min(0.14, d0) - 0.002, `rolls clear of cup ${q}`); } });
      }
    }
    assert.ok(R.flashMs({ pong: g }, 4, false) >= P.end && R.flashMs({ pong: g }, 4, true) === R.flashMs({ pong: g }, 4, false) + 600, 'the move\'s time covers the whole animation');
  }
  assert.ok(Object.values(seen).every(n => n > 10), `every outcome seen (${JSON.stringify(seen)})`);
  // through the engine: the match's flash and its time
  E.playMove(st, 4, { aim: 0, power: 0.55 }, E.makeRng('pf'));
  assert.ok(st.flash.pong && st.flash.type === 'pong');
  assert.equal(E.playMs(st.flash), R.pongPlan(st.flash.pong).end + E.PONG.settle + (st.flash.kind === 'claim' ? 600 : 0));
});
