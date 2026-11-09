// Race mode on the page for Trivia (core/race.js, rv: 2): the square draws two boards, this phone's own large (its own
// question: Reveal, the options, its cross-outs, its score) and the other player's small (their score as pips, their
// question face down or turned up with their cross-outs, never the right answer while open); the other side's move plays on
// their board from its flash; the miniature is a picture of both players' progress; a claimed square shows both boards with
// the right answers; the explainer swaps to the Race one while the mode is on.
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
const V = await import('../../src/games/trivia/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.trivia.view = V;   // (the page registers the views in main.js; here by hand)
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Science', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

function raceMatch() {
  E.setTune('trivia', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('trivia-race'), { games: ['trivia'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('trivia', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const qOf = (m, p) => (m.side[p].shown ? m.side[p].ask : m.tq[p]);
const wrongOf = (m, p) => [0, 1, 2, 3].filter(k => k !== m.tg[p] && !m.side[p].crossed.includes(k));
const mainOf = html => html.slice(html.indexOf('class="rmain"'), html.indexOf('class="ropp'));
const oppOf = html => html.slice(html.indexOf('class="ropp'));

test('race: two boards; ours face down with Reveal, then our own question with its options; theirs small, face down, never their question\'s text', () => {
  const m = raceMatch();
  let html = renderMini(state.squares[0]);
  assert.match(html, /class="rboards trqb"/); assert.match(html, /class="ropp O"/, 'the other board is O\'s');
  assert.match(mainOf(html), /data-act="trivia-reveal"(?! disabled)/, 'our Reveal, open on our turn');
  assert.match(oppOf(html), /trqback/, 'theirs face down');
  assert.ok(!html.includes(m.tq.O.q) && !html.includes(m.tq.X.q), 'no face-down question drawn');
  assert.equal(E.triviaReveal(state, 0, 'X').ok, true);
  html = renderMini(state.squares[0]);
  assert.ok(mainOf(html).includes(m.side.X.ask.q), 'our question, turned up');
  assert.equal((mainOf(html).match(/class="topt"/g) || []).length, 4, 'four options to pick');
  assert.match(mainOf(html), /Your turn · 4 options left/);
  assert.match(oppOf(html), /aria-label="0 of 3"/, 'their score as pips to the goal');
});

test('race: the other side\'s move plays on their board from its flash; our board untouched; their crossed-out picks stay on their card; the right answer never shows while open', async () => {
  const m = raceMatch();
  state.turn = 'O';
  const w = wrongOf(m, 'O')[0], qO = qOf(m, 'O').q;
  assert.equal(E.playMove(state, 0, w, E.makeRng('d')).ok, true);
  const html = renderMini(state.squares[0]);
  assert.ok(oppOf(html).includes(qO), 'their question on their board');
  if (V.triviaPre(state.flash)) assert.match(oppOf(html), /tqstack/, 'turned up in that move: the card flips on their board');   // (no flip with reduced motion, as here)
  assert.match(oppOf(html), /class="trqo wrong late"/, 'their pick, struck when it comes');
  assert.doesNotMatch(oppOf(html), /trqo right/, 'no right answer shown');
  assert.match(mainOf(html), /got it wrong/, 'the result in our reserved line');
  assert.doesNotMatch(mainOf(html), /topt (out|wrong|right)/, 'nothing on our card');
  const { moveSounds } = await import('../../src/audio/sound.js');
  assert.ok(moveSounds(state.flash).map(s => s[0]).includes('thud'));
  assert.equal(V.moveText(state.flash, 'Computer'), 'Computer answered wrong · crossed out');
  // after the move: their card keeps the cross-out
  E.endFlash(state); state.turn = 'X';
  const h2 = renderMini(state.squares[0]);
  assert.match(oppOf(h2), /class="trqo out"/); assert.doesNotMatch(oppOf(h2), /trqo right/);
  // their right answer: the pick glows on their board, their score fills in, their next question face down
  state.turn = 'O'; state.flash = null; state.done = null;
  assert.equal(E.playMove(state, 0, m.tg.O, E.makeRng('e')).ok, true);
  const h3 = renderMini(state.squares[0]);
  assert.match(oppOf(h3), /class="trqo right late"/); assert.match(oppOf(h3), /fillin/);
  assert.match(mainOf(h3), /got it right/);
});

test('race: the miniature is a picture of both players\' progress (score, card, wrong tries), public only; a claimed square draws its miniature and both boards with the answers', () => {
  const m = raceMatch();
  E.applyMove(m, 'O', wrongOf(m, 'O')[0], E.makeRng('f'));
  m.right.X = 1;
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard(), sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /trace2 trqt/); assert.equal((sq.match(/<svg class="trqm/g) || []).length, 2, 'one picture each');
  assert.match(sq, /trqm X[^]*class="tqon"/, 'X\'s point'); assert.match(sq, /trqm O[^]*tqt tqno/, 'O\'s wrong try');
  for (const p of ['X', 'O']) assert.ok(!sq.includes(qOf(m, p).q), 'no question text');
  // the computer wins it: review
  state.screen = 'mini'; state.zoom = 0; state.turn = 'O';
  for (let i = 0; i < 3; i++) { state.flash = null; state.done = null; state.lock = null; state.turn = 'O'; assert.equal(E.playMove(state, 0, m.tg.O, E.makeRng('g' + i)).ok, true); }
  assert.equal(state.squares[0].owner, 'O');
  E.endFlash(state); state.flash = null; state.done = null;
  assert.doesNotThrow(() => V.miniature(state.squares[0].mini, true));
  const rv = renderMini(state.squares[0], true);
  assert.match(rv, /Won by/); assert.match(mainOf(rv), /topt right/, 'our right answer shown'); assert.match(oppOf(rv), /trqo right/, 'theirs too');
});

test('race: the explainer is the Race one while the mode is on', () => {
  raceMatch();
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('trivia').play, /your own questions/);
  assert.match(explainOf('trivia').win, /first to get 3 right/);
  state.squares[0].mini.race = false;
  assert.doesNotMatch(explainOf('trivia').play, /your own questions/, 'a shared square: the usual one');
});
