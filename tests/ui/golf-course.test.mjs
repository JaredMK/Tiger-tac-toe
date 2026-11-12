// Mini Golf's course as it is drawn and heard (November 2026, the polish sweep; games/golf/view.js, ui/physics.js): the
// aim is a short arrow and the power bar alone (December 2026: no sight line), the terrain is drawn and turns, a holed ball
// drops into the cup and its sparks play after the recording has let it go, a post pops as it kicks, the putter strokes
// as the shot starts, and every sound comes from its event, once. Rendered in Node with the browser's names stubbed
// (motion on) and a canvas that only counts what is drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
globalThis.window = new Proxy(stub(), { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false }) : stub()) });   // (motion on)
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);
const V = await import('../../src/games/golf/view.js');
const U = await import('../../src/ui/physics.js');
const HAP = await import('../../src/ui/haptics.js');

// A canvas context that counts: every call by name, and the arcs drawn (x, y, r).
function ctx() {
  const calls = {}, arcs = [], grad = { addColorStop() {} };
  const c = new Proxy({ globalAlpha: 1 }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'getTransform') return () => ({ a: 1 });
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      return (...a) => { calls[k] = (calls[k] || 0) + 1; if (k === 'arc') arcs.push(a.slice(0, 3)); };
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { c, calls, arcs };
}
const K = 2.3, G = () => { const x = ctx(); return Object.assign(x, { g: { c: x.c, W: 336, H: 386, k: K, M: V.GOLF_KERB, X: v => 44 + v * K, Y: v => 9 + v * K } }); };
const golf = (hole, X, O) => ({ type: 'golf', hole, balls: { X, O: O || [97, 157] }, holed: { X: false, O: !O }, shots: { X: 0, O: 0 }, last: null });
const flashOf = (mini, p, shot) => { const r = E.applyMove(mini, p, shot, E.makeRng('gt')); assert.equal(r.ok, true); const f = { type: 'golf', by: p, kind: r.outcome === 'win' ? 'claim' : 'move' }; E.rulesOf('golf').moveFlash(shot, p, null, null, mini, f); return f; };
const posAt = (rec, t) => { const k = Math.min(rec.frames.length - 1, Math.floor(t * rec.fps)), o = {}; rec.ids.forEach((id, j) => { o[id] = rec.frames[k][2 * j] == null ? null : [rec.frames[k][2 * j], rec.frames[k][2 * j + 1]]; }); return o; };

test('Mini Golf: no sight line (December 2026): a putt lined up shows a short arrow of one length and the power bar\'s level alone, whatever the aim, power or course', () => {
  const look = (hole, from, aim, power) => { const x = G(), calls = []; const c = x.c; x.g.c = new Proxy(c, { get: (t, k) => (typeof t[k] === 'function' ? (...a) => { calls.push([k, ...a]); return t[k](...a); } : t[k]) }); V.drawGolfAim(x.g, golf(hole, from), { X: from, O: [97, 157] }, { aim, power }, 'X'); return calls; };
  const moves = calls => calls.filter(q => q[0] === 'moveTo' || q[0] === 'lineTo');
  const len = calls => { const m = moves(calls).filter(q => q[0] === 'moveTo'); return m.length ? Math.hypot(m[0][1] - m[1][1], m[0][2] - m[1][2]) : 0; };
  const shapes = [];
  for (const [hole, from, aim, power] of [[7, [10, 155], 0, 0.1], [7, [10, 155], 0, 0.9], [2, [50, 60], 1.2, 0.5], [12, [40, 140], -2.4, 1]]) {
    const calls = look(hole, from, aim, power);
    assert.ok(!calls.some(q => q[0] === 'setLineDash'), 'no dotted line');
    shapes.push(moves(calls).length);
    assert.ok(Math.abs(len(calls) - len(look(7, [10, 155], 0, 0.9))) < 0.5, 'the arrow is always the same length');
  }
  assert.ok(shapes.every(n => n === shapes[0]), `the same drawing every time: no line to a wall, no landing, no bar where it stops (${shapes})`);
  assert.ok(Math.abs(len(look(7, [10, 155], 0, 0.5)) - V.GOLFV.arrow * K) < 0.5, 'as long as GOLFV.arrow');
  assert.equal(V.golfSight, undefined); assert.equal(V.golfReach, undefined);
});

test('Mini Golf: the terrain (December 2026): a v 2 square with the switches on draws its hole\'s slopes, sand, water and windmills; the windmills turn as a shot plays and stand still between shots; a ball into the water splashes, comes back where it began, a stroke more, its splash sound and error buzz', () => {
  const on = { slopes: 'on', sand: 'on', water: 'on', mills: 'on', waterPenalty: 1 }, dealt = h => { const m = E.newMini('golf', E.makeRng('tr' + h)); m.hole = h; const tee = P.HOLES[h].tee; m.balls = { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] }; m.tune = Object.assign({}, m.tune, on); return m; };
  assert.equal(dealt(1).v, 2, 'a new square has the terrain');
  const kinds = { slopes: 0, sand: 0, water: 0, mills: 0 };
  for (const h of P.HOLES) for (const k of Object.keys(kinds)) kinds[k] += h.terrain[k].length ? 1 : 0;
  assert.ok(Object.values(kinds).every(n => n >= 8), `every kind on several holes (${JSON.stringify(kinds)})`);
  const mill = P.HOLES.findIndex(h => h.terrain.mills.length), m = dealt(mill), T = V.golfTerrainOf(m);
  assert.equal(T.mills.length, 1); assert.equal(V.golfTerrainOf(Object.assign({}, m, { tune: Object.assign({}, m.tune, { mills: 'off' }) })).mills.length, 0, 'its switch off: no windmill');
  assert.equal(V.golfTerrainOf(Object.assign({}, m, { v: undefined })), null, 'a square from before: no terrain');
  const rot = (mini, play) => { const x = G(), out = []; x.g.c = new Proxy(x.c, { get: (t, k) => (k === 'rotate' ? a => out.push(a) : t[k]) }); V.drawGolf(x.g, mini, play ? posAt(play.ph.rec, play.el) : U.physStill(mini), play, null); return out; };
  const idle = rot(m);
  assert.ok(idle.length >= 4, 'a windmill: its shadow and its two bars'); assert.deepEqual(rot(m), idle, 'still between shots');
  const f = flashOf(m, 'X', { aim: 0.4, power: 0.5 }), a0 = rot(m, { ph: f.phys, el: 0 }), a1 = rot(m, { ph: f.phys, el: 0.5 });
  assert.ok(Math.abs(a0[0] - idle[0]) < 1e-9, 'the shot finds it as it stood'); assert.ok(Math.abs(a1[0] - a0[0]) > 0.3, 'and it turns as the shot plays');
  const end = rot(m, { ph: f.phys, el: 99 }), after = rot(m);
  assert.ok(Math.abs(end[0] - after[0]) < 0.005, 'the next shot finds it where the last one left it (to its clock\'s thousandths)');
  // water: a putt found into a pond
  let wet = null;
  for (const h of P.HOLES.map((_, i) => i).filter(i => P.HOLES[i].terrain.water.length)) {
    const [wx, wy] = P.HOLES[h].terrain.water[0], m2 = dealt(h); m2.balls.X = [wx, Math.min(155, wy + 14)];
    if (m2.balls.X[1] > 150) continue;
    const was = m2.balls.X.slice(), g = flashOf(m2, 'X', { aim: E.aimTo(m2.balls.X, [wx, wy]), power: 0.3 });
    if (g.phys.water && g.phys.water.X) { wet = { m: m2, f: g, was }; break; }
  }
  assert.ok(wet, 'a putt into the water');
  assert.ok(Math.hypot(wet.m.balls.X[0] - wet.was[0], wet.m.balls.X[1] - wet.was[1]) < 0.05, 'back where it began'); assert.equal(wet.m.shots.X, 2, 'the shot and the stroke for the water');
  const sp = wet.f.phys.events.find(e => e.k === 'water'), x = G();
  assert.equal(V.drawGolf(x.g, wet.m, posAt(wet.f.phys.rec, sp.t + 0.1), { ph: wet.f.phys, el: sp.t + 0.1 }, null), true, 'the splash plays');
  const names = []; U.physicsSounds(wet.f, n => names.push(n));
  assert.equal(names.filter(n => n === 'golfSplash').length, 1, `the splash, once (${names})`);
  assert.ok(HAP.movePlan(Object.assign({}, wet.f, { winner: null, kind: 'move' }), names.map((n, i) => [n, i * 100])).some(q => q[0] === 'error'), 'its error buzz');
  for (const n of ['golfSplash', 'golfSand']) assert.ok(require('node:fs').readFileSync(new URL('../../SOUNDS.md', import.meta.url), 'utf8').includes('`' + n + '`'), `${n} is listed in SOUNDS.md`);
});

test('Mini Golf: a holed ball drops into the cup and the sparks play after the recording lets it go; the putter strokes as the shot starts; a post pops as it kicks; then nothing more is wanted', () => {
  const cup = P.HOLES[2].cup, mini = golf(2, [cup[0], cup[1] + 22], [90, 150]);
  const f = flashOf(mini, 'X', { aim: 0, power: 0.33 }), ph = f.phys, rec = ph.rec, hole = ph.events.find(e => e.k === 'hole');
  assert.ok(hole && ph.first === 'X', 'the ball goes down');
  const draw = (m, p, t) => { const x = G(); return { busy: V.drawGolf(x.g, m, posAt(p.rec, t), { ph: p, el: t }, null), x }; };
  const ballsIn = x => x.arcs.filter(a => Math.abs(a[2] - P.GOLF.ballR * K) < 0.01).length;
  const start = draw(mini, ph, 0.02);
  assert.equal(start.busy, true, 'the putter\'s stroke is under way as the shot starts');
  const mid = draw(mini, ph, 0.42 + 0.0);
  assert.equal(mid.busy, false, 'the stroke over, nothing dropping: the recording alone keeps the frames coming');
  const drop = draw(mini, ph, hole.t + V.GOLFV.drop * 0.6), sparks = draw(mini, ph, hole.t + V.GOLFV.drop + 0.2), after = draw(mini, ph, hole.t + V.GOLFV.drop + V.GOLFV.burst + 0.05);
  assert.equal(drop.busy, true, 'the ball is on its way down the cup');
  assert.ok(drop.x.arcs.some(a => a[2] < P.GOLF.ballR * K - 0.2 && a[2] > P.GOLF.ballR * K * 0.5 && Math.abs(a[0] - (44 + cup[0] * K)) < 4), 'drawn smaller, at the cup');
  assert.equal(sparks.busy, true, 'the sparks round the cup'); assert.ok((sparks.x.calls.lineTo || 0) > (after.x.calls.lineTo || 0), 'their rays are drawn');
  assert.equal(after.busy, false, 'and done');
  assert.ok(hole.t + V.GOLFV.drop + V.GOLFV.burst <= (E.playMs(Object.assign({ square: 0 }, f, { kind: 'claim' }), 0) || ph.ms + 720) / 1000 + 0.2, 'within the move\'s own time');
  assert.ok(ballsIn(after.x) < ballsIn(mid.x), 'one ball fewer on the course');
  // a post: found on the first hole by trying aims off the tee
  let hit = null;
  for (let a = -1.2; a < 1.2 && !hit; a += 0.05) { const m = E.newMini('golf', E.makeRng('gp')); m.hole = 40 % P.HOLES.length; const tee = P.HOLES[m.hole].tee; m.balls = { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] }; const g = flashOf(m, 'X', { aim: +a.toFixed(3), power: 0.6 }); const e = g.phys.events.find(e => e.k === 'bump'); if (e) hit = { m, ph: g.phys, e }; }
  assert.ok(hit, 'a putt that meets a post');
  const before = draw(hit.m, hit.ph, Math.max(0.4, hit.e.t - 0.05)), pop = draw(hit.m, hit.ph, hit.e.t + 0.05);
  const post = P.HOLES[hit.m.hole].bumpers[hit.e.b], big = x => x.arcs.some(a => Math.abs(a[0] - (44 + post[0] * K)) < 0.01 && a[2] > post[2] * K * 1.1);
  assert.equal(pop.busy, true); assert.ok(big(pop.x) && (hit.e.t < 0.45 || !big(before.x)), 'the post pops and its ring goes out as it kicks, not before');
  const still = G(); assert.equal(V.drawGolf(still.g, hit.m, U.physStill(hit.m), null, { ring: 'X' }), false, 'the course at rest: one drawing, no more wanted');
  for (const [aim, power] of [[0, 0.8], [1.2, 0.5], [0, 0.1], [-1.05, 1], [0.3, 0.01]]) { const x = G(); assert.doesNotThrow(() => V.drawGolfAim(x.g, hit.m, U.physStill(hit.m), { aim, power }, 'X'), `a pull at ${aim}, ${power}: drawn`); assert.ok(x.calls.stroke > 4, 'the putter at the least'); }
});

test('Mini Golf: each sound from its event, once: the putter as the shot starts, the knocks by how hard, a post\'s boing, the lip, the cup; a putt that rolls to a stop has no result sound', () => {
  const list = f => { const out = []; U.physicsSounds(f, (n, ms, rate) => out.push([n, Math.round(ms), rate])); return out; };
  const cup = P.HOLES[2].cup;
  const f1 = flashOf(golf(2, [cup[0], cup[1] + 22], [90, 150]), 'X', { aim: 0, power: 0.33 }), s1 = list(f1);
  assert.deepEqual(s1.map(s => s[0]), ['golfPutt', 'golfCup'], 'a putt in: the putter, the cup');
  assert.equal(s1[0][1], 0); assert.equal(s1[1][1], Math.round(f1.phys.events.find(e => e.k === 'hole').t * 1000), 'the cup as the ball drops');
  assert.deepEqual(HAP.movePlan(Object.assign({}, f1, { winner: null, kind: 'move' }), s1).map(x => x[0]), ['tap', 'medium'], 'the tap, then the result\'s buzz at the drop');
  const s2 = list(flashOf(golf(2, [cup[0], cup[1] + 22], [90, 150]), 'X', { aim: 0, power: 1 })).map(s => s[0]);
  assert.equal(s2[0], 'golfPutt'); assert.equal(s2.filter(n => n === 'golfLip').length, 1, `a hard one lips out, once (${s2})`); assert.ok(!s2.includes('ding') && !s2.includes('thud') && !s2.includes('golfCup'));
  const s3 = list(flashOf(golf(7, [10, 155]), 'X', { aim: 0, power: 0.2 }));
  assert.deepEqual(s3.map(s => s[0]), ['golfPuttSoft'], 'a soft putt on open ground: the soft putter and nothing else');
  const s4 = list(flashOf(golf(7, [12, 150]), 'X', { aim: -0.9, power: 0.6 })), knocks = s4.filter(s => /^golfKnock/.test(s[0]));
  assert.ok(knocks.length >= 1 && knocks[0][0] === 'golfKnock', `the kerb, struck hard (${s4.map(s => s[0])})`);
  for (const s of s4) assert.ok(s[2] == null || (s[2] > 0.85 && s[2] < 1.3), 'a sound\'s pitch stays near its own');
  for (const n of ['golfPutt', 'golfPuttSoft', 'golfKnock', 'golfKnockSoft', 'golfBoing', 'golfLip', 'golfCup']) assert.ok(require('node:fs').readFileSync(new URL('../../SOUNDS.md', import.meta.url), 'utf8').includes('`' + n + '`'), `${n} is listed in SOUNDS.md`);
});
