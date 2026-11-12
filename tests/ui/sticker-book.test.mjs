// The Sticker book (December 2026; src/ui/stickers.js, stickers.css): the menus' look.
//   the main menu: a sticker for each way to play with its line, Find Match a small "soon" tag while off, round stickers;
//   the results: the one big action (Rematch) before the round stickers (the board, the menu, Share), the facts as notes;
//   Play Computer: the real X and O facing off, one pen ring per choice, Start the one big sticker;
//   the menu sounds: paper slap, pencil tick, peel, the Start stinger, each a sound and listed in SOUNDS.md;
//   every control 44 px or more, and pressed it sinks.
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const MM = await import('../../src/net/matchmaking.js');
const { renderMenu } = await import('../../src/ui/screens/menu.js');
const { renderSetup } = await import('../../src/ui/screens/setup.js');
const { renderWin } = await import('../../src/ui/screens/win.js');
const { SFX, bookSound } = await import('../../src/audio/sound.js');
const { state } = await import('../../src/ui/app.js');
const ROOT = new URL('../../', import.meta.url);
const CSS = fs.readFileSync(new URL('src/ui/stickers.css', ROOT), 'utf8');
const board = () => E.newMatch(E.makeRng('sb'), { games: ['ttt'] });

test('the stylesheet is the page\'s, after the main one', () => {
  const page = fs.readFileSync(new URL('index.html', ROOT), 'utf8');
  assert.ok(page.indexOf('src/ui/stickers.css') > page.indexOf('src/ui/styles.css'));
});

test('the main menu: a sticker for each way to play, each with its line; Find Match a small "soon" tag while off; round stickers', () => {
  Object.assign(state, board(), { screen: 'menu', online: null });
  MM.setFindOn(true);
  let html = renderMenu();
  assert.match(html, /<main class="scr menu sb">/);
  for (const [act, b] of [['cpu-go', 'Play Computer'], ['friend-go', 'Play a Friend'], ['find-go', 'Find Match']]) assert.match(html, new RegExp(`class="stk mode[^"]*" data-act="${act}"[^>]*><b>${b}</b><small>[^<]+</small>`), b);
  assert.match(html, /class="stkr" data-act="howto"/); assert.match(html, /class="stkr" data-act="settings"/);
  MM.setFindOn(false);
  html = renderMenu();
  assert.match(html, /class="stk soon[^"]*" data-act="find-go"[^>]* disabled[^>]*>Find Match<small>soon<\/small>/);
  assert.doesNotMatch(html, /Not available/);
  MM.setFindOn(true);
});

test('the results: the one big action first, then the board, the menu and Share as round stickers; the facts as notes', () => {
  Object.assign(state, board(), { screen: 'win', online: null, cpu: 'O', winner: 'X', winLine: [0, 4, 8], winReason: 'line' });
  for (const i of [0, 4, 8]) state.squares[i].owner = 'X';
  state.squares[2].owner = 'O';
  const html = renderWin();
  assert.match(html, /<main class="scr win-scr sb win">/);
  const big = html.indexOf('data-act="rematch"'), rounds = ['review', 'menu', 'share-result'].map(a => html.indexOf(`data-act="${a}"`));
  assert.ok(big > 0 && rounds.every(i => i > big), 'Rematch before the round stickers');
  assert.match(html, /class="stk mode m-again" data-act="rematch"[^>]*><b>Rematch<\/b>/);
  assert.match(html, /<p class="fact why"[^>]*>Three in a row<\/p><p class="fact fsq"[^>]*>3 squares to 1<\/p>/);
  assert.match(html, /<div class="cel win"/, 'the celebration');
  assert.doesNotMatch(html, /class="[^"]*\bsq\b/, 'no board-tile class on the results');
});

test('Play Computer: the X and O facing off, one pen ring for each choice, Start the one big sticker', () => {
  Object.assign(state, board(), { screen: 'setup', online: null });
  state.setup.vs = 'cpu'; state.setup.vsCpu = null;
  for (const t of E.TYPES) state.setup.games[t] = true;
  let html = renderSetup();
  assert.match(html, /<main class="scr setup sb cpuset">/);
  assert.match(html, /class="vsface rflip"[^>]*><svg class="pc pX"[^]*?<svg class="pc pO"/, 'Random: both characters, taking turns');
  assert.equal((html.match(/class="penh"/g) || []).length, 2, 'one ring for the side, one for the level');
  assert.match(html, /data-act="cside" data-side="random" aria-pressed="true">Random<span class="penh"/);
  assert.match(html, /class="stk mode m-start" data-act="start"[^>]*><b>Start!<\/b>/);
  state.setup.vsCpu.pick = 'O';
  html = renderSetup();
  assert.match(html, /<div class="vsme"><span class="vsface"><svg class="pc pO"[^]*?<b>You<\/b>/, 'your side: O');
  assert.match(html, /<i class="vsv"[^>]*>vs<\/i><div class="vsme"><span class="vsface"><svg class="pc pX"/, 'the computer: X');
  state.setup.vs = 'same';
});

test('the menu sounds: the stinger, the peel, the pencil and the paper slap, each a sound listed in SOUNDS.md', () => {
  const md = fs.readFileSync(new URL('SOUNDS.md', ROOT), 'utf8');
  for (const n of ['paperSlap', 'pencilTick', 'peel', 'startSting']) { assert.ok(SFX[n], `${n} is a sound`); assert.ok(md.includes('`' + n + '`'), `${n} in SOUNDS.md`); }
  const el = (cls = '') => ({ classList: { contains: c => cls.split(' ').includes(c) } });
  assert.equal(bookSound(el('stk mode'), 'start'), 'startSting'); assert.equal(bookSound(el(), 'rematch'), 'startSting');
  assert.equal(bookSound(el('back'), 'menu'), 'peel'); assert.equal(bookSound(el('stkr'), 'leave'), 'peel');
  assert.equal(bookSound(el('opt on'), 'clevel'), 'pencilTick');
  assert.equal(bookSound(el('stk mode'), 'cpu-go'), 'paperSlap'); assert.equal(bookSound(el('stkr'), 'settings'), 'paperSlap');
});

test('every sticker control is 44 px or more and sinks when pressed', () => {
  const px = (sel, prop) => { const m = new RegExp(sel.replace(/[.()]/g, '\\$&') + ' \\{[^}]*' + prop + ': (?:clamp\\()?(\\d+)px').exec(CSS); return m ? Number(m[1]) : 0; };
  assert.ok(px('.sb .stkr', 'min-height') >= 44 && px('.sb .stkr', 'min-width') >= 44, 'a round sticker with its caption');
  assert.ok(px('.sb .mode', 'height') >= 44, 'a mode sticker');
  assert.ok(px('.sb button.soon', 'height') >= 44, 'the soon tag');
  assert.ok(px('.sb .opt', 'min-height') >= 44 && px('.sb .opt', 'min-width') >= 44, 'an option');
  assert.ok(px('.sb .bar .back', 'height') >= 44, 'the back sticker');
  for (const sel of ['.sb button.stk:active', '.sb .stkr:active .stk', '.sb .opt:active', '.sb .bar .back:active']) assert.ok(CSS.includes(sel), `${sel}: a pressed state`);
});
