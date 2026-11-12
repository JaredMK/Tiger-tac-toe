// Scratch & Match's screen and miniature (src/games/scratch/view.js), rendered in Node with the browser's names stubbed:
// the move's controls sit on the mover's own card alone (so a replay presses the right panel), this phone's own card is
// the large one (the mover's on a phone two share), a hidden panel carries no picture (nothing of the card is in the
// page before it is scratched), the scratch animates from the move's recorded flash (never the square's last, which may
// be the viewer's own) with its result on the result line, and the miniature shows public information only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });   // (no reduced motion here: the move's animation is what is tested)
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

// the two cards of a screen, by player (the large one comes first in the markup: this phone's own, or the mover's)
const cardsOf = html => { const out = {}; for (const part of html.split('<div class="scard ').slice(1)) out[part[0]] = part.split('<div class="sline">')[0]; return out; };

test('the move\'s controls are the nine panels of the player to move, on their card alone (the large one on a phone two share); a hidden panel holds no picture', () => {
  const html = screen({ owner: null, mini: m0 }, null, 'X');
  assert.equal(count(html, /data-act="move"/g), 9);
  const c = cardsOf(html);
  assert.equal(count(c.X, /data-act="move"/g), 9); assert.equal(count(c.O, /data-act="move"/g), 0);
  assert.equal(count(html, /class="spic"/g), 0, 'nothing of either card in the page');
  assert.equal(count(html, /class="sfrost"/g), 18, 'every panel under its foil');
  assert.match(html, /<div class="smain"><div class="scard X big on"/); assert.match(html, /<div class="ssml"><div class="scard O sml"/);
  assert.match(html, /class="sfound none"/, 'the result line is there, empty');
  const o = screen({ owner: null, mini: m0 }, null, 'O');
  assert.equal(count(cardsOf(o).O, /data-act="move"/g), 9, 'O to move: O\'s card');
  assert.match(o, /<div class="smain"><div class="scard O big on"/, 'two on one phone: the mover\'s card is the large one');
  assert.match(html, /tnm">Xena/); assert.match(html, /tnm">Olaf/);
  assert.equal(count(html, /class="stab"/g), 2, 'each ticket carries its player\'s face');
});

test('against the computer or online this phone\'s own card stays the large one; the other player\'s scratch plays on the small one', () => {
  const x = play(m0, 'X', 4), o = play(x.mini, 'O', 8);
  state.cpu = 'O';
  try {
    const html = screen({ owner: null, mini: o.mini }, o.flash, 'O');
    assert.match(html, /<div class="smain"><div class="scard X big"/); assert.match(html, /<div class="ssml"><div class="scard O sml on"/);
    assert.match(cardsOf(html).O, /class="sspot open rub" data-act="move" data-m='8'/);
  } finally { state.cpu = null; }
});

test('a scratch animates from the move\'s flash on the mover\'s card: the foil rubbed off that panel under the coin, flecks flying, the picture under it; the viewer\'s own last result never moves', () => {
  const x = play(m0, 'X', 4), o = play(x.mini, 'O', 8);
  // the replay on X's phone: the square as it stands with O's move in, X's own scratch at 4 settled, O's at 8 playing
  const html = screen({ owner: null, mini: o.mini }, o.flash, 'O');
  const c = cardsOf(html);
  assert.equal(count(c.O, /class="sspot open rub"/g), 1, 'O\'s panel rubbed');
  assert.match(c.O, /class="sspot open rub" data-act="move" data-m='8'/);
  assert.equal(count(c.O, /class="scoin"/g), 1, 'the coin'); assert.ok(count(c.O, /class="sflk"/g) >= 6, 'the flecks');
  assert.equal(count(c.X, /rub|scoin|sflk/g), 0, 'nothing of X\'s card animates');
  assert.match(c.X, /class="sspot open"[^>]*aria-label="Row 2 column 2, \w+" disabled/);
  assert.equal(count(c.X + c.O, /class="spic"/g), 2, 'the two scratched pictures, nothing else');
  assert.equal(count(c.O, /class="sfrost"/g), 9, 'the rubbed panel keeps its foil for the animation; the others theirs');
  assert.equal(count(c.X, /class="sfrost"/g), 8);
  // the result line: what O's scratch came to, as its picture pops (never X's)
  assert.match(html, new RegExp(`<div class="sline"><div class="sfound O c1 appear" style="--t:${SCR.rub}ms" role="status">`));
  // at rest: the last scratch marked with its dot, its result still on the line
  const rest = screen({ owner: null, mini: o.mini }, null, 'X');
  assert.match(cardsOf(rest).O, /class="sspot open lst"[^>]*aria-label="Row 3 column 3/); assert.equal(count(rest, / lst"/g), 1);
  assert.match(rest, /<div class="sfound O c1" role="status">/); assert.doesNotMatch(rest, /appear|rub|scoin|sflk/);
  // a pair: both its panels ring; the tally's third pip stays empty, the second fills in as the picture lands
  const o2 = play(o.mini, 'O', 7);
  assert.equal(o2.flash.scratch.c, 2); assert.deepEqual(o2.flash.scratch.same, [8]);
  const h2 = screen({ owner: null, mini: o2.mini }, o2.flash, 'O');
  assert.equal(count(cardsOf(h2).O, /sspot open[^"]*hit/g), 2);
  assert.match(h2, new RegExp(`class="ctal O now"[\\s\\S]*?<i class="on"></i><i class="on fillin" style="--t:${SCR.rub + SCR.pop}ms"></i><i class=""></i>`));
  assert.match(h2, /class="sfound O c2 appear"[^]*?<b>Pair!<\/b>/);
  assert.match(V.moveText(o2.flash, 'Olaf'), /Olaf found a pair of/);
  assert.match(V.moveText(o.flash, 'Olaf'), /Olaf found an? /);
  // once the pair's move is over its two panels stay ringed (two of a kind on show)
  assert.equal(count(cardsOf(screen({ owner: null, mini: o2.mini }, null, 'X')).O, /sspot open pr/g), 2);
  // three of a kind: the claim's glow on the three, in turn, and the line drawn through them
  const o3 = play(o2.mini, 'O', 6);
  assert.equal(o3.res.outcome, 'win'); o3.mini.winCells = o3.res.cells;
  const h3 = screen({ owner: 'O', mini: o3.mini }, o3.flash, 'O');
  assert.equal(count(h3, /sspot open[^"]*wn glow/g), 3);
  assert.match(h3, /sspot open rub wn glow" data-act="move" data-m='6' style="--k:0"/);
  assert.match(h3, /<svg class="swline draw" viewBox="0 0 3 3" aria-hidden="true"><path class="swo" d="M0\.5 2\.5L2\.5 2\.5"/);
  assert.match(h3, /class="sfound O c3 appear"[^]*?<b>Three!<\/b>/);
  assert.match(V.moveText(o3.flash, 'Olaf'), /Olaf found three \w+!/);
  // once settled (no flash), nothing animates and every scratched panel shows its picture
  const h4 = screen({ owner: 'O', mini: o3.mini }, null, 'X', { view: true });
  assert.equal(count(h4, /rub|glow|hit|appear| draw/g), 0); assert.equal(count(h4.split('<div class="sline">')[0], /class="spic"/g), 4); assert.equal(count(h4, /data-act="move"/g), 0);
  assert.match(h4, /<div class="smain"><div class="scard O big won"/, 'the finished square: the winner\'s card is the large one');
  assert.match(h4, /<svg class="swline" /);
});

test('the sounds come from the move: the rubs, the plop, a pair\'s ding or three\'s sparkle; the miniature shows both cards from public information alone', () => {
  const x = play(m0, 'X', 0), got = [];
  V.sounds(x.flash, (n, at) => got.push([n, at]), false, x.mini, null);
  assert.deepEqual(got.map(s => s[0]), ['scratch', 'scratch', 'scratch', 'scratch', 'plop']);
  assert.ok(got.filter(s => s[0] === 'scratch').every(s => s[1] < SCR.rub), 'the rasps while the foil is rubbed'); assert.deepEqual(got[4], ['plop', SCR.rub]);
  const x2 = play(x.mini, 'X', 1), got2 = [];
  V.sounds(x2.flash, (n, at) => got2.push(n), false, x2.mini, null);
  assert.ok(got2.includes('ding'));
  const x3 = play(x2.mini, 'X', 2), got3 = [];
  V.sounds(x3.flash, (n, at) => got3.push(n), true, x3.mini, null);
  assert.ok(got3.includes('sparkle') && !got3.includes('ding'));
  const t = V.miniature(x2.mini, false);
  assert.match(t, /<svg class="tscr"/); assert.equal(count(t, /class="tsp"/g), 2); assert.equal(count(t, /class="tsf"/g), 16); assert.equal(count(t, /class="tspic"/g), 2, 'a scratched panel shows its picture');
  const hidden = clone(x2.mini); delete hidden.cards;
  assert.equal(V.miniature(hidden, false), t, 'the same without the cards');
  x3.mini.winCells = x3.res.cells;
  const won = V.miniature(x3.mini, true);
  assert.equal(count(won, /tsw/g), 3, 'three of a kind tinted'); assert.equal(count(won, /class="tsl"/g), 1, 'and struck through');
});
