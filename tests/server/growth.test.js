// Growth (functions/statsRules.js, December 2026): the funnel steps and growth events a phone may log (devlog 'step', 'act').
// What is counted from them (cohorts, retention, the funnel, invites) is the admin's metrics layer: tests/core/admin-metrics.test.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../functions/statsRules.js');
const T = Date.parse('2026-12-10T17:00:00Z');

test('the events and steps the server takes', () => {
  assert.ok(S.checkDev({ dev: 'd1234567890ab', ev: 'step', step: 'claim' }, T));
  assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'step', step: 'nope' }, T), null);
  assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'act', act: 'spam', o: 'abcdef12' }, T), null);
  assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'act', act: 'invite', ch: 'fax', o: 'abcdef12' }, T).ev.ch, undefined);
});
