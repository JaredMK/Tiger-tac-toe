// Race mode on the page (core/race.js, rv 2), Sniff: the square's screen is two boards (ui/race.js raceBoards): this
// phone's own field large (its dog, its path, the arrows, its word in the reserved line), the other player's smaller under
// it (their dog and path, their newest step drawing in as it lands, their last word by their name); no treasure of an
// open square in the markup; the miniature a little field each; a claimed square's review shows both treasures.
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
const { hideMini } = await import('../../src/core/records.js');
const V = await import('../../src/games/sniff/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.sniff.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch(seed) {
  E.setTune('sniff', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng(seed || 'sniff-race'), { games: ['sniff'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', stamp: null, lock: null });
  E.setTune('sniff', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const away = (m, p) => E.sniffDirs(m.side[p].dog).find(k => E.sniffStep(m.side[p].dog, k) !== m.tg[p]);
const toward = (m, p) => { const dog = m.side[p].dog, t = m.tg[p]; return E.sniffDirs(dog).find(k => E.sniffSteps(E.sniffStep(dog, k), t) < E.sniffSteps(dog, t)); };
const mainOf = html => html.slice(html.indexOf('class="rmain"'), html.indexOf('class="ropp'));
const oppOf = html => html.slice(html.indexOf('class="ropp'));
const dogAt = (html, p) => { const x = html.match(new RegExp(`class="sdog ${p}[^"]*"[^>]*transform="translate\\(([\\d.]+) ([\\d.]+)\\)`)); return x ? [Number(x[1]), Number(x[2])] : null; };
const xy = c => [(c % 7) * 20 + 10, Math.floor(c / 7) * 20 + 10];

test('race: two fields, ours with our dog, path and arrows, theirs small with their dog and path; no treasure of an open square', () => {
  const m = raceMatch();
  E.applyMove(m, 'O', away(m, 'O'), E.makeRng('a')); E.applyMove(m, 'O', away(m, 'O'), E.makeRng('b'));
  E.applyMove(m, 'X', away(m, 'X'), E.makeRng('c'));
  const html = renderMini(state.squares[0]);
  assert.match(html, /class="rboards srb"/);
  assert.deepEqual(dogAt(mainOf(html), 'X'), xy(m.side.X.dog), 'our dog on our field'); assert.equal(dogAt(mainOf(html), 'O'), null);
  assert.deepEqual(dogAt(oppOf(html), 'O'), xy(m.side.O.dog), 'their dog on theirs'); assert.equal(dogAt(oppOf(html), 'X'), null);
  assert.ok((mainOf(html).match(/class="smove"/g) || []).length >= 3, 'our arrows'); assert.doesNotMatch(oppOf(html), /data-act=/);
  assert.match(oppOf(html), /class="spath O"/, 'their path'); assert.match(mainOf(html), /class="sdot X/, 'ours');
  assert.match(html, /class="rnote">2 steps · (Hotter|Colder|Same)</);
  assert.doesNotMatch(html, /class="schest"|class="sbox"/, 'no chest while the square is open');
});

test('race: their step lands on their field (the dog trotting, the step drawing in, the word in our reserved line), ours untouched', () => {
  const m = raceMatch('sniff-race-2');
  state.turn = 'O';
  const r = E.playMove(state, 0, away(m, 'O'), E.makeRng('s'));
  assert.ok(r.ok);
  const html = renderMini(state.squares[0]);
  assert.match(oppOf(html), /class="sdog O walk"/, 'their dog trots'); assert.match(oppOf(html), /class="spath O fresh"/, 'their step draws in');
  assert.doesNotMatch(mainOf(html), /walk|fresh/, 'nothing moves on ours');
  assert.match(mainOf(html), /class="arcres (hot|cold|same)[^"]*"[^>]*role="status"><b class="O srn">[\s\S]*?Computer<\/b> · (Hotter!|Colder!|Same)/, 'their word in the reserved line');
  state.flash = null; state.done = null; state.turn = 'X';
  E.playMove(state, 0, away(m, 'X'), E.makeRng('t'));
  const mine = renderMini(state.squares[0]);
  assert.match(mainOf(mine), /class="sdog X walk"/); assert.match(mainOf(mine), /role="status">(Hotter!|Colder!|Same)</);
  assert.doesNotMatch(oppOf(mine), /walk|fresh/);
});

test('race: the miniature is a little field each, its path and dog (public: the same from the hidden square); the review shows both treasures', () => {
  const m = raceMatch('sniff-race-3');
  E.applyMove(m, 'X', away(m, 'X'), E.makeRng('a')); E.applyMove(m, 'X', away(m, 'X'), E.makeRng('b'));
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard(), sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /class="trace2 tsnr2"/); assert.equal((sq.match(/class="tsniff tsn2"/g) || []).length, 2);
  const mini = V.miniature(m, false);
  assert.match(mini, /class="tpath X"/, "X's path"); assert.doesNotMatch(mini, /class="tpath O"/, 'O has not walked');
  assert.match(mini, /class="tdog X th-(hot|cold|same)"/); assert.match(mini, /class="tdog O th-none"/);
  const hidden = JSON.parse(JSON.stringify(m)); hideMini(hidden, 0, state);
  assert.equal(V.miniature(hidden, false), mini, 'public information only');
  let n = 0; while (m.side.X.dog !== m.tg.X && n++ < 10) E.applyMove(m, 'X', toward(m, 'X'), E.makeRng('w'));
  state.squares[0].owner = 'X'; state.screen = 'mini'; state.zoom = 0;
  const review = renderMini(state.squares[0]);
  assert.match(mainOf(review), /class="sbox"/); assert.match(oppOf(review), /class="sbox"/, "their treasure shown on theirs");
  assert.match(V.miniature(m, true), /th-found/);
  state.squares[0].owner = null;
});

test('race: the explainer is the Race one in an open race square, the usual one in a shared one', () => {
  raceMatch('sniff-race-4');
  assert.match(explainOf('sniff').play, /your own treasure/);
  state.squares[0].mini = E.newMini('sniff', E.makeRng('s'));
  assert.doesNotMatch(explainOf('sniff').play, /your own treasure/);
});
