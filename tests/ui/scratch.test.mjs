// Scratch & Match's screen and miniature (src/games/scratch/view.js), rendered in Node with the browser's names stubbed:
// the move's controls sit on the mover's own card alone (so a replay presses the right panel), a hidden panel carries no
// picture (nothing of the card is in the page before it is scratched), the scratch animates from the move's recorded
// flash (never the square's last, which may be the viewer's own), and the miniature shows public information only.
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
const V = await import('../../src/games/scratch/view.js');
const { SCR } = await import('../../src/games/scratch/rules.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });
const clone = v => JSON.parse(JSON.stringify(v));
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
function play(mini, p, move) {
  const m = clone(mini), res = E.applyMove(m, p, move, lcg(1));
  assert.equal(res.ok, true);
  const flash = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p, square: 0, type: m.type, note: res.note || null, pass: null, timeout: false };
  GAMES.scratch.rules.moveFlash(move, p, null, 0, m, flash);
  return { mini: m, flash, res };
}
const screen = (sq, f, turn, opts = {}) => V.screen(sq, f, null, sq.mini, !!opts.view, !!opts.locked || !!f, f && f.type === 'scratch' ? f : null, null, i => !!(sq.mini.winCells && sq.mini.winCells.includes(i)), i => (sq.mini.winCells ? sq.mini.winCells.indexOf(i) : -1), !!(f && f.kind === 'claim'), turn, '');
const count = (html, re) => (html.match(re) || []).length;
const m0 = (() => { const m = E.newMini('scratch', E.makeRng('ui')); m.cards = { X: [0, 0, 0, 1, 2, 1, 3, 2, 4], O: [1, 2, 3, 4, 4, 2, 3, 3, 3] }; return m; })();

test('the move\'s controls are the nine panels of the player to move, on their card alone; a hidden panel holds no picture', () => {
  const html = screen({ owner: null, mini: m0 }, null, 'X');
  assert.equal(count(html, /data-act="move"/g), 9);
  const [cx, co] = html.split('<div class="scard O');
  assert.equal(count(cx, /data-act="move"/g), 9); assert.equal(count(co, /data-act="move"/g), 0);
  assert.equal(count(html, /class="spic"/g), 0, 'nothing of either card in the page');
  assert.equal(count(html, /class="sfrost"/g), 18, 'every panel frosted');
  assert.match(html, /class="scard X on"/); assert.doesNotMatch(html, /class="scard O on"/);
  const o = screen({ owner: null, mini: m0 }, null, 'O');
  assert.equal(count(o.split('<div class="scard O')[1], /data-act="move"/g), 9, 'O to move: O\'s card');
  assert.match(o, /class="scard O on"/);
  assert.match(html, /tnm">Xena/); assert.match(html, /tnm">Olaf/);
});

test('a scratch animates from the move\'s flash on the mover\'s card: the frost rubbed off that panel, the picture under it; the viewer\'s own last result never moves', () => {
  const x = play(m0, 'X', 4), o = play(x.mini, 'O', 8);
  // the replay on X's phone: the square as it stands with O's move in, X's own scratch at 4 settled, O's at 8 playing
  const html = screen({ owner: null, mini: o.mini }, o.flash, 'O');
  const [cx, co] = html.split('<div class="scard O');
  assert.equal(count(co, /class="sspot open rub"/g), 1, 'O\'s panel rubbed');
  assert.match(co, /class="sspot open rub" data-act="move" data-m='8'/);
  assert.equal(count(cx, /rub/g), 0, 'nothing of X\'s card animates');
  assert.match(cx, /class="sspot open"[^>]*aria-label="Row 2 column 2, \w+" disabled/);
  assert.equal(count(html, /class="spic"/g), 2, 'the two scratched pictures, nothing else');
  assert.equal(count(co, /class="sfrost"/g), 9, 'the rubbed panel keeps its frost for the animation; the others theirs');
  assert.equal(count(cx, /class="sfrost"/g), 8);
  // a pair: both its panels ring; the tally's third pip stays empty, the second fills in as the picture lands
  const o2 = play(o.mini, 'O', 7);
  assert.equal(o2.flash.scratch.c, 2); assert.deepEqual(o2.flash.scratch.same, [8]);
  const h2 = screen({ owner: null, mini: o2.mini }, o2.flash, 'O');
  assert.equal(count(h2.split('<div class="scard O')[1], /sspot open[^"]*hit/g), 2);
  assert.match(h2, new RegExp(`class="ctal O now"[\\s\\S]*?<i class="on"></i><i class="on fillin" style="--t:${SCR.rub + SCR.pop}ms"></i><i class=""></i>`));
  assert.match(V.moveText(o2.flash, 'Olaf'), /Olaf found a pair of/);
  assert.match(V.moveText(o.flash, 'Olaf'), /Olaf found an? /);
  // three of a kind: the claim's glow on the three, in turn
  const o3 = play(o2.mini, 'O', 6);
  assert.equal(o3.res.outcome, 'win'); o3.mini.winCells = o3.res.cells;
  const h3 = screen({ owner: 'O', mini: o3.mini }, o3.flash, 'O');
  assert.equal(count(h3, /sspot open[^"]*wn glow/g), 3);
  assert.match(h3, /sspot open rub wn glow" data-act="move" data-m='6' style="--k:0"/);
  assert.match(V.moveText(o3.flash, 'Olaf'), /Olaf found three \w+!/);
  // once settled (no flash), nothing animates and every scratched panel shows its picture
  const h4 = screen({ owner: 'O', mini: o3.mini }, null, 'X', { view: true });
  assert.equal(count(h4, /rub|glow|hit/g), 0); assert.equal(count(h4, /class="spic"/g), 4); assert.equal(count(h4, /data-act="move"/g), 0);
});

test('the sounds come from the move: the rubs, the plop, a pair\'s ding or three\'s sparkle; the miniature shows both cards from public information alone', () => {
  const x = play(m0, 'X', 0), got = [];
  V.sounds(x.flash, (n, at) => got.push([n, at]), false, x.mini, null);
  assert.deepEqual(got.map(s => s[0]), ['scratch', 'scratch', 'scratch', 'plop']);
  const x2 = play(x.mini, 'X', 1), got2 = [];
  V.sounds(x2.flash, (n, at) => got2.push(n), false, x2.mini, null);
  assert.ok(got2.includes('ding'));
  const x3 = play(x2.mini, 'X', 2), got3 = [];
  V.sounds(x3.flash, (n, at) => got3.push(n), true, x3.mini, null);
  assert.ok(got3.includes('sparkle') && !got3.includes('ding'));
  const t = V.miniature(x2.mini, false);
  assert.match(t, /<svg class="tscr"/); assert.equal(count(t, /class="tsp"/g), 2); assert.equal(count(t, /class="tsf"/g), 16);
  const hidden = clone(x2.mini); delete hidden.cards;
  assert.equal(V.miniature(hidden, false), t, 'the same without the cards');
  x3.mini.winCells = x3.res.cells;
  assert.equal(count(V.miniature(x3.mini, true), /tsw/g), 3, 'three of a kind ringed');
});
