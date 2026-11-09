// Pool's miniature is a table (felt, rails, six pockets) with the balls on it from the moment the board shows it, before
// the physics library has loaded (games/pool/view.js POOL_TABLE); the same once it is in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { PHYSICS, setPhysics } = await import('../../src/games/shared/physics.js');
const V = await import('../../src/games/pool/view.js');

test('Pool: the miniature draws the table and its balls before the physics library loads, and after', () => {
  const lib = PHYSICS.lib;
  const mini = E.newMini('pool', E.makeRng('pool-mini'));
  setPhysics(null);
  try {
    const html = V.miniature(mini, false);
    assert.match(html, /class="rail"/, 'the rails');
    assert.match(html, /class="cloth"/, 'the felt');
    assert.equal((html.match(/class="pocket"/g) || []).length, 6, 'six pockets');
    assert.ok((html.match(/<circle[^>]*class="(X|O|cue|black)"/g) || []).length >= 8, 'the balls on it');
  } finally { setPhysics(lib); }
  if (lib) assert.match(V.miniature(mini, false), /class="cloth"/, 'the same once the library is in');
});

// The table's size comes from the square's own container units, never a percentage of an indefinite height (Safari resolved
// `height: 100%` to nothing and dropped the table while the counts beside it showed: November 2026), and the main menu's
// foot carries the build stamp (src/ui/config.js APP_VERSION, stamped by scripts/build-site.js) so a stale page is seen for what it is.
test('Pool: the miniature table is sized in container units (no percentage height), and the menu shows the build', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  const rule = css.match(/\.tpool \.tphys \{([^}]*)\}/);
  assert.ok(rule, 'the miniature table has its own rule');
  assert.match(rule[1], /height:\s*\d+cqh/, 'the height in the square\'s container units');
  assert.match(rule[1], /width:\s*calc\(\d+cqh/, 'the width from the same, by the table\'s aspect');
  assert.doesNotMatch(rule[1], /height:\s*100%/);
  const menu = fs.readFileSync(new URL('../../src/ui/screens/menu.js', import.meta.url), 'utf8');
  assert.match(menu, /class="build"[^>]*>\$\{esc\(APP_VERSION\)\}/, 'the build stamp in the menu foot');
});
