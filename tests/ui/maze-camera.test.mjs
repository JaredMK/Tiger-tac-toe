// Maze Runner's camera (ui: games/maze/view.js mazeCam): a maze that fits its box at MAZEV.min px a cell or more is
// shown whole and centred; a bigger one is shown at that size, a window on the runner, never past the maze's edges.
import test from 'node:test';
import assert from 'node:assert/strict';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const { mazeCam, MAZEV } = await import('../../src/games/maze/view.js');
const R = await import('../../src/games/maze/rules.js');

test('Maze Runner camera: the default 8 by 10 maze fits a 375px phone whole; a 12 by 14 one follows the runner, clamped to the maze', () => {
  const small = mazeCam(R.mazeGeoOf(8, 10), 345, 411, 0, 9);
  assert.ok(small.fit && small.u >= MAZEV.min, `whole at ${small.u.toFixed(1)}px a cell`);
  assert.ok(Math.abs(small.ox * 2 + 8 * small.u - 345) < 1e-6 && small.oy >= 0, 'centred');
  const G = R.mazeGeoOf(12, 14), W = 345, H = 411;
  const corner = mazeCam(G, W, H, 0, 13);
  assert.ok(!corner.fit && Math.abs(corner.u - MAZEV.min) < 1e-9, 'not shrunk: the smallest readable cell');
  assert.deepEqual([corner.ox, Math.round(corner.oy)], [0, Math.round(H - 14 * corner.u)], 'at the door\'s corner the window stops at the maze\'s edges');
  const mid = mazeCam(G, W, H, 6, 7), cx = mid.ox + 6.5 * mid.u, cy = mid.oy + 7.5 * mid.u;
  assert.ok(Math.abs(cx - W / 2) < 1e-6 && Math.abs(cy - H / 2) < 1e-6, 'in the middle the runner is centred');
  const far = mazeCam(G, W, H, 11, 0); assert.ok(Math.abs(far.ox - (W - 12 * far.u)) < 1e-6 && far.oy === 0, 'and at the flag\'s corner');
  const wide = mazeCam(G, W, H, 6, 7, MAZEV.dash); assert.ok(wide.u < mid.u, 'a touch wider while dashing');
});
