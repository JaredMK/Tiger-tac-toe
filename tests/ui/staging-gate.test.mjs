// Staging's gate on the page (net/accounts.js), by the admin's switch (config/staging/mode, read once as the page starts:
// releases.js fetchStagingMode). Open: no gate at all, anyone plays locally without logging in (the gate never shows, no
// login asked). Allowlist (or the switch unread): the gate stands, asking for a login, and an account off the list is
// refused (the server's stagingAccess). Each page load a fresh copy of the module (a query on the import).
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle'])
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
globalThis.window = { TTC_ENV: { staging: true, config: { apiKey: 'k', databaseURL: 'https://ttc-staging.example', projectId: 'ttc-staging' } } };
let mode = null, asked = [];
globalThis.fetch = async url => { asked.push(String(url)); return { ok: true, json: async () => mode }; };
const tick = () => new Promise(r => setTimeout(r, 0));
let k = 0;
const load = () => import(`../../src/net/accounts.js?page=${++k}`);

test('Open: no gate, nobody asked to log in (local play as on production)', async () => {
  mode = 'open'; asked = [];
  const A = await load();
  assert.equal(A.GATED, true, 'staging');
  await A.stagingMode();
  assert.ok(asked.some(u => u === 'https://ttc-staging.example/config/staging/mode.json'), 'the switch read from its public node');
  assert.equal(A.stagingOpen, true);
  assert.equal(A.gateOn(), false, 'no gate screen');
  A.gateUser(null); await tick(); await tick();
  assert.equal(A.gate, 'ok', 'no one logged in: still no gate');
  A.gateUser({ isAnonymous: true }); await tick(); await tick();
  assert.equal(A.gateOn(), false, 'a guest session: no gate');
});
for (const m of ['allowlist', null, 'something']) {
  test(`Allowlist (the switch ${m === null ? 'unset' : `"${m}"`}): the gate stands and asks for a login`, async () => {
    mode = m;
    const A = await load();
    await A.stagingMode();
    assert.equal(A.stagingOpen, false);
    assert.equal(A.gateOn(), true, 'the gate screen');
    A.gateUser(null); await tick(); await tick();
    assert.equal(A.gate, 'login', 'nobody logged in: the login');
    assert.equal(A.gateOn(), true);
  });
}
test('the switch unreadable (offline): Allowlist, never open by accident', async () => {
  const f = globalThis.fetch; globalThis.fetch = async () => { throw new Error('offline'); };
  const A = await load();
  assert.equal(await A.stagingMode(), 'allowlist');
  assert.equal(A.gateOn(), true);
  globalThis.fetch = f;
});
