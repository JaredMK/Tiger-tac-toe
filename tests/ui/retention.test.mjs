// Giving returning players a reason to come back (December 2026): the main menu's Game lineup (ui/lineup.js: hidden until a
// match is finished here, "In rotation now" from the release switches for this platform, "Coming soon" from the admin's
// flag and never a game released on that platform, NEW until the sheet is opened and again for a game new to a list), and a
// guest's "Create an account" on the results (ui/acctask.js: after the 2nd finished match, then every 3rd, once a session,
// their own numbers, Not now; never for an account), with the guest's matches kept on the device for the new account
// (net/tracking.js guestKeep, guestRecord, guestSignedUp). Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const mkStore = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), clear: () => m.clear() }; };
globalThis.localStorage = mkStore();
globalThis.sessionStorage = mkStore();
const G = await import('../../src/core/games.js');
const LU = await import('../../src/ui/lineup.js');
const OB = await import('../../src/ui/onboard.js');
const AK = await import('../../src/ui/acctask.js');
const TR = await import('../../src/net/tracking.js');
const R = await import('../../src/net/releases.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const { state } = await import('../../src/ui/app.js');
const { TYPES, TEST_TYPES } = await import('../../src/games/index.js');

test('released on a platform: released at all and not switched off there; coming soon never on a platform it is released on', () => {
  const rel = { war: true, ttt: true, platform: { ios: { war: false } }, soon: { war: true, ttt: true, dominoes: true } };
  assert.ok(G.releasedOn('war', rel, 'web')); assert.ok(!G.releasedOn('war', rel, 'ios'));
  assert.ok(!G.soonOn('war', rel, 'web'), 'released on the web: not coming soon there');
  assert.ok(G.soonOn('war', rel, 'ios'), 'off on iOS: coming soon on iOS alone');
  assert.ok(!G.soonOn('ttt', rel, 'web') && !G.soonOn('ttt', rel, 'ios'), 'released everywhere: never coming soon');
  assert.ok(G.soonOn('dominoes', rel, 'web') && G.soonOn('dominoes', rel, 'ios'));
  for (const p of ['web', 'ios']) {
    const L = G.lineup(rel, p);
    assert.ok(!L.now.some(t => L.soon.includes(t)), `${p}: a game in both lists`);
    assert.deepEqual(L.now, TYPES.filter(t => G.releasedOn(t, rel, p)).sort((a, b) => L.now.indexOf(a) - L.now.indexOf(b)));
    assert.ok(L.now.every(t => G.isReleased(t, rel)));
  }
  assert.ok(G.lineup({}, 'web').now.every(t => !TEST_TYPES.includes(t)), 'nothing set: the games released in the code');
  assert.deepEqual(G.lineup({}, 'web').soon, [], 'nothing coming soon until the admin says so');
  assert.ok(!G.lineup(rel, 'web', t => t !== 'ttt').now.includes('ttt'), 'a game this client lacks is left out');
});

test('the lineup card: hidden before a match is finished here, never on a first visit; NEW until opened, and again for a new game', () => {
  state.screen = 'menu';
  assert.equal(OB.matchesDone(), 0);
  assert.doesNotMatch(renderMenu(), /data-act="lineup"/, 'no match finished: no card');
  OB.matchDone('k1');
  const html = renderMenu();
  assert.match(html, /class="btn lubtn" data-act="lineup"/);
  assert.match(html, /class="lunew"/, 'never opened: NEW');
  assert.ok(html.indexOf('data-act="lineup"') < html.indexOf('data-act="cpu-go"'), 'on the top row, above Play');
  LU.setLineupOpen(true);
  const sheet = LU.renderLineup('menu');
  assert.match(sheet, /In rotation now/);
  assert.doesNotMatch(renderMenu(), /class="lunew"/, 'opened: no NEW');
  assert.equal(LU.renderLineup('setup'), '', 'shut once the menu is left');
  R.setReleases({ soon: { dominoes: true } });
  assert.match(renderMenu(), /class="lunew"/, 'a game new to Coming soon: NEW again');
  LU.setLineupOpen(true);
  const s2 = LU.renderLineup('menu');
  assert.match(s2, /<h2 class="cap luh">Coming soon<\/h2>/);
  assert.match(s2, /class="lut soon">.*Dom.?inoes.*<i class="lusoon">Coming soon<\/i>/s);
  assert.doesNotMatch(s2, /\d{4}|January|December|date/i, 'no dates');
  LU.setLineupOpen(false);
  R.setReleases({});
});

test('the prompt: due after the 2nd finished match, then every 3rd; once a session; Not now; a guest\'s own numbers', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].filter(AK.due), [2, 5, 8, 11]);
  const rep = (id, side, w, cpu = true) => ({ id, side, opponent: { name: cpu ? 'Computer' : 'Sam', cpu }, final: { winner: w, squares: [] }, at: 1 });
  TR.guestKeep(rep('m00001', 'X', 'X')); TR.guestKeep(rep('m00002', 'O', 'O')); TR.guestKeep(rep('m00003', 'X', 'O')); TR.guestKeep(rep('m00004', 'X', 'X', false));
  TR.guestKeep(rep('m00001', 'X', 'X'));                       // (once each)
  assert.equal(AK.askLine(), "You're 2–1 vs the computer.");
  TR.guestKeep(rep('m00005', 'X', 'draw'));
  assert.equal(AK.askLine(), "You're 2–1–1 vs the computer.");
  assert.equal(AK.askLine({ w: 0, l: 0, d: 0, all: 2, n: 2 }), "You've finished 2 matches.");
  TR.guestState.n = 0; TR.guestState.last = null;
  AK.askMatchDone('a'); assert.ok(!AK.askShowing('a'), 'the 1st: no prompt');
  AK.askMatchDone('a'); assert.equal(TR.guestState.n, 1, 'a match is counted once');
  AK.askMatchDone('b'); assert.ok(AK.askShowing('b'), 'the 2nd: the prompt');
  assert.match(AK.askHtml('b'), /You're 2–1–1 vs the computer\.<\/b> Create an account to keep your stats\./);
  assert.match(AK.askHtml('b'), /data-act="acct-ask"/); assert.match(AK.askHtml('b'), /data-act="acct-not"/);
  assert.equal(AK.askHtml('c'), '', 'only on its own match');
  assert.equal(AK.askAct('acct-not'), 'stay'); assert.ok(!AK.askShowing('b'), 'Not now: gone');
  for (const k of ['c', 'd', 'e']) AK.askMatchDone(k);
  assert.equal(TR.guestState.n, 5);
  assert.ok(!AK.askShowing('e'), 'the 5th, but in the same session: not again');
});

test('a guest\'s matches go over to the account they make here; an account is never asked', () => {
  TR.guestTapped();
  assert.equal(TR.guestSignedUp(), true, 'the sign-up came from the prompt');
  assert.ok(TR.guestState.carry, 'carried over once logged in (flushGuest)');
  assert.equal(TR.guestState.list.length, 5);
  assert.equal(TR.guestSignedUp(), false, 'a second username claim is not from the prompt');
  localStorage.setItem('tiger-tac-toe.v4.acct', '1');           // an account on this device: no longer a guest
  assert.ok(!TR.isGuest());
  assert.equal(TR.guestCount('z'), 0, 'not counted');
  localStorage.removeItem('tiger-tac-toe.v4.acct');
});
