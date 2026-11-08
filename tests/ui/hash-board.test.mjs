// The # board (November 2026): every board picture is a classic tic-tac-toe grid drawn by ui/hash.js (four bold
// hand-drawn strokes with round ends, no boxes or outer frame): the main board and its review, the result screen's
// final board, the history snapshot, the share card (canvas) and the link-preview image (scripts/make-share-images.js).
// Each space stays its whole button; highlights are glows in the space, never a square border.
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
const H = await import('../../src/ui/hash.js');
const { state } = await import('../../src/ui/app.js');
const { renderBoard } = await import('../../src/ui/board.js');
const { renderWin } = await import('../../src/ui/screens/win.js');
const CSS = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
const ROOT = new URL('../../', import.meta.url);

test('the #: four strokes, two upright near a third and two thirds, two across, ends short of the edges', () => {
  assert.equal(H.HASH.length, 4);
  for (const [k, seg] of H.HASH.entries()) {
    const ax = k < 2 ? 1 : 0, line = k % 2 ? 200 : 100;
    for (const p of seg) { assert.ok(Math.abs(p[1 - ax] - line) <= 6, `stroke ${k} keeps to its line`); assert.ok(p[ax] >= 5 && p[ax] <= 295, 'inside the box'); }
  }
  assert.equal((H.hashD().match(/M/g) || []).length, 4);
  assert.match(H.hashSvg('hash', 8), /stroke-linecap="round"/, 'round ends');
  const calls = []; H.hashPath({ beginPath() { calls.push('b'); }, moveTo() { calls.push('m'); }, bezierCurveTo() { calls.push('c'); } }, 0, 0, 300);
  assert.deepEqual(calls.join(''), 'bmcmcmcmc', 'the canvas draws the same four strokes');
});

test('the main board: nine full-size buttons under one #, no gap, no box, no frame', () => {
  Object.assign(state, E.newMatch(E.makeRng('hash-board'), { games: ['ttt', 'c4', 'hilo'] }), { screen: 'board', zoom: null, cpu: null, sc: null, flash: null, done: null, spot: null, winner: null, online: null });
  state.squares[0].owner = 'X'; state.lastSquare = 3; state.lastBy = 'O';
  const html = renderBoard();
  const board = html.slice(html.indexOf('<div class="board">'), html.indexOf('<div class="foot'));
  assert.equal((board.match(/<button class="sq/g) || []).length, 9, 'each space is a button');
  assert.equal((board.match(/class="hash"/g) || []).length, 1, 'one # over the spaces');
  assert.match(renderBoard(true), /class="hash"/, 'the review board too');
  const tail = CSS.slice(CSS.indexOf('/* ===== The # board'));
  assert.match(tail, /\.board \{ gap: 0; \}/, 'no gap: the spaces meet under the lines');
  assert.match(tail, /\.board \.sq \{ background: transparent; border: 0; border-radius: 0; box-shadow: none;/, 'no box around a space');
  assert.match(tail, /\.board > \.hash \{[^}]*pointer-events: none/, 'the lines never take a tap');
  assert.match(tail, /\.board \.sq\.spot::before/, "the opponent's square glows in its space");
  assert.match(tail, /\.board \.sq\.last-X::before/, 'the last-played square too');
});

test('the final board, the history snapshot, the share card and the preview image draw the same #', () => {
  Object.assign(state, { winner: 'X', winLine: [0, 4, 8], winReason: 'line', screen: 'win' });
  for (const i of [0, 4, 8]) state.squares[i].owner = 'X';
  assert.match(renderWin(), /<div class="final"[^>]*>(?:(?!<\/div>).)*class="hash"/s, 'the result screen');
  assert.match(fs.readFileSync(new URL('src/ui/screens/profile.js', ROOT), 'utf8'), /hashSvg\('hash'/, 'the history snapshot');
  const card = fs.readFileSync(new URL('src/ui/sharecard.js', ROOT), 'utf8');
  assert.match(card, /hashPath\(ctx, left, top, size\)/, 'the share card');
  assert.doesNotMatch(card.slice(card.indexOf('// the board:'), card.indexOf('// both names')), /box\(ctx/, 'no boxes on the share card');
  assert.match(fs.readFileSync(new URL('scripts/make-share-images.js', ROOT), 'utf8'), /hashSvg\('hash'/, 'the link-preview image');
});
