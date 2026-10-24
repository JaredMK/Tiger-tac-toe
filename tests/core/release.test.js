'use strict';
// The engine's core: release control: admin-only games, dealt and played to the end (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

test('patterns, wheels and sniff: admin only until released', () => {
  for (const t of ['patterns', 'wheels', 'sniff']) {
    assert.ok(E.TEST_TYPES.includes(t)); assert.equal(E.isReleased(t, {}), false);
    assert.ok(!E.releasedTypes({}).includes(t)); assert.ok(E.allowedTypes({}, true).includes(t));
    assert.equal(E.isReleased(t, { [t]: true }), true);
  }
});

test('Find Match deals only games whose result the server can verify: the hold list (FIND_MATCH_HOLD) is cut from its games, released or not; friend rooms and local play are not cut', () => {
  const all = E.TYPES.slice();
  for (const t of E.FIND_MATCH_HOLD) { assert.ok(all.includes(t), `${t} is a game`); assert.ok(!E.findMatchTypes(all).includes(t), `${t} held back from Find Match`); }
  assert.deepEqual(E.findMatchTypes(all), all.filter(t => !E.FIND_MATCH_HOLD.includes(t)), 'everything else dealt as before');
  assert.ok(E.findMatchTypes(E.releasedTypes({})).length > 0, 'something is left to deal');
  assert.ok(E.allowedTypes({}, true).includes(E.FIND_MATCH_HOLD[0]), 'a room (allowedTypes) still has them');
});
