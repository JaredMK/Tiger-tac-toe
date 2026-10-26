// The first-time tutorial (src/ui/tutorial.js): due at a first visit (no flag on the device, no sign of play before), it deals
// Tic-Tac-Toe and Coin Flip against the computer on Easy with the player as X, its captions follow the play to the last card,
// Skip and the card set the flag and go to the main menu, How to Play replays it, and its match is never tracked or recorded.
// Rendered in Node with the browser's names stubbed (no page needed); the storage is a real one, in memory, for the flag.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const mem = new Map();
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }, configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const T = await import('../../src/ui/tutorial.js');
const { state } = await import('../../src/ui/app.js');
const { renderHowTo } = await import('../../src/ui/explainer.js');
const MM = await import('../../src/net/matchmaking.js');
const { KEY } = await import('../../src/ui/config.js');
const { pendingLocal, reportLocal, trackEnd } = await import('../../src/net/tracking.js');

const FLAG = KEY + '.tutorial';
test('a first visit: the tutorial is due; it deals Tic-Tac-Toe and Coin Flip against the computer on Easy, you as X, untracked', () => {
  assert.equal(T.tutorialDue(), true, 'no flag, nothing played: due');
  const games = Object.assign({}, state.setup.games);
  assert.equal(T.startTutorial(), true);
  assert.equal(state.screen, 'board'); assert.equal(state.tutorial, true);
  assert.equal(state.turn, 'X'); assert.equal(state.setup.human, 'X'); assert.equal(state.cpu, 'O'); assert.equal(state.cpuLevel, 'easy');
  assert.equal(state.setup.names.X, 'You'); assert.equal(state.setup.names.O, 'Computer');
  for (const sq of state.squares) assert.ok(T.TUT_GAMES.includes(sq.mini.type), sq.mini.type);
  assert.deepEqual(state.games.slice().sort(), ['coins', 'ttt'], 'resets deal from the same two');
  assert.deepEqual(state.setup.games, games, "the player's own mini-game list is untouched");
  assert.equal(state.stats, null, 'no stats entry: never tracked'); assert.equal(state.quick, false);
  assert.equal(mem.get(FLAG), 'done', 'shown once: the flag goes on as it starts');
  assert.equal(T.tutorialDue(), false);
  const html = T.renderTutorial();
  assert.match(html, /Nine squares, each a mini-game\. Win squares to get three in a row\./);
  assert.match(html, /data-act="tut-skip"/); assert.match(html, /data-act="tut-next"(?! disabled)/);
});
test('the captions follow the play: tap a square, play, your turn and the computer\'s, a square won, three in a row, then the card', () => {
  assert.equal(T.tutAct('tut-next'), true);
  assert.match(T.renderTutorial(), /Tap a square to zoom in\./);
  assert.match(T.renderTutorial(), /data-act="tut-next" disabled/, 'a step that waits for a tap has no Next (its slot stays)');
  state.screen = 'mini'; state.zoom = 0;
  assert.match(T.renderTutorial(), /Play the mini-game\./);
  state.screen = 'board'; state.moves = 1; state.turn = 'O';
  assert.match(T.renderTutorial(), /The computer's turn: watch its move\./);
  state.turn = 'X'; state.moves = 2;
  assert.match(T.renderTutorial(), /Your turn: tap a square\./);
  state.screen = 'mini';
  assert.match(T.renderTutorial(), /Play the mini-game\./, 'in a square again');
  state.squares[0].owner = 'X';
  assert.doesNotMatch(T.renderTutorial(), /won a square/, 'never a "square won" message in the square: on the board, after the zoom out');
  state.screen = 'board'; state.zoom = null;
  assert.match(T.renderTutorial(), /You won a square!/);
  assert.match(T.renderTutorial(), /data-act="tut-next"(?! disabled)/);
  T.tutAct('tut-next');
  assert.match(T.renderTutorial(), /Get three squares in a row to win the match\./); assert.match(T.renderTutorial(), />Got it</);
  T.tutAct('tut-next');
  const card = T.renderTutorial();
  assert.match(card, /class="tutend"/); assert.match(card, /data-act="tut-play">Play the computer on Easy</); assert.match(card, /data-act="tut-menu">Main menu</);
  assert.equal(state.confirm, 'tutorial', 'the computer waits under the card');
});
test('the card\'s Main menu (and Skip): the main menu, the tutorial over, its flag kept; a tutorial match in the saved state is dropped at the next load', () => {
  T.tutAct('tut-menu');
  assert.equal(state.screen, 'menu'); assert.equal(state.tutorial, false); assert.equal(state.confirm, null); assert.equal(T.tut, null);
  assert.equal(T.renderTutorial(), '');
  assert.equal(mem.get(FLAG), 'done');
  // left mid-way (the page closed): the saved state still holds the tutorial match, which is no match to come back to
  const setup = state.setup;
  Object.assign(state, E.newMatch(E.makeRng('tut'), { games: ['ttt'] }), { setup, tutorial: true, moves: 3 });
  T.tutorialReset();
  assert.equal(state.screen, 'menu'); assert.equal(state.moves, 0); assert.ok(!state.tutorial); assert.equal(state.setup, setup, 'the setup kept');
  assert.equal(T.tutorialDue(), false, 'seen: not again by itself');
  T.startTutorial(); T.tutAct('tut-skip');
  assert.equal(state.screen, 'menu'); assert.equal(T.tut, null); assert.equal(mem.get(FLAG), 'done');
});
test('the computer\'s claim and no claim have their own captions; a match over goes straight to the card', () => {
  T.startTutorial();
  state.screen = 'board'; state.moves = 2; state.squares[4].owner = 'O';
  assert.match(T.renderTutorial(), /The computer won a square\. Win one back!/);
  T.tutAct('tut-skip'); T.startTutorial();
  state.screen = 'board'; state.moves = 8;
  assert.match(T.renderTutorial(), /Win a mini-game to claim its square\./, 'four moves of your own without a claim: on to the point');
  state.winner = 'O'; state.screen = 'win';
  assert.match(T.renderTutorial(), /class="tutend"/);
  T.tutAct('tut-menu');
});
test('How to Play offers Replay the tutorial, which starts it again even once seen', () => {
  assert.match(renderHowTo(), /<button class="btn tutreplay" data-act="tut-replay">Replay the tutorial<\/button>/);
  assert.equal(mem.get(FLAG), 'done');
  assert.equal(T.tutAct('tut-replay'), true);
  assert.equal(state.screen, 'board'); assert.equal(state.tutorial, true);
  assert.match(T.renderTutorial(), /Nine squares/);
});
test('the tutorial match is never tracked or recorded: no stats entry, nothing for the server at its end, and it never starts the tracking', () => {
  assert.equal(state.stats, null);
  state.winner = 'X'; state.winReason = 'line';
  trackEnd(); reportLocal();
  assert.equal(state.stats, null); assert.deepEqual(pendingLocal(), []);
  const src = fs.readFileSync(path.resolve('src/ui/tutorial.js'), 'utf8');
  assert.doesNotMatch(src, /\b(trackStart|recordLocal|holdResume)\s*\(/, 'no call into the tracking, the record or the resume hold');
  state.winner = null;
});
test('the card\'s Play: a real Play Computer match on Easy, your side drawn, with the side reveal and the tracking of any match', () => {
  T.tutAct('tut-next'); T.tutAct('tut-next'); T.tutAct('tut-next');   // (zoom, then the claim step is not reached without play: the steps stop at the card)
  state.screen = 'board'; state.squares[0].owner = 'X';
  while (T.renderTutorial().indexOf('class="tutend"') < 0) T.tutAct('tut-next');
  assert.equal(T.tutAct('tut-play'), true);
  assert.equal(state.tutorial, false); assert.equal(T.tut, null); assert.equal(state.confirm, null);
  assert.equal(state.quick, true, "Play Computer's match (its rematch is another)"); assert.equal(state.cpuLevel, 'easy');
  assert.deepEqual(E.normCpu(state.setup), { pick: 'random', level: 'easy' });
  assert.ok(state.cpu === 'X' || state.cpu === 'O'); assert.equal(state.screen, 'board');
  assert.ok(state.stats && state.stats.mode === 'cpu', 'a real match: tracked');
  assert.ok(MM.mmIntro, 'the side reveal');
  MM.closeIntro();
  assert.equal(T.renderTutorial(), '');
});
