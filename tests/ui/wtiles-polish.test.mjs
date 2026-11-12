// Word Tiles' look and motion (the polish sweep, November 2026; wtiles/view.js): the root is .wtg (never Five Letters'
// .wt), a picked rack tile lifts and flies to its square and back (ui/cardfly.js anchors), the draft's points ride its
// word and the Play button, a word played is stamped down tile by tile and each word it made counted in turn, the rack's
// new tiles fly in from the bag; someone else's word flies in from their score and their own tiles are only ever blank
// here: the other rack's letters and the bag's order never reach the page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
globalThis.window = new Proxy(stub(), { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false }) : stub()) });   // (motion on: the view draws its flights)
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = await import('../../src/games/wtiles/rules.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const V = await import('../../src/games/wtiles/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.wtiles.view = V;   // (the page registers the views in main.js; here by hand)

let n = 0;
function match(racks) {
  Object.assign(state, E.newMatch(E.makeRng('wt-polish-' + n++), { games: ['wtiles'], vs: 'cpu' }), { screen: 'mini', zoom: n % 9, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', stamp: null, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  const m = state.squares[state.zoom].mini = E.newMini('wtiles', E.makeRng('wt-deal-' + n));
  if (racks) Object.assign(m.rack, racks);
  return m;
}
const html = () => renderMini(state.squares[state.zoom]);
const rackOf = h => h.slice(h.indexOf('class="wtrack'), h.indexOf('class="cbtns'));
const tap = (act, v) => V.actions[act]({ dataset: { v: String(v) } });

test('the square: its own root class, the bag\'s count, this phone\'s rack alone; the other rack and the bag\'s order never on the page', () => {
  const m = match({ X: ['C', 'A', 'T', 'S', 'E', 'R', 'N'], O: ['Z', 'Z', 'X', 'X', 'Q', 'J', 'K'] });
  const h = html();
  assert.match(h, /class="g-arc wtg"/); assert.doesNotMatch(h, /class="g-arc wt"/, 'never Five Letters\' tile class on the root');
  assert.match(h, new RegExp(`class="wtbag" data-anchor="wtbag" aria-label="${m.bagN} tiles in the bag"`));
  assert.equal((rackOf(h).match(/class="wtt oX"/g) || []).length, 7, 'our seven tiles, in our colour');
  for (const l of 'ZXQJK') assert.doesNotMatch(h, new RegExp(`<b>${l}</b>`), `none of the other rack's letters (${l})`);
  assert.doesNotMatch(h, new RegExp(m.bag.join('')), 'not the bag');
  assert.match(h, /class="wtboard X"/, 'the board framed in the mover\'s colour'); assert.match(h, /class="wtstar"/);
  assert.equal((h.match(/data-anchor="wtc:\d+"/g) || []).length, 49); assert.equal((h.match(/data-anchor="wts:\d"/g) || []).length, 7);
});

test('the draft: a picked tile lifts, flies to its square and back; the word\'s points on the board, in the line and on Play', () => {
  match({ X: ['C', 'A', 'T', 'S', 'E', 'R', 'N'], O: ['Z', 'Z', 'X', 'X', 'Q', 'J', 'K'] });
  tap('wtr', 0);
  let h = html();
  assert.match(h, /class="wtr sel" data-act="wtr" data-v="0" data-anchor="wts:0" data-fx="[\d.]+"/, 'the picked tile lifts, from its tap'); assert.match(h, /class="wtboard X aim"/); assert.match(h, /class="wtc[^"]* can"/);
  tap('wtc', 23);
  h = html();
  assert.match(h, /data-v="23" data-anchor="wtc:23" data-fx="[\d.]+"[^>]*><span class="wtt dr oX" data-cf="wts:0" data-cfat="0"/, 'laid: it flies from its slot');
  assert.match(h, /class="wtr used"/); assert.match(h, /class="arcres no sm">The first word goes through the centre</);
  tap('wtr', 1); tap('wtc', 24); tap('wtr', 2); tap('wtc', 25);
  h = html();
  const pts = R.wtCheck(state.squares[state.zoom].mini.board, ['C', 'A', 'T', 'S', 'E', 'R', 'N'], [[23, 'C'], [24, 'A'], [25, 'T']], { bonus: 15 }).score;
  assert.match(h, new RegExp(`class="wtchip ok" style="--c:4;--r:3;--w:1;--h:1">\\+${pts}<`), 'the points on the word\'s last tile');
  assert.match(h, new RegExp(`class="arcres ok"><span class="wttick" aria-hidden="true"></span>CAT \\+${pts}<`)); assert.match(h, new RegExp(`class="big wtplay X go"[^>]*>Play <b>\\+${pts}</b>`));
  tap('wtc', 25);
  h = html();
  assert.match(rackOf(h), /data-v="2" data-anchor="wts:2" data-fx="[\d.]+"[^>]*><span class="wtt oX" data-cf="wtc:25"/, 'taken back: it flies home from its square');
  tap('wtr', 2); tap('wtc', 25); V.actions.wtclr();
  h = html();
  assert.equal((rackOf(h).match(/data-cf="wtc:\d+"/g) || []).length, 3, 'Clear: every laid tile flies back'); assert.doesNotMatch(h, /wtt dr/);
});

test('our word: stamped down tile by tile, each word counted in turn, the score counting on, the rack closing up and filling from the bag', () => {
  const m = match({ X: ['C', 'A', 'T', 'S', 'E', 'R', 'N'], O: ['Z', 'Z', 'X', 'X', 'Q', 'J', 'K'] });
  html(); tap('wtr', 0); tap('wtc', 23); tap('wtr', 1); tap('wtc', 24); tap('wtr', 2); tap('wtc', 25);
  assert.ok(E.playMove(state, state.zoom, [[23, 'C'], [24, 'A'], [25, 'T']], E.makeRng('p')).ok);
  const s = state.flash.wt, t = R.wtTimes(s), h = html();
  assert.deepEqual([...h.matchAll(/class="wtt oX last stamp" style="--t:(\d+)ms"/g)].map(x => Number(x[1])), [0, 1, 2].map(t.dropAt), 'stamped where they lay, one after the other');
  assert.doesNotMatch(h.slice(h.indexOf('class="wtboard'), h.indexOf('class="wtmid')), /data-cf=/, 'our own tiles do not fly in');
  assert.match(h, new RegExp(`class="wtwb" style="--c:2;--r:3;--w:3;--h:1;--t:${t.wordAt(0)}ms"><b>\\+${s.pts}</b>`), 'the word ringed with its points');
  assert.match(h, new RegExp(`class="wtstep" style="--t:${t.wordAt(0)}ms;--u:${t.wordAt(1)}ms">CAT \\+${s.pts}<`));
  assert.match(h, new RegExp(`class="cnt" data-from="0" data-delay="${t.count}"[^>]*>${s.pts}<`), 'the score counts on as the word is counted');
  const rack = rackOf(h);
  assert.deepEqual([...rack.matchAll(/data-cf="wts:(\d)" data-cfat="0" data-cfwait=""/g)].map(x => Number(x[1])), [3, 4, 5, 6], 'the four kept close up from their slots');
  assert.deepEqual([...rack.matchAll(/data-cf="wtbag" data-cfat="(\d+)"/g)].map(x => Number(x[1])), [0, 1, 2].map(t.fillAt), 'the three new ones from the bag');
  assert.match(h, new RegExp(`class="cnt" data-from="${m.bagN + 3}" data-delay="${t.fillAt(0)}"`), 'the bag counts down as they leave');
  assert.ok(t.fillAt(2) + R.WT.fly <= t.end && t.end <= E.playMs(state.flash));
  const snd = []; V.sounds(state.flash, (n, ms) => snd.push([n, ms]));
  assert.deepEqual(snd.filter(x => x[0] === 'domClick').map(x => x[1]), [0, 1, 2].map(t.landAt)); assert.ok(snd.some(x => x[0] === 'ding' && x[1] === t.wordAt(0)));
});

test('their word and their swap: the tiles fly in from their score; their own tiles are blank here, their letters never', () => {
  const m = match({ X: ['C', 'A', 'T', 'S', 'E', 'R', 'N'], O: ['Z', 'O', 'X', 'X', 'Q', 'J', 'K'] });
  state.turn = 'O';
  assert.ok(E.playMove(state, state.zoom, [[23, 'O'], [24, 'X']], E.makeRng('q')).ok);
  let h = html(), t = R.wtTimes(state.flash.wt);
  assert.deepEqual([...h.matchAll(/class="wtt oO last" data-cf="wtp:O" data-cfat="(\d+)"/g)].map(x => Number(x[1])), [0, 1].map(t.dropAt), 'their tiles fly in from their score');
  assert.equal((h.match(/class="wtt bk" data-cf="wtbag" data-cfat="\d+" data-cfgo=""/g) || []).length, 2, 'their new tiles: blank, to their score');
  for (const l of m.rack.O) if (!'CATSERNOX'.includes(l)) assert.doesNotMatch(h, new RegExp(`<b>${l}</b>`), `none of their rack (${l})`);
  assert.doesNotMatch(rackOf(h), /data-cf=/, 'our rack is still');
  state.flash = null; state.done = null; state.turn = 'O';
  const before = m.rack.O.slice();
  assert.ok(E.playMove(state, state.zoom, 'swap', E.makeRng('r')).ok);
  h = html(); t = R.wtTimes(state.flash.wt);
  assert.equal((h.match(/class="wtt bk" data-cf="wtp:O" data-cfat="\d+" data-cfgo=""/g) || []).length, 7, 'their tiles into the bag: blank');
  assert.equal((h.match(/class="wtt bk" data-cf="wtbag" data-cfat="\d+" data-cfgo=""/g) || []).length, 7, 'and back out: blank');
  assert.doesNotMatch(h, /class="wtt o[XO] gh"/, 'no faces');
  for (const l of before.concat(m.rack.O)) if (!'CATSERNOX'.includes(l)) assert.doesNotMatch(h, new RegExp(`<b>${l}</b>`));
  assert.ok(t.inAt(6) + R.WT.fly <= t.end && t.end <= E.playMs(state.flash));
  // our own swap: our old tiles (ours to see) fly to the bag, the new ones back
  state.flash = null; state.done = null; state.turn = 'X'; html();
  const old = m.rack.X.slice();
  assert.ok(E.playMove(state, state.zoom, 'swap', E.makeRng('u')).ok);
  h = html();
  assert.deepEqual([...h.matchAll(/class="wtt oX gh" data-cf="wts:(\d)" data-cfat="(\d+)" data-cfwait="" data-cfgo=""><b>(\w)<\/b>/g)].map(x => x[3]), old, 'our old tiles to the bag');
  assert.deepEqual([...rackOf(h).matchAll(/data-cf="wtbag" data-cfat="(\d+)"/g)].map(x => Number(x[1])), [0, 1, 2, 3, 4, 5, 6].map(t.inAt));
});

test('the winning word: its ring stays (gold), an ordinary one does not; several words: each in the line in its turn, the move\'s points with the last', () => {
  const m = match({ X: ['C', 'A', 'T', 'S', 'E', 'R', 'N'], O: ['Z', 'O', 'X', 'X', 'Q', 'J', 'K'] });
  m.score.X = R.wtCfg(m).target - 1;
  assert.ok(E.playMove(state, state.zoom, [[23, 'C'], [24, 'A'], [25, 'T']], E.makeRng('w')).ok);
  assert.equal(state.flash.kind, 'claim'); assert.match(html(), /class="wtwb win"/);
  const m2 = match({ X: ['C', 'A', 'T', 'S', 'E', 'R', 'N'], O: ['Z', 'O', 'X', 'X', 'Q', 'J', 'K'] });
  assert.ok(E.playMove(state, state.zoom, [[23, 'C'], [24, 'A'], [25, 'T']], E.makeRng('w')).ok); state.flash = null; state.done = null; state.turn = 'X';
  assert.ok(E.playMove(state, state.zoom, [[26, 'S'], [33, 'E'], [40, 'N']], E.makeRng('x')).ok, 'CATS and SEN');
  const s = state.flash.wt, t = R.wtTimes(s), h = html();
  assert.equal(s.words.length, 2); assert.equal(t.words, 2); assert.doesNotMatch(h, /wtwb win/);
  assert.deepEqual([...h.matchAll(/class="wtwb" style="[^"]*--t:(\d+)ms"/g)].map(x => Number(x[1])), [t.wordAt(0), t.wordAt(1)]);
  assert.match(h, new RegExp(`class="wtstep on" style="--t:${t.wordAt(0)}ms;--u:${t.wordAt(1)}ms">${s.words[0].w} \\+${s.words[0].s}<`));
  assert.match(h, new RegExp(`class="wtstep" style="--t:${t.wordAt(1)}ms;--u:${t.wordAt(2)}ms">${s.words[1].w} \\+${s.words[1].s} <small>= ${s.pts}</small>`));
  assert.ok(m2.score.X > 0);
});
