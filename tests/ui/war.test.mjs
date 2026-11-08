// War's screen and miniature (src/games/war/view.js), rendered in Node with the browser's names stubbed: a fresh table,
// a move playing card by card from its flash (the cards, their moments, "War!" at a tie, the verdict and the pips at
// the end), the table after it, and an opponent's replay showing the opponent's cards, never the viewer's own last
// flip (CLAUDE.md: what a replay animates comes from the recorded flash). Nothing of the decks ever reaches the markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });   // (no reduced motion here: the move's moments are what is tested)
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/war/rules.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/war/view.js');
const { hideMini } = await import('../../src/core/records.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const clone = v => JSON.parse(JSON.stringify(v));
const DOWN = ['2D', '3D', '4D', '5D', '6D', '7D'];
const rig = (m, p, ...top) => { m.deck[p] = ['2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'TC', 'JC', 'QC', 'KC'].concat(top.slice().reverse()); };
// A move made on a copy of the mini: the square after it and the move's flash (what a replay carries).
function play(mini, p, ...top) {
  const m = clone(mini); rig(m, p, ...top);
  const res = E.applyMove(m, p, 'flip', lcg(1));
  assert.equal(res.ok, true);
  const flash = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p, square: 0, type: 'war', note: res.note || null, pass: null, timeout: false };
  GAMES.war.rules.moveFlash('flip', p, null, 0, m, flash);
  return { mini: m, flash };
}
const screen = (mini, flash, turn, o = {}) => V.screen({ owner: null, mini }, flash, o.d || null, mini, !!o.view, !!flash || !!o.view, flash, null, false, () => -1, false, turn, '');
const count = (html, re) => (html.match(re) || []).length;

test('a fresh table: a back on each side, the turn\'s name, the Flip button in the mover\'s colour, empty pips; nothing of the decks', () => {
  const m = E.newMini('war', E.makeRng('w-ui'));
  const html = screen(m, null, 'X');
  assert.equal(count(html, /plc down ghost/g), 2);
  assert.match(html, /Xena<\/b>'s turn/); assert.match(html, /<button class="big X" data-act="move" data-m='"flip"'>Flip<\/button>/);
  assert.equal(count(html, /<i class="on"/g), 0); assert.equal(count(html, /<i class=""/g), 6, 'three pips each');
  for (const c of m.deck.X.slice(-6)) assert.doesNotMatch(html, new RegExp(c));
  assert.doesNotMatch(html, /undefined|NaN/);
  const v = screen(m, null, 'X', { view: true });
  assert.doesNotMatch(v, /<button/); assert.match(v, /wrres none/);
});

test('a move plays from its flash: the player\'s card slides and turns first, the dealer\'s after it, "War!" at the tie, the down cards, the verdict and the pips at the end', () => {
  const m0 = E.newMini('war', E.makeRng('w-ui2')), x = play(m0, 'X', 'QD', 'QC', ...DOWN, '9S', '5H');
  const plan = R.warPlan(x.flash.war), html = screen(x.mini, x.flash, 'X');
  const b0 = plan.battles[0], b1 = plan.battles[1];
  assert.match(html, new RegExp(`aria-label="Queen of diamonds"`)); assert.match(html, /Queen of clubs/); assert.match(html, /9 of spades/); assert.match(html, /5 of hearts/);
  assert.ok(html.includes(`--d:0ms;--f:${b0.pFlip}ms`), 'the player\'s first card at once');
  assert.ok(html.includes(`--d:${b0.dAt}ms;--f:${b0.dFlip}ms`), 'the dealer\'s after the gap');
  assert.ok(html.includes(`--d:${b1.pAt}ms;--f:${b1.pFlip}ms`) && html.includes(`--d:${b1.dAt}ms;--f:${b1.dFlip}ms`), 'the second pair after the war');
  assert.equal(count(html, /plc down slide wrdn/g), 6, 'three down each side');
  for (let i = 0; i < 3; i++) assert.ok(html.includes(`style="--d:${b0.downAt + i * R.WART.down}ms"`), `down card ${i} in its turn`);
  assert.match(html, new RegExp(`<div class="wrres war" style="--f:${b0.judge}ms;--u:${b1.judge}ms" role="status">War!</div>`));
  assert.match(html, new RegExp(`class="wrres ok appear" style="--t:${plan.end}ms" role="status">.*War won! \\+2`));
  assert.equal(count(html, new RegExp(`class="on fillin" style="--t:${plan.end}ms"`, 'g')), 2, 'both pips fill in at the end');
  assert.match(html, /wrcards wrn2/);
  assert.doesNotMatch(html, /undefined|NaN/);
  // a plain loss: the dealer's round, no pip
  const o = play(x.mini, 'O', '3S', 'AH'), h2 = screen(o.mini, o.flash, 'O');
  assert.match(h2, /wrres no appear.*Dealer's round/); assert.doesNotMatch(h2, /fillin/); assert.doesNotMatch(h2, /War!/);
  assert.equal(count(h2, /plc(?: red)? slide flip/g), 2, 'two cards');
  // the words and sounds of the move
  assert.equal(V.moveText(x.flash, 'Xena'), 'Xena won the war'); assert.equal(V.moveText(o.flash, 'Olaf'), "Olaf: the dealer's round");
  const got = []; V.sounds(x.flash, (n, t) => got.push([n, t]), false, x.mini, null);
  assert.deepEqual(got.filter(s => s[0] === 'warDrum'), [['warDrum', b0.judge]]);
  assert.deepEqual(got.filter(s => s[0] === 'ding'), [['ding', plan.end], ['ding', plan.end + 170]]);
  assert.equal(got.filter(s => s[0] === 'cardSlide').length, 4 + 3, 'a slide for each pair of down cards'); assert.equal(got.filter(s => s[0] === 'cardFlip').length, 4);
  const lost = []; V.sounds(o.flash, (n, t) => lost.push(n), false, o.mini, null);
  assert.deepEqual(lost, ['cardSlide', 'cardFlip', 'cardSlide', 'cardFlip', 'nopair']);
  assert.ok(got.every(s => s[1] <= R.flashMs(x.flash, 0, false)), 'every sound within the move');
});

test('after the move the table keeps the round\'s cards face up, still, and names the next turn; a held result says the verdict', () => {
  const m0 = E.newMini('war', E.makeRng('w-ui3')), x = play(m0, 'X', 'KH', '7S');
  const html = screen(x.mini, null, 'O');
  assert.match(html, /King of hearts/); assert.match(html, /7 of spades/); assert.doesNotMatch(html, /--d:|--f:|--t:|fillin|appear/);
  assert.match(html, /Olaf<\/b>'s turn/); assert.match(html, /<b class="X">Xena<\/b><\/span><div class="wrcards">/, 'whose cards they are');
  assert.equal(count(html, /<i class="on"/g), 1);
  const held = screen(x.mini, null, 'X', { d: { kind: 'move', by: 'X' } });
  assert.match(held, /wrres ok".*\+1/);
});

test('an opponent\'s replay shows the opponent\'s cards and verdict, never the viewer\'s own last flip', () => {
  const m0 = E.newMini('war', E.makeRng('w-ui4')), x = play(m0, 'X', 'KH', '7S'), o = play(x.mini, 'O', '4C', 'JD');
  const html = screen(x.mini, o.flash, 'O');   // the square as X left it (X's king), O's recorded move playing
  assert.match(html, /4 of clubs/); assert.match(html, /Jack of diamonds/);
  assert.doesNotMatch(html, /King of hearts|7 of spades/);
  assert.match(html, /Dealer's round/); assert.match(html, /<b class="O">Olaf<\/b><\/span>/);
});

test('the miniature: the last flip\'s two cards face to face (the player\'s ringed in their colour) and the pips; the same from the hidden square', () => {
  const m0 = E.newMini('war', E.makeRng('w-ui5'));
  const fresh = V.miniature(m0, false);
  assert.equal(count(fresh, /tcd cdb/g), 2, 'two backs before any flip'); assert.match(fresh, /twvs/);
  const x = play(m0, 'X', 'QD', 'QC', ...DOWN, '9S', '5H');
  const html = V.miniature(x.mini, false);
  assert.match(html, /<i class="tcd X"><b>9<\/b>/); assert.match(html, /<i class="tcd red"><b>5<\/b>/);
  assert.doesNotMatch(html, /<b>Q<\/b>/, 'the last pair alone');
  assert.equal(count(html, /<i class=" on">/g), 2);
  const hidden = clone(x.mini); hideMini(hidden, 0, state);
  assert.equal(hidden.deck, undefined); assert.equal(V.miniature(hidden, false), html);
  for (const c of x.mini.deck.X.slice(-4)) assert.doesNotMatch(html, new RegExp(`<b>${c[0]}</b><svg[^>]*><path d="${c[1] === 'S' ? 'M12 2.2' : 'zzz'}`));
});
