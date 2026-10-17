'use strict';
// Checks on the page's modules that a browser test would only catch by luck.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src');
const files = []; (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js')) files.push(p); } })(SRC);
const BROWSER = /\b(document|window|localStorage|sessionStorage|navigator|location|history|matchMedia|requestAnimationFrame|cancelAnimationFrame|Element|HTMLElement|CSS|AudioContext|OfflineAudioContext|Image|getComputedStyle|innerWidth|innerHeight) is not defined\b/;

test('page: index.html loads the styles and src/main.js as a module, and nothing else', () => {
  const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = [...page.matchAll(/<script\b[^>]*>/g)].map(m => m[0]);
  assert.deepEqual(scripts, ['<script type="module" src="src/main.js">']);
  for (const href of [...page.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(m => m[1])) assert.ok(fs.existsSync(path.join(ROOT, href)), href);
});
test('page: every module parses and every name it imports exists (a missing export or a clash stops the whole page loading)', async () => {
  // Node links a module (every import against its source's exports) before running any of it; a page
  // module then stops at the first browser-only name, which is the page's business, not an error here.
  for (const f of [path.join(SRC, 'main.js'), ...files.filter(f => f.endsWith('view.js') || /[\\/](ui|net|audio)[\\/]/.test(f))]) {
    try { await import(pathToFileURL(f).href); }
    catch (e) { assert.ok(e instanceof ReferenceError && BROWSER.test(e.message), `${path.relative(ROOT, f)}: ${e.name}: ${e.message}`); }
  }
});
test('page: N (a player\'s name on screen) is declared once, in ui/app.js: no page module declares another N', () => {
  // A table function that names its own N (a count, say) breaks every N(p) under it: "N is not a function"
  // as soon as that screen shows a name (Takeover's "Waiting for ..." did, while the computer played).
  const decl = [];
  for (const f of files.filter(f => f.endsWith('view.js') || f.endsWith('main.js') || /[\\/](ui|net|audio)[\\/]/.test(f))) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/(?:\b(?:const|let|var)\s+|,\s*)N\s*=(?![=>])/g)) decl.push(`${path.relative(SRC, f)}:${src.slice(0, m.index).split('\n').length}`);
  }
  assert.equal(decl.length, 1, `N is declared at ${decl.join(', ')}`);
  assert.match(fs.readFileSync(path.join(SRC, 'ui', 'app.js'), 'utf8'), /^export const N = p => /m, 'the one declaration is the name helper');
});
