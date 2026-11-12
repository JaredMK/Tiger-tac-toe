// The race tracks (Snakes and Ladders, Candy Race, Bump: src/ui/track.js, src/games/shared/hops.js): the hops' timings
// (a long move's hops quicker and quicker, the move's length covering them), what a move's screen carries for its
// animation (the trail in the mover's colour, the ladder or snake lit, the words at their moments, the burst), two
// pieces on one space side by side, and the sounds (a hop a space, the piece set down, the bump).
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES } = await import('../../src/games/index.js');
const { HOPS, hopAt } = await import('../../src/games/shared/hops.js');
const VIEWS = {};
for (const t of ['candy', 'bump', 'snakes']) VIEWS[t] = await import(`../../src/games/${t}/view.js`);
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });
const P = E.PLAY;

const fixed = v => () => v;
function play(mini, p, move, rng, kind) {
  const res = E.applyMove(mini, p, move, rng);
  assert.equal(res.ok, true);
  const flash = { kind: kind || (res.outcome === 'win' ? 'claim' : 'move'), by: p, next: p, square: 0, type: mini.type, note: res.note || null, pass: null, timeout: false };
  GAMES[mini.type].rules.moveFlash(move, p, null, 0, mini, flash);
  return flash;
}
// The mover's screen while the move plays (a: its flash), and the square at rest (no flash).
const playing = (mini, f, turn = 'O') => VIEWS[mini.type].screen({ owner: null, mini }, f, null, mini, false, true, f, null, false, () => -1, f.kind === 'claim', turn, '');
const atRest = (mini, turn = 'X') => VIEWS[mini.type].screen({ owner: null, mini }, null, null, mini, false, false, null, null, false, () => -1, false, turn, '');
const sounds = f => { const out = []; VIEWS[f.type].sounds(f, (n, ms, rate) => out.push([n, ms, rate]), f.kind === 'claim', {}, null); return out; };
const count = (html, re) => (html.match(re) || []).length;

test('hops: the first few at the usual pace, a long move quicker and quicker, never under the shortest', () => {
  for (let k = 0; k <= HOPS.even; k++) assert.equal(hopAt(k), k * P.hop);
  let last = P.hop;
  for (let k = HOPS.even + 1; k <= 14; k++) { const d = hopAt(k) - hopAt(k - 1); assert.ok(d <= last && d >= HOPS.min - 1, `hop ${k}: ${d} ms`); last = d; }
  assert.ok(hopAt(13) < 13 * P.hop * 0.8, 'Candy Race\'s longest move takes well under thirteen plain hops');
});
test('Snakes and Ladders: a move up a ladder carries its trail, its ladder lit and its words at the landing; the move lasts through the climb', () => {
  const m = Object.assign(E.newMini('snakes', E.makeRng('sn')), { ladders: [[4, 13], [9, 17]], snakes: [[14, 6], [19, 11]], pos: { X: 1, O: 3 } });
  const f = play(m, 'X', 'roll', fixed(0.4));                       // a 3: space 4, the ladder's foot
  assert.deepEqual([f.roll, f.land, f.to, f.via], [3, 4, 13, 'ladder']);
  const html = playing(m, f), land = P.die + hopAt(3);
  assert.equal(count(html, /class="trl X go"/g), 3, 'a dot on each space left behind, in the mover\'s colour');
  assert.match(html, new RegExp(`class="ladder hot" style="--d:${land}ms"`));
  assert.match(html, new RegExp(`class="rl2" style="--d:${land}ms">· <b class="snlv lad">Ladder!</b> Up to 13`));
  assert.match(html, new RegExp(`class="d3 d3cube roll v0" style="--dur:${P.die}ms"`), 'the shared 3-D die, thrown in, landing as the piece sets off');
  assert.equal(E.playMs(f), land + P.slide + 250);
  const s = sounds(f);
  assert.deepEqual(s.filter(x => x[0] === 'hop').map(x => x[1]), [0, 1, 2].map(k => P.die + hopAt(k)), 'a hop for each space');
  assert.deepEqual(s.find(x => x[0] === 'climb'), ['climb', land, undefined]);
  assert.deepEqual(s.find(x => x[0] === 'c4drop'), ['c4drop', land + P.slide, undefined], 'set down at the ladder\'s top');
  // at rest: the last roll's trail stays, faint (no moments), and no ladder is lit
  const rest = atRest(m, 'O');
  assert.equal(count(rest, /class="trl X"/g), 3); assert.doesNotMatch(rest, / hot"| go"|tburst/);
  assert.match(rest, /class="tok O turn"/, 'the piece of the player to move bobs');
});
test('Snakes and Ladders: a snake\'s head keeps its space clear of a number, and reaching the top is a burst and a longer move', () => {
  const m = Object.assign(E.newMini('snakes', E.makeRng('sn')), { ladders: [[4, 13]], snakes: [[14, 6]], pos: { X: 18, O: 15 } });
  const rest = atRest(m);
  assert.doesNotMatch(rest, />14<\/text>/); assert.match(rest, />13<\/text>/);
  assert.match(rest, /class="space plain snk s0"/); assert.match(rest, /class="space plain lad"/);
  const f = play(m, 'X', 'roll', fixed(0.9));
  assert.equal(f.kind, 'claim');
  const html = playing(m, f);
  assert.match(html, new RegExp(`class="tburst win"[^>]*><g style="--d:${P.die + hopAt(2)}ms"`));
  assert.equal(E.playMs(f), P.die + hopAt(2) + 250 + HOPS.win);
});
test('two pieces on one space sit side by side, neither hiding the other, in the screen and in the miniature', () => {
  for (const [type, pos] of [['snakes', { X: 5, O: 5 }], ['candy', { X: 4, O: 4 }], ['bump', { X: 0, O: 0 }]]) {
    const m = Object.assign(E.newMini(type, E.makeRng('sh')), { pos });
    for (const html of [atRest(m), VIEWS[type].miniature(m, false)]) {
      const at = p => { const t = html.match(new RegExp(`class="tok ${p}[^"]*"[^>]*data-x="([-\\d.]+)" data-y="([-\\d.]+)" data-s="([\\d.]+)"`)); assert.ok(t, `${type}: ${p}'s piece`); return t.slice(1).map(Number); };
      const [x1, y1, s1] = at('X'), [x2, y2, s2] = at('O');
      assert.ok(x2 - x1 >= 5 && y2 > y1 && s1 < 1 && s2 < 1, `${type}: X up and left, O down and right, both smaller`);
    }
  }
});
test('Candy Race: the space the spin leads to lights up, the trail is the mover\'s, the piece is set down at the end of its hops', () => {
  const m = Object.assign(E.newMini('candy', E.makeRng('cd')), { track: ['red', 'green', 'red', 'green', 'red', 'green', 'red', 'green', 'red', 'blue', 'yellow', 'red'], pos: { X: 0, O: 0 } });
  const f = play(m, 'O', 1, fixed(0.3));                            // yellow: ten spaces on
  assert.deepEqual([f.color, f.from, f.to], ['yellow', 0, 10]);
  const html = playing(m, f);
  assert.match(html, /class="space yellow hit"/);
  assert.equal(count(html, /class="trl O go"/g), 10);
  assert.match(html, /Olaf<\/b> spun yellow<i class="cchip yellow"/);
  const s = sounds(f);
  assert.equal(s.filter(x => x[0] === 'hop').length, 10);
  assert.deepEqual(s[s.length - 1], ['c4drop', P.spin + hopAt(10), undefined]);
  assert.equal(E.playMs(f), P.spin + hopAt(10) + 250);
  assert.ok(E.playMs(f) < P.spin + 10 * P.hop + 250, 'a long move is quicker than ten plain hops');
  const mini = VIEWS.candy.miniature(m, false);
  assert.doesNotMatch(mini, /class="trl|tburst|class="numc"/); assert.match(mini, /class="tok X/); assert.match(mini, /class="tok O/);
});
test('Bump: the spaces in reach are tinted for the player to move; a bump bursts where it lands, the knocked piece marked, the spring at the landing', () => {
  const m = Object.assign(E.newMini('bump', E.makeRng('bp')), { pos: { X: 3, O: 5 } });
  const rest = atRest(m, 'X');
  assert.equal(count(rest, /class="space plain reach X"/g), 3);
  const f = play(m, 'X', 'spin', fixed(0.5));                       // a 2: onto O's space
  assert.deepEqual([f.spin, f.to, f.bumped], [2, 5, true]);
  const html = playing(m, f, 'X'), land = P.spin3 + hopAt(2);
  assert.match(html, new RegExp(`class="tburst hit"[^>]*><g style="--d:${land}ms"`));
  assert.match(html, /class="tok O knocked"/); assert.match(html, /class="tok X moved"/);
  assert.match(html, new RegExp(`class="rl2 bmpw" style="--d:${land}ms">· bumped <b class="O">`));
  assert.doesNotMatch(html, /reach/);
  const s = sounds(f);
  assert.deepEqual(s.filter(x => x[0] === 'boing'), [['boing', land, undefined]]);
  assert.deepEqual(s.filter(x => x[0] === 'c4drop'), [['c4drop', land, undefined]]);
  assert.equal(E.playMs(f), land + P.knock + 250);
});
