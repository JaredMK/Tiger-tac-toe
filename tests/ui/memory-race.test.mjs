// Race mode on the page (core/race.js), Find the Pair: the square's screen turns only this phone's own cards (from its own
// part's faces) and shows the other side's progress as its flip count; the other side's flip arrives redacted and turns no
// card here; the board's miniature shows the backs and both counts; the explainer swaps to the Race one while the mode is on.
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
const V = await import('../../src/games/memory/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.memory.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch() {
  E.setTune('memory', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng('memory-race'), { games: ['memory'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', pick: null, pickSq: null });
  E.setTune('memory', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const pairIn = cards => { const seen = new Map(); let pair = null; cards.forEach((c, i) => { const k = c.s + '/' + c.c; if (seen.has(k)) pair = [seen.get(k), i]; else seen.set(k, i); }); return pair; };
const twoOthers = (cards, not) => { const pr = pairIn(cards); for (let a = 0; a < 9; a++) for (let b = a + 1; b < 9; b++) if (!(pr.includes(a) && pr.includes(b)) && !(not || []).includes(a) && !(not || []).includes(b)) return [a, b]; return null; };
const ups = html => [...html.matchAll(/<button class="mc up[^"]*" data-act="pick" data-i="(\d)"/g)].map(x => Number(x[1]));

test('race: our own flip turns our two cards (their faces from our part); the other side\'s progress is a count; nothing of theirs is up', () => {
  const m = raceMatch();
  const theirs = twoOthers(m.cards);
  E.applyMove(m, 'O', theirs, E.makeRng('o'));                    // the computer's flip (its own part)
  state.turn = 'X';
  const mine = twoOthers(m.cards, theirs);
  const r = E.playMove(state, 0, mine, E.makeRng('x'));
  assert.ok(r.ok);
  const html = renderMini(state.squares[0]);
  assert.deepEqual(ups(html).sort(), mine.slice().sort(), 'our two cards are up');
  assert.equal((html.match(/<span class="ft"><svg/g) || []).length, 2, 'two faces drawn, ours');
  assert.match(html, /class="mrace"/); assert.match(html, /<small>1 flip<\/small>/);
  for (const i of theirs) if (!mine.includes(i)) assert.doesNotMatch(html, new RegExp(`class="mc up[^"]*" data-act="pick" data-i="${i}"`), `the computer's card ${i} stays down`);
  // online, the deck is not on this phone: the faces come from our part alone
  const pub = E.publicMini(m, 'X'); pub.cards = undefined;
  Object.assign(pub, { shape: E.raceView(m, 'X').shape, side: { X: m.side.X } });
  const sq = { mini: Object.assign({}, m, { cards: undefined }), owner: null };
  const own = V.screen(sq, Object.assign({}, state.flash), null, E.raceView(sq.mini, 'X'), false, true, state.flash, null, () => false, () => -1, false, 'X', '');
  assert.equal((own.match(/<span class="ft"><svg/g) || []).length, 2, 'the faces from our part, with no deck here');
});

test('race: the other side\'s flip is redacted on this phone (no card turns), shown as its count', async () => {
  const m = raceMatch();
  state.turn = 'O';
  const r = E.playMove(state, 0, twoOthers(m.cards), E.makeRng('c'));
  assert.ok(r.ok);
  assert.ok(state.flash.reveal, 'the full flash is on the state (the computer played here)');
  const html = renderMini(state.squares[0]);
  assert.deepEqual(ups(html), [], 'no card turns here'); assert.doesNotMatch(html, /<span class="ft"><svg/, 'no face');
  assert.match(html, /<span class="O fresh"><b class="O mrn">[\s\S]*?<\/b><small>1 flip<\/small>/, "the computer's count changes");
  assert.equal(V.moveText(E.raceFlashHide(state.flash, m), '<b class="O">Computer</b>'), 'Flip 1 · no match');
  // the other side's first card picked (online: the match's pick) never shows here
  state.flash = null; state.done = null; state.pick = 4; state.pickSq = 0; state.online = { me: 'X', kind: 'mm' };
  assert.deepEqual(ups(renderMini(state.squares[0])), [], "the other side's pick stays down");
  state.online = null; state.pick = null; state.pickSq = null;
});

test('race: the miniature shows the backs and both flip counts, no face; the review turns the whole deck; the explainer is the Race one while the mode is on', () => {
  const m = raceMatch();
  E.applyMove(m, 'X', twoOthers(m.cards), E.makeRng('x')); E.applyMove(m, 'O', twoOthers(m.cards), E.makeRng('o')); E.applyMove(m, 'O', twoOthers(m.cards), E.makeRng('o'));
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /tmemr trace/); assert.doesNotMatch(sq, /<i class="up"/, 'no face');
  const pub = E.raceView(m, null);
  assert.deepEqual(pub.side, {}); assert.equal(E.publicMini(m).cards, undefined, 'the public view carries no deck');
  const mini = V.miniature(pub, false);
  assert.match(mini, /tg g3 tmem/); assert.equal((mini.match(/<i><\/i>/g) || []).length, 9, 'nine backs'); assert.match(mini, /class="tdn">1</); assert.match(mini, /class="tdn">2</);
  state.squares[0].owner = 'O'; state.squares[0].mini.winCells = pairIn(m.cards); state.screen = 'mini'; state.zoom = 0;
  const review = renderMini(state.squares[0]);
  assert.equal(ups(review).length, 9, 'the whole deck, once the square is won');
  state.squares[0].owner = null;
  assert.match(explainOf('memory').play, /yours alone/, 'the Race explainer in an open race square');
  state.squares[0].mini.race = false; delete state.squares[0].mini.side; state.squares[0].mini.seen = []; state.squares[0].mini.flips = 0;
  assert.doesNotMatch(explainOf('memory').play, /yours alone/, 'a shared square: the usual one');
});
