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
const R = await import('../../src/games/apple/rules.js');
const S = await import('../../src/ui/spin.js');
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
const scene = html => html.split('class="aspin"')[0];                                                                     // the orchard alone (the spinner carries little apples of its own)
const bucketOf = (html, p) => scene(html).split(/<g class="bk(?=[ "])/).slice(1).find(g => g.includes(`class="bkband ${p}"`));   // a bucket's own markup
const soundsOf = (f, mini) => { const out = []; V.sounds(f, (n, at, rate) => out.push([n, at, rate]), false, mini, null); return out; };

test('one tree holds both players\' apples in their colours, each player\'s bucket under it, labelled', () => {
  const html = still(square(0, 0));
  assert.equal(count(scene(html), /class="apl X"/g), 10, 'X\'s ten on the tree'); assert.equal(count(scene(html), /class="apl O"/g), 10, 'O\'s ten on the tree');
  assert.match(html, /<g class="bklab X" transform="translate\(35 [^>]*aria-label="X"><path class="bkmk"/); assert.match(html, /<g class="bklab O" transform="translate\(215 [^>]*aria-label="O"><circle class="bkmk"/);   // (X's left, O's right, each band with its player's drawn mark)
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
  assert.deepEqual([delays[1] - delays[0], delays[2] - delays[1]], [R.APPLET.gap, R.APPLET.gap], 'one by one, timed from the move (the outermost first)');
});
test('a bird takes two from that player\'s bucket back to the tree; it comes in from the side their bucket is on', () => {
  for (const [p, gx, dir] of [['X', 50, 1], ['O', 230, -1]]) {
    const m = square(p === 'X' ? 4 : 1, p === 'O' ? 5 : 1), r = play(m, p, 2);   // the wheel's bird
    assert.deepEqual([r.flash.apple.kind, r.flash.apple.n], ['bird', 2], p);
    const html = replay(m, r.flash);
    assert.match(html, new RegExp(`class="bird" style="[^"]*--gx:${gx}px;[^"]*--dir:${dir}`), `${p}'s bird`);
    assert.equal(count(bucketOf(html, p), new RegExp(`class="apl ${p} aplout"`, 'g')), 2, `${p}: two leave their bucket`);
    assert.equal(count(html.split('<g class="bk')[0], new RegExp(`class="apl ${p} aplin"`, 'g')), 2, `${p}: and appear on the tree as the bird gets there`);
    assert.match(bucketOf(html, p).slice(0, 12), /^ snatch/, `${p}: their bucket rocks at the snatch`);
  }
});
test('a spill tips that player\'s bucket towards the tree and rolls their apples up into it', () => {
  for (const [p, rot] of [['X', 74], ['O', -74]]) {
    const m = square(p === 'X' ? 6 : 1, p === 'O' ? 6 : 1), r = play(m, p, 5);   // the wheel's spill
    assert.deepEqual([r.flash.apple.kind, r.flash.apple.n], ['spill', 3], p);
    const html = replay(m, r.flash), b = bucketOf(html, p);
    assert.ok(b.startsWith(' tip'), `${p}'s bucket tips`); assert.match(b, new RegExp(`--rot:${rot}deg`));
    assert.equal(count(html, new RegExp(`class="apl ${p} roll"`, 'g')), 3, `${p}: three roll out`);
    const out = [...b.matchAll(new RegExp(`class="apl ${p} aplout" style="--t:(\\d+)ms`, 'g'))].map(m => +m[1]).sort((u, v) => u - v);
    assert.deepEqual([out[1] - out[0], out[2] - out[1]], [R.APPLET.gap, R.APPLET.gap], `${p}: they leave the bucket one by one, as each rolls out`);
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
test('the spinner turns with weight (ui/spin.js) from where it rested to the flash\'s stop; the pointer flicks at the ticks the sounds play; the segment it stopped on lights', () => {
  const m = square(2, 4); m.rest = 0.37;
  const o = play(m, 'O', 1), a = o.flash.apple, html = replay(m, o.flash);
  assert.equal(a.from, 0.37);
  const from = -0.37 * 360, end = 1800 - a.at * 360;
  assert.ok(html.includes(`--from:${from.toFixed(1)}deg;--end:${end.toFixed(1)}deg;--d:${R.APPLET.spin}ms`), 'from its rest to the stop the move landed on');
  const ticks = S.spinTicks(from, end, 36, R.APPLET.spin), snd = soundsOf(o.flash, o.mini);
  assert.ok(ticks.length >= 10, `${ticks.length} ticks`);
  assert.deepEqual(snd.filter(x => x[0] === 'wheelTick').map(x => x[1]), ticks, 'a tick sound as each peg passes');
  assert.deepEqual([...html.matchAll(/wflick 110ms (\d+)ms/g)].map(x => Number(x[1])), ticks, 'and the pointer flicks at the same moments');
  const gaps = ticks.slice(1).map((x, k) => x - ticks[k]);
  assert.ok(gaps[gaps.length - 1] >= 1.5 * gaps[0], 'slower and slower: never bunched at the stop');
  assert.match(html, /class="g-arc g-apple pc-O"/, 'the spinner\'s colour (the pointer, the wheel\'s apples)');
  const hit = html.match(/<path class="ahit" d="([^"]+)" style="--t:(\d+)ms"/), segs = [...html.matchAll(/<path d="([^"]+)" class="aseg/g)].map(x => x[1]);
  assert.ok(hit, 'the lit segment'); assert.equal(hit[1], segs[a.seg], 'the one the pointer stopped on'); assert.equal(Number(hit[2]), R.APPLET.spin, 'as the wheel stops');
  assert.doesNotMatch(still(square(2, 4)), /class="ahit"|wflick/, 'a wheel at rest: nothing lit, nothing flicking');
  const css = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.g-apple \.wspin\.go \{ animation: wspinw /, 'the stylesheet plays the shared spin');
});
test('the bucket\'s count ticks with its apples: up as each lands, down at the bird\'s snatch and as each spilled apple leaves; every place of the pile is drawn', () => {
  const T = R.APPLET, pick = play(square(2, 4), 'O', 1).flash.apple, t = R.appleTimes(pick);
  assert.deepEqual(V.appleSteps(pick), [[t.start + T.fall, 5], [t.start + T.gap + T.fall, 6], [t.start + 2 * T.gap + T.fall, 7]]);
  const html = replay(square(2, 4), play(square(2, 4), 'O', 1).flash), b = bucketOf(html, 'O');
  assert.deepEqual([...b.matchAll(/<text class="bkc O[^"]*"[^>]*>(\d+)<\/text>/g)].map(x => +x[1]), [4, 5, 6, 7], 'the band\'s count: the old one, then each new one at its landing');
  assert.match(b, new RegExp(`class="bkc O acn last"[^>]*style="--f:${t.land}ms">7<`), 'the last one stays');
  assert.equal(count(b, /bknod 200ms/g), 3, 'the bucket nods under each apple');
  assert.match(html, /<b class="astep"><i class="asn tu" style="--u:\d+ms">4<\/i>.*<i class="asn acn last"[^>]*>7<\/i><\/b>\/10/, 'the tally\'s count follows');
  const snd = soundsOf(play(square(2, 4), 'O', 1).flash, square(2, 4)).filter(x => x[0] === 'appleDrop');
  assert.deepEqual(snd.map(x => x[1]), V.appleSteps(pick).map(x => x[0]), 'a plop as each lands'); assert.ok(snd[2][2] > snd[0][2], 'a little higher each time');
  const bird = play(square(4, 1), 'X', 2).flash.apple; assert.deepEqual(V.appleSteps(bird), [[R.appleTimes(bird).grab, 2]]);
  const spill = play(square(6, 1), 'X', 5).flash.apple, ts = R.appleTimes(spill); assert.deepEqual(V.appleSteps(spill), [[ts.tip, 5], [ts.tip + T.gap, 4], [ts.tip + 2 * T.gap, 3]]);
  for (const p of ['X', 'O']) assert.equal(count(bucketOf(still(square(3, 6)), p), /class="aplg"/g), 10, `${p}: the pile's ten places, an outline each`);
  assert.match(still(square(3, 6)), /<ellipse class="aturn X"/, 'the ground glows under the mover\'s bucket');
});
test('the pick that fills the bucket says its apples first, then "Bucket full!" as the last one lands; a tap on the spinner spins too', () => {
  const m = square(7, 2), r = play(m, 'X', 1), html = replay(m, r.flash), t = R.appleTimes(r.flash.apple);
  assert.match(html, new RegExp(`<span class="appear tu" style="--t:${t.landed}ms;--u:${t.land}ms">\\+3 apples</span><span class="appear" style="--t:${t.land}ms">Bucket full!</span>`));
  assert.match(html, /bkfull 600ms/, 'the full bucket bounces as the last apple lands');
  const idle = still(square(3, 6));
  assert.equal(count(idle, /data-act="move" data-m="&quot;spin&quot;"/g) + count(idle, /data-act="move" data-m='"spin"'/g), 2, 'the spinner and the button');
  assert.match(idle, /<button class="awheel" data-act="move"/);
});
