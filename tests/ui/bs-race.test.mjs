// Race mode on the page (core/race.js, rv 2), Sea Battle: the square shows this phone's own sea large (its buttons) and
// the other player's sea small under it (ui/race.js raceBoards), both open; the ships hidden until the square ends (only
// hit cells show); the other side's shot lands on their small sea from its flash; the board's miniature draws each
// player's ship with their hits filled in; a finished square reviewed shows both ships. Rendered in Node, browser stubbed.
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
const V = await import('../../src/games/bs/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.bs.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch(seed = 'bs-race') {
  E.setTune('bs', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng(seed), { games: ['bs'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', lock: null });
  E.setTune('bs', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const notIn = (cells, k = 0) => { let c = k; while (cells.includes(c)) c++; return c; };
const part = (html, cls) => { const at = html.indexOf(cls); assert.ok(at >= 0, `no ${cls}`); return html.slice(at); };
const mine = html => { const a = html.indexOf('<div class="rmain">'), b = html.indexOf('<div class="ropp'); return html.slice(a, b); };
const theirs = html => part(html, '<div class="ropp');
const cellsOf = (html, tag) => html.match(new RegExp(`<${tag} class="cell sea[^"]*"[^>]*>`, 'g')) || [];
const cellAt = (cells, i) => cells[i];

test('race: two boards: our sea (16 buttons) large, the computer\'s (16 cells) small with its shots; the ships hidden while open', () => {
  const m = raceMatch(), rng = E.makeRng('s'), all = m.tg.X.concat(m.tg.O);
  const oMiss = notIn(all), xMiss = notIn(all, oMiss + 1), oHit = m.tg.O[0];
  E.applyMove(m, 'O', oMiss, rng); if (m.len > 1) E.applyMove(m, 'O', oHit, rng);
  E.applyMove(m, 'X', xMiss, rng);
  const html = renderMini(state.squares[0]);
  assert.match(html, /class="rboards bsrb"/);
  const my = cellsOf(mine(html), 'button'), their = cellsOf(theirs(html), 'span');
  assert.equal(my.length, 16); assert.equal(their.length, 16);
  assert.match(cellAt(my, xMiss), /cell sea miss/, 'our miss on our sea'); assert.doesNotMatch(cellAt(my, oMiss), /miss|bshit/, 'their shot is not on ours');
  assert.match(cellAt(their, oMiss), /cell sea miss/, 'their miss on their sea');
  if (m.len > 1) { assert.match(cellAt(their, oHit), /cell sea bshit/, 'their hit shows'); assert.match(theirs(html), /<span class="rnote">1\/\d hit · 1 miss<\/span>|<small class="rnote">1\/\d hit · 1 miss<\/small>/); }
  assert.doesNotMatch(html, /cell sea ship/, 'no ship drawn while the square is open');
  assert.equal((mine(html).match(/data-act="move"/g) || []).length, 16, 'our cells fire'); assert.doesNotMatch(theirs(html), /data-act/, 'theirs are read-only');
  assert.match(mine(html), /Hunting · \d part/, 'our hunt\'s card');
  assert.doesNotMatch(html, /left|limit/i, 'no shots-left count');
});

test('race: the computer\'s shot animates on its small sea once, from its flash; the result words and sounds as ever', async () => {
  const m = raceMatch();
  state.turn = 'O';
  const r = E.playMove(state, 0, m.tg.O[0], E.makeRng('c'));
  assert.ok(r.ok); assert.equal(state.flash.hit, true); assert.equal(state.flash.m, m.tg.O[0]);
  const html = renderMini(state.squares[0]);
  assert.doesNotMatch(mine(html), /flipin/, 'nothing animates on our sea');
  const their = cellsOf(theirs(html), 'span');
  assert.match(their[m.tg.O[0]], /flipin/, 'their cell animates');
  if (m.len > 1) assert.match(theirs(html), /bsosil live/, 'their ship\'s parts pop');
  const { moveSounds } = await import('../../src/audio/sound.js');
  const names = moveSounds(state.flash).map(s => s[0]);
  assert.ok(names.includes('fire') && names.includes('boom'), `a hit is heard: ${names}`);
  assert.equal(V.moveText(state.flash, 'Computer'), 'Computer hit!');
  // our own shot: on our sea
  state.flash = null; state.done = null; state.lock = null; state.turn = 'X';
  const xc = notIn(m.tg.X);
  assert.ok(E.playMove(state, 0, xc, E.makeRng('x')).ok);
  const h2 = renderMini(state.squares[0]);
  assert.match(cellsOf(mine(h2), 'button')[xc], /miss flipin/); assert.doesNotMatch(theirs(h2), /flipin/);
});

test('race: the miniature draws both players\' ships with their hits filled in, the same from the hidden square; the Race explainer', async () => {
  const m = raceMatch(), rng = E.makeRng('mm');
  if (m.len > 1) E.applyMove(m, 'X', m.tg.X[0], rng);
  E.applyMove(m, 'O', notIn(m.tg.O), rng);
  state.screen = 'board'; state.zoom = null;
  const board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /class="trace2 tbsr"/);
  const tiles = sq.split('<div class="trp ').slice(1);
  assert.equal(tiles.length, 2); assert.match(tiles[0], /^X/); assert.match(tiles[1], /^O/);
  for (const t of tiles) { assert.match(t, /<svg class="bsv"/, 'a picture'); assert.equal((t.match(/class="hull/g) || []).length, m.len, 'the ship\'s parts'); }
  assert.equal((tiles[0].match(/class="hull hit"/g) || []).length, m.len > 1 ? 1 : 0, "X's hit filled");
  assert.equal((tiles[1].match(/class="hull hit"/g) || []).length, 0, "O's miss fills nothing");
  const { hideMini } = await import('../../src/core/records.js');
  const hidden = JSON.parse(JSON.stringify(m)); hideMini(hidden, 0, state);
  assert.equal(V.miniature(hidden, false), V.miniature(m, false), 'public information only');
  assert.doesNotMatch(V.miniature(m, false), /undefined|NaN/);
  state.screen = 'mini'; state.zoom = 0;
  assert.match(explainOf('bs').play, /your own ship/, 'the Race explainer in an open race square');
});

test('race: a finished square reviewed shows both seas and both ships, the winner\'s sunk; an old race square still draws', () => {
  const m = raceMatch('bs-end'), rng = E.makeRng('e');
  E.applyMove(m, 'O', notIn(m.tg.O), rng);
  for (const c of m.tg.X) E.applyMove(m, 'X', c, rng);
  state.squares[0].owner = 'X'; state.flash = null; state.done = null;
  const review = renderMini(state.squares[0]);
  assert.match(review, /Won by/);
  assert.equal((mine(review).match(/class="cell sea ship X/g) || []).length, m.len, 'our ship, sunk in our colour');
  assert.equal((theirs(review).match(/class="cell sea ship ghost/g) || []).length, m.len, 'their ship shown now');
  assert.match(V.miniature(m, true), /trace2/);
  // a race square from before the rework (one ship, the other side's part kept apart): drawn without throwing
  const old = { type: 'bs', race: true, len: 2, shape: { X: { shots: 1, hits: 0, miss: 1 }, O: {} }, side: { X: { revealed: new Array(16).fill(null), hits: [], last: null } } };
  state.squares[0] = { owner: null, mini: old };
  assert.doesNotThrow(() => renderMini(state.squares[0])); assert.doesNotThrow(() => V.miniature(old, false));
});
