'use strict';
// The launch lineup (December 2026, scripts/set-releases.js rel4): exactly these 18 mini-games released, on the web and
// iOS (their iOS-off switches cleared), and every other one, retired ones too, admin only. Read from the script's text
// (it connects to a database when run). Find Match the admin's alone: findAdmin1.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const E = require('../engine.js');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'set-releases.js'), 'utf8');
const list = name => JSON.parse(SRC.match(new RegExp(`const ${name} = (\\[[^\\]]*\\]);`))[1].replace(/'/g, '"'));
const NAMES = ['Bullseye', 'Bump', 'Candy Race', 'Coin Flip', 'Five Letters', 'Tic-Tac-Toe', 'Four in a Row', 'Sea Battle', 'Hangman', 'Higher/Lower', 'Risky Rolls', 'Little Wheel', 'Peg Drop', 'Snakes and Ladders', 'Rock Paper Scissors', 'War', 'Claw Machine', 'Codebreaker'];

test('the launch lineup: the 18 released by name, every other mini-game admin only, the list of all the registry\'s', () => {
  const LAUNCH = list('LAUNCH'), ALL = list('ALL');
  assert.deepEqual(ALL.slice().sort(), E.TYPES.concat(E.OLD_TYPES).slice().sort(), 'every mini-game, retired ones too');
  assert.deepEqual(LAUNCH.map(t => E.INFO[t].name).sort(), NAMES.slice().sort());
  assert.match(SRC, /\{ id: 'rel4', set: lineup\(\) \}/);
  const rel = Object.fromEntries(ALL.map(t => [t, LAUNCH.includes(t)]));
  assert.deepEqual(E.releasedTypes(rel).sort(), LAUNCH.slice().sort(), 'released: exactly the lineup');
  assert.match(SRC, /\{ id: 'rel5', set: \{ wheels: false \} \}/, 'Risky Spins admin only where rel4 had released it');
  assert.ok(SRC.indexOf("id: 'rel5'") > SRC.indexOf("id: 'rel4'"), 'applied after the lineup');
  assert.match(SRC, /\{ id: 'findAdmin1', path: 'features\/findMatchAdmin', value: true \}/, 'Find Match the admin\'s alone, both environments');
});
