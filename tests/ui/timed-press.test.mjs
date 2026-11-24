// Timed stops take the moment of the press itself (ui/press.js pressTime): Darts Cricket, Bullseye, Target Practice, Key
// Drop, Home Run Heroes and Barrel Launch. Each game's own listeners are fed press events whose timeStamp is well before
// the moment they are handled (a busy phone: a frame being drawn, a long task), and the move the game makes must be
// the sweep where it was at the event's timeStamp, never where it was when the page got round to it. The Stop/Swing
// buttons take the press too (a click comes only once the finger lifts), and the click after a press taken does
// nothing, so a tap counts once; a click with no press before it (the keyboard's, a test's) still stops.
// Rendered in Node with the browser's names stubbed, the app's listeners kept.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
// The app element keeps its listeners; any element it is asked for is a canvas-like stub with a size.
const L = {}, WL = {};
const listen = into => (type, fn) => { (into[type] = into[type] || []).push(fn); };
const el = new Proxy(stub(), { get: (t, k) => (k === 'getBoundingClientRect' ? () => ({ width: 300, height: 340, x: 0, y: 0 }) : k === 'offsetWidth' ? 0 : k === 'getContext' ? () => stub() : k === 'disabled' ? false : stub()) });
const appEl = new Proxy(stub(), { get: (t, k) => (k === 'addEventListener' ? listen(L) : k === 'querySelector' ? () => el : k === 'querySelectorAll' ? () => [] : stub()) });
globalThis.document = new Proxy(stub(), { get: (t, k) => (k === 'getElementById' ? () => appEl : stub()) });
globalThis.window = new Proxy(stub(), { get: (t, k) => (k === 'addEventListener' ? listen(WL) : k === 'devicePixelRatio' ? 1 : stub()) });
let frames = [];
globalThis.requestAnimationFrame = fn => { frames.push(fn); return frames.length; };
globalThis.cancelAnimationFrame = () => {};
const runFrames = now => { for (let k = 0; k < 4 && frames.length; k++) { const f = frames; frames = []; f.forEach(fn => fn(now)); } };

const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { pressTime, pressTook, pressTaken, PRESS } = await import('../../src/ui/press.js');
const VIEWS = {};
for (const t of ['cricket', 'bullseye', 'target', 'keydrop', 'homer', 'barrel']) { VIEWS[t] = await import(`../../src/games/${t}/view.js`); GAMES[t].view = VIEWS[t]; }
VIEWS.bullseye.init();

const now = () => performance.now();
const until = t => { while (now() < t) { /* the phone busy */ } };
function match(type) {
  Object.assign(state, E.newMatch(E.makeRng('press:' + type), { games: [type], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  renderMini(state.squares[0]);
  return state.squares[0].mini;
}
// A press: the event the browser gives, its timeStamp `ts`, on the element whose classes are `cls`.
function press(type, ts, cls, key) {
  const hit = s => !/\.bar\b/.test(s) && !/^button:not/.test(s) && (s.includes('main.scr.mini') || cls.split(' ').some(c => s.includes(c)));
  const e = { type, timeStamp: ts, key, repeat: false, pointerId: 1, preventDefault() {}, target: { closest: s => (hit(s) ? { dataset: {} } : null) } };
  for (const fn of (type === 'pointerup' ? WL : L)[type] || []) fn(e);
  return e;
}
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} against ${b}`);

test('pressTime: the event\'s own moment on performance.now()\'s clock; an event without one, from the future or from another clock: now', () => {
  const t = now();
  assert.equal(pressTime({ timeStamp: t - 120 }), t - 120);
  near(pressTime({}), now(), 2, 'no timeStamp');
  near(pressTime({ timeStamp: t + 5000 }), now(), 2, 'a moment not yet come');
  near(pressTime({ timeStamp: Date.now() }), now(), 2, 'an epoch timestamp');
  near(pressTime({ timeStamp: t - PRESS.maxAge - 500 }), now(), 2, 'too long ago to be this press');
  assert.equal(pressTime(null) > 0, true);
  pressTook('ck-stop'); assert.equal(pressTaken('tp-stop'), false, 'another control\'s click is a tap');
  pressTook('ck-stop'); assert.equal(pressTaken('ck-stop'), true); assert.equal(pressTaken('ck-stop'), false, 'once');
});

test('Darts Cricket: each line stops where it was at the press (the board or the Stop button), not when it was handled; the button\'s click after it does nothing', async () => {
  const R = await import('../../src/games/cricket/rules.js'), { bullsWave } = await import('../../src/games/bullseye/rules.js'), m = match('cricket'), c = R.cricketCfg(m);
  const lineAt = t => R.CRK.lo + (R.CRK.hi - R.CRK.lo) * bullsWave(t, c.sweep);
  const t0 = now(), ts1 = t0 + 230; until(ts1 + 150);                        // the press at 230 ms, handled 150 ms later
  press('pointerdown', ts1, 'ckfield live');
  const ts2 = ts1 + 410; until(ts2 + 140);
  press('pointerdown', ts2, 'ckbtn');                                       // the Stop button, on the press
  VIEWS.cricket.actions['ck-stop'](null, { timeStamp: now() });            // its click, once the finger lifts: nothing
  const l = m.last; assert.ok(l, 'the throw was made');
  near(l.x, Math.round(lineAt(ts1 - t0) * 10) / 10, 0.6, 'the first stop at the press');
  assert.ok(Math.abs(lineAt(ts1 + 150 - t0) - l.x) > 3, 'not where the line was when handled');
  near(l.y, Math.round(lineAt(ts2 - ts1) * 10) / 10, 0.15, 'the second stop at the press, timed from the first press');
  assert.ok(Math.abs(lineAt(ts2 + 140 - ts1) - l.y) > 3);
  assert.equal(m.n.X, 1, 'one throw: the click did not stop again');
});

test('Darts Cricket: a click with no press before it (Enter on the button, a screen reader) still stops, at the click\'s moment', async () => {
  const R = await import('../../src/games/cricket/rules.js'), { bullsWave } = await import('../../src/games/bullseye/rules.js'), m = match('cricket'), c = R.cricketCfg(m);
  const lineAt = t => R.CRK.lo + (R.CRK.hi - R.CRK.lo) * bullsWave(t, c.sweep);
  const t0 = now(), ts1 = t0 + 100; until(ts1 + 20);
  VIEWS.cricket.actions['ck-stop'](null, { timeStamp: ts1 });
  const ts2 = ts1 + 300; until(ts2 + 90);
  press('keydown', ts2, 'ckbtn', 'Enter');
  near(m.last.y, Math.round(lineAt(ts2 - ts1) * 10) / 10, 0.15, 'Enter: its keydown\'s moment');
  VIEWS.cricket.actions['ck-stop'](null, { timeStamp: now() });            // (Enter's own click after it: nothing)
  assert.equal(m.n.X, 1);
});

test('Target Practice: the lines and the circle stop where they were at each press', async () => {
  const R = await import('../../src/games/target/rules.js'), m = match('target'), c = R.targetCfg(m);
  const t0 = now(), ts1 = t0 + 260; until(ts1 + 160);
  press('pointerdown', ts1, 'tpfield live');
  const ts2 = ts1 + 330; until(ts2 + 150); press('pointerdown', ts2, 'tpbtn');
  VIEWS.target.actions['tp-stop'](null, { timeStamp: now() });
  const ts3 = ts2 + 280; until(ts3 + 170); press('pointerdown', ts3, 'tpfield live');
  const l = m.last; assert.ok(l, 'the throw was made');
  near(l.x, Math.round(R.targetLine(c, ts1 - t0) * 10) / 10, 0.6, 'x at the press');
  near(l.y, Math.round(R.targetLine(c, ts2 - ts1) * 10) / 10, 0.15, 'y at the press');
  near(l.r, Math.round(R.targetRing(c, ts3 - ts2) * 10) / 10, 0.15, 'the circle at the press');
  assert.ok(Math.abs(R.targetLine(c, ts2 + 150 - ts1) - l.y) > 3 || Math.abs(R.targetRing(c, ts3 + 170 - ts2) - l.r) > 1, 'not at the handling');
  assert.equal(m.n.X, 1);
});

test('Bullseye: the up-down line stops where it was at the press, timed from the first press', async () => {
  const R = await import('../../src/games/bullseye/rules.js'), m = match('bullseye');
  const per = Math.round(R.bullsPeriod(R.bullsConfig(), 1)), perY = R.bullsPeriodY(per);
  const ts1 = now() + 30; until(ts1 + 150); press('pointerdown', ts1, 'g-arc bl-live');
  const ts2 = ts1 + 370; until(ts2 + 160); press('pointerdown', ts2, 'g-arc bl-live');
  const l = m.last; assert.ok(l, 'the dart was thrown');
  const y = Math.round(R.bullsWave(ts2 - ts1, perY) * 1000) / 1000;
  near(l.fy, y, 0.002, 'y at the press');
  assert.ok(Math.abs(R.bullsWave(ts2 + 160 - ts1, perY) - l.fy) > 0.05, 'not at the handling');
});

test('Key Drop: each hold lasts from the finger down to the finger up, by their own moments', async () => {
  const R = await import('../../src/games/keydrop/rules.js'), m = match('keydrop'), v = R.keydSpeed(R.keydCfg(m), 0);
  const ts1 = now() + 10; until(ts1 + 200); press('pointerdown', ts1, 'kydbtn');            // the press handled 200 ms late,
  const ts2 = ts1 + 620; until(ts2 + 5); press('pointerup', ts2, 'kydbtn');                 // the release at once
  const ts3 = ts2 + 200; until(ts3 + 160); press('pointerdown', ts3, 'kydfield live');
  const ts4 = ts3 + 540; until(ts4 + 5); press('pointerup', ts4, 'kydfield live');
  const l = m.last; assert.ok(l, 'the key was pushed');
  near(l.x, Math.round(R.keydAt(R.KEYD.x0, v.x, ts2 - ts1) * 10) / 10, 0.15, 'x: the hold from press to release');
  near(l.y, Math.round(R.keydAt(R.KEYD.y0, v.y, ts4 - ts3) * 10) / 10, 0.15, 'y: the hold from press to release');
  assert.ok(Math.abs(R.keydAt(R.KEYD.x0, v.x, ts2 + 5 - ts1 - 200) - l.x) > 2 && Math.abs(R.keydAt(R.KEYD.y0, v.y, ts4 + 5 - ts3 - 160) - l.y) > 2, 'not by the handling');
});

test('Home Run Heroes: a swing is timed by the press (the field or Swing!), and Swing!\'s click after its press is no second swing', async () => {
  const R = await import('../../src/games/homer/rules.js'), m = match('homer');
  frames = [];
  VIEWS.homer.actions['hr-go'](null, { timeStamp: now() });               // Play ball (a click: not a timed stop)
  const t0 = now(), plan = R.homerPlan(R.homerPitches(m, 'X'));
  const ts1 = t0 + plan.at[0].c - 40; until(ts1 + 150); press('pointerdown', ts1, 'hrbtn');
  VIEWS.homer.actions['hr-go'](null, { timeStamp: now() });               // its click: nothing
  const ts2 = t0 + plan.at[1].c + 25; until(ts2 + 130); press('pointerdown', ts2, 'hrfield');
  runFrames(t0 + plan.end + 50);                                           // the at-bat over: the move goes in
  const l = m.last; assert.ok(l, 'the at-bat went in');
  near(l.s[0], -40, 2, 'the first swing 40 ms early, as pressed (handled 110 ms late)');
  near(l.s[1], 25, 2, 'the second 25 ms late, as pressed');
  assert.equal(l.s.length, plan.at.length);
});

test('Barrel Launch: the shot is the column\'s clock at the press', async () => {
  const m = match('barrel'), c0 = m.c.X, ts = now() + 420, want = Math.round(VIEWS.barrel.barrelClock('X', ts) - c0);
  until(ts + 160); press('pointerdown', ts, 'brlfield live');
  const l = m.last; assert.ok(l, 'the shot was fired');
  near(l.t, want, 1, 'at the press');
  assert.ok(Math.abs(l.t - (want + 160)) > 100, 'not at the handling');
  assert.equal(l.c, c0);
});
