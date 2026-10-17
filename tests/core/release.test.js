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
