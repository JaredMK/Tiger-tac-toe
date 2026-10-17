// Copies what the Cloud Functions share with the page into functions/ (the deploy uploads only that
// folder): the engine (src/core), every mini-game's rules, AI and meta (src/games, without the views) and
// the Trivia questions. firebase.json runs it before every deploy, the emulator tests before they start.
//   node scripts/sync-functions.js
'use strict';
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..'), SRC = path.join(ROOT, 'src'), OUT = path.join(ROOT, 'functions', 'src');
fs.rmSync(OUT, { recursive: true, force: true });
const keep = rel => rel.startsWith('core/') || (rel.startsWith('games/') && !rel.endsWith('/view.js')) || rel === 'package.json';
(function copy(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f), rel = path.relative(SRC, p).split(path.sep).join('/');
    if (fs.statSync(p).isDirectory()) { copy(p); continue; }
    if (!keep(rel)) continue;
    fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
    fs.copyFileSync(p, path.join(OUT, rel));
  }
})(SRC);
fs.copyFileSync(path.join(ROOT, 'trivia.json'), path.join(ROOT, 'functions', 'trivia.json'));
