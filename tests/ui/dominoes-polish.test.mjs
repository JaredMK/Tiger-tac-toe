// Dominoes' look and feel (the polish sweep, November 2026; src/games/dominoes/view.js), rendered in Node with the
// browser's names stubbed (motion on): every tile on the felt has its thickness under it; the tile laid last is haloed
// in its player's colour, live as it lands and at rest until the next move; the last tile out sends a wave of hops out
// along the line; the hand's tiles are four across at most while it holds eight or fewer (two rows, large); a tile
// picked up or put back plays its own tick, a tile played its slide and its click, never the interface's tap. The
// controls are as they were: a tap on a hand tile, an end button where it fits both, the boneyard's Draw or Pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/dominoes/rules.js');
const V = await import('../../src/games/dominoes/view.js');
const { state } = await import('../../src/ui/app.js');

const id = (a, b) => { const [x, y] = a <= b ? [a, b] : [b, a]; return y * (y + 1) / 2 + x; };
const sq = o => Object.assign({ type: 'dominoes', pips: 6, line: [], left: 0, hands: { X: [], O: [] }, pile: [], played: { X: 0, O: 0 }, last: null }, o);
const setup = () => { state.online = null; state.cpu = ['O']; state.screen = 'mini'; state.zoom = 0; state.turn = 'X'; state.flash = null; state.done = null; state.setup = Object.assign({}, state.setup, { names: { X: 'Jared', O: 'Computer' } }); };
const draw = (mini, f, o = {}) => V.screen(state.squares[0], f || null, null, mini, !!o.view, !!f || !!o.locked, f || null, null, () => false, () => -1, false, o.turn || 'X', '');
const slots = html => [...html.matchAll(/<g class="dslot([^"]*)"[^>]*>(.*?)<\/g><\/g>(?=<g class="dslot|<\/svg>)/g)].map(m => ({ cls: m[1].trim(), body: m[2] }));

test('the table: every tile has its thickness under it; the tile laid last is haloed in its player\'s colour until the next move', () => {
  setup();
  const mini = sq({ line: [[6, 2, 'O'], [2, 5, 'X'], [5, 5, 'O']], left: 1, hands: { X: [id(0, 0), id(3, 5)], O: [id(1, 1)] }, pile: [1, 2, 3], last: { by: 'O', kind: 'play', t: id(2, 6), tile: [6, 2], e: 'L', pos: -1, left: 1, pile: 3 } });
  state.squares[0] = { owner: null, mini };
  let html = draw(mini);
  assert.equal((html.match(/<svg class="domsvg".*?<\/svg>/s)[0].match(/class="dshd"/g) || []).length, 3, 'a shade under each tile on the felt');
  assert.equal((html.match(/class="dlastr O"/g) || []).length, 1, 'one halo, O\'s');
  assert.match(slots(html)[0].body, /class="dlastr O"/, 'on the tile at the left end, the one O laid');
  assert.ok(!/class="dring/.test(html), 'never Districts\' ring class');
  // a draw is the latest move: no tile is the last one laid
  mini.last = { by: 'X', kind: 'draw', drew: 1, fits: true };
  assert.ok(!/dlastr/.test(draw(mini)));
  // live: the tile flying in carries it as it lands
  const f = { kind: 'move', by: 'X', square: 0, type: 'dominoes', dom: { by: 'X', kind: 'play', t: id(3, 5), tile: [5, 3], e: 'R', pos: 2, left: 1, pile: 3 } };
  mini.line.push([5, 3, 'X']); mini.hands.X = [id(0, 0)];
  html = draw(mini, f);
  assert.equal((html.match(/class="dlastr X"/g) || []).length, 1, 'on the table\'s tile, which shows as the flight lands');
  assert.match(html, /class="dslot dlate" style="[^"]*--t:\d+ms[^"]*">.*?class="dlastr X"/);
  assert.match(html, /class="domfly"[^>]*data-cf="tile:\d+" data-cfat="0" data-cfwait="" data-cfgo=""/, 'the tile flies from its place in the hand');
  assert.ok(!/class="dwv"/.test(html), 'a tile in hand still: no wave');
});

test('the last tile out: a wave of hops along the line, out from the tile, after it lands', () => {
  setup();
  const line = [[6, 2, 'O'], [2, 5, 'X'], [5, 5, 'O'], [5, 3, 'X']];
  const mini = sq({ line, left: 1, hands: { X: [], O: [id(1, 1)] }, pile: [1, 2, 3] });
  state.squares[0] = { owner: 'X', mini };
  const dm = { by: 'X', kind: 'play', t: id(3, 5), tile: [5, 3], e: 'R', pos: 2, left: 0, pile: 3 }, f = { kind: 'claim', by: 'X', square: 0, type: 'dominoes', dom: dm };
  const html = draw(mini, f), land = R.domTimes(dm).land;
  const waves = [...html.matchAll(/<g class="dwv" style="--t:(\d+)ms">/g)].map(m => Number(m[1]));
  assert.deepEqual(waves, [3, 2, 1, 0].map(d => Math.round(land + 120 + d * 55)), 'each tile a beat after its neighbour, the last tile first');
  assert.match(html, /last tile!/);
  const blocked = Object.assign({}, f, { dom: Object.assign({}, dm, { left: 1, blocked: true, pips: { X: 3, O: 2 } }) });
  assert.ok(!/class="dwv"/.test(draw(mini, blocked)), 'a block is no wave');
});

test('the hand: four across at most while it holds eight or fewer, more columns only past that; the fitting tiles are the only ones to tap', () => {
  setup();
  const hand = [id(0, 0), id(2, 5), id(3, 5), id(1, 4), id(0, 6)];
  const mini = sq({ line: [[2, 5, 'X'], [5, 5, 'O']], hands: { X: hand.slice(0, 3), O: [id(1, 1)] }, pile: [1, 2, 3] });
  state.squares[0] = { owner: null, mini };
  assert.match(draw(mini), /class="domhand" style="--cols:4"/);
  mini.hands.X = hand; assert.match(draw(mini), /class="domhand" style="--cols:4"/);
  mini.hands.X = Array.from({ length: 11 }, (_, k) => k + 3); assert.match(draw(mini), /class="domhand" style="--cols:6"/);
  mini.hands.X = hand.slice(0, 3);
  const html = draw(mini), open = [...html.matchAll(/<button class="domtile[^"]*"[^>]*data-i="(\d+)"[^>]*>/g)].filter(m => !/ disabled/.test(m[0])).map(m => Number(m[1]));
  assert.deepEqual(open, [id(2, 5), id(3, 5)]);
  assert.match(draw(mini, null, { view: true }), /class="domhand two" style="--cols:6"/, 'looked back at: both hands, small');
});

test('the sounds: a tile picked or put back ticks, a tile played slides and clicks; the interface\'s tap stays out of it', () => {
  const src = fs.readFileSync(new URL('../../src/audio/sound.js', import.meta.url), 'utf8');
  assert.match(src, /domtile: null/, 'a hand tile is the game\'s own input');
  const snd = []; V.sounds({ dom: { by: 'X', kind: 'play', t: 3, tile: [1, 2], e: 'R', pos: 1, left: 2, pile: 3 } }, (n, t, r) => snd.push([n, t]), false, {}, null);
  assert.deepEqual(snd.map(s => s[0]), ['cardSlide', 'domClick']); assert.equal(snd[0][1], 0);
});
