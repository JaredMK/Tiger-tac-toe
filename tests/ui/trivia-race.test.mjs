// Race mode on the page for Trivia (core/race.js): the square's screen shows this phone's own card (its cross-outs) and only
// the other side's shape (wrong tries, right or not); the other side's move arrives redacted and is shown as right or wrong,
// never which option; the board's miniature shows both shapes; the explainer swaps to the Race one while the mode is on.
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
E.setTriviaBank({ questions: Array.from({ length: 12 }, (_, i) => ({ id: 'q' + i, cat: 'Science', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

function raceMatch() {
  E.setTune('trivia', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('trivia-race'), { games: ['trivia'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('trivia', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  const m = state.squares[0].mini; m.shown = true;   // (the question turned up)
  return m;
}
const wrongOf = m => [0, 1, 2, 3].filter(k => k !== m.answer);
const letters = 'ABCD';

test('race: the screen draws this side\'s own cross-outs and the other side\'s tries as a shape; their picks never appear', () => {
  const m = raceMatch(), wrong = wrongOf(m);
  E.applyMove(m, 'O', wrong[0], E.makeRng('a')); E.applyMove(m, 'O', wrong[1], E.makeRng('b'));   // the computer's two wrong tries (its own card)
  E.applyMove(m, 'X', wrong[2], E.makeRng('c'));                                                  // ours
  state.turn = 'X';
  const html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<button class="topt out" data-act="move" [^>]*data-m=.${wrong[2]}.`), 'our cross-out struck');
  for (const k of [wrong[0], wrong[1]]) assert.match(html, new RegExp(`<button class="topt" data-act="move" [^>]*data-m=.${k}.`), `the computer's ${letters[k]} is open to us`);
  assert.equal((html.match(/pips tqr/g) || []).length, 2, 'both tallies as race tallies');
  assert.match(html, /aria-label="2 wrong"/, "the computer's two wrong tries"); assert.match(html, /aria-label="1 wrong"/, 'our one');
  assert.doesNotMatch(html, /class="pips" aria-label="\d of \d"/, 'no right-answer pips');
  assert.match(html, /option.? left for you/, 'our own count');
  assert.match(html, /Question \d\?/, 'the shared question');
});

test('race: the other side\'s move is redacted on this phone (no option), shown as right or wrong; sounds carry only that', async () => {
  const m = raceMatch(), wrong = wrongOf(m);
  state.turn = 'O';
  const r = E.playMove(state, 0, wrong[0], E.makeRng('d'));
  assert.ok(r.ok); assert.ok(state.flash.trivia, 'the full flash is on the state (the computer played here)');
  const html = renderMini(state.squares[0]);
  assert.doesNotMatch(html, /topt wrong out fresh/, 'no pick struck for their move');
  assert.doesNotMatch(html, /Wrong: crossed out/, 'not our wording');
  assert.match(html, /got it wrong/, 'theirs: wrong, no more');
  assert.match(html, /i class="no fillin"/, 'their tally fills in from the move');
  for (const k of [0, 1, 2, 3]) assert.doesNotMatch(html, new RegExp(`<button class="topt[^"]*\\bout\\b[^"]*" data-act="move" [^>]*data-m=.${k}.`), 'nothing crossed out on our card');
  const { moveSounds } = await import('../../src/audio/sound.js');
  const names = moveSounds(state.flash).map(s => s[0]);
  assert.ok(names.includes('thud'), `the wrong-answer thud: ${names}`);
  // the computer's right answer: the claim shows as theirs, right
  state.flash = null; state.done = null; state.lock = null; state.turn = "O";
  const r2 = E.playMove(state, 0, m.answer, E.makeRng('e'));
  assert.ok(r2.ok, JSON.stringify(r2)); assert.equal(state.flash.kind, "claim");
  const h2 = renderMini(state.squares[0]);
  assert.match(h2, /got it right/); assert.doesNotMatch(h2, /topt right/, 'the right option is not shown');
  assert.equal(V.moveText(E.raceFlashHide(state.flash, m), 'Computer'), 'Computer answered right');
});

test('race: the miniature shows both players\' shapes and no pick; the explainer is the Race one while the mode is on', () => {
  const m = raceMatch(), wrong = wrongOf(m);
  E.applyMove(m, 'X', wrong[0], E.makeRng('f')); E.applyMove(m, 'O', wrong[1], E.makeRng('g'));
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /tart trv tqrm/); assert.doesNotMatch(sq, /topts/, 'no shared answers row');
  assert.equal((sq.match(/i class="no"/g) || []).length, 2, 'one wrong try each');
  const pub = E.raceView(m, null);
  assert.deepEqual(pub.side, {});
  assert.match(V.miniature(pub, false), /tqok/);
  assert.equal(V.miniature(pub, false), V.miniature(E.raceView(m, 'X'), false), 'the same picture for a side');
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('trivia').play, /yours alone/, 'the Race explainer in an open race square');
  state.squares[0].mini.race = false; delete state.squares[0].mini.side; state.squares[0].mini.crossed = [];
  assert.doesNotMatch(explainOf('trivia').play, /yours alone/, 'a shared square: the usual one');
});
