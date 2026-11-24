// Five Letters' picture away from play (the Game lineup's card, ui/lineup.js gameArt): always the example guess CHAOS,
// a fixed word (never one drawn from the list), on a throwaway square dealt for the picture; real play's miniature
// shows its own guesses alone, and the picture never carries the throwaway square's word. Rendered in Node with the
// browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/wordle/view.js');
const W = await import('../../src/games/wordle/words.js');
GAMES.wordle.view = V;   // (the page registers the views in main.js; here by hand)
const LU = await import('../../src/ui/lineup.js');
const letters = html => (html.match(/<div class="twr">(.*?)<\/div>/) || [])[1].replace(/<[^>]+>/g, '');

test('the lineup card shows the example guess CHAOS, a word the game takes, coloured against its own throwaway square', () => {
  assert.equal(V.PREVIEW_WORD, 'CHAOS');
  assert.ok(W.VALID5.has('CHAOS') && !W.BAD5.has('CHAOS'), 'a word the game takes as a guess');
  const html = LU.gameArt('wordle');
  assert.equal(letters(html), 'CHAOS', 'the latest guess on show is CHAOS');
  assert.equal((html.match(/class="twr/g) || []).length, 1, 'one guess: no other word drawn from the list');
  assert.doesNotMatch(html, /class="g">.*class="g">.*class="g">.*class="g">.*class="g">/, 'never the answer itself');
  // the preview square's own word is never in the picture
  const m = E.newMini('wordle', E.makeRng('p'), { shared: true }); V.preview(m, E.makeRng('p'));
  assert.deepEqual(m.guesses.map(g => g.word), ['CHAOS']);
  assert.doesNotMatch(V.miniature(m, false), new RegExp(m.word || m.tg || '#none#'));
});

test('real play is unchanged: a fresh square shows no word, a played one its own guesses', () => {
  const m = E.newMini('wordle', E.makeRng('real'), { shared: true });
  assert.equal(letters(V.miniature(m, false)), '', 'a fresh square: empty rows');
  assert.ok(E.applyMove(m, 'X', 'SLATE', E.makeRng('r')).ok);
  assert.equal(letters(V.miniature(m, false)), 'SLATE');
});
