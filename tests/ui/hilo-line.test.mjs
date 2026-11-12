// Higher/Lower's square (Shared), November 2026 polish: the number line is the hero. Every guess is a pin on it in its
// guesser's colour, the newest tagged with its number; a fresh guess flies there from its pad key (ui/cardfly.js) and the
// ruled-out side sweeps shut; the pad tells a number still possible from one ruled out and one guessed; the number
// itself is drawn only once it is found (or the square is over). Rendered in Node, the browser stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const V = await import('../../src/games/hilo/view.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS } = await import('../../src/ui/haptics.js');
GAMES.hilo.view = V;   // (the page registers the views in main.js; here by hand)

function match(target) {
  Object.assign(state, E.newMatch(E.makeRng('hilo-line'), { games: ['hilo'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  const m = state.squares[0].mini; m.target = target;
  return m;
}
const key = (html, n) => (html.match(new RegExp(`<button class="([^"]*)" data-act="move" data-m='${n}'([^>]*)>`)) || []).slice(1);

test('a guess: its pin flies from its key to the line, the ruled-out side sweeps shut, the keys shut away from the guess, the answer in its line', () => {
  match(20);
  assert.ok(E.playMove(state, 0, 12, E.makeRng('g')).ok);
  const html = renderMini(state.squares[0]);
  assert.match(html, /<div class="hline">/);
  assert.match(html, /class="seg shrink" style="--l:40\.00%;--w:60\.00%;--pl:0\.00%;--pw:100\.00%"/, 'the window narrows from 1-30 to 13-30');
  assert.match(html, /<i class="hlt X fresh" data-r="up" data-tag="" style="--at:38\.33%" data-cf="hpad:12" data-cfat="0"[^>]*><b>12<\/b><\/i>/, 'the pin, tagged, flying from its key');
  const [cls, rest] = key(html, 12);
  assert.equal(cls, 'X up me'); assert.match(rest, /disabled/); assert.match(rest, /data-anchor="hpad:12"/, 'the key it flies from');
  assert.deepEqual(key(html, 11), ['shut out', ' disabled style="--d:1"'], 'ruled out just now: shuts first');
  assert.deepEqual(key(html, 1), ['shut out', ' disabled style="--d:11"'], '...and the farthest last');
  assert.deepEqual(key(html, 13), ['', ' disabled'], 'still possible (the pad locked while the move plays)');
  assert.match(html, /<b class="cnt" data-from="1" data-delay="\d+" data-ms="\d+">13<\/b><span>and<\/span><b>30<\/b>/, 'the bound that moved counts over as the line closes');
  assert.match(html, /class="guess fresh"><b class="X hn">Xena<\/b> said <b class="n">12<\/b><span class="arrow up">▲<\/span><b class="hres">Higher!<\/b>/);
  assert.match(html, /class="hpips X"[^>]*><i class="on"><\/i><i class="on"><\/i><i class="on"><\/i><i class="on"><\/i><i class="use"><\/i>/, 'the guess spent, its pip emptying');
  assert.doesNotMatch(html, /hlnum|number was/, 'the number stays out of the page');
  const snd = moveSounds(state.flash).map(s => s[0]);
  assert.deepEqual(snd, ['hiloBlip', 'higher']); assert.ok(RESULT_SOUNDS.has('higher') && RESULT_SOUNDS.has('lower'), 'the answer buzzes as a result');
});

test('later: every guess keeps its pin and its key, only the newest is tagged; nothing animates again', () => {
  const m = match(20);
  E.applyMove(m, 'X', 12, E.makeRng('g')); E.applyMove(m, 'O', 25, E.makeRng('g'));
  const html = renderMini(state.squares[0]);
  assert.equal((html.match(/class="hlt [XO]"/g) || []).length, 2); assert.equal((html.match(/data-tag=""/g) || []).length, 1);
  assert.match(html, /<i class="hlt O" data-r="dn" data-tag="" style="--at:81\.67%"><b>25<\/b><\/i>/);
  assert.doesNotMatch(html, /fresh|shrink|data-cf|class="cnt"| out"| me"|class="use"/, 'no move playing: nothing to animate');
  assert.equal(key(html, 12)[0], 'X up'); assert.equal(key(html, 25)[0], 'O dn'); assert.equal(key(html, 5)[0], 'shut'); assert.equal(key(html, 26)[0], 'shut');
  assert.deepEqual(key(html, 20), ['', ''], 'a number still possible, this phone to move: an open key');
  assert.match(html, /class="g-hilo t30 tX"/, "the mover's colour under the finger");
});

test('found: the line closes onto the number and the card says it; the last guess gone says so in the reserved line', () => {
  const m = match(20);
  E.applyMove(m, 'X', 12, E.makeRng('g'));
  assert.ok(E.playMove(state, 0, 20, E.makeRng('g')).ok);
  const html = renderMini(state.squares[0]);
  assert.match(html, /<div class="hline found">/); assert.match(html, /class="seg shrink" style="--l:63\.33%;--w:3\.33%;/);
  assert.match(html, /class="hlhd found fresh"><div class="hlwas"><small>It is between<\/small><b>13<\/b><span>and<\/span><b>30<\/b><\/div><div class="hlnow"><small>It is<\/small><b class="hlnum">20<\/b>/);
  assert.equal(key(html, 20)[0], 'X hit me'); assert.equal(key(html, 21)[0], 'shut out');
  assert.equal(V.moveText(state.flash, 'Xena'), '20? Yes!');
  const m2 = match(29);
  for (const [p, n] of [['X', 1], ['O', 2], ['X', 3], ['O', 4], ['X', 5], ['O', 6], ['X', 7], ['O', 8]]) E.applyMove(m2, p, n, E.makeRng('g'));
  const r = E.playMove(state, 0, 15, E.makeRng('g')); assert.ok(r.ok);
  const out = renderMini(state.squares[0]);
  assert.match(out, /class="guess fresh"><b class="n X">15<\/b><span class="arrow up">▲<\/span><b class="hres">Higher!<\/b><span class="hout">No guesses left<\/span>/);
  assert.doesNotMatch(out, /number was|hlnum/, 'the number stays hidden while the result plays');
  assert.equal(V.miniature(m2, false).includes('29'), false, 'and out of the miniature');
});
