'use strict';
// Run with:  node --test
// The admin's playtest numbers (playtest.js): New York time, sessions, activity by hour, devices,
// retention and the funnel, from devices' event logs as the server keeps them.
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../playtest.js');

const Z = s => Date.parse(s);                                    // a UTC time
const MIN = 60000;
const log = evs => Object.fromEntries(evs.map((e, i) => [`k${i}`, e]));

test('New York time: days and hours in America/New_York, summer time included', () => {
  assert.equal(P.nyDay(Z('2026-10-16T03:30:00Z')), '2026-10-15', '11:30 pm on the 15th in New York (EDT, UTC-4)');
  assert.equal(P.nyHour(Z('2026-10-16T03:30:00Z')), '2026-10-15 23:00');
  assert.equal(P.nyDay(Z('2026-01-16T04:30:00Z')), '2026-01-15', 'winter: EST, UTC-5');
  assert.equal(P.nyDay(Z('2026-01-16T05:30:00Z')), '2026-01-16');
  // the clocks go forward (8 March 2026, 2 am): 1:59 EST, then 3:00 EDT
  assert.equal(P.nyHour(Z('2026-03-08T06:59:00Z')), '2026-03-08 01:00');
  assert.equal(P.nyHour(Z('2026-03-08T07:00:00Z')), '2026-03-08 03:00');
  // and back (1 November 2026, 2 am): 1 am twice
  assert.equal(P.nyHour(Z('2026-11-01T05:30:00Z')), '2026-11-01 01:00');
  assert.equal(P.nyHour(Z('2026-11-01T06:30:00Z')), '2026-11-01 01:00');
  assert.equal(P.nyHour(Z('2026-11-01T07:30:00Z')), '2026-11-01 02:00');
  assert.equal(P.nyWhen(Z('2026-10-15T19:07:00Z')), 'Oct 15, 3:07 pm');
  assert.equal(P.nyWhen(Z('2026-10-15T04:05:00Z')), 'Oct 15, 12:05 am');
  assert.equal(P.dayNum('2026-03-09') - P.dayNum('2026-03-08'), 1, 'a 23-hour day is still one day');
  assert.equal(P.dayNum('2026-11-02') - P.dayNum('2026-11-01'), 1, 'and a 25-hour one');
});

test('sessions: a new one after 30 minutes with nothing; games, finished in a row, length, modes, ended mid-match', () => {
  const t0 = Z('2026-10-15T16:00:00Z');
  const evs = P.eventsOf(log([
    { t: t0, ev: 'open' },
    { t: t0 + 1 * MIN, ev: 'start', m: 'cpu', g: 'la' }, { t: t0 + 9 * MIN, ev: 'finish', m: 'cpu', g: 'la' },
    { t: t0 + 10 * MIN, ev: 'start', m: 'cpu', g: 'lb' }, { t: t0 + 20 * MIN, ev: 'finish', m: 'cpu', g: 'lb' },
    { t: t0 + 21 * MIN, ev: 'start', m: 'local', g: 'lc' }, { t: t0 + 25 * MIN, ev: 'leave', m: 'local', g: 'lc' },
    { t: t0 + 54 * MIN, ev: 'start', m: 'friend', g: 'fd' },  // 29 minutes on: the same session
    { t: t0 + 60 * MIN, ev: 'finish', m: 'friend', g: 'fd' },
    { t: t0 + 61 * MIN, ev: 'start', m: 'cpu', g: 'le' },     // and then nothing: the session ends mid-match
    // 31 minutes on: a new session; the open match ends in it
    { t: t0 + 92 * MIN, ev: 'open' }, { t: t0 + 93 * MIN, ev: 'finish', m: 'cpu', g: 'le' },
    { t: t0 + 94 * MIN, ev: 'start', m: 'match', g: 'mf' }, { t: t0 + 99 * MIN, ev: 'leave', m: 'match', g: 'mf' },
  ]));
  const ss = P.sessionsOf(evs);
  assert.equal(ss.length, 2);
  const [a, b] = ss;
  assert.deepEqual([a.played, a.streak, a.ms, a.mid], [5, 2, 61 * MIN, 'open'], 'five games; two finished in a row (then one left, then one finished); still in the last');
  assert.deepEqual(a.modes.sort(), ['cpu', 'friend', 'local']);
  assert.deepEqual([b.played, b.streak, b.ms, b.mid], [1, 0, 7 * MIN, 'left'], 'its one game left: ended mid-match');
  assert.deepEqual(b.modes, ['match']);
  // a session whose last game is finished, and one with no games at all
  const c = P.sessionsOf(P.eventsOf(log([{ t: t0, ev: 'start', m: 'cpu', g: 'x1' }, { t: t0 + MIN, ev: 'finish', m: 'cpu', g: 'x1' }, { t: t0 + 3 * 3600000, ev: 'open' }])));
  assert.deepEqual(c.map(s => [s.played, s.streak, s.mid]), [[1, 1, null], [0, 0, null]]);
  // a long match: the 'live' every 10 minutes keeps it one session, finished
  const long = P.sessionsOf(P.eventsOf(log([{ t: t0, ev: 'start', m: 'match', g: 'm1' }, ...[10, 20, 30, 40].map(k => ({ t: t0 + k * MIN, ev: 'live', m: 'match', g: 'm1' })), { t: t0 + 47 * MIN, ev: 'finish', m: 'match', g: 'm1' }])));
  assert.deepEqual(long.map(s => [s.played, s.streak, s.ms, s.mid]), [[1, 1, 47 * MIN, null]]);
  // without them, the same match splits in two: the first session ends mid-match
  const gap = P.sessionsOf(P.eventsOf(log([{ t: t0, ev: 'start', m: 'match', g: 'm1' }, { t: t0 + 47 * MIN, ev: 'finish', m: 'match', g: 'm1' }])));
  assert.deepEqual(gap.map(s => [s.played, s.mid]), [[1, 'open'], [0, null]]);
  // exactly 30 minutes is not a gap yet
  assert.equal(P.sessionsOf(P.eventsOf(log([{ t: t0, ev: 'open' }, { t: t0 + 30 * MIN, ev: 'open' }, { t: t0 + 60 * MIN + 1, ev: 'open' }]))).length, 2);
});

// Three devices: A (tagged, three days), B (one visit, never starts), C (comes back the next day by New York time, 20 minutes later).
function sample() {
  const d1 = Z('2026-10-10T14:00:00Z');                          // 10 am in New York, 10 October
  const devices = { aaaaaaaa1111: { first: d1, last: d1, n: 1, tag: 'sam' }, bbbbbbbb2222: { first: d1, last: d1, n: 1 }, cccccccc3333: { first: d1, last: d1, n: 1, tag: 'lee' } };
  const logs = {
    aaaaaaaa1111: log([
      { t: d1, ev: 'open' }, { t: d1 + MIN, ev: 'start', m: 'cpu', g: 'l1' }, { t: d1 + 8 * MIN, ev: 'finish', m: 'cpu', g: 'l1' }, { t: d1 + 9 * MIN, ev: 'start', m: 'cpu', g: 'l2' },
      { t: d1 + 2 * 86400000, ev: 'open' }, { t: d1 + 2 * 86400000 + MIN, ev: 'start', m: 'local', g: 'l3' },           // two days later
    ]),
    bbbbbbbb2222: log([{ t: d1 + 5 * MIN, ev: 'open' }]),
    cccccccc3333: log([
      { t: Z('2026-10-11T03:50:00Z'), ev: 'open' }, { t: Z('2026-10-11T03:51:00Z'), ev: 'start', m: 'friend', g: 'f1' },   // 11:50 pm on the 10th
      { t: Z('2026-10-11T04:10:00Z'), ev: 'finish', m: 'friend', g: 'f1' },                                              // 12:10 am on the 11th
    ]),
  };
  return { devices, logs, d1 };
}

test('devices: the table, newest first; sessions, games per session, and whether they came back on a later day', () => {
  const { devices, logs } = sample();
  const rows = P.deviceRows(devices, logs);
  assert.deepEqual(rows.map(r => r.short), ['aaaaaaaa', 'cccccccc', 'bbbbbbbb'], 'by last seen');
  const [a, c, b] = rows;
  assert.deepEqual([a.tag, a.nSessions, a.games, a.perSession, a.back, a.nextDay, a.week], ['sam', 2, 3, 1.5, true, false, true]);
  assert.deepEqual([b.tag, b.nSessions, b.games, b.perSession, b.back], ['', 1, 0, 0, false]);
  assert.deepEqual([c.nSessions, c.games, c.back, c.nextDay], [1, 1, true, true], 'one session across midnight: back the next day by the calendar');
  assert.equal(P.nyDay(c.first), '2026-10-10');
});

test('retention and the funnel: next day and within 7 days; opened → started → finished → started another', () => {
  const { devices, logs, d1 } = sample();
  const rows = P.deviceRows(devices, logs);
  assert.deepEqual(P.retention(rows, d1 + 20 * 86400000), { eligible: 3, nextDay: 1, week: 2 });
  assert.deepEqual(P.retention(rows, d1 + 3600000), { eligible: 0, nextDay: 0, week: 0 }, 'first seen today: not counted yet');
  assert.deepEqual(P.funnel(rows), { opened: 3, started: 2, finished: 2, another: 1 }, 'A started another after finishing; C did not');
});

test('activity by hour: the last 7 days in New York hours; matches started and finished, devices active', () => {
  const { devices, logs, d1 } = sample();
  const rows = P.deviceRows(devices, logs);
  const now = d1 + 2 * 86400000 + 30 * MIN;
  const hours = P.hourly(rows, now);
  assert.equal(hours.length, 168);
  assert.equal(hours[hours.length - 1].label, P.nyHour(now), 'up to the hour now');
  const at = label => hours.find(h => h.label === label);
  assert.deepEqual(['started', 'finished', 'devices'].map(k => at('2026-10-10 10:00')[k]), [2, 1, 2], '10 am on the 10th: A started two and finished one; A and B were about');
  assert.deepEqual(['started', 'finished', 'devices'].map(k => at('2026-10-10 23:00')[k]), [1, 0, 1], "C's 11:50 pm start");
  assert.deepEqual(['started', 'finished', 'devices'].map(k => at('2026-10-11 00:00')[k]), [0, 1, 1], 'and its finish after midnight');
  assert.equal(hours.reduce((n, h) => n + h.started, 0), 4);
  // older than 7 days: left out
  assert.equal(P.hourly(rows, d1 + 8 * 86400000).reduce((n, h) => n + h.started, 0), 1, 'only the start two days on is within the 7 days');
  // the clocks going back: two 1 am hours, each its own bar
  const fall = P.hourly([], Z('2026-11-01T12:00:00Z'), 1).map(h => h.label);
  assert.equal(fall.filter(l => l === '2026-11-01 01:00').length, 2);
});
