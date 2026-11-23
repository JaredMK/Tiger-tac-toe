// Maze Runner's win (ui: games/maze/view.js): the flag's ding, the fog lifting, the dance's hops and spin, each once
// from the move, in order, all inside the flash; the won chime with the pose.
import test from 'node:test';
import assert from 'node:assert/strict';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const V = await import('../../src/games/maze/view.js');
const R = await import('../../src/games/maze/rules.js');

test('Maze Runner win: the reveal and the dance sound once each, in order, inside the flash; the won chime with the pose', () => {
  const f = { type: 'maze', by: 'X', mz: { from: 30, path: [22, 14, 6, 7], end: 'flag', fresh: [22, 14, 6, 7], rev: [0, 1, 2] } };
  const out = []; V.sounds(f, (n, at, r) => out.push([n, at]), true);
  const names = out.map(x => x[0]).filter(n => n !== 'mzStep');
  assert.deepEqual(names, ['ding', 'mzReveal', 'mzHop', 'mzHop', 'mzSpin']);
  const land = 4 * R.MAZE.step, total = R.flashMs(f);
  for (const [, at] of out) assert.ok(at < total, 'inside the flash');
  const won = V.wonAt(f, total);
  assert.equal(won, land + R.mazeDanceAt() + R.MAZE.pose);
  assert.ok(won > out.at(-1)[1] && won < total);
  const dead = { type: 'maze', by: 'O', mz: { from: 30, path: [22], end: 'dead', fresh: [] } };
  const o2 = []; V.sounds(dead, n => o2.push(n), false); assert.ok(!o2.includes('mzReveal') && !o2.includes('mzHop'));
});
