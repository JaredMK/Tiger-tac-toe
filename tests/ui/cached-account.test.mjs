// The last signed-in account, kept on the device (net/accounts.js cachedMe/cacheMe/pendingMe): on launch the menu's
// top right shows its username at once (never "…") and My Stats its profile, while the saved sign-in comes back; the
// account's own profile then confirms or refreshes it; a sign-out, another account or a guest session drops it.
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const store = new Map();                                            // a real device storage
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) }, configurable: true, writable: true });
const A = await import('../../src/net/accounts.js');
const { renderMenu, setAcctLoading } = await import('../../src/ui/screens/menu.js');
const { KEY } = await import('../../src/ui/config.js');
const chip = () => (renderMenu().match(/<button class="btn chip[^"]*"[^>]*>(.*?)<\/button>/) || [])[1];

test('the menu: no cached account, "…" while a returning account loads; with one, its username at once', () => {
  store.clear(); store.set(KEY + '.acct', '1');
  A.setAcct({ user: null, profile: null, active: null, ready: false });
  setAcctLoading(true);
  assert.equal(chip(), '…', 'nothing cached: the loading chip');
  A.cacheMe('u1', { username: 'Jared', wins: 4 });
  assert.equal(chip(), '<span>Jared</span>', 'cached: the name, never "…"');
  assert.match(renderMenu(), /data-act="profile"/);
  A.setAcct({ user: { uid: 'u1', email: '' }, profile: null, active: null, ready: false });
  assert.equal(chip(), '<span>Jared</span>', 'the sign-in back, the profile still on its way: still the name');
  setAcctLoading(false);
  A.setAcct({ user: { uid: 'u1', email: '' }, profile: { username: 'Jared2' }, active: null, ready: true });
  assert.equal(chip(), '<span>Jared2</span>', 'the account\'s own profile wins');
});
test('the cache: refreshed by the profile, dropped by a sign-out, another account or a guest', () => {
  store.clear(); store.set(KEY + '.acct', '1');
  A.cacheMe('u1', { username: 'Jared', wins: 4 });
  assert.deepEqual(A.cachedMe(), { uid: 'u1', username: 'Jared', profile: { username: 'Jared', wins: 4 } });
  A.setAcct({ user: { uid: 'u2', email: '' }, profile: null, active: null, ready: false });
  assert.equal(A.pendingMe(), null, 'another account signing in: not the cached one');
  A.setAcct({ user: { uid: 'u1', email: '' }, profile: null, active: null, ready: true });
  assert.equal(A.pendingMe(), null, 'the account known with no username: "Pick a username", not the cache');
  A.setAcct({ user: null, profile: null, active: null, ready: false });
  store.delete(KEY + '.acct');
  assert.equal(A.pendingMe(), null, 'no account on this phone any more');
  A.cacheMe(null); assert.equal(A.cachedMe(), null);
  store.set(KEY + '.me', '{bad'); assert.equal(A.cachedMe(), null, 'a broken entry reads as none');
  store.set(KEY + '.me', JSON.stringify({ uid: 'u1', username: '' })); assert.equal(A.cachedMe(), null);
});
test('logging out drops the cached account', async () => {
  store.clear(); store.set(KEY + '.acct', '1');
  A.cacheMe('u1', { username: 'Jared' });
  await A.logout().catch(() => {});
  assert.equal(A.cachedMe(), null);
  assert.equal(store.get(KEY + '.acct'), undefined);
});
