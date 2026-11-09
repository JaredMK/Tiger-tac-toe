// Start game (the host's lobby): the button answers the tap at once ("Starting…" with a spinner, disabled, no more taps),
// and the start request is sent once however many taps come while it runs; it stays busy until the match's board comes
// (the room's game: enterRoomGame) and lets go on a refusal or an error. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const { renderMain } = await import('../../src/ui/render.js');
const { state } = await import('../../src/ui/app.js');
const C = await import('../../src/net/connect.js');
const R = await import('../../src/net/room.js');

const lobby = () => {
  state.online = { role: 'host', code: 'ABCDE', me: 'X', joined: true, shownSeq: null, matchId: null };
  state.setup.mode = 'online'; state.screen = 'setup'; state.setup.names = { X: 'Ann', O: 'Bo' };
  R.setLobby({ players: { X: { uid: 'a', name: 'Ann' }, O: { uid: 'b', name: 'Bo' } }, status: 'lobby', setup: {} });
  R.setNet('connected', '');
};
C.setFb({ fns: {}, uid: 'a', fnM: {}, db: {}, m: new Proxy({}, { get: () => () => Promise.resolve({ val: () => null }) }) });
C.setConnected(true);

test('Start game: one tap turns the button into Starting… (disabled, a spinner) before the server answers; more taps send nothing more', async () => {
  lobby();
  assert.match(renderMain(), /data-act="start"[^>]*>Start match</, 'the lobby ready: Start match');
  const calls = [];
  let answer = null;
  C.setCall((name, data) => { calls.push({ name, data }); return new Promise(ok => { answer = ok; }); });
  const p1 = R.startOnline();
  assert.equal(R.starting(), true, 'busy at once, before any answer');
  const html = renderMain();
  assert.match(html, /<button class="primary busy" data-act="start" disabled[^>]*>.*Starting…<\/button>/, 'the button says Starting… and takes no taps');
  assert.match(html, /class="spinr"/, 'with a spinner');
  assert.doesNotMatch(html, />Start match</);
  await R.startOnline(); await R.startOnline();                                   // two more taps while it starts
  assert.equal(calls.length, 1, 'one startRoom request, however many taps');
  assert.equal(calls[0].name, 'startRoom'); assert.equal(calls[0].data.code, 'ABCDE');
  answer({ ok: true, started: true, game: 'g1' });
  await p1;
  assert.equal(R.starting(), true, 'still busy once the server has answered: the room\'s match (its board) ends it');
  // the room's listener brings the match: the lobby's Start is over
  R.setNet('idle', '');
  assert.equal(R.starting(), false);
});

test('Start game refused or failed: the button comes back, with the reason in the lobby\'s line', async () => {
  lobby();
  C.setCall(() => Promise.resolve({ ok: false, reason: 'games' }));
  await R.startOnline();
  assert.equal(R.starting(), false);
  assert.match(R.net.msg, /No mini-game can be dealt/);
  assert.match(renderMain(), /data-act="start"[^>]*>Start match</);
  lobby();
  C.setCall(() => Promise.reject(new Error('offline')));
  await R.startOnline();
  assert.equal(R.starting(), false);
  assert.match(R.net.msg, /Couldn't start the match/);
});
