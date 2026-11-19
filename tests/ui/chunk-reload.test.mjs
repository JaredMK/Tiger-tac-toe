// A failed dynamic import (its hashed file gone after a deploy): logged as 'chunk' and the page reloaded once; a second
// failure within the guard is logged 'chunk2' and not reloaded again (no loop); other errors are left alone.
import test from 'node:test';
import assert from 'node:assert/strict';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'navigator', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const store = {};
globalThis.sessionStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } };
let reloads = 0; globalThis.location = { reload: () => { reloads++; }, href: 'https://x.test/' };
const T = await import('../../src/net/tracking.js'), P = await import('../../src/net/platform.js');
test('which messages are a failed chunk', () => {
  for (const m of ['Failed to fetch dynamically imported module: https://x/b/c-AB.js', 'error loading dynamically imported module', 'Importing a module script failed.']) assert.ok(T.isChunkError(m), m);
  for (const m of ['x is not a function', '', null]) assert.ok(!T.isChunkError(m), String(m));
});
test('reloadOnce: once, then not within the guard, then again after it', () => {
  const t0 = 1e12;
  assert.equal(P.reloadOnce(t0), true); assert.equal(reloads, 1);
  assert.equal(P.reloadOnce(t0 + 60000), false); assert.equal(reloads, 1, 'no loop');
  assert.equal(P.reloadOnce(t0 + 11 * 60000), true); assert.equal(reloads, 2);
});
test('chunkFailed logs it and reloads once; the second is logged and left', async () => {
  for (const k of Object.keys(store)) delete store[k]; reloads = 0;
  const before = T.devErrors.length, wait = ms => new Promise(r => setTimeout(r, ms));
  assert.equal(T.chunkFailed('Failed to fetch dynamically imported module: b/c-X.js'), true);
  assert.equal(T.chunkFailed('something else'), false);
  await wait(800); assert.equal(reloads, 1);
  assert.ok(T.devErrors.slice(before).some(e => e.startsWith('chunk: Failed to fetch')));
  T.chunkFailed('Failed to fetch dynamically imported module: b/c-X.js'); await wait(800);
  assert.equal(reloads, 1, 'not reloaded a second time'); assert.ok(T.devErrors.some(e => e.startsWith('chunk2:')));
});
