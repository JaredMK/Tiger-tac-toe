// Five Letters in Race mode v2 (core/race.js, rv 2): each player their own word, both players' rows open, letters and all.
// The square draws two boards (ui/race.js): this phone's rows, the row typed and the keyboard large; the other player's
// rows under it, their new row turning there; the words stay out of an open square's drawing; the miniature is each
// player's best row so far; a claimed square's review shows both words. Rendered in Node, the browser stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const view = await import('../../src/games/wordle/view.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { renderBoard } = await import('../../src/ui/board.js');
const { explainOf } = await import('../../src/ui/explainer.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.wordle.view = view;   // (the page registers the views in main.js; here by hand)

const g = E.makeRng('w');
function raceMatch() {
  E.setTune('wordle', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('wordle-race'), { games: ['wordle'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', draft: '', notice: null });
  E.setTune('wordle', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Olaf' };
  const m = state.squares[0].mini; m.tg = { X: 'CRANE', O: 'MOUNT' };
  return m;
}
const between = (html, a, b) => html.slice(html.indexOf(a), b ? html.indexOf(b) : undefined);
const row = (html, w) => new RegExp('>' + w.split('').join('</i><i class="wt[^"]*"[^>]*>') + '</i>');

test('Five Letters, race v2: two boards: our rows and keys large, the other player\'s rows (letters and colours) under it; neither word drawn while the square is open', () => {
  const m = raceMatch();
  E.applyMove(m, 'X', 'SLATE', g); E.applyMove(m, 'O', 'BLOOM', g); E.applyMove(m, 'O', 'COUNT', g);
  const html = renderMini(state.squares[0]), mine = between(html, 'class="rmain"', 'class="ropp'), theirs = between(html, 'class="ropp');
  assert.match(html, /class="rboards rb-wordle"/); assert.match(html, /class="ropp O"/);
  assert.match(mine, row(mine, 'SLATE')); assert.match(mine, /class="kb"/); assert.match(mine, /aria-label="Your guess"/);
  assert.doesNotMatch(mine, />B<\/i>[^]*>L<\/i>[^]*>O<\/i>[^]*>O<\/i>[^]*>M<\/i>/, 'their rows are not on our board');
  assert.match(theirs, row(theirs, 'BLOOM')); assert.match(theirs, row(theirs, 'COUNT'));
  assert.match(theirs, /<i class="wt x">C<\/i><i class="wt g">O<\/i><i class="wt g">U<\/i><i class="wt g">N<\/i><i class="wt g">T<\/i>/, "their colours, against their own word");
  assert.match(mine, /<i class="wt x">S<\/i><i class="wt x">L<\/i><i class="wt g">A<\/i><i class="wt x">T<\/i><i class="wt g">E<\/i>/, 'ours, against ours');
  assert.match(html, /<small class="rnote">2 guesses<\/small>/);
  assert.doesNotMatch(html, row(html, 'CRANE'), 'our word is not drawn'); assert.doesNotMatch(html, row(html, 'MOUNT'), 'nor theirs');
  assert.doesNotMatch(html, /wans|hpips/, 'no answer row, no guesses left');
  // the keyboard: our own colours alone (their B, M, U never coloured)
  assert.match(mine, /class="key x"[^>]*data-k="S"/); assert.match(mine, /class="key "[^>]*data-k="B"/);
});

test('Five Letters, race v2: the other player\'s move turns its row on their board, ours stays still; our own turns on ours', () => {
  const m = raceMatch();
  state.turn = 'O';
  assert.ok(E.playMove(state, 0, 'BLOOM', g).ok);
  let html = renderMini(state.squares[0]);
  assert.match(between(html, 'class="ropp'), /<i class="wt x reveal" style="--k:0">B<\/i>/, 'their new row turns, on their board');
  assert.doesNotMatch(between(html, 'class="rmain"', 'class="ropp'), /reveal/);
  assert.equal(view.moveText(state.flash, 'Olaf'), 'Olaf tried BLOOM', 'their guess is open');
  const snd = []; view.sounds(state.flash, (n, at) => snd.push(n), false, m, null);
  assert.deepEqual(snd, E.wordleMarks('BLOOM', 'MOUNT').map(c => ({ g: 'tileG', y: 'tileY', x: 'tileX' })[c]), 'its colours heard (BLOOM against MOUNT)');
  E.endFlash(state); state.done = null; state.turn = 'X';
  assert.ok(E.playMove(state, 0, 'SLATE', g).ok);
  html = renderMini(state.squares[0]);
  assert.match(between(html, 'class="rmain"', 'class="ropp'), /<i class="wt x reveal" style="--k:0">S<\/i>/);
  assert.doesNotMatch(between(html, 'class="ropp'), /reveal/);
});

test('Five Letters, race v2: the miniature is each player\'s best row so far as coloured tiles (most greens, then yellows), no letters; a claimed square reveals both words', () => {
  const m = raceMatch();
  for (const w of ['SLATE', 'CRONY', 'BLOOM']) E.applyMove(m, 'X', w, g);   // SLATE xxgxg, CRONY ggxgx (3 greens): the best
  E.applyMove(m, 'O', 'SLATE', g);                                          // xxxyx
  const pub = E.publicMini(m, 'X');
  const html = view.miniature(pub, false);
  assert.match(html, /class="trace2 tw2"/); assert.doesNotMatch(html, /[A-Z]<\/i>/, 'no letters');
  const x = between(html, 'class="trp X"', 'class="trp O"'), o = between(html, 'class="trp O"');
  assert.match(x, /<span class="twb"><i class="g"><\/i><i class="g"><\/i><i class="x"><\/i><i class="g"><\/i><i class="x"><\/i><\/span>/, "X's best row");
  assert.match(o, /<span class="twb"><i class="x"><\/i><i class="x"><\/i><i class="x"><\/i><i class="y"><\/i><i class="x"><\/i><\/span>/, "O's");
  assert.doesNotMatch(html, /CRANE|MOUNT/);
  E.setTune('wordle', { mode: 'race' }); const fresh = E.newMini('wordle', E.makeRng('fresh')); E.setTune('wordle', null);
  assert.match(view.miniature(E.publicMini(fresh, 'X'), false), /<span class="twb"><i><\/i><i><\/i><i><\/i><i><\/i><i><\/i><\/span>/, 'no guess yet: empty tiles');
  // claimed: the review shows both boards and both words
  E.applyMove(m, 'O', 'MOUNT', g); state.squares[0].owner = 'O';
  assert.doesNotThrow(() => view.miniature(m, true));
  state.screen = 'board'; state.zoom = null; assert.match(renderBoard(), /tw2/);
  const review = renderMini(state.squares[0], true);
  assert.match(review, /class="rboards rb-wordle"/);
  assert.match(between(review, 'class="rmain"', 'class="ropp'), /aria-label="The word was CRANE"/); assert.match(between(review, 'class="ropp'), /aria-label="The word was MOUNT"/);
  assert.doesNotMatch(review, /aria-label="Your guess"/, 'nothing to type in a finished square');
});

test('Five Letters, race v2: the explainer is the Race one; a square from before the rework still draws', () => {
  raceMatch();
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('wordle').play, /your own 5-letter word/); assert.match(explainOf('wordle').win, /No guess limit/);
  const old = { type: 'wordle', race: true, limit: 5, side: { X: { guesses: [] } }, shape: { X: { n: 0, rows: [] }, O: { n: 1, rows: ['xxgxg'] } } };
  assert.doesNotThrow(() => view.miniature(old, false)); assert.doesNotThrow(() => view.screen({ mini: old }, null, null, old, false, false, null));
});
