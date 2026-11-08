// Bingo's draw (src/games/bingo/view.js): the square opens on the cards and Pick numbers, never a number; the draw's
// replay rolls the drawn balls out of the cage from its recorded flash (never the square's own offer); the drawn balls
// are the call's controls; a call's replay lifts the ball called. Rendered in Node with the browser's names stubbed.
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
const V = await import('../../src/games/bingo/view.js');
const R = await import('../../src/games/bingo/rules.js');
const { repOf } = await import('../../src/core/replay.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
function play(mini, p, move, rng) {
  const m = clone(mini), res = E.applyMove(m, p, move, rng);
  assert.equal(res.ok, true, `${move} refused (${res.reason})`);
  const flash = { kind: res.again ? 'again' : 'move', by: p, next: p, square: 0, type: 'bingo', note: res.note || null, pass: null, timeout: false };
  GAMES.bingo.rules.moveFlash(move, p, null, 0, m, flash);
  return { mini: m, flash };
}
const screen = (mini, flash, locked, turn) => V.screen({ owner: null, mini }, flash, null, mini, false, !!locked, flash, null, false, () => -1, false, turn || 'X', '');
const balls = html => [...html.matchAll(/class="bgball [abc][^"]*"[^>]*data-m='(\d+)'[^>]*aria-label="Call (\d+)"/g)].map(m => Number(m[2]));

test('the square opens on the cards and Pick numbers (the move "draw", the control the replay presses), never a number of the offer', () => {
  const m = E.newMini('bingo', E.makeRng('bgv'));
  const html = screen(m, null, false);
  assert.ok(html.includes(`data-act="move" data-m='"draw"'`), 'Pick numbers is the draw\'s control');
  assert.equal(repOf('draw'), 'm="draw"', 'as the replay log writes it');
  assert.match(html, />Pick numbers</);
  assert.deepEqual(balls(html), [], 'no balls');
  assert.doesNotMatch(html, /Call \d/);
  assert.match(screen(m, null, true), /class="bgdraw"[^>]*disabled/, 'not this phone\'s turn: Pick numbers is shown but off');
});

test('a draw plays from its flash: the cage turns and the flash\'s balls roll out one by one, timed from the move; then the drawn balls are the call\'s controls', () => {
  const m0 = E.newMini('bingo', E.makeRng('bgv2')), d = play(m0, 'O', 'draw', E.makeRng('bgv-d'));
  const T = R.bingoDrawTimes(d.flash.bingo);
  // the replay on the other phone: the square as it was (nothing drawn), the draw's flash playing
  const html = screen(m0, d.flash, true, 'O');
  assert.match(html, /class="bgcage spin"/);
  assert.deepEqual(balls(html), d.flash.bingo.offer, 'the balls are the draw\'s');
  T.balls.forEach((ms, k) => assert.ok(html.includes(`--k:${k};--t:${ms}ms`), `ball ${k} rolls out at ${ms} ms`));
  assert.deepEqual([T.balls[2] < T.balls[1], T.balls[1] < T.balls[0], T.end > T.balls[0]], [true, true, true]);
  assert.doesNotMatch(html, /bgdraw/, 'Pick numbers gone as the cage turns');
  // a square whose own offer differs (another phone's state): still the flash's numbers
  const other = clone(d.mini); other.offer = [1, 2, 3].filter(v => !d.flash.bingo.offer.includes(v)).concat([4, 5, 6]).slice(0, 3);
  assert.deepEqual(balls(screen(other, d.flash, true, 'O')), d.flash.bingo.offer);
  // its sounds: the cage, a ball each
  const snd = []; V.sounds(d.flash, (n, ms) => snd.push([n, ms]));
  assert.deepEqual(snd, [['bgCage', T.spin], ...T.balls.map(ms => ['bgBall', ms])]);
  const src = fs.readFileSync(new URL('../../src/audio/sound.js', import.meta.url), 'utf8');
  for (const n of ['bgCage', 'bgBall']) assert.match(src, new RegExp(`^def\\('${n}',`, 'm'), n + ' is a sound');
  // drawn, the result gone: the balls, each its index as the move, open to the mover only
  const open = screen(d.mini, null, false, 'O');
  assert.deepEqual(balls(open), d.mini.offer);
  assert.equal((open.match(/class="bgball[^"]*"[^>]*disabled/g) || []).length, 0);
  assert.equal((screen(d.mini, null, true, 'O').match(/class="bgball[^"]*"[^>]*disabled/g) || []).length, 3);
  assert.match(open, /Olaf<\/b>'s call/);
});

test('a call\'s replay: the ball called lifts away, the others fade; the offer is spent and the next turn starts on Pick numbers', () => {
  const m0 = E.newMini('bingo', E.makeRng('bgv3')), d = play(m0, 'X', 'draw', E.makeRng('bgv-d3')), c = play(d.mini, 'X', 2, E.makeRng('x'));
  const html = screen(d.mini, c.flash, true, 'X');
  assert.match(html, new RegExp(`class="bgball [abc] bgpick"[^>]*data-m='2'`));
  assert.equal((html.match(/bgdim/g) || []).length, 2);
  assert.deepEqual(c.mini.offer, []);
  if (!c.mini.win) assert.match(screen(c.mini, null, false, 'O'), />Pick numbers</);
});

test('the miniature: the two cards and each owner\'s drawn mark, no text', () => {
  const m = E.newMini('bingo', E.makeRng('bgv4')); E.applyMove(m, 'X', 'draw', E.makeRng('a')); E.applyMove(m, 'X', 0, E.makeRng('b'));
  const svg = V.miniature(m);
  assert.doesNotMatch(svg, /<text/);
  assert.match(svg, /class="tbgl X"/); assert.match(svg, /class="tbgl O"/);
});
