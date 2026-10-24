'use strict';
// Run with:  node --test
// docs/help-text.md <-> the sources (scripts/help-text.js): an untouched export imports as no change, an edit
// changes only its own text (in memory here: nothing is written), and bad input is warned about, not applied.
const test = require('node:test');
const assert = require('node:assert/strict');
const { exportHelp, importHelp } = require('../../scripts/help-text.js');

const run = (md) => importHelp(md, { write: false });

test('an untouched export changes nothing', async () => {
  const r = await run(await exportHelp());
  assert.deepEqual(r.changes, []);
  assert.deepEqual(r.warnings, []);
});

test('an edit changes only its own text, quotes and placeholders kept', async () => {
  const md = (await exportHelp())
    .replace(/^Rule 1: .*$/m, 'Rule 1: It\'s "new".\n  Wrapped.')
    .replace(/^(## Risk Wheels \[wheels\]\n(?:.*\n){2}Play: .*\nWin: ).*$/m, '$1Hit {target} first.')
    .replace(/^Badge: .*$/m, 'Badge: TEST');
  const r = await run(md);
  assert.deepEqual(r.changes.map(c => c.id + '/' + c.label), ['rules/Rule 1', 'wheels/Win', 'staging/Badge']);
  assert.deepEqual(r.warnings, []);
  assert.match(r.files['src/ui/explainer.js'], /'It\\'s "new"\. Wrapped\.'/);
  assert.match(r.files['src/games/wheels/meta.js'], /get win\(\) \{ return `Hit \$\{wheelsConfig\(\)\.target\} first\.`; \}/);
  assert.match(r.files['src/env.js'], /b\.textContent = 'TEST'/);
  assert.deepEqual(Object.keys(r.files).sort(), ['src/env.js', 'src/games/wheels/meta.js', 'src/ui/explainer.js']);
});

test('a category or target line moves a game to another label', async () => {
  const md = (await exportHelp()).replace(/^(## Wordle \[wordle\]\n)Category: .*$/m, '$1Category: More luck');
  const r = await run(md);
  assert.equal(r.changes.length, 1);
  assert.match(r.files['src/games/wordle/meta.js'], /export const category = 'luck'/);
});

test('unknown and missing IDs, unknown labels and placeholders are warned about', async () => {
  const md = (await exportHelp())
    .replace('## Wordle [wordle]', '## Wordle [wordel]')
    .replace(/^Win: First to \{goal\} wins\.$/m, 'Win: First to {gaol} wins.')
    .replace(/^Category: More brain$/m, 'Category: Nonsense');
  const r = await run(md);
  const w = r.warnings.join('\n');
  assert.match(w, /unknown ID \[wordel\]/);
  assert.match(w, /missing ID \[wordle\]/);
  assert.match(w, /\{gaol\}/);
  assert.match(w, /"Category: Nonsense" is not one of the labels/);
  assert.deepEqual(r.changes.map(c => c.id), ['bj']);
});
