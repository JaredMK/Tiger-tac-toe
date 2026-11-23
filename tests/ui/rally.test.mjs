// Road Race's page (December 2026: the circuit from above and the steering wheel; v 3, a crash keeps the lap's
// progress), rendered in Node with the browser's names stubbed: the wheel under the circuit with GO on its hub only
// while an attempt may begin; this phone's attempt set off from where its player got to, driven by the page's own
// frame steps and gone in as the engine drives it again; someone else's attempt said and counted only once it has
// been driven again, from where they set off; its sounds from the steering on its flash (the engine all the way, the
// tyres at each hard lock, the crash or the lap at its end, never from this phone's own attempt); the miniature the
// square's own circuit, each player's car a dot where they got to, beside each player's laps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/rally/rules.js');
const { state } = await import('../../src/ui/app.js');
const V = await import('../../src/games/rally/view.js');

const fresh = seed => { const st = E.newMatch(E.makeRng(seed), { games: ['rally'] }); Object.assign(state, st, { screen: 'mini', zoom: 4, online: null, cpu: 'O', flash: null }); return st; };
const draw = (st, o = {}) => V.screen(st.squares[4], o.a || null, null, st.squares[4].mini, !!o.view, !!o.locked, o.a || null, null, null, null, false, o.turn || st.turn, null);

test('rally: the circuit\'s canvas over the wheel; GO on the hub only while an attempt may begin', () => {
  const st = fresh('ui1'); st.turn = state.turn = 'X';
  const mine = draw(st);
  assert.match(mine, /<canvas class="rrcv"/); assert.match(mine, /class="rrstrip"/); assert.match(mine, /class="rrwheel" style="transform:rotate\(0\.0deg\)"/);
  assert.match(mine, /<button class="rrgo X" data-act="rr-go" aria-label="Go">GO<\/button>/);
  assert.equal((mine.match(/data-act=/g) || []).length, 1, 'one control: the rest is the drag');
  assert.ok(mine.indexOf('rrcv') < mine.indexOf('rrline') && mine.indexOf('rrline') < mine.indexOf('rrstrip'), 'the circuit, the result\'s line, the wheel');
  for (const o of [{ locked: true }, { view: true }]) assert.doesNotMatch(draw(st, o), /rrgo/, JSON.stringify(o));
  assert.match(draw(st, { locked: true }), /class="rrwheel"/, 'the wheel is always there: nothing moves when GO goes');
  assert.match(mine, /<p class="rrline"><\/p>/, 'the result\'s line is kept empty');
});

test('rally: someone else\'s attempt: said and counted once it has been driven; its sounds from its steering', () => {
  const st = fresh('ui2'), mini = st.squares[4].mini, c = R.rallyCfg(mini), tr = R.rallyTrack(mini), d = R.rallyDrive(c, tr, E.makeRng('steady'), 0);
  st.turn = state.turn = 'O';
  assert.ok(E.playMove(st, 4, { log: d.log, steps: d.steps }, E.makeRng('s')).ok); Object.assign(state, st, { cpu: 'O' });
  const f = st.flash, run = d.steps * 1000 / R.RALLY.hz, html = draw(st, { a: f, turn: 'X' });
  assert.equal(f.rr.done, true); assert.doesNotMatch(html, /rrgo/);
  assert.match(html, new RegExp(`class="rrline ok appear" style="--t:${Math.round(R.RALLY.pre + run)}ms" role="status">Lap done!`), 'the words come as the car reaches the line');
  assert.match(html, new RegExp(`class="on fillin" style="--t:${Math.round(R.RALLY.pre + run)}ms"`), 'and the lap\'s pip with them');
  const got = []; V.sounds(f, (n, t, r) => got.push([n, Math.round(t)]), false, mini, null);
  const purr = got.filter(g => g[0] === 'rrPurr'), sq = got.filter(g => g[0] === 'rrSqueal'), hard = d.log.filter(e => Math.abs(e[1]) >= V.RRV.hard * R.RALLY.lock);
  assert.equal(purr.length, Math.ceil(run / V.RRV.purr)); assert.ok(purr.every(g => g[1] >= R.RALLY.pre && g[1] < R.RALLY.pre + run));
  assert.ok(sq.length <= hard.length && (hard.length === 0) === (sq.length === 0)); for (let i = 1; i < sq.length; i++) assert.ok(sq[i][1] - sq[i - 1][1] > V.RRV.squeal, 'the tyres never squeal twice at once');
  assert.deepEqual(got[got.length - 1], ['rrLap', Math.round(R.RALLY.pre + run)]);
  assert.match(V.moveText(f, 'Sam'), /finished a lap/);
  // a crash: the crash's own sound at the place it left the road; this phone's own attempt is silent here (it was heard live)
  const st2 = fresh('ui3'); st2.turn = state.turn = 'O';
  assert.ok(E.playMove(st2, 4, { log: [[0, R.RALLY.lock]], steps: 900 }, E.makeRng('s')).ok); Object.assign(state, st2, { cpu: 'O' });
  const g2 = []; V.sounds(st2.flash, (n, t) => g2.push(n), false, st2.squares[4].mini, null);
  assert.equal(g2[g2.length - 1], 'crash'); assert.ok(g2.includes('rrSqueal')); assert.match(draw(st2, { a: st2.flash, turn: 'X' }), /class="rrline no appear"[^>]*>Crashed at \d+%/);
  state.cpu = null; const own = []; V.sounds(st2.flash, n => own.push(n), false, st2.squares[4].mini, null); assert.deepEqual(own, [], 'an attempt driven here');
  assert.deepEqual(V.replay.synth(), [], 'a replay presses nothing: the attempt is driven again from the flash');
});

test('rally: the car waits where its player got to; GO sets off from there, and the attempt goes in as the engine drives it again', () => {
  const st = fresh('ui4'), mini = st.squares[4].mini, c = R.rallyCfg(mini), tr = R.rallyTrack(mini), n = tr.n;
  Object.assign(state, { cpu: null, turn: 'X' }); mini.pos.X = Math.round(n * 0.37); mini.pos.O = Math.round(n * 0.6);
  assert.match(draw(st, { turn: 'X' }), /data-act="rr-go"/);
  V.actions['rr-go']();
  const L = V.rallyLive(), from = mini.pos.X;
  assert.ok(L, 'GO: an attempt under way'); assert.deepEqual([L.p, L.p0, L.S.i, L.S.cum, L.S.x, L.S.y], ['X', from, from, from, tr.x[from], tr.y[from]], 'set off where X got to, in the middle of the road');
  const a = (from + 1) % n, b = (from + n - 1) % n, fx = tr.x[a] - tr.x[b], fy = tr.y[a] - tr.y[b];
  assert.ok((L.S.hx * fx + L.S.hy * fy) / Math.hypot(fx, fy) > 0.99999, 'pointing along the road, the racing way');
  // a finger on the wheel, frame by frame (16 ms): steering for the road ahead, then full lock off it
  let t = L.t0 + R.RALLY.wait, f = 0; L.held = true;
  for (; f < 600 && V.rallyLive(); f++) {
    t += 16;
    if (f < 160) { const q = (L.S.i + c.look) % n, dx = tr.x[q] - L.S.x, dy = tr.y[q] - L.S.y; L.aim = Math.max(-1, Math.min(1, 2 * (L.S.hx * dy - L.S.hy * dx) / (dx * dx + dy * dy) * c.speed / c.turn)); } else L.aim = 1;
    V.rallyTick(t);
  }
  assert.equal(V.rallyLive(), null, 'the attempt is over and gone in'); assert.equal(L.res, 'crash'); assert.ok(L.log.length > 3, `the wheel was turned: ${L.log.length} changes`);
  const q = v => Math.round(v * 100) / 100 + 0;
  assert.deepEqual([mini.n.X, mini.last.by, mini.last.crash, mini.last.p0, mini.last.at], [1, 'X', true, from, [q(L.S.x), q(L.S.y), q(L.S.hx), q(L.S.hy)]], 'the engine drove it again from the same place, to the same place');
  assert.deepEqual([mini.pos.X, mini.pos.O], [R.rallyKeep(tr, L.S.cum), Math.round(n * 0.6)]); assert.ok(mini.pos.X > from + 20, `on from ${from} to ${mini.pos.X}`);
  // the next turn: the car waits at the place it left the road, and GO sets off from there
  Object.assign(state, { flash: null, done: null, spot: null, turn: 'X' }); state.squares[4].mini = mini;
  draw(st, { turn: 'X' }); V.actions['rr-go']();
  const N = V.rallyLive(); assert.deepEqual([N.p0, N.S.x, N.S.y], [mini.pos.X, tr.x[mini.pos.X], tr.y[mini.pos.X]]);
  for (let k = 0; k < 400 && V.rallyLive(); k++) { N.held = true; N.aim = -1; V.rallyTick(N.t0 + R.RALLY.wait + 16 * k); }
});

test('rally: someone else\'s attempt is driven again from where they set off, to where the engine had it end', () => {
  const st = fresh('ui5'), mini = st.squares[4].mini, c = R.rallyCfg(mini), tr = R.rallyTrack(mini); st.turn = state.turn = 'O';
  mini.pos.O = Math.round(tr.n * 0.5); const from = mini.pos.O, d = R.rallyDrive(c, tr, E.makeRng('h'), 3, from);
  assert.ok(E.playMove(st, 4, { log: d.log, steps: d.steps }, E.makeRng('s')).ok); Object.assign(state, st, { cpu: 'O' });
  const f = st.flash, P = V.rallyReplay(f.rr, mini), k = P.n;
  assert.deepEqual([f.rr.p0, P.p0, P.pts[0], P.pts[1]], [from, from, tr.x[from], tr.y[from]], 'from their kept place');
  assert.deepEqual([Math.round(P.pts[2 * k] * 100) / 100, Math.round(P.pts[2 * k + 1] * 100) / 100], f.rr.at.slice(0, 2), 'to the place the engine had it end');
  assert.equal(P.end === 'crash', f.rr.crash); assert.equal(P.end === 'lap', f.rr.done);
  const old = Object.assign({}, f.rr); delete old.p0; assert.deepEqual([V.rallyReplay(old, mini).pts[0], V.rallyReplay(old, mini).pts[1]], [tr.x[0], tr.y[0]], 'a flash from before: from the line');
});

test('rally: the miniature: the square\'s own circuit, each player\'s car where they got to, each player\'s laps', () => {
  const m = E.newMini('rally', E.makeRng('mini')), tr = R.rallyTrack(m); m.laps.X = 1;
  const html = V.miniature(m, false);
  assert.match(html, /class="tart trcw" aria-label="Road Race: X 1, O 0 of 3 laps"/); assert.match(html, new RegExp(`<svg class="trc" viewBox="0 0 ${R.RALLY.W} ${R.RALLY.H}">`));
  const dots = h => Object.fromEntries([...h.matchAll(/<circle class="trc([xo])" cx="([\d.-]+)" cy="([\d.-]+)" r="7"\/>/g)].map(g => [g[1], [Number(g[2]), Number(g[3])]]));
  const at0 = dots(html), near = (p, i) => Math.hypot(p[0] - tr.x[i], p[1] - tr.y[i]);
  assert.ok(near(at0.x, 0) < 4.5 && near(at0.o, 0) < 4.5 && Math.hypot(at0.x[0] - at0.o[0], at0.x[1] - at0.o[1]) > 8, 'both on the line, side by side');
  m.pos.X = Math.round(tr.n * 0.25); m.pos.O = Math.round(tr.n * 0.7); const later = dots(V.miniature(m, false));
  assert.ok(near(later.x, m.pos.X) < 4.5 && near(later.o, m.pos.O) < 4.5, 'each where they got to');
  const dp = html.match(/class="trct" d="([^"]+)"/)[1], pts = dp.slice(1, -1).split('L').map(s => s.split(' ').map(Number));
  assert.ok(pts.length > 30 && pts.every(([x, y]) => x > 0 && x < R.RALLY.W && y > 0 && y < R.RALLY.H)); assert.deepEqual(pts[0], [Math.round(tr.x[0] * 10) / 10, Math.round(tr.y[0] * 10) / 10]);
  assert.equal((html.match(/<i class=" on">/g) || []).length, 1); assert.doesNotMatch(html.replace(/aria-label="[^"]*"/, ''), />[^<]*\d[^<]*</, 'a picture and pips: no numbers');
  assert.notEqual(V.miniature(E.newMini('rally', E.makeRng('other')), false), V.miniature(E.newMini('rally', E.makeRng('mini')), false).replace(' on', ''), 'another square, another circuit');
  const v2 = E.newMini('rally', E.makeRng('mini')); v2.v = 2; delete v2.pos; const d2 = dots(V.miniature(v2, false)); assert.ok(near(d2.x, 0) < 4.5 && near(d2.o, 0) < 4.5, 'a v 2 square: both always at the line');
});
