// Ready for the iOS app, on the web page itself: "Please update" below the admin's minimum (config/clients), Sign in with
// Apple beside Google and email, join links read from any address that opens the game (the page's own, or a deep link
// handed to the app), and nothing in a core flow relying on the browser tab (a reload, window.open, navigating the address).
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const { setClientMins, mustUpdate, updateNeeded, renderUpdate } = await import('../../src/ui/update.js');
const { renderLogin } = await import('../../src/ui/screens/account.js');
const { linkCode } = await import('../../src/ui/input.js');
const { PLATFORM, clientInfo } = await import('../../src/net/platform.js');
const { CLIENT_VERSION } = await import('../../src/core/client.js');

test('the web page reports itself as the web at this code\'s version', () => {
  assert.equal(PLATFORM, 'web');
  assert.deepEqual(clientInfo(), { v: CLIENT_VERSION, p: 'web' });
});
test('"Please update": only below this platform\'s minimum, or when the server says so; one button', () => {
  setClientMins(null); assert.equal(updateNeeded(), false);
  setClientMins({ ios: '99.0.0' }); assert.equal(updateNeeded(), false, 'the app\'s minimum is not the web\'s');
  setClientMins({ web: '99.0.0' }); assert.equal(updateNeeded(), true);
  setClientMins({ web: CLIENT_VERSION }); assert.equal(updateNeeded(), false, 'at the minimum: plays');
  const html = renderUpdate();
  assert.match(html, /Please update/);
  assert.equal((html.match(/data-act="/g) || []).length, 1);
  assert.match(html, /data-act="update-app"/);
  mustUpdate(); assert.equal(updateNeeded(), true, 'the server refused a match: { update: true }');
});
test('the login screen offers Google, Apple and email', () => {
  const html = renderLogin(false);
  for (const act of ['login-google', 'login-apple', 'login-email', 'login-create']) assert.match(html, new RegExp(`data-act="${act}"`), act);
  assert.match(html, /Continue with Apple/);
});
test('a join link from any address that opens the game: the page\'s own, or a deep link into the app', () => {
  assert.equal(linkCode('https://tictacchaos.com/?room=abcde'), 'ABCDE');
  assert.equal(linkCode('https://staging.tictacchaos.com/?room=AB-CDE&t=sam'), 'ABCDE');
  assert.equal(linkCode('https://tictacchaos.com/?play=find'), null);
  assert.equal(linkCode('https://tictacchaos.com/?room=OOOOO'), null, 'not a code (no O in codes)');
});
test('no core flow relies on the browser tab: no reload, window.open or navigating the address outside net/platform.js', () => {
  const root = path.resolve('src'), hits = [];
  const walk = d => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.js')) {
    const rel = path.relative(root, p).split(path.sep).join('/');
    if (['net/platform.js', 'ui/sandbox.js', 'env.js'].includes(rel)) continue;   // (the platform's own; the admin's test play is the web's alone)
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => { if (/location\.(reload|assign|replace)\s*\(|location\.href\s*=[^=]|window\.open\s*\(|location\.search|history\.(push|replace)State/.test(l.replace(/\/\/.*$/, ''))) hits.push(`${rel}:${i + 1}`); });
  } } };
  walk(root);
  assert.deepEqual(hits, [], 'go through net/platform.js');
});
