// Race mode on the page (core/race.js, rv 2), Treasure Hunt: the square's screen is two boards (ui/race.js raceBoards):
// this phone's own grid large, with the controls, its digs banded by its own treasure; the other player's smaller grid
// under it, their digs in their bands, their newest opening as it lands; no treasure of an open square in the markup; the
// miniature is each player's thermometer; a claimed square's review shows both treasures; the Race explainer.
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
const V = await import('../../src/games/hunt/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.hunt.view = V;   // (the page registers the views in main.js; here by hand)

function raceMatch(seed) {
  E.setTune('hunt', { mode: 'race' });
  Object.assign(state, E.newMatch(E.makeRng(seed || 'hunt-race'), { games: ['hunt'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', stamp: null, lock: null });
  E.setTune('hunt', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const notMine = (m, p, c) => (c === m.tg[p] ? (c + 1) % 36 : c);
const dig = (m, p, c) => E.applyMove(m, p, notMine(m, p, c), E.makeRng('d'));
const mainOf = html => html.slice(html.indexOf('class="rmain"'), html.indexOf('class="ropp'));
const oppOf = html => html.slice(html.indexOf('class="ropp'));
const dugCells = html => [...html.matchAll(/<button class="dig[^"]*" data-act="move" data-m='(\d+)'[^>]*style="--dbg/g)].map(x => Number(x[1]));
const oppCells = html => [...oppOf(html).matchAll(/<i class="hoc([^"]*)"( style="[^"]*")?>/g)].map(x => ({ cls: x[1], dug: !!x[2] }));

test('race: two boards, ours with our digs and the controls, theirs small with their digs in their bands; no treasure of an open square shows', () => {
  const m = raceMatch();
  dig(m, 'O', 20); dig(m, 'O', 27); dig(m, 'X', 3);
  const html = renderMini(state.squares[0]);
  assert.match(html, /class="rboards hrb"/);
  assert.deepEqual(dugCells(mainOf(html)), m.side.X.dug.map(d => d.i), 'our dig on our grid');
  assert.equal((mainOf(html).match(/data-act="move"/g) || []).length, 36, 'our 36 cells, the controls');
  const opp = oppCells(html);
  assert.equal(opp.length, 36); assert.deepEqual(opp.map((c, i) => (c.dug ? i : -1)).filter(i => i >= 0), m.side.O.dug.map(d => d.i).sort((a, b) => a - b), 'their digs on their grid');
  assert.doesNotMatch(oppOf(html), /data-act=/, 'their board takes no tap');
  assert.match(html, /class="rnote">2 digs</);
  assert.match(html, /class="hkey"/, 'the key stays');
  assert.doesNotMatch(html, /dig found|hoc found/, 'no treasure drawn while the square is open');
});

test('race: their dig lands on their board (the cell opening there), ours untouched; our own dig opens on ours', () => {
  const m = raceMatch('hunt-race-2');
  state.turn = 'O';
  const c = notMine(m, 'O', 14), r = E.playMove(state, 0, c, E.makeRng('c'));
  assert.ok(r.ok);
  assert.equal(state.flash.band, m.side.O.dug[0].k, "the band against O's own treasure");
  let html = renderMini(state.squares[0]);
  assert.doesNotMatch(mainOf(html), /class="dig[^"]* open"/, 'nothing opens on our grid');
  assert.deepEqual(dugCells(mainOf(html)), []);
  assert.match(oppCells(html)[c].cls, /^ open\b/, 'their newest dig opens on their grid');
  assert.match(V.moveText(state.flash, '<b class="O">Computer</b>'), /dug · (Hot|Warm|Cool|Cold)/);
  state.flash = null; state.done = null; state.turn = 'X';
  const x = notMine(m, 'X', 30); E.playMove(state, 0, x, E.makeRng('x'));
  html = renderMini(state.squares[0]);
  assert.match(mainOf(html), new RegExp(`class="dig dug open[^"]*" data-act="move" data-m='${x}'`), 'our dig opens on ours');
  assert.match(mainOf(html), /class="hshov X"/, 'the shovel in our colour'); assert.doesNotMatch(mainOf(html), /class="hby/, 'no digger dots on a grid of our own');
  assert.doesNotMatch(oppOf(html), /hoc open/, 'theirs stays still');
});

test('race: the miniature is a thermometer each (public: the same from the hidden square), fuller as the best dig is nearer; the review shows both treasures', () => {
  const m = raceMatch('hunt-race-3');
  state.screen = 'board'; state.zoom = null;
  let board = renderBoard();
  const sq = board.slice(board.indexOf('<button class="sq'), board.indexOf('</button>'));
  assert.match(sq, /class="trace2 thunt2"/); assert.equal((sq.match(/class="thth [XO]"/g) || []).length, 2);
  const fill = (html, p) => Number(html.match(new RegExp(`class="thth ${p}"[\\s\\S]*?class="thfill" x="9.5" y="([\\d.]+)"`))[1]);
  const before = V.miniature(m, false);
  // X digs right next to its treasure (hot): its thermometer rises; O's stays low
  const t = m.tg.X, near = [t - 1, t + 1, t - 6, t + 6].find(c => c >= 0 && c < 36 && E.huntDist(t, c) === 1);
  E.applyMove(m, 'X', near, E.makeRng('n')); dig(m, 'O', 0);
  const after = V.miniature(m, false);
  assert.ok(fill(after, 'X') < fill(before, 'X'), 'X fuller'); assert.ok(fill(after, 'X') < fill(after, 'O'), 'hot above anything O has');
  const hidden = JSON.parse(JSON.stringify(m)); hideMini(hidden, 0, state);
  assert.equal(V.miniature(hidden, false), after, 'public information only');
  assert.ok(!/undefined|NaN/.test(after));
  // claimed: the review shows both treasures, one on each board
  E.applyMove(m, 'X', t, E.makeRng('w'));
  state.squares[0].owner = 'X'; state.screen = 'mini'; state.zoom = 0;
  const review = renderMini(state.squares[0]);
  assert.match(mainOf(review), new RegExp(`class="dig found[^"]*" data-act="move" data-m='${t}'`));
  assert.equal((oppOf(review).match(/hoc[^"]*found/g) || []).length, 1, "their treasure shown on theirs");
  assert.doesNotMatch(V.miniature(m, true), /undefined|NaN/); assert.match(V.miniature(m, true), /thgem/, "the winner's gem");
  state.squares[0].owner = null;
});

test('race: the explainer is the Race one in an open race square, the usual one in a shared one', () => {
  raceMatch('hunt-race-4');
  assert.match(explainOf('hunt').play, /your own treasure/);
  state.squares[0].mini = E.newMini('hunt', E.makeRng('s'));
  assert.doesNotMatch(explainOf('hunt').play, /your own treasure/);
});
