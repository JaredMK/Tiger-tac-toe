'use strict';
// Simulations: Brick Break. Slow, so never part of npm test:
// npm run sim -- bricks
// A square played out by two computer hands taking goes in turn: how many goes the winner needs (the balance target:
// about 4 to 6 of their own) and how often the first mover wins (under 60%); the hands' bricks a go.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/bricks/rules.js');
const M = require('../../src/games/bricks/meta.js');
E.setPhysics(require('../physics.js'));

const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
const mini = seed => E.newMini('bricks', E.makeRng('brk-sim-' + seed));
// One square: X goes first, the hands alternate until a wall is cleared. Returns { winner, goes: { X, O } }.
function race(seed, hands) {
  const m = mini(seed), rng = E.makeRng('race-' + seed);
  let p = 'X';
  for (let k = 0; k < 60; k++) {
    const r = E.applyMove(m, p, R.brkAi(m, p, rng, R.brkHand(m, hands[p])).move, rng);
    assert.equal(r.ok, true);
    if (r.outcome === 'win') return { winner: p, goes: { X: m.tries.X, O: m.tries.O } };
    p = p === 'X' ? 'O' : 'X';
  }
  return { winner: null, goes: { X: m.tries.X, O: m.tries.O } };
}
test('brick break: each hand\'s bricks a go, from a fresh wall and a half-broken one', () => {
  for (const level of ['easy', 'normal', 'hard']) {
    const fresh = [], half = [], secs = [];
    for (let s = 0; s < 80; s++) {
      const m = mini(s), r = R.brkAi(m, 'X', E.makeRng('g' + s), R.brkHand(m, level));
      fresh.push(r.move.n); secs.push(r.move.steps * R.BRK.step);
      const h = mini(s + 500); for (let k = 0; k < h.wall.X.length; k++) if (k % 2 === s % 2) h.wall.X[k] = 0;
      half.push(R.brkAi(h, 'X', E.makeRng('h' + s), R.brkHand(h, level)).move.n);
    }
    console.log(`  ${level}: ${avg(fresh).toFixed(2)} bricks a go from a fresh wall (${avg(secs).toFixed(1)} s a go), ${avg(half).toFixed(2)} from a half-broken one`);
  }
});
test('brick break: the winner takes about 4 to 6 goes and the first mover wins under 60% (Normal against Normal)', () => {
  const N = 600, goes = [], first = [];
  for (let s = 0; s < N; s++) { const r = race(s, { X: 'normal', O: 'normal' }); assert.ok(r.winner, 'someone clears the wall'); goes.push(r.goes[r.winner]); first.push(r.winner === 'X' ? 1 : 0); }
  const g = avg(goes), f = avg(first);
  console.log(`  normal v normal: the winner takes ${g.toFixed(2)} goes on average; the first mover wins ${(100 * f).toFixed(1)}%`);
  assert.ok(g >= 3.5 && g <= 6.5, `about 4-6 goes (${g.toFixed(2)})`);
  assert.ok(f < 0.6, `first mover under 60% (${(100 * f).toFixed(1)}%)`);
});
test('brick break: Hard beats Normal, Normal beats Easy', () => {
  const N = 150, hn = [], ne = [];
  for (let s = 0; s < N; s++) {
    hn.push(race(1000 + s, s % 2 ? { X: 'hard', O: 'normal' } : { X: 'normal', O: 'hard' }).winner === (s % 2 ? 'X' : 'O') ? 1 : 0);
    ne.push(race(2000 + s, s % 2 ? { X: 'normal', O: 'easy' } : { X: 'easy', O: 'normal' }).winner === (s % 2 ? 'X' : 'O') ? 1 : 0);
  }
  console.log(`  hard beats normal ${(100 * avg(hn)).toFixed(1)}%; normal beats easy ${(100 * avg(ne)).toFixed(1)}%`);
  assert.ok(avg(hn) > 0.6); assert.ok(avg(ne) > 0.6);
});
test('brick break: the tuned values are the defaults (meta.js TUNE)', () => {
  assert.deepEqual(Object.fromEntries(M.TUNE.map(f => [f.k, f.def])), E.tuneLive('bricks'));
});
