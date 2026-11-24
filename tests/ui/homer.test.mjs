// Home Run Heroes' words (games/homer/view.js homerWord): a home run says so; any other swing says how to do better, by
// how far it was from the perfect moment: within the hit window "A bit early" / "A bit late", beyond it "Way early" /
// "Way late"; a pitch let go "No swing". Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { homerWord } = await import('../../src/games/homer/view.js');
const { homerCfg, homerJudge } = await import('../../src/games/homer/rules.js');

test('homer: a swing that is not a home run says a bit or way, early or late; "Good timing" is gone', () => {
  const mini = E.newMini('homer', E.makeRng('hw')), c = homerCfg(mini);
  assert.equal(c.hr, 30); assert.equal(c.hit, 90);
  const cases = [[0, 'Home run!'], [-30, 'Home run!'], [30, 'Home run!'], [-31, 'A bit early'], [45, 'A bit late'], [-90, 'A bit early'], [90, 'A bit late'],
    [-91, 'Way early'], [91, 'Way late'], [-400, 'Way early'], [2500, 'Way late'], [null, 'No swing']];
  for (const [dt, word] of cases) assert.equal(homerWord(homerJudge(c, dt), dt, c.hit), word, `dt ${dt}`);
  for (let dt = -300; dt <= 300; dt++) assert.notEqual(homerWord(homerJudge(c, dt), dt, c.hit), 'Good timing');
  // the rules are unchanged: a hit is still a hit (counting for nothing), a miss a miss
  assert.equal(homerJudge(c, 60), 'hit'); assert.equal(homerJudge(c, -120), 'miss'); assert.equal(homerJudge(c, null), 'take');
  // a square's own hit window decides where "a bit" ends
  assert.equal(homerWord('hit', 140, 150), 'A bit late'); assert.equal(homerWord('miss', 160, 150), 'Way late');
});
