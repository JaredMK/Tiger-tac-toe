// Split It's screen (games/pint/view.js): the drink in the tipped glass (the surface keeps the drink's share whatever
// the tip; the glass tips just as far as brings the drink to its lip), the screen before, during and after an attempt
// (the hold button, the canvas, the result's own reserved line, the points filling in after the verdict), the sounds
// (someone else's gulps first; this phone's own attempt from the release), and the miniature. Rendered in Node with
// the browser's names stubbed.
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
const V = await import('../../src/games/pint/view.js');
const R = await import('../../src/games/pint/rules.js');
GAMES.pint.view = V;   // (the page registers the views in main.js; here by hand)

function match(turn = 'X', tune) {
  E.setTune('pint', tune || null);
  try { Object.assign(state, E.newMatch(E.makeRng('pint-ui'), { games: ['pint'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null }); }
  finally { E.setTune('pint', null); }
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const names = f => moveSounds(f).map(s => [s[0], Math.round(s[1])]);

test('the drink in the glass: upright its surface is level at its share; tipped it keeps its share; the pour brings it to the lip', () => {
  const area = p => { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
  const under = (poly, w) => { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], ia = a[1] <= w, ib = b[1] <= w; if (ia) out.push(a); if (ia !== ib) { const k = (w - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * k, w]); } } return out; };
  for (const L of [0.9, 0.7, 0.5, 0.35, 0.15]) {
    const up = V.surface(0, L), floor = Math.min(...up.P.map(p => p[1])), top = Math.max(...up.P.map(p => p[1]));
    assert.ok(Math.abs((up.w - floor) / (top - floor) - L) < 1e-4, `upright, the level is the share: ${L}`);
    const a0 = area(under(up.P, up.w));
    for (const psi of [0.2, 0.6, 1.0, 1.3]) { const s = V.surface(psi, L); assert.ok(Math.abs(area(under(s.P, s.w)) - a0) < a0 * 1e-4 + 1e-3, `the same share at a tip of ${psi}`); }
  }
  assert.equal(V.pour(1), 0, 'a full glass pours at once');
  let prev = 0;
  for (const L of [0.97, 0.9, 0.7, 0.5, 0.35, 0.2]) {
    const th = V.pour(L), s = V.surface(th, L), lip = s.P[3][1];
    assert.ok(th > prev && th < Math.PI / 2, `the less left, the further it tips: ${L} → ${th.toFixed(2)}`); prev = th;
    if (th < 1.36) assert.ok(Math.abs(s.w - lip) < 0.05, `at the pour the surface is at the lip: ${L}`); else assert.ok(s.w < lip, 'the dregs: it tips no further than its most');
  }
});

test('before an attempt: the hold button in the mover\'s colour, the canvas, an empty reserved line, both tallies; nothing to press on the other side\'s turn', () => {
  match();
  let html = renderMini(state.squares[0]);
  assert.match(html, /<div class="g-pnt pc-X">/);
  assert.match(html, /<div class="pntfield live"><canvas class="pntcv" aria-label="[^"]*"><\/canvas><\/div>/);
  assert.match(html, /<p class="pntline"><\/p>/, 'the result\'s line is there, empty');
  assert.match(html, /<button class="big X pntbtn" data-act="pint-hold" aria-label="Hold to drink; let go to stop">/);
  assert.equal((html.match(/class="pips" aria-label="0 of 3"/g) || []).length, 2);
  assert.doesNotMatch(html.slice(html.indexOf('g-pnt')), /disabled/);
  state.turn = 'O'; html = renderMini(state.squares[0]);
  assert.match(html, /<div class="g-pnt pc-O">/); assert.match(html, /<div class="pntfield">/); assert.match(html, /class="big O pntbtn" data-act="pint-hold"[^>]* disabled>/);
});

test('an attempt: the words only after the drink has settled, the points after them; this phone\'s own starts at the release, someone else\'s plays their hold first', () => {
  const m = match(), mark = m.mark.X;
  assert.ok(E.playMove(state, 0, { lv: mark }, E.makeRng('s')).ok);
  const f = state.flash, own = renderMini(state.squares[0]);
  assert.equal(f.pn.pts, 2);
  assert.match(own, new RegExp(`<p class="pntline ok best appear" style="--t:${R.PINT.settle}ms" role="status">Perfect split!</p>`));
  assert.match(own, new RegExp(`<i class="on fillin" style="--t:${R.PINT.settle + V.PINV.point}ms"></i><i class="on fillin" style="--t:${R.PINT.settle + V.PINV.point + V.PINV.pip}ms"></i><i class=""></i>`), 'two pips, one after the other, once the verdict is in');
  assert.match(own, /class="big X pntbtn" data-act="pint-hold"[^>]* disabled>/);
  assert.deepEqual(names(f), [['pnSlosh', 40], ['pnPerfect', R.PINT.settle]], 'its gulps were heard live; the turn passes, so no fresh pint slides in');
  assert.equal(R.flashMs(f, 0, false), R.pintPre(f.pn) + R.PINT.settle + R.PINT.say + R.PINT.hold, 'the turn passes: straight back to the board after the hold, no next glass');
  // the computer's: the same picture after its hold
  match('O'); const mo = state.squares[0].mini; mo.mark.O = 0.5;
  assert.ok(E.playMove(state, 0, { lv: 0.6 }, E.makeRng('s')).ok);
  const g = state.flash, pre = g.pn.ms, html = renderMini(state.squares[0]);
  assert.ok(pre > 500 && pre < 1500);
  assert.match(html, new RegExp(`<p class="pntline no appear" style="--t:${pre + R.PINT.settle}ms" role="status">Too little</p>`)); assert.doesNotMatch(html, /fillin/);
  const snd = names(g);
  assert.ok(snd.filter(s => s[0] === 'pnGulp').length >= 3 && snd.filter(s => s[0] === 'pnGulp').every(s => s[1] < pre), 'gulps through the hold');
  assert.deepEqual(snd.filter(s => s[0] !== 'pnGulp'), [['pnStop', pre], ['pnSlosh', pre + 40], ['pnMiss', pre + R.PINT.settle]]);
  assert.ok(RESULT_SOUNDS.has('pnSplit') && RESULT_SOUNDS.has('pnPerfect') && BAD_SOUNDS.has('pnMiss'), 'the verdicts buzz');
  for (const [lv, words] of [[0.52, 'Split!'], [0.4, 'Too much'], [0, 'Too much']]) { match('O'); state.squares[0].mini.mark.O = 0.5; E.playMove(state, 0, { lv }, E.makeRng('s')); assert.match(renderMini(state.squares[0]), new RegExp(`role="status">${words}</p>`)); }
  assert.equal(V.moveText({ pn: { pts: 2 } }, 'Xena'), 'Xena split it perfectly'); assert.equal(V.moveText({ pn: { pts: 0, lv: 0.8, d: 0.2 } }, 'Xena'), 'Xena drank too little'); assert.equal(V.moveText({ pn: { pts: 0, lv: 0, d: -0.5 } }, 'Xena'), 'Xena drank too much');
  // Go again on success: a split keeps the turn, and then the fresh pint does slide in for the same player
  match('X', { again: 'on' }); state.squares[0].mini.mark.X = 0.5;
  assert.ok(E.playMove(state, 0, { lv: 0.52 }, E.makeRng('s')).ok);
  const k = state.flash; assert.equal(k.pn.next, 'X');
  assert.deepEqual(names(k), [['pnSlosh', 40], ['pnSplit', R.PINT.settle], ['pnSlide', R.PINT.settle + R.PINT.say + R.PINT.hold + R.PINT.next / 2 - 60]]);
  assert.equal(R.flashMs(k, 0, false), R.pintPre(k.pn) + R.PINT.settle + R.PINT.say + R.PINT.hold + R.PINT.next, 'the turn kept: the fresh pint comes in');
});

test('the miniature: a full glass before any attempt; then the glass as the last attempt left it with the mover\'s mark on its ring, beside the points as pips', () => {
  const m = match();
  let html = V.miniature(m, false);
  assert.match(html, /class="tart tpntw" aria-label="Split It: X 0, O 0 of 3 points"/); assert.match(html, /<svg class="tpnt"/); assert.doesNotMatch(html, /tpnm/);
  assert.equal((html.match(/<i class="/g) || []).length, 6);
  m.mark.X = 0.5; E.applyMove(m, 'X', { lv: 0.5 }, E.makeRng('x'));
  html = V.miniature(m, false);
  assert.match(html, /<g class="tpnm X" transform="translate\(30 31\.0\)">/); assert.equal((html.match(/<i class=" on">/g) || []).length, 2);
  assert.doesNotMatch(html, /class="[^"]*\b(back|sq|btn|big)\b/);
});
