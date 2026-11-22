'use strict';
// Simulations: Fruit Reels (slow, never part of npm test: `npm run sim -- reels`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting. v 2 (December 2026): a 3x3 window scored on five lines, no
// hold, so every level spins alike. Defaults 3/4/6 a line, 10 to win: 4,000 squares a median 4.5 spins each, first
// mover 53.9% (target 8: 4.5, 57%; 12: 5, 57%; 2/3/5 to 10: 6, 56%).
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('reels: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('reels', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('reels: by setting', () => {
  const T = (label, t) => console.log(line(label, duel('reels', 'normal', 'normal', 4000, t)));
  T('the defaults, 4,000 squares', null);
  T('target 8', { target: 8 }); T('target 12', { target: 12 }); T('2/3/5 a line', { tri1: 2, tri2: 3, tri3: 5 }); T('star weight 2', { w4: 2 }); T('stars score, no outright win', { stars: 'off' });
});
