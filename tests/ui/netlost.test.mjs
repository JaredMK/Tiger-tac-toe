// The connection lost during an online match (src/net/connect.js onConnected, lostWatch; src/ui/turnbar.js netBar): a
// blip shows nothing; after NET_LOST.afterMs without the connection the band "Connection lost — reconnecting…" shows
// over the board and the SDK's socket is bounced, again every NET_LOST.retryMs, until .info/connected says it is back,
// when the band goes at once. Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const C = await import('../../src/net/connect.js');
const { netBar } = await import('../../src/ui/turnbar.js');
const { state } = await import('../../src/ui/app.js');
const { setRender } = await import('../../src/ui/render.js');
const { assignNet } = await import('../../src/net/room.js');

setRender(() => {});                                               // (no page to draw)
assignNet({ status: 'ok', msg: '' });
C.NET_LOST.afterMs = 40; C.NET_LOST.retryMs = 30;
let off = 0, on = 0;
C.setFb({ m: new Proxy({ goOffline() { off++; }, goOnline() { on++; } }, { get: (t, k) => (k in t ? t[k] : stub()) }), db: {}, uid: 'u1' });   // a stand-in SDK: bounce() counts, anything else is a stub
const wait = ms => new Promise(r => setTimeout(r, ms));
const band = () => { const m = netBar().match(/<div class="netbar ([^"]+)"[^>]*>(.*?)<\/div>/); return m ? { cls: m[1], text: m[2] } : null; };

test('connection lost: a blip shows nothing; after NET_LOST.afterMs the band shows and the socket is bounced, every NET_LOST.retryMs, until the connection is back', async () => {
  Object.assign(state, { screen: 'board', online: { kind: 'mm', game: 'g1', me: 'X', joined: true } });
  C.onConnected(true);
  assert.equal(band(), null, 'all well: no band');
  C.onConnected(false);
  assert.equal(C.netLost, false); assert.equal(band(), null, 'just dropped: nothing yet (a blip)');
  await wait(15);
  C.onConnected(true);                                            // back within the grace: a blip
  await wait(50);
  assert.equal(C.netLost, false); assert.equal(band(), null, 'a blip never shows'); assert.equal(off, 0, 'and never bounces');
  C.onConnected(false);
  await wait(60);
  assert.equal(C.netLost, true);
  assert.deepEqual(band(), { cls: 'lost', text: 'Connection lost — reconnecting…' });
  assert.equal(off, 1, 'bounced once at the band'); assert.equal(on, 1);
  await wait(70);
  assert.ok(off >= 3, `bounced again every retryMs (${off})`);
  C.onConnected(true);
  const n = off;
  assert.equal(C.netLost, false); assert.equal(band(), null, 'back: the band goes at once');
  await wait(70);
  assert.equal(off, n, 'and no more bounces');
});
test('connection lost: not in an online match, nothing shows (the band is the online match\'s)', async () => {
  state.online = null;
  C.onConnected(false);
  await wait(60);
  assert.equal(band(), null);
  C.onConnected(true);
});
