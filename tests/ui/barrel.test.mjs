// Barrel Launch's screen (games/barrel/view.js): the screen before and after a shot (the Fire button, the canvas, the
// result's own reserved line, the pips filling in after the landing), the sounds (someone else's thump first; this
// phone's own heard as it fired), and the miniature. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS, BAD_SOUNDS } = await import('../../src/ui/haptics.js');
const V = await import('../../src/games/barrel/view.js');
const R = await import('../../src/games/barrel/rules.js');
const A = await import('../../src/games/barrel/ai.js');
GAMES.barrel.view = V;

function match(turn = 'X') {
  Object.assign(state, E.newMatch(E.makeRng('barrel-ui'), { games: ['barrel'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const names = f => moveSounds(f).map(s => [s[0], Math.round(s[1])]);
const deadOn = (m, p) => { const c = R.barrelCfg(m), i = m.at[p]; return Math.round(A.barrelCross(m, c, i, R.barrelTarget(m, c, i).phi, m.c[p], 300)); };

test('before a shot: the Fire button in the mover\'s colour, the canvas, an empty reserved line, both tallies; nothing to press on the other side\'s turn', () => {
  match();
  let html = renderMini(state.squares[0]);
  assert.match(html, /<div class="g-brl pc-X">/);
  assert.match(html, /<div class="brlfield live"><canvas class="brlcv" aria-label="[^"]*"><\/canvas><\/div>/);
  assert.match(html, /<p class="brlline"><\/p>/);
  assert.match(html, /<button class="big X brlbtn" data-act="brl-fire" aria-label="Fire into the barrel above">/);
  assert.equal((html.match(/class="pips" aria-label="0 of 7"/g) || []).length, 2);
  state.turn = 'O'; html = renderMini(state.squares[0]);
  assert.match(html, /<div class="g-brl pc-O">/); assert.match(html, /<div class="brlfield">/); assert.match(html, /class="big O brlbtn" data-act="brl-fire"[^>]* disabled>/);
});

test('a shot: the words and the pip at the landing; this phone\'s own starts at the shot, someone else\'s swing first; the sounds', () => {
  const m = match();
  assert.ok(E.playMove(state, 0, { t: deadOn(m, 'X') }, E.makeRng('s')).ok);
  const f = state.flash, own = renderMini(state.squares[0]);
  assert.equal(f.br.hit, true);
  assert.match(own, new RegExp(`<p class="brlline ok appear" style="--t:${R.BARREL.fly}ms" role="status">Caught!</p>`));
  assert.match(own, new RegExp(`<i class="on fillin" style="--t:${R.BARREL.fly}ms"></i>`));
  assert.deepEqual(names(f), [['blWhoosh', 30], ['blCatch', R.BARREL.fly]], 'its thump was heard as it fired');
  match('O'); const mo = state.squares[0].mini;
  assert.ok(E.playMove(state, 0, { t: deadOn(mo, 'O') + 400 }, E.makeRng('s')).ok);
  const g = state.flash, pre = R.BARREL.pre, html = renderMini(state.squares[0]);
  assert.equal(g.br.hit, false);
  assert.match(html, new RegExp(`<p class="brlline no appear" style="--t:${pre + R.BARREL.fly + R.BARREL.fall - 120}ms" role="status">Missed!</p>`)); assert.doesNotMatch(html, /fillin/);
  assert.deepEqual(names(g), [['blFire', pre], ['blWhoosh', pre + 30], ['blMiss', pre + R.BARREL.fly - 60], ['blBump', pre + R.BARREL.fly + R.BARREL.fall - 30]]);
  assert.ok(RESULT_SOUNDS.has('blCatch') && BAD_SOUNDS.has('blBump'), 'a catch and a bump buzz');
  assert.equal(V.moveText({ br: { hit: true } }, 'Xena'), 'Xena landed in the next barrel'); assert.equal(V.moveText({ br: { hit: false } }, 'Xena'), 'Xena fell back');
});

test('the miniature: two little columns of barrels, each player\'s mark at their height, beside their climb as a bar', () => {
  const m = match();
  let html = V.miniature(m, false);
  assert.match(html, /class="tart tbrlw" aria-label="Barrel Launch: X 0, O 0 of 7 barrels up"/); assert.match(html, /<svg class="tbrl"/);
  assert.equal((html.match(/<i class="nb" style="--w:0\.0%"><\/i>/g) || []).length, 2, 'a bar each, empty');
  m.at.X = 7; html = V.miniature(m, false);
  assert.match(html, /<circle class="tbrt X" cx="15" cy="7"/); assert.match(html, /<i class="nb" style="--w:100\.0%"><\/i>/);
  assert.doesNotMatch(html, /class="[^"]*\b(back|sq|btn|big)\b/);
});
