// Testers' reports (November 2026): Coin Flip's result in words; the menu's Continue match for a local match left by a
// reload; the turn bubble's tail at the side on the move; each game's rules once on this phone. Rendered in Node.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const store = new Map();
globalThis.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const OB = await import('../../src/ui/onboard.js');
const CV = await import('../../src/games/coins/view.js');
const T = await import('../../src/net/tracking.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const { state } = await import('../../src/ui/app.js');
const E = await import('../../src/core/engine.js');

test('Coin Flip: a miss says so ("Missed, still O"), a hit how many turned', () => {
  assert.equal(CV.moveText({ by: 'X', flipped: [1, 2, 3], was: ['O', 'O', '?'], results: ['O', 'O', 'O'] }, 'You'), 'Missed, still O');
  assert.equal(CV.moveText({ by: 'X', flipped: [1, 2, 3], was: ['O', 'O', '?'], results: ['X', 'O', 'X'] }, 'You'), 'You got 2!');
  assert.equal(E.PLAY.flash.move, 1000, 'a move\'s result held a second once it has landed');
});

test('Continue match: a local match left by a reload is offered on the menu, and goes once it is continued or given up', () => {
  Object.assign(state, E.newMatch(E.makeRng('cm'), { games: ['ttt', 'c4', 'coins', 'hilo', 'pig', 'bs', 'hangman', 'snakes', 'wordle'] }));
  state.online = null; state.practice = null; state.winner = null; state.screen = 'menu';
  state.stats = { id: 'abc', mode: 'cpu', sent: false };
  assert.doesNotMatch(renderMenu(), /data-act="continue"/);
  T.quitOnBoot('reload');
  assert.match(renderMenu(), /data-act="continue"[\s\S]*Continue match/);
  assert.ok(T.continueHeld());
  assert.doesNotMatch(renderMenu(), /data-act="continue"/);
  T.quitOnBoot('reload'); state.winner = 'X';
  assert.doesNotMatch(renderMenu(), /data-act="continue"/, 'a match that has ended: nothing to continue');
});

test('the turn bubble\'s tail: placed from the side on the move, never at a fixed spot under Menu', () => {
  const css = readFileSync(new URL('../../src/ui/comic.css', import.meta.url), 'utf8');
  assert.match(css, /\.hdr \.turn::before \{[^}]*left: var\(--tail, 26px\)/);
  const tb = readFileSync(new URL('../../src/ui/turnbar.js', import.meta.url), 'utf8');
  assert.match(tb, /export function aimTail/);
});

test('each game\'s rules once on this phone: kept under their own key, never again this visit or the next', () => {
  assert.equal(OB.seenOnce('rps'), true);
  assert.equal(OB.seenOnce('rps'), false);
  assert.equal(JSON.parse(store.get([...store.keys()].find(k => k.endsWith('.rules')))).rps, 1);
  OB.obState.seen = {};                                  // (the onboarding record lost or stale: the rules' own key holds)
  assert.equal(OB.seenOnce('rps'), false);
});

test('Start a new game?: every new-match path goes through guardNew; the dialog offers Keep playing (the default) and Start new', async () => {
  const src = readFileSync(new URL('../../src/ui/input.js', import.meta.url), 'utf8');
  for (const path of ["guardNew(() => playStarter(true))", "guardNew(() => playComputer())", "guardNew(() => practiceStart(", "guardNew(openFind)", "guardNew(() => hostRoom(null, false))", "guardNew(() => joinRoom(joinCode, joinName, false))"]) assert.ok(src.includes(path), path);
  assert.match(src, /guardNew\(\(\) => \{\s*seatLocal/, 'Same phone\'s Start');
  const main = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
  assert.equal((main.match(/guardNew\(/g) || []).length, 5, 'the links: Find Match and a room, at the start and while it runs');
  const { renderNewAsk } = await import('../../src/ui/screens/online.js');
  const I = await import('../../src/ui/input.js');
  assert.equal(renderNewAsk(), '');
  Object.assign(state, E.newMatch(E.makeRng('na'), { games: ['ttt', 'c4', 'coins', 'hilo', 'pig', 'bs', 'hangman', 'snakes', 'wordle'] }));
  state.online = null; state.practice = null; state.winner = null; state.stats = { id: 'na1', mode: 'cpu', sent: false };
  T.quitOnBoot('reload');
  let went = 0; I.guardNew(() => { went++; });
  assert.equal(went, 0, 'asked first');
  const html = renderNewAsk();
  assert.match(html, /Start a new game\?/); assert.match(html, /Your current match will be lost\./);
  assert.match(html, /class="btn go" data-act="new-keep"[^>]*>Keep playing/); assert.match(html, /data-act="new-start">Start new/);
  I.setNewAsk(null); T.continueHeld();
  I.guardNew(() => { went++; });
  assert.equal(went, 1, 'no saved match: straight on');
});
