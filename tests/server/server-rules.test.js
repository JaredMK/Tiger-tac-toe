'use strict';
// The server's own rules (functions/serverRules.js): usernames, Elo, matchmaking pairs.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../functions/serverRules.js');

test('usernames: 3 to 16 letters, numbers or underscores; reserved and rude names refused', () => {
  for (const ok of ['abc', 'Player_1', 'ABCDEFGHIJKLMNOP', 'a_b_c', 'classic', 'Peacock', 'grapes', 'Sussex', 'Dickens_fan'.slice(0, 3) + 'x']) assert.equal(R.usernameProblem(ok), null, ok);
  for (const [bad, why] of [['', /Pick/], ['ab', /3 to 16/], ['a'.repeat(17), /3 to 16/], ['two words', /letters, numbers/], ['dash-ed', /letters/], ['ünï', /letters/],
    ['admin', /reserved/], ['Computer', /reserved/], ['fuckface', /another/], ['ShitHead', /another/], ['sh1t_lord', /another/], ['f_u_c_k', /another/], ['b1tch', /another/], ['big_ass', /another/], ['cock99', /another/], ['nazi1', /another/]]) {
    assert.match(String(R.usernameProblem(bad)), why, bad);
  }
});

test('usernames: the standard word list, look-alikes undone, words caught inside longer names, innocent words left alone', () => {
  const LIST = require('../../functions/badwords.js').BADWORDS;   // (the list itself lives in src/core/badwords.js, shared with Five Letters)
  assert.ok(LIST.length > 400 && LIST.includes('fuck') && LIST.includes('2 girls 1 cup'), 'the LDNOOBW English list, as published');
  // look-alike characters: 0 o, 1 i, 3 e, 4 a, 5 s, 7 t, 8 b
  for (const bad of ['sh1t', 'SH1T_happens', 'a55hole', 'b1tch_please', 'pu55y', 'd1ldo', 'fvck_fuk', 'n4z1', 'H1tl3r', 'r3tard', 'b00bs', 'c0ck_99', 'wh0re', 'Sl0t_slut'.slice(5), '3jaculation'.slice(0, 11)]) {
    assert.match(String(R.usernameProblem(bad)), /another/, bad);
  }
  // inside longer names, with or without underscores and capitals
  for (const bad of ['xXfuckXx', 'TheShitLord', 'motherfucker1', 'iLoveP0rn', 'porn_star', 'BigCockEnergy', 'a_n_a_l', 'grapeRAPE', 'shitty_shot', 'BitchPlease']) {
    assert.match(String(R.usernameProblem(bad)), /another/, bad);
  }
  // three-letter words as words of their own only: between underscores or digits, or a CamelCase part
  for (const bad of ['Big_Ass', 'BigAss', 'ass_hat', 'cum_lord', 'Sexy_99'.replace('y', ''), 'tit4tat', 'XXX_Sniper']) assert.match(String(R.usernameProblem(bad)), /another/, bad);
  // ordinary names that contain a listed word somewhere: allowed
  for (const ok of ['Classic', 'Cassie', 'Passion', 'Button', 'Butterfly', 'Arsenal', 'Raccoon', 'Tycoon', 'Grape', 'Skyscraper', 'Analyst', 'Canal_Boat',
    'Peacock', 'Hancock', 'Cockpit', 'Dickens', 'Scunthorpe', 'Therapist', 'Spoon', 'Teaspoon', 'Spicy', 'Suspicious', 'Specialist', 'Socialist', 'Among_Us',
    'Document', 'Cucumber', 'Title', 'Essex', 'Sussex', 'Mongoose', 'Pakistan', 'Scatter', 'player1', 'Alice_A', 'Bob_B']) assert.equal(R.usernameProblem(ok), null, ok);
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

test('matchmaking pairs with ratings on (behind the flag): closest rating first, the range widening with the wait, each player once', () => {
  const t = 1e6;
  const q = { a: { rating: 1200, since: t }, b: { rating: 1210, since: t }, c: { rating: 1800, since: t }, d: { rating: 1790, since: t } };
  assert.deepEqual(R.pairQueue(q, t, true).map(p => p.slice().sort().join('')).sort(), ['ab', 'cd']);
  assert.deepEqual(R.pairQueue({ a: { rating: 1200, since: t }, c: { rating: 1500, since: t } }, t, true), [], '300 apart: not at first');
  assert.deepEqual(R.pairQueue({ a: { rating: 1200, since: t - 30000 }, c: { rating: 1500, since: t } }, t, true).length, 1, 'after half a minute, yes');
  assert.deepEqual(R.pairQueue({ a: { rating: 800, since: t - 95000 }, c: { rating: 2400, since: t } }, t, true).length, 1, 'anyone after a minute and a half');
  assert.deepEqual(R.pairQueue({ a: { rating: 1200, since: t, game: 'g' }, b: { rating: 1200, since: t } }, t, true), [], 'a player already paired is not paired again');
  const many = {};
  for (let k = 0; k < 9; k++) many['p' + k] = { rating: 1200 + k * 5, since: t - k };
  const pairs = R.pairQueue(many, t, true), seen = pairs.flat();
  assert.equal(pairs.length, 4); assert.equal(new Set(seen).size, 8, 'nobody twice');
  assert.equal(R.ratingRange(0), 100); assert.equal(R.ratingRange(5000), 150); assert.equal(R.ratingRange(90000), Infinity);
});


test('ratings are off: one Find Match queue, 30 seconds a turn, pairs by wait time alone', () => {
  assert.equal(R.RATINGS_ENABLED, false);
  assert.deepEqual(Object.keys(R.QUEUES), ['chaos', 'match'], 'Find Match is Classic; the Super Chaos queue stays as code');
  assert.deepEqual(R.QUEUES.chaos, { key: 'chaos', mode: 'match', timer: 0, chaos: true });
  assert.deepEqual([R.queueKey(), R.queueKey('chaos'), R.queueKey('classic'), R.queueKey('classic', true), R.queueKey('chaos', true)], ['match', 'match', 'match', 'match', 'chaos'], 'Classic; Super Chaos only while it is open (the tests)');
  assert.deepEqual(R.QUEUES.match, { key: 'match', mode: 'match', timer: 30, classic: true });
  assert.equal(R.queueKey('casual', true), 'match', 'an older page asking for another queue gets Classic');
  const t = 1e6;
  const q = { a: { rating: 1200, since: t - 10 }, b: { rating: 2400, since: t - 30 }, c: { rating: 1210, since: t - 20 }, d: { rating: 800, since: t - 5, game: 'g' } };
  assert.deepEqual(R.pairQueue(q, t), [['b', 'c']], 'the two who waited longest, whatever their ratings; an odd one out waits');
  assert.deepEqual(R.pairQueue(Object.assign({}, q, { e: { since: t - 1 } }), t), [['b', 'c'], ['a', 'e']]);
  assert.deepEqual(R.pairQueue({ a: { rating: 1200, since: t }, b: { rating: 1210, since: t }, c: { rating: 1800, since: t }, d: { rating: 1790, since: t } }, t, true).map(p => p.slice().sort().join('')).sort(), ['ab', 'cd'], 'the rating pairing is still there, behind the flag');
});

test('records: a result for the record, squares won and lost by mini-game, and a recount from history', () => {
  assert.deepEqual(R.recordDelta('win'), { wins: 1, losses: 0, draws: 0, games: 1 });
  assert.deepEqual(R.recordDelta('draw'), { wins: 0, losses: 0, draws: 1, games: 1 });
  const squares = [{ owner: 'X', mini: { type: 'ttt' } }, { owner: 'O', mini: { type: 'ttt' } }, { owner: null, mini: { type: 'pig' } }, { owner: 'X', mini: { type: 'bs' } }];
  assert.deepEqual(R.squaresFor(squares, 'X'), { ttt: { won: 1, lost: 1 }, bs: { won: 1, lost: 0 } });
  assert.deepEqual(R.squaresFor(squares, 'O'), { ttt: { won: 1, lost: 1 }, bs: { won: 0, lost: 1 } });
  const r = R.recountHistory([
    { mode: 'match', side: 'O', result: 'win', final: JSON.stringify({ squares }) },
    { mode: 'friend', side: 'X', result: 'draw', final: '{"squares":[]}' },
    { mode: 'local', side: 'X', result: 'win' }, { mode: 'casual', result: 'nonsense' }, { mode: 'ranked', side: 'X', result: 'loss', final: 'not json' },
  ]);
  assert.deepEqual(r.main, { wins: 1, losses: 1, draws: 0, games: 2 });
  assert.deepEqual(r.friend, { wins: 0, losses: 0, draws: 1, games: 1 });
  assert.deepEqual(r.minis, { ttt: { won: 1, lost: 1 }, bs: { won: 0, lost: 1 } });
});
