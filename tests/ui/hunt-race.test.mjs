// Race mode on the page (core/race.js), Treasure Hunt: the square's screen shows this phone's own digs and only the other
// side's shape (digs used, the heat of their last dig); the other side's dig arrives redacted and opens no cell here; the
// board's miniature shows both shapes and no cell; the explainer swaps to the Race one while the mode is on.
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
const V = await import('../../src/games/hunt/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.hunt.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch() {
  E.setTune('hunt', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('hunt-race'), { games: ['hunt'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('hunt', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const digAway = (m, p, i) => E.applyMove(m, p, i === m.treasure ? (i === 0 ? 1 : i - 1) : i, E.makeRng('d'));
const dugCells = html => [...html.matchAll(/<button class="dig[^"]*" data-act="move" data-m='(\d+)'[^>]*style="--dbg/g)].map(x => Number(x[1]));

test('race: the screen draws this side\'s own digs and the other side\'s progress as a shape; their cells never appear', () => {
  const m = raceMatch();
  digAway(m, 'O', 20); digAway(m, 'O', 27);                      // the computer's two digs (its own part)
  digAway(m, 'X', 3);                                              // ours
  state.turn = 'X';
  const html = renderMini(state.squares[0]);
  const mine = m.side.X.dug.map(d => d.i), theirs = m.side.O.dug.map(d => d.i);
  assert.deepEqual(dugCells(html), mine, 'our dig alone is open on the grid');
  for (const i of theirs) assert.doesNotMatch(html, new RegExp(`data-m='${i}'[^>]*style="--dbg`), `the computer's cell ${i} is not dug here`);
  assert.match(html, /class="hrace"/, 'the race row');
  assert.match(html, /<small>2 digs<\/small><em class="hrh" style="background:[^"]*">(Hot|Warm|Cool|Cold)<\/em>/, "the computer's digs and heat");
  assert.match(html, /<small>1 dig<\/small>/, 'ours');
  assert.doesNotMatch(html, /data-by=/, 'no marks before the review');
  assert.match(html, /class="hkey"/, 'the key stays');
});

test('race: the other side\'s dig is redacted on this phone (no cell opens, no band of ours), shown as its shape; the sounds carry its heat alone', async () => {
  const m = raceMatch();
  state.turn = 'O';
  const r = E.playMove(state, 0, m.treasure === 14 ? 15 : 14, E.makeRng('c'));
  assert.ok(r.ok);
  assert.ok(state.flash.band != null, 'the full flash is on the state (the computer played here)');
  const html = renderMini(state.squares[0]);
  assert.doesNotMatch(html, /class="dig[^"]* open"/, 'no cell opens here');
  assert.deepEqual(dugCells(html), [], 'our grid is untouched');
  assert.match(html, /<span class="O fresh">[\s\S]*?<small>1 dig<\/small><em class="hrh fresh"/, "the computer's chip changes");
  const { moveSounds } = await import('../../src/audio/sound.js');
  const names = moveSounds(state.flash).map(s => s[0]);
  assert.ok(names.includes('dig'), `the dig is heard: ${names}`);
  assert.match(V.moveText(E.raceFlashHide(state.flash, m), '<b class="O">Computer</b>'), /dug · (Hot|Warm|Cool|Cold) · dig 1/, 'the header says its heat and count alone');
});

test('race: the miniature shows both players\' digs and heat and no cell; the review shows both grids; the explainer is the Race one while the mode is on', () => {
  const m = raceMatch();
  digAway(m, 'X', 9); digAway(m, 'O', 30);
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /thunt trace/);
  assert.doesNotMatch(sq, /tg g5x5/, 'no dug grid');
  assert.match(sq, /class="hrh"/);
  const pub = E.raceView(m, null);
  assert.deepEqual(pub.side, {});
  const mini = V.miniature(pub, false);
  assert.match(mini, /<svg viewBox="0 0 60 60"/, 'the small empty grid'); assert.match(mini, /class="tdn">1</); assert.doesNotMatch(mini, /<i style="background/, "no band-coloured cell");
  // the finished square's review: both grids, each dig marked with its digger
  state.squares[0].owner = 'X'; state.screen = 'mini'; state.zoom = 0;
  const review = renderMini(state.squares[0]);
  assert.match(review, /data-by="X"/); assert.match(review, /data-by="O"/);
  state.squares[0].owner = null;
  assert.match(explainOf('hunt').play, /alone/, 'the Race explainer in an open race square');
  state.squares[0].mini.race = false; delete state.squares[0].mini.side;
  assert.doesNotMatch(explainOf('hunt').play, /alone/, 'a shared square: the usual one');
});
