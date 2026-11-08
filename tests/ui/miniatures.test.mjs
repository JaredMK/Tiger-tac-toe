// The board's miniatures (each game's view.js miniature, drawn by ui/board.js thumb): every dealt game draws a small
// picture of itself (an <svg> or a drawn grid, never figures alone) for a fresh square and after a few moves, and shows
// public information only: a square's miniature is the same whether drawn from the full square or from the square as
// the other phone has it (core/records.js hideMini: the word, the number, the cards, the ships, the odd tile taken
// out). Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { TYPES, GAMES, viewOf } = await import('../../src/games/index.js');
for (const t of TYPES) GAMES[t].view = await import(`../../src/games/${t}/view.js`);   // (the page registers the views in main.js; here each is loaded by hand)
const { hideMini } = await import('../../src/core/records.js');
const { state } = await import('../../src/ui/app.js');

// A picture: an <svg>, or a drawn grid or scene (a class the stylesheet draws as one). Figures or pips alone are not.
const PICTURE = /<svg|class="(tg|thex|track|tseat|tshelf|tcd|tepads|todd|tsnap|tatt|tmm|thg|tw|tcoin|tfelt)[ "]/;
const square = (t, moves) => {   // a fresh square of the game, then up to `moves` random legal moves on it
  const rng = E.makeRng('mini-' + t);
  const st = E.newMatch(rng, { games: [t] });
  Object.assign(state, st, { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null });
  const sq = state.squares[0]; sq.mini = E.newMini(t, rng); sq.owner = null; state.turn = 'X';
  if (t === 'trivia') { try { E.triviaDeal && E.triviaDeal(state, sq, E.makeRng('tq')); } catch (e) { /* (no bank in Node) */ } }
  for (let k = 0; k < moves; k++) {
    let mv; try { mv = E.randomLegalMove(sq.mini, state.turn, rng); } catch (e) { break; }
    if (mv == null) break;
    try { E.playMove(state, 0, mv, rng); } catch (e) { break; }
    state.flash = null; state.spot = null; state.done = null; state.stamp = null; state.lock = null;
    if (sq.owner || state.winner) { sq.owner = null; state.winner = null; break; }
  }
  return sq.mini;
};
const clone = m => JSON.parse(JSON.stringify(m));

test('every dealt game has a miniature that draws a picture, fresh and after a few moves', () => {
  const bad = [];
  for (const t of TYPES) {
    const view = viewOf(t);
    if (typeof view.miniature !== 'function') { bad.push(`${t}: no miniature`); continue; }
    for (const moves of [0, 3]) {
      let html; try { html = view.miniature(square(t, moves), false); } catch (e) { bad.push(`${t}: throws (${moves} moves): ${e.message}`); continue; }
      if (!(typeof html === 'string' && html.length > 20)) bad.push(`${t}: no markup (${moves} moves)`);
      else if (!PICTURE.test(html)) bad.push(`${t}: figures alone, no picture (${moves} moves): ${html.slice(0, 120)}`);
      else if (/undefined|NaN|\[object/.test(html)) bad.push(`${t}: something undefined in it (${moves} moves)`);
    }
  }
  assert.deepEqual(bad, []);
});

test('a miniature shows public information only: the same from the full square as from the square hidden', () => {
  for (const t of TYPES) {
    const view = viewOf(t);
    for (const moves of [0, 3]) {
      const full = square(t, moves), hidden = clone(full);
      hideMini(hidden, 0, state);
      assert.equal(view.miniature(hidden, false), view.miniature(clone(full), false), `${t}: the miniature from the hidden square differs (${moves} moves): a secret shows`);
    }
  }
});

test('the miniatures never put a game\'s secret in the markup', () => {
  const rng = E.makeRng('secrets');
  const w = E.newMini('wordle', rng); assert.ok(!viewOf('wordle').miniature(w, false).includes(w.word), 'Five Letters\' word');
  const h = E.newMini('hilo', rng); assert.ok(!new RegExp(`\\b${h.target}\\b`).test(viewOf('hilo').miniature(h, false).replace(/\d+–\d+/, '')), 'Higher/Lower\'s number');
  const o = E.newMini('oddone', rng); assert.ok(!viewOf('oddone').miniature(o, false).includes(`"${o.pos.X}"`), 'Odd One Out\'s tile');
});

// A miniature's classes are its own: the stylesheet's buttons, tiles and controls have classes of their own (.back is the
// Back button, .sq the board's tile, .btn, .big, .seg ...), and a miniature that borrows one of those names takes on its
// look (a card back drawn as a Back button, over the win counters beside it).
test('a miniature never uses a class the buttons and tiles of the interface use', () => {
  const global = new Set(['back', 'btn', 'big', 'primary', 'menubtn', 'link', 'seg', 'key', 'sq', 'chip', 'bird']);   // ("bird" is Apple Pick's swooping bird)
  const bad = [];
  for (const t of TYPES) {
    for (const moves of [0, 3]) {
      let html; try { html = viewOf(t).miniature(square(t, moves), false); } catch (e) { continue; }
      for (const m of String(html).matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (global.has(c)) bad.push(`${t}: class "${c}" (${moves} moves)`);
    }
  }
  assert.deepEqual([...new Set(bad)], []);
});
test('21: the cards\' backs and a hand are drawn within their picture, clear of the win counters', async () => {
  const { tinyCard } = await import('../../src/ui/thumbs.js');
  assert.match(tinyCard(null), /class="tcd cdb"/, 'a card back is .cdb, never the Back button\'s class');
  const html = viewOf('bj').miniature(square('bj', 0), false);
  assert.match(html, /class="tcd cdb"/); assert.doesNotMatch(html, /class="[^"]*\bback\b/);
  assert.match(html, /class="tpic"[\s\S]*class="tpip"/, 'the cards in their own space, the counters in theirs');
});
test('Risky Spins: the three small wheels and the scores, no skulls drawn', () => {
  const mini = square('wheels', 0); mini.pts = { X: 12, O: 5 };
  const html = viewOf('wheels').miniature(mini, false);
  assert.equal((html.match(/<svg/g) || []).length, 3, 'three wheels');
  assert.doesNotMatch(html, /wsk|wske/, 'no skull glyphs');
  assert.match(html, /class="wseg sk"/, 'a skull\'s segment stays the dark one');
  assert.match(html, /<span>12<\/span>/); assert.match(html, /<span>5<\/span>/);
});
