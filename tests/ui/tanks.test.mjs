// Tank Duel's view (games/tanks/view.js), rendered in Node with the browser's names stubbed: the screen's reserved
// rows and controls (a draft: nothing is a move but Fire), the health tallies counting down from the move, the result
// words, the sounds in the move's order, the miniature, and a replay that presses nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = await import('../../src/games/tanks/rules.js');
const V = await import('../../src/games/tanks/view.js');
const { state } = await import('../../src/ui/app.js');

const fresh = () => { const st = E.newMatch(E.makeRng('tk-ui'), { games: ['tanks'] }); Object.assign(state, st, { screen: 'mini', zoom: 4, online: null, cpu: null, sc: null, flash: null, done: null }); state.turn = 'X'; return state.squares[4].mini; };
const draw = (mini, o = {}) => V.screen(state.squares[4], null, o.d || null, mini, !!o.view, !!o.locked, o.a || null, null, null, null, null, o.turn || 'X', null);

test('tanks: the screen: two health tallies, the field, the reserved line, the two rows of controls; every control a tanks- act, none a move', () => {
  const mini = fresh(), html = draw(mini);
  assert.ok(/class="g-tk pc-X"/.test(html)); assert.equal((html.match(/class="ctal /g) || []).length, 2); assert.ok(html.includes('aria-label="Health 100 of 100"'));
  assert.ok(html.includes('<div class="tkfield live"><canvas class="tkcv"')); assert.ok(html.includes('<p class="tkline"></p>'), 'the line keeps its room, empty');
  assert.deepEqual([...html.matchAll(/data-act="([^"]+)"/g)].map(m => m[1]), ['tanks-am', 'tanks-ap', 'tanks-pm', 'tanks-pp', 'tanks-l', 'tanks-r', 'tanks-fire']);
  assert.ok(!/data-m=/.test(html) && !/data-act="move"/.test(html), 'a draft: no control is a move');
  assert.equal((html.match(/class="on"/g) || []).length, 6, 'the fuel, full'); assert.ok(!/disabled/.test(html));
  assert.ok(/<b>55°<\/b>/.test(html) && /<b>60<\/b>/.test(html), 'the first aim: towards the other tank');
  for (const k of Object.keys(V.actions)) assert.ok(k.startsWith('tanks-'), k);
  const seen = draw(mini, { view: true }); assert.ok(!/data-act/.test(seen) && !seen.includes('tkfield live'), 'a square looked at: no controls');
  const theirs = draw(mini, { locked: true, turn: 'O' }); assert.equal((theirs.match(/disabled/g) || []).length, 7, 'not this phone\'s turn: every control off');
  assert.ok(!/undefined|NaN|\[object/.test(html + seen + theirs));
});

test('tanks: a move\'s flash: the health counts down from the blast, the words land with it; the words and the sounds by what the blast did; nothing pressed in a replay', () => {
  const mini = fresh(), c = R.tankCfg(mini), H = R.tankHeights(mini.h);
  let hit = null; for (let a = 20; a <= 85 && !hit; a++) for (let p = 10; p <= 100 && !hit; p++) { const t = R.tankTry(c, H, mini.wind, mini.at, 'X', { d: 2, a, p }); if (t.hit === 'O') hit = { d: 2, a, p }; }
  assert.ok(hit, 'a direct hit exists');
  assert.ok(E.playMove(state, 4, hit, E.makeRng('s')).ok);
  const f = state.flash, T = R.tankTimes(f.tk), html = draw(state.squares[4].mini, { a: f, locked: true, turn: 'O' });
  assert.ok(html.includes(`data-from="100" data-delay="${Math.round(T.land)}">60</b>`), 'O\'s health counts from 100 to 60 at the blast');
  assert.ok(html.includes(`class="tkline ok appear" style="--t:${Math.round(T.land)}ms"`) && html.includes('Direct hit! −40'));
  assert.equal(V.moveText(f, 'Sam'), 'Sam scored a direct hit');
  const got = []; V.sounds(f, (n, t) => got.push([n, Math.round(t)]), false, state.squares[4].mini, null);
  assert.deepEqual(got.filter(g => g[0] !== 'tnWhistle'), [['tnTrack', 0], ['tnTrack', R.TANKT.col], ['tnFire', Math.round(T.fire)], ['tnHit', Math.round(T.land)], ['tnBoom', Math.round(T.land)]]);
  assert.deepEqual(V.replay.synth(), []); assert.equal(V.ownLine, true);
  assert.deepEqual(V.tankWords({ by: 'X', hit: 'ground', dmg: [0, 12] }), ['near', 'Close! −12']);
  assert.deepEqual(V.tankWords({ by: 'O', hit: 'ground', dmg: [0, 9] }), ['no', 'Too close to home! −9']);
  assert.deepEqual(V.tankWords({ by: 'X', hit: 'ground', dmg: [0, 0] }), ['no', 'Missed']); assert.deepEqual(V.tankWords({ by: 'X', hit: 'out', dmg: [0, 0] }), ['no', 'Off the field']);
  const out = []; V.sounds({ tk: Object.assign({}, f.tk, { hit: 'out', dmg: [0, 0] }) }, n => out.push(n)); assert.ok(out.includes('tnOut') && !out.includes('tnBoom'));
});

test('tanks: the miniature: the hills and the two tanks, each one\'s health as a bar; a knocked-out tank greyed', () => {
  const mini = fresh(), html = V.miniature(mini, false);
  assert.ok(/<svg class="ttk"/.test(html) && html.includes('class="ttkh"') && html.includes('class="ttkt X"') && html.includes('class="ttkt O"'));
  assert.equal((html.match(/--w:100\.0%/g) || []).length, 2);
  mini.hp.O = 0; mini.hp.X = 35; const h2 = V.miniature(mini, true); assert.ok(h2.includes('class="ttkt O out"') && h2.includes('--w:35.0%') && h2.includes('--w:0.0%'));
  assert.ok(!/<text|undefined|NaN/.test(html + h2));
});
