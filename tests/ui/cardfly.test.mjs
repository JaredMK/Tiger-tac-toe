// Card motion (ui/cardfly.js): a flight's plan and keyframes (pure), reduced motion flying nothing, and every card game's
// moves marking their cards with sources the screen names.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
{
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle'])
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
if (!process.env.CF_REDUCED) globalThis.window = new Proxy(stub(), { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false }) : stub()) });   // (motion on: the views draw their flights)
}
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const CF = await import('../../src/ui/cardfly.js');
const { pcard } = await import('../../src/ui/cards.js');
const { state, REDUCED } = await import('../../src/ui/app.js');

const R = (left, top, width, height) => ({ left, top, width, height });
test('a flight\'s plan: the source\'s middle against the destination\'s, in its own units, the size by area', () => {
  assert.deepEqual(CF.cfPlan(R(0, 0, 50, 70), R(100, 200, 50, 70)), { dx: -100, dy: -200, s: 1 });
  const half = CF.cfPlan(R(0, 0, 25, 35), R(100, 200, 50, 70));
  assert.equal(half.s, 0.5);
  const zoomed = CF.cfPlan(R(0, 0, 50, 70), R(100, 200, 50, 70), 0.5);   // mid-zoom, the screen at half its size: twice the distance in the card's own units
  assert.deepEqual([zoomed.dx, zoomed.dy], [-200, -400]);
  assert.equal(CF.cfPlan(R(0, 0, 500, 700), R(0, 0, 10, 14)).s, CF.CF.maxScale, 'clamped');
  assert.equal(CF.cfPlan(null, R(0, 0, 1, 1)), null);
  assert.equal(CF.cfPlan(R(0, 0, 1, 1), R(0, 0, 0, 0)), null);
});
test('a flight\'s keyframes: hidden at its source until it leaves (or waiting there), into place, and gone on landing with go', () => {
  const p = { dx: 10, dy: -20, s: 1 };
  const a = CF.cfFrames(p, 300, 280);
  assert.equal(a.timing.duration, 580);
  assert.equal(a.frames[0].opacity, 0, 'hidden at the deck before its moment');
  assert.equal(a.frames[2].offset, 300 / 580);
  assert.equal(a.frames[2].easing, CF.CF.ease);
  assert.equal(a.frames.at(-1).transform, 'none');
  assert.equal(a.timing.fill, 'none', 'nothing left on the card once it has landed');
  const w = CF.cfFrames(p, 300, 280, { wait: true });
  assert.equal(w.frames[0].opacity, 1, 'a hand card waits in the hand');
  assert.equal(w.frames.length, 3);
  const g = CF.cfFrames(p, 0, 200, { go: true });
  assert.equal(g.frames[0].offset, 0); assert.equal(g.frames.at(-1).opacity, 0); assert.equal(g.timing.fill, 'forwards');
  assert.equal(g.timing.duration, 200 + CF.CF.fade);
  for (const f of [a, w, g]) for (const k of f.frames) assert.deepEqual(Object.keys(k).filter(x => !['offset', 'transform', 'opacity', 'easing'].includes(x)), [], 'transform and opacity only');
});
test('the markup: base milliseconds (the move\'s rate and Speed come from its host, ui/fx.js anchorFx), through pcard', () => {
  assert.equal(CF.cfFrom('deck', 90.4), ' data-cf="deck" data-cfat="90"');
  assert.equal(CF.cfFrom('pile', 0, { wait: true, go: true, d: 220 }), ' data-cf="pile" data-cfat="0" data-cfwait="" data-cfgo="" data-cfd="220"');
  assert.equal(CF.cfFrom(null, 10), '');
  assert.match(pcard('QS', { slide: 120, from: 'deck' }), /data-cf="deck" data-cfat="120"/);
  assert.doesNotMatch(pcard('QS', { slide: 120 }), /data-cf/, 'a game that names no source keeps its own slide');
  assert.match(pcard(null, { down: true, from: 'deck' }), /aria-label="Face-down card" data-cf|data-cf="deck"[^>]*role="img" aria-label="Face-down card"/);
});
const fakeRoot = (calls, src = true) => {
  const card = { dataset: { cf: 'deck', cfat: '120' }, animate: (fr, tm) => { calls.push([fr, tm]); }, closest: () => null, contains: () => false, getBoundingClientRect: () => R(100, 300, 50, 70), offsetWidth: 50, style: {} };
  const deck = { dataset: { anchor: 'deck' }, closest: () => null, contains: () => false, getBoundingClientRect: () => R(10, 20, 50, 70) };
  return { querySelectorAll: sel => (sel === '[data-cf]' ? [card] : src ? [deck] : []), card };
};
test('on the page: the card flies from its source, its own CSS slide giving way; with no source, it keeps its own', () => {
  if (process.env.CF_REDUCED) return;
  const calls = [], root = fakeRoot(calls);
  CF.cardFly(root);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0][0].transform, 'translate(-90.0px, -280.0px) scale(1.000)');
  assert.equal(root.card.style.animation, 'none');
  const none = [], r2 = fakeRoot(none, false);
  state.zoom = 7; CF.cardFly(r2); state.zoom = 0;                 // (another screen: nothing remembered)
  assert.equal(none.length, 0); assert.notEqual(r2.card.style.animation, 'none');
});
test('reduced motion: nothing flies (the card is simply there)', () => {
  if (process.env.CF_REDUCED) {
    assert.equal(REDUCED, true);
    const calls = []; CF.cardFly(fakeRoot(calls));
    assert.equal(calls.length, 0);
    return;
  }
  const env = Object.assign({}, process.env, { CF_REDUCED: '1' }); delete env.NODE_TEST_CONTEXT;   // (a run of its own, the page asking for reduced motion)
  const out = execFileSync(process.execPath, ['--test', '--test-reporter=tap', fileURLToPath(import.meta.url)], { env, encoding: 'utf8' });
  assert.match(out, /# fail 0/);
});

// Every card game: play a square out at random and, at every move, the cards marked to fly name a source the screen
// draws (or a card's own last place: card:, tile:, pk:, kept from the redraw before).
const GAMES = ['bj', 'bus', 'war', 'poker', 't31', 'rummy', 'dominoes'];
const MEMORY = /^(card|tile|pk):/;
for (const type of GAMES) {
  if (process.env.CF_REDUCED) break;
  test(`${type}: every card a move moves names where it comes from`, async () => {
    const V = await import(`../../src/games/${type}/view.js`);
    const rng = E.makeRng('cf-' + type), st = E.newMatch(rng, { names: { X: 'Xena', O: 'Olaf' } });
    Object.assign(state, st, { screen: 'mini', zoom: 0, flash: null, spot: null, winner: null, online: null, cpu: null });
    state.squares[0] = { owner: null, mini: E.newMini(type, rng) };
    const seen = new Set();
    for (let k = 0; k < 60 && !state.squares[0].owner; k++) {
      const sq = state.squares[0], mini = sq.mini;
      if (mini.type !== type) break;                                 // (a draw dealt a new game)
      let mv; try { mv = E.randomLegalMove(mini, state.turn, rng); } catch (e) { break; }
      if (mv == null) break;
      const r = E.playMove(state, 0, mv, rng);
      if (!r.ok) break;
      const f = state.flash;
      if (f) {
        const html = V.screen(state.squares[0], f, null, state.squares[0].mini, false, true, f, null, () => false, () => -1, false, state.turn, '');
        const names = new Set([...html.matchAll(/data-anchor="([^"]+)"/g)].map(m => m[1]));
        for (const [, from] of html.matchAll(/data-cf="([^"]+)"/g)) {
          assert.ok(names.has(from) || MEMORY.test(from), `${type}: "${from}" is a place on the screen`);
          seen.add(from.replace(/:.*/, ':'));
        }
      }
      state.flash = null; state.spot = null; state.lock = null;
      if (state.squares[0].owner) break;
    }
    if (type !== 'bus') assert.ok(seen.size > 0, `${type}: some card flew (${[...seen].join(', ')})`);   // (Ride the Bus: its own deck slide and flight to the slot, bus/view.js busFly)
  });
}
