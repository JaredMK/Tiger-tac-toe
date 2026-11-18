'use strict';
// The launch reset (scripts/reset-production.js): what it deletes, what it keeps, every record back to 0-0-0.
const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../../scripts/reset-production.js');
const R = require('../../functions/serverRules.js');
const rules = require('../../database.rules.json');

test('reset: matches, history, logs and stats go; accounts, names, admin and settings stay; records back to 0-0-0', () => {
  const data = {
    users: { u1: { username: 'jarhad', joined: 5, wins: 3, losses: 1, draws: 2, games: 6, rating: 1300, friend: { wins: 1 }, minis: { ttt: { won: 2 } } } },
    usernames: { jarhad: 'u1' }, admin: { staging: { allow: {} } }, config: { ai: {} }, releases: { superchaos: true }, bots: { b1: {} },
    games: { g1: {}, g2: {} }, rooms: { ABCD: {} }, history: { u1: { g1: {} } }, matchLogs: { k: {} }, stats: { modes: {} }, devices: { d: {} },
    leaderboard: { u1: {} }, statsSeen: 'x', mystery: { a: 1 },
  };
  const p = X.plan(data);
  assert.deepEqual(p.remove.sort(), ['devices/d', 'games/g1', 'games/g2', 'history/u1', 'leaderboard/u1', 'matchLogs/k', 'rooms/ABCD', 'stats/modes', 'statsSeen'].sort());
  assert.deepEqual(p.records, { 'users/u1/wins': 0, 'users/u1/losses': 0, 'users/u1/draws': 0, 'users/u1/games': 0, 'users/u1/rating': R.START_RATING, 'users/u1/friend': null, 'users/u1/minis': null, 'users/u1/sides': null,
    'profiles/u1/wins': 0, 'profiles/u1/losses': 0, 'profiles/u1/draws': 0, 'profiles/u1/games': 0, 'profiles/u1/friend': null, 'profiles/u1/minis': null, 'profiles/u1/sides': null });   // (the public profile's record with it; its username and join date stay)
  assert.deepEqual(p.unknown, ['mystery'], 'a root it does not know is left alone, and named');
  for (const k of p.remove) assert.ok(!X.KEEP.includes(k.split('/')[0]));
  assert.equal(X.START_RATING, R.START_RATING);
});

test('reset: the settings-version history goes (every game back to version 1); the settings themselves stay', () => {
  const p = X.plan({ config: { tune: { pig: { target: 40 } }, versions: { pig: 3 }, versionLog: { pig: { v2: {}, v3: {} } }, ai: {} }, reports: { r1: {} } });
  assert.deepEqual(p.remove.sort(), ['config/versionLog', 'config/versions', 'reports/r1']);
  assert.ok(!p.remove.some(r => r.startsWith('config/tune') || r === 'config/ai'));
  assert.deepEqual(X.plan({ config: { ai: {} } }).remove, [], 'nothing to delete when there is no history');
});

test('reset: every root the database rules know is either deleted or kept', () => {
  for (const r of Object.keys(rules.rules)) if (!r.startsWith('.')) assert.ok(X.DELETE.includes(r) || X.KEEP.includes(r), r);
});
