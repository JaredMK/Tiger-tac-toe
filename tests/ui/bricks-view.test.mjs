// Brick Break's screen (src/games/bricks/view.js): both players' walls as bars, the field, a line of words in reserved
// room and Start (always there, hidden while it can't be used); someone else's go plays from the flash (its inputs,
// never mini.last) and its result follows; the miniature is each player's wall with their paddle and ball, public
// information only. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const win = new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {} }) : k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.defineProperty(globalThis, 'window', { value: win, configurable: true, writable: true });   // (no reduced motion here: the replays play, as on a phone)
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/bricks/rules.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/bricks/view.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });
const clone = v => JSON.parse(JSON.stringify(v));
const square = () => E.newMini('bricks', E.makeRng('bv'));
function play(mini, p, level) {   // a go by the computer's hand: the square after it and the move's flash (what a replay carries)
  const m = clone(mini), r = R.brkAi(m, p, E.makeRng('pl' + p), R.brkHand(m, level || 'normal')), res = E.applyMove(m, p, r.move, E.makeRng('x'));
  assert.equal(res.ok, true);
  const flash = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p, square: 0, type: 'bricks', note: res.note || null, pass: null, timeout: false };
  GAMES.bricks.rules.moveFlash(r.move, p, null, 0, m, flash);
  return { mini: m, flash, move: r.move };
}
const still = (mini, turn) => V.screen({ owner: null, mini }, null, null, mini, false, false, null, null, false, () => -1, false, turn || 'X', '');
const replay = (shown, flash) => V.screen({ owner: null, mini: shown }, flash, null, shown, false, true, flash, null, false, () => -1, false, flash.by, '');
const count = (html, re) => (html.match(re) || []).length;

test('a fresh square: both walls whole, the field, the words line and Start for the player on the move', () => {
  Object.assign(state, { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null, turn: 'X', flash: null, done: null, winner: null });
  const m = square(); state.squares = [{ owner: null, mini: m }];
  const html = still(m);
  assert.match(html, /class="rprog brkp X now"/); assert.match(html, /class="rprog brkp O"/);
  assert.equal(count(html, />0 \/ 35</g), 2, 'nothing broken yet');
  assert.match(html, /<canvas data-brk="cv"><\/canvas>/); assert.match(html, /class="rhud brkhud" data-brk="hud"><\/div>/);
  assert.match(html, /<p class="atwords brkwords"><span><\/span><\/p>/, 'the words line reserved, empty');
  assert.match(html, /<div class="cbtns one"><button class="big X" data-act="brk-start">Start<\/button>/);
  assert.ok(!/brkw run/.test(html));
  const o = still(m, 'O');
  assert.match(o, /class="rprog brkp O now"/); assert.match(o, /button class="big O" data-act="brk-start"/);
});
test('someone else\'s go: the replay plays its length, then the bar grows and the words say what it broke; Start hidden, in its room', () => {
  const m = square(), r = play(m, 'O');
  const html = replay(r.mini, r.flash), pre = R.brkMs(r.flash.brk) + R.BRK.end[r.flash.brk.end];
  assert.equal(V.brkPre(r.flash, 0), pre, 'the go as it was, then its end');
  assert.match(html, new RegExp(`<span class="tu" style="--u:${pre}ms"><b class="O">Olaf</b> is having a go…</span>`));
  assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${pre}ms" role="status"><b class="O">Olaf</b> broke ${r.move.n} brick${r.move.n === 1 ? '' : 's'} · ${35 - r.move.n} left</span>`));
  const bar = html.split('class="rprog brkp O')[1].split('</small>')[0];
  assert.match(bar, new RegExp(`<i class="grow" style="--w0:0.0%;--w1:${(100 * r.move.n / 35).toFixed(1)}%;--d:900ms;--t:${pre}ms"`), 'O\'s bar grows to the new count at the replay\'s end');
  assert.match(bar, new RegExp(`<span class="tu" style="--u:${pre}ms">0 / 35</span><span class="tf" style="--f:${pre}ms">${r.move.n} / 35</span>`));
  assert.match(html, /class="rhud brkhud" data-brk="hud">\+0</, 'the count starts from nothing as the replay begins');
  assert.match(html, /<div class="cbtns one hold"><button class="big O" data-act="brk-start" disabled/);
  assert.equal(V.moveText(r.flash, '<b>Olaf</b>'), `<b>Olaf</b> broke ${r.move.n} brick${r.move.n === 1 ? '' : 's'} · ${35 - r.move.n} left`);
});
test('the replay\'s sounds come from the flash\'s inputs: Start, the serve, each bounce and brick in turn, its end, then the result', () => {
  const m = square(), r = play(m, 'O'), got = [];
  V.sounds(r.flash, (n, at) => got.push([n, at]));
  assert.deepEqual(got[0], ['go', 0]); assert.equal(got[1][0], 'pop');
  assert.equal(got.filter(([n]) => n === 'brkBrick').length, Math.min(r.move.n, 220), 'a crack a brick');
  assert.ok(got.some(([n]) => n === 'brkPaddle'));
  for (let k = 1; k < got.length; k++) assert.ok(got[k][1] >= got[k - 1][1], 'in order');
  const pre = V.brkPre(r.flash, 0);
  assert.deepEqual(got[got.length - 2], [r.flash.brk.end === 'clear' ? 'sparkle' : 'thud', R.brkMs(r.flash.brk)]);
  assert.deepEqual(got[got.length - 1], ['ding', pre + 250]);
  const none = []; V.sounds({ type: 'bricks', by: 'X', square: 0, timeout: true, brk: { auto: true, by: 'X', from: 3, to: 3, try: 1 } }, (n, at) => none.push([n, at]));
  assert.deepEqual(none, [['thud', 250]], 'a timed-out go: the thud alone');
});
test('a cleared wall: the words say so and the move\'s text too', () => {
  const m = square(); m.wall.X = m.wall.X.map((b, k) => (k === 17 ? 1 : 0));
  let r = null;
  for (let s = 0; s < 10 && !(r && r.flash.kind === 'claim'); s++) { const mm = clone(m); mm.seed = { X: 900 + s, O: 900 + s }; r = play(mm, 'X', 'hard'); }
  assert.equal(r.flash.kind, 'claim');
  assert.match(replay(r.mini, r.flash), /<b class="X">Xena<\/b> cleared the wall!/);
  assert.equal(V.moveText(r.flash, 'X'), 'X cleared the wall');
});
test('the miniature: each player\'s wall (standing bricks solid, broken ones faint), paddle and ball, public information only', () => {
  const m = square(), fresh = V.miniature(m, false);
  assert.match(fresh, /^<div class="tbrk" aria-label="X: 0 of 35 bricks broken, O: 0 of 35"><svg viewBox="0 0 100 62"/);
  assert.equal(count(fresh, /class="tbrkb"/g), 2, 'a solid wall each'); assert.equal(count(fresh, /class="tbrkg"/g), 0, 'nothing broken');
  assert.equal(count(fresh, /class="tbrkp X"/g), 1); assert.equal(count(fresh, /class="tbrkp O"/g), 1); assert.equal(count(fresh, /class="tbrko"/g), 2);
  assert.equal(count(fresh.split('class="tbrkb" d="')[1].split('"')[0], /M/g), 35, '35 bricks drawn in one path');
  const r = play(m, 'X'), part = V.miniature(r.mini, false);
  assert.match(part, new RegExp(`aria-label="X: ${r.move.n} of 35 bricks broken, O: 0 of 35"`));
  assert.equal(count(part.split('class="tbrkg" d="')[1].split('"')[0], /M/g), r.move.n, 'X\'s broken bricks faint');
  assert.equal(V.miniature(E.publicMini(r.mini), false), part, 'the same from the square as the other phone has it');
  assert.ok(!/\.back|class="sq|class="btn|class="seg"|class="chip"/.test(part), 'no interface class');
});
