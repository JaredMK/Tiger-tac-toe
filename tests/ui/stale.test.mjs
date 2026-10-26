// Cross-version resume: an online match holding a mini-game this client lacks (unknown to it, or newer than it: a client
// older than it was, back in a match dealt for the newer one) is never drawn as a board here; the page shows the stale
// screen (ui/screens/stale.js) with Update and Leave match (a loss, as leaving always is), and, once the match is over,
// its result and Main menu. A match of games this client has renders as ever. Rendered in Node with the browser's names
// stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { renderMain } = await import('../../src/ui/render.js');
const { matchStale, renderStale, setStaleConfirm } = await import('../../src/ui/screens/stale.js');
const { state } = await import('../../src/ui/app.js');
const { CLIENT_VERSION } = await import('../../src/core/client.js');

const online = { kind: 'mm', game: 'game-12345', me: 'X', joined: true, shownSeq: 0, matchId: 'm1' };
const match = () => E.newMatch(E.makeRng('stale'), { games: ['ttt', 'c4', 'hilo'] });
const enter = (st, extra) => { Object.assign(state, st, { screen: 'board', zoom: null, flash: null, done: null, spot: null, winner: null, online: Object.assign({}, online) }, extra || {}); setStaleConfirm(false); };

test('a match of games this client has renders the board, not the stale screen', () => {
  enter(match());
  assert.equal(matchStale(), false);
  const html = renderMain();
  assert.doesNotMatch(html, /stale-scr/);
  assert.match(html, /class="[^"]*board/, 'the board');
});
test('a square with a mini-game unknown to this version: the stale screen, never the board; Update and Leave match (which says it counts as a loss)', () => {
  const st = match(); st.squares[4].mini.type = 'zzz';
  enter(st);
  assert.equal(matchStale(), true);
  const html = renderMain();
  assert.match(html, /stale-scr/);
  assert.doesNotMatch(html, /class="[^"]*board/);
  assert.match(html, /This match uses a mini-game this version doesn't have/);
  assert.match(html, /data-act="stale-update"[^>]*>Update</);
  assert.match(html, /data-act="stale-leave"[^>]*>Leave match</);
  assert.match(html, /counts as a loss/);
  assert.doesNotMatch(html, /data-act="pause"/, 'no in-game menu');
  for (const act of ['stale-update', 'stale-leave']) assert.match(html, new RegExp(`data-act="${act}"`), act);
  assert.equal((html.match(/data-act="/g) || []).length, 2, 'two buttons');
  // Leave match asks once more before the loss
  setStaleConfirm(true);
  const ask = renderMain();
  assert.match(ask, /Leave and take the loss\?/);
  assert.match(ask, /data-act="stale-leave-yes"/); assert.match(ask, /data-act="stale-stay"/);
  assert.doesNotMatch(ask, /data-act="stale-leave"[^-]/);
});
test('a mini-game newer than this client (its minVersion above the version), in a square or only in the match\'s list: the stale screen too', () => {
  const st = match(); st.games = ['ttt', 'c4', 'hilo', 'newgame'];   // a reset could deal it: never shown here
  enter(st);
  assert.equal(matchStale(), true);
  assert.match(renderMain(), /stale-scr/);
  // (every game's minVersion is this code's version or older, so a newer game can only be made up: lackedTypes with an older client stands in for it)
  assert.ok(E.lackedTypes({ v: '0.9.0', p: 'web' }, match()).length > 0, 'an older client lacks the games newer than it');
  assert.equal(E.lackedTypes({ v: CLIENT_VERSION, p: 'web' }, match()).length, 0);
});
test('the match over while on the stale screen (left, or forfeited): its result in words and Main menu, no board or win screen', () => {
  const st = match(); st.squares[4].mini.type = 'zzz';
  enter(st, { winner: 'O', resigned: 'X', winReason: 'resign' });
  let html = renderMain();
  assert.match(html, /stale-scr/); assert.match(html, /Match over/);
  assert.match(html, /You left the match: it counts as a loss\./);
  assert.match(html, /data-act="stale-menu"[^>]*>Main menu</);
  assert.equal((html.match(/data-act="/g) || []).length, 1);
  enter(st, { winner: 'X', resigned: 'O' });
  html = renderMain();
  assert.match(html, /You won/);
  enter(st, { winner: 'draw' });
  assert.match(renderMain(), /draw/);
});
test('not in an online match: never the stale screen, whatever the saved squares hold', () => {
  const st = match(); st.squares[4].mini.type = 'zzz';
  enter(st, { online: null, screen: 'menu' });
  assert.equal(matchStale(), false);
  assert.doesNotMatch(renderMain(), /stale-scr/);
  Object.assign(state, { online: Object.assign({}, online) });
  assert.match(renderStale(), /stale-scr/, 'the screen itself, for a match this phone is in');
});
