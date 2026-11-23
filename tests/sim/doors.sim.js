'use strict';
// Simulations: Door Drop (slow, never part of npm test: `npm run sim -- doors`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
// With the doors' fixed links (v 2, November 2026: a dead end comes out of another dead end, so a miss shows two):
// the defaults (3 floors of 4 doors, a tower each): 4.2 turns each (median 4), first mover 51.6% (500) / 50.5%
// (4,000); a shared tower the same; Go again on: 2.2 (median 2), 50.5%; 2 floors: 2.6, 53%; 4 floors: 5.8 (median 6),
// 52%; 3 doors a floor: 3.5, 48%; 5 doors: 4.6, 51%; 6 doors: 5.2, 49%; Easy v Easy (its own marks alone, no thought
// for where a runner came out): 6.1, 58%; Hard v Hard as Normal; Normal beats Easy (87.5% moving first, 85% second).
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('doors: 500 squares at Normal: the first mover and the turns each (the defaults: 3 floors of 4 doors, separate towers)', () => {
  const r = duel('doors', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('doors: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('doors', a, b, 4000, t)));
  T('defaults (4,000)', null);
  T('shared tower', { towers: 'shared' });
  T('Go again on success', { again: 'on' });
  T('2 floors of 4', { floors: 2 }); T('4 floors of 4', { floors: 4 }); T('3 floors of 3', { doors: 3 }); T('4 floors of 3', { floors: 4, doors: 3 }); T('3 floors of 5', { doors: 5 }); T('3 floors of 6', { doors: 6 }); T('4 floors of 5', { floors: 4, doors: 5 });
  T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Hard', null, 'hard', 'hard'); T('Normal v Easy', null, 'normal', 'easy'); T('Easy v Normal', null, 'easy', 'normal');
});
