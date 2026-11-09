// Five Letters in Race mode (core/race.js): the screen shows this side's own guesses and the other side's rows as colours
// alone (never their letters), the other side's move arrives redacted and is said as its colours, a finished square shows
// both parts, and the miniature from the board's view (shapes, nobody's guesses) shows both players' rows of colours.
// Rendered in Node with the browser's names stubbed.
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
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });
state.cpu = 'O'; state.online = null; state.draft = '';   // this phone is X, against the computer

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const pick = (k, n) => (k + 0.5) / n;
const wordRng = word => seq(pick(E.WORDS5.indexOf(word), E.WORDS5.length));
const raceOn = on => E.setTune('wordle', on ? { mode: 'race' } : null);
const flashOf = (mini, p, word, res) => { const f = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p === 'X' ? 'O' : 'X', square: 0, type: 'wordle', note: res.note || null, pass: null, timeout: false, m: word.toUpperCase(), rep: [[0, 'enter']] }; E.rulesOf('wordle').moveFlash(word, p, null, 0, mini, f); return f; };
const screen = (mini, f, opts) => view.screen({ owner: (opts || {}).owner || null, mini }, f, null, mini, !!(opts || {}).view, !!f, f, null, false, () => -1, false, 'X', '');

test('Five Letters, race: this side\'s own rows show their letters; the other side\'s rows show colours alone; their move is said as its colours', () => {
  raceOn(true);
  try {
    const m = E.newMini('wordle', wordRng('crane'));
    E.applyMove(m, 'X', 'slate', seq(0.5));
    const rO = E.applyMove(m, 'O', 'bloom', seq(0.5)), fO = E.raceFlashHide(flashOf(m, 'O', 'bloom', rO), m);
    const mine = E.raceView(m, 'X');
    assert.deepEqual(Object.keys(mine.side), ['X']); assert.deepEqual(mine.shape.O.rows, ['xxxxx']);
    const html = screen(mine, fO);
    assert.match(html, /class="wt x">S<\/i>/, 'my own letters'); assert.doesNotMatch(html, /BLOOM|>B<\/i>|>M<\/i>/, "none of O's letters");
    assert.doesNotMatch(html, /CRANE/, 'never the word');
    assert.match(html, /class="wopp fresh"/, "the other side's reserved line, their move fresh"); assert.match(html, /class="wrs wnew"><i class="x" style="--k:0"><\/i>/, 'their new row turns, as colours');
    assert.match(html, /Olaf guessed · nothing right/);
    assert.equal((html.match(/class="wrs off"/g) || []).length, 4, 'the guesses they have left, as empty strips: the line never grows');
    assert.match(html, /Olaf<\/b><i class="hpips O"[^>]*><i class="on"><\/i><i class="on"><\/i><i class="on"><\/i><i class="on"><\/i><i class=""><\/i>/, 'their guesses left, from their shape');
    assert.doesNotMatch(screen(mine, null), /class="wrs wnew"/, 'nothing turns at a plain render');
    assert.match(screen(E.raceView(E.newMini('wordle', wordRng('crane')), 'X'), null), /Your guesses are yours alone/);
    assert.equal(view.moveText(fO, 'Olaf'), 'Olaf guessed · nothing right');
    const rX = E.applyMove(m, 'X', 'crony', seq(0.5)), fX = flashOf(m, 'X', 'crony', rX);
    assert.equal(view.moveText(fX, 'Xena'), 'Xena tried CRONY');
    assert.equal(view.moveText(Object.assign({}, fO, { race: { by: 'O', row: 'ggxgx', n: 2, left: 3, rows: ['xxxxx', 'ggxgx'] } }), 'Olaf'), 'Olaf guessed · 3 green');
    assert.equal(view.moveText(Object.assign({}, fO, { race: { by: 'O', row: 'gyxxx', n: 5, left: 0, rows: [] } }), 'Olaf'), 'Olaf guessed · 1 green, 1 yellow · out of guesses');
    // the sounds of their move come from its colours; my own from my row
    const snd = [], add = (n, at) => snd.push([n, at]);
    view.sounds(fO, add, false, mine, null); assert.deepEqual(snd.map(s => s[0]), ['tileX', 'tileX', 'tileX', 'tileX', 'tileX']);
    snd.length = 0; view.sounds(fX, add, false, E.raceView(m, 'X'), null); assert.deepEqual(snd.map(s => s[0]), ['tileG', 'tileG', 'tileX', 'tileG', 'tileX']);
    // a finished square: both players' rows, revealed
    const done = screen(m, null, { owner: 'X', view: true });
    assert.match(done, /BLOOM|>B<\/i>/); assert.match(done, />S<\/i>/); assert.doesNotMatch(done, /class="wopp/);
  } finally { raceOn(false); }
});

test('Five Letters, race: the miniature from the board\'s view shows both players\' rows of colours, no letters; Shared is as ever', () => {
  raceOn(true);
  try {
    const m = E.newMini('wordle', wordRng('crane'));
    E.applyMove(m, 'X', 'slate', seq(0.5)); E.applyMove(m, 'O', 'crony', seq(0.5));
    const html = view.miniature(E.raceView(m, null), false);
    assert.match(html, /class="tw trace"/); assert.doesNotMatch(html, /[A-Z]<\/i>/, 'no letters'); assert.doesNotMatch(html, /SLATE|CRONY|CRANE/);
    assert.match(html, /<b class="X">X<\/b><span class="twqs"><div class="twr tws"><i class="x"><\/i><i class="x"><\/i><i class="g"><\/i><i class="x"><\/i><i class="g"><\/i><\/div><\/span>/);
    assert.match(html, /<b class="O">O<\/b><span class="twqs"><div class="twr tws"><i class="g"><\/i><i class="g"><\/i><i class="x"><\/i><i class="g"><\/i><i class="x"><\/i><\/div><\/span>/);
    assert.equal(view.miniature(E.raceView(m, null), false), view.miniature(E.raceView(m, 'X'), false), 'the same from a side\'s view');
    const hidden = JSON.parse(JSON.stringify(m)); E.hideMini(hidden, 0, {});
    assert.equal(view.miniature(E.raceView(hidden, null), false), html, 'the same from the square as the other phone has it');
    assert.match(view.miniature(m, true), />S<\/i>|>C<\/i>/, 'a finished square: the letters');
  } finally { raceOn(false); }
  const s = E.newMini('wordle', wordRng('crane')); E.applyMove(s, 'X', 'slate', seq(0.5));
  assert.match(view.miniature(s, false), />S<\/i>/); assert.doesNotMatch(view.miniature(s, false), /trace/);
});

test('Five Letters, race: the header\'s line for the other side\'s move is redacted even from the move as made (the turn bar reads state.flash itself)', () => {
  raceOn(true);
  try {
    const m = E.newMini('wordle', wordRng('crane'));
    const rO = E.applyMove(m, 'O', 'bloom', seq(0.5)), raw = flashOf(m, 'O', 'bloom', rO);
    state.squares = [{ owner: null, mini: m }];
    assert.equal(view.moveText(raw, 'Olaf'), 'Olaf guessed · nothing right');
    const rX = E.applyMove(m, 'X', 'slate', seq(0.5));
    assert.equal(view.moveText(flashOf(m, 'X', 'slate', rX), 'Xena'), 'Xena tried SLATE', 'my own, as made');
  } finally { raceOn(false); state.squares = []; }
});
