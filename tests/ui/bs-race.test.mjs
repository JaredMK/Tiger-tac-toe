// Race mode on the page (core/race.js), Sea Battle: the square's screen shows this phone's own sea and only the other side's
// shape (hits and misses as counts, their ship's parts filled in); the other side's shot arrives redacted and lands on no
// cell of this sea; the board's miniature shows both shapes and no cell; a finished square reviewed shows both players'
// shots. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { renderBoard } = await import('../../src/ui/board.js');
const { explainOf } = await import('../../src/ui/explainer.js');
const V = await import('../../src/games/bs/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.bs.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch() {
  E.setTune('bs', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('bs-race'), { games: ['bs'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('bs', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const notShip = (m, k = 0) => { let c = k; while (m.ship.includes(c)) c++; return c; };
const cells = html => html.match(/<button class="cell[\s\S]*?<\/button>/g) || [];
const cellAt = (html, i) => cells(html).find(c => c.includes(`data-m='${i}'`));
const rowOf = (html, p) => { const at = html.indexOf(`<div class="bsrr ${p}`); return html.slice(at, html.indexOf('</div>', at)); };

test('race: the screen draws this side\'s own sea alone; the computer\'s shots are counts in its row, never cells', () => {
  const m = raceMatch(), rng = E.makeRng('s');
  const oMiss = notShip(m), oMiss2 = notShip(m, oMiss + 1), xMiss = notShip(m, oMiss2 + 1);
  E.applyMove(m, 'O', oMiss, rng); E.applyMove(m, 'O', oMiss2, rng); if (m.len > 1) E.applyMove(m, 'O', m.ship[0], rng);   // the computer's shots (its own sea)
  E.applyMove(m, 'X', xMiss, rng);                                                                                   // ours
  state.turn = 'X';
  const html = renderMini(state.squares[0]);
  assert.equal(cells(html).length, 16);
  assert.match(cellAt(html, xMiss), /class="cell sea miss/, 'our miss on our sea'); assert.match(cellAt(html, xMiss), /bsby X/);
  for (const i of [oMiss, oMiss2, m.ship[0]]) if (i !== xMiss) { assert.doesNotMatch(cellAt(html, i), /miss|bshit|disabled/, `the computer's cell ${i} is untouched on our sea`); }
  assert.doesNotMatch(html, /bsby O/, 'no dot of theirs');
  assert.equal((html.match(/class="cell sea (miss|bshit)/g) || []).length, 1, 'one shot on this sea: ours');
  assert.match(html, /class="bsship bsrace/, 'the race card');
  const oRow = rowOf(html, 'O');
  assert.match(oRow, new RegExp(`<span class="bsmiss"><i></i>2</span>`), "the computer's misses as a count");
  assert.equal((oRow.match(/class="hull hit"/g) || []).length, m.len > 1 ? 1 : 0, "the computer's hits as the ship's parts");
  const xRow = rowOf(html, 'X');
  assert.match(xRow, /<span class="bsmiss"><i><\/i>1<\/span>/);
  assert.doesNotMatch(html, /Hunting/, 'no shared card');
});

test('race: the computer\'s shot is redacted on this phone (no cell lit, no burst), shown in its row as hit or miss; the sounds say hit or miss alone', async () => {
  const m = raceMatch();
  state.turn = 'O';
  const r = E.playMove(state, 0, m.ship[0], E.makeRng('c'));
  assert.ok(r.ok);
  assert.ok(state.flash.hit === true && state.flash.m === m.ship[0], 'the full flash is on the state (the computer played here)');
  const html = renderMini(state.squares[0]);
  assert.doesNotMatch(html, /flipin/, 'no cell of ours animates for their shot');
  assert.doesNotMatch(html, /class="cell sea bshit/, 'no burst on our sea');
  assert.doesNotMatch(html, /bsby O/);
  assert.match(rowOf(html, 'O'), /^<div class="bsrr O live/, "the computer's row lights"); assert.match(rowOf(html, 'O'), /<em class="bssay">(Hit|Sunk)!<\/em>/, 'and says Hit!');
  assert.match(rowOf(html, 'X'), /<em class="bssay"><\/em>/, 'our row says nothing');
  const { moveSounds } = await import('../../src/audio/sound.js');
  const names = moveSounds(state.flash).map(s => s[0]);
  assert.ok(names.includes('fire') && names.includes('boom'), `a hit is heard: ${names}`);
  assert.equal(V.moveText(E.raceFlashHide(state.flash, m), 'Computer'), 'Computer hit!');
  // a miss of theirs
  state.flash = null; state.lock = null; state.turn = 'O';
  const r2 = E.playMove(state, 0, notShip(m), E.makeRng('c2'));
  assert.ok(r2.ok);
  const html2 = renderMini(state.squares[0]);
  assert.match(rowOf(html2, 'O'), /<em class="bssay">Miss!<\/em>/);
  assert.doesNotMatch(html2, /class="cell sea miss/, 'no splash on our sea');
  assert.equal(V.moveText(E.raceFlashHide(state.flash, m), 'Computer'), 'Miss!');
});

test('race: the miniature shows both players\' shapes and no cell; the explainer is the Race one while the mode is on; a finished square reviewed shows both seas', () => {
  const m = raceMatch(), rng = E.makeRng('mm');
  const oMiss = notShip(m), xMiss = notShip(m, oMiss + 1);
  E.applyMove(m, 'O', oMiss, rng); E.applyMove(m, 'X', xMiss, rng); if (m.len > 1) E.applyMove(m, 'X', m.ship[0], rng);
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /tbs tbrace/); assert.doesNotMatch(sq, /class="tg g4 sea/, 'no sea grid: the cells are private');
  assert.match(sq, /<div class="tr X"[^>]*><b class="X">X<\/b>(<i class="psq( on)?"><\/i>)+<span class="tbm">1<\/span>/, "X's hits as parts and misses as a count");
  assert.match(sq, /<div class="tr O"[^>]*><b class="O">O<\/b>(<i class="psq"><\/i>)+<span class="tbm">1<\/span>/);
  if (m.len > 1) assert.match(sq, /class="tr X"[^>]*><b class="X">X<\/b><i class="psq on">/);
  assert.match(sq, /<svg viewBox="0 20/, 'the ship drawn');
  // the view's own miniature from the public view: shapes only
  const pub = E.raceView(m, null);
  assert.equal(pub.side.X, undefined); assert.match(V.miniature(pub, false), /tbrace/);
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('bs').play, /yours alone/, 'the Race explainer in an open race square');
  // a finished square reviewed: both players' shots on the one sea, the ship shown
  for (const c of m.ship) if (!m.side.X.hits.includes(c)) E.applyMove(m, 'X', c, rng);
  state.squares[0].owner = 'X'; state.flash = null; state.done = null;
  const review = renderMini(state.squares[0]);
  assert.match(cellAt(review, oMiss), /class="cell sea miss/, "the computer's miss shows now"); assert.match(cellAt(review, oMiss), /bsby O/);
  assert.match(cellAt(review, xMiss), /bsby X/);
  assert.equal((review.match(/class="cell sea ship X/g) || []).length, m.len, 'the ship, in the winner\'s colour');
  assert.match(review, /Won by/);
  assert.match(review, new RegExp(`<div class="bsrr X sunk" aria-label="Xena: ${m.len} hit${m.len === 1 ? '' : 's'}, 1 miss"`), "the review's card counts from each side's part (a full square carries no shapes)");
  assert.match(review, /<div class="bsrr O" aria-label="Computer: 0 hits, 1 miss"/);
  state.squares[0].mini.race = false; delete state.squares[0].mini.side; state.squares[0].owner = null;
  assert.doesNotMatch(explainOf('bs').play, /yours alone/, 'a shared square: the usual one');
});
