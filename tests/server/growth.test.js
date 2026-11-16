// Growth (functions/statsRules.js, December 2026): a device's cohort, its funnel steps, retention once on exactly day
// 1, 7 and 30, its first finished and second started match, the events a day, Find Match's waits by bucket.
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../../functions/statsRules.js');
const T = Date.parse('2026-12-10T17:00:00Z'), DAY = 86400000;

test('a new device: its cohort, opened, its source', () => {
  const d = {};
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'open' }, tag: 'sam' }, T, true), { 'cohorts/2026-12-10/n': 1, 'funnel/2026-12-10/opened': 1, 'sources/sam/devices': 1 });
});
test('retention on exactly day 1, 7 and 30, each once; matches finished and a second one', () => {
  const d = { first: T, ct: 1 };
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'open' } }, T + DAY, false), { 'cohorts/2026-12-10/d1': 1 });
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'open' } }, T + DAY, false), {}, 'once');
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'open' } }, T + 3 * DAY, false), {}, 'day 3: nothing');
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'open' } }, T + 7 * DAY, false), { 'cohorts/2026-12-10/d7': 1 });
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'finish' } }, T + 30 * DAY, false), { 'cohorts/2026-12-10/d30': 1, 'funnel/2026-12-10/finished': 1 });
  S.growthMarks(d, { ev: { ev: 'start' } }, T, false);
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'start' } }, T, false), { 'funnel/2026-12-10/second': 1 });
});
test('a device from before cohorts: events counted, no cohort', () => {
  const d = { first: T - 100 * DAY };
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'act', act: 'share' } }, T, false), { 'acts/2026-12-10/share': 1 });
  assert.deepEqual(S.growthMarks(d, { ev: { ev: 'start' } }, T, false), {});
});
test('the events and steps the server takes', () => {
  assert.ok(S.checkDev({ dev: 'd1234567890ab', ev: 'step', step: 'claim' }, T));
  assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'step', step: 'nope' }, T), null);
  assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'act', act: 'spam', o: 'abcdef12' }, T), null);
  assert.equal(S.checkDev({ dev: 'd1234567890ab', ev: 'act', act: 'invite', ch: 'fax', o: 'abcdef12' }, T).ev.ch, undefined);
});
test("Find Match's waits by bucket", () => {
  assert.deepEqual(S.findUpdates('people', 65000, T), { 'find/2026-12-10/people': 1, 'find/2026-12-10/peopleMs': 65000, 'find/2026-12-10/w/o60': 1 });
  assert.equal(S.findUpdates('people', 9000, T)['find/2026-12-10/w/u10'], 1);
});
