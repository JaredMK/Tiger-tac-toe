// Dominoes: the screen draws the viewer's own hand face up and never the other player's tiles (their count alone, as
// a face-down stack); a placed tile carries its placer's dot; the ghost of a tile that fits both ends sits at each; the
// replay's synthetic inputs pick the tile then make the move; the miniature is the line and the counts. Rendered in Node
// with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const V = await import('../../src/games/dominoes/view.js');
const { state } = await import('../../src/ui/app.js');

const id = (a, b) => { const [x, y] = a <= b ? [a, b] : [b, a]; return y * (y + 1) / 2 + x; };
const sq = o => Object.assign({ type: 'dominoes', pips: 6, line: [], left: 0, hands: { X: [], O: [] }, pile: [], played: { X: 0, O: 0 }, last: null }, o);
const setup = () => { state.online = null; state.cpu = ['O']; state.screen = 'mini'; state.zoom = 0; state.turn = 'X'; state.flash = null; state.done = null; state.setup = Object.assign({}, state.setup, { names: { X: 'Jared', O: 'Computer' } }); };
const tilesIn = html => [...html.matchAll(/<button class="domtile[^"]*"[^>]*? data-act="domtile" data-i="(\d+)"/g)].map(m => Number(m[1]));

test('Dominoes: the viewer sees their own tiles, the ones that fit lit, and the other hand as a count alone; a tile fitting both ends shows a ghost at each', () => {
  setup();
  const mini = sq({ line: [[2, 5, 'X'], [5, 5, 'O']], hands: { X: [id(0, 0), id(2, 5), id(3, 5)], O: [id(1, 1), id(6, 6)] }, pile: [1, 2, 3] });
  state.squares[0] = { owner: null, mini };
  const html = V.screen(state.squares[0], null, null, mini, false, false, null, null, () => false, () => -1, false, 'X', '');
  assert.deepEqual(tilesIn(html), [id(0, 0), id(2, 5), id(3, 5)], 'X\'s hand, as tappable tiles');
  assert.doesNotMatch(html, /data-i="2"|data-i="27"/, 'none of O\'s tiles');
  assert.match(html, /class="domtile dim"[^>]*? data-act="domtile" data-i="0"[^>]*disabled/, 'the 0-0 fits nothing: dimmed, no tap');
  assert.match(html, /class="domtile"[^>]*? data-act="domtile" data-i="17"[^>]*aria-label="2-5">/, 'the 2-5 fits: lit');
  assert.equal((html.match(/class="dslot"/g) || []).length, 2, 'two tiles on the table');
  assert.match(html, /<circle class="dby X"/); assert.match(html, /<circle class="dby O"/);
  assert.match(html, /aria-label="2 tiles in hand"/); assert.match(html, /aria-label="3 tiles in hand"/);
  assert.match(html, /class="dompile"[^>]*? data-act="move" data-m='"draw"' aria-label="3 tiles in the boneyard" disabled/, 'a tile fits: the boneyard is no button');
  // the 2-5 fits both ends (2 and 5): picked, a ghost at each
  V.domtileAct({ dataset: { i: String(id(2, 5)) } }, null, 'domtile');
  const h2 = V.screen(state.squares[0], null, null, mini, false, false, null, null, () => false, () => -1, false, 'X', '');
  assert.equal((h2.match(/class="dslot dghost"/g) || []).length, 2);
  assert.match(h2, /class="domend" data-act="move" data-e="L" data-m='\{"t":17,"e":"L"\}'/); assert.match(h2, /data-e="R" data-m='\{"t":17,"e":"R"\}'/);
  assert.match(h2, /class="domtile sel"/);
  V.domtileAct({ dataset: { i: String(id(2, 5)) } }, null, 'domtile');   // tapped again: put back
  const h3 = V.screen(state.squares[0], null, null, mini, false, false, null, null, () => false, () => -1, false, 'X', '');
  assert.doesNotMatch(h3, /dghost/);
  // nothing fits: the boneyard is the Draw button; empty, Pass
  const m2 = sq({ line: [[2, 5, 'X']], hands: { X: [id(0, 0), id(1, 1)], O: [id(6, 6)] }, pile: [1, 2] });
  state.squares[0] = { owner: null, mini: m2 };
  const h4 = V.screen(state.squares[0], null, null, m2, false, false, null, null, () => false, () => -1, false, 'X', '');
  assert.match(h4, /class="dompile go draw"[^>]*? data-act="move" data-m='"draw"' aria-label="2 tiles in the boneyard: draw"/);
  m2.pile = [];
  const h5 = V.screen(state.squares[0], null, null, m2, false, false, null, null, () => false, () => -1, false, 'X', '');
  assert.match(h5, /class="dompile go pass"[^>]*? data-act="move" data-m='"pass"'/);
  assert.doesNotMatch(h5, /undefined|NaN/);
});

test('Dominoes: a move replayed animates from its recorded flash: the placed tile slides in from its player\'s side, the counts take their new values as it lands; the synthetic inputs pick the tile, then the move', () => {
  setup();
  const mini = sq({ line: [[6, 2, 'O'], [2, 5, 'X'], [5, 5, 'O']], left: 1, hands: { X: [id(0, 0), id(3, 5)], O: [id(1, 1)] }, pile: [1, 2, 3] });
  state.squares[0] = { owner: null, mini };
  const f = { kind: 'move', by: 'O', square: 0, type: 'dominoes', dom: { by: 'O', kind: 'play', t: id(2, 6), tile: [6, 2], e: 'L', pos: -1, left: 1, pile: 3 } };
  const html = V.screen(state.squares[0], f, null, mini, false, true, f, null, () => false, () => -1, false, 'X', '');
  assert.match(html, /class="dslot dslide" style="--dy:-[\d.]+px;--t:0ms;--d:420ms"/, 'the other player\'s tile comes in from the top (reduced motion here: card motion\'s flight is tests/ui/cardfly.test.mjs)');
  assert.match(html, /<b class="dtick"><span class="dtvo" style="--t2:580ms">2<\/span><span class="dtv" style="--t:580ms">1<\/span><\/b>/, 'O\'s count: 2 to 1 as the tile lands');
  assert.match(html, /class="domres appear" style="--t:580ms" role="status"><span><b class="O">.*<\/b> played 6·2<\/span><\/p>/, 'the words in one inline box after the name, its space kept');
  const own = Object.assign({}, f, { by: 'X', dom: Object.assign({}, f.dom, { by: 'X' }) });
  assert.match(V.screen(state.squares[0], own, null, mini, false, true, own, null, () => false, () => -1, false, 'X', ''), /--dy:[\d.]+px/, 'the viewer\'s own tile from the bottom');
  // X draws two: the square as X saw it before (one tile), then the draw's flash with the hand grown by two
  mini.hands.X = [id(0, 0)]; mini.pile = [1, 2, 3];
  V.screen(state.squares[0], null, null, mini, false, false, null, null, () => false, () => -1, false, 'X', '');
  mini.hands.X = [id(0, 0), id(1, 4), id(3, 5)]; mini.pile = [1];
  const drawF = { kind: 'again', by: 'X', square: 0, type: 'dominoes', dom: { by: 'X', kind: 'draw', drew: 2, fits: true, left: 3, pile: 1 } };
  const hd = V.screen(state.squares[0], drawF, null, mini, false, true, drawF, null, () => false, () => -1, false, 'X', '');
  assert.match(hd, /class="dompile"[^>]*? data-act="move" data-m='"draw"'[^>]*><span class="dpstk"[^>]*><i><\/i><i class="dmout" style="--t:60ms"><\/i><i class="dmout" style="--t:360ms"><\/i><\/span><b class="dtick"><span class="dtvo" style="--t2:60ms">3<\/span><span class="dtv dtvo" style="--t:60ms;--t2:360ms">2<\/span><span class="dtv" style="--t:360ms">1<\/span><\/b>/, 'the boneyard counts down as each tile comes off, its stack losing one each time');
  assert.match(hd, /aria-label="3 tiles in hand"><span class="dstk"[^>]*? aria-hidden="true"><i><\/i><i class="dmin" style="--t:60ms;--d:240ms" data-cf="bone" data-cfat="60" data-cfd="240"><\/i><i class="dmin" style="--t:360ms;--d:240ms" data-cf="bone" data-cfat="360" data-cfd="240"><\/i><\/span><b class="dtick"><span class="dtvo" style="--t2:300ms">1<\/span><span class="dtv dtvo" style="--t:300ms;--t2:600ms">2<\/span><span class="dtv" style="--t:600ms">3<\/span><\/b>/, 'X\'s stack takes the two tiles one by one, the count ticking up as each lands');
  assert.match(hd, new RegExp(`class="domtile dmin"[^>]*? data-act="domtile" data-i="${id(1, 4)}" style="--t:60ms;--d:240ms" data-cf="bone"`)); assert.match(hd, new RegExp(`class="domtile dmin"[^>]*? data-act="domtile" data-i="${id(3, 5)}" style="--t:360ms;--d:240ms" data-cf="bone"`));
  assert.doesNotMatch(hd, /data-i="0" style/, 'the tile held before stays put');
  assert.deepEqual(V.replay.synth({ t: 17, e: 'L' }, mini), [[0, 'domtile', 'i=17'], [560, 'move', 'm={"t":17,"e":"L"}']]);
  assert.equal(V.replay.synth('draw', mini), null, 'a draw: the one press on the boneyard');
  assert.equal(V.replay.input('domtile', 'i=17', { sq: 0, by: 'O' }), false);
  assert.deepEqual(V.domDraft, { sq: 0, t: 17, by: 'O' }, 'their pick, for its ghost');
  assert.equal(V.moveText({ dom: f.dom }, 'Computer'), 'Computer played 6-2');
  assert.equal(V.moveText({ dom: { kind: 'draw', drew: 3 } }, 'Computer'), 'Computer drew 3 tiles');
  assert.equal(V.moveText({ dom: { kind: 'play', tile: [1, 1], left: 0 } }, 'Jared'), 'Jared played 1-1 · last tile!');
  assert.equal(V.moveText({ dom: { kind: 'draw', blocked: true, pips: { X: 4, O: 9 } } }, 'Jared'), 'Blocked: 4 to 9 pips');
  const snd = []; V.sounds({ dom: f.dom }, (n, t) => snd.push([n, t]), false, mini, null);
  assert.deepEqual(snd, [['domClick', 580]]);
  snd.length = 0; V.sounds({ dom: { kind: 'draw', drew: 2, fits: false, blocked: true, pips: { X: 1, O: 2 } } }, (n, t) => snd.push([n, t]), true, mini, null);
  assert.deepEqual(snd, [['cardSlide', 60], ['cardSlide', 360], ['knock', 660], ['knock', 900], ['knock', 1160], ['ding', 1600]], 'a slide as each tile comes, once each');
  snd.length = 0; V.sounds({ dom: { kind: 'draw', drew: 3, fits: true } }, (n, t) => snd.push([n, t]), false, mini, null);
  assert.deepEqual(snd, [['cardSlide', 60], ['cardSlide', 360], ['cardSlide', 660], ['domClick', 960]]);
});

test('Dominoes: the miniature is the line\'s last tiles and each player\'s count, the same from the square as the other phone has it', () => {
  setup();
  const mini = sq({ line: [[6, 2, 'O'], [2, 5, 'X'], [5, 5, 'O'], [5, 1, 'X'], [1, 1, 'O'], [1, 4, 'X']], left: 1, hands: { X: [id(0, 0), id(3, 5)], O: [id(1, 1)] }, pile: [1, 2, 3] });
  const html = V.miniature(mini, false);
  assert.match(html, /<svg class="tdom"/); assert.equal((html.match(/<g class="dtl">/g) || []).length, 6, 'the last six tiles');
  assert.match(html, /class="tr tdr X"><b class="X">X<\/b><i class="tdstk" style="--n:2"><\/i><small class="tdn">2<\/small>/);
  assert.match(html, /class="tr tdr O">.*--n:1.*<small class="tdn">1<\/small>/);
  const pub = E.publicMini(mini); delete pub.hands; pub.pileN = 3;
  assert.equal(V.miniature(pub, false), html, 'from the counts alone');
  assert.match(V.miniature(sq({}), false), /class="dempty"/, 'an empty table');
});
