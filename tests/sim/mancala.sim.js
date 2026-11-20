'use strict';
// Simulations: Mancala Race (slow, never part of npm test: `npm run sim -- mancala`). The computer against itself,
// 500 squares at Normal (the batch's standard), then by setting and by level, and the question the brief asked: does
// sowing onto the other side make it unfair? It does not: with crossing off (seeds past the bank go round the mover's
// own side) the first mover does better still (about 72% against 59% at the defaults) and the squares are shorter.
// What favours the first mover is the first move itself and the go-again; an even, level start made every game the
// same and gave the first mover every square, hence the uneven pits.
const test = require('node:test');
const assert = require('node:assert/strict');
const { duel, line } = require('./duel.js');

test('mancala: 500 squares at Normal: the first mover and the turns each (the defaults: 6 pits, 3 seeds a pit uneven, 10 to bank)', () => {
  const r = duel('mancala', 'normal', 'normal', 500);
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('mancala: by setting and by level; crossing on and off', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 4000) => console.log(line(label, duel('mancala', a, b, n, t)));
  T('the defaults, 4,000 squares', null);
  T('as asked: 4 pits of 3, level', { pits: 4, mix: 'off' }); T('as asked, uneven pits', { pits: 4 }); T('4 pits of 4, uneven', { pits: 4, seeds: 4 }); T('5 pits of 3', { pits: 5 });
  T('no go-again', { extra: 'off' }); T('no capture', { capture: 'off' }); T('12 to bank', { target: 12 });
  T('crossing off (6 pits)', { cross: 'off' }); T('crossing off (4 pits)', { cross: 'off', pits: 4 }); T('crossing off (4 pits of 4)', { cross: 'off', pits: 4, seeds: 4 });
  T('Hard v Hard', null, 'hard', 'hard', 500); T('Easy v Easy', null, 'easy', 'easy', 2000); T('Hard v Normal', null, 'hard', 'normal', 500); T('Normal v Hard', null, 'normal', 'hard', 500);
});
