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
    .replace(/^(## Risk Wheels \[wheels\]\n(?:.*\n){1}Play: .*\nWin: ).*$/m, '$1Hit {target} first.')
    .replace(/^Badge: .*$/m, 'Badge: TEST');
  const r = await run(md);
  assert.deepEqual(r.changes.map(c => c.id + '/' + c.label), ['rules/Rule 1', 'wheels/Win', 'staging/Badge']);
  assert.deepEqual(r.warnings, []);
  assert.match(r.files['src/ui/explainer.js'], /'It\\'s "new"\. Wrapped\.'/);
  assert.match(r.files['src/games/wheels/meta.js'], /get win\(\) \{ return `Hit \$\{wheelsConfig\(\)\.target\} first\.`; \}/);
  assert.match(r.files['src/env.js'], /b\.textContent = 'TEST'/);
  assert.deepEqual(Object.keys(r.files).sort(), ['src/env.js', 'src/games/wheels/meta.js', 'src/ui/explainer.js']);
});

test('the format has no target label, and the pop-up\'s labels are text, never the code around them', async () => {
  const md = await exportHelp();
  assert.doesNotMatch(md, /^Target|Shared board|Your own progress|Shared course/m);
  assert.match(md, /^## Mini-game pop-up \[popup\]\nPlay label: Play\nWin label: Win\n/m);
  const r = await run(md.replace(/^Play label: Play$/m, 'Play label: How'));
  assert.deepEqual(r.changes.map(c => c.id + '/' + c.label), ['popup/Play label']);
  assert.match(r.files['src/ui/explainer.js'], /<b>How<\/b><span>\$\{x\.play\}/);
  assert.match(r.files['src/ui/explainer.js'], /<b>\$\{k\}<\/b><span>\$\{v\}<\/span>/, 'the lines\' code untouched');
});

test('Risky Rolls\' {target} (its config, named in EXPLAIN_KEYS) is a placeholder the importer knows', async () => {
  const md0 = await exportHelp();
  assert.match(md0, /^## Risky Rolls \[pig\]\n(?:.*\n){2}Win: Bank \{target\} first\.$/m, 'the target as its setting, not a number');
  const r = await run(md0.replace('Win: Bank {target} first.', 'Win: Bank {target} points first.'));
  assert.deepEqual(r.warnings, []);
  assert.match(r.files['src/games/pig/meta.js'], /win: 'Bank \{target\} points first\.'/);
});

test('a category line moves a game to another label', async () => {
  const md = (await exportHelp()).replace(/^(## Five Letters \[wordle\]\n)Category: .*$/m, '$1Category: More luck');
  const r = await run(md);
  assert.equal(r.changes.length, 1);
  assert.match(r.files['src/games/wordle/meta.js'], /export const category = 'luck'/);
});

test('unknown and missing IDs, unknown labels and placeholders are warned about', async () => {
  const md = (await exportHelp())
    .replace('## Five Letters [wordle]', '## Five Letters [wordel]')
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
