// The on-screen keyboard (Five Letters, Hangman): its row is a centred flex row of ten equal keys. Another game's stylesheet once
// reused the class `.krow` (Krabs' strip, November 2026) and turned every keyboard row into a column squashed to the left:
// nothing else may style `.krow`, and its own rule keeps it a full-width flex row.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => ({ sel: m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim(), body: m[2] }));

test('keyboard: `.krow` is styled once, as a full-width centred flex row, and no other class of the same stem displaces it', () => {
  const k = rules.filter(r => r.sel.split(',').some(s => s.trim() === '.krow' || /(^|\s)\.krow([\s.:[]|$)/.test(s.trim())));
  assert.equal(k.length, 1, 'one rule styles .krow');
  assert.match(k[0].body, /display:\s*flex/); assert.match(k[0].body, /justify-content:\s*center/); assert.match(k[0].body, /width:\s*100%/);
  const key = rules.find(r => r.sel === '.key');
  assert.ok(key && /width:\s*calc\(\(100% - 9 \* 4px\) \/ 10\)/.test(key.body), 'ten equal keys fill the row');
});
test('keyboard: three rows of keys in the markup (the source), and no other view uses the class krow', () => {
  const kb = readFileSync(new URL('../../src/ui/keyboard.js', import.meta.url), 'utf8');
  assert.ok(/rows = \['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'\]/.test(kb) && kb.includes('class="krow"'));
  for (const g of ['craps', 'wordle', 'hangman']) assert.ok(!readFileSync(new URL(`../../src/games/${g}/view.js`, import.meta.url), 'utf8').includes('class="krow"'), g + ' does not use the keyboard row class');
});
