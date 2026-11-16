// Find Match's fallback (December 2026): searching alone about 20 s, the search screen offers the computer (labelled);
// nothing before that; the results of such a match say so; Find Match switched off is not shown at all (no "soon").
import test from 'node:test';
import assert from 'node:assert/strict';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const MM = await import('../../src/net/matchmaking.js');
const { renderFind } = await import('../../src/ui/screens/find.js');

test('the computer offered after about 20 s alone, not before', () => {
  Object.assign(MM.search, { on: true, found: false, since: Date.now(), msg: '', bot: false });
  assert.doesNotMatch(renderFind(), /search-bot/);
  MM.search.since = Date.now() - MM.OFFER_MS - 10;
  const html = renderFind();
  assert.match(html, /data-act="search-bot"/);
  assert.match(html, /Play the Computer/);
  assert.match(html, /No one around right now/);
  assert.equal(MM.OFFER_MS, 20000);
  MM.search.on = false;
});
