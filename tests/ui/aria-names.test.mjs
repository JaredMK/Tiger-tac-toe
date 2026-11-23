// A player's name inside an attribute (an aria-label) is plain text (ui/app.js NT), never N: N carries the computer's icon
// as markup, whose quotes end the attribute and spill the icon's shapes onto the page (Trail Race's board showed them in
// its top left corner, November 2026; Sea Battle's cells once did too).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const files = [...readdirSync('src/games').filter(d => !d.includes('.')).map(d => `src/games/${d}/view.js`), ...readdirSync('src/ui').filter(f => f.endsWith('.js')).map(f => `src/ui/${f}`), ...readdirSync('src/ui/screens').filter(f => f.endsWith('.js')).map(f => `src/ui/screens/${f}`)];
test('no view puts N(…) (the name with its icon markup) inside an HTML attribute', () => {
  const bad = [];
  for (const f of files) {
    let src; try { src = readFileSync(f, 'utf8'); } catch (e) { continue; }
    src.split('\n').forEach((ln, i) => { if (/\b(aria-label|title|alt|data-[a-z-]+)="[^"<>]*\$\{N\(/.test(ln)) bad.push(`${f}:${i + 1}`); });
  }
  assert.deepEqual(bad, []);
});
