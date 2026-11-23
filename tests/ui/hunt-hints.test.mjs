// Treasure Hunt's Hint difficulty on the page (the admin's `hints`, rules.js HUNT_HINTS): the key under the grid names the
// square's own bands (the default exactly as it always was; 'hard' every band a step wider; 'harder' Hot, Warm and Cold
// alone), a dug cell shows its wide band in its colour, Shared and Race alike, the miniatures too, and the "?" explainer
// says how far each band reaches while the setting is not 'normal'.
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
const { explainOf } = await import('../../src/ui/explainer.js');
const V = await import('../../src/games/hunt/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.hunt.view = V;   // (the page registers the views in main.js; here by hand)

// The key as it was before the setting existed, character for character.
const OLD_KEY = '<div class="hkey" aria-label="Key: Hot 1 step, Warm 2–3 steps, Cool 4–5 steps, Cold 6+ steps"><span style="background:#ff4d4d;color:#fff"><b>Hot</b>1 step</span><span style="background:#ffb627;color:#1a1a1a"><b>Warm</b>2–3</span><span style="background:#4cc9c0;color:#1a1a1a"><b>Cool</b>4–5</span><span style="background:#3b6fd6;color:#fff"><b>Cold</b>6+</span></div>';
const COLOUR = { Hot: '#ff4d4d', Warm: '#ffb627', Cool: '#4cc9c0', Cold: '#3b6fd6' };
function deal(tuneSet, seed) {
  E.setTune('hunt', tuneSet);
  Object.assign(state, E.newMatch(E.makeRng(seed || 'hunt-hints'), { games: ['hunt'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', stamp: null, lock: null });
  E.setTune('hunt', null);
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const keyOf = html => html.match(/<div class="hkey"[\s\S]*?<\/div>/)[0];
const pills = html => [...keyOf(html).matchAll(/<span style="background:([^;]+);[^"]*"><b>(\w+)<\/b>([^<]*)<\/span>/g)].map(x => [x[2], x[3], x[1]]);
const cellAt = (html, i) => html.match(new RegExp(`<button class="dig[^"]*" data-act="move" data-m='${i}'[^>]*>([\\s\\S]*?)</button>`));
// a cell `d` steps from the treasure (0..: along the treasure's row, then down the far side)
const stepsAway = (t, d) => { for (let c = 0; c < 36; c++) if (c !== t && E.huntDist(t, c) === d) return c; return null; };

test('hints: the default is as it always was: the key, character for character, in Shared and Race', () => {
  deal(null);
  assert.equal(keyOf(renderMini(state.squares[0])), OLD_KEY, 'Shared');
  deal({ mode: 'race' }, 'hunt-hints-race');
  assert.equal(keyOf(renderMini(state.squares[0])), OLD_KEY, 'Race');
});

test('hints: hard: the key names the wider bands; a dig two steps away is Hot, five Warm, eight Cool, in its colour, on the miniature too', () => {
  const m = deal({ hints: 'hard' });
  assert.deepEqual(m.tune, { hints: 'hard' });
  m.treasure = 0;                                                // (in a corner: every distance to 10 on the grid)
  let html = renderMini(state.squares[0]);
  assert.deepEqual(pills(html).map(p => p.slice(0, 2)), [['Hot', '1–2 steps'], ['Warm', '3–5'], ['Cool', '6–8'], ['Cold', '9+']]);
  assert.match(keyOf(html), /aria-label="Key: Hot 1–2 steps, Warm 3–5 steps, Cool 6–8 steps, Cold 9\+ steps"/);
  const t = m.treasure, want = [[2, 'Hot'], [5, 'Warm'], [8, 'Cool'], [9, 'Cold']];
  for (const [d] of want) E.applyMove(m, 'X', stepsAway(t, d), E.makeRng('d'));
  html = renderMini(state.squares[0]);
  for (const [d, name] of want) {
    const c = cellAt(html, stepsAway(t, d));
    assert.match(c[0], new RegExp(`--dbg:${COLOUR[name]}`), `${d} steps: ${name}'s colour`); assert.match(c[1], new RegExp(`<span>${name}</span>`), `${d} steps: ${name}`);
  }
  const mini = V.miniature(m, false);
  for (const [, name] of want) assert.match(mini, new RegExp(`background:${COLOUR[name]}`), `the miniature: ${name}`);
  state.flash = { band: E.huntClue(m, stepsAway(t, 2)) };
  assert.equal(V.moveText(state.flash, 'Xena'), 'Xena dug · Hot');
});

test('hints: harder: Hot, Warm and Cold alone (no Cool); three steps away is Hot, seven Cold; the Race boards and thermometers by the same bands', () => {
  const m = deal({ hints: 'harder' });
  m.treasure = 0;
  let html = renderMini(state.squares[0]);
  assert.deepEqual(pills(html).map(p => p.slice(0, 2)), [['Hot', '1–3 steps'], ['Warm', '4–6'], ['Cold', '7+']]);
  assert.doesNotMatch(keyOf(html), /Cool/);
  const t = m.treasure, at3 = stepsAway(t, 3), at6 = stepsAway(t, 6), far = stepsAway(t, 7);
  E.applyMove(m, 'X', at3, E.makeRng('d')); E.applyMove(m, 'O', at6, E.makeRng('d')); E.applyMove(m, 'X', far, E.makeRng('d'));
  html = renderMini(state.squares[0]);
  assert.match(cellAt(html, at3)[1], /<span>Hot<\/span>/, 'three steps: Hot');
  assert.match(cellAt(html, at6)[1], /<span>Warm<\/span>/, 'six steps: Warm');
  assert.match(cellAt(html, far)[1], /<span>Cold<\/span>/, 'seven: Cold');
  // Race: our grid's key and digs, their small grid, the thermometers: the same wide bands
  const r = deal({ hints: 'harder', mode: 'race' }, 'hunt-hints-race-2');
  assert.equal(r.race, true);
  const near = stepsAway(r.tg.X, 3), theirs = stepsAway(r.tg.O, 2);
  E.applyMove(r, 'X', near, E.makeRng('x')); E.applyMove(r, 'O', theirs, E.makeRng('o'));
  assert.equal(r.side.X.dug[0].k, 1); assert.equal(r.side.O.dug[0].k, 1);
  html = renderMini(state.squares[0]);
  assert.deepEqual(pills(html).map(p => p[0]), ['Hot', 'Warm', 'Cold']);
  assert.match(cellAt(html, near)[1], /<span>Hot<\/span>/, 'our dig three steps away: Hot');
  assert.match(html.slice(html.indexOf('class="ropp')), new RegExp(`background:${COLOUR.Hot}`), 'their dig two steps away: Hot on their board');
  const fill = (s, p) => Number(s.match(new RegExp(`class="thth ${p}"[\\s\\S]*?class="thfill" x="9.5" y="([\\d.]+)"`))[1]);
  const thumb = V.miniature(r, false);
  assert.equal(fill(thumb, 'X'), fill(thumb, 'O'), 'both thermometers at Hot');
});

test('hints: the "?" explainer: the old words at the default; at hard and harder a sentence of how far each band reaches, harder without cool', () => {
  deal(null);
  assert.equal(explainOf('hunt').play, 'Dig a square. It tells you if the treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally.');
  deal({ hints: 'hard' });
  assert.equal(explainOf('hunt').play, 'Dig a square. It tells you if the treasure is hot, warm, cool or cold. Steps count up, down, left and right only, not diagonally. Hot is 1 or 2 steps away, warm 3 to 5, cool 6 to 8, cold 9 or more.');
  deal({ hints: 'harder', mode: 'race' }, 'hunt-hints-race-3');
  assert.equal(explainOf('hunt').play, 'Each of you has your own treasure on your own map. Dig a square: it tells you if your treasure is hot, warm or cold. Steps count up, down, left and right only, not diagonally. Hot is 1 to 3 steps away, warm 4 to 6, cold 7 or more. You can watch the other player\'s digs.');
  // no square open (How to Play, a setup): the setting as it would deal now
  state.screen = 'menu'; state.zoom = null;
  E.setTune('hunt', { hints: 'harder' });
  try { assert.match(explainOf('hunt').play, /hot, warm or cold\. .* Hot is 1 to 3 steps away, warm 4 to 6, cold 7 or more\.$/); } finally { E.setTune('hunt', null); }
  assert.doesNotMatch(explainOf('hunt').play, /\{|Hot is/, 'back at the default: no sentence, nothing unfilled');
});
