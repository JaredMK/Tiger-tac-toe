// Your turn (December 2026, options 1 and 3 of the mock-ups, the pulse): the board's # lines flash in this player's colour as
// the turn comes round and pulse again every 4 s until they open a square (ui/fx.js myTurnNow/myTurnStop; the first
// flash from turnAlert's event with the chime and the buzz, their character popping once with it); no burst over the
// board, never on the other side's turn, never on one phone.
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
const { myTurnFx, myTurnNow, myTurnStop } = await import('../../src/ui/fx.js');

function match(cpu) {
  Object.assign(state, E.newMatch(E.makeRng('my-turn'), { games: ['ttt'] }), { screen: 'board', zoom: null, online: null, sc: null, flash: null, spot: null, winner: null, cpu, practice: null });
  state.id = 'mt'; state.moves = 3;
}

test('your turn against the computer: the # pulses in your colour from the turn\'s event; the pop only with the first pulse', () => {
  match('O'); state.turn = 'X';
  let html = renderBoard();
  assert.match(html, /<div class="board myturn my-X">/, 'a first look at the turn: the pulse starts quietly');
  assert.match(html, /<svg data-fx="[\d.]+" class="hash"/, '...anchored to its event, so a redraw keeps its phase');
  assert.doesNotMatch(renderHeader(), /mypop/, '...with no pop (that, the chime and the buzz are the first pulse\'s)');
  myTurnFx('X');
  assert.match(renderHeader(), /class="tside X on mypop"><span class="tg"><svg data-fx="[\d.]+" class="pc pX"/, 'the first pulse pops your character');
  html = renderBoard();
  assert.doesNotMatch(html, /ccturn|YOUR TURN/, 'no burst over the board');
  const at = html.match(/data-fx="([\d.]+)" class="hash"/)[1];
  state.moves = 4; state.turn = 'X';                              // (a bonus action: a new turn key, its pulse begins)
  assert.notEqual(renderBoard().match(/data-fx="([\d.]+)" class="hash"/)[1], at);
});

test('opening a square stops the pulse for the rest of that turn; the other side\'s turn never has one', () => {
  match('O'); state.turn = 'X';
  assert.match(renderBoard(), /myturn/);
  myTurnStop();
  assert.doesNotMatch(renderBoard(), /myturn/, 'stopped as the square is opened');
  assert.doesNotMatch(renderHeader(), /mypop/);
  state.turn = 'O';
  assert.doesNotMatch(renderBoard(), /myturn/, 'the computer\'s turn');
  state.moves = 5; state.turn = 'X';
  assert.match(renderBoard(), /myturn/, 'the next turn of yours pulses again');
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
