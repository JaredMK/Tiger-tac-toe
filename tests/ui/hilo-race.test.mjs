// Higher/Lower in Race mode v2 (core/race.js, rv 2): each player their own number, both players' guesses open. The square
// draws two boards (ui/race.js): this phone's own range and pad large, the other player's range on the number line under
// it, their move landing there; the numbers stay out of an open square's drawing; the miniature is a bar per player of the
// numbers still possible; a claimed square's miniature and review show both numbers. Rendered in Node, the browser stubbed.
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

function raceMatch(seed) {
  E.setTune('hilo', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng(seed || 'hilo-race'), { games: ['hilo'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('hilo', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  const m = state.squares[0].mini; m.tg = { X: 20, O: 7 };
  return m;
}
const between = (html, a, b) => html.slice(html.indexOf(a), b ? html.indexOf(b) : undefined);

test('race v2: two boards, this side\'s own range and pad large, the other player\'s range and guesses under it; no number of an open square drawn', () => {
  const m = raceMatch();
  E.applyMove(m, 'O', 15, E.makeRng('g')); E.applyMove(m, 'O', 8, E.makeRng('g'));   // the computer: 15 lower, 8 lower: 1 to 7
  E.applyMove(m, 'X', 10, E.makeRng('g'));                                              // ours: 10 higher: 11 to 30
  const html = renderMini(state.squares[0]);
  assert.match(html, /class="rboards rb-hilo"/); assert.match(html, /class="rmain"/); assert.match(html, /class="ropp O"/);
  const mine = between(html, 'class="rmain"', 'class="ropp'), theirs = between(html, 'class="ropp');
  assert.match(mine, /<b>11<\/b><span>and<\/span><b>30<\/b>/, 'our own range');
  assert.match(mine, /<button class="X[^"]*" data-act="move" data-m='10'/, 'our guess on our pad');
  assert.match(mine, /<button class="[^"]*" data-act="move" data-m='5' disabled>/, 'outside our range: closed');
  assert.match(theirs, /<b>1<\/b><span>–<\/span><b>7<\/b>/, "their range, open to us");
  assert.equal((theirs.match(/class="hlt O/g) || []).length, 2, 'their two guesses as ticks');
  assert.match(theirs, /<b class="n">8<\/b><span class="arrow dn">▼<\/span> Lower/, 'their latest guess and its answer');
  assert.match(html, /<small class="rnote">2 guesses<\/small>/);
  assert.doesNotMatch(html, /was <b class="n">/, 'no number revealed while the square is open');
  assert.doesNotMatch(html, /hpips|left/, 'no guesses left in a race');
});

test('race v2: the other player\'s move lands on their board (the window narrowing, the new tick), ours stays still; our own move on ours', () => {
  const m = raceMatch();
  state.turn = 'O';
  const r = E.playMove(state, 0, 12, E.makeRng('c'));
  assert.ok(r.ok);
  const html = renderMini(state.squares[0]), mine = between(html, 'class="rmain"', 'class="ropp'), theirs = between(html, 'class="ropp');
  assert.match(theirs, /class="seg shrink" style="--l:0.00%;--w:36.67%;--pl:0.00%;--pw:100.00%"/, 'their window narrows from 1-30 to 1-11');
  assert.match(theirs, /class="hlt O fresh"/); assert.match(theirs, /class="hlsaid fresh"/);
  assert.doesNotMatch(mine, /shrink|guess fresh/, 'our board does not move for their guess');
  E.endFlash(state); state.done = null; state.turn = 'X';
  assert.ok(E.playMove(state, 0, 15, E.makeRng('c')).ok);
  const h2 = renderMini(state.squares[0]);
  assert.match(between(h2, 'class="rmain"', 'class="ropp'), /class="seg shrink"[\s\S]*class="guess fresh"><b class="X hn">/, 'our guess on our board');
  assert.doesNotMatch(between(h2, 'class="ropp'), /fresh/);
  assert.equal(V.moveText(state.flash, 'Xena'), '15? Higher!');
});

test('race v2: the miniature is a bar per player of the numbers still possible, shrinking, never the numbers; a claimed square shows both numbers and its review both boards', () => {
  const m = raceMatch();
  E.applyMove(m, 'X', 15, E.makeRng('g'));                                              // 16 to 30: 15 left
  E.applyMove(m, 'O', 15, E.makeRng('g')); E.applyMove(m, 'O', 7, E.makeRng('g'));      // 7: found... (O's number is 7)
  state.screen = 'board'; state.zoom = null;
  const pub = E.publicMini(m, 'X'); delete m.tg;                                        // (the public state of an open square has no numbers)
  const html = V.miniature(Object.assign(pub, { tg: undefined }), false);
  assert.match(html, /class="trace2 thilo2"/); assert.match(html, /<svg class="rmk X"/);
  assert.match(html, /class="trbar X hlbar"><b style="--f:0.500"/, "X: 15 of 30 still possible");
  assert.match(html, /class="trbar O hlbar"><b style="--f:0.033"/, 'O: one');
  assert.match(html, /<b class="hlmn">15<\/b>/);
  m.tg = { X: 20, O: 7 }; state.squares[0].owner = 'O';
  const fin = V.miniature(m, true);
  assert.match(fin, /<b class="hlmn">20<\/b>[\s\S]*<b class="hlmn">7<\/b>/, 'claimed: both numbers');
  const board = renderBoard();
  assert.match(board, /thilo2/);
  const review = renderMini(state.squares[0], true);
  assert.match(review, /class="rboards rb-hilo"/);
  assert.match(review, /The number was <b class="n">20<\/b>/, 'our own number, revealed'); assert.match(review, /Their number was <b class="n">7<\/b>/);
});

test('race v2: the explainer is the Race one in an open race square, the usual one in a shared square; a square from before the rework still draws', () => {
  const m = raceMatch();
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('hilo').play, /your own number/);
  assert.match(explainOf('hilo').win, /No guess limit/);
  const old = { type: 'hilo', race: true, top: 30, limit: 5, side: { X: { lo: 1, hi: 30, guesses: [] } }, shape: { X: {}, O: {} } };   // (v1: one side's part, shapes)
  assert.doesNotThrow(() => V.miniature(old, false)); assert.doesNotThrow(() => V.screen({ mini: old }, null, null, old, false, false, null));
  state.squares[0].mini = Object.assign({}, m, { race: false }); delete state.squares[0].mini.side;
  state.squares[0].mini = E.newMini('hilo', E.makeRng('shared'));
  assert.doesNotMatch(explainOf('hilo').play, /your own number/, 'a shared square: the usual one');
});
