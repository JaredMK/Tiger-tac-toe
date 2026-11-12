// Hex and Takeover (the November 2026 polish). Hex: one drawing under a layer of buttons, the four goal edges in their
// players' colours, the stone played dropping in (once, from the move), the last stone ringed, touching stones joined and
// each side's best chain threaded (from the public cells alone), a win's line from edge to edge. Takeover: the piece
// lands, the cells round it turn over clockwise with a rising tick each, the counts turning with them, a tap's preview on
// every empty cell, the full board's ripple. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const hex = await import('../../src/games/hex/view.js');
const tk = await import('../../src/games/takeover/view.js');
const { flashMs: hexFlash } = await import('../../src/games/hex/rules.js');
const { flashMs: tkFlash, TAKEOVER_MS } = await import('../../src/games/takeover/rules.js');
const H = await import('../../src/ui/haptics.js');
const { SFX } = await import('../../src/audio/sound.js');

const play = (type, moves) => { const rng = E.makeRng('boards'), mini = E.newMini(type, rng); let r = null; for (const [p, m] of moves) r = E.applyMove(mini, p, m, rng); return { mini, r }; };
const won = mini => i => !!(mini.winCells && mini.winCells.includes(i));
const wk = mini => i => (mini.winCells ? mini.winCells.indexOf(i) : -1);
// the view's screen as ui/mini.js calls it: a = the move's flash (its animation playing), or none
const draw = (view, mini, o = {}) => view.screen({ owner: o.owner || null, mini }, o.a || null, null, mini, !!o.view, !!o.locked, o.a || null, o.a && Number.isInteger(mini.last) ? mini.last : null, won(mini), wk(mini), !!o.fresh, o.turn || 'X', '');
const sounds = (view, f, mini) => { const out = []; view.sounds(f, (n, ms, rate) => out.push([n, ms, rate]), f.kind === 'claim', mini, null); return out; };
const count = (html, re) => (html.match(re) || []).length;

test('hex: a button a cell over one drawing; the goal edges in their players\' colours with a chip of the mark on each', () => {
  const { mini } = play('hex', [['X', 5], ['O', 6]]);
  const html = draw(hex, mini);
  assert.equal(count(html, /<button class="hexc/g), 16); assert.equal(count(html, /<button class="hexc [XO]"[^>]* disabled/g), 2, 'a played cell takes no tap');
  assert.equal(count(html, /class="hxe X"/g), 2, 'X\'s two edges'); assert.equal(count(html, /class="hxe O"/g), 2, 'O\'s two edges');
  assert.equal(count(html, /class="hxchip X/g), 2); assert.equal(count(html, /class="hxchip O/g), 2);
  assert.equal(count(html, /class="hxchip X turn"/g), 2, 'the mover\'s chips bob'); assert.doesNotMatch(html, /hxchip O turn/);
  assert.match(html, /class="g-hex tX open"/, 'open to the mover: their stone\'s ghost under the finger');
  assert.match(draw(hex, mini, { locked: true, turn: 'O' }), /class="g-hex tO"/, 'not this phone\'s to play: no ghost');
  assert.doesNotMatch(html, />[^<]*(left|right|top|bottom|connect)[^<]*</i, 'no help text on the board');
  for (const n of [4, 5]) { const b = hex.hexBox(n); assert.ok(336 / b.w >= 40, `${n}x${n}: a cell at least 40px wide at 360px`); }
});

test('hex: the stone just played drops in (once, with its move); the one played last is ringed; touching stones are joined', () => {
  const { mini } = play('hex', [['X', 5], ['O', 6], ['X', 9]]);
  const live = draw(hex, mini, { a: { type: 'hex', kind: 'move', by: 'X' }, locked: true });
  assert.equal(count(live, /class="hxs X drop"/g), 1, 'its body'); assert.equal(count(live, /class="hxs X drop mk"/g), 1, 'its mark');
  assert.match(live, /class="hexstage drop"/); assert.match(live, /class="hxwave X"/, 'the ring that runs out as it lands');
  assert.match(live, /class="hxl X new"/, 'its join shows from the landing'); assert.doesNotMatch(live, /hxring/, 'no ring while it is still coming down');
  const idle = draw(hex, mini, { turn: 'O' });
  assert.doesNotMatch(idle, /drop|hxwave| new"/, 'nothing plays without a move');
  assert.equal(count(idle, /class="hxring"/g), 1, 'the last stone ringed'); assert.equal(count(idle, /class="hxl X"/g), 1, '5 and 9 touch');
  assert.ok(hex.HEX_T.land + hex.HEX_T.settle <= hexFlash({}, 4, false), 'inside the move\'s time');
  assert.deepEqual(sounds(hex, { type: 'hex', kind: 'move', by: 'X' }, mini), [['hexPlace', hex.HEX_T.land, undefined]], 'the click as it lands');
});

test('hex: each side\'s best chain is the one reaching furthest towards its own edges, from the cells alone', () => {
  const cells = new Array(16).fill(null); [0, 1, 6, 10].forEach(i => { cells[i] = 'X'; }); [3, 7, 11, 13].forEach(i => { cells[i] = 'O'; });
  const ch = hex.hexChains(cells);
  assert.deepEqual(ch.best.X.path, [0, 1], 'X: columns 0-1 beats the two in column 2'); assert.deepEqual(ch.best.O.path, [3, 7, 11], 'O: rows 0-2');
  assert.deepEqual(ch.links.map(l => l.join('-')).sort(), ['0-1', '3-7', '6-10', '7-11']);
  assert.deepEqual(hex.hexChains(new Array(16).fill(null)).best, {}, 'nothing on an empty board');
  const one = new Array(16).fill(null); one[5] = 'X'; assert.equal(hex.hexChains(one).best.X, undefined, 'a lone stone is no chain');
  const html = draw(hex, { type: 'hex', cells, last: 13 });
  assert.equal(count(html, /class="hxth [XO]"/g), 2, 'a thread a side');
});

test('hex: a win draws its line along the chain from one goal edge to the other, each stone lit in its order; the review shows it drawn', () => {
  const { mini, r } = play('hex', [['X', 4], ['O', 0], ['X', 5], ['O', 1], ['X', 6], ['O', 2], ['X', 7]]);
  assert.equal(r.outcome, 'win'); mini.winCells = r.cells;
  const live = draw(hex, mini, { a: { type: 'hex', kind: 'claim', by: 'X', winner: 'X' }, owner: 'X', fresh: true, locked: true });
  assert.match(live, /<g class="hxwl draw" style="--n:4">/);
  const d = live.match(/class="hxwo" d="M([\d.-]+) ([\d.-]+)L.*L([\d.-]+) ([\d.-]+)" pathLength="1"/);
  assert.ok(d && Number(d[1]) < 0.5 && Number(d[3]) > 4.5, 'from the left edge out to the right one');
  assert.deepEqual([...live.matchAll(/class="hxs X(?: drop)? win lit" style="--k:(\d)"/g)].map(m => m[1]), ['0', '1', '2', '3'], 'lit from the near edge');
  assert.doesNotMatch(live, /hxth/, 'the line stands for the chain\'s thread');
  const after = draw(hex, mini, { owner: 'X', view: true, locked: true });
  assert.match(after, /<g class="hxwl" /); assert.doesNotMatch(after, / lit|drop|hxring|hxchip [XO] turn/, 'the review: the line as drawn, nothing playing');
  const win = sounds(hex, { type: 'hex', kind: 'claim', by: 'X', winner: 'X' }, mini);
  assert.deepEqual(win.map(s => s[0]), ['hexPlace', 'pathNote', 'pathNote', 'pathNote', 'pathNote']);
  assert.ok(win.every(s => s[1] < hexFlash({}, 4, true)), 'inside the win\'s time'); assert.ok(win[4][2] > win[1][2], 'the notes rise');
});

test('hex: the miniature is the same drawing in small (a picture: the edges, the stones), a 5x5 square from before too', () => {
  const { mini } = play('hex', [['X', 5], ['O', 6]]);
  const m = hex.miniature(mini);
  assert.match(m, /^<div class="thex"><svg class="hxart small"/); assert.equal(count(m, /class="hxs [XO]"/g), 2); assert.doesNotMatch(m, /hxchip|hxm"|<button|<text/);
  const old = { type: 'hex', cells: new Array(25).fill(null), last: null }; old.cells[12] = 'X';
  assert.equal(count(hex.miniature(old), /class="hxc"/g), 24); assert.equal(count(draw(hex, old), /<button class="hexc/g), 25);
});

test('takeover: the piece lands, then the cells round it turn over clockwise from the top, the counts turning with them', () => {
  const { mini } = play('takeover', [['X', 6], ['O', 13], ['X', 17]]);
  const f = { type: 'takeover', kind: 'move', by: 'X', take: { at: 17, took: [17, 16, 22], flipped: [12, 18] } };
  assert.deepEqual(tk.takeWave(f.take, 5), [12, 18, 22, 16], 'up, right, down, left');
  const live = draw(tk, mini, { a: f, locked: true });
  assert.match(live, /<button class="tkc X land"[^>]*data-m='17'[^>]*><span class="tkpc X">/, 'the piece coming down onto its cell');
  const flips = [...live.matchAll(/<button class="tkc X flip (from[EXO])" style="--t:(\d+)ms;"[^>]*data-m='(\d+)'/g)].map(m => [Number(m[3]), m[1], Number(m[2])]).sort((a, b) => a[2] - b[2]);
  assert.deepEqual(flips, [[12, 'fromO', 180], [18, 'fromO', 265], [22, 'fromE', 350], [16, 'fromE', 435]]);
  assert.equal(count(live, /class="tko"/g), 2, 'a cell turned over shows its old face first');
  assert.match(live, /<b class="X tnm">[^<]*<\/b><span class="tksc" aria-label="10 squares"><b class="cnt" data-from="5" data-delay="180"/, 'the mover\'s count from the landing');
  assert.match(live, /<span class="tksc" aria-label="3 squares"><b class="cnt" data-from="5" data-delay="330"/, 'the other side\'s as its cells turn');
  assert.match(live, /class="arcres ok appear" style="--t:330ms" role="status">\+5 · 2 turned over</);
  assert.doesNotMatch(live, /class="tkp[ "]|class="tkg"| last/, 'no preview and no last mark while a move plays');
  assert.ok(435 + TAKEOVER_MS.flip <= tkFlash(f, 0, false), 'the last turn inside the move\'s time');
  const s = sounds(tk, f, mini);
  assert.deepEqual(s.map(x => x[0]), ['hexPlace', 'tkFlip', 'tkFlip', 'tkFlip', 'tkFlip']); assert.equal(s[0][1], TAKEOVER_MS.place);
  assert.ok(s[4][2] > s[3][2] && s[3][2] > s[2][2] && s[2][2] > s[1][2], 'a tick a cell, each higher'); assert.ok(SFX.tkFlip && SFX.hexPlace);
  assert.deepEqual(H.movePlan({ by: 'X' }, s).map(b => b[0]), ['tap', 'medium'], 'a tap as it is played, the result as the last cell turns');
});

test('takeover: every empty cell carries what a tap would take (the mover\'s mark, a ring on each cell that would turn); the last piece is ringed; the leader\'s count is filled', () => {
  const { mini } = play('takeover', [['X', 6], ['O', 13]]);
  const html = draw(tk, mini);
  assert.match(html, /class="g-arc g-tk tX open"/);
  const c17 = html.match(/<button class="tkc"[^>]*data-m='17'[^>]*>(.*?)<\/button>/)[1];
  assert.match(c17, /<i class="tkg"><svg class="tkm X"/, 'the mover\'s mark');
  assert.deepEqual([...c17.matchAll(/<i class="tkp( own)?" style="--dx:(-?\d);--dy:(-?\d)"/g)].map(m => [!!m[1], Number(m[2]), Number(m[3])]), [[true, 0, -1], [true, 1, 0], [false, 0, 1], [false, -1, 0]], 'O\'s two and the two empty ones');
  const c2 = html.match(/<button class="tkc"[^>]*data-m='2'[^>]*>(.*?)<\/button>/)[1];
  assert.equal(count(c2, /class="tkp/g), 1, 'a cell already the mover\'s is not ringed (1 and 7 are X\'s)');
  assert.equal(count(html, /class="tkc O last"/g), 1); assert.match(html, /class="tkc O last"[^>]*data-m='13'/);
  assert.doesNotMatch(html, /tksc lead/, 'level: nobody leads');
  const locked = draw(tk, mini, { locked: true, turn: 'O' });
  assert.doesNotMatch(locked, /class="tkp[ "]|class="tkg"/, 'not this phone\'s to play: no preview'); assert.match(locked, /class="g-arc g-tk tO"/);
  const ahead = play('takeover', [['X', 6], ['O', 13], ['X', 17]]).mini;
  assert.match(draw(tk, ahead, { turn: 'O' }), /<b class="X tnm">[^<]*<\/b><span class="tksc lead" aria-label="10 squares"><b>10<\/b>/);
});

test('takeover: the full board ripples out from the last piece (the winner\'s cells hop, the other\'s fade), inside the win\'s time; the review is the board alone', () => {
  const cells = 'XXOOXOXXOOXOXOXOOXXOXOXX'.split('').concat([null]), mini = { type: 'takeover', cells, last: null };
  const r = E.applyMove(mini, 'X', 24, E.makeRng('end'));
  assert.equal(r.outcome, 'win'); assert.equal(r.winner, 'X');
  const f = { type: 'takeover', kind: 'claim', by: 'X', winner: 'X', take: { at: 24, took: mini.last.took, flipped: mini.last.flipped } };
  const live = draw(tk, mini, { a: f, owner: 'X', fresh: true, locked: true });
  assert.equal(count(live, /class="tkc X[^"]* won"/g), 15); assert.equal(count(live, /class="tkc O[^"]* lost"/g), 10);
  const ws = [...live.matchAll(/--w:(\d+)ms/g)].map(m => Number(m[1]));
  assert.equal(Math.min(...ws), TAKEOVER_MS.place + 3 * TAKEOVER_MS.step + TAKEOVER_MS.flip, 'once the cells have turned');
  assert.ok(Math.max(...ws) + 340 <= tkFlash(f, 0, true), 'the furthest cell\'s hop inside the win\'s time');
  const after = draw(tk, mini, { owner: 'X', view: true, locked: true });
  assert.doesNotMatch(after, / won| lost| last| land| flip|class="tkp[ "]|arcres/); assert.match(after, /aria-label="15 squares"/);
});

test('takeover: the miniature is the board with each player\'s cells and the bar of who holds how much', () => {
  const fresh = tk.miniature(play('takeover', []).mini);
  assert.match(fresh, /^<div class="ttk"><div class="tg gtk">/); assert.equal(count(fresh, /<i class=""><\/i>/g), 25, 'the empty grid from the start');
  const m = tk.miniature(play('takeover', [['X', 6], ['O', 13], ['X', 17]]).mini);
  assert.equal(count(m, /<i class="X"><\/i>/g), 10); assert.equal(count(m, /<i class="O"><\/i>/g), 3);
  assert.match(m, /<div class="ttkbar" aria-hidden="true"><i class="X" style="width:40\.0%"><\/i><i class="O" style="width:12\.0%"><\/i><\/div>/);
  assert.doesNotMatch(m, />\d+</, 'a picture: no figures');
});
