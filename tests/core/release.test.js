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

test('Find Match: the hold list (FIND_MATCH_HOLD) is empty (Bullseye is allowed again, the cheating risk accepted); what it lists is cut from Find Match\'s games, released or not, never from rooms or local play', () => {
  const all = E.TYPES.slice();
  assert.deepEqual(E.FIND_MATCH_HOLD, [], 'nothing held back');
  assert.ok(E.findMatchTypes(all).includes('bullseye'), 'Bullseye is dealt (once released)');
  assert.deepEqual(E.findMatchTypes(all), all, 'every game');
  E.FIND_MATCH_HOLD.push('bullseye');                       // (the mechanism, kept: a held game is cut)
  try { assert.ok(!E.findMatchTypes(all).includes('bullseye')); assert.deepEqual(E.findMatchTypes(all), all.filter(t => t !== 'bullseye')); assert.ok(E.allowedTypes({}, true).includes('bullseye'), 'a room (allowedTypes) still has it'); }
  finally { E.FIND_MATCH_HOLD.length = 0; }
  assert.ok(E.findMatchTypes(E.releasedTypes({})).length > 0, 'something is left to deal');
});
