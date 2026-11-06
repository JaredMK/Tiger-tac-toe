// Whose move it is, Classic online (November 2026): "[name] is playing…" is a small bar in the board's foot (ui/board.js
// waitBand, `.foot .wband` in styles.css), never a band across the board or over a mini-game; Super Chaos keeps its band.
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderBoard } = await import('../../src/ui/board.js');
const { renderMini } = await import('../../src/ui/mini.js');

function waiting() {
  Object.assign(state, E.newMatch(E.makeRng('wait-bar'), { games: ['ttt', 'c4', 'hilo'] }), { screen: 'board', zoom: null, cpu: null, sc: null, flash: null, done: null, spot: null, winner: null });
  state.id = 'wb';
  state.online = { me: 'X', kind: 'mm' }; state.turn = 'O';
}
const boardPart = html => html.slice(html.indexOf('<div class="board">'), html.indexOf('<div class="foot'));
const footPart = html => html.slice(html.indexOf('<div class="foot'));

test("Classic online, the other side's turn: the bar is in the foot, not over the board", () => {
  waiting();
  const html = renderBoard();
  assert.match(footPart(html), /class="wband O/, 'the bar sits in the foot');
  assert.match(footPart(html), /is playing…/);
  assert.doesNotMatch(boardPart(html), /wband/, 'nothing laid across the board');
  assert.doesNotMatch(html, /board-scr waiting/, 'the board is not dimmed');
});

test('Classic online, a square opened while waiting: no band over the mini-game', () => {
  waiting();
  state.screen = 'mini'; state.zoom = 0;
  assert.doesNotMatch(renderMini(state.squares[0]), /wband/);
});

test('the stylesheet keeps the foot bar in the flow (the band rule alone would lay it across the screen)', () => {
  const css = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  const rule = css.match(/\.foot \.wband \{([^}]*)\}/);
  assert.ok(rule, '.foot .wband is styled');
  assert.match(rule[1], /position:\s*static/);
});
