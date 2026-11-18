'use strict';
// The admin dashboard's one metrics layer (src/admin/metrics.js): the model joined from rows (matches, devices and their
// events, accounts, Find Match searches), the filters (my devices, the range, the platform, the mode, the settings version)
// and the definitions: a metric's value is the count of its rows, the same wherever it is asked, with and without my devices.
const test = require('node:test');
const assert = require('node:assert/strict');

let X;
test.before(async () => { X = await import('../../src/admin/metrics.js'); });

const { NOW, day, H, world } = require('../admin-world.js');
const val = (S, id) => X.metric(S, id).v;

test('the model: people are accounts or guests\' devices; a device belongs to the account last signed in on it; bots are nobody', () => {
  const M = X.build(world(), NOW);
  assert.deepEqual([...M.people.keys()].sort(), ['d:' + H('a'), 'd:' + H('c'), 'u:boss', 'u:u1']);
  assert.equal(M.people.get('u:u1').devices[0].short, 'bbbbbbbb'); assert.equal(M.people.get('u:u1').tag, 'tiktok');
  assert.equal(M.people.get('d:' + H('a')).tag, 'reddit'); assert.equal(M.people.get('d:' + H('a')).name, 'Guest aaaaaaaa');
  assert.equal(M.people.get('u:boss').owner, true, 'an owner device makes its person the owner');
  const g1 = M.matches.find(m => m.id === 'g1');
  assert.deepEqual(g1.who.map(w => w.pid), ['u:u1', 'd:' + H('c')], 'a match\'s players, by account or by device');
  assert.equal(g1.status, 'abandoned'); assert.equal(g1.logKey, 'mg1'); assert.equal(g1.log.reported, day(1));
  assert.equal(M.matches.find(m => m.id === 'l_a2').status, 'unfinished', 'started over 3 hours ago, never ended');
  assert.equal(M.matches.find(m => m.id === 'g2').who[1].pid, null, 'the computer is nobody');
});

test('every metric is the count of its rows, and the same number whoever asks; my devices are left out until asked for', () => {
  const M = X.build(world(), NOW), S = X.scope(M, { range: '30' }), Smine = X.scope(M, { range: '30', mine: true });
  assert.deepEqual([val(S, 'active'), val(Smine, 'active')], [3, 4]);
  assert.deepEqual([val(S, 'started'), val(S, 'finished'), val(S, 'abandoned'), val(S, 'unfinished')], [4, 2, 1, 1]);
  assert.deepEqual([val(Smine, 'started'), val(Smine, 'finished')], [5, 3], 'with my devices: one more');
  assert.equal(val(S, 'completion'), 0.5);
  assert.equal(val(S, 'squares'), 3, 'won squares of finished matches: an abandoned match\'s are not counted');
  assert.equal(X.metric(S, 'resets').n, 1); assert.equal(X.metric(S, 'resets').of, 4);
  assert.equal(val(S, 'played'), 3); assert.equal(val(S, 'newPlayers'), 3); assert.equal(val(S, 'newAccounts'), 1);
  assert.deepEqual([val(S, 'opens'), val(S, 'errors'), val(Smine, 'errors')], [7, 1, 2]);
  assert.equal(val(S, 'errorRate'), 100 / 7);
  assert.deepEqual([val(S, 'reports'), val(Smine, 'reports')], [1, 2]);
  assert.deepEqual([val(S, 'findBot'), val(S, 'findCancel'), val(S, 'findPeople'), val(Smine, 'findPeople')], [1, 1, 0, 1]);
  assert.equal(val(S, 'findFill'), 1); assert.equal(val(S, 'findWait'), 21);
  assert.deepEqual([val(S, 'invitesSent'), val(S, 'inviteJoins'), val(S, 'shares')], [1, 1, 1]);
  for (const id of X.METRIC_IDS) {                              // a count is its rows; a share is n of its denominator
    const m = X.metric(S, id);
    assert.ok(Array.isArray(m.rows), id + ': its rows');
    if (m.of == null && Number.isInteger(m.v) && !['turns', 'findWait', 'sessionLen', 'minutes'].includes(id)) assert.equal(m.v, m.rows.length, id + ': the count of its rows');
    assert.ok(X.tip(id), id + ': a one-line definition'); assert.ok(X.label(id));
    assert.equal(X.metric(S, id), m, 'asked twice: the same answer');
  }
});

test('the filters: the range, the platform and the mode apply to every number', () => {
  const M = X.build(world(), NOW);
  const today = X.scope(M, { range: 'today' });
  assert.deepEqual([val(today, 'active'), val(today, 'started'), val(today, 'finished'), val(today, 'errors')], [1, 2, 1, 1]);
  const ios = X.scope(M, { range: '30', platform: 'ios' });
  assert.deepEqual([val(ios, 'active'), val(ios, 'started'), val(ios, 'opens'), val(ios, 'errors')], [1, 2, 2, 0]);
  const cpu = X.scope(M, { range: '30', mode: 'cpu' }), find = X.scope(M, { range: '30', mode: 'find' }), friend = X.scope(M, { range: '30', mode: 'friend' });
  assert.deepEqual([val(cpu, 'started'), val(find, 'started'), val(friend, 'started')], [2, 1, 1], 'a match that took the computer is a Find Match match');
  assert.equal(val(cpu, 'started') + val(find, 'started') + val(friend, 'started'), val(X.scope(M, { range: '30' }), 'started'), 'the modes add up to all');
  const custom = X.scope(M, { range: 'custom', from: M.today, to: M.today });
  assert.equal(val(custom, 'started'), val(today, 'started'));
  assert.deepEqual(X.normFilters({ mine: 'yes', range: 'x', platform: 'tv', mode: 'q' }), X.FILTER_DEFAULTS);
});

test('retention and the first-run funnel: by person, by the day they were first seen', () => {
  const M = X.build(world(), NOW), S = X.scope(M, { range: '30' });
  const d1 = X.metric(S, 'd1'), d7 = X.metric(S, 'd7'), w1 = X.metric(S, 'w1');
  assert.deepEqual([d1.n, d1.of], [1, 3], 'three people are a day old; one came back the next day');
  assert.deepEqual([d7.n, d7.of], [1, 1], 'device a: first seen 8 days ago, back on day 7');
  assert.deepEqual([w1.n, w1.of], [1, 1]);
  assert.deepEqual(['fOpened', 'fTap', 'fMove', 'fFinished', 'fSecond'].map(k => val(S, k)), [3, 1, 0, 1, 0]);
  const rows = X.cohortRows(S);
  assert.equal(rows.reduce((n, r) => n + r.n, 0), val(S, 'newPlayers'), 'the cohorts add up to the new players');
  assert.equal(rows.reduce((n, r) => n + (r.d1 || 0), 0), d1.n, 'and their D1 to the headline\'s');
  assert.deepEqual(X.sourceRows(S).map(r => [r.tag, r.people.length, r.signups.length]).sort(), [['(none)', 1, 0], ['reddit', 1, 0], ['tiktok', 1, 1]]);
});

test('a game\'s numbers by settings version; match length by mode and timer; the series; a person\'s row', () => {
  const M = X.build(world(), NOW), S = X.scope(M, { range: '30', mine: true });
  const g = X.gameStats(S, 'ttt', { ttt: 2 });
  assert.equal(g.current, 2); assert.equal(g.n, 2, 'the current version\'s completed squares');
  assert.deepEqual([g.moves.med, g.firstMover], [3, 0.5]);
  assert.deepEqual(g.byVersion.map(v => [v.v, v.n]), [[2, 2], [1, 1]]);
  assert.equal(X.gameStats(S, 'ttt', { ttt: 2 }, 'all').n, 3);
  assert.equal(X.gameStats(S, 'ttt', { ttt: 2 }, 'all').n + X.gameStats(S, 'c4', {}, 'all').n, X.metric(S, 'squares').v, 'the games add up to the headline');
  const len = X.lengthRows(S);
  assert.equal(len.reduce((n, r) => n + r.started, 0), X.metric(S, 'started').v); assert.equal(len.reduce((n, r) => n + r.finished, 0), X.metric(S, 'finished').v);
  assert.equal(X.activeByDay(S).reduce((a, b) => Math.max(a, b), 0) <= X.metric(S, 'active').v, true);
  assert.equal(X.matchesByDay(S).reduce((n, s) => n + s.values.reduce((a, b) => a + b, 0), 0), X.metric(S, 'started').v, 'the chart adds up to the headline');
  assert.equal(X.eventsByDay(S, 'error').reduce((a, b) => a + b, 0), X.metric(S, 'errors').v);
  const sam = X.personRow(S, M.people.get('u:u1'));
  assert.deepEqual([sam.name, sam.kind, sam.devices, sam.platform, sam.tag, sam.matches, sam.record, sam.excluded], ['sam', 'account', 1, 'ios', 'tiktok', 2, '1-1-0', false]);
  assert.equal(X.resultFor(M.matches.find(m => m.id === 'g1'), 'u:u1'), 'lost'); assert.equal(X.resultFor(M.matches.find(m => m.id === 'g1'), 'd:' + H('c')), 'won');
  assert.deepEqual(X.personGames(M.people.get('u:u1')), [{ t: 'ttt', played: 1, won: 1, lost: 0 }]);
  assert.deepEqual(X.buildRows(S).map(r => [r.build, r.opens, r.errors]), [['b2', 6, 2], ['b1', 2, 0]]);
});
