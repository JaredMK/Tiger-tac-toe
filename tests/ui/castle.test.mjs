// Castle Smash's view (games/castle/view.js), rendered in Node with the browser's names stubbed: the screen's fixed
// rows (tallies, the scene's canvas, the result line reserved from the start), the miniature (both castles as they
// stand, a picture, no text), a recorded block's pose between its frames, and the shot's sounds, each once from the
// simulation's events (someone else's shot first draws the catapult back; this phone's own is ahead by that pull).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const { state } = await import('../../src/ui/app.js');
const V = await import('../../src/games/castle/view.js');
const R = await import('../../src/games/castle/rules.js');
const { SFX } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS, BAD_SOUNDS } = await import('../../src/ui/haptics.js');

const match = (cpu) => { const st = E.newMatch(E.makeRng('cs-ui'), { games: ['castle'] }); Object.assign(state, st, { screen: 'mini', zoom: 4, online: null, cpu: cpu || null, sc: null, flash: null, done: null }); state.turn = 'X'; return state.squares[4]; };
const draw = (sq, a) => V.screen(sq, a || null, null, sq.mini, false, false, a || null, null, false, null, false, state.turn, {});

test('Castle Smash: the screen: two tallies, the scene\'s canvas (live on the mover\'s turn), the result line reserved; no help text in it', () => {
  const sq = match();
  const html = draw(sq);
  assert.match(html, /^<div class="g-cs pc-X"><div class="ctals">/); assert.equal((html.match(/class="ctal /g) || []).length, 2);
  assert.match(html, /<div class="csfield live"><canvas class="cscv"/); assert.match(html, /<p class="csline"><\/p>/);
  assert.ok(!/drag|tap|swipe/i.test(html.replace(/aria-label="[^"]*"/g, '')), 'no instructions inside the game');
  assert.match(html, /aria-label="0 shots"/);
  // a shot on show: the canvas no longer takes a drag, the line says what came of it, the thrower's count turns over
  const m = sq.mini, shot = R.castleAimAt(R.castleCore(m.c.O)[1] / 10, 70, 0.8, R.castleCfg(m).vMax);
  assert.ok(E.playMove(state, 4, shot, E.makeRng('s')).ok);
  const f = state.flash, h2 = draw(state.squares[4], f);
  assert.ok(!/csfield live/.test(h2)); assert.match(h2, /<p class="csline (ok|no) appear" style="--t:\d+ms" role="status">[A-Z][^<]+<\/p>/);
  assert.match(h2, /<i class="was" style="--t:\d+ms"><span>0<\/span><small>shots<\/small><\/i><i class="now" style="--t:\d+ms"><span>1<\/span><small>shot<\/small><\/i>/);
  assert.match(V.moveText(f, 'Sam'), /^Sam/); assert.equal(typeof V.replay.synth, 'function'); assert.deepEqual(V.replay.synth(f), []); assert.equal(V.ownLine, true);
});

test('Castle Smash: the miniature: both castles block for block, a crystal in each, a drawn mark by each, no text', () => {
  const sq = match(), m = sq.mini, html = V.miniature(m, false);
  assert.match(html, /^<div class="tcs" aria-label="Castle Smash: X's castle \d+ blocks, O's castle \d+ blocks"><svg /);
  assert.equal((html.match(/<rect /g) || []).length, m.c.X.length + m.c.O.length - 2); assert.equal((html.match(/class="tcsg"/g) || []).length, 2);
  assert.equal((html.match(/class="ttok [XO]"/g) || []).length, 2); assert.ok(!/<text|undefined|NaN/.test(html));
  m.c.O = m.c.O.filter(b => b[0] !== R.K.core); m.c.X[0] = [m.c.X[0][0], m.c.X[0][1] + 40, m.c.X[0][2], 700];
  const after = V.miniature(m, true);
  assert.equal((after.match(/class="tcsg"/g) || []).length, 1, 'a smashed crystal is gone'); assert.match(after, /rotate\(-40\)/, 'a toppled block lies as it fell (X\'s castle is drawn turned round)');
});

test('Castle Smash: a recorded block between its frames, and gone at its going', () => {
  const w = [0, 4000, 800, 0], d = { tr: new Map([[1, { f0: 10, v: [800, 160, 0, 820, 150, 50], gone: 13 }]]) };
  assert.deepEqual(V.poseAt(d, w, 0, 5), [400, 80, 0], 'no track: where it lies');
  assert.deepEqual(V.poseAt(d, w, 1, 3), [400, 80, 0], 'before its first frame: where it lay');
  assert.deepEqual(V.poseAt(d, w, 1, 10.5), [405, 77.5, 0.5]); assert.deepEqual(V.poseAt(d, w, 1, 12), [410, 75, 1]); assert.equal(V.poseAt(d, w, 1, 13), null);
});

test('Castle Smash: the sounds: each from an event of the simulation, once; someone else\'s shot starts with the rope and the fling', () => {
  for (const n of ['csPull', 'csFling', 'csWhoosh', 'csKnock', 'csWood', 'csThump', 'csCrack', 'csBreak', 'csCrumble', 'csOff', 'csSmash', 'csDud']) assert.ok(SFX[n], n);
  assert.ok(RESULT_SOUNDS.has('csSmash') && RESULT_SOUNDS.has('csBreak') && BAD_SOUNDS.has('csDud'));
  const sq = match('O'); state.turn = 'O';
  const m = sq.mini, shot = R.castleAimAt(R.castleCore(m.c.X)[1] / 10, 30, 0.45, R.castleCfg(m).vMax);
  assert.ok(E.playMove(state, 4, shot, E.makeRng('s')).ok);
  const f = state.flash, ph = f.phys, got = []; V.sounds(f, (n, ms, rate) => got.push([n, Math.round(ms), rate]), false, m, null);
  const lead = R.CST.pull + R.CST.swing, step = 1000 / R.CS.hz;
  assert.deepEqual(got.slice(0, 3).map(x => x[0]), ['csPull', 'csFling', 'csWhoosh']); assert.deepEqual([got[0][1], got[1][1]], [0, R.CST.pull]);
  const hits = ph.ev.filter(e => e.k === 'hit' && e.v >= R.CS.knock);
  assert.ok(hits.length, 'the boulder struck something'); assert.ok(got.some(x => ['csKnock', 'csWood', 'csThump'].includes(x[0]) && x[1] === Math.round(lead + hits[0].t * step)), 'its first knock at its moment');
  for (const [k, n] of [['crack', 'csCrack'], ['core', 'csSmash'], ['off', 'csOff']]) assert.equal(got.filter(x => x[0] === n).length, ph.ev.filter(e => e.k === k).length, n);
  assert.equal(got.filter(x => x[0] === 'csBreak' || x[0] === 'csCrumble').length, ph.ev.filter(e => e.k === 'break').length);
  assert.ok(got.every(x => x[1] >= 0 && x[1] <= E.playMs(f)), 'all inside the move');
  // this phone's own shot: no rope, no fling (heard as it let go), everything earlier by the pull it never shows
  state.cpu = 'O'; state.turn = 'X'; const sq2 = state.squares[4];
  assert.ok(E.playMove(Object.assign(state, { flash: null, done: null }), 4, R.castleAimAt(R.castleCore(sq2.mini.c.O)[1] / 10, 30, 0.45, R.castleCfg(m).vMax), E.makeRng('t')).ok);
  const own = []; V.sounds(state.flash, (n, ms) => own.push([n, Math.round(ms)]), false, sq2.mini, null);
  assert.ok(!own.some(x => x[0] === 'csPull' || x[0] === 'csFling')); const h0 = state.flash.phys.ev.find(e => e.k === 'hit' && e.v >= R.CS.knock);
  assert.ok(own.some(x => x[1] === Math.round(R.CST.swing + h0.t * step)), 'its knock a swing after the fling');
});
