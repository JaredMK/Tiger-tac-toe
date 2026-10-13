'use strict';
// The server's own rules (functions/serverRules.js): usernames, Elo, matchmaking pairs.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../functions/serverRules.js');

test('usernames: 3 to 16 letters, numbers or underscores; reserved and rude names refused', () => {
  for (const ok of ['abc', 'Player_1', 'ABCDEFGHIJKLMNOP', 'a_b_c', 'classic', 'Peacock', 'grapes', 'Sussex', 'Dickens_fan'.slice(0, 3) + 'x']) assert.equal(R.usernameProblem(ok), null, ok);
  for (const [bad, why] of [['', /Pick/], ['ab', /3 to 16/], ['a'.repeat(17), /3 to 16/], ['two words', /letters, numbers/], ['dash-ed', /letters/], ['ünï', /letters/],
    ['admin', /reserved/], ['Computer', /reserved/], ['fuckface', /another/], ['ShitHead', /another/], ['sh1t_lord', /another/], ['f_u_c_k', /another/], ['b1tch', /another/], ['big_ass', /another/], ['cock99', /another/], ['nazi1', /another/]]) {
    assert.match(String(R.usernameProblem(bad)), why, bad);
  }
});

test('Elo: K = 32, equal ratings move 16 points, upsets move more, a draw moves toward each other', () => {
  assert.deepEqual(R.elo(1200, 1200, 1), { X: 1216, O: 1184 });
  assert.deepEqual(R.elo(1200, 1200, 0), { X: 1184, O: 1216 });
  assert.deepEqual(R.elo(1200, 1200, 0.5), { X: 1200, O: 1200 });
  const upset = R.elo(1000, 1400, 1);
  assert.equal(upset.X - 1000, 29); assert.equal(1400 - upset.O, 29);
  const fav = R.elo(1400, 1000, 1);
  assert.equal(fav.X - 1400, 3, 'the favourite gains little');
  const draw = R.elo(1000, 1400, 0.5);
  assert.ok(draw.X > 1000 && draw.O < 1400);
  assert.ok(Math.abs(R.expected(1200, 1600) - 1 / 11) < 1e-9);
});

test('matchmaking pairs: closest rating first, the range widening with the wait, each player once', () => {
  const t = 1e6;
  const q = { a: { rating: 1200, since: t }, b: { rating: 1210, since: t }, c: { rating: 1800, since: t }, d: { rating: 1790, since: t } };
  assert.deepEqual(R.pairQueue(q, t).map(p => p.slice().sort().join('')).sort(), ['ab', 'cd']);
  assert.deepEqual(R.pairQueue({ a: { rating: 1200, since: t }, c: { rating: 1500, since: t } }, t), [], '300 apart: not at first');
  assert.deepEqual(R.pairQueue({ a: { rating: 1200, since: t - 30000 }, c: { rating: 1500, since: t } }, t).length, 1, 'after half a minute, yes');
  assert.deepEqual(R.pairQueue({ a: { rating: 800, since: t - 95000 }, c: { rating: 2400, since: t } }, t).length, 1, 'anyone after a minute and a half');
  assert.deepEqual(R.pairQueue({ a: { rating: 1200, since: t, game: 'g' }, b: { rating: 1200, since: t } }, t), [], 'a player already paired is not paired again');
  const many = {};
  for (let k = 0; k < 9; k++) many['p' + k] = { rating: 1200 + k * 5, since: t - k };
  const pairs = R.pairQueue(many, t), seen = pairs.flat();
  assert.equal(pairs.length, 4); assert.equal(new Set(seen).size, 8, 'nobody twice');
  assert.equal(R.ratingRange(0), 100); assert.equal(R.ratingRange(5000), 150); assert.equal(R.ratingRange(90000), Infinity);
});

test('queues: ranked, and casual at 30s, 1 min or 3 min', () => {
  assert.equal(R.queueKey('ranked'), 'ranked');
  assert.equal(R.queueKey('casual', 60), 'casual60');
  assert.equal(R.queueKey('casual', 0), null, 'no unlimited casual');
  assert.equal(R.queueKey('casual', 45), null);
  assert.equal(R.queueKey('other', 60), null);
  assert.equal(R.QUEUES.ranked.timer, 60);
  assert.deepEqual(['casual30', 'casual60', 'casual180'].map(k => R.QUEUES[k].timer), [30, 60, 180]);
});
