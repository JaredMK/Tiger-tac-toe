// Sea Battle: a shot's cell carries only the burst (or the splash) and the shooter's colour dot. The cell's label
// names the shooter in plain text: the computer's name with its icon (N) once went into the aria-label, its markup
// broke the attribute, and the rest showed on the cell as large text ("CO…"). Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const bs = await import('../../src/games/bs/view.js');
const { state } = await import('../../src/ui/app.js');

test('Sea Battle: a computer hit shows the burst and the colour dot alone, no name on the cell; the label names it in plain text', () => {
  state.online = null; state.cpu = ['O']; state.setup = Object.assign({}, state.setup, { names: { X: 'Jared', O: 'Computer' } });
  const revealed = new Array(16).fill(null); revealed[5] = 'O'; revealed[6] = 'X'; revealed[0] = 'O';
  const mini = { type: 'bs', len: 3, ship: [5, 6, 7], revealed, hits: [5, 6], last: 5 };
  const html = bs.screen({ owner: null, mini }, null, null, mini, false, false, null, 5, () => false, null, false, 'X', '');
  const cells = html.match(/<button class="cell[\s\S]*?<\/button>/g);
  assert.equal(cells.length, 16);
  for (const c of cells) {
    const label = (c.match(/aria-label="([^"]*)"/) || [])[1] || '';
    assert.doesNotMatch(label, /[<>]/, `plain label: ${label}`);
    const inner = c.replace(/^<button[^>]*>/, '').replace(/<\/button>$/, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<i class="bsby [XO]"><\/i>/g, '');
    assert.equal(inner, '', `nothing on the cell but the burst and the dot: ${inner.slice(0, 120)}`);
  }
  assert.match(html, /aria-label="Row 2 column 2, hit \(Computer\)"/);
  assert.match(html, /aria-label="Row 2 column 3, hit \(Jared\)"/);
  state.cpu = null;
});
