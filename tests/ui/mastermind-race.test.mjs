// Race mode on the page (core/race.js), Codebreaker: the square's screen shows this phone's own guesses and only the other
// side's shape (each row's markers in their strip under the code, never their pegs); the other side's guess arrives redacted
// and is shown as a new marker block; the board's miniature shows both shapes and no peg; a finished square reviewed shows
// both players' guesses. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle', 'performance']) {
  try { Object.defineProperty(globalThis, k, { value: k === 'performance' ? { now: () => 0 } : stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { renderBoard } = await import('../../src/ui/board.js');
const { explainOf } = await import('../../src/ui/explainer.js');
const V = await import('../../src/games/mastermind/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.mastermind.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch() {
  E.setTune('mastermind', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('mm-race'), { games: ['mastermind'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('mastermind', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const rows = html => html.match(/<div class="mmrow[\s\S]*?<\/div>/g) || [];
const rowPegs = row => (row.match(/class="peg c(\d)/g) || []).map(x => Number(x.slice(-1)));   // the pegs of a row, in order
const hasRow = (html, code) => rows(html).some(r => JSON.stringify(rowPegs(r)) === JSON.stringify(code));

test('race: the screen draws this side\'s own guesses; the computer\'s are marker blocks in its strip, their pegs never', () => {
  const m = raceMatch(), rng = E.makeRng('s'), code = m.code;
  const oG1 = [code[1], code[0], code[2], code[3]], oG2 = [code[3], code[2], code[1], code[0]], xG = [code[0], code[1], code[3], code[2]];
  E.applyMove(m, 'O', oG1, rng); E.applyMove(m, 'O', oG2, rng);   // the computer's guesses (its own part)
  E.applyMove(m, 'X', xG, rng);                                   // ours
  state.turn = 'X';
  const html = renderMini(state.squares[0]);
  assert.equal(rows(html).length, 1, 'one row: ours'); assert.match(rows(html)[0], /mmby X/);
  assert.deepEqual(rowPegs(rows(html)[0]), xG, 'our pegs');
  assert.ok(!hasRow(html, oG1) && !hasRow(html, oG2), "the computer's guesses are in no row");
  assert.equal((html.match(/class="peg c\d/g) || []).length, 4 + 6, 'pegs on the screen: our row and the palette alone');
  assert.doesNotMatch(html, /class="mmrow[^"]*"><span class="mmby O"/, 'no row of theirs');
  const strip = html.slice(html.indexOf('<div class="mmrace'), html.indexOf('<div class="mmlist'));
  assert.match(strip, /<span class="mmby O">/);
  assert.equal((strip.match(/class="mmfb mmob"/g) || []).length, 2, 'a marker block per guess of theirs');
  assert.match(strip, /aria-label="2 solid, 2 hollow"/, "their first row's markers"); assert.match(strip, /aria-label="0 solid, 4 hollow"/);
  assert.doesNotMatch(strip, /class="peg/, 'no peg in the strip');
  assert.match(strip, /2 guesses/);
  assert.doesNotMatch(html, /No guesses yet/);
});

test('race: the computer\'s guess is redacted on this phone (no pegs, no row), shown as a lit marker block; the sounds count its markers', async () => {
  const m = raceMatch(), code = m.code, g = [code[1], code[0], code[2], code[3]];
  state.turn = 'O';
  const r = E.playMove(state, 0, g, E.makeRng('c'));
  assert.ok(r.ok);
  assert.deepEqual(state.flash.code, g, 'the full flash is on the state (the computer played here)');
  const html = renderMini(state.squares[0]);
  assert.equal(rows(html).length, 0, 'no row for their guess');
  assert.equal((html.match(/class="peg c\d/g) || []).length, 6, 'the palette\'s pegs alone: theirs are nowhere');
  assert.doesNotMatch(html, /mmrow fresh/, 'no row of ours animates');
  assert.match(html, /<div class="mmrace live"/, 'the strip lights');
  assert.match(html, /class="mmfb mmob fresh" role="img" aria-label="2 solid, 2 hollow"/, 'the new block, its markers');
  assert.match(html, /<i class="sd rv" style="--k:0">/, 'the markers animate in');
  assert.match(html, /2 solid · 2 hollow/);
  const { moveSounds } = await import('../../src/audio/sound.js');
  const names = moveSounds(state.flash).map(s => s[0]);
  assert.equal(names.filter(n => n === 'marker').length, 4, `four markers heard: ${names}`);
  assert.equal(V.moveText(E.raceFlashHide(state.flash, m), 'Computer'), 'Computer: 2 solid · 2 hollow');
});

test('race: the miniature shows both players\' markers and no peg; the explainer is the Race one while the mode is on; a finished square reviewed shows both players\' guesses', () => {
  const m = raceMatch(), rng = E.makeRng('mm'), code = m.code;
  const oG = [code[1], code[0], code[2], code[3]], xG = [code[3], code[2], code[1], code[0]];
  E.applyMove(m, 'O', oG, rng); E.applyMove(m, 'X', xG, rng);
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /tmm tmrace/); assert.doesNotMatch(sq, /class="c\d"/, 'no coloured peg');
  assert.match(sq, /<div class="tmr tmo X"><b class="X">X<\/b><span class="mmfb tiny" role="img" aria-label="0 solid, 4 hollow">/);
  assert.match(sq, /<div class="tmr tmo O"><b class="O">O<\/b><span class="mmfb tiny" role="img" aria-label="2 solid, 2 hollow">/);
  const pub = E.raceView(m, null);
  assert.equal(pub.side.X, undefined); assert.match(V.miniature(pub, false), /tmrace/); assert.doesNotMatch(V.miniature(pub, false), /class="c\d"/);
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('mastermind').play, /yours alone/, 'the Race explainer in an open race square');
  // a finished square reviewed: both players' guesses, the code open
  E.applyMove(m, 'X', code, rng);
  state.squares[0].owner = 'X'; state.flash = null; state.done = null;
  const review = renderMini(state.squares[0]);
  assert.equal(rows(review).length, 3, "X's two and O's one");
  assert.ok(hasRow(review, oG), "the computer's guess shows now"); assert.ok(hasRow(review, xG) && hasRow(review, code));
  assert.match(review, /mmby O/); assert.match(review, /mmcode small cracked/); assert.doesNotMatch(review, /class="mmrace/, 'no strip when looking back');
  assert.match(review, /Won by/);
  state.squares[0].mini.race = false; delete state.squares[0].mini.side; state.squares[0].owner = null;
  assert.doesNotMatch(explainOf('mastermind').play, /yours alone/, 'a shared square: the usual one');
});
