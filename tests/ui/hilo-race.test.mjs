// Race mode on the page (core/race.js; Higher/Lower as the reference): the square's screen shows this phone's own guesses and
// range and only the other side's shape; the other side's move arrives redacted and is shown as its shape; the board's
// miniature shows both shapes and no number; the explainer swaps to the Race one while the mode is on.
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
const { renderMini } = await import('../../src/ui/mini.js');
const { renderBoard } = await import('../../src/ui/board.js');
const { explainOf } = await import('../../src/ui/explainer.js');
const V = await import('../../src/games/hilo/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.hilo.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch() {
  E.setTune('hilo', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('hilo-race'), { games: ['hilo'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('hilo', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const guessAway = (m, p, n) => E.applyMove(m, p, n === m.target ? (n === 1 ? 2 : n - 1) : n, E.makeRng('g'));

test('race: the screen draws this side\'s own guesses and range, the other side\'s progress as a shape; its numbers never appear', () => {
  const m = raceMatch();
  guessAway(m, 'O', 17); guessAway(m, 'O', 23);                  // the computer's two guesses (its own part)
  guessAway(m, 'X', 9);                                            // ours
  state.turn = 'X';
  const html = renderMini(state.squares[0]);
  const mine = m.side.X.guesses[0].n, theirs = m.side.O.guesses.map(g => g.n);
  assert.match(html, new RegExp(`<button class="X[^"]*" data-act="move" data-m='${mine}'`), 'our guess marked on the pad');
  for (const n of theirs) assert.doesNotMatch(html, new RegExp(`<button class="O[^"]*" data-act="move" data-m='${n}'`), `the computer's ${n} is not marked`);
  assert.doesNotMatch(html, /said <b class="n">(17|23|16|22)</, "the computer's numbers are not said");
  assert.match(html, /hheat (cold|warm|hot)/, "the computer's heat chip shows");
  assert.match(html, /Your guesses are yours alone|class="he"/, 'the history is ours');
  // the pad is open over our own range, not theirs
  const ownLo = m.side.X.lo, ownHi = m.side.X.hi;
  assert.match(html, new RegExp(`<b>${ownLo}</b><span>and</span><b>${ownHi}</b>`));
});

test('race: the other side\'s move is redacted on this phone (no number, no higher/lower), shown as its shape; sounds carry no direction', async () => {
  const m = raceMatch();
  state.turn = 'O';
  const r = E.playMove(state, 0, m.target === 14 ? 15 : 14, E.makeRng('c'));
  assert.ok(r.ok);
  assert.ok(state.flash.n != null, 'the full flash is on the state (the computer played here)');
  const html = renderMini(state.squares[0]);
  assert.doesNotMatch(html, /said <b class="n">/, 'no number said');
  assert.doesNotMatch(html, /Higher!|Lower!/, 'no direction');
  assert.match(html, /guessed <span class="hheat (cold|warm|hot)">/, "the computer's shape change");
  assert.doesNotMatch(html, /class="seg shrink"/, 'our range does not move for their guess');
  const { moveSounds } = await import('../../src/audio/sound.js');
  const names = moveSounds(state.flash).map(s => s[0]);
  assert.ok(!names.includes('higher') && !names.includes('lower'), `no direction in the sounds: ${names}`);
});

test('race: the miniature shows both players\' shapes and no number; the explainer is the Race one while the mode is on', () => {
  const m = raceMatch();
  guessAway(m, 'X', 9); guessAway(m, 'O', 20);
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /thilo trace/);
  assert.doesNotMatch(sq, />(9|20|8|10|19|21)</, 'no guessed number');
  assert.match(sq, /hheat/);
  // the view's own miniature from the public view: shapes only
  const pub = E.raceView(m, null);
  assert.deepEqual(pub.side, {});
  assert.match(V.miniature(pub, false), /trr/);
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('hilo').play, /yours alone|told to you alone/, 'the Race explainer in an open race square');
  state.squares[0].mini.race = false; delete state.squares[0].mini.side;
  assert.doesNotMatch(explainOf('hilo').play, /told to you alone/, 'a shared square: the usual one');
});
