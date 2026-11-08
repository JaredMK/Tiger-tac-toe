// Apple Pick's orchard (src/games/apple/view.js): one shared tree holds both players' apples (X's red, O's yellow), each
// player's bucket stands under it, side by side and labelled; a move is played in it as it was made: a pick drops that
// player's apples from the tree into their bucket, a bird takes theirs from the bucket back to the tree, a spill tips their
// bucket towards the tree and rolls them back up. The spinner's bird segment is not the swooping bird. The miniature is a
// tiny tree with both buckets and their counts. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/apple/view.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
const seg = (k, n = 10) => { let i = 0; const vals = [(k + 0.5) / n, 0.5]; return () => vals[i++ % 2]; };
const square = (bx, bo) => { const m = E.newMini('apple', E.makeRng('av')); m.segs = [1, 3, -1, 2, 4, -2, 1, 3, 2, 4]; m.bucket = { X: bx, O: bo }; return m; };
function play(mini, p, k) {   // the move that lands on segment k: the square after it and the move's flash (what a replay carries)
  const m = clone(mini), res = E.applyMove(m, p, 'spin', seg(k));
  assert.equal(res.ok, true);
  const flash = { kind: 'move', by: p, next: p, square: 0, type: 'apple', note: res.note || null, pass: null, timeout: false };
  GAMES.apple.rules.moveFlash('spin', p, null, 0, m, flash);
  return { mini: m, flash };
}
const still = mini => V.screen({ owner: null, mini }, null, null, mini, false, false, null, null, false, () => -1, false, 'X', '');
const replay = (shown, flash) => V.screen({ owner: null, mini: shown }, flash, null, shown, false, true, flash, null, false, () => -1, false, 'O', '');
const count = (html, re) => (html.match(re) || []).length;
const bucketOf = (html, p) => html.split('<g class="bk').slice(1).find(g => g.includes(`class="bkband ${p}"`));   // a bucket's own markup

test('one tree holds both players\' apples in their colours, each player\'s bucket under it, labelled', () => {
  const html = still(square(0, 0));
  assert.equal(count(html, /class="apl X"/g), 10, 'X\'s ten on the tree'); assert.equal(count(html, /class="apl O"/g), 10, 'O\'s ten on the tree');
  assert.match(html, /<text class="bklab X" x="62"[^>]*>X</); assert.match(html, /<text class="bklab O" x="178"[^>]*>O</);   // (side by side: X's left, O's right, the mark on each band)
  assert.equal(count(html, /<g class="bk[ "]/g), 2, 'two buckets');
  assert.ok(!/ drop|aplin|aplout/.test(html), 'nothing moving');
  const part = still(square(3, 6));
  assert.equal(count(part.split('<g class="bk')[0], /class="apl X"/g), 7, 'X: 10 - 3 left on the tree'); assert.equal(count(part.split('<g class="bk')[0], /class="apl O"/g), 4, 'O: 10 - 6 left on the tree');
  assert.equal(count(bucketOf(part, 'X'), /class="apl X"/g), 3, 'X\'s three in their bucket'); assert.equal(count(bucketOf(part, 'O'), /class="apl O"/g), 6, 'O\'s six in theirs');
  assert.match(part, /aria-label="X: 3 apples in the bucket\. O: 6 apples in the bucket\. 7 red and 4 yellow still on the tree"/);
});
test('a pick drops that player\'s apples from the tree into their bucket, one by one', () => {
  const o = play(square(2, 4), 'O', 1);   // O picks a 3 (the wheel's segment 1)
  assert.deepEqual([o.flash.apple.kind, o.flash.apple.n], ['pick', 3]);
  const html = replay(square(2, 4), o.flash);
  assert.equal(count(html, /class="apl O drop"/g), 3, 'three of O\'s fall'); assert.equal(count(html, /class="apl X drop"/g), 0, 'none of X\'s');
  assert.equal(count(bucketOf(html, 'O'), /class="apl O aplin"/g), 3, 'they land in O\'s bucket, each as its drop ends');
  assert.equal(count(bucketOf(html, 'X'), /class="apl X"/g), 2, 'X\'s bucket as it was');
  const delays = [...html.matchAll(/class="apl O drop" style="[^"]*--t:(\d+)ms/g)].map(m => +m[1]).sort((u, v) => u - v);
  assert.deepEqual([delays[1] - delays[0], delays[2] - delays[1]], [240, 240], 'one by one, timed from the move (the outermost first)');
});
test('a bird takes two from that player\'s bucket back to the tree; it comes in from the side their bucket is on', () => {
  for (const [p, gx, dir] of [['X', 62, 1], ['O', 178, -1]]) {
    const m = square(p === 'X' ? 4 : 1, p === 'O' ? 5 : 1), r = play(m, p, 2);   // the wheel's bird
    assert.deepEqual([r.flash.apple.kind, r.flash.apple.n], ['bird', 2], p);
    const html = replay(m, r.flash);
    assert.match(html, new RegExp(`class="bird" style="[^"]*--gx:${gx}px;[^"]*--dir:${dir}`), `${p}'s bird`);
    assert.equal(count(bucketOf(html, p), new RegExp(`class="apl ${p} aplout"`, 'g')), 2, `${p}: two leave their bucket`);
    assert.equal(count(html.split('<g class="bk')[0], new RegExp(`class="apl ${p} aplin"`, 'g')), 2, `${p}: and appear on the tree as the bird gets there`);
  }
});
test('a spill tips that player\'s bucket towards the tree and rolls their apples up into it', () => {
  for (const [p, rot] of [['X', 74], ['O', -74]]) {
    const m = square(p === 'X' ? 6 : 1, p === 'O' ? 6 : 1), r = play(m, p, 5);   // the wheel's spill
    assert.deepEqual([r.flash.apple.kind, r.flash.apple.n], ['spill', 3], p);
    const html = replay(m, r.flash), b = bucketOf(html, p);
    assert.ok(b.startsWith(' tip'), `${p}'s bucket tips`); assert.match(b, new RegExp(`--rot:${rot}deg`));
    assert.equal(count(html, new RegExp(`class="apl ${p} roll"`, 'g')), 3, `${p}: three roll out`);
    assert.equal(count(html, new RegExp(`class="apl ${p === 'X' ? 'O' : 'X'} roll"`, 'g')), 0);
  }
});
test('the last apple fills the bucket: it bounces and stars burst', () => {
  const m = square(7, 2), r = play(m, 'X', 1), html = replay(m, r.flash);   // X: 7 + 3 = the full ten
  assert.equal(r.flash.apple.bucket, 10); assert.match(html, /class="bk full"/); assert.match(html, /class="astars"/);
  assert.doesNotMatch(still(square(3, 6)), /bk full|astars/);
});
test('the spinner\'s bird and spill segments carry no class of the swooping bird (their wedge flew across the wheel)', () => {
  const html = still(square(0, 0)), wheel = html.slice(html.indexOf('class="wspin'), html.indexOf('</svg>', html.indexOf('class="wspin')));
  const tokens = new Set([...wheel.matchAll(/class="([^"]*)"/g)].flatMap(m => m[1].split(/\s+/)));
  assert.ok(tokens.has('abird') && tokens.has('aspill'), 'the segments');
  assert.ok(!tokens.has('bird'), 'no .bird in the wheel: .bird is the scene\'s flight (an animation that moved whatever it was on)');
  const css = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.bird \{ opacity: 0; animation: birdfly/); assert.doesNotMatch(css, /\.aseg\.bird\b/);
});
test('the miniature: a tiny tree with both players\' apples and the two buckets, each with its count', () => {
  const html = V.miniature(square(3, 6), false);
  assert.match(html, /<text class="tbn X"[^>]*>3<\/text>/); assert.match(html, /<text class="tbn O"[^>]*>6<\/text>/);
  assert.ok(count(html, /class="aplb X"/g) >= 3 && count(html, /class="aplb O"/g) >= 3, 'the buckets\' apples and the tree\'s');
  assert.match(html, /aria-label="X has 3, O has 6 of 10 apples in their buckets"/);
  const full = V.miniature(square(10, 0), false);
  assert.match(full, />10<\/text>/); assert.equal(count(full.split('class="tbk')[0], /class="aplb X"/g), 0, 'none of X\'s left on the tree');
});
