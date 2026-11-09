// Race mode on the page for Patterns (core/race.js, rv: 2): the square draws two boards, this phone's own large (its own
// puzzle, options, cross-outs, score) and the other player's small (their score as pips, their puzzle and its options small
// with their cross-outs, never the right one while open); the other side's move plays on their board from its flash; the
// miniature is a picture of both players' progress; a claimed square shows both boards with the right options; the
// explainer swaps to the Race one while the mode is on.
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
const V = await import('../../src/games/patterns/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.patterns.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch() {
  E.setTune('patterns', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('patterns-race'), { games: ['patterns'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('patterns', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const wrongOf = (m, p) => [0, 1, 2, 3].filter(k => k !== m.tg[p] && !m.side[p].crossed.includes(k));
const mainOf = html => html.slice(html.indexOf('class="rmain"'), html.indexOf('class="ropp'));
const oppOf = html => html.slice(html.indexOf('class="ropp'));

test('race: two boards; ours our own puzzle with four options to pick; theirs small with their own puzzle; no right option marked', () => {
  const m = raceMatch();
  const html = renderMini(state.squares[0]);
  assert.match(html, /class="rboards trqb"/); assert.match(html, /class="ropp O"/);
  assert.equal((mainOf(html).match(/class="popt"/g) || []).length, 4, 'four options to pick');
  assert.match(mainOf(html), /Your turn · 4 options left/);
  assert.equal((oppOf(html).match(/class="ptqo"/g) || []).length, 4, 'their four options, small');
  assert.match(oppOf(html), /ptqit gap/, 'their gap');
  assert.doesNotMatch(html, /popt right|ptqo right/, 'no right option marked while open');
  assert.notEqual(JSON.stringify(m.side.X.puz), JSON.stringify(m.side.O.puz));
});

test('race: the other side\'s move plays on their board from its flash; our board untouched; their cross-outs stay on their card', async () => {
  const m = raceMatch();
  state.turn = 'O';
  assert.equal(E.playMove(state, 0, wrongOf(m, 'O')[0], E.makeRng('d')).ok, true);
  let html = renderMini(state.squares[0]);
  assert.match(oppOf(html), /class="ptqo wrong late"/, 'their pick, struck when it comes');
  assert.match(mainOf(html), /got it wrong/, 'the result in our reserved line');
  assert.doesNotMatch(mainOf(html), /popt (out|wrong|right)/, 'nothing on our card');
  const { moveSounds } = await import('../../src/audio/sound.js');
  assert.ok(moveSounds(state.flash).map(s => s[0]).includes('thud'));
  E.endFlash(state); state.turn = 'X';
  html = renderMini(state.squares[0]);
  assert.match(oppOf(html), /class="ptqo out"/);
  state.turn = 'O'; state.flash = null; state.done = null;
  assert.equal(E.playMove(state, 0, m.tg.O, E.makeRng('e')).ok, true);
  html = renderMini(state.squares[0]);
  assert.match(oppOf(html), /class="ptqo right late"/); assert.match(oppOf(html), /ptqit gap filled appear/, 'the right one drops into their gap');
  assert.match(oppOf(html), /fillin/, 'their score fills in');
  assert.equal(V.moveText(state.flash, 'Computer'), 'Computer got the pattern');
});

test('race: the miniature is a picture of both players\' progress, public only; a claimed square draws its miniature and both boards with the right options', () => {
  const m = raceMatch();
  E.applyMove(m, 'O', wrongOf(m, 'O')[0], E.makeRng('f'));
  E.applyMove(m, 'X', m.tg.X, E.makeRng('g'));
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard(), sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /trace2 trqt/); assert.equal((sq.match(/<svg class="trqm ptqm/g) || []).length, 2, 'one picture each');
  assert.match(sq, /trqm ptqm X[^]*class="tqon"/, 'X\'s point'); assert.match(sq, /trqm ptqm O[^]*tqt tqno/, 'O\'s wrong try');
  state.screen = 'mini'; state.zoom = 0;
  for (let i = 0; i < 3; i++) { state.flash = null; state.done = null; state.lock = null; state.turn = 'O'; assert.equal(E.playMove(state, 0, m.tg.O, E.makeRng('h' + i)).ok, true); }
  assert.equal(state.squares[0].owner, 'O');
  E.endFlash(state); state.flash = null; state.done = null;
  assert.doesNotThrow(() => V.miniature(state.squares[0].mini, true));
  const rv = renderMini(state.squares[0], true);
  assert.match(rv, /Won by/); assert.match(mainOf(rv), /popt right/, 'our right option shown'); assert.match(oppOf(rv), /ptqo right/, 'theirs too');
  assert.match(oppOf(rv), /ptqit gap filled/, 'their last puzzle solved');
});

test('race: the explainer is the Race one while the mode is on', () => {
  raceMatch();
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('patterns').play, /your own puzzles/);
  assert.match(explainOf('patterns').win, /first to get 3 right/);
  state.squares[0].mini.race = false;
  assert.doesNotMatch(explainOf('patterns').play, /your own puzzles/, 'a shared square: the usual one');
});
