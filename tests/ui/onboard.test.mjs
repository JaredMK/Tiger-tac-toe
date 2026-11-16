// The guided first match (ui/onboard.js, docs/fun-review.md CL-29 to CL-33): a first visit's menu is one big Play;
// Play deals the starter board (the nine fixed games), the player X and moving first against Easy, guests included;
// each game's "?" opens once; the coach says "tap a square", then "three in a row wins" after the first claim, then
// nothing; a finished match ends the first visit. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const OB = await import('../../src/ui/onboard.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const { playStarter } = await import('../../src/ui/input.js');
const { state } = await import('../../src/ui/app.js');
const { renderBoard } = await import('../../src/ui/board.js');

test('a first visit: one big Play (and Play a Friend), no setup to decide; a returning player the normal menu', () => {
  state.screen = 'menu';
  const html = renderMenu();
  assert.match(html, /data-act="first-go"/);
  assert.match(html, /data-act="friend-go"/);
  assert.doesNotMatch(html, /data-act="cpu-go"/);
  assert.ok(OB.firstVisit({ wins: 0, losses: 0, draws: 0 }));
  assert.ok(!OB.firstVisit({ wins: 2, losses: 1, draws: 0 }), 'an account that has played elsewhere: no first visit');
});

test('Play: the starter board, the player X moving first, the computer on Easy, logged out too; the setup untouched', () => {
  const before = JSON.stringify({ games: state.setup.games, vsCpu: state.setup.vsCpu });
  assert.ok(playStarter(true));
  assert.equal(state.setup.human, 'X');
  assert.equal(state.turn, 'X');
  assert.equal(state.cpu, 'O');
  assert.equal(state.cpuLevel, 'easy');
  assert.ok(state.squares.every(q => OB.STARTER.includes(q.mini.type)), state.squares.map(q => q.mini.type).join(' '));
  assert.ok(state.games.every(t => OB.STARTER.includes(t)));
  assert.equal(JSON.stringify({ games: state.setup.games, vsCpu: state.setup.vsCpu }), before, "the player's own setup is left as it was");
  assert.equal(OB.STARTER.length, 9);
});

test('the coach: "tap a square", silence, "three in a row wins" at the first claim, then silence for good', () => {
  state.screen = 'board'; state.spot = null; state.flash = null; state.done = null;
  assert.match(OB.coachLine(state, 'X'), /Tap one/);
  assert.match(renderBoard(), /class="coach"[^>]*>.*Tap one/);
  OB.coachOpen(state);                                  // a square opened
  assert.equal(OB.coachLine(state, 'X'), '');
  state.squares[4].owner = 'X';
  assert.match(OB.coachLine(state, 'X'), /three in a row/i);
  OB.coachOpen(state);
  assert.equal(OB.coachLine(state, 'X'), '');
  state.squares[4].owner = null;
});

test('each game\'s "?" opens once, the first time; a finished match ends the first visit', () => {
  assert.equal(OB.seenOnce('pig'), true);
  assert.equal(OB.seenOnce('pig'), false);
  OB.matchDone('m:12:X');
  assert.ok(!OB.firstVisit(null));
  assert.equal(OB.matchesDone(), 1);
  OB.matchDone('m:12:X');
  assert.equal(OB.matchesDone(), 1, 'counted once per match');
  state.screen = 'menu';
  assert.doesNotMatch(renderMenu(), /data-act="first-go"/);
});
