// The page's global error catcher (net/tracking.js catchErrors): an uncaught error or a rejected promise goes to the
// device's log as a devError, each distinct one once a visit, at most 20 a visit.
import test from 'node:test';
import assert from 'node:assert/strict';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const T = await import('../../src/net/tracking.js');

test('errors and rejections caught, once each, at most 20 a visit', () => {
  const ls = {};
  const win = { addEventListener: (k, f) => { ls[k] = f; } };
  T.catchErrors(win);
  const before = T.devErrors.length;
  ls.error({ message: 'boom', filename: 'https://x/src/ui/board.js', lineno: 12 });
  ls.error({ message: 'boom', filename: 'https://x/src/ui/board.js', lineno: 12 });
  ls.unhandledrejection({ reason: new Error('nope') });
  const got = T.devErrors.slice(before);
  assert.deepEqual(got, ['js: boom @board.js:12', 'promise: nope']);
  for (let k = 0; k < 40; k++) T.catchError('js', 'e' + k);
  assert.ok(T.devErrors.length - before <= 20, 'at most 20 a visit');
});
