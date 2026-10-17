'use strict';
// The engine's files: what the server runs (src/core, and src/games without the views).
const fs = require('node:fs'), path = require('node:path');
const SRC = path.join(__dirname, '..', 'src'), out = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js') && f !== 'view.js') out.push(p); } })(path.join(SRC, 'core'));
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.js') && f !== 'view.js') out.push(p); } })(path.join(SRC, 'games'));
module.exports = out;
