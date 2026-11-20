'use strict';
// Simulations: Mahjong (slow, never part of npm test: `npm run sim -- mahjong`). The computer against itself, 500
// squares at Normal (the batch's standard), then by setting and by level.
// As it was asked for (one free pair a move, first to 6 pairs, nothing else) every move clears exactly one pair, so
// whoever moves first always wins: 100% (the second line below). The chain (a pair that uncovers a tile keeps the turn)
// gives turns different lengths, and equal turns (the second player may answer; level is a draw) takes the first
// mover's edge away: 50% of the squares decided, at the price of about two squares in five ending level and resetting.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('mahjong: 500 squares at Normal (the defaults: clear all 12 pairs, chain and equal turns on): first mover and turns each, and the draws', () => {
  const r = duel('mahjong', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
  assert.ok(r.draws < 0.45, `draws ${r.draws}`);
});
test('mahjong: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 3000) => console.log(line(label, duel('mahjong', a, b, n, t)));
  T('as asked: 6 of 9 pairs, no chain, no equal turns', { goal: 6, pairs: 9, chain: 'off', even: 'off' });
  T('the chain alone: 6 of 9', { goal: 6, pairs: 9, even: 'off' }); T('the chain alone: all 12', { even: 'off' });
  T('chain and equal turns: 6 of 9', { goal: 6, pairs: 9 }); T('8 of 9', { goal: 8, pairs: 9 }); T('10 of 12', { goal: 10 }); T('all 10', { goal: 10, pairs: 10 }); T('all 8', { goal: 8, pairs: 8 });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
