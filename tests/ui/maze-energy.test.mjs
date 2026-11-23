// Maze Runner's energy (ui: games/maze/view.js meter): a pip a square in the mover's colour, the ones a dash spends
// emptying one by one from the move as the runner steps in, the meter's row only where the square has a limit; out of
// energy: the meter shakes, "Out of energy!" in the line, its sigh once, inside the flash.
import test from 'node:test';
import assert from 'node:assert/strict';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const V = await import('../../src/games/maze/view.js');
const R = await import('../../src/games/maze/rules.js');

const pips = h => [...h.matchAll(/<i class="mzp([^"]*)"(?: style="--t:(\d+)ms")?>/g)].map(m => [m[1].trim(), m[2] == null ? null : +m[2]]);
test('Maze Runner energy: the meter between turns: the mover\'s energy left, none at all with no limit', () => {
  const mini = { type: 'maze', v: 3, cap: 10, en: { X: 3, O: 0 }, at: { X: 0, O: 0 } };
  const h = V.meter(mini, 'X', null), p = pips(h);
  assert.equal(p.length, 10); assert.equal(p.filter(x => x[0] === '').length, 7); assert.match(h, /mzen X/); assert.match(h, /Energy: 7 of 10/);
  assert.equal(pips(V.meter(mini, 'O', null)).filter(x => x[0] === '').length, 10);
  assert.equal(V.meter({ cap: 0, en: { X: 0, O: 0 } }, 'X', null), '', 'no limit: no meter');
  assert.equal(V.meter({ at: { X: 0 } }, 'X', null), '', 'a square from before: no meter');
  assert.match(V.meter({ cap: 40, en: { X: 0, O: 0 } }, 'O', null), /mzen O many/);
});
test('Maze Runner energy: a dash spends its pips one by one, timed from the move, the last one first; out of it the meter shakes', () => {
  const s = { from: 0, path: [1, 2, 3], end: 'fork', fresh: [], cap: 10, left: 8 }, p = pips(V.meter({}, 'O', s));
  assert.deepEqual(p.map(x => x[0]), ['', '', '', '', '', 'e sp', 'e sp', 'e sp', 'e', 'e']);
  assert.deepEqual(p.filter(x => x[1] != null).map(x => x[1]), [2, 1, 0].map(j => Math.round((j + 0.35) * R.MAZE.step)), 'pip 8 first, then 7, then 6');
  assert.doesNotMatch(V.meter({}, 'O', s), /out/);
  const t = { from: 0, path: [1, 2], end: 'tired', fresh: [], cap: 10, left: 2 }, h = V.meter({}, 'X', t);
  assert.match(h, /mzen X out" style="--t:190ms"/); assert.equal(pips(h).filter(x => x[0] === '').length, 0);
  const out = []; V.sounds({ type: 'maze', by: 'X', mz: t }, n => out.push(n), false);
  assert.ok(out.includes('mzTired') && !out.includes('mzBonk'));
  const f = { type: 'maze', by: 'X', mz: t }, at = []; V.sounds(f, (n, ms) => at.push(ms)); assert.ok(Math.max(...at) < R.flashMs(f), 'inside the flash');
  assert.equal(R.flashMs(f), 2 * R.MAZE.step + R.MAZE.tired);
  assert.equal(V.moveText(f, 'Sam'), 'Sam ran out of energy');
});
