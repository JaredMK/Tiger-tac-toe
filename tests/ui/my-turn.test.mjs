// Your turn (December 2026, options 1 and 3 of turn-indicator.html): the board's # lines take this player's colour
// while it is their turn (the state alone: no flash on a first look or a redraw), flash once as the turn comes round
// (the `myturn` event, ui/fx.js myTurnFx, started by ui/turns.js turnAlert with the chime and the buzz), and their
// character in the top bar pops; no burst over the board, never on the other side's turn, never on one phone.
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
const { renderBoard } = await import('../../src/ui/board.js');
const { renderHeader } = await import('../../src/ui/turnbar.js');
const { myTurnFx, myTurnNow } = await import('../../src/ui/fx.js');

function match(cpu) {
  Object.assign(state, E.newMatch(E.makeRng('my-turn'), { games: ['ttt'] }), { screen: 'board', zoom: null, online: null, sc: null, flash: null, spot: null, winner: null, cpu, practice: null });
  state.id = 'mt'; state.moves = 3;
}

test('your turn against the computer: the # tinted in your colour; a flash and the pop only from the turn\'s event', () => {
  match('O'); state.turn = 'X';
  let html = renderBoard();
  assert.match(html, /<div class="board myturn my-X">/, 'tinted on a first look');
  assert.doesNotMatch(html, /<svg data-fx="[^"]*" class="hash"/, '...with no flash');
  assert.doesNotMatch(renderHeader(), /mypop/);
  myTurnFx('X');
  html = renderBoard();
  assert.match(html, /<svg data-fx="[\d.]+" class="hash"/, 'the flash, timed from the event');
  assert.match(renderHeader(), /class="tside X on mypop"><span class="tg"><svg data-fx="[\d.]+" class="pc pX"/, 'your character pops');
  assert.doesNotMatch(html, /ccturn|YOUR TURN/, 'no burst over the board');
  state.moves = 4;                                                 // (a bonus action: the turn's event is spent, the tint stays)
  assert.match(renderBoard(), /board myturn my-X/); assert.doesNotMatch(renderBoard(), /data-fx="[\d.]+" class="hash"/);
});

test('never on the other side\'s turn, during their replay, or on one phone', () => {
  match('O'); state.turn = 'O';
  assert.doesNotMatch(renderBoard(), /myturn/, 'the computer\'s turn');
  state.turn = 'X'; state.spot = { square: 2, by: 'O', label: 'x' };
  assert.doesNotMatch(renderBoard(), /myturn/, 'their move still glowing on the board');
  state.spot = null;
  match(null); state.turn = 'X';
  assert.equal(myTurnNow(), null, 'two people on one phone: whose is it?');
  assert.doesNotMatch(renderBoard(), /myturn/);
});
