// The hidden skill rating (functions/serverRules.js, December 2026): Find Match pairs the closest skills first, the range
// widening with the wait to anyone after SKILL_OPEN_MS (two people searching together are always paired before the computer
// is offered); a player with no skill yet counts as SKILL_START; an Elo update moves the winner up and the loser down.
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../../functions/serverRules.js');

test('pairs the closest skills first', () => {
  const t = 100000;
  const q = { a: { since: t - 1000, skill: 1000 }, b: { since: t - 1000, skill: 1400 }, c: { since: t - 900, skill: 1050 }, d: { since: t - 800, skill: 1380 } };
  const pairs = R.pairBySkill(q, t).map(p => p.slice().sort().join(''));
  assert.deepEqual(pairs.sort(), ['ac', 'bd']);
});
test('far apart: not at once, but anyone after the open time (well before the computer is offered)', () => {
  const t = 100000;
  const q = { a: { since: t - 500, skill: 900 }, b: { since: t - 500, skill: 1600 } };
  assert.deepEqual(R.pairBySkill(q, t), []);
  q.a.since = t - R.SKILL_OPEN_MS;
  assert.equal(R.pairBySkill(q, t).length, 1);
  assert.ok(R.SKILL_OPEN_MS < 20000);
});
test('no skill yet: the start; a game already made is left alone', () => {
  const t = 5000;
  const q = { a: { since: t, skill: undefined }, b: { since: t, skill: R.SKILL_START + 50 }, c: { since: t, skill: 1000, game: 'g1' } };
  assert.deepEqual(R.pairBySkill(q, t), [['a', 'b']]);
});
test('the update: the winner up, the loser down, a draw between equals nothing', () => {
  const w = R.skillUpdate(undefined, undefined, 1);
  assert.ok(w.X > R.SKILL_START && w.O < R.SKILL_START);
  const d = R.skillUpdate(1000, 1000, 0.5);
  assert.deepEqual(d, { X: 1000, O: 1000 });
});
