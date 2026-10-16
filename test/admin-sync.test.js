'use strict';
// Run with:  node --test
// The admin page keeps its own copies of a few of the engine's lists (it does not load engine.js): they
// must say the same, or its switches and tuning cards show the wrong thing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const literal = name => { const m = admin.match(new RegExp(`^const ${name} = (.*?);(?:\\s*//.*)?$`, 'm')); assert.ok(m, `admin.html has ${name}`); return new Function(`return (${m[1]});`)(); };

test('admin page: the admin-only games are the engine\'s TEST_TYPES', () => {
  assert.deepEqual(literal('TEST_TYPES').slice().sort(), E.TEST_TYPES.slice().sort());
});
test('admin page: every game in the pool has a name', () => {
  const games = literal('GAMES');
  for (const t of E.TYPES) assert.equal(typeof games[t], 'string', `${t} has no name on the admin page`);
});
test('admin page: the runners and their default tuning are the engine\'s', () => {
  assert.deepEqual(literal('RUN_TYPES'), E.RUN_TYPES);
  assert.deepEqual(literal('RUN_DEFAULTS'), E.RUN_DEFAULTS);
  const mix = literal('RUN_MIX');
  for (const t of E.RUN_TYPES) assert.deepEqual(mix[t].map(([k]) => k).sort(), Object.keys(E.RUN_DEFAULTS[t].mix).sort(), `${t}: a field for each kind`);
});
test('admin page: Risk Wheels\' and Plinko\'s default tuning are the engine\'s', () => {
  assert.deepEqual(literal('WHEEL_DEFAULTS'), E.WHEEL_DEFAULTS);
  const fields = literal('WHEEL_FIELDS');
  assert.deepEqual(fields.map(([k]) => k).sort(), Object.keys(E.WHEEL_DEFAULTS).sort(), 'a field for each setting');
  for (const [k, , lo, hi] of fields) assert.deepEqual([lo, hi], E.WHEEL_LIMITS[k], `${k}: the engine's range`);
  assert.deepEqual(literal('PLINKO_DEFAULTS'), E.PLINKO_DEFAULTS);
});
