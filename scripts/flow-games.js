#!/usr/bin/env node
// Which mini-games the long flow test (tests/flows/win-returns.test.mjs) must play for a change: the changed files on
// stdin, one a line (the Deploy workflow: git diff --name-only since the environment's last successful deploy), and it
// prints ALL, NONE or the games' ids joined by commas, for FLOW_GAMES. A file in one game's own folder
// (src/games/<id>/) is that game's; anything the page shares (the engine, the interface, the shared game families, the
// registry, the stylesheets, the page itself, the flow test and its harness, the dependencies) is every game's; anything
// else (docs, server code, rules, scripts, unit tests, simulations) none. npm run release always plays every game.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAMES = new Set(fs.readdirSync(path.join(ROOT, 'src/games'), { withFileTypes: true }).filter(d => d.isDirectory() && d.name !== 'shared').map(d => d.name));
// Every game's: what the page loads around any game, and what the flow test runs on.
const SHARED = /^(src\/(?!games\/[^/]+\/)|src\/games\/(shared\/|index\.js)|index\.html$|tests\/flows\/win-returns\.test\.mjs$|tests\/(engine|physics)\.js$|package(-lock)?\.json$|trivia\.json$|\.github\/workflows\/deploy\.yml$|scripts\/flow-games\.js$)/;

function flowGames(files) {
  const picked = new Set();
  for (const f of files.map(s => s.trim()).filter(Boolean)) {
    if (f === 'ALL' || SHARED.test(f)) return 'ALL';
    const m = /^src\/games\/([^/]+)\//.exec(f);
    if (m && GAMES.has(m[1])) picked.add(m[1]);
    else if (m) return 'ALL';                                           // (a folder that is no game's: to be safe, every game)
  }
  return picked.size ? [...picked].sort().join(',') : 'NONE';
}
module.exports = { flowGames };
if (require.main === module) console.log(flowGames(fs.readFileSync(0, 'utf8').split('\n')));
