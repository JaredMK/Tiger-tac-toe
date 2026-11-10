// The player's stats kept on this device (src/net/statscache.js): one copy for one account, read back whole, dropped
// for another account or on a sign-out; My Stats opens from it (src/ui/screens/profile.js) and shows a "Loading…" only
// when there is none. Rendered in Node with the browser's names stubbed and a real map for localStorage.
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, configurable: true, writable: true });
const C = await import('../../src/net/statscache.js');
const P = await import('../../src/ui/screens/profile.js');
const { state } = await import('../../src/ui/app.js');

const data = { user: { username: 'ann', wins: 3, losses: 1, draws: 0 }, hist: [{ id: 'g1', date: 5, result: 'win', opponent: { name: 'bo' }, side: 'X', how: 'line' }], local: { wins: 1 }, opps: [] };
test('the stats are kept for one account and read back whole; another account or a clear drops them', () => {
  assert.equal(C.readStats('u1'), null);
  C.writeStats('u1', data);
  const r = C.readStats('u1');
  assert.deepEqual([r.user, r.hist, r.local, r.opps], [data.user, data.hist, data.local, data.opps]);
  assert.equal(C.readStats('u2'), null, 'only that account\'s');
  C.clearStats(); assert.equal(C.readStats('u1'), null);
  store.set('tiger-tac-toe.v4.stats', '{broken'); assert.equal(C.readStats('u1'), null, 'a damaged copy is no copy');
});
test('My Stats shows the kept stats at once and a loading line only without them', () => {
  const was = state.screen;
  P.setProf({ uid: 'u1', own: true, user: data.user, hist: data.hist, local: data.local, opps: [], view: 'online', back: 'menu', error: null, cached: true });
  assert.doesNotMatch(P.renderProfile(), /Loading/); assert.doesNotMatch(P.renderProfHist(), /Loading/);
  P.setProf({ uid: 'u1', own: true, user: null, hist: null, local: null, opps: null, view: 'online', back: 'menu', error: null });
  assert.match(P.renderProfile(), /Loading/);
  state.screen = was;
});
