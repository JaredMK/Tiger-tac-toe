// Mini Golf's course as it is drawn and heard (November 2026, the polish sweep; games/golf/view.js, ui/physics.js): the
// sight line is the putt (how far a putt rolls and the first thing in its way agree with the simulation), a holed ball
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

test('Mini Golf: the sight line is the putt: a putt rolls as far as the simulation takes it, and meets the first wall, post or the cup where the simulation does', () => {
  for (const p of [0.1, 0.25, 0.4, 0.6]) {                         // open ground (hole 7's left side, straight up from the bottom)
    const r = P.run('golf', golf(7, [10, 155]), 'X', { aim: 0, power: p });
    assert.ok(r.events.every(e => e.k === 'stop'), 'nothing in the way');
    assert.ok(Math.abs(V.golfReach(p, P.GOLF) - (155 - r.final.X[1])) < 0.15, `power ${p}: rolls ${(155 - r.final.X[1]).toFixed(2)}, the line says ${V.golfReach(p, P.GOLF).toFixed(2)}`);
  }
  assert.equal(V.golfReach(0), 0); assert.ok(V.golfReach(1, P.GOLF) > 160, 'a full putt outruns the course');
  let walls = 0, posts = 0, cups = 0, tried = 0, grazes = 0;
  for (let hole = 0; hole < P.HOLES.length; hole += 2) for (let aim = -1.45; aim <= 1.5; aim += 0.3) {
    const h = P.HOLES[hole], from = [h.tee[0] - 3, h.tee[1]], mini = golf(hole, from), s = V.golfSight(h, mini.balls, 'X', aim, P.GOLF);
    assert.ok(s && s.kind !== 'none' && s.t >= 0 && s.t < 200, 'something is always in the way (the kerb at the least)');
    const r = P.run('golf', mini, 'X', { aim, power: 0.9 }), e = r.events[0], i = r.rec.ids.indexOf('X');
    if (e.k === 'stop' || V.golfReach(0.9, P.GOLF) < s.t) continue;
    tried++;
    if (s.kind === 'corner' || s.graze > V.GOLFV.graze) { grazes++; assert.equal(s.off, null, 'a wall\'s end, the merest touch of a post: no way off promised'); continue; }   // (the simulation's balls and posts are ten-sided: such a touch may slip by)
    const at = r.rec.frames[Math.max(0, Math.round(e.t * r.rec.fps) - 1)], far = Math.hypot(at[2 * i] - from[0], at[2 * i + 1] - from[1]);
    assert.ok(Math.abs(far - s.t) < 6, `hole ${hole}, aim ${aim.toFixed(2)}: the first ${e.k} after ${far.toFixed(1)}, the line says a ${s.kind} at ${s.t.toFixed(1)}`);
    assert.equal({ wall: 'wall', bump: 'post', hole: 'cup', lip: 'cup', balls: 'ball' }[e.k], s.kind, `hole ${hole}, aim ${aim.toFixed(2)}: a ${e.k}, the line says ${s.kind}`);
    if (s.kind === 'wall') { walls++; assert.ok(s.off && s.off[0] * s.n[0] + s.off[1] * s.n[1] > 0 && s.dir[0] * s.n[0] + s.dir[1] * s.n[1] < 0, 'into the wall, and off it'); }
    if (s.kind === 'post') { posts++; assert.deepEqual(s.off, s.n, 'straight off a post'); }
    if (s.kind === 'cup') cups++;
  }
  assert.ok(grazes < tried / 8, `mostly square on (${grazes} of ${tried})`);
  assert.ok(walls > 10 && posts > 0, `walls ${walls}, posts ${posts}, cups ${cups}`);
  const cup = P.HOLES[2].cup, toCup = V.golfSight(P.HOLES[2], { X: [cup[0], cup[1] + 30], O: [90, 150] }, 'X', 0, P.GOLF);
  assert.equal(toCup.kind, 'cup'); assert.ok(Math.abs(toCup.t - (30 - P.GOLF.cupR)) < 0.01, 'the cup: where the ball\'s middle crosses its edge');
  assert.equal(V.golfSight(P.HOLES[2], { X: [cup[0], cup[1] + 30], O: [cup[0], cup[1] + 15] }, 'X', 0, P.GOLF).kind, 'ball', 'the other ball in the way');
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
