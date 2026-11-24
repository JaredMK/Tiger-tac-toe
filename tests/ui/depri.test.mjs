// Deprioritized (December 2026): a game the admin has set aside (releases/depri/{type} true on a game not released) stays in
// the code and on the admin's Games page, but is dealt to nobody, the admin included: off the admin's Mini-games checklist
// (setupTypes, so its templates too), How to Play (and so Practice) and the Game lineup (core/games.js lineup, Coming soon
// too). Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const A = await import('../../src/net/accounts.js');
const R = await import('../../src/net/releases.js');
const { setupTypes } = await import('../../src/ui/screens/setup.js');
const { renderHowTo } = await import('../../src/ui/explainer.js');
const G = await import('../../src/core/games.js');
const { state } = await import('../../src/ui/app.js');

test('a deprioritized game: off the admin\'s checklist and How to Play; a Testing game stays; a released one flagged is ignored', () => {
  Object.assign(state, E.newMatch(E.makeRng('dp'), { games: ['ttt'] }), { screen: 'menu', online: null }); state.setup.vs = 'cpu';
  A.acct.user = { uid: 'adm1' }; A.acct.admin = true;
  R.setReleases({ depri: { hex: true, ttt: true } });
  assert.ok(E.TEST_TYPES.includes('hex') && E.TEST_TYPES.includes('maze'));
  assert.ok(!R.visibleTypes().includes('hex'), 'not in the admin\'s games');
  assert.ok(!setupTypes().includes('hex'), 'not in the admin\'s Mini-games checklist');
  assert.ok(setupTypes().includes('maze'), 'a Testing game is');
  assert.ok(setupTypes().includes('ttt'), 'a released game flagged: the flag is ignored');
  state.screen = 'howto';
  const how = renderHowTo();
  assert.doesNotMatch(how, /data-t="hex"/, 'not in How to Play (so no Practice)'); assert.match(how, /data-t="maze"/, 'a Testing game is');
  A.acct.admin = false;
  assert.ok(!R.visibleTypes().includes('hex'));
  R.setReleases({});
});
test('the core: status, the admin\'s deal, the lineup\'s Coming soon', () => {
  const rel = { depri: { hex: true, ttt: true }, soon: { hex: true, maze: '2999-01-01' } };
  assert.equal(G.gameStatus('hex', rel), 'depri'); assert.equal(G.gameStatus('maze', rel), 'testing'); assert.equal(G.gameStatus('ttt', rel), 'released');
  assert.equal(G.depriOn('ttt', rel), false, 'never a released game');
  assert.ok(!G.allowedTypes(rel, true).includes('hex') && G.allowedTypes(rel, true).includes('maze'), 'the admin\'s rooms and local matches');
  assert.ok(!G.allowedTypes(rel, false).includes('hex'));
  const L = G.lineup(rel, 'web');
  assert.ok(!L.soon.includes('hex') && L.soon.includes('maze'), 'never coming soon');
  assert.ok(!L.now.includes('hex'));
  assert.equal(G.depriOn('hex', { depri: { hex: true }, hex: true }), false, 'released in the database: not deprioritized');
});
