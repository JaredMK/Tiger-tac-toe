// Hangman in Race mode (core/race.js): the screen shows this side's own revealed letters and wrong letters, the other
// side's progress as filled blanks without letters plus their wrong count, the other side's move arrives redacted (the
// blanks it filled turn), a finished square shows both parts, and the miniature from the board's view shows both
// players' blanks and wrong counts. Rendered in Node with the browser's names stubbed.
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
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });
state.cpu = 'O'; state.online = null;   // this phone is X, against the computer

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const pick = (k, n) => (k + 0.5) / n;
const wordRng = word => seq(pick(E.WORDS_HANG.indexOf(word), E.WORDS_HANG.length));
const raceOn = on => E.setTune('hangman', on ? { mode: 'race' } : null);
const flashOf = (mini, p, l, res) => { const f = { kind: res.outcome === 'win' ? 'claim' : res.again ? 'again' : 'move', by: p, next: res.again ? p : p === 'X' ? 'O' : 'X', square: 0, type: 'hangman', note: res.note || null, pass: null, timeout: false, m: l, rep: [[0, 'move', 'm=' + l]] }; E.rulesOf('hangman').moveFlash(l, p, null, 0, mini, f); return f; };
const screen = (mini, f, opts) => view.screen({ owner: (opts || {}).owner || null, mini }, f, null, mini, !!(opts || {}).view, !!f, f, null, false, () => -1, false, 'X', '');
const tiles = html => [...html.matchAll(/<i class="ht[^"]*"[^>]*>([A-Z]?)<\/i>/g)].map(m => m[1]);

test('Hangman, race: this side\'s own letters show; the other side\'s progress is filled blanks and a wrong count, never a letter; their move turns the blanks it filled', () => {
  raceOn(true);
  try {
    const m = E.newMini('hangman', wordRng('apple'));
    E.applyMove(m, 'X', 'P', seq(0.5)); E.applyMove(m, 'X', 'Z', seq(0.5));
    const rO = E.applyMove(m, 'O', 'E', seq(0.5)), fO = E.raceFlashHide(flashOf(m, 'O', 'E', rO), m);
    const mine = E.raceView(m, 'X');
    assert.deepEqual(Object.keys(mine.side), ['X']); assert.deepEqual(mine.shape.O, { n: 1, wrong: 0, got: [false, false, false, false, true] });
    const html = screen(mine, fO);
    assert.deepEqual(tiles(html), ['', 'P', 'P', '', ''], 'my own pattern: my P, not their E');
    assert.doesNotMatch(html, />E<\/i>|>Q<\/i>/, "none of O's letters"); assert.doesNotMatch(html, /APPLE/, 'never the word');
    assert.match(html, /Wrong: <b><i>Z<\/i><\/b>/, 'my own wrong letters');
    assert.match(html, /class="hopp fresh"/); assert.match(html, /class="hob" style="--n:5"><i class=""><\/i><i class=""><\/i><i class=""><\/i><i class=""><\/i><i class="on flipin" style="--k:0"><\/i><\/span><em class="hown">0 wrong<\/em>/, 'their blanks: the one they just filled turns, no letter in it; their wrong count');
    assert.match(html, /aria-label="Olaf found a letter · 0 wrong"/, 'the label in plain text');
    E.applyMove(m, 'O', 'Q', seq(0.5));
    const plain = screen(E.raceView(m, 'X'), null);
    assert.doesNotMatch(plain, /flipin/, 'nothing turns at a plain render'); assert.match(plain, /Olaf: 1 of 5 letters · 1 wrong/); assert.doesNotMatch(plain, />Q<\/i>/);
    assert.match(html, /class="key hit"[^>]*>P</, 'my keyboard: my own letters'); assert.doesNotMatch(html, /class="key (hit|miss)"[^>]*>E</);
    assert.equal(view.moveText(fO, 'Olaf'), 'Olaf found a letter');
    assert.equal(view.moveText(Object.assign({}, fO, { race: { by: 'O', hit: false, at: [], n: 3, wrong: 2, got: [] } }), 'Olaf'), 'Olaf missed · 2 wrong');
    assert.equal(view.moveText(flashOf(m, 'X', 'Z', { outcome: 'continue', note: 'miss' }), 'Xena'), 'No Z');
    const fresh = screen(E.raceView(E.newMini('hangman', wordRng('apple')), 'X'), null);
    assert.match(fresh, /Your letters are yours alone/); assert.match(fresh, /Olaf: 0 of 5 letters · 0 wrong/);
    // a finished square: the word, and both players' wrong letters
    for (const l of ['A', 'L']) E.applyMove(m, 'O', l, seq(0.5));
    const r = E.applyMove(m, 'O', 'P', seq(0.5)); assert.equal(r.outcome, 'win');
    const done = screen(m, null, { owner: 'O', view: true });
    assert.deepEqual(tiles(done), ['A', 'P', 'P', 'L', 'E']); assert.match(done, /Xena<\/b> <b><i>Z<\/i><\/b>/); assert.match(done, /Olaf<\/b> <b><i>Q<\/i><\/b>/); assert.doesNotMatch(done, /class="hopp/);
  } finally { raceOn(false); }
});

test('Hangman, race: the miniature from the board\'s view shows both players\' blanks (filled ones darkened, no letters) and wrong counts; Shared is as ever', () => {
  raceOn(true);
  try {
    const m = E.newMini('hangman', wordRng('apple'));
    E.applyMove(m, 'X', 'P', seq(0.5)); E.applyMove(m, 'X', 'Z', seq(0.5)); E.applyMove(m, 'O', 'E', seq(0.5));
    const html = view.miniature(E.raceView(m, null), false);
    assert.match(html, /class="thg trace"/); assert.doesNotMatch(html, /[A-Z]<\/i>/, 'no letters'); assert.doesNotMatch(html, /APPLE/);
    assert.match(html, /<b class="X">X<\/b><div class="hw" style="--n:5"><i class=""><\/i><i class="on"><\/i><i class="on"><\/i><i class=""><\/i><i class=""><\/i><\/div><em class="thwr">1✗<\/em>/);
    assert.match(html, /<b class="O">O<\/b><div class="hw" style="--n:5"><i class=""><\/i><i class=""><\/i><i class=""><\/i><i class=""><\/i><i class="on"><\/i><\/div><em class="thwr">0✗<\/em>/);
    const hidden = JSON.parse(JSON.stringify(m)); E.hideMini(hidden, 0, {});
    assert.equal(hidden.word, '_____'); assert.equal(view.miniature(E.raceView(hidden, null), false), html, 'the same from the square as the other phone has it');
    assert.match(view.miniature(m, true), /<i class="on">P<\/i>/, 'a finished square: the letters');
  } finally { raceOn(false); }
  const s = E.newMini('hangman', wordRng('apple')); E.applyMove(s, 'X', 'P', seq(0.5));
  assert.match(view.miniature(s, false), /<i class="on">P<\/i>/); assert.doesNotMatch(view.miniature(s, false), /trace/);
});

test('Hangman, race: the header\'s line for the other side\'s miss is redacted even from the move as made (the turn bar reads state.flash itself)', () => {
  raceOn(true);
  try {
    const m = E.newMini('hangman', wordRng('apple'));
    const rO = E.applyMove(m, 'O', 'Z', seq(0.5)), raw = flashOf(m, 'O', 'Z', rO);
    state.squares = [{ owner: null, mini: m }];
    assert.equal(view.moveText(raw, 'Olaf'), 'Olaf missed · 1 wrong');
    const rX = E.applyMove(m, 'X', 'Q', seq(0.5));
    assert.equal(view.moveText(flashOf(m, 'X', 'Q', rX), 'Xena'), 'No Q', 'my own, as made');
  } finally { raceOn(false); state.squares = []; }
});
