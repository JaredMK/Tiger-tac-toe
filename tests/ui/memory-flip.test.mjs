// Find the Pair on the page (Shared mode), the polish pass: what the stylesheet animates is said by the markup. A card's
// face is in the page only while it is on show; the cards a move turned carry the mover's ring (`rv`, the grid's
// `pc-X`/`pc-O`); a miss marks the grid `miss` (the two shake, then stay up); a pair marks it `hit` and `own-<finder>`,
// its two cards `win glow` with the finder's drawn mark; a finished square shows the whole deck (`fin`), the pair in its
// finder's colour; the back is never a player's colour. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const V = await import('../../src/games/memory/view.js');
const R = await import('../../src/games/memory/rules.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.memory.view = V;   // (the page registers the views in main.js; here by hand)

function match(seed) {
  Object.assign(state, E.newMatch(E.makeRng(seed || 'memory-flip'), { games: ['memory'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', pick: null, pickSq: null, stamp: null, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const key = c => c.s + '/' + c.c;
const pairIn = cards => { for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) if (key(cards[a]) === key(cards[b])) return [a, b]; return null; };
const others = cards => { const pr = pairIn(cards); return [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(k => !pr.includes(k)).slice(0, 2); };
const cardsOf = html => [...html.matchAll(/<button class="(mc [^"]*)" data-act="pick" data-i="(\d)"/g)].map(x => x[1].split(' '));
const faces = html => (html.match(/<svg viewBox="0 0 24 24" fill="#/g) || []).length;
const grid = html => html.match(/<div class="(g-mem[^"]*)">/)[1].split(' ');

test('a card\'s face is in the page only while it is on show; every back is the same drawn back', () => {
  const m = match();
  let html = renderMini(state.squares[0]);
  assert.equal(faces(html), 0, 'nothing face up: no face in the page');
  assert.equal((html.match(/<svg class="mbk"/g) || []).length, 9, 'nine drawn backs');
  state.pick = 3; state.pickSq = 0;
  html = renderMini(state.squares[0]);
  assert.equal(faces(html), 1, 'the picked card alone');
  assert.deepEqual(cardsOf(html)[3].filter(c => ['up', 'pick', 'flipup'].includes(c)), ['up', 'pick', 'flipup']);
  assert.ok(grid(html).includes('pc-X'), 'its ring is the picker\'s colour');
  state.pick = null; state.pickSq = null;
  assert.ok(m.cards.length === 9);
});

test('a miss: the two cards up in the mover\'s ring, the grid marked for their shake; then both turn back together', () => {
  const m = match('memory-flip-2'), [a, b] = others(m.cards);
  state.turn = 'O';
  assert.ok(E.playMove(state, 0, [a, b], E.makeRng('o')).ok);
  let html = renderMini(state.squares[0]);
  const g = grid(html), cs = cardsOf(html);
  assert.ok(g.includes('pc-O') && g.includes('miss') && !g.includes('hit'), g.join(' '));
  for (const k of [a, b]) assert.ok(cs[k].includes('up') && cs[k].includes('rv'), `card ${k}: ${cs[k].join(' ')}`);
  assert.ok(cs[b].includes('flipup') && !cs[a].includes('flipup'), 'the second card is the one that turns with the move');
  assert.equal(faces(html), 2);
  assert.doesNotMatch(html, /class="mbd/, 'no mark on a card nobody has won');
  state.flash = null;                                              // the result gone: the held cards turn back
  html = renderMini(state.squares[0]);
  const cs2 = cardsOf(html);
  for (const k of [a, b]) assert.ok(cs2[k].includes('down') && cs2[k].includes('flipdown') && cs2[k].includes('rv'), `card ${k} turns back: ${cs2[k].join(' ')}`);
  assert.ok(!grid(html).includes('miss'), 'no second shake');
});

test('a pair: both cards lift in the finder\'s colour with their mark; the finished square shows the deck, the pair the finder\'s', () => {
  for (const who of ['X', 'O']) {
    const m = match('memory-flip-3'), pr = pairIn(m.cards);
    state.turn = who;
    assert.ok(E.playMove(state, 0, pr, E.makeRng('w')).ok);
    assert.equal(state.squares[0].owner, who);
    let html = renderMini(state.squares[0]);
    const g = grid(html), cs = cardsOf(html);
    assert.ok(g.includes(`own-${who}`) && g.includes('hit') && g.includes(`pc-${who}`) && !g.includes('miss'), g.join(' '));
    for (const k of pr) assert.ok(cs[k].includes('win') && cs[k].includes('glow') && cs[k].includes('rv'), `card ${k}: ${cs[k].join(' ')}`);
    assert.equal((html.match(new RegExp(`<span class="mbd ${who}">`, 'g')) || []).length, 2, 'the finder\'s mark on both');
    assert.equal(faces(html), 2, 'the rest still face down while the pair plays');
    state.flash = null; state.done = null;
    html = renderMini(state.squares[0]);
    assert.ok(grid(html).includes('fin') && grid(html).includes(`own-${who}`));
    assert.equal(faces(html), 9, 'the whole deck once the square is won');
    assert.equal(cardsOf(html).filter(c => c.includes('win')).length, 2);
    assert.match(V.miniature(state.squares[0].mini, true), new RegExp(`class="tg g3 tmem w${who}"`), 'the miniature\'s pair in the finder\'s colour');
  }
});

test('the move\'s time covers its animation: the turn and the chime, a pair\'s lift after it; the back is no player\'s colour', () => {
  assert.equal(R.flashMs({}, 4, false), 500);
  assert.ok(R.flashMs({}, 4, true) >= 380 + 560, 'a pair: the chime at 0.38 s and the lift after it');
  const sounds = []; V.sounds({}, (n, at) => sounds.push([n, at]), true);
  assert.deepEqual(sounds, [['flipUp', 0], ['pair', 380]]);
  const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  const bk = css.split('\n').filter(l => l.startsWith('.mc .bk {')).pop();
  assert.ok(bk && /var\(--sea\)/.test(bk) && !/var\(--[xo]\)/.test(bk), 'the back: the blue, never X\'s red or O\'s yellow');
  assert.match(css, /\.tg\.tmem i \{ background: var\(--sea\)/, 'the miniature\'s backs too');
});
