// Every die tumbles DIE_MORE longer than it first did (December 2026: core/config.js DIE_MORE, 350 ms, a base figure, so Speed
// shortens it as every timing): the tumble, its landing and what follows, in every game with dice, and the stylesheet's own
// figures for the flat dice. Pure: the rules' tables and the stylesheet's text, no page.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// (the page's names stubbed: the views' modules load without a page)
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}


const { DIE_MORE } = await import('../../src/core/config.js');
const { PLAY } = await import('../../src/core/timer.js');
const { DIE_FLAT_MS } = await import('../../src/ui/dice.js');
const { CRAPS, CRAPS_QUICK_MORE, crapsTimes } = await import('../../src/games/craps/rules.js');
const { SHUT, shutTimes } = await import('../../src/games/shut/rules.js');
const { SCC, sccTimes } = await import('../../src/games/scc/rules.js');
const { COMBO, comboTimes } = await import('../../src/games/combo/rules.js');
const { BGLT, bglTimes } = await import('../../src/games/bglite/rules.js');
const pig = await import('../../src/games/pig/rules.js');
const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');

test('the figure: about 0.3 to 0.4 s, one place', () => {
  assert.ok(DIE_MORE >= 300 && DIE_MORE <= 400, `${DIE_MORE} ms`);
});

test('every die\'s tumble and landing is DIE_MORE later than the figures it had', () => {
  assert.equal(PLAY.die, 600 + DIE_MORE, 'Snakes and Ladders (and the retired Dice race): the die before the piece sets off');
  assert.equal(SHUT.land, 560 + DIE_MORE, 'Shut the Box');
  assert.equal(SCC.land, 650 + DIE_MORE, 'Ship, Captain & Crew');
  assert.equal(CRAPS.land, 560 + DIE_MORE, 'Krabs: the first rolls');
  assert.equal(CRAPS.roll, 900 + DIE_MORE, 'Krabs: the next throw leaves the same pause after the landing');
  assert.equal(COMBO.roll, 700 + DIE_MORE, 'Dice Combo');
  assert.equal(COMBO.land, 520 + DIE_MORE, 'Dice Combo: its last die down (the shared 3-D die now; its flat die tumbled as long)');
  assert.equal(BGLT.roll, 820 + DIE_MORE, 'Backgammon Lite');
  assert.equal(BGLT.land, 600 + DIE_MORE, 'Backgammon Lite: its last die down (the shared 3-D die now; its flat die tumbled as long)');
  assert.equal(DIE_FLAT_MS, 600 + DIE_MORE);
});

test('Krabs: a quick roll (after the first few) tumbles longer too, by half the figure', () => {
  assert.equal(CRAPS_QUICK_MORE, Math.round(DIE_MORE / 2));
  assert.equal(CRAPS.quick, 560 + CRAPS_QUICK_MORE);
  const t = crapsTimes([[1, 2], [3, 3], [1, 3], [2, 2], [4, 1], [5, 5], [2, 6]], 3, null);
  assert.equal(t.at[5] - t.at[4], CRAPS.quick); assert.equal(t.at[2] - t.at[1], CRAPS.roll);   // (the first roll's gap also holds the puck going on)
});

test('each game\'s move holds to its dice\'s landing and on: flashMs grew with the tumble', () => {
  assert.equal(pig.flashMs({ note: 'roll' }), 1050 + DIE_MORE);
  assert.equal(pig.flashMs({ note: 'bust' }), 1350 + DIE_MORE);
  assert.equal(pig.flashMs({ note: 'bank' }), 1000, 'a bank rolls nothing');
  assert.equal(shutTimes({ kind: 'roll', none: false }).land, SHUT.land);
  assert.equal(shutTimes({ kind: 'roll', none: false }).end, 900 + DIE_MORE);
  assert.equal(sccTimes({ kind: 'roll', took: [] }).land, SCC.land);
  assert.ok(sccTimes({ kind: 'roll', took: [] }).end >= SCC.land);
  assert.equal(comboTimes({ kind: 'roll', none: false }).end, COMBO.roll + COMBO.hold);
  assert.equal(bglTimes({ kind: 'roll', stuck: false }).land, BGLT.roll);
});

test('the stylesheet\'s own figures for the flat dice and the 3-D die\'s turns follow', () => {
  const sec = ms => `${(ms / 1000).toFixed(ms % 10 ? 3 : 2).replace(/0+$/, '').replace(/\.$/, '').replace(/^0/, '')}s`;
  assert.ok(css.includes(`.die.roll { animation: dieroll var(--dur, ${sec(DIE_FLAT_MS)})`), `a flat die's tumble: ${sec(DIE_FLAT_MS)}`);
  assert.ok(!/cmbtum|\.die\.bgldie/.test(css), 'Dice Combo and Backgammon Lite throw the shared 3-D die: no flat tumble of their own left');
  // the 3-D die turns about as fast as it did: its turns scale with the longer tumble (each a whole number of quarter turns)
  const turns = [...css.matchAll(/--s([xyz]): (-?\d+)deg/g)].map(m => Number(m[2]));
  assert.ok(turns.length >= 12 && turns.every(d => d % 90 === 0), 'whole quarter turns, so it lands on a face');
  assert.ok(Math.max(...turns.filter((_, i) => i % 3 === 0).map(Math.abs)) >= 1080, 'turns more than before (720 at most)');
});
