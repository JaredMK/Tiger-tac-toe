// The top bar's round clock (src/ui/turnbar.js renderHeader): every Find Match round (Super Chaos, run by the
// server) shows it, against a person or a bot, counting to the server's deadline; local Super Chaos against
// the computer has none. Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { renderHeader } = await import('../../src/ui/turnbar.js');
const { state } = await import('../../src/ui/app.js');

const games = Object.fromEntries(E.scTypes().map(t => [t, true]));
// A phone in a Find Match round, as the server's record gives it (core/scgame.js: the side's own copy of the round).
function findMatch(names, side, leftMs) {
  const now = Date.now(), g = E.newScGame({ names, games }, E.makeRng('clock'), 'g1', now, 0);
  g.full.sc.deadline = now + leftMs;
  const st = E.scSideState(g, side);
  Object.assign(state, st, { screen: 'board', online: { kind: 'mm', game: 'g1', me: side, joined: true }, setup: Object.assign({}, state.setup, { names, mode: 'online' }) });
}
const clockOf = html => { const m = html.match(/<span class="clock" id="clock"[^>]*>([^<]*)<\/span>/); return m ? m[1] : null; };

test('turn bar: a Find Match round against a person shows the round clock, counting to the server\'s deadline', () => {
  findMatch({ X: 'Ann', O: 'Bo' }, 'X', 45000);
  assert.match(String(clockOf(renderHeader())), /^0:4[45]$/);
  findMatch({ X: 'Ann', O: 'Bo' }, 'O', 60000);
  assert.equal(clockOf(renderHeader()), '1:00', 'the other phone, the same deadline');
});
test('turn bar: a Find Match round against a bot shows the round clock too', () => {
  findMatch({ X: 'Ann', O: 'Robo' }, 'X', 30000);
  assert.match(String(clockOf(renderHeader())), /^0:(29|30)$/);
  state.sc.deadline = null;                                        // (the next round not begun yet: the full minute shows)
  assert.equal(clockOf(renderHeader()), '1:00');
});
test('turn bar: local Super Chaos against the computer has no round clock', () => {
  findMatch({ X: 'Ann', O: 'Computer' }, 'X', 30000);
  Object.assign(state, { online: null, cpu: 'O' });
  state.sc.online = false; state.sc.deadline = null;
  assert.equal(clockOf(renderHeader()), null);
});
