// Race mode on the page (core/race.js, rv 2), Codebreaker: the square shows this phone's own code, guesses and controls
// large and the other player's code (hidden until the square ends) and latest rows, pegs and markers, small under it
// (ui/race.js raceBoards); their guess lands there from its flash; the board's miniature draws each player's best row's
// markers; a finished square reviewed shows both codes. Rendered in Node with the browser's names stubbed.
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
  Object.assign(state, E.newMatch(E.makeRng('mm-race'), { games: ['mastermind'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', lock: null });
  E.setTune('mastermind', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const rows = html => html.match(/<div class="mmrow[\s\S]*?<\/div>/g) || [];
const rowPegs = row => (row.match(/class="peg c(\d)/g) || []).map(x => Number(x.slice(-1)));   // the pegs of a row, in order
const hasRow = (html, code) => rows(html).some(r => JSON.stringify(rowPegs(r)) === JSON.stringify(code));
const mine = html => { const a = html.indexOf('<div class="rmain">'), b = html.indexOf('<div class="ropp'); return html.slice(a, b); };
const theirs = html => html.slice(html.indexOf('<div class="ropp'));
const oppRows = html => theirs(html).match(/<div class="mmor(?! mmocode)[^"]*">[\s\S]*?<\/span><\/div>/g) || [];
const wrongOf = code => { const g = code.slice(); [g[0], g[1]] = [g[1], g[0]]; return g; };

test('race: two boards: our code hidden, our guesses and controls large; the computer\'s code hidden and its rows (pegs and markers) small', () => {
  const m = raceMatch(), rng = E.makeRng('s');
  const xg = wrongOf(m.tg.X), og = [0, 1, 2, 3], og2 = [5, 4, 3, 2];
  E.applyMove(m, 'O', og, rng); E.applyMove(m, 'O', og2, rng); E.applyMove(m, 'X', xg, rng);
  const html = renderMini(state.squares[0]);
  assert.match(html, /class="rboards mmrb"/);
  assert.ok(hasRow(mine(html), xg), 'our guess with its pegs'); assert.equal(rows(mine(html)).length, 1, 'ours alone on our board');
  assert.match(mine(html), /data-act="mmcol"/); assert.match(mine(html), /Submit guess/);
  const or = oppRows(html);
  assert.equal(or.length, 2, 'their two rows');
  assert.deepEqual(rowPegs(or[0]), og); assert.deepEqual(rowPegs(or[1]), og2, 'their pegs, in order');
  assert.match(or[0], /aria-label="\d solid, \d hollow"/, 'their markers');
  assert.equal((theirs(html).match(/class="mmor none"/g) || []).length, 1, 'a blank row keeps the box\'s shape');
  assert.equal((html.match(/class="peg hid"/g) || []).length, 8, 'both codes hidden');
  assert.match(theirs(html), /class="rnote">2 guesses</);
  assert.doesNotMatch(theirs(html), /data-act/, 'their board is read-only');
  assert.doesNotMatch(html, /left|limit/i, 'no guesses-left count');
});

test('race: the computer\'s guess pops in on its small board from its flash; ours on ours; the sounds count the markers', async () => {
  const m = raceMatch();
  state.turn = 'O';
  const g = wrongOf(m.tg.O);
  assert.ok(E.playMove(state, 0, g, E.makeRng('c')).ok);
  const html = renderMini(state.squares[0]);
  const or = oppRows(html);
  assert.match(or[or.length - 1], /class="mmor fresh"/); assert.match(or[or.length - 1], /peg c\d in/);
  assert.doesNotMatch(mine(html), /mmrow fresh/, 'nothing new on our board');
  const { moveSounds } = await import('../../src/audio/sound.js');
  assert.equal(moveSounds(state.flash).filter(s => s[0] === 'marker').length, 4, '2 solid and 2 hollow');
  assert.equal(V.moveText(state.flash, 'Computer'), 'Computer: 2 solid · 2 hollow');
  state.flash = null; state.done = null; state.lock = null; state.turn = 'X';
  const rx = E.playMove(state, 0, [0, 1, 2, 3], E.makeRng('x')); assert.ok(rx.ok, rx.reason);
  const h2 = renderMini(state.squares[0]);
  assert.match(mine(h2), /mmrow fresh/); assert.doesNotMatch(theirs(h2), /mmor fresh/);
});

test('race: the miniature draws each player\'s best row\'s markers, the same from the hidden square; the Race explainer', async () => {
  const m = raceMatch(), rng = E.makeRng('mm');
  E.applyMove(m, 'X', [0, 1, 2, 3], rng); E.applyMove(m, 'X', wrongOf(m.tg.X), rng);
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /class="trace2 tmmr"/);
  const tiles = sq.split('<div class="trp ').slice(1);
  assert.equal(tiles.length, 2);
  assert.match(tiles[0], /<svg class="mmbest X"/); assert.match(tiles[1], /<svg class="mmbest O"/);
  assert.equal((tiles[0].match(/class="sd"/g) || []).length, 2, "X's best row: 2 solid"); assert.equal((tiles[0].match(/class="hw"/g) || []).length, 2, '2 hollow');
  assert.equal((tiles[1].match(/class="no"/g) || []).length, 4, 'O: nothing yet');
  const { hideMini } = await import('../../src/core/records.js');
  const hidden = JSON.parse(JSON.stringify(m)); hideMini(hidden, 0, state);
  assert.equal(V.miniature(hidden, false), V.miniature(m, false), 'public information only');
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('mastermind').play, /your own hidden/, 'the Race explainer in an open race square');
});

test('race: a finished square reviewed shows both codes; an old race square still draws', () => {
  const m = raceMatch(), rng = E.makeRng('e');
  E.applyMove(m, 'O', [0, 1, 2, 3], rng); E.applyMove(m, 'X', m.tg.X, rng);
  state.squares[0].owner = 'X'; state.flash = null; state.done = null;
  const review = renderMini(state.squares[0]);
  assert.match(review, /Won by/);
  assert.doesNotMatch(review, /class="peg hid"/, 'both codes open');
  assert.match(mine(review), /mmcode small cracked/); assert.match(theirs(review), /mmor mmocode cracked/);
  assert.match(V.miniature(m, true), /mmbest X done/);
  const old = { type: 'mastermind', race: true, shape: { X: { n: 1, rows: [[1, 1]] }, O: {} }, side: { X: { guesses: [] } } };
  state.squares[0] = { owner: null, mini: old };
  assert.doesNotThrow(() => renderMini(state.squares[0])); assert.doesNotThrow(() => V.miniature(old, false));
});
