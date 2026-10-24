// Stored XSS (security review F2): a match record a phone renders (a game's view, the history's board) carries game
// content as data, never as markup. Crafted letters in a Five Letters guess or a Hangman word, a crafted mark on a
// square, must come out escaped from every view that shows them. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const wordle = await import('../../src/games/wordle/view.js');
const hangman = await import('../../src/games/hangman/view.js');
const { toon, toonT } = await import('../../src/ui/art.js');
const { state } = await import('../../src/ui/app.js');

const PAYLOAD = '<img src=x onerror=alert(1)>';
const CRAFT = ['A<b>', '"><svg/onload=1>', '<s', 'cr', 'E'];                 // five "letters", each a fragment of markup
const clean = html => { assert.ok(!/<img|<svg\/|<b>|<s>/.test(html), `markup from the data in the output: ${html.slice(0, 300)}`); assert.ok(/&lt;/.test(html), 'the letters are there, escaped'); };

test('XSS: a Five Letters guess with markup for letters renders escaped, in the square, its miniature and its move text', () => {
  const mini = { type: 'wordle', word: 'CRANE', limit: 5, guesses: [{ word: CRAFT.join(''), by: 'X', marks: ['x', 'y', 'g', 'x', 'x'] }] };
  state.draft = '<i>'; state.notice = PAYLOAD;
  clean(wordle.screen({ owner: null, mini }, null, null, mini, false, false, null, null, false, null, false, 'X', ''));
  clean(wordle.miniature(mini, false));
  clean(wordle.moveText({ word: PAYLOAD, note: null }, 'They'));
  state.draft = ''; state.notice = null;
});
test('XSS: a Hangman word and its letters with markup render escaped', () => {
  const mini = { type: 'hangman', word: PAYLOAD, letters: [{ l: '<', hit: true }, { l: 'img', hit: true }, { l: '"', hit: false }, { l: '<script>', hit: false }] };
  const html = hangman.screen({ owner: null, mini }, null, null, mini, true, false, { letter: '<' }, null, false, null, false, 'X', '');
  assert.ok(!/<img|<script>/.test(html), 'no tag from the word'); assert.ok(/&lt;/.test(html) && /&quot;/.test(html), 'the word\'s letters, escaped');
  clean(hangman.miniature(mini, false).replace(/<i>/g, '').replace(/<\/i>/g, '') + '&lt;');
  assert.equal(hangman.moveText({ letter: PAYLOAD }, 'They').includes('<img'), false);
});
test('XSS: a mark that is not X or O never becomes markup in the players\' icons', () => {
  for (const m of [PAYLOAD, '"><b>', 'X']) { assert.ok(!/<img|<b>/.test(toon(m)), toon(m)); assert.ok(!/<img|<b>/.test(toonT(m)), toonT(m)); }
});
