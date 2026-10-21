'use strict';
// Top opponents (a profile's): the server's per-opponent tally ranked, and the same tally counted from game history (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');

test('top opponents: the three most played, each with W-L-D; ties by the latest played, then by name', () => {
  const tally = {
    a: { name: 'Ada', wins: 2, losses: 1, draws: 0, last: 50 },
    b: { name: 'Bo', wins: 0, losses: 0, draws: 3, last: 10 },
    c: { name: 'Cy', wins: 1, losses: 0, draws: 0, last: 99 },
    d: { name: 'Di', wins: 0, losses: 1, draws: 0, last: 99 },
    e: { name: 'Ed', wins: 5, losses: 2, draws: 1, last: 1 },
  };
  const top = E.topOpponents(tally);
  assert.deepEqual(top.map(r => r.uid), ['e', 'a', 'b'], 'most games first; Ada and Bo both 3, Ada played later');
  assert.deepEqual(top[0], { uid: 'e', name: 'Ed', wins: 5, losses: 2, draws: 1, last: 1, games: 8 });
  assert.deepEqual(E.topOpponents(tally, 5).slice(3).map(r => r.uid), ['c', 'd'], 'same games and same time: by name');
  assert.deepEqual(E.topOpponents({ x: { name: 'X', last: 3 } }), [], 'no games against them: not listed');
  assert.deepEqual(E.topOpponents(null), []);
  assert.deepEqual(E.topOpponents({ a: tally.a }).map(r => r.uid), ['a'], 'fewer than three: what there is');
});

test('opponents from history: online games against people only (no bot, computer, guest or local game), the latest name kept', () => {
  const h = (uid, result, date, extra) => Object.assign({ mode: 'match', result, date, opponent: { uid, name: (uid || 'guest') + date } }, extra || {});
  const entries = [
    h('p1', 'win', 1), h('p1', 'loss', 5), h('p1', 'draw', 3, { mode: 'friend' }),
    h('p2', 'win', 2), h('bot', 'loss', 4),
    h(null, 'win', 6, { mode: 'friend' }),                                     // a friend without an account
    h('p3', 'win', 7, { mode: 'local', opponent: { uid: null, name: 'Computer', cpu: true } }),
    h('p4', 'win', 8, { mode: 'local' }),
  ];
  const t = E.oppTally(entries, e => e.opponent.uid === 'bot');
  assert.deepEqual(t, { p1: { name: 'p15', wins: 1, losses: 1, draws: 1, last: 5 }, p2: { name: 'p22', wins: 1, losses: 0, draws: 0, last: 2 } });
  assert.deepEqual(E.topOpponents(t).map(r => `${r.name} ${r.wins}-${r.losses}-${r.draws}`), ['p15 1-1-1', 'p22 1-0-0']);
});
