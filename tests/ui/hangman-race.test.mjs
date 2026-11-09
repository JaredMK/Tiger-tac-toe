// Hangman in Race mode v2 (core/race.js, rv 2): each player their own word of the same length, both players' letters open.
// The square draws two boards (ui/race.js): this phone's own word, wrong letters and keyboard large; the other player's word
// with the letters they have revealed and their wrong letters under it, their letter landing there; an open square never
// draws a letter nobody has found; the miniature is each player's blanks, revealed ones filled; a claimed square's review
// shows both words. Rendered in Node, the browser stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const view = await import('../../src/games/hangman/view.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { renderBoard } = await import('../../src/ui/board.js');
const { explainOf } = await import('../../src/ui/explainer.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.hangman.view = view;   // (the page registers the views in main.js; here by hand)

const g = E.makeRng('h');
function raceMatch() {
  E.setTune('hangman', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('hang-race'), { games: ['hangman'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', lock: null });
  E.setTune('hangman', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Olaf' };
  const m = state.squares[0].mini, blank = () => ({ letters: [], pattern: [null, null, null, null, null] });
  Object.assign(m, { tg: { X: 'APPLE', O: 'MELON' }, len: 5, side: { X: blank(), O: blank() } });
  return m;
}
const between = (html, a, b) => html.slice(html.indexOf(a), b ? html.indexOf(b) : undefined);
const tilesOf = html => (between(html, 'class="hword"', 'class="hmiss"').match(/<i class="ht[^"]*"[^>]*>([A-Z]?)<\/i>/g) || []).map(t => (t.match(/>([A-Z]?)<\/i>$/) || [])[1] || '_').join('');

test('Hangman, race v2: two boards: our own word and keys large, the other player\'s word with their revealed letters and their wrong letters under it; no letter nobody found', () => {
  const m = raceMatch();
  E.applyMove(m, 'X', 'P', g); E.applyMove(m, 'X', 'Z', g);
  E.applyMove(m, 'O', 'E', g); E.applyMove(m, 'O', 'L', g); E.applyMove(m, 'O', 'A', g);
  const html = renderMini(state.squares[0]), mine = between(html, 'class="rmain"', 'class="ropp'), theirs = between(html, 'class="ropp');
  assert.match(html, /class="rboards rb-hang"/); assert.match(html, /class="ropp O"/);
  assert.equal(tilesOf(mine), '_PP__', 'our own revealed letters');
  assert.equal(tilesOf(theirs), '_EL__', 'theirs, open to us');
  assert.match(mine, /Wrong: <b><i>Z<\/i><\/b>/); assert.match(theirs, /Wrong: <b><i>A<\/i><\/b>/, 'their wrong letters');
  assert.match(mine, /class="key hit"[^>]*data-m='"P"'[^>]* disabled/); assert.match(mine, /class="key "[^>]*data-m='"E"'/, 'their letters are not ours');
  assert.match(html, /<small class="rnote">2 of 5 · 1 wrong<\/small>/);
  assert.doesNotMatch(html, /late/, 'nothing revealed while the square is open');
});

test('Hangman, race v2: the other player\'s letter turns in on their board, ours stays still; a right letter keeps their turn', () => {
  const m = raceMatch();
  state.turn = 'O';
  assert.ok(E.playMove(state, 0, 'L', g).ok);
  assert.equal(state.flash.kind, 'again'); assert.equal(state.flash.letter, 'L');
  let html = renderMini(state.squares[0]);
  assert.match(between(html, 'class="ropp'), /<i class="ht on flipin" style="--k:0">L<\/i>/, 'their letter turns in, on their board');
  assert.doesNotMatch(between(html, 'class="rmain"', 'class="ropp'), /flipin/);
  E.endFlash(state); state.done = null;
  assert.ok(E.playMove(state, 0, 'Q', g).ok);
  html = renderMini(state.squares[0]);
  assert.match(between(html, 'class="ropp'), /<i class="new">Q<\/i>/, 'their miss lands in their wrong letters');
  assert.equal(view.moveText(state.flash, 'Olaf'), 'No Q');
});

test('Hangman, race v2: the miniature is each player\'s blanks, the revealed ones filled, no letters; a claimed square\'s review shows both words, the letters never found muted', () => {
  const m = raceMatch();
  E.applyMove(m, 'X', 'P', g);
  for (const l of 'MEL') E.applyMove(m, 'O', l, g);
  const html = view.miniature(E.publicMini(m, 'X'), false);
  assert.match(html, /class="trace2 thg2"/); assert.doesNotMatch(html, /[A-Z]<\/i>/, 'no letters');
  const x = between(html, 'class="trp X"', 'class="trp O"'), o = between(html, 'class="trp O"');
  assert.match(x, /<span class="hgm" style="--n:5;--c:3"><i><\/i><i class="on"><\/i><i class="on"><\/i><i><\/i><i><\/i><\/span>/);
  assert.match(o, /<span class="hgm" style="--n:5;--c:3"><i class="on"><\/i><i class="on"><\/i><i class="on"><\/i><i><\/i><i><\/i><\/span>/);
  for (const l of 'ON') E.applyMove(m, 'O', l, g);
  state.squares[0].owner = 'O';
  assert.doesNotThrow(() => view.miniature(m, true));
  state.screen = 'board'; state.zoom = null; assert.match(renderBoard(), /thg2/);
  const review = renderMini(state.squares[0], true);
  assert.equal(tilesOf(between(review, 'class="rmain"', 'class="ropp')), 'APPLE', 'our word, revealed'); assert.equal(tilesOf(between(review, 'class="ropp')), 'MELON');
  assert.equal((between(review, 'class="rmain"', 'class="ropp').match(/class="ht on late"/g) || []).length, 3, 'A, L, E never found: muted');
});

test('Hangman, race v2: the explainer is the Race one; a square from before the rework still draws', () => {
  raceMatch();
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('hangman').play, /your own word/); assert.match(explainOf('hangman').win, /your word first/);
  const old = { type: 'hangman', race: true, word: '_____', side: { X: { letters: [], pattern: [null, null, null, null, null] } }, shape: { X: {}, O: {} } };
  assert.doesNotThrow(() => view.miniature(old, false)); assert.doesNotThrow(() => view.screen({ mini: old }, null, null, old, false, false, null));
});
