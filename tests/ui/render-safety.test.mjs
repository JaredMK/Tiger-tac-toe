// A screen that throws while drawing never leaves the page stuck (November 2026: a claimed Race square's miniature threw
// and the board never came back from the square): the error is logged, what was on show is let go and the board is
// drawn again; a board that throws too shows a plain card with Main menu. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
let html = '';
const appEl = new Proxy(function () {}, { get: (t, k) => (k === 'innerHTML' ? html : k === 'querySelector' ? () => null : k === 'querySelectorAll' ? () => [] : k === 'classList' ? { toggle() {}, add() {}, remove() {} } : k === Symbol.toPrimitive ? () => '' : stub()), set: (t, k, v) => { if (k === 'innerHTML') html = String(v); return true; } });
const doc = new Proxy(function () {}, { get: (t, k) => (k === 'getElementById' ? id => (id === 'app' ? appEl : null) : k === 'visibilityState' ? 'visible' : k === Symbol.toPrimitive ? () => '' : stub()) });
for (const k of ['window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const G = await import('../../src/games/index.js');
G.GAMES.hilo.view = await import('../../src/games/hilo/view.js');
G.GAMES.ttt.view = Object.assign({}, await import('../../src/games/ttt/view.js'));   // (a plain copy: the tests swap its drawing)
const { render } = await import('../../src/ui/render.js');
const { devErrors } = await import('../../src/net/tracking.js');

test('a claimed Race square of Higher/Lower draws on the board (the miniature once read the Shared guesses and threw)', () => {
  E.setTune('hilo', { mode: 'race' });
  const mini = E.newMini('hilo', E.makeRng('h'));
  assert.ok(mini.race);
  mini.side.X.guesses.push({ by: 'X', n: mini.target, res: 'hit' });
  const out = G.GAMES.hilo.view.miniature(mini, true);
  assert.match(out, /thilo/); assert.doesNotMatch(out, /undefined|NaN/);
  E.setTune('hilo', { mode: 'shared' });
});

test('a square whose drawing throws leaves the board standing (its name alone there), with the error logged once', () => {
  Object.assign(state, E.newMatch(E.makeRng('r'), { games: ['ttt'] }), { screen: 'board', zoom: null, flash: null, done: null, spot: null, online: null, sc: null, cpu: null, winner: null });
  const was = G.GAMES.ttt.view.miniature;
  G.GAMES.ttt.view.miniature = () => { throw new Error('boom'); };
  const n0 = devErrors.length;
  render(); render();
  G.GAMES.ttt.view.miniature = was;
  assert.match(html, /class="[^"]*board/, 'the board drawn');
  assert.equal(devErrors.length, n0 + 1, 'logged once'); assert.match(devErrors[n0], /^miniature: ttt/);
});

test('a screen that throws while drawing: the error is logged, the square let go, the board drawn again; a board that throws too gives a card with Main menu', () => {
  Object.assign(state, E.newMatch(E.makeRng('r2'), { games: ['ttt'] }), { screen: 'mini', zoom: 0, flash: { kind: 'claim', type: 'ttt', by: 'X', square: 0 }, done: null, spot: null, online: null, sc: null, cpu: null, winner: null });
  const was = G.GAMES.ttt.view.screen;
  G.GAMES.ttt.view.screen = () => { throw new Error('view down'); };
  const n0 = devErrors.length;
  render();
  G.GAMES.ttt.view.screen = was;
  assert.equal(state.screen, 'board'); assert.equal(state.flash, null); assert.equal(state.zoom, null);
  assert.match(html, /class="[^"]*board/, 'the board drawn instead');
  assert.match(devErrors[n0], /^render: mini 0 flash ttt: view down/);
});
