// The slow simulations (the computer against itself, balance and fairness runs, thousands of dealt
// boards): never part of npm test; run them when a change touches a game's balance.
//   npm run sim                list them
//   npm run sim -- districts   one (a game, a family, or matches)
//   npm run sim -- all         every one
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs'), path = require('node:path');
const DIR = path.join(__dirname, '..', 'tests', 'sim');
const all = fs.readdirSync(DIR).filter(f => f.endsWith('.sim.js')).map(f => f.replace(/\.sim\.js$/, '')).sort();
const want = process.argv.slice(2);
if (!want.length) { console.log('npm run sim -- <name>   (or all)\n' + all.join('  ')); process.exit(0); }
const pick = want.includes('all') ? all : want;
for (const n of pick) if (!all.includes(n)) { console.error(`no simulation "${n}": ${all.join(', ')}`); process.exit(1); }
const r = spawnSync(process.execPath, ['--test', ...pick.map(n => path.join(DIR, n + '.sim.js'))], { stdio: 'inherit' });
process.exit(r.status == null ? 1 : r.status);
