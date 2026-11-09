// Race mode on the page (core/race.js), Sniff: the square's screen shows this phone's own dog and path and only the other
// side's shape (its steps); the other side's step arrives redacted and shows no dog here; the board's miniature shows the
// field and both step counts and no dog; the explainer swaps to the Race one while the mode is on.
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
const V = await import('../../src/games/sniff/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.sniff.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch() {
  E.setTune('sniff', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('sniff-race'), { games: ['sniff'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X' });
  E.setTune('sniff', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
// a step away from the treasure for p's own dog (never onto it)
const stepAway = (m, p) => { const dog = m.side[p].dog, d = E.sniffDirs(dog).find(k => E.sniffStep(dog, k) !== m.treasure); return E.applyMove(m, p, d, E.makeRng('s')); };
const xy = c => [Math.floor(c % 7) * 20 + 10, Math.floor(c / 7) * 20 + 10];

test('race: the screen draws this side\'s own dog and path and the other side\'s steps as a count; their dog never appears', () => {
  const m = raceMatch();
  stepAway(m, 'O'); stepAway(m, 'O');                            // the computer's two steps (its own dog)
  stepAway(m, 'X');                                                // ours
  state.turn = 'X';
  const html = renderMini(state.squares[0]);
  assert.equal((html.match(/class="sdog X/g) || []).length, 1, 'our dog'); assert.doesNotMatch(html, /class="sdog O/, "the computer's dog is out of sight");
  const [ox, oy] = xy(m.side.O.dog);
  assert.doesNotMatch(html, new RegExp(`translate\\(${ox} ${oy}\\) scale`), "the computer's dog's cell");
  assert.equal((html.match(/class="sdot X/g) || []).length, 2, 'our path: the start and one step'); assert.doesNotMatch(html, /class="sdot O|spath O/, 'no path of theirs');
  assert.match(html, /<small class="sstp">2 steps<\/small>/, "the computer's steps"); assert.match(html, /<small class="sstp">1 step<\/small>/, 'ours');
  assert.ok((html.match(/class="smove"/g) || []).length >= 3, 'our moves around our dog');
  assert.match(html, /class="g-arc srace"/);
});

test('race: the other side\'s step is redacted on this phone (no dog, no hotter or colder), shown as its count; the sounds carry no word', async () => {
  const m = raceMatch();
  state.turn = 'O';
  const dog = m.side.O.dog, d = E.sniffDirs(dog).find(k => E.sniffStep(dog, k) !== m.treasure);
  const r = E.playMove(state, 0, d, E.makeRng('c'));
  assert.ok(r.ok);
  assert.ok(state.flash.sniff, 'the full flash is on the state (the computer played here)');
  const html = renderMini(state.squares[0]);
  assert.doesNotMatch(html, /class="sdog O|sdog X walk/, 'no dog walks here'); assert.doesNotMatch(html, /Hotter!|Colder!|Same</, 'no word');
  assert.match(html, /walked their dog · step 1/, "the computer's step as its count");
  assert.match(html, /<small class="sstp fresh">1 step<\/small>/, 'its count changes');
  const { moveSounds } = await import('../../src/audio/sound.js');
  const names = moveSounds(state.flash).map(s => s[0]);
  assert.ok(!names.includes('higher') && !names.includes('lower') && !names.includes('hiloBlip'), `no word in the sounds: ${names}`);
  assert.ok(names.includes('hop'), 'the paws are heard');
  assert.equal(V.moveText(E.raceFlashHide(state.flash, m), '<b class="O">Computer</b>'), '<b class="O">Computer</b> walked their dog · step 1');
});

test('race: the miniature shows the field and both step counts and no dog; the review shows both dogs and paths; the explainer is the Race one while the mode is on', () => {
  const m = raceMatch();
  stepAway(m, 'X'); stepAway(m, 'O'); stepAway(m, 'O');
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /tsnr trace/); assert.doesNotMatch(sq, /tdog|tpath/, 'no dog, no path');
  const pub = E.raceView(m, null);
  assert.deepEqual(pub.side, {});
  const mini = V.miniature(pub, false);
  assert.match(mini, /class="tsnf"/); assert.match(mini, /class="tdn">1</); assert.match(mini, /class="tdn">2</); assert.doesNotMatch(mini, /tdog/);
  state.squares[0].owner = 'X'; state.screen = 'mini'; state.zoom = 0;
  const review = renderMini(state.squares[0]);
  assert.match(review, /class="sdog X/); assert.match(review, /class="sdog O/); assert.match(review, /spath O/);
  state.squares[0].owner = null;
  assert.match(explainOf('sniff').play, /out of sight/, 'the Race explainer in an open race square');
  state.squares[0].mini.race = false; delete state.squares[0].mini.side; state.squares[0].mini.dog = m.start; state.squares[0].mini.trail = [];
  assert.doesNotMatch(explainOf('sniff').play, /out of sight/, 'a shared square: the usual one');
});
