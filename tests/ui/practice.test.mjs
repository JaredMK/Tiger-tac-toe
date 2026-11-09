// Practice from How to Play (src/ui/explainer.js): each game's explainer opened from How to Play has a Practice button
// (nowhere else); it starts that mini-game alone against the computer on Easy with the side reveal; while it runs a
// Back to How to Play stands where Menu does, on the board and in the square (src/ui/turnbar.js); the match's end shows
// Practice again and Back to How to Play alone; Back ends the match with nothing recorded and opens How to Play at that
// game's explainer; stats and history are untouched throughout. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const X = await import('../../src/ui/explainer.js');
const { renderHeader } = await import('../../src/ui/turnbar.js');
const { renderMain } = await import('../../src/ui/render.js');
const MM = await import('../../src/net/matchmaking.js');
const T = await import('../../src/net/tracking.js');
const { acct } = await import('../../src/net/accounts.js');
const { state } = await import('../../src/ui/app.js');

const board = () => E.newMatch(E.makeRng('pr'), { games: ['ttt'] });
test('How to Play: every game\'s explainer opened there offers Practice; the same explainer elsewhere does not', () => {
  Object.assign(state, board(), { screen: 'howto', online: null, practice: null });
  acct.admin = false;
  assert.match(X.renderHowTo(), /data-act="explain" data-t="ttt"/);
  X.openExplain('ttt');
  assert.match(X.renderExplain(), /<button class="btn practice" data-act="practice" data-t="ttt">Practice<\/button>/);
  X.closeExplain(true);
  Object.assign(state, { screen: 'mini', zoom: 0 });
  X.openExplain('ttt');
  assert.doesNotMatch(X.renderExplain(), /data-act="practice"/, 'in a square: the rules alone');
  X.closeExplain(true);
  Object.assign(state, { screen: 'setup' });
  X.openExplain('ttt'); assert.doesNotMatch(X.renderExplain(), /data-act="practice"/, 'on the setup: the rules alone'); X.closeExplain(true);
});
test('Practice: that game alone against the computer on Easy, with the side reveal; Back to How to Play where Menu is, on the board and in the square; nothing tracked', () => {
  Object.assign(state, board(), { screen: 'howto', online: null, practice: null, stats: { id: 'old', mode: 'cpu', sent: false } });
  const pend = T.pendingLocal().length, out = T.outbox().length;
  assert.equal(X.practiceStart('hilo'), true);
  assert.deepEqual(state.practice, { type: 'hilo' }); assert.equal(state.screen, 'board');
  assert.ok(state.squares.every(sq => sq.mini.type === 'hilo')); assert.equal(state.cpuLevel, 'easy');
  assert.ok(state.cpu === 'X' || state.cpu === 'O');
  assert.ok(MM.mmIntro, 'the side reveal is up'); assert.equal(MM.mmIntro.me, E.other(state.cpu)); MM.closeIntro();
  assert.equal(state.stats, null, 'no stats report for it');
  T.trackStart(); assert.equal(state.stats, null, 'a start report is never begun for a practice match');
  let hdr = renderHeader();
  assert.match(hdr, /<button class="menubtn pback" data-act="practice-back" aria-label="Back to How to Play">.*<span>Back to How to Play<\/span><\/button>/);
  assert.doesNotMatch(hdr, /data-act="pause"/, 'in Menu\'s place');
  Object.assign(state, { screen: 'mini', zoom: 4 });
  hdr = renderHeader();
  assert.match(hdr, /data-act="practice-back"/, 'in the square too'); assert.doesNotMatch(hdr, /data-act="pause"/);
  assert.match(renderMain(), /class="back"[^>]*data-act="back"/, "the square's own Board button stays");
  assert.equal(T.pendingLocal().length, pend); assert.equal(T.outbox().length, out);
  // Back part way through: the match stops, nothing recorded, How to Play open at the game's explainer
  X.practiceEnd();
  assert.equal(state.screen, 'howto'); assert.equal(state.practice, null); assert.equal(X.explainT, 'hilo', "that game's explainer is open");
  assert.equal(state.winner, null, 'no loss'); assert.equal(state.stats, null);
  assert.equal(T.pendingLocal().length, pend); assert.equal(T.outbox().length, out, 'nothing sent');
  X.closeExplain(true);
  Object.assign(state, board(), { screen: 'board', online: null });
  assert.match(renderHeader(), /data-act="pause" aria-label="Menu">Menu</, 'an ordinary match: Menu again');
});
test('the practice match\'s end: the result screen with Practice again and Back to How to Play alone; Back returns to the explainer; stats and history untouched', () => {
  Object.assign(state, board(), { screen: 'howto', online: null, practice: null });
  acct.user = { uid: 'u1' }; acct.profile = { username: 'ann' };
  const pend = T.pendingLocal().length;
  assert.equal(X.practiceStart('ttt'), true); MM.closeIntro();
  assert.equal(state.setup.names[E.other(state.cpu)], 'ann', 'under the username');
  const me = E.other(state.cpu);
  Object.assign(state, { winner: me, winLine: [0, 1, 2], winReason: 'line', screen: 'win' });
  for (const i of [0, 1, 2]) state.squares[i].owner = me;
  const html = renderMain();
  assert.match(html, /win-scr/); assert.match(html, /wins the match!|You win the match!/);
  assert.match(html, /<button class="primary" data-act="practice" data-t="ttt">Practice again<\/button><button class="btn" data-act="practice-back">Back to How to Play<\/button>/);
  assert.doesNotMatch(html, /data-act="rematch"|data-act="menu"|data-act="review"|data-act="share-result"|data-act="leave"/, 'nothing else');
  T.trackEnd(); T.reportLocal();
  assert.equal(T.pendingLocal().length, pend, 'no local record or history'); assert.equal(state.stats, null);
  X.practiceEnd();
  assert.equal(state.screen, 'howto'); assert.equal(X.explainT, 'ttt'); assert.equal(state.practice, null);
  assert.match(X.renderExplain(), /data-act="practice" data-t="ttt"/, 'Practice offered again from there');
  X.closeExplain(true);
  // Practice again from the end screen starts another at once
  Object.assign(state, board(), { screen: 'win', winner: 'X', online: null, practice: { type: 'c4' } });
  assert.equal(X.practiceStart('c4'), true); MM.closeIntro();
  assert.deepEqual(state.practice, { type: 'c4' }); assert.equal(state.screen, 'board'); assert.equal(state.winner, null);
  acct.user = null; acct.profile = null;
});
test('a saved practice match is never restored (ui/app.js load clears the mark; freshVisit opens the menu); another start clears it', () => {
  Object.assign(state, board(), { screen: 'howto', online: null, practice: null });
  assert.equal(X.practiceStart('ttt'), true); MM.closeIntro();
  MM.freshVisit();
  assert.equal(state.screen, 'menu');
  assert.equal(E.startCpu(state, E.makeRng('q'), 'Ann') != null, true);
  assert.equal(state.practice, null, 'Play Computer after it: an ordinary match');
  assert.match(renderHeader(), /data-act="pause"/);
});
