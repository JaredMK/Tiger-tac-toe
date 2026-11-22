'use strict';
// Simulations: Castle Smash (slow, never part of npm test: `npm run sim -- castle`). The computer against itself, 500
// squares at Normal (the batch's standard), a hand shooting alone at 300 castles (every one must fall), then by setting
// and by level. The computer's aim and power errors stand in for a finger on the drag: real play decides the castle's
// strength, and every number here is a setting (meta.js TUNE).
// The two castles of a square are the same and each is shot at by one player alone, so a square is two hands racing
// at the same job: the first to move wins whenever the two need the same number of throws (about one square in seven),
// which is all of the first mover's edge.
// December 2026, the defaults (4 layers, a stone cracked at a punch of 4.5 and crumbling at its second hard hit, timber
// broken at 5, the crystal at 5.5, the boulder 1.5 heavy at up to 600 units a second): see the numbers this prints.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const { duel, line } = require('./duel.js');

test('castle: 500 squares at Normal: the first mover and the turns each (the defaults)', () => {
  const r = duel('castle', 'normal', 'normal', 500, null, { cap: 400 });
  console.log(line('Normal v Normal', r));
  assert.equal(r.open, 0); assert.ok(r.first >= 0.45 && r.first <= 0.6, `first mover ${r.first}`);
  assert.ok(r.each >= 3 && r.each <= 6, `mean turns ${r.each}`); assert.ok(r.eachMed >= 3 && r.eachMed <= 6, `median turns ${r.eachMed}`);
});
test('castle: a hand alone: every one of 300 castles falls, never at the first throw as a rule', () => {
  const need = [];
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('castle-alone:' + g), m = E.newMini('castle', rng), level = ['normal', 'normal', 'easy', 'hard'][g % 4];
    let won = 0;
    for (let k = 1; k <= 80 && !won; k++) { const r = E.applyMove(m, 'X', E.localBest(E.publicMini(m, 'X'), 'X', rng, {}, { level, until: null }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') won = k; }
    assert.ok(won, `castle ${g} (${level}) still stands after 80 throws`);
    need.push(won);
  }
  const mean = need.reduce((a, b) => a + b, 0) / need.length, first = need.filter(n => n === 1).length, two = need.filter(n => n <= 2).length;
  console.log(`  alone: ${mean.toFixed(2)} throws to smash a castle (the most ${Math.max(...need)}); at the first throw ${(100 * first / need.length).toFixed(1)}%, within two ${(100 * two / need.length).toFixed(1)}%`);
  assert.ok(first / need.length <= 0.04, `first-throw wins ${first}`); assert.ok(Math.max(...need) <= 60);
});
test('castle: by setting and by level', () => {
  const T = (label, t, a = 'normal', b = 'normal', n = 150) => console.log(line(label, duel('castle', a, b, n, t, { cap: 400 })));
  T('3 layers', { layers: 3 }); T('5 layers', { layers: 5 });
  T('stone crumbles at its first hard hit', { stoneHits: 1 }); T('stone takes three', { stoneHits: 3 });
  T('softer stone (3.5)', { stoneTough: 35 }); T('harder stone (6)', { stoneTough: 60 }); T('tougher timber (8)', { woodTough: 80 }); T('a softer crystal (3.5)', { coreTough: 35 });
  T('a heavier boulder (150%)', { weight: 150 }); T('a lighter boulder (70%)', { weight: 70 }); T('heavier stone (150%)', { stone: 150 });
  T('a looser hand (70 mrad, 7%)', { aiAim: 70, aiPow: 7 }); T('Go again on success', { again: 'on' });
  T('Hard v Hard', null, 'hard', 'hard'); T('Easy v Easy', null, 'easy', 'easy'); T('Hard v Normal', null, 'hard', 'normal'); T('Normal v Hard', null, 'normal', 'hard');
});
