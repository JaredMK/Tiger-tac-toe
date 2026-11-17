// Codebreaker's square (Shared), November 2026 polish: every guess row the same size (December 2026),
// the latest too; a colour flies from the palette into its slot and a guess's pegs from their slots into the new
// row (ui/cardfly.js); the cracked code opens only once the markers have landed; the code never reaches the page before.
// Rendered in Node, the browser stubbed.
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
const V = await import('../../src/games/mastermind/view.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds } = await import('../../src/audio/sound.js');
GAMES.mastermind.view = V;   // (the page registers the views in main.js; here by hand)

function match() {
  Object.assign(state, E.newMatch(E.makeRng('mm-rows'), { games: ['mastermind'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  const m = state.squares[0].mini; m.code = [0, 3, 4, 1];
  V.setMmDraft(null);
  return m;
}
const rows = html => html.match(/<div class="mmrow[\s\S]*?<\/span><\/div>/g) || [];

test('the rows: every one the same size, the newest too; the controls in the mover\'s colour; the code hidden', () => {
  const m = match(), rng = E.makeRng('r');
  E.applyMove(m, 'X', [0, 4, 3, 2], rng); E.applyMove(m, 'O', [1, 3, 5, 0], rng); E.applyMove(m, 'X', [3, 0, 4, 1], rng);
  const html = renderMini(state.squares[0]), rs = rows(html);
  assert.equal(rs.length, 3);
  for (const r of rs) assert.match(r, /^<div class="mmrow">/, 'no framed or larger newest row');
  assert.doesNotMatch(html, /mmrow[^"]*\b(new|old)\b/);
  assert.match(rs[1], /class="mmby O"/, "each row carries its guesser's mark");
  assert.doesNotMatch(html, /fresh|data-cf=| rv"/, 'no move playing: nothing to animate');
  assert.match(html, /<button class="big mmgo X" data-act="move"/, "Submit in the mover's colour");
  assert.equal((html.match(/class="peg hid"/g) || []).length, 4, 'the code hidden');
  assert.doesNotMatch(html, /shell open/);
  for (let c = 0; c < 6; c++) assert.match(html, new RegExp(`<button class="mmcol c${c}" data-act="mmcol" data-c="${c}" aria-label="[A-Za-z]+" data-anchor="mmcol:${c}">`), 'a colour, where its peg flies from');
});

test('a colour flies from the palette into its slot; a guess sent, its pegs fly from the slots into the new row, then the markers land', () => {
  const m = match();
  renderMini(state.squares[0]);
  V.actions.mmcol({ dataset: { c: '3' } });
  const h1 = renderMini(state.squares[0]);
  assert.match(h1, /<button class="mmslot full" data-act="mmslot" aria-pressed="false" data-k="0"[^>]*data-anchor="mmslot:0" data-fx="[\d.]+">\s*<i class="peg c3 pop" data-cf="mmcol:3" data-cfat="0" data-cfd="170"/, 'the peg in its slot, flying from its colour');
  assert.match(h1, /<button class="mmcol c3 used"[^>]*disabled>/, 'no colour twice: the one used is closed');
  assert.ok(E.playMove(state, 0, [3, 0, 2, 5], E.makeRng('m')).ok);
  const h2 = renderMini(state.squares[0]), r = rows(h2);
  assert.equal(r.length, 1); assert.match(r[0], /^<div class="mmrow fresh">/);
  [3, 0, 2, 5].forEach((c, k) => assert.match(r[0], new RegExp(`<i class="peg c${c} in" style="--k:${k}" data-cf="mmslot:${k}" data-cfat="${k * 40}" data-cfwait="" data-cfd="220"`), `peg ${k} from its slot, in its turn`));
  assert.equal((r[0].match(/ rv" style="--k:\d"/g) || []).length, 4, 'its markers land one by one');
  assert.equal((h2.match(/data-anchor="mmslot:\d"/g) || []).length, 4, 'the slots they leave');
  assert.equal((h2.match(/class="peg hid"/g) || []).length, 4, 'the code still hidden');
  const snd = moveSounds(state.flash);
  assert.deepEqual(snd.filter(s => s[0] === 'peg').map(s => s[1]), [220, 260, 300, 340], 'the pegs click in as they land');
  assert.equal(snd.filter(s => s[0] === 'marker').length, 2, '0 solid, 2 hollow');
  assert.ok(snd.filter(s => s[0] === 'marker').every(s => s[1] >= 450), 'the markers after the pegs');
});

test('cracked: the code opens once the markers have landed, each "?" giving way to its peg; the miniature keeps the code to a finished square', () => {
  const m = match(), rng = E.makeRng('w');
  E.applyMove(m, 'O', [1, 3, 5, 0], rng);
  const mid = V.miniature(m, false);
  assert.match(mid, /<div class="tmm"[^>]*><div class="tmc"><i><\/i><i><\/i><i><\/i><i><\/i><\/div><div class="tmr O">/, 'the tray shut over the rows, each with its guesser');
  assert.ok(E.playMove(state, 0, [0, 3, 4, 1], E.makeRng('m')).ok);
  const html = renderMini(state.squares[0]);
  assert.match(html, /class="mmcode small cracked fresh"/);
  assert.equal((html.match(/<span class="shell open flip" style="--k:\d"><i class="peg hid was" aria-hidden="true">\?<\/i><i class="peg c\d"/g) || []).length, 4);
  assert.equal(E.playMs(state.flash, 4), 450 + 4 * 250 + 900, 'the move plays on through the reveal');
  assert.match(V.miniature(m, true), /<div class="tmc open"><i class="c0"><\/i><i class="c3"><\/i><i class="c4"><\/i><i class="c1"><\/i><\/div>/);
  assert.doesNotMatch(V.miniature(m, false), /tmc open/);
});

test('the guess being made: tap any slot to select it, a colour fills it and the next empty slot is selected; a filled slot is changed, not cleared; Submit when full', () => {
  match(); renderMini(state.squares[0]);
  const at = () => V.mmDraft.at, slots = () => V.mmDraft.slots.slice();
  assert.equal(at(), 0, 'the first slot starts selected');
  V.actions.mmslot({ dataset: { k: '2' } }); assert.equal(at(), 2, 'tap any slot: selected');
  assert.match(renderMini(state.squares[0]), /<button class="mmslot at" data-act="mmslot" aria-pressed="true" data-k="2"/, 'highlighted');
  V.actions.mmcol({ dataset: { c: '4' } }); assert.deepEqual(slots(), [null, null, 4, null]); assert.equal(at(), 3, 'the next empty one after it');
  V.actions.mmcol({ dataset: { c: '1' } }); assert.deepEqual(slots(), [null, null, 4, 1]); assert.equal(at(), 0, 'then the first empty one');
  V.actions.mmslot({ dataset: { k: '2' } }); assert.deepEqual(slots(), [null, null, 4, 1], 'a filled slot is selected, not cleared');
  assert.match(renderMini(state.squares[0]), /<button class="mmcol c4"[^>]*data-c="4"[^>]*aria-label="[A-Za-z]+"(?![^>]*disabled)/, 'its own colour stays open');
  V.actions.mmcol({ dataset: { c: '0' } }); assert.deepEqual(slots(), [null, null, 0, 1], 'changed'); assert.equal(at(), 0);
  V.actions.mmcol({ dataset: { c: '1' } }); assert.deepEqual(slots(), [null, null, 0, 1], 'no colour twice');
  V.actions.mmcol({ dataset: { c: '2' } }); V.actions.mmcol({ dataset: { c: '3' } });
  assert.deepEqual(slots(), [2, 3, 0, 1]); assert.equal(at(), 1, 'all full: the one just filled stays selected');
  assert.doesNotMatch(renderMini(state.squares[0]), /class="big mmgo[^>]*disabled/, 'Submit when every slot is filled');
  V.actions.mmslot({ dataset: { k: '0' } }); V.actions.mmcol({ dataset: { c: '5' } });
  assert.deepEqual(slots(), [5, 3, 0, 1]); assert.equal(at(), 0, 'changing a full guess stays on the slot');
});
test('a replay presses the same controls: a slot selected, then colours, then Submit', () => {
  V.setMmDraft(null);
  const r = { sq: 0 };
  V.replay.input('mmslot', 'k=2', r); V.replay.input('mmcol', 'c=3', r);
  assert.deepEqual(V.mmDraft.slots, [null, null, 3, null]); assert.equal(V.mmDraft.at, 3);
  assert.deepEqual(V.replay.synth([0, 1, 2, 3]).map(x => x[1]), ['mmcol', 'mmcol', 'mmcol', 'mmcol', 'move']);
});
