// Number Shuffle's guess list (src/games/numbers/view.js): the guesses sorted by value, highest at the top, each with
// its Higher / Lower chip; the "Mystery number is here" marker in the gap between the lowest "lower" and the highest
// "higher" (at an end while a side has none; the hit in its place once found); a column each in a race, one list in
// Shared with each guesser's mark; a move's new row dropping into its sorted place with the rows it passes and the
// marker sliding from their old places, at the answer and inside flashMs. Rendered in Node, the browser stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/numbers/rules.js');
const { state } = await import('../../src/ui/app.js');
const V = await import('../../src/games/numbers/view.js');

function sq(mode, X, O) {
  E.setTune('numbers', { mode, n: 5 });
  const m = E.newMini('numbers', E.makeRng('nl-' + mode)); E.setTune('numbers', null);
  m.d = [1, 2, 3, 4, 5]; m.tg = { X, O: O || X };
  Object.assign(state, { squares: [{ mini: m }], zoom: 0, turn: 'X', flash: null, done: null, online: null });
  return m;
}
const guess = (m, p, s) => { const r = E.applyMove(m, p, { o: s.split('').map(Number) }, E.makeRng('g')); assert.ok(r.ok); return E.publicMini(m, p); };
const draw = (m, a, view) => V.screen({ mini: m }, null, null, m, !!view, !!a, a || null, null, false, null, false, state.turn, null);
// the list's items in order (top to bottom by --i): a guess's digits and its answer, or 'M' for the marker
const order = (html, from) => {
  const part = from ? html.slice(html.indexOf(from)) : html, box = part.slice(part.indexOf('class="nsbox"'), part.indexOf('</ol>'));
  const out = []; for (const m of box.matchAll(/<li class="nsit ([^"]*)" style="--i:(\d+)[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
    if (/\bout\b/.test(m[1])) continue;
    out[Number(m[2])] = /nsmark/.test(m[1]) ? 'M' : `${m[3].match(/class="nsgn">(\d+)/)[1]}${m[1].match(/\b(hi|lo|eq)\b/)[1] === 'hi' ? '^' : m[1].includes(' eq') ? '=' : 'v'}`;
  }
  return out.join(' ');
};

test('Shared: the guesses by value, highest at the top, the marker in the gap between the lowest Lower and the highest Higher', () => {
  const m = sq('shared', [3, 4, 1, 5, 2]);   // 34152
  assert.equal(order(draw(m)), 'M', 'no guess yet: the marker alone');
  guess(m, 'X', '12345'); assert.equal(order(draw(m)), 'M 12345^', 'only a Higher: the marker at the top');
  guess(m, 'O', '54321'); guess(m, 'X', '21345'); guess(m, 'O', '43215'); guess(m, 'X', '31254');
  const html = draw(m);
  assert.equal(order(html), '54321v 43215v M 31254^ 21345^ 12345^');
  assert.match(html, /aria-label="54321: Lower"/); assert.match(html, /<span class="nsch hi" aria-hidden="true"><i>▲<\/i>Higher<\/span>/);
  assert.match(html, /<li class="nsit nsg lo byO"[^>]*><i class="ntok O nsgt"/, 'Shared: each row carries its guesser\'s mark');
  assert.equal((html.match(/class="nsbox"/g) || []).length, 1, 'Shared: one list');
  assert.match(html, /class="nstrack" style="--rn:6;--f:2"/, 'the window centred on the marker\'s place');
  const only = sq('shared', [3, 4, 1, 5, 2]); guess(only, 'X', '54321'); assert.equal(order(draw(only)), '54321v M', 'only a Lower: the marker at the foot');
});

test('Race: a column each, each its own hidden number\'s list and marker; no mark on the rows (the column has it)', () => {
  const m = sq('race', [3, 4, 1, 5, 2], [1, 3, 2, 5, 4]);   // X 34152, O 13254
  guess(m, 'X', '21345'); guess(m, 'O', '21345'); guess(m, 'X', '43215'); guess(m, 'O', '12345');
  const html = draw(m), x = html.slice(html.indexOf('class="nscol X"'), html.indexOf('class="nscol O"')), o = html.slice(html.indexOf('class="nscol O"'));
  assert.equal(order(x), '43215v M 21345^'); assert.equal(order(o), '21345v M 12345^');
  assert.doesNotMatch(html, /nsgt/);
});

test('a move: the new row drops into its sorted place at the answer, the rows it passes and the marker slide from their old places, inside flashMs', () => {
  const m = sq('shared', [3, 4, 1, 5, 2]);
  guess(m, 'X', '54321'); guess(m, 'O', '12345'); guess(m, 'X', '43215');
  const f = {}; R.moveFlash(m, 'X', null, null, m, f);   // the last guess, 43215 Lower, on show
  const html = draw(m, f), say = R.nsShowMs(f.ns);
  assert.equal(order(html), '54321v 43215v M 12345^');
  assert.match(html, new RegExp(`class="nstrack mv" style="--rn:4;--f:2;--rn0:3;--f0:1;--t:${say}ms"`));
  assert.match(html, /<li class="nsit nsg lo byX nw" style="--i:1"/, 'the new row drops in at its place');
  assert.match(html, /<li class="nsit nsmark mv" style="--i:2;--i0:1"/, 'the marker slides down from where it was');
  assert.match(html, /<li class="nsit nsg hi byO mv" style="--i:3;--i0:2"/);
  assert.match(html, /<li class="nsit nsg lo byX" style="--i:0"/, 'a row above stays put');
  assert.ok(say + R.NS.sort <= R.flashMs(f), 'the slide plays inside the move\'s flashMs');
});

test('a won square: the hit in the gap, the marker gone (fading where it was as the hit lands); the review the same', () => {
  const m = sq('shared', [3, 4, 1, 5, 2]);
  guess(m, 'X', '54321'); guess(m, 'O', '12345'); guess(m, 'X', '34152');
  const f = {}; R.moveFlash(m, 'X', null, null, m, f);
  const html = draw(m, f);
  assert.equal(order(html), '54321v 34152= 12345^');
  assert.match(html, /<li class="nsit nsmark out" style="--i:1"/, 'the marker fades where it was');
  const rev = draw(m, null, true);
  assert.equal(order(rev), '54321v 34152= 12345^'); assert.doesNotMatch(rev, /nsmark/);
});

test('a long list keeps the marker in view (the window from the item count and the marker\'s place); no hidden number drawn', () => {
  const m = sq('race', [3, 4, 1, 5, 2], [1, 3, 2, 5, 4]);
  for (const g of ['12345', '54321', '21345', '45321', '31245', '35421', '34125', '34521', '34215']) guess(m, 'X', g);
  const pub = E.publicMini(m, 'X'); const html = draw(pub);
  assert.match(html.slice(html.indexOf('class="nscol X"')), /class="nstrack" style="--rn:10;--f:5"/);
  assert.doesNotMatch(html, /34152|13254/, 'the hidden numbers never drawn');
});
