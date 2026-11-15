// What a replay shows (December 2026, ui/replay.js WHAT A REPLAY SHOWS): the committed result of the other side's turn and
// what this phone needs of it, never their drafting. A draft game's inputs are pressed in from the move itself (its view's
// replay.synth): Word Tiles shows the word that was played, never the tiles picked up and put back; Five Letters the word
// guessed, never a letter typed and deleted. A game without synth shows the one control that made the move. Only where the
// logged inputs are the attempt itself (Bowling's meter stops in time, Snake's run) are they played as they were.
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
const R = await import('../../src/ui/replay.js');
const { state } = await import('../../src/ui/app.js');
const { GAMES, viewOf } = await import('../../src/games/index.js');
for (const t of ['wtiles', 'wordle', 'hilo', 'bowling', 'snake']) GAMES[t].view = await import(`../../src/games/${t}/view.js`);   // (the page registers the views in main.js; here by hand)

// The inputs a replay of this move would press in, given the mover's own (noisy) log.
function listFor(type, mini, move, log) {
  state.squares = Array.from({ length: 9 }, () => ({ owner: null, mini }));
  R.repStart({ sq: 4, by: 'O', type, mini, move, list: log, onMove: () => {} });
  const l = R.rep ? R.rep.list.map(e => [e[1], e[2]]) : [];
  R.repStop();
  return l;
}

test('Word Tiles: the word played, pressed in from the move; no tile picked up and put back', () => {
  const mini = E.newMini('wtiles', E.makeRng('rc')), move = [[24, 'C'], [25, 'A'], [26, 'T']];
  const noisy = [[0, 'wtr', 'i=3'], [200, 'wtc', 'c=10'], [400, 'wtc', 'c=10'], [600, 'wtr', 'i=0'], [800, 'wtc', 'c=24'], [1000, 'wtr', 'i=1'], [1200, 'wtc', 'c=25'], [1400, 'wtr', 'i=2'], [1600, 'wtc', 'c=26'], [1800, 'move', 'm=x']];
  const got = listFor('wtiles', mini, move, noisy), syn = viewOf('wtiles').replay.synth(move, mini, {});
  assert.deepEqual(got, (syn || [[0, 'move']]).map(e => [e[1], e[2]]), 'the replay presses what the move itself gives');
  assert.ok(!got.some(([a, v]) => v === 'c=10'), 'the tile laid on square 10 and taken back is never shown');
});

test('Five Letters: the word guessed, typed in from the move; no letter typed and deleted', () => {
  const mini = E.newMini('wordle', E.makeRng('rc')), move = 'crane';
  const noisy = [[0, 'key', 'k=x'], [100, 'bksp', null], [200, 'key', 'k=c'], [300, 'key', 'k=r'], [400, 'key', 'k=a'], [500, 'key', 'k=n'], [600, 'key', 'k=e'], [700, 'enter', null]];
  const got = listFor('wordle', mini, move, noisy);
  assert.ok(!got.some(([a, v]) => v === 'k=x') && !got.some(([a]) => a === 'bksp'), `no x typed and deleted: ${JSON.stringify(got)}`);
  assert.deepEqual(got.filter(([a]) => a === 'key').map(([, v]) => v), ['k=c', 'k=r', 'k=a', 'k=n', 'k=e'], 'the word, typed in from the move');
});

test('a game without its own replay hooks: the one control that made the move, alone', () => {
  const mini = E.newMini('hilo', E.makeRng('rc'));
  const got = listFor('hilo', mini, 12, [[0, 'hpad', 'n=1'], [100, 'hpad', 'n=9'], [200, 'hpad', 'n=1'], [300, 'move', 'm=12']]);
  assert.deepEqual(got, [['move', 'm=12']]);
});

test('Bowling and Snake keep their logged inputs: they are the attempt itself (the stops in time, the run)', () => {
  const mini = E.newMini('bowling', E.makeRng('rc')), log = [[0, 'bowl', 'aim=0.1'], [900, 'bowl', 'curve=0.2'], [1700, 'bowl', 'power=0.9']];
  assert.deepEqual(listFor('bowling', mini, { aim: 0.1, curve: 0.2, power: 0.9 }, log), log.map(e => [e[1], e[2]]));
});
