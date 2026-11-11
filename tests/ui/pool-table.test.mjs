// Pool's table as it is drawn and heard (November 2026, the polish pass; games/pool/view.js, ui/physics.js): the
// balls' marks roll with the balls and come to rest face up, a pocketed ball drops into its hole after the recording
// has let it go, the cue strokes through the white as the shot starts, the sight line draws without a hitch for a
// ball, a rail, a pocket and a shot too soft to arrive, and every sound comes from its event, once. Rendered in Node
// with the browser's names stubbed (motion on) and a canvas that only counts what is drawn.
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
const V = await import('../../src/games/pool/view.js');
const U = await import('../../src/ui/physics.js');

// A canvas context that counts: every call by name, the arcs drawn (x, y, r) and the alpha they were drawn at.
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
const G = () => { const x = ctx(), k = 3; return Object.assign(x, { g: { c: x.c, W: 360, H: 582, k, M: V.POOL_RAIL, X: v => 10 + v * k, Y: v => 21 + v * k } }); };
const flashOf = (mini, p, shot) => { const r = E.applyMove(mini, p, shot, E.makeRng('pt')); assert.equal(r.ok, true); const f = { type: 'pool', by: p, kind: r.outcome === 'win' ? 'claim' : 'move' }; E.rulesOf('pool').moveFlash(shot, p, null, null, mini, f); return f; };

test('Pool: a ball pocketed drops into its hole after the recording lets it go; the cue strokes as the shot starts; then nothing more is wanted', () => {
  const mini = E.newMini('pool', E.makeRng('pt1')); mini.balls.x1 = [14, 16]; mini.balls.cue = [34, 40];
  const f = flashOf(mini, 'X', { aim: +Math.atan2(14 - 34, 40 - 16).toFixed(3), power: 0.42 }), ph = f.phys, rec = ph.rec;
  assert.deepEqual(ph.pocketed, ['x1'], 'the ball goes down');
  const i = rec.ids.indexOf('x1'), gone = rec.frames.findIndex(fr => fr[2 * i] == null) / rec.fps;
  const posAt = t => { const k = Math.min(rec.frames.length - 1, Math.floor(t * rec.fps)), o = {}; rec.ids.forEach((id, j) => { o[id] = rec.frames[k][2 * j] == null ? null : [rec.frames[k][2 * j], rec.frames[k][2 * j + 1]]; }); return o; };
  const draw = t => { const x = G(); return { busy: V.drawPool(x.g, mini, posAt(t), null, { ph, el: t }), x }; };
  const start = draw(0.01);
  assert.equal(start.busy, true, 'the cue\'s stroke is under way as the shot starts');
  assert.ok(start.x.calls.closePath >= 6, 'the cue is drawn (its lengths)');
  const mid = draw(Math.max(0.5, gone - 0.2));
  assert.equal(mid.busy, false, 'the stroke over, nothing dropping: the recording alone keeps the frames coming');
  const balls = x => x.arcs.filter(a => Math.abs(a[2] - P.POOL.ballR * 3) < 0.01).length;
  const drop = draw(gone + 0.1), after = draw(gone + 0.5);
  assert.equal(drop.busy, true, 'the ball is on its way down the pocket');
  assert.ok(drop.x.arcs.some(a => a[2] < P.POOL.ballR * 3 - 0.2 && a[2] > P.POOL.ballR * 3 * 0.5 && a[0] < 10 + 14 * 3 && a[1] < 21 + 16 * 3), 'drawn smaller, nearer the hole than where it was let go');
  assert.equal(after.busy, false, 'and gone');
  assert.ok(balls(after.x) < balls(mid.x), 'one ball fewer on the table');
});

test('Pool: the sight line draws for a ball, a rail, a pocket and a shot too soft to arrive; the table at rest draws every ball', () => {
  const mini = E.newMini('pool', E.makeRng('pt2')), pos = U.physStill(mini);
  const still = G(); assert.equal(V.drawPool(still.g, mini, pos, null, null), false, 'the table at rest: one drawing, no more wanted');
  assert.ok(still.arcs.filter(a => Math.abs(a[2] - P.POOL.ballR * 3) < 0.01).length >= 8 * 2, 'all eight balls (each its disc and its outline)');
  for (const [aim, power, what] of [[0, 0.8, 'ball'], [1.2, 0.8, 'rail'], [0, 0.2, 'short'], [-1.05, 0.8, 'any']]) {
    const x = G();
    assert.doesNotThrow(() => V.drawPoolAim(x.g, mini, pos, { aim, power }, 'X'), `${what}: drawn`);
    assert.ok(x.calls.stroke > 8 && x.calls.closePath >= 6, `${what}: the line, the cue and the meter`);
  }
  const lone = { cue: [50, 90] }, x = G();
  assert.doesNotThrow(() => V.drawPoolAim(x.g, Object.assign({}, mini, { balls: lone }), lone, { aim: -Math.PI / 2, power: 0.7 }, 'O'), 'into a pocket: drawn');
});

test('Pool: each sound from its event, once: the cue as the shot starts, the balls and cushions by how hard they met, the drop, the white going down; the chime for one\'s own ball just after it drops', () => {
  const list = f => { const out = []; U.physicsSounds(f, (n, ms) => out.push([n, Math.round(ms)])); return out; };
  const pot = E.newMini('pool', E.makeRng('pt3')); pot.balls.x1 = [14, 16]; pot.balls.cue = [34, 40];
  const f1 = flashOf(pot, 'X', { aim: +Math.atan2(14 - 34, 40 - 16).toFixed(3), power: 0.42 }), s1 = list(f1);
  assert.deepEqual(s1[0], ['poolCue', 0], 'the cue on the white, at once');
  const drop = s1.find(s => s[0] === 'poolDrop'), ding = s1.find(s => s[0] === 'ding');
  assert.ok(drop && ding && ding[1] > drop[1] && ding[1] <= drop[1] + 200 && ding[1] <= f1.phys.ms, `the chime just after the drop (${JSON.stringify(s1)})`);
  assert.equal(s1.filter(s => s[0] === 'poolDrop').length, 1); assert.ok(s1.some(s => /^pool(Tick|Clack|Crack)$/.test(s[0])), 'the balls meeting');
  const soft = E.newMini('pool', E.makeRng('pt4')); soft.balls = { cue: [50, 140], x1: [50, 100] };
  const s2 = list(flashOf(soft, 'X', { aim: 0, power: 0.33 }));
  assert.deepEqual(s2.map(s => s[0]), ['poolCueSoft', 'poolTick'], 'a soft shot: the soft cue, a tick, and no sound for nothing down');
  const hard = E.newMini('pool', E.makeRng('pt5')); hard.balls = { cue: [50, 140], o1: [50, 100] };
  const s3 = list(flashOf(hard, 'X', { aim: 0, power: 1 })).map(s => s[0]);
  assert.ok(s3.includes('poolCrack') && s3.includes('poolRail'), `a full-power hit cracks, and the cushions sound (${s3})`);
  const scr = E.newMini('pool', E.makeRng('pt6')); scr.balls.cue = [80, 24];
  const f4 = flashOf(scr, 'X', { aim: +Math.atan2(100 - 80, 24 - 0).toFixed(3), power: 0.4 }), s4 = list(f4);
  assert.ok(f4.phys.scratch && s4.some(s => s[0] === 'poolScratch') && !s4.some(s => s[0] === 'ding' || s[0] === 'thud'), 'the white going down has its own sound, and no other result sound');
  assert.deepEqual(s4[s4.length - 1], ['pop', f4.phys.ms + 120], 'then the ball popping back on');
  const H = await_haptics;
  assert.deepEqual(H.movePlan(Object.assign({}, f4, { winner: null }), s4).map(x => x[0]), ['tap', 'error'], 'a scratch buzzes as an error, once, at the drop');
  assert.deepEqual(H.movePlan(Object.assign({}, f1, { winner: null }), s1).map(x => x[0]), ['tap', 'medium'], 'a ball down: the tap, then the result\'s buzz');
});
const await_haptics = await import('../../src/ui/haptics.js');
