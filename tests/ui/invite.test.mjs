// The room invite (net/invite.js buildInvite): the one place an invite's text is built, and every way it leaves the phone.
// Every path's output carries the code and the /join/CODE link: Share invite on the web (the browser's share sheet, the
// text alone), with no share sheet (copied instead), Copy invite (the same text on the clipboard), on staging and on
// production (the iOS app's Share plugin and Clipboard: tests/ui/native-auth.test.mjs); /join/CODE and ?room=CODE
// both open the join flow (ui/input.js linkCode), the address is tidied after, firebase.json sends /join/CODE to
// /?room=CODE, the app's Universal Links include /join/*; and no other source file builds an invite.
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle'])
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
globalThis.window = { TTC_ENV: {} };
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const { buildInvite, inviteLink } = await import('../../src/net/invite.js');
const { shareRoom, copyInvite } = await import('../../src/net/room.js');
const { linkCode } = await import('../../src/ui/input.js');
const P = await import('../../src/net/platform.js');
const { state } = await import('../../src/ui/app.js');

const has = (text, code, site) => {
  assert.match(text, new RegExp(`Code: ${code}\\b`), 'the code in words');
  assert.ok(text.includes(`${site}join/${code}`), `the /join link: ${text}`);
  assert.equal(linkCode(text.split(' ').pop()), code, 'its link opens the join flow for that code');
};
const web = (origin, pathname = '/') => { globalThis.location = { protocol: 'https:', origin, pathname, href: origin + pathname }; };
const host = code => Object.assign(state, { screen: 'setup', online: { role: 'host', code, me: 'X', joined: false } });

test('buildInvite: the code in words, then the /join/CODE link; never without a code', () => {
  assert.equal(buildInvite('ABCDE', 'https://tictacchaos.com/'), 'Join my Tic Tac Chaos game! Code: ABCDE https://tictacchaos.com/join/ABCDE');
  assert.equal(buildInvite('abcde', 'https://staging.tictacchaos.com'), 'Join my Tic Tac Chaos game! Code: ABCDE https://staging.tictacchaos.com/join/ABCDE');
  assert.equal(inviteLink('XYZWV', 'https://tictacchaos.com/'), 'https://tictacchaos.com/join/XYZWV');
  assert.throws(() => buildInvite('', 'https://tictacchaos.com/'), /no room code/);
  assert.throws(() => buildInvite(null), /no room code/);
});
test('the site in the link: the page\'s origin (never its path), staging\'s on staging, production\'s in the app', () => {
  web('https://staging.tictacchaos.com', '/join/ABCDE'); assert.equal(P.inviteSite(), 'https://staging.tictacchaos.com/');
  web('https://tictacchaos.com', '/index.html'); assert.equal(P.inviteSite(), 'https://tictacchaos.com/');
  has(buildInvite('KMNPQ'), 'KMNPQ', 'https://tictacchaos.com/');
});
for (const [env, site] of [['production', 'https://tictacchaos.com/'], ['staging', 'https://staging.tictacchaos.com/']]) {
  test(`Share invite on the web (${env}): the share sheet gets the one text alone, code and link in it`, async () => {
    web(site.slice(0, -1)); host('BCDFG');
    const shared = []; globalThis.navigator = { share: async d => { shared.push(d); } };
    await shareRoom();
    assert.equal(shared.length, 1); assert.deepEqual(Object.keys(shared[0]), ['text'], 'no url field: some apps share it instead of the text');
    assert.equal(shared[0].text, buildInvite('BCDFG', site)); has(shared[0].text, 'BCDFG', site);
  });
  test(`Copy invite on the web (${env}), and Share with no share sheet: the same text on the clipboard`, async () => {
    web(site.slice(0, -1)); host('HJKLM');
    const copied = []; globalThis.navigator = { clipboard: { writeText: async t => { copied.push(t); } } };
    await copyInvite();
    await shareRoom();                                             // (no navigator.share: copied instead)
    assert.equal(copied.length, 2);
    for (const t of copied) { assert.equal(t, buildInvite('HJKLM', site)); has(t, 'HJKLM', site); }
  });
}
test('Share invite cancelled: nothing copied, nothing else sent', async () => {
  web('https://tictacchaos.com'); host('RSTVW');
  const copied = []; globalThis.navigator = { share: async () => { const e = new Error('Share canceled'); e.name = 'AbortError'; throw e; }, clipboard: { writeText: async t => { copied.push(t); } } };
  await shareRoom();
  assert.deepEqual(copied, []);
});
test('links that open the join flow: /join/CODE (any case, a trailing slash) and ?room=CODE', () => {
  assert.equal(linkCode('https://tictacchaos.com/join/ABCDE'), 'ABCDE');
  assert.equal(linkCode('https://staging.tictacchaos.com/join/abcde/'), 'ABCDE');
  assert.equal(linkCode('https://tictacchaos.com/?room=ABCDE'), 'ABCDE', 'the older link still joins');
  assert.equal(linkCode('https://tictacchaos.com/join/OOOOO'), null, 'not a code');
  assert.equal(linkCode('https://tictacchaos.com/join/'), null);
  assert.equal(linkCode('https://tictacchaos.com/'), null);
});
test('the address is tidied after a /join/CODE link (a reload is not a second join)', () => {
  const seen = [];
  globalThis.location = { protocol: 'https:', origin: 'https://tictacchaos.com', pathname: '/join/ABCDE', href: 'https://tictacchaos.com/join/ABCDE' };
  globalThis.history = { state: null, replaceState: (s, t, u) => seen.push(u) };
  P.tidyLink();
  assert.deepEqual(seen, ['/']);
});
test('the web: firebase.json sends /join/CODE to /?room=CODE; the app: Universal Links include /join/*', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
  const r = (fb.hosting.redirects || []).filter(x => /^\/join\//.test(x.source));
  assert.ok(r.some(x => x.source === '/join/:code' && x.destination === '/?room=:code'), 'the redirect');
  assert.ok(r.some(x => x.source === '/join/:code/'), 'with a trailing slash too');
  const { aasa } = require('../../scripts/build-site.js');
  assert.ok(aasa({ teamId: 'A1B2C3D4E5', bundleId: 'com.example.ttc' }).applinks.details[0].components.some(c => c['/'] === '/join/*'));
});
test('one source of truth: no other file builds an invite', () => {
  const files = [];
  const walk = d => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(m?js|swift|html)$/.test(f.name)) files.push(p); } };
  walk(path.join(ROOT, 'src'));
  for (const d of ['ios/App/App']) if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
  const bad = files.filter(f => !f.endsWith(path.join('net', 'invite.js'))).filter(f => {
    const t = fs.readFileSync(f, 'utf8');
    return /Join my Tic Tac Chaos/.test(t) || /['"`]\?room=/.test(t) || /\+\s*['"`]\/?join\//.test(t) || /\$\{[^}]*\}join\//.test(t);
  });
  assert.deepEqual(bad.map(f => path.relative(ROOT, f)), [], 'an invite\'s text or link is built only by net/invite.js buildInvite');
});
