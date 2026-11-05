// A square drawn and reset shows it on the board: back from the square (after the move's own animation and any
// replay, where a claim would stamp in), a "Draw" stamp over the old game's tile, then the shuffle into the new
// game. It starts once, from its event (ui/fx.js drawFx, keyed by state.drawId: core/board.js leaveSquare); a
// re-render carries it on and never starts it again; once it is over the square simply shows its new game.
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
const { state } = await import('../../src/ui/app.js');
const { renderBoard, DRAW_MS } = await import('../../src/ui/board.js');
const { fx, fxAt, drawFx } = await import('../../src/ui/fx.js');
const { dismissFlash } = await import('../../src/ui/turns.js');
const { INFO } = await import('../../src/games/index.js');

const sqHtml = (html, i) => html.match(/<button class="sq[^]*?<\/button>/g)[i];
// Square 0 a Tic-Tac-Toe one move from a full board with no line; X plays the last cell, the square draws.
function drawSquare() {
  const rng = E.makeRng('draw-stamp');
  Object.assign(state, E.newMatch(rng, { games: ['ttt', 'c4', 'hilo'] }), { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null });
  state.id = 'dt';
  state.squares[0].mini = E.newMini('ttt', rng);
  ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X'].forEach((p, k) => { state.squares[0].mini.cells[k] = p; });
  state.turn = 'X';
  const r = E.playMove(state, 0, 8, rng);
  assert.equal(r.ok, true); assert.equal(r.flash.kind, 'draw');
  return r.flash;
}

test('a drawn square: back on the board, its Draw stamp over the old game, then the new game deals in; once', () => {
  const f = drawSquare(), was = f.type, now = state.squares[0].mini.type;
  assert.equal(was, 'ttt');
  dismissFlash();                                                     // the result over: back to the board (core/board.js leaveSquare), where it starts
  assert.equal(state.screen, 'board');
  assert.equal(state.drawStamp, 0); assert.equal(state.drawId, `dt:${state.moves}:d`, 'keyed by the move');
  assert.equal(state.stamp, null, 'no claim stamp');
  const at = fxAt('draw', state.drawId);
  assert.ok(at != null, 'its event started');
  const html = renderBoard(), sq = sqHtml(html, 0);
  assert.match(sq, /class="sq[^"]*\bdrawfx\b/);
  assert.equal((html.match(/class="drawst"/g) || []).length, 1, 'one stamp, on that square alone');
  assert.match(sq, new RegExp(`<div class="drawst" data-fx="${at}" data-bend="\\d+" aria-hidden="true"><b>Draw</b></div>`), 'the stamp, timed from its event and taken off the page when it is over');
  assert.match(sq, new RegExp(`<div class="drawold" data-fx="${at}"[^>]*><div class="lab[^"]*"><svg[^]*?<span>${INFO[was].name}</span>`), "the old game's tile under it");
  assert.match(sq, new RegExp(`<div class="lab[^"]* dnew" data-fx="${at}">[^]*?<span>${INFO[now].name}</span>`), "the new game's label deals in");
  assert.match(sq, /<div class="thumb dnew" data-fx="/, '...and its miniature');
  assert.match(sq, /a draw: a new game/, 'said to a screen reader');
  for (const k of [1, 2, 3]) assert.doesNotMatch(sqHtml(html, k), /drawfx|drawst|dnew/);
  // a re-render (a room update, the clock) and the event asked again: nothing restarts
  assert.equal(drawFx(f), false, 'never started twice');
  assert.equal(fxAt('draw', state.drawId), at);
  assert.equal(renderBoard(), html, 'drawn the same, from the same moment');
  // its time over: the square shows its new game and nothing more
  fx.draw.at = performance.now() - DRAW_MS - 50;
  const later = renderBoard();
  assert.doesNotMatch(later, /drawfx|drawst|drawold|dnew/);
  assert.match(sqHtml(later, 0), new RegExp(`<span>${INFO[now].name}</span>`));
});

test('a square won stamps its mark, with no Draw stamp; a move that keeps the game on shows neither', () => {
  const rng = E.makeRng('draw-stamp-2');
  Object.assign(state, E.newMatch(rng, { games: ['ttt'] }), { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null });
  state.squares[0].mini = E.newMini('ttt', rng);
  ['X', 'X', null, 'O', 'O'].forEach((p, k) => { state.squares[0].mini.cells[k] = p; });
  state.turn = 'X';
  assert.equal(E.playMove(state, 0, 2, rng).flash.kind, 'claim');
  dismissFlash();
  assert.equal(state.stamp, 0); assert.equal(state.drawStamp, null);
  assert.doesNotMatch(renderBoard(), /drawst|drawfx/);
  state.screen = 'mini'; state.zoom = 1;
  assert.equal(E.playMove(state, 1, 0, rng).flash.kind, 'move');
  dismissFlash();
  assert.equal(state.stamp, null); assert.equal(state.drawStamp, null);
});
