// A fresh visit opens the main menu (src/net/matchmaking.js freshVisit, called by main.js boot without a join link):
// no screen is restored from the saved state; an online match in progress is held for the menu's "Resume match",
// never entered by itself. And Play Local always offers Super Chaos against the computer, whatever the release
// switch (staging's database starts with it off); a host's room offers it only where it is open.
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const MM = await import('../../src/net/matchmaking.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const { renderSetup, chaosSetup } = await import('../../src/ui/screens/setup.js');
const R = await import('../../src/net/releases.js');
const { acct } = await import('../../src/net/accounts.js');
const { state } = await import('../../src/ui/app.js');

const board = () => E.newMatch(E.makeRng('fv'), { games: ['ttt'] });
test('a fresh visit: a local match saved on the board, in a square or on setup opens the main menu; nothing is held for Resume', () => {
  for (const screen of ['board', 'mini', 'setup', 'win', 'howto']) {
    Object.assign(state, board(), { screen, zoom: screen === 'mini' ? 4 : null, online: null });
    MM.holdResume(null);
    MM.freshVisit();
    assert.equal(state.screen, 'menu', `${screen}: the main menu`);
    assert.equal(MM.resumable, null);
    assert.doesNotMatch(renderMenu(), /Resume match/);
  }
});
test('a fresh visit: an online match in progress opens the main menu with Resume match (never entered by itself); a finished one has no Resume', () => {
  Object.assign(state, board(), { screen: 'board', winner: null, online: { kind: 'mm', game: 'game-12345', me: 'O', joined: true, room: 'ABCDE' } });
  MM.freshVisit();
  assert.equal(state.screen, 'menu'); assert.equal(state.online, null, 'not in the match until Resume');
  assert.deepEqual(MM.resumable, { game: 'game-12345', me: 'O', room: 'ABCDE' });
  assert.match(renderMenu(), /data-act="resume"[^>]*>Resume match<\/button>/);
  MM.holdResume(null);
  Object.assign(state, board(), { screen: 'win', winner: 'X', online: { kind: 'mm', game: 'game-12345', me: 'O', joined: true } });
  MM.freshVisit();
  assert.equal(state.screen, 'menu'); assert.equal(MM.resumable, null, 'over: nothing to resume');
  assert.doesNotMatch(renderMenu(), /Resume match/);
  Object.assign(state, board(), { screen: 'setup', online: { role: 'host', code: 'ABCDE', me: 'X' } });
  MM.freshVisit();
  assert.deepEqual([state.screen, state.online, MM.resumable], ['menu', null, null], 'a lobby: let go of, no Resume');
});
test('Play Local offers Super Chaos against the computer whatever the release switch; a host\'s room only where it is open', () => {
  acct.admin = false;
  R.setReleases({});                                                  // (staging: the switch never set)
  Object.assign(state, board(), { screen: 'setup', online: null });
  R.setMode('chaos');
  assert.equal(chaosSetup(), true, 'local: Super Chaos picked');
  const html = renderSetup();
  assert.match(html, /data-act="gmode" data-v="chaos"/, 'the Mode selector is there');
  assert.doesNotMatch(html.match(/data-v="chaos"[^]*?<\/button>/)[0], /Testing/, 'no Testing badge in Play Local');
  R.setMode('classic'); assert.equal(chaosSetup(), false); R.setMode('chaos');
  state.online = { role: 'host', code: 'ABCDE', me: 'X', chaos: true, joined: false };
  assert.equal(chaosSetup(), false, 'a host\'s room: Super Chaos only where the switch is on');
  assert.doesNotMatch(renderSetup(), /data-act="gmode"/, 'and no selector there');
  R.setReleases({ superchaos: true });
  assert.equal(chaosSetup(), true);
  state.online = null;
});
