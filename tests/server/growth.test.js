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

test('the "Create an account" prompt\'s events (shown, Not now, tapped, an account made from it or not)', () => {
  for (const act of ['acct-shown', 'acct-no', 'acct-tap']) assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'act', act, o: 'abcdef12' }, T).ev.act, act);
  assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'act', act: 'acct-made', ch: 'prompt', o: 'abcdef12' }, T).ev.ch, 'prompt');
  assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'act', act: 'acct-made', ch: 'other', o: 'abcdef12' }, T).ev.ch, 'other');
});

test('a guest\'s match carried over to a new account keeps when it ended (recordLocal)', () => {
  const R = require('../../functions/serverRules.js'), E = { ttt: 1 };
  const sq = o => ({ owner: o, mini: { type: 'ttt' } });
  const final = { squares: [sq('X'), sq('X'), sq('X'), sq(null), sq('O'), sq('O'), sq(null), sq(null), sq(null)], winner: 'X', winReason: 'line', moves: 5 };
  const main = () => ({ winner: 'X', reason: 'line' });
  const d = { id: 'abcdef12', side: 'X', opponent: { name: 'Computer', cpu: true }, final };
  const plain = R.checkLocal(d, Object.keys(E), main);
  assert.equal(plain.at, null); assert.equal(plain.carried, false);
  const carried = R.checkLocal(Object.assign({ at: T - 86400000, carried: true }, d), Object.keys(E), main);
  assert.equal(carried.at, T - 86400000); assert.equal(carried.carried, true); assert.equal(carried.cpu, true);
  assert.equal(R.checkLocal(Object.assign({ at: 'yesterday' }, d), Object.keys(E), main).at, null);
});
