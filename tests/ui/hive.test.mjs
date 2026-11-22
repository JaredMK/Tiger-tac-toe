// Letter Hive's screen (games/hive/view.js): Go! alone before a burst; the hive's seven cells with the centre one
// marked; both players' found words on show, each under its finder's tally; someone else's burst never typed out but
// landing word by word in their list, timed from the move, with the points counting on and the line at its end; this
// phone's own burst said at once; the sounds (a pop a word for someone else's, nothing again for one played here);
// the review (no controls); the miniature (the seven letters, a bar each); and the explainer following the settings.
// Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/hive/rules.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds } = await import('../../src/audio/sound.js');
const { startFx } = await import('../../src/ui/fx.js');
const V = await import('../../src/games/hive/view.js');
const { explainOf } = await import('../../src/ui/explainer.js');
GAMES.hive.view = V;   // (the page registers the views in main.js; here by hand)

function match(turn = 'X') {
  Object.assign(state, E.newMatch(E.makeRng('hive-ui'), { games: ['hive'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const game = html => html.slice(html.indexOf('class="g-hv'));
const btns = html => [...game(html).matchAll(/<button class="([^"]*)" data-act="([a-z-]+)"[^>]*?( disabled)?>([^<]*)</g)].map(m => [m[2], m[4], !m[3]]);
const list = (html, p) => { const g = game(html), at = g.indexOf(`<ul class="hvlist ${p}"`); return g.slice(at, g.indexOf('</ul>', at)); };
const chips = (html, p) => [...list(html, p).matchAll(/<li class="([^"]*)"(?: style="--t:(\d+)ms")?>([a-z]+)<\/li>/g)].map(m => [m[3], m[1], m[2] == null ? null : Number(m[2])]);
const pick = (pz, n, k = 0) => pz.words.filter(w => w.length === n && !pz.full.includes(w))[k];

test('hive: before a burst: Go! alone (this phone\'s turn), the seven cells with the centre marked, both lists and tallies', () => {
  const mini = match('X'), pz = R.hivePuzzle(mini.pz), html = renderMini(state.squares[0]), g = game(html);
  assert.deepEqual(btns(html), [['hive-go', 'Go!', true]]);
  const cells = [...g.matchAll(/<g class="hvc( mid)?" data-k="([a-z])"/g)].map(m => [m[2], !!m[1]]);
  assert.deepEqual(cells, [...pz.letters.slice(1)].map(ch => [ch, false]).concat([[pz.centre, true]]), 'six letters round the centre letter, the centre drawn last (on top)');
  assert.equal((g.match(/<text /g) || []).length, 7); assert.ok(!g.includes('hvcar') && !g.includes('hvbar on'), 'no caret and no time bar before Go!');
  assert.equal((g.match(/class="ctal /g) || []).length, 2); assert.ok(g.includes('<small>/40</small>')); assert.deepEqual([chips(html, 'X'), chips(html, 'O')], [[], []]);
  assert.match(g, /<p class="hvline"><\/p>/, 'the line is there, empty');
  match('O'); assert.deepEqual(btns(renderMini(state.squares[0])), [['hive-go', 'Go!', false]], 'the computer\'s turn: nothing to press');
  assert.deepEqual(V.replay.synth(), [], 'a replay presses nothing: the burst plays from the move'); assert.equal(V.ownLine, true);
});

test('hive: someone else\'s burst lands word by word in their list, the points counting on, then the line; this phone\'s own is said at once', () => {
  const mini = match('X'), pz = R.hivePuzzle(mini.pz), [a, b, c] = [pick(pz, 4), pick(pz, 5), pz.full[0]];
  assert.ok(E.playMove(state, 0, { w: [a] }, E.makeRng('m1')).ok);   // X's burst (this phone's)
  startFx('move', state.flash);
  let html = renderMini(state.squares[0]);
  assert.deepEqual(chips(html, 'X'), [[a, 'hvw', null]], 'its word already in the list, nothing timed');
  assert.match(game(html), /<p class="hvline ok">1 word · \+1<\/p>/); assert.deepEqual(moveSounds(state.flash).filter(s => /^hv/.test(s[0])), [], 'heard live: nothing again');
  state.flash = null; state.done = null; state.screen = 'mini'; state.zoom = 0; state.turn = 'O';
  assert.ok(E.playMove(state, 0, { w: [b, 'junk', c] }, E.makeRng('m2')).ok);   // O's burst (the computer's)
  const f = state.flash, s = f.hv; startFx('move', f);
  html = renderMini(state.squares[0]);
  assert.deepEqual(s.w, [b, c]);
  assert.deepEqual(chips(html, 'O'), [[b, 'hvw land', R.hiveWordAt(s, 0)], [c, 'hvw full land', R.hiveWordAt(s, 1)]], 'each word at its own moment, the full-hive word marked');
  assert.deepEqual(chips(html, 'X'), [[a, 'hvw', null]], 'the other list as it was');
  const g = game(html), cnt = g.match(/<b class="cnt" data-from="(\d+)" data-delay="(\d+)" data-ms="(\d+)">(\d+)<\/b>/);
  assert.deepEqual(cnt.slice(1).map(Number), [0, R.hiveWordAt(s, 0), Math.round(2 * R.hiveBeat(2)), 5 + c.length + 7], 'the points count on through the words');
  assert.ok(g.includes(`<p class="hvline full appear" style="--t:${R.hiveShowMs(s)}ms" role="status">Full hive! 2 words · +${5 + c.length + 7}</p>`), 'the line at the end of the landing');
  assert.ok(!g.includes('junk'));
  assert.deepEqual(moveSounds(f).filter(x => /^hv|ding|thud/.test(x[0])).map(x => [x[0], x[1]]), [['hvLand', R.hiveWordAt(s, 0)], ['hvFull', R.hiveWordAt(s, 1)], ['ding', R.hiveShowMs(s)]]);
  assert.ok(E.playMs(f) >= R.hiveShowMs(s) + R.HIVE.hold);
  // an empty burst: no words, a thud
  state.flash = null; state.done = null; state.screen = 'mini'; state.zoom = 0; state.turn = 'O';
  assert.ok(E.playMove(state, 0, { w: [] }, E.makeRng('m3')).ok); startFx('move', state.flash);
  assert.ok(game(renderMini(state.squares[0])).includes('>No words</p>')); assert.deepEqual(moveSounds(state.flash).filter(x => /^hv|ding|thud/.test(x[0])).map(x => x[0]), ['thud']);
  assert.match(V.moveText(f, 'Computer'), /^Computer found 2 words for \d+$/); assert.equal(V.moveText(state.flash, 'Computer'), 'Computer found no words');
});

test('hive: a won square under review: both lists, the last burst\'s line, no controls; the turn held after a full-hive word says so', () => {
  const mini = match('X'), pz = R.hivePuzzle(mini.pz);
  mini.pts.X = 39; assert.ok(E.playMove(state, 0, { w: [pz.full[0]] }, E.makeRng('w')).ok); assert.equal(state.squares[0].owner, 'X');
  state.flash = null; state.done = null; state.screen = 'mini'; state.zoom = 0;
  const html = renderMini(state.squares[0]);
  assert.deepEqual(btns(html), []); assert.deepEqual(chips(html, 'X').map(c => c.slice(0, 2)), [[pz.full[0], 'hvw full']]); assert.ok(game(html).includes('Full hive! 1 word'));
  assert.ok(!/claim|stamp/.test(game(html)), 'no claim inside the game');
  const m2 = match('X'); state.lock = 0; state.lockBy = null; assert.match(V.heldSub(m2, 'X', null, null), /filled the hive · goes again/); state.lockBy = 'open'; assert.equal(V.heldSub(m2, 'X', null, null), ''); state.lock = null; state.lockBy = null;
});

test('hive: the miniature: the seven letters, the centre marked, a bar each; public and small', () => {
  const mini = match('X'), pz = R.hivePuzzle(mini.pz);
  mini.pts = { X: 10, O: 30 };
  const t = V.miniature(mini, false);
  assert.deepEqual([...t.matchAll(/<text class="thvl( mid)?"[^>]*>([A-Z])<\/text>/g)].map(m => m[2] + (m[1] ? '*' : '')), [...pz.letters.slice(1).toUpperCase()].concat([pz.centre.toUpperCase() + '*']));
  assert.equal((t.match(/<polygon class="thvc/g) || []).length, 7); assert.deepEqual([...t.matchAll(/--w:([\d.]+)%/g)].map(m => Number(m[1])), [25, 75]);
  assert.ok(t.includes('aria-label="Letter Hive: X 10, O 30 of 40 points"')); assert.ok(!/class="[^"]*\b(sq|back|bar|big)\b/.test(t), 'its classes are its own');
});

test('hive: the explainer follows the settings', () => {
  const text = () => { const e = explainOf('hive'); return e.play + ' | ' + e.win; };
  state.screen = 'menu';   // (How to Play's: the settings as they would be dealt now; an open square shows its own)
  assert.match(text(), /burst of 20 seconds.*4-letter word scores 1, a longer word its length, and a word with all seven letters 7 more\. A word found is gone for both players\. \| First to 40 points\./);
  E.setTune('hive', { secs: 30, target: 50, four: 2, bonus: 10, again: 'on' });
  try { assert.match(text(), /burst of 30 seconds.*scores 2,.*seven letters 10 more.*All seven letters in a word\? Go again\. \| First to 50 points\./); } finally { E.setTune('hive', null); }
});
