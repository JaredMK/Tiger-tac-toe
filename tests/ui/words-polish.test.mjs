// Five Letters and Hangman, the look-and-feel pass (November 2026), Shared mode: what each move shows, from the move
// alone. Five Letters: a typed letter pops into its box from its key's own event, a guessed row turns tile by tile and
// each key takes its colour as its tile lands, the row that finds the word hops along its length (and the move lasts
// that long), the row being typed carries the mover's mark. Hangman: every wrong letter draws the next part of the
// scarecrow and drops a struck chip in its guesser's colour, a right letter drops into each blank it fills with a
// chime each, the line under a found letter and a played key take their guesser's colour, a right letter says so.
// Rendered in Node, the browser stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const wordle = await import('../../src/games/wordle/view.js');
const hangman = await import('../../src/games/hangman/view.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.wordle.view = wordle; GAMES.hangman.view = hangman;   // (the page registers the views in main.js; here by hand)

const g = E.makeRng('polish');
function match(type, set) {
  Object.assign(state, E.newMatch(E.makeRng('polish-' + type), { games: [type], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', lock: null, draft: '', notice: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Olaf' };
  return Object.assign(state.squares[0].mini, set);
}
const sounds = (view, m) => { const out = []; view.sounds(state.flash, (n, at, rate) => out.push(rate ? [n, at, rate] : [n, at]), state.flash.kind === 'claim' || state.flash.kind === 'match', m, m.guesses ? m.guesses[m.guesses.length - 1] : null); return out; };

test('Five Letters: the row being typed carries the mover\'s mark; a typed letter pops only from its own key event', () => {
  match('wordle', { word: 'CRANE' });
  state.draft = 'SL';
  let html = renderMini(state.squares[0]);
  assert.match(html, /class="wrow cur" aria-label="Your guess"><span class="wby wnext X">/);
  assert.doesNotMatch(html, /class="wt typed tin"/, 'a draft just drawn: nothing pops');
  wordle.typed();                                                    // (what typeLetter and a replayed key do)
  html = renderMini(state.squares[0]);
  assert.match(html, /<i class="wt typed">S<\/i><i class="wt typed tin" data-fx="[\d.]+">L<\/i><i class="wt"><\/i>/, 'the newest letter, on its own event');
  state.draft = 'S';
  assert.doesNotMatch(renderMini(state.squares[0]), /tin/, 'a letter taken back: no pop');
});

test('Five Letters: a guess turns its tiles one after the other, each key taking its colour as its tile lands; the word found hops, and the move lasts it', () => {
  const m = match('wordle', { word: 'CRANE' });
  assert.ok(E.playMove(state, 0, 'CARES', g).ok);                    // g y y y x
  let html = renderMini(state.squares[0]);
  assert.match(html, /<i class="wt g reveal" style="--k:0">C<\/i><i class="wt y reveal" style="--k:1">A<\/i>/);
  assert.doesNotMatch(html, /wwin/);
  for (const [k, cls] of [['C', 'g kc k0'], ['A', 'y kc k1'], ['R', 'y kc k2'], ['E', 'y kc k3'], ['S', 'x kc k4']]) assert.match(html, new RegExp(`class="key ${cls}" data-act="key" data-k="${k}"`), `${k}'s key waits for tile ${cls.slice(-1)}`);
  assert.deepEqual(sounds(wordle, m), [['tileG', wordle.WT.land], ['tileY', wordle.WT.land + wordle.WT.step], ['tileY', wordle.WT.land + 2 * wordle.WT.step], ['tileY', wordle.WT.land + 3 * wordle.WT.step], ['tileX', wordle.WT.land + 4 * wordle.WT.step]]);
  assert.equal(E.playMs(state.flash, 4), 1200);
  E.endFlash(state); state.done = null; state.turn = 'X';
  assert.ok(E.playMove(state, 0, 'CRANE', g).ok);
  html = renderMini(state.squares[0]);
  assert.equal((html.match(/class="wt g reveal wwin"/g) || []).length, 5, 'the solved row hops once it has turned');
  assert.match(html, /class="key g kc k1" data-act="key" data-k="R"/, 'a key that turns greener: with the tile that makes it so');
  assert.deepEqual(sounds(wordle, m).pop(), ['solve', wordle.WT.dance]);
  assert.ok(E.playMs(state.flash, 4) >= wordle.WT.dance + 4 * 70 + 450, 'the move lasts the hop');
});

test('Hangman: a wrong letter draws the next part of the scarecrow, drops its chip and strikes its key, all in the guesser\'s colour', () => {
  const m = match('hangman', { word: 'THUNDER', letters: [] });
  assert.equal((renderMini(state.squares[0]).match(/<g class="hp/g) || []).length, 0, 'no wrong letter: the field alone');
  assert.match(renderMini(state.squares[0]), /class="hmiss"><span class="hnone">/);
  assert.ok(E.playMove(state, 0, 'Q', g).ok);
  let html = renderMini(state.squares[0]);
  assert.equal((html.match(/<g class="hp/g) || []).length, 1); assert.match(html, /<g class="hp new">/, 'the new part draws itself');
  assert.match(html, /class="hmiss" aria-label="Wrong letters: Q"><i class="hx bX new">Q<\/i>/);
  assert.match(html, /class="key miss bX shake"[^>]*aria-label="Q" disabled/);
  assert.equal(hangman.moveText(state.flash, 'Xena'), 'No Q');
  assert.deepEqual(sounds(hangman, m), [['mark', hangman.HT.pen], ['thud', hangman.HT.chip]]);
  E.endFlash(state); state.done = null; state.flash = null;
  html = renderMini(state.squares[0]);
  assert.doesNotMatch(html, /hp new|hx[^"]* new|shake/, 'once the move has played: nothing moves again');
  // every wrong letter a part, the last ones crows that fly in; past the last part the picture stays whole
  for (const [i, l] of 'ZXJVKWYPBCFG'.split('').entries()) { state.turn = i % 2 ? 'X' : 'O'; assert.ok(E.playMove(state, 0, l, g).ok); if (i < 11) { E.endFlash(state); state.done = null; state.flash = null; } }
  html = renderMini(state.squares[0]);
  assert.equal(m.letters.length, hangman.HANG_PARTS); assert.equal((html.match(/<g class="hp/g) || []).length, hangman.HANG_PARTS); assert.match(html, /<g class="hp fly">/, 'a crow flies in');
  E.endFlash(state); state.done = null; state.flash = null; state.turn = 'X';
  assert.ok(E.playMove(state, 0, 'I', g).ok);
  html = renderMini(state.squares[0]);
  assert.equal((html.match(/<g class="hp/g) || []).length, hangman.HANG_PARTS, 'no part left to draw'); assert.doesNotMatch(html, /hp (new|fly)/);
  assert.match(html, /<i class="hx bX new">I<\/i>/, 'its chip still lands');
});

test('Hangman: a right letter drops into every blank it fills, a chime each, its line and key in the finder\'s colour, and says so; the last one makes the word hop', () => {
  const m = match('hangman', { word: 'BANANA', letters: [] });
  state.turn = 'O';
  assert.ok(E.playMove(state, 0, 'A', g).ok);
  let html = renderMini(state.squares[0]);
  assert.equal((html.match(/class="ht on bO flipin" style="--k:\d;"><b>A<\/b>/g) || []).length, 3, 'all three As drop in, one after the other');
  assert.match(html, /style="--k:2;"/);
  assert.match(html, /class="key hit bO"[^>]*aria-label="A" disabled/);
  assert.equal(hangman.moveText(state.flash, 'Olaf'), 'Olaf found A', 'a right letter that ends the turn is not a "No"');
  const snd = sounds(hangman, m);
  assert.deepEqual(snd.map(s => s.slice(0, 2)), [['ding', hangman.HT.land], ['ding', hangman.HT.land + hangman.HT.step], ['ding', hangman.HT.land + 2 * hangman.HT.step]]);
  assert.ok(snd[0][2] < snd[1][2] && snd[1][2] < snd[2][2], 'rising');
  E.endFlash(state); state.done = null; state.flash = null; state.turn = 'X';
  assert.ok(E.playMove(state, 0, 'B', g).ok); E.endFlash(state); state.done = null; state.flash = null; state.turn = 'X';
  html = renderMini(state.squares[0]);
  assert.match(html, /<i class="ht on bX"><b>B<\/b><\/i><i class="ht on bO"><b>A<\/b><\/i><i class="ht"><\/i>/, 'each found letter keeps its finder\'s colour; nothing drops again');
  assert.ok(E.playMove(state, 0, 'N', g).ok);
  assert.equal(state.flash.kind, 'claim');
  html = renderMini(state.squares[0]);
  assert.equal((html.match(/class="ht on b[XO][^"]* hwin"/g) || []).length, 6, 'the whole word hops');
  assert.match(html, /<i class="ht on bX flipin hwin" style="--k:0;--i:2"><b>N<\/b><\/i>/);
  assert.deepEqual(sounds(hangman, m).pop(), ['solve', hangman.HT.dance]);
  assert.ok(E.playMs(state.flash, 4) >= hangman.HT.dance + 5 * 60 + 450, 'the move lasts the hop');
});

test('Hangman: the miniature is the word with the scarecrow as far as it is drawn and the last wrong letters; nothing hidden in it', () => {
  const m = match('hangman', { word: 'THUNDER', letters: [] });
  for (const l of 'QZT') E.applyMove(m, 'X', l, g);
  const html = hangman.miniature(m, false);
  assert.match(html, /class="thb"><svg class="hsc"[^>]*aria-label="2 wrong letters">/);
  assert.equal((html.match(/<g class="hp/g) || []).length, 2);
  assert.doesNotMatch(html, /hp (new|fly)/, 'never animated on the board');
  assert.doesNotMatch(html.replace(/aria-label="[^"]*"/g, ''), /[HUNDER]<\/i>/, 'no letter nobody has found');
  assert.match(html, /class="on">T<\/i>/);
});
