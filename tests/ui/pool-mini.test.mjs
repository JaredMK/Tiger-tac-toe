// Pool's miniature is a table (felt, rails, six pockets) with the balls on it from the moment the board shows it, before
// the physics library has loaded (games/pool/view.js POOL_TABLE); the same once it is in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { PHYSICS, setPhysics } = await import('../../src/games/shared/physics.js');
const V = await import('../../src/games/pool/view.js');

test('Pool: the miniature draws the table and its balls before the physics library loads, and after', () => {
  const lib = PHYSICS.lib;
  const mini = E.newMini('pool', E.makeRng('pool-mini'));
  setPhysics(null);
  try {
    const html = V.miniature(mini, false);
    assert.match(html, /class="rail"/, 'the rails');
    assert.match(html, /class="cloth"/, 'the felt');
    assert.equal((html.match(/class="pocket"/g) || []).length, 6, 'six pockets');
    assert.ok((html.match(/<circle[^>]*class="(X|O|cue|black)"/g) || []).length >= 8, 'the balls on it');
  } finally { setPhysics(lib); }
  if (lib) assert.match(V.miniature(mini, false), /class="cloth"/, 'the same once the library is in');
});
