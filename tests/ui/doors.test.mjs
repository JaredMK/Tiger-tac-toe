// Door Drop's screen (games/doors/view.js), rendered in Node with the browser's names stubbed: the tower's canvas,
// the door buttons for the mover's floor (never the boarded ones, never while a move plays), the result line at its
// moment, the tallies (a map of each player's tower in the race, pips on a shared tower), the miniature (a picture with
// each player's floors, public alone), the move's sounds each at its moment, and the runner's pose through a move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds, SFX } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS, BAD_SOUNDS } = await import('../../src/ui/haptics.js');
const { startFx } = await import('../../src/ui/fx.js');
const V = await import('../../src/games/doors/view.js');
const R = await import('../../src/games/doors/rules.js');
GAMES.doors.view = V;
const D = R.DOORS;

function match(tune = null, turn = 'X') {
  E.setTune('doors', tune);
  Object.assign(state, E.newMatch(E.makeRng('dd-ui'), { games: ['doors'], vs: 'cpu' }), { screen: 'mini', zoom: 4, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[4].mini;
}
const game = html => html.slice(html.indexOf('class="g-dd'));
const wrong = (m, r) => (m.good[r] + 1) % m.d[r];

test('Door Drop: the screen: a canvas, a door button for each door of the mover\'s floor still worth trying, an empty result line', () => {
  const m = match();
  let g = game(renderMini(state.squares[4]));
  assert.ok(g.includes('<canvas class="ddcv"'));
  assert.equal((g.match(/class="ddgo X"/g) || []).length, m.d[0]);
  assert.ok(g.includes('<p class="ddline"></p>'));
  assert.equal((g.match(/class="ddmap sm"/g) || []).length, 2, 'the race: a map of each tower in the tallies');
  assert.ok(!/undefined|NaN/.test(g));
  m.tried.X[0][wrong(m, 0)] = 1;
  g = game(renderMini(state.squares[4]));
  assert.equal((g.match(/class="ddgo X"/g) || []).length, m.d[0] - 1, 'a boarded-up door is no button');
  assert.ok(!g.includes(`data-m="${wrong(m, 0)}"`));
  match({ towers: 'shared' });
  g = game(renderMini(state.squares[4]));
  assert.ok(!g.includes('ddmap') && g.includes('class="pips"'), 'a shared tower: pips');
  E.setTune('doors', null);
});

test('Door Drop: a dead end and a way down: no buttons while it plays, the line at its moment, the sounds each once', () => {
  let m = match();
  assert.ok(E.playMove(state, 4, wrong(m, 0), E.makeRng('w')).ok);
  let f = state.flash; startFx('move', f);
  let g = game(renderMini(state.squares[4]));
  assert.ok(!g.includes('ddgo'), 'no buttons while the move plays');
  assert.ok(g.includes(`<p class="ddline no appear" style="--t:${R.doorsIn() + D.dark + D.out}ms" role="status">Dead end!</p>`));
  assert.equal(E.playMs(f), R.doorsDeadMs());
  const s1 = moveSounds(f).filter(x => /^dd/.test(x[0])).map(x => [x[0], x[1]]);
  assert.deepEqual(s1, [['ddStep', 0], ['ddStep', Math.round(D.walk / 3)], ['ddStep', Math.round(2 * D.walk / 3)], ['ddCreak', D.walk], ['ddDark', R.doorsIn()], ['ddCreak', R.doorsIn() + D.dark], ['ddBonk', R.doorsIn() + D.dark + D.out]]);
  m = match();
  assert.ok(E.playMove(state, 4, m.good[0], E.makeRng('g')).ok);
  f = state.flash; startFx('move', f);
  g = game(renderMini(state.squares[4]));
  assert.ok(g.includes(`<p class="ddline ok appear" style="--t:${R.doorsIn() + D.dark + D.drop}ms" role="status">Down a floor!</p>`));
  assert.equal(E.playMs(f), R.doorsDownMs());
  assert.deepEqual(moveSounds(f).filter(x => /^dd/.test(x[0])).map(x => x[0]).slice(-2), ['ddFall', 'ddLand']);
  for (const k of ['ddStep', 'ddCreak', 'ddDark', 'ddBonk', 'ddFall', 'ddLand']) assert.ok(SFX[k], k);
  assert.ok(RESULT_SOUNDS.has('ddLand') && BAD_SOUNDS.has('ddBonk'));
  E.setTune('doors', null);
});

test('Door Drop: the ground floor wins: its line, its timings (the hop of joy) and the won chime as the runner lands', () => {
  const m = match({ floors: 1 });
  assert.ok(E.playMove(state, 4, m.good[0], E.makeRng('g')).ok);
  const f = state.flash; startFx('move', f);
  assert.ok(f.kind === 'claim' || f.kind === 'match');
  const g = game(renderMini(state.squares[4]));
  assert.ok(g.includes('>Ground floor!</p>'));
  assert.equal(E.playMs(f), R.doorsDownMs() + D.win);
  const land = R.doorsIn() + D.dark + D.drop + D.land;
  assert.equal(V.wonAt(f, E.playMs(f)), land);
  E.setTune('doors', null);
});

test('Door Drop: the runner\'s pose through a move: walks to the door, gone in the dark, out of another door or a floor down', () => {
  const s = { r: 0, i: 1, down: false, out: 3, from: 50, ix: 38, ox: 88 };
  let P = V.doorsPose(s, 0, 3); assert.deepEqual([P.x, P.y, P.al], [50, 1, 1]);
  P = V.doorsPose(s, D.walk, 3); assert.equal(P.x, 38);
  P = V.doorsPose(s, R.doorsIn() + D.dark / 2, 3); assert.equal(P.al, 0); assert.ok(P.dim > 0.9, 'the dark');
  P = V.doorsPose(s, R.doorsDeadMs(), 3); assert.deepEqual([P.x, P.y, P.al, P.mark], [88, 1, 1, true], 'out of the other door, on the same floor, the door tried marked');
  const d = Object.assign({}, s, { down: true });
  P = V.doorsPose(d, R.doorsIn() + D.dark + D.drop / 2, 3); assert.ok(P.y > 1 && P.y < 2 && P.x === 38, 'dropping');
  P = V.doorsPose(d, R.doorsDownMs(), 3); assert.equal(P.y, 2, 'a floor down');
});

test('Door Drop: the miniature: a picture of the tower(s) with each player\'s floors; public alone', () => {
  const m = match();
  m.at.X = 1; m.tried.X[0][m.good[0]] = 2; m.tried.O[0][wrong(m, 0)] = 1;
  const h = V.miniature(m);
  assert.ok(h.includes('class="tart tddw"') && (h.match(/<svg class="ddmap/g) || []).length === 2);
  assert.ok(h.includes('ddmd s2') && h.includes('ddmd s1'));
  assert.equal((h.match(/class="tr X"[^>]*>.*?<\/div>/)[0].match(/ on/g) || []).length, 1);
  assert.ok(!/good|undefined|NaN/.test(h));
  E.setTune('doors', null);
});
