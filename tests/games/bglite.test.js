'use strict';
// Backgammon Lite: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/bglite/rules.js');
const A = require('../../src/games/bglite/ai.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const fixed = v => () => v;                                     // an rng that always says v (randInt(r, 6) = floor(6v): 0.4 -> 2 -> a 3)
const mini = seed => E.newMini('bglite', E.makeRng(seed || 'bgl'));
// A square laid out by hand: positions (progress, each side's own count) and the dice in play for p.
function laid(pos, p, v) {
  const m = mini();
  m.pos = { X: pos.X.slice(), O: pos.O.slice() }; m.rolled = true;
  m.dice = p ? { by: p, v: v.slice(), used: [false, !v[1]], off: 0 } : null;
  return m;
}

test('bglite: a fresh square: an 8-point track, three pieces each at their start, no dice; Roll first, and the opening roll is one die', () => {
  const m = mini();
  assert.equal(m.n, 8); assert.deepEqual(m.pos, { X: [0, 0, 0], O: [0, 0, 0] }); assert.equal(m.dice, null);
  for (const bad of [{ d: 0, k: 0 }, 'bank', null, 3, { d: 2, k: 0 }]) assert.equal(E.applyMove(mini(), 'X', bad, lcg(1)).ok, false);
  const r = E.applyMove(m, 'X', 'roll', lcg(2));
  assert.deepEqual([r.ok, r.outcome, r.again], [true, 'continue', true]);
  assert.equal(m.dice.v[1], 0, 'the opening roll: one die'); assert.deepEqual(m.dice.used, [false, true]);
  assert.equal(E.applyMove(m, 'X', 'roll', lcg(2)).ok, false, 'dice to use first');
  const r2 = E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(3));
  assert.ok(r2.ok); assert.notEqual(r2.again, true, 'its one die used: the turn ends');
  assert.equal(m.dice, null);
  E.applyMove(m, 'O', 'roll', lcg(4)); assert.ok(m.dice.v[0] >= 1 && m.dice.v[1] >= 1, 'every later roll: two dice');
  E.setTune('bglite', { len: 11, openOne: 'off' });
  try { const t = mini('t'); assert.equal(t.n, 11); E.applyMove(t, 'X', 'roll', lcg(5)); assert.ok(t.dice.v[1] >= 1, 'the setting off: two dice from the start'); } finally { E.setTune('bglite', null); }
});

test('bglite: X travels left to right and O right to left; both dice on one piece is fine; a lone enemy piece is hit back to its start', () => {
  const n = 8, m = laid({ X: [1, 0, 0], O: [n + 1 - 3, 0, 0] }, 'X', [2, 4]);   // X on point 1, O on point 3 (its progress 6)
  assert.equal(R.bglPoint('X', 3, n), 3); assert.equal(R.bglPoint('O', 6, n), 3);
  const r = E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(1));
  assert.deepEqual([r.ok, r.note, r.again], [true, 'hit', true]);
  assert.deepEqual(m.pos.X, [3, 0, 0]); assert.deepEqual(m.pos.O, [0, 0, 0], 'O\'s piece back at its start');
  assert.deepEqual(m.last.hit, { k: 0, from: 6 });
  const r2 = E.applyMove(m, 'X', { d: 1, k: 0 }, lcg(1));   // the same piece takes the other die too
  assert.ok(r2.ok); assert.deepEqual(m.pos.X, [7, 0, 0]); assert.equal(m.dice, null, 'both dice used: the turn ends');
  // O enters from the right: its progress 2 is point n - 1
  const o = laid({ X: [0, 0, 0], O: [0, 0, 0] }, 'O', [2, 5]);
  E.applyMove(o, 'O', { d: 0, k: 1 }, lcg(1)); assert.equal(R.bglPoint('O', o.pos.O[1], n), n - 1);
});

test('bglite: a point holding two of a side blocks the other; a die nobody can use is lost; with neither usable the roll passes the turn', () => {
  const n = 8, m = laid({ X: [1, 0, 0], O: [n + 1 - 3, n + 1 - 3, 0] }, 'X', [2, 6]);   // O's two on point 3
  assert.equal(R.bglCan(m, 'X', 0, 2), false, 'blocked'); assert.equal(R.bglCan(m, 'X', 1, 2), true, 'entering with a 2 lands on point 2: open');
  assert.equal(E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(1)).ok, false);
  // every X piece can only take 3s, and point 3 is blocked: a roll of 3 and 3 has no move
  const s = laid({ X: [0, 0, 0], O: [n + 1 - 3, n + 1 - 3, 0] }, null);
  const r = E.applyMove(s, 'X', 'roll', fixed(0.4));
  assert.deepEqual([r.ok, r.note, r.again, s.dice, s.last.stuck], [true, 'stuck', undefined, null, true]);
  // the first die used, the second has no move: lost, the turn ends
  const l = laid({ X: [0, n + 1, n + 1], O: [n + 1 - 5, n + 1 - 5, 0] }, 'X', [3, 2]);   // X's last piece: a 3 to point 3, then a 2 onto O's block on 5
  const r2 = E.applyMove(l, 'X', { d: 0, k: 0 }, lcg(1));
  assert.ok(r2.ok); assert.equal(r2.again, undefined); assert.equal(l.last.lost, true); assert.equal(l.dice, null);
});

test('bglite: a piece leaves the board past the end (any overshoot); the last one off wins; with Go again on, a turn that bore one off rolls again', () => {
  const n = 8, m = laid({ X: [7, 3, n + 1], O: [0, 0, 0] }, 'X', [6, 1]);
  const r = E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(1));
  assert.ok(r.ok); assert.equal(m.pos.X[0], n + 1, 'off'); assert.equal(m.last.off, true);
  E.applyMove(m, 'X', { d: 1, k: 1 }, lcg(1));
  const w = laid({ X: [n, n + 1, n + 1], O: [0, 0, 0] }, 'X', [1, 4]);
  assert.deepEqual(E.applyMove(w, 'X', { d: 0, k: 0 }, lcg(1)).outcome, 'win');
  E.setTune('bglite', { again: 'on' });
  try {
    const g = laid({ X: [7, 1, 0], O: [0, 0, 0] }, 'X', [5, 1]); g.tune = { again: 'on' };
    E.applyMove(g, 'X', { d: 0, k: 0 }, lcg(1));
    const r2 = E.applyMove(g, 'X', { d: 1, k: 1 }, lcg(1));
    assert.deepEqual([r2.note, r2.again, g.dice], ['off', true, null], 'a piece off this turn: roll again');
  } finally { E.setTune('bglite', null); }
  const g2 = laid({ X: [7, 1, 0], O: [0, 0, 0] }, 'X', [5, 1]);
  E.applyMove(g2, 'X', { d: 0, k: 0 }, lcg(1));
  assert.equal(E.applyMove(g2, 'X', { d: 1, k: 1 }, lcg(1)).again, undefined, 'off by default: the turn ends');
});

test('bglite: dice left behind by a timeout are nobody\'s: the other player rolls fresh; the public view carries everything (nothing is hidden)', () => {
  const m = laid({ X: [1, 0, 0], O: [0, 0, 0] }, 'X', [3, 4]);
  assert.equal(R.bglMoves(m, 'O').length, 0, 'not O\'s dice');
  assert.equal(E.applyMove(m, 'O', { d: 0, k: 0 }, lcg(1)).ok, false);
  assert.ok(E.applyMove(m, 'O', 'roll', lcg(2)).ok); assert.equal(m.dice.by, 'O');
  const pm = E.publicMini(m);
  assert.deepEqual(Object.keys(pm).sort(), ['dice', 'n', 'pos', 'rolled', 'type', 'v']);
  assert.equal(E.randomLegalMove(laid({ X: [0, 0, 0], O: [0, 0, 0] }, null), 'X', lcg(1)), 'roll');
});

test('bglite: the computer: only legal steps at every level; Normal hits a lone piece in reach; Hard within its time; needs and q', () => {
  const n = 8, m = laid({ X: [1, 0, 0], O: [n + 1 - 3, 0, 0] }, 'X', [2, 6]);
  const pm = E.publicMini(m);
  const b = E.localBest(pm, 'X', lcg(1), {}, { level: 'normal' });
  assert.deepEqual(b.move, { d: 0, k: 0 }, 'the 2 hits the lone O on point 3');
  for (const level of ['easy', 'normal', 'hard']) {
    for (let g = 0; g < 6; g++) {
      const rng = E.makeRng('ai' + level + g), s = mini('sq' + g); let p = 'X';
      for (let k = 0; k < 400; k++) {
        const t0 = performance.now(), t1 = t0 + 300;
        const mv = E.localBest(E.publicMini(s), p, rng, {}, { level, until: () => t1 - performance.now() }).move;
        if (level === 'hard') assert.ok(performance.now() - t0 < 600, 'Hard keeps to its time');
        const r = E.applyMove(s, p, mv, rng);
        assert.ok(r.ok, `${level}: ${JSON.stringify(mv)} (${r.reason})`);
        if (r.outcome === 'win') break;
        if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
    }
  }
  const fresh = E.publicMini(mini());
  assert.ok(A.needs(fresh, 'X') > 3 && A.needs(fresh, 'X') < 6);
  const near = E.publicMini(laid({ X: [n, n + 1, n + 1], O: [0, 0, 0] }, null));
  assert.equal(A.needs(near, 'X'), 1); assert.equal(E.localBest(near, 'X', lcg(1)).q, 1, 'any roll takes the last piece off');
});

test('bglite: whole squares between the computers end with a winner, in about 3 to 6 turns a player', () => {
  let turns = 0, games = 0;
  for (let g = 0; g < 150; g++) {
    const rng = E.makeRng('whole' + g), m = mini('w' + g); let p = 'X'; const tn = { X: 1, O: 0 };
    let won = null;
    for (let k = 0; k < 800 && !won; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok);
      if (r.outcome === 'win') won = p;
      else if (!r.again) { p = p === 'X' ? 'O' : 'X'; tn[p]++; }
    }
    assert.ok(won, 'a winner'); turns += tn.X + tn.O; games++;
  }
  const avg = turns / games / 2;
  assert.ok(avg >= 3 && avg <= 6, `turns a player ${avg.toFixed(2)}`);
});
