// Race mode on the page (core/race.js, rv 2), Find the Pair: the square's screen is two boards (ui/race.js raceBoards):
// this phone's own cards large (turned back down after a flip: a memory game), the other player's smaller under it with
// every card they have turned face up and their newest two turning as they land; the first card picked shows on the
// picker's board; no layout of an open square in the markup; the miniature each player's cards turned and pairs seen; a
// claimed square's review shows both layouts.
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
const V = await import('../../src/games/memory/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.memory.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch(seed) {
  E.setTune('memory', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng(seed || 'memory-race'), { games: ['memory'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', pick: null, pickSq: null, stamp: null, lock: null });
  E.setTune('memory', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const key = c => c.s + '/' + c.c;
const pairIn = cards => { const seen = new Map(); let pair = null; cards.forEach((c, i) => { const k = key(c); if (seen.has(k)) pair = [seen.get(k), i]; else seen.set(k, i); }); return pair; };
const twoOthers = (cards, not) => { const pr = pairIn(cards); for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) if (key(cards[a]) !== key(cards[b]) && !(pr.includes(a) && pr.includes(b)) && !(not || []).includes(a) && !(not || []).includes(b)) return [a, b]; return null; };
const mainOf = html => html.slice(html.indexOf('class="rmain"'), html.indexOf('class="ropp'));
const oppOf = html => html.slice(html.indexOf('class="ropp'));
const upCards = html => [...mainOf(html).matchAll(/<button class="mc (up|down)[^"]*" data-act="pick" data-i="(\d)"/g)].filter(x => x[1] === 'up').map(x => Number(x[2]));
const oppUp = html => [...oppOf(html).matchAll(/<i class="(up|dn)[^"]*">/g)].map((x, i) => (x[1] === 'up' ? i : -1)).filter(i => i >= 0);
const faceCount = html => (html.match(/<svg viewBox="0 0 24 24" fill="#/g) || []).length;

test('race: two boards, ours face down with the controls, theirs with every card they turned face up; no layout of an open square', () => {
  const m = raceMatch();
  const [a, b] = twoOthers(m.tg.O); E.applyMove(m, 'O', [a, b], E.makeRng('a'));
  const [c, d] = twoOthers(m.tg.X); E.applyMove(m, 'X', [c, d], E.makeRng('b'));
  const html = renderMini(state.squares[0]);
  assert.match(html, /class="rboards mrb"/);
  assert.deepEqual(upCards(html), [], 'ours turned back down: a memory game');
  assert.equal((mainOf(html).match(/data-act="pick"/g) || []).length, 9);
  assert.deepEqual(oppUp(html), [a, b].sort((x, y) => x - y), "their turned cards face up on theirs"); assert.doesNotMatch(oppOf(html), /data-act=/);
  assert.equal(faceCount(mainOf(html)), 0, 'no face on ours'); assert.equal(faceCount(oppOf(html)), 2, 'their two faces');
  assert.match(html, /class="rnote">1 flip</);
});

test('race: their flip turns up on their board; ours flips on ours; our first card picked shows on ours alone', () => {
  const m = raceMatch('memory-race-2');
  state.turn = 'O';
  const [a, b] = twoOthers(m.tg.O);
  assert.ok(E.playMove(state, 0, [a, b], E.makeRng('o')).ok);
  let html = renderMini(state.squares[0]);
  assert.deepEqual(upCards(html), [], 'nothing turns on ours');
  assert.equal((oppOf(html).match(/<i class="up fl">/g) || []).length, 2, 'their two cards turn up on theirs');
  state.flash = null; state.done = null; state.turn = 'X';
  state.pick = 4; state.pickSq = 0;
  html = renderMini(state.squares[0]);
  assert.deepEqual(upCards(html), [4], 'our pick shows on ours'); assert.match(mainOf(html), /class="mc up pick flipup"/);
  assert.equal(faceCount(oppOf(html)), 2, 'theirs as it was');
  state.pick = null; state.pickSq = null;
  const [c, d] = twoOthers(m.tg.X);
  assert.ok(E.playMove(state, 0, [c, d], E.makeRng('x')).ok);
  html = renderMini(state.squares[0]);
  assert.deepEqual(upCards(html), [c, d], 'our two up while the move plays'); assert.doesNotMatch(oppOf(html), /class="up fl"/);
  // online, their first card picked (the record's `up`) shows on theirs
  state.flash = null; state.done = null; state.turn = 'O'; state.online = null;
  const pub = JSON.parse(JSON.stringify(m)); state.pick = 7; state.pickSq = 0; hideMini(pub, 0, state);
  assert.equal(pub.tg, undefined); assert.deepEqual(pub.up, Object.assign({ i: 7 }, m.tg.O[7]));
  state.squares[0].mini = pub;
  html = renderMini(state.squares[0]);
  assert.ok(oppUp(html).includes(7), 'their pick up on theirs'); assert.deepEqual(upCards(html), [], 'not on ours');
  state.squares[0].mini = m; state.pick = null; state.pickSq = null; state.turn = 'X';
});

test('race: the miniature is each player\'s cards turned and pairs seen (public: the same from the hidden square); the review shows both layouts', () => {
  const m = raceMatch('memory-race-3');
  E.applyMove(m, 'X', twoOthers(m.tg.X), E.makeRng('a'));
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard(), sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /class="trace2 tmemr2"/); assert.equal((sq.match(/class="tmem2 [XO]"/g) || []).length, 2);
  const mini = V.miniature(m, false), half = p => mini.slice(mini.indexOf(`class="tmem2 ${p}"`)).split('</svg>')[0];
  assert.equal((half('X').match(/class="sn"/g) || []).length, 2, 'X: two cards turned'); assert.equal((half('O').match(/class="sn"|class="pr"/g) || []).length, 0);
  const hidden = JSON.parse(JSON.stringify(m)); hideMini(hidden, 0, state);
  assert.equal(V.miniature(hidden, false), mini, 'public information only');
  // X turns up both cards of its pair: solid, the pip filled; claimed: both layouts face up in the review
  E.applyMove(m, 'X', pairIn(m.tg.X), E.makeRng('w'));
  m.winCells = pairIn(m.tg.X);
  const won = V.miniature(m, true);
  assert.equal((won.slice(0, won.indexOf('tmem2 O')).match(/class="pr"/g) || []).length, 2); assert.match(won, /circle class="on"/);
  state.squares[0].owner = 'X'; state.screen = 'mini'; state.zoom = 0;
  const review = renderMini(state.squares[0]);
  assert.equal(upCards(review).length, 9, 'our layout face up'); assert.equal(oppUp(review).length, 9, 'theirs too');
  assert.equal((mainOf(review).match(/class="mc up win/g) || []).length, 2, 'our pair marked');
  state.squares[0].owner = null;
});

test('race: the explainer is the Race one in an open race square, the usual one in a shared one', () => {
  raceMatch('memory-race-4');
  assert.match(explainOf('memory').play, /your own way/);
  state.squares[0].mini = E.newMini('memory', E.makeRng('s'));
  assert.doesNotMatch(explainOf('memory').play, /your own way/);
});
