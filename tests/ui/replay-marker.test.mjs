// A computer's (or another player's) taps replayed in Bowling and Bullseye: the marker stops exactly where it tapped and
// stays there (Bowling's meter is timed to be at the recorded power when the tap comes; Bullseye's lines sweep straight
// to the recorded spot, never past it and back). Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const B = await import('../../src/games/bowling/view.js');

test('Bowling: a replayed power tap — the meter rises and falls at its own speed, is exactly at the recorded power at the moment of the tap, and stays there', () => {
  const per = E.bowlConfig().meterMs;
  for (const [power, gap] of [[0.646, 900], [0.1, 900], [0.97, 900], [0.5, 350], [0.3, 2300], [1, 900], [0, 900]]) {
    const log = [[0, 'bowl', 'aim=-0.038'], [gap, 'bowl', `power=${power}`]];
    const r = { sq: 4, by: 'O', list: log, k: 1, speed: 1 };           // (the driver has taken the aim input: k is the next one)
    B.replay.input('bowl', 'aim=-0.038', r);
    const dr = B.bowlDraft;
    assert.ok(dr && dr.rep && dr.step === 2 && dr.to, 'the meter is under way');
    const t0 = dr.t0;
    let prev = -1, passed = false;
    for (let ms = 0; ms <= gap + 3000; ms += 7) {
      const v = B.bowlNow(dr, t0 + ms).power;
      if (ms >= gap) assert.equal(v, power, `${power}: at and after the tap (${ms} ms) the meter is at the recorded power`);
      if (ms < gap) assert.ok(v >= 0 && v <= 1, 'within the meter');
      if (ms >= gap) passed = true;
      prev = v;
    }
    assert.ok(passed && prev === power);
    B.replay.input('bowl', `power=${power}`, Object.assign({}, r, { k: 2 }));   // the tap itself: locked at the recorded power
    assert.deepEqual([B.bowlDraft.step, B.bowlDraft.power], [3, power]);
    assert.equal(B.bowlNow(B.bowlDraft, t0 + gap).power, power);
  }
  // no power in the log after the aim: the meter just runs (nothing to land on)
  B.replay.input('bowl', 'aim=0.1', { sq: 4, by: 'O', list: [[0, 'bowl', 'aim=0.1']], k: 1, speed: 1 });
  assert.equal(B.bowlDraft.to, null);
});

test('Bullseye: a replayed throw sweeps each line straight to where it stopped (never past it and back), for any stop', () => {
  for (const x of [0, 0.02, 0.2, 0.39, 0.4, 0.5, 0.93, 1]) for (const y of [0.01, 0.3, 0.41, 0.77, 1]) {
    const A = E.bullsAim({ x, y, per: 1040 });
    assert.ok(A.vx.it <= 1 && A.vy.it <= 1, `(${x}, ${y}) at most one pass`);
    assert.ok(Math.abs(A.vx.it - Math.max(0.05, x)) < 0.002 && Math.abs(A.vy.it - Math.max(0.05, y)) < 0.002, 'ends where it stopped');
  }
});
