// The admin's Test play (November 2026, src/ui/sandbox.js): a standalone game of one mini-game against the computer on
// Hard, played as Practice is (the centre square alone), with the editor's settings; "Back to admin" where Menu is; the
// end card offers Play again and Back to admin, and the page goes back to the admin page by itself a moment after the end.
// Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const SB = await import('../../src/ui/sandbox.js');
const X = await import('../../src/ui/explainer.js');
const { renderHeader } = await import('../../src/ui/turnbar.js');
const { state, sbx } = await import('../../src/ui/app.js');
const MM = await import('../../src/net/matchmaking.js');
const T = await import('../../src/net/tracking.js');

test('Test play: the game alone against the computer on Hard in the centre square, Back to admin in Menu\'s place, nothing tracked', () => {
  Object.assign(sbx, { on: true, type: 'hilo', cfg: null, status: 'on' });
  const out = T.outbox().length;
  SB.restart();
  if (MM.mmIntro) MM.closeIntro();
  assert.deepEqual(state.practice, { type: 'hilo', test: true });
  assert.equal(state.cpuLevel, 'hard', 'the computer on Hard');
  assert.equal(state.screen, 'mini'); assert.equal(state.zoom, 4);
  assert.ok(state.squares.every(sq => sq.mini.type === 'hilo'));
  const hdr = renderHeader();
  assert.match(hdr, /data-act="test-back"[^>]*>.*Back to admin/); assert.doesNotMatch(hdr, /data-act="practice-back"|data-act="pause"/);
  assert.equal(T.outbox().length, out, 'nothing sent');
  // its end: Play again and Back to admin, never Practice's buttons
  Object.assign(state, { winner: state.cpu === 'X' ? 'O' : 'X', winReason: 'practice', screen: 'win', counts: { X: 0, O: 0 } });
  const end = X.renderPracticeEnd();
  assert.match(end, /data-act="test-again"/); assert.match(end, /data-act="test-back"/); assert.doesNotMatch(end, /practice-back|data-act="practice"/);
  assert.match(end, /Won the test game/);
  assert.equal(typeof sbx.back, 'undefined', '(the handlers are set by the boot, after the admin check)');
  assert.ok(SB.TEST_END_MS >= 2000 && SB.TEST_END_MS <= 6000, 'a moment on the result, then back');
});
