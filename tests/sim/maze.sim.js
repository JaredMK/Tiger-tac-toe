'use strict';
// Simulations: Maze Runner (slow, never part of npm test: `npm run sim -- maze`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level. December 2026's rework aimed at a median of
// 5 to 7 turns each with the first mover on 45-60%: the defaults are a maze 8 wide and 10 tall each, the door bottom
// left and the flag top right, grown 60% from random cells (the rest newest-first), no path to the flag under 22 cells,
// and dealt to take a runner alone 8 turns. With no energy limit (`energy` 0): Normal v Normal 6.5 turns each (median
// 6), the first mover 53%.
// Energy (November 2026): a turn runs at most `energy` squares (the default 10), so the squares take longer: at the
// defaults Normal v Normal (500 squares) 9.0 turns each (median 8.5), the first mover 49.6%: over the batch's 3-6 and
// the owner's 5-7, kept at the owner's 10 by his word. 500 squares each, mean (median), first mover: 6 13.0 (12.5) 50%;
// 8 10.4 (10) 57%; 10 9.0 (8.5) 50%; 12 8.0 (7.5) 54%; 14 7.6 (7.5) 54%; 15 7.3 (7) 54%; 16 7.2 (6.5) 52%;
// 18 7.0 (6.5) 49%; 20 6.8 (6.5) 50%; 24 6.7 (6.5) 52%; 30 6.5 (6) 53%; 0 (none) 6.5 (6) 53%. The median comes into
// 5-7 from 15 (16 to 20: 6.5); 10 with fewer target turns alone instead (`turns` 6 or 5): 7.5 still.
// The assert holds the first mover to 45-60% and the median to what energy 10 gives (7-10), not to 3-6.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('maze: 500 squares at Normal: the first mover and the turns each (the defaults: a maze each, 8 by 10, 10 squares a turn)', () => {
  const r = duel('maze', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 7 && r.eachMed <= 10, `median turns ${r.eachMed} (energy 10: about 8.5; see the header)`);
});
test('maze: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 1000) => console.log(line(label, duel('maze', a, b, n, t)));
  T('the defaults, 2,000 squares', null, 'normal', 'normal', 2000);
  for (const e of [0, 6, 8, 12, 14, 15, 16, 18, 20]) T(`energy ${e}${e ? ' squares a turn' : ' (no limit)'}`, { energy: e }, 'normal', 'normal', 500);
  T('the old 6 by 6, 6 turns alone', { cols: 6, rows: 6, minPath: 10, turns: 6, branch: 100 });
  T('branching 100%', { branch: 100 }); T('branching 30%', { branch: 30 }); T('7 turns alone', { turns: 7 }); T('9 turns alone', { turns: 9 });
  T('10 by 12, 10 turns alone', { cols: 10, rows: 12, minPath: 28, turns: 10 });
  T('one shared maze, a runner each', { boards: 'shared' }); T('one maze, one runner', { boards: 'one' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
