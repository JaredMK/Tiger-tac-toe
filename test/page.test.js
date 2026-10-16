'use strict';
// Run with:  node --test
// Checks on the page's own script (index.html) that a browser test would only catch by luck.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const vm = require('node:vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('page: its own script parses (a clash such as a name declared twice stops the whole page loading)', () => {
  const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(scripts.length >= 1);
  for (const code of scripts) assert.doesNotThrow(() => new vm.Script(code, { filename: 'index.html' }));
});
test('page: N (a player\'s name on screen) is declared once, at the top: no local N hides it', () => {
  // A table function that names its own N (a count, say) breaks every N(p) under it: "N is not a function"
  // as soon as that screen shows a name (Takeover's "Waiting for ..." did, while the computer played).
  const decl = [...page.matchAll(/(?:\b(?:const|let|var)\s+|,\s*)N\s*=(?![=>])/g)].map(m => page.slice(0, m.index).split('\n').length);
  assert.equal(decl.length, 1, `N is declared on lines ${decl.join(', ')}`);
  assert.match(page, /^const N = p => /m, 'the one declaration is the name helper');
});
