'use strict';
// Simulations: Door Drop (slow, never part of npm test: `npm run sim -- doors`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
// No memory aids (v 3, November 2026): nothing tried is drawn, any door may be picked again, and the computer's levels
// differ by memory (each door it knows something of forgotten at a pick: Hard 0%, Normal 10%, Easy 40%; ai.js).
// The defaults (3 floors of 4 doors, a tower each), Normal v Normal: 4.4 turns each (median 4.5), first mover 53.0%
// (500) / 50.2% (4,000); a shared tower the same (4.4, 50.4%); Go again on: 2.4 (median 2.5), 50.9%; 2 floors: 2.7,
// 53%; 4 floors: 6.1 (median 6), 51%; 3 doors a floor: 3.6, 48%; 5 doors: 4.9, 50%; Normal forgetting 0%: 4.2
// (= Hard v Hard, the old Normal), 25%: 4.75; Easy v Easy: 5.2, 49%; Hard beats Normal (55.6% first, 53.7%
// second); Normal beats Easy (63.5% first, 63.5% second).
// (Before, v 2, every door marked: 4.2 turns each (median 4), first mover 51.6% / 50.5%; Easy v Easy 6.1, 58%.)
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('doors: 500 squares at Normal: the first mover and the turns each (the defaults: 3 floors of 4 doors, separate towers)', () => {
  const r = duel('doors', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`); assert.ok(r.each >= 3 && r.each <= 6, `mean turns ${r.each}`);
});
test('doors: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal') => console.log(line(label, duel('doors', a, b, 4000, t)));
  T('defaults (4,000)', null);
  T('shared tower', { towers: 'shared' });
  T('Go again on success', { again: 'on' });
  T('2 floors of 4', { floors: 2 }); T('4 floors of 4', { floors: 4 }); T('3 floors of 3', { doors: 3 }); T('4 floors of 3', { floors: 4, doors: 3 }); T('3 floors of 5', { doors: 5 }); T('3 floors of 6', { doors: 6 }); T('4 floors of 5', { floors: 4, doors: 5 });
  T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Hard', null, 'hard', 'hard'); T('Normal v Easy', null, 'normal', 'easy'); T('Easy v Normal', null, 'easy', 'normal'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
  T('Normal forgetting 0%', { forget: 0 }); T('Normal forgetting 25%', { forget: 25 });
});
