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
// A square laid out by hand: positions (progress, each side's own count) and the dice in play for p (v: a v 1 square, from before the rework).
function laid(pos, p, v, ver) {
  const m = mini();
  m.pos = { X: pos.X.slice(), O: pos.O.slice() }; m.rolled = true; if (ver) m.v = ver;
  m.dice = p ? { by: p, v: v.slice(), used: v.map(x => !x), off: 0 } : null;
  return m;
}

test('bglite: a fresh square: an 8-point track, three pieces each on their own first point, no dice; Roll first, and the opening roll is one die', () => {
  const m = mini();
  assert.equal(m.n, 8); assert.equal(m.v, 2); assert.deepEqual(m.pos, { X: [1, 1, 1], O: [1, 1, 1] }); assert.equal(m.dice, null);
  assert.equal(R.bglPoint('X', 1, 8), 1); assert.equal(R.bglPoint('O', 1, 8), 8, "O's first point is the rightmost");
  for (const bad of [{ d: 0, k: 0 }, 'bank', null, 3, { d: 4, k: 0 }]) assert.equal(E.applyMove(mini(), 'X', bad, lcg(1)).ok, false);
  const r = E.applyMove(m, 'X', 'roll', lcg(2));
  assert.deepEqual([r.ok, r.outcome, r.again], [true, 'continue', true]);
  assert.equal(m.dice.v[1], 0, 'the opening roll: one die'); assert.deepEqual(m.dice.used, [false, true]);
  assert.equal(E.applyMove(m, 'X', 'roll', lcg(2)).ok, false, 'dice to use first');
  const r2 = E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(3));
  assert.ok(r2.ok); assert.notEqual(r2.again, true, 'its one die used: the turn ends');
  assert.equal(m.dice, null);
  E.applyMove(m, 'O', 'roll', lcg(4)); assert.ok(m.dice.v[0] >= 1 && m.dice.v[1] >= 1, 'every later roll: two dice (or four)');
  E.setTune('bglite', { len: 11, openOne: 'off' });
  try { const t = mini('t'); assert.equal(t.n, 11); E.applyMove(t, 'X', 'roll', lcg(5)); assert.ok(t.dice.v[1] >= 1, 'the setting off: two dice from the start'); } finally { E.setTune('bglite', null); }
});

test('bglite: X travels left to right and O right to left; both dice on one piece is fine; a lone enemy piece is hit back to its start point; a lone piece on its own start point is never hit', () => {
  const n = 8, m = laid({ X: [1, 1, 1], O: [n + 1 - 3, 1, 1] }, 'X', [2, 4]);   // X on point 1, an O on point 3 (its progress 6)
  assert.equal(R.bglPoint('X', 3, n), 3); assert.equal(R.bglPoint('O', 6, n), 3);
  const r = E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(1));
  assert.deepEqual([r.ok, r.note, r.again], [true, 'hit', true]);
  assert.deepEqual(m.pos.X, [3, 1, 1]); assert.deepEqual(m.pos.O, [1, 1, 1], "O's piece back on its start point");
  assert.deepEqual(m.last.hit, { k: 0, from: 6 });
  const r2 = E.applyMove(m, 'X', { d: 1, k: 0 }, lcg(1));   // the same piece takes the other die too
  assert.ok(r2.ok); assert.deepEqual(m.pos.X, [7, 1, 1]); assert.equal(m.dice, null, 'both dice used: the turn ends');
  // O's last lone piece on its own start point (point 8): an X landing there shares it, no hit
  const h = laid({ X: [6, 6, 6], O: [1, n + 1, n + 1] }, 'X', [2, 1]);
  assert.equal(R.bglCan(h, 'X', 0, 2), true);
  const r3 = E.applyMove(h, 'X', { d: 0, k: 0 }, lcg(1));
  assert.ok(r3.ok); assert.equal(h.last.hit, null); assert.deepEqual(h.pos.O, [1, n + 1, n + 1]);
});

test('bglite: a point holding two of a side blocks the other (the three on a start point too); a die nobody can use is lost; with none usable the roll passes the turn', () => {
  const n = 8, m = laid({ X: [1, 1, 1], O: [n + 1 - 3, n + 1 - 3, 1] }, 'X', [2, 6]);   // O's two on point 3
  assert.equal(R.bglCan(m, 'X', 0, 2), false, 'blocked');
  assert.equal(E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(1)).ok, false);
  assert.equal(R.bglCan(laid({ X: [3, 1, 1], O: [1, 1, 1] }, 'X', [5, 1]), 'X', 0, 5), false, "O's three on its start point (point 8) block it");
  // a double 2: four moves of 2, every one onto O's block on point 3: no move
  const s = laid({ X: [1, 1, 1], O: [n + 1 - 3, n + 1 - 3, 1] }, null);
  const r = E.applyMove(s, 'X', 'roll', fixed(0.2));                // randInt(6) = 1: a double 2, four moves of 2, every one onto the block
  assert.deepEqual([r.ok, r.note, r.again, s.dice, s.last.stuck], [true, 'stuck', undefined, null, true]);
  assert.equal(s.last.v.length, 4, 'a double: four dice');
  // the first die used, the second has no move: lost, the turn ends
  const l = laid({ X: [7, n + 1, n + 1], O: [n + 1 - 5, n + 1 - 5, 1] }, 'X', [1, 2]);   // X: a 1 to point 8, then nothing (the 2 would bear off: fine)... so block the 2 another way
  const l2 = laid({ X: [1, n + 1, n + 1], O: [n + 1 - 5, n + 1 - 5, 1] }, 'X', [3, 2]);   // X's last piece: a 3 to point 4, then a 2 onto O's block on 6? (point 6 = O progress 3)
  l2.pos.O = [n + 1 - 6, n + 1 - 6, 1];
  const r2 = E.applyMove(l2, 'X', { d: 0, k: 0 }, lcg(1));
  assert.ok(r2.ok); assert.equal(r2.again, undefined); assert.equal(l2.last.lost, true); assert.equal(l2.dice, null);
});

test('bglite: home zone: a piece bears off past the end (any overshoot) only once all of its side\'s pieces on the board stand in the last `home` points; the last one off wins; Go again on rolls again after one off', () => {
  const n = 8, H = R.bglHome(mini());
  assert.equal(H, 3, 'home: the last 3 points by default');
  const m = laid({ X: [5, 8, n + 1], O: [1, 1, 1] }, 'X', [1, 2]);   // the piece on 5 is outside the home zone (6..8)
  assert.equal(R.bglCan(m, 'X', 1, 2), false, 'not yet: a piece still outside the home zone');
  assert.equal(E.applyMove(m, 'X', { d: 1, k: 1 }, lcg(1)).ok, false);
  assert.ok(E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(1)).ok);      // 5 -> 6: everyone home
  assert.equal(R.bglCan(m, 'X', 1, 2), true);
  E.applyMove(m, 'X', { d: 1, k: 1 }, lcg(1)); assert.equal(m.pos.X[1], n + 1, 'off'); assert.equal(m.last.off, true);
  const w = laid({ X: [n, n + 1, n + 1], O: [1, 1, 1] }, 'X', [1, 4]);
  assert.deepEqual(E.applyMove(w, 'X', { d: 0, k: 0 }, lcg(1)).outcome, 'win');
  E.setTune('bglite', { home: 5 });
  try { const t = mini('h5'); t.pos.X = [4, 8, 8]; t.rolled = true; t.dice = { by: 'X', v: [2, 3], used: [false, false], off: 0 }; assert.equal(R.bglCan(t, 'X', 1, 3), true, 'home 5: points 4 to 8'); } finally { E.setTune('bglite', null); }
  E.setTune('bglite', { again: 'on' });
  try {
    const g = laid({ X: [7, 6, n + 1], O: [1, 1, 1] }, 'X', [5, 1]); g.tune = { again: 'on' };
    E.applyMove(g, 'X', { d: 0, k: 0 }, lcg(1));
    const r2 = E.applyMove(g, 'X', { d: 1, k: 1 }, lcg(1));
    assert.deepEqual([r2.note, r2.again, g.dice], ['off', true, null], 'a piece off this turn: roll again');
  } finally { E.setTune('bglite', null); }
  const g2 = laid({ X: [7, 6, n + 1], O: [1, 1, 1] }, 'X', [5, 1]);
  E.applyMove(g2, 'X', { d: 0, k: 0 }, lcg(1));
  assert.equal(E.applyMove(g2, 'X', { d: 1, k: 1 }, lcg(1)).again, undefined, 'off by default: the turn ends');
});

test('bglite: a double gives four moves of its number; what is left of it with no move is lost', () => {
  const m = laid({ X: [1, 1, 1], O: [1, 1, 1] }, null);
  const r = E.applyMove(m, 'X', 'roll', fixed(0.4));             // randInt(6) = 2: a double 3
  assert.ok(r.ok); assert.deepEqual(m.dice.v, [3, 3, 3, 3]); assert.deepEqual(m.dice.used, [false, false, false, false]);
  let steps = 0;
  while (m.dice) { const ms = R.bglMoves(m, 'X'); assert.equal(new Set(ms.map(x => x.d)).size, 1, 'dice alike: one offered at a time'); E.applyMove(m, 'X', ms[0], lcg(1)); steps++; }
  assert.equal(steps, 4, 'four moves'); assert.equal(m.pos.X.reduce((a, b) => a + b, 0), 3 + 12);
  // one move of the double used, the rest blocked: lost
  const b = laid({ X: [1, 9, 9], O: [8 + 1 - 7, 8 + 1 - 7, 1] }, 'X', [3, 3, 3, 3]);   // O's two on point 7: X's last piece 1 -> 4, then 4 -> 7 is blocked
  E.applyMove(b, 'X', { d: 0, k: 0 }, lcg(1));
  assert.equal(b.dice, null); assert.equal(b.last.lost, true, 'the rest of the double lost');
});

test('bglite: a square dealt before the rework (v 1) plays on under its rules: pieces waiting off the board enter with a die, a hit goes back off the board, a double is two moves, no home zone', () => {
  const n = 8, m = laid({ X: [0, 0, 7], O: [n + 1 - 3, 0, 0] }, 'X', [3, 3], 1);
  m.v = 1;
  assert.equal(R.bglCan(m, 'X', 2, 3), true, 'off past the end with pieces still waiting: no home zone');
  const r = E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(1));
  assert.ok(r.ok); assert.equal(m.last.hit.from, 6); assert.deepEqual(m.pos.O, [0, 0, 0], 'back off the board');
  const o = laid({ X: [0, 0, 0], O: [0, 0, 0] }, null, null, 1); o.v = 1;
  E.applyMove(o, 'X', 'roll', fixed(0.4)); E.applyMove(o, 'O', 'roll', fixed(0.4));
  assert.equal(o.dice.v.length, 2, 'a double: two moves');
});

test('bglite: dice left behind by a timeout are nobody\'s: the other player rolls fresh; the public view carries everything (nothing is hidden)', () => {
  const m = laid({ X: [1, 1, 1], O: [1, 1, 1] }, 'X', [3, 4]);
  assert.equal(R.bglMoves(m, 'O').length, 0, 'not O\'s dice');
  assert.equal(E.applyMove(m, 'O', { d: 0, k: 0 }, lcg(1)).ok, false);
  assert.ok(E.applyMove(m, 'O', 'roll', lcg(2)).ok); assert.equal(m.dice.by, 'O');
  const pm = E.publicMini(m);
  assert.deepEqual(Object.keys(pm).sort(), ['dice', 'n', 'pos', 'rolled', 'type', 'v']);
  assert.equal(E.randomLegalMove(laid({ X: [1, 1, 1], O: [1, 1, 1] }, null), 'X', lcg(1)), 'roll');
});

test('bglite: the computer: only legal whole turns at every level; Normal hits a lone piece in reach; Hard within its time; needs and q', () => {
  const n = 8, m = laid({ X: [1, 1, 1], O: [n + 1 - 3, 1, 1] }, 'X', [2, 6]);
  const pm = E.publicMini(m);
  const b = E.localBest(pm, 'X', lcg(1), {}, { level: 'normal' });
  assert.ok(Array.isArray(b.move.steps) && b.move.steps.length === 2, 'the whole turn as one move');
  assert.deepEqual(b.move.steps[0], [0, 0], 'the 2 hits the lone O on point 3 first');
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
  const near = E.publicMini(laid({ X: [n, n + 1, n + 1], O: [1, 1, 1] }, null));
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

test('bglite: once every piece is home, a roll that reaches the last point bears the piece off (no exact roll needed); before that it just lands there', () => {
  const R = require('../../src/games/bglite/rules.js');
  const m = E.newMini('bglite', E.makeRng('reach')), n = m.n;
  m.pos.X = [n - 2, n - 1, n]; m.pos.O = [1, 1, 1];
  assert.equal(R.bglCanOff(m, 'X'), true);
  assert.equal(R.bglTo(m, 'X', n - 2, 2), n + 1, 'reaching the last point: off');
  assert.equal(R.bglTo(m, 'X', n - 2, 5), n + 1, 'passing it: off');
  m.pos.X = [2, n - 1, n];
  assert.equal(R.bglCanOff(m, 'X'), false);
  assert.equal(R.bglTo(m, 'X', n - 1, 1), n, 'not all home: it lands on the last point');
});

test('bglite: a turn is one move: its steps checked one by one from the position, the turn played out; the flash carries every step', () => {
  const n = 8, m = laid({ X: [1, 1, 1], O: [n + 1 - 3, 1, 1] }, 'X', [2, 4]);   // an O alone on point 3
  const r = E.applyMove(m, 'X', { steps: [[0, 2], [1, 2]] }, lcg(1));
  assert.deepEqual([r.ok, r.outcome, r.note, r.again], [true, 'continue', 'hit', undefined]);
  assert.deepEqual(m.pos.X, [1, 1, 7]); assert.deepEqual(m.pos.O, [1, 1, 1]); assert.equal(m.dice, null, 'the turn is over');
  assert.equal(m.last.kind, 'turn'); assert.deepEqual(m.last.steps.map(s => [s.d, s.k, s.from, s.to]), [[0, 2, 1, 3], [1, 2, 3, 7]]);
  assert.deepEqual(m.last.steps[0].hit, { k: 0, from: 6 }); assert.deepEqual(m.last.used0, [false, false]); assert.deepEqual(m.last.lost, []);
  const f = {}; R.moveFlash(null, 'X', null, null, m, f); assert.equal(f.bgl.steps.length, 2);
  assert.ok(R.flashMs(f) > 2 * R.BGLT.slide, 'the flash plays each step in turn');
  // the other order, the 4 first: legal as well, and no hit
  const m2 = laid({ X: [1, 1, 1], O: [n + 1 - 3, 1, 1] }, 'X', [2, 4]);
  assert.ok(E.applyMove(m2, 'X', { steps: [[1, 0], [0, 0]] }, lcg(1)).ok); assert.deepEqual(m2.pos.X, [7, 1, 1]); assert.deepEqual(m2.pos.O, [6, 1, 1]);
});

test('bglite: a turn refused leaves the square as it was: a step not legal where it stands, a die used twice, a die left that could still move, a malformed move', () => {
  const n = 8, base = () => laid({ X: [1, 1, 1], O: [n + 1 - 3, n + 1 - 3, 1] }, 'X', [2, 6]);   // O's two on point 3 block the 2 from point 1
  const bad = [
    { steps: [[0, 0], [1, 0]] },              // the 2 onto the block
    { steps: [[1, 0], [1, 1]] },              // the 6 twice
    { steps: [] }, { steps: [[1]] }, { steps: [[1, 3]] }, { steps: [[5, 0]] }, { steps: 'x' }, { steps: [[1, 0], [0, 0], [0, 0], [0, 0], [0, 0]] },
  ];
  for (const mv of bad) {
    const m = base(), before = JSON.stringify([m.pos, m.dice]);
    const r = E.applyMove(m, 'X', mv, lcg(1));
    assert.equal(r.ok, false, JSON.stringify(mv)); assert.equal(JSON.stringify([m.pos, m.dice]), before, 'untouched: ' + JSON.stringify(mv));
  }
  const ok = base();
  assert.ok(E.applyMove(ok, 'X', { steps: [[1, 0]] }, lcg(1)).ok, 'the 6 alone: the 2 has no move by then (blocked from point 1, and point 7 is not home yet): lost');
  assert.deepEqual(ok.last.lost, [0]);
  const open = laid({ X: [1, 1, 1], O: [1, 1, 1] }, 'X', [3, 4]), was = JSON.stringify([open.pos, open.dice]);
  assert.equal(E.applyMove(open, 'X', { steps: [[0, 0]] }, lcg(1)).ok, false, 'the 4 could still move: the turn is not played out');
  assert.equal(JSON.stringify([open.pos, open.dice]), was);
});

test('bglite: a die no piece can use by the end is lost (listed in the flash); with every piece off the turn ends at once; the opponent\'s turn cannot be sent', () => {
  const n = 8, l = laid({ X: [1, n + 1, n + 1], O: [n + 1 - 6, n + 1 - 6, 1] }, 'X', [3, 2]);   // X's last piece: a 3 to point 4, then the 2 onto O's block on point 6
  const r = E.applyMove(l, 'X', { steps: [[0, 0]] }, lcg(1));
  assert.ok(r.ok, r.reason); assert.deepEqual(l.last.lost, [1]); assert.equal(l.dice, null);
  const w = laid({ X: [n, n + 1, n + 1], O: [1, 1, 1] }, 'X', [1, 4]);
  assert.deepEqual(E.applyMove(w, 'X', { steps: [[0, 0]] }, lcg(1)).outcome, 'win', 'the last piece off: won, the other die not needed');
  assert.equal(E.applyMove(laid({ X: [n, n + 1, n + 1], O: [1, 1, 1] }, 'X', [1, 4]), 'X', { steps: [[0, 0], [1, 0]] }, lcg(1)).ok, false, 'no step after the last piece is off');
  assert.equal(E.applyMove(laid({ X: [1, 1, 1], O: [1, 1, 1] }, 'X', [3, 4]), 'O', { steps: [[0, 0], [1, 0]] }, lcg(1)).ok, false, "not O's dice");
});

test('bglite: a random move is a whole legal turn; an older client\'s single step still plays on a turn under way', () => {
  for (let g = 0; g < 40; g++) {
    const rng = E.makeRng('rand' + g), m = mini('r' + g); let p = 'X';
    for (let k = 0; k < 200; k++) {
      const mv = E.randomLegalMove(m, p, rng);
      const r = E.applyMove(m, p, mv, rng);
      assert.ok(r.ok, JSON.stringify(mv));
      if (mv !== 'roll') assert.ok(Array.isArray(mv.steps));
      if (r.outcome === 'win') break;
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  const m = laid({ X: [1, 1, 1], O: [1, 1, 1] }, 'X', [3, 4]);
  const r = E.applyMove(m, 'X', { d: 0, k: 0 }, lcg(1));
  assert.deepEqual([r.ok, r.again], [true, true]); assert.equal(m.last.kind, 'use');
  assert.ok(E.applyMove(m, 'X', { steps: [[1, 1]] }, lcg(1)).ok, 'the rest of the turn as a whole turn');
  assert.equal(m.dice, null);
});

// ----- the rules audit (November 2026): each rule and its edges, on the engine the page, the computer and the server share -----
const turn = (m, p, steps) => E.applyMove(m, p, { steps }, lcg(9));
test('bglite audit: each side moves its own way (X rightwards, O leftwards: board points)', () => {
  const n = 8, m = laid({ X: [2, 1, 1], O: [2, 1, 1] }, 'X', [3, 1]);
  assert.ok(turn(m, 'X', [[0, 0], [1, 0]]).ok);
  assert.equal(R.bglPoint('X', m.pos.X[0], n), 6, 'X: point 2 + 3 + 1 = point 6');
  const o = laid({ X: [1, 1, 1], O: [2, 1, 1] }, 'O', [3, 1]);
  assert.ok(turn(o, 'O', [[0, 0], [1, 0]]).ok);
  assert.equal(R.bglPoint('O', o.pos.O[0], n), 3, 'O: point 7 - 3 - 1 = point 3');
});
test('bglite audit: each die once, a double four times; a die used twice or a fifth step is refused', () => {
  let m = laid({ X: [1, 1, 1], O: [1, 1, 1] }, 'X', [2, 3]);
  assert.equal(turn(m, 'X', [[0, 0], [0, 1]]).ok, false, 'the same die twice');
  assert.ok(turn(m, 'X', [[0, 0], [1, 1]]).ok);
  m = laid({ X: [1, 1, 1], O: [1, 1, 1] }, 'X', R.bglRollDice(mini(), 1, 1));
  assert.deepEqual(m.dice.v, [1, 1, 1, 1], 'a double: four moves');
  assert.equal(turn(m, 'X', [[0, 0], [1, 0], [2, 0]]).ok, false, 'three of a double\'s four, the fourth still playable: not played out');
  assert.ok(turn(m, 'X', [[0, 0], [1, 0], [2, 0], [3, 1]]).ok);
  assert.equal(E.applyMove(laid({ X: [1, 1, 1], O: [1, 1, 1] }, 'X', [1, 1, 1, 1]), 'X', { steps: [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1]] }, lcg(1)).ok, false, 'never a fifth');
});
test('bglite audit: a point holding 2 or more enemy pieces is closed; one enemy piece is hit back to its start', () => {
  const n = 8;
  let m = laid({ X: [1, 1, 1], O: [6, 6, 1] }, 'X', [2, 5]);       // two O on point 3 (O's progress 6)
  assert.equal(R.bglCan(m, 'X', 0, 2), false, 'the block');
  assert.equal(turn(m, 'X', [[0, 0], [1, 0]]).ok, false);
  m = laid({ X: [1, 1, 1], O: [6, 1, 1] }, 'X', [2, 5]);           // one O on point 3
  assert.ok(turn(m, 'X', [[0, 0], [1, 1]]).ok);
  assert.equal(m.pos.O[0], 1, 'hit: back to its own start point'); assert.equal(R.bglPoint('X', m.pos.X[0], n), 3);
  m = laid({ X: [1, 1, 1], O: [1, 7, 7] }, 'X', [1, 3]);           // two O on point 2: X's 1 is closed, the 3 jumps it
  assert.ok(turn(m, 'X', [[1, 0], [0, 0]]).ok, 'the 3 first, then the 1 from point 4');
  assert.equal(R.bglPoint('X', m.pos.X[0], n), 5);
});
test('bglite audit: bearing off only once every piece is in the home zone, and then with any roll that reaches or passes the end', () => {
  let m = laid({ X: [6, 7, 2], O: [4, 9, 9] }, 'X', [3, 1]);       // a piece out of home (progress 2): no piece may bear off (O's start point left open)
  assert.equal(R.bglCan(m, 'X', 1, 3), false, 'progress 7 + 3 passes the end, but a piece is still out of home');
  assert.equal(R.bglCan(m, 'X', 0, 2), true, 'progress 6 + 2 = 8: lands on the last point while one is out');
  m = laid({ X: [6, 7, 9], O: [1, 1, 1] }, 'X', [2, 5]);           // all home or off
  assert.equal(R.bglTo(m, 'X', 6, 2), 9, 'exactly the last point: off'); assert.equal(R.bglTo(m, 'X', 7, 5), 9, 'past it: off');
  const r = turn(m, 'X', [[0, 0], [1, 1]]);
  assert.ok(r.ok); assert.equal(r.outcome, 'win', 'all three off');
});
test('bglite audit: both dice must be used whenever some order allows it', () => {
  const n = 8;
  // X's one piece on the board at progress 1 (two off), dice 6 and 1: the 6 first lands on 7, then the 1 on 8 (the last
  // point: bearing off needs every piece home); the 1 first to 2 leaves the 6 blocked by two O on X's 8? set O there.
  let m = laid({ X: [1, 9, 9], O: [2, 2, 1] }, 'X', [1, 6]);     // two O on point 7 (O's progress 2): X's 6 from 1 lands on 7: closed
  assert.equal(R.bglCan(m, 'X', 0, 6), false);
  // the 1 first (to 2), then the 6 (to 8: two pieces off, this one home only once it stands there: it lands on 8)
  assert.equal(R.bglMaxUse(m, 'X'), 2, 'the 1 then the 6: both used');
  assert.deepEqual(R.bglPlayable(m, 'X').map(s => m.dice.v[s.d]), [1], 'only the 1 may go first');
  // a case where a first move kills the second die: X pieces at 1 and 1, O block on X's point 4 (O progress 5, two pieces)
  m = laid({ X: [1, 1, 9], O: [5, 5, 1] }, 'X', [3, 2]);
  // the 3 to point 4: closed. The 2 to point 3, then the 3 from 3 to 6: both used. The 2 then the 3 on the other piece (1 -> 4): closed.
  assert.equal(R.bglMaxUse(m, 'X'), 2);
  assert.equal(turn(laid({ X: [1, 1, 9], O: [5, 5, 1] }, 'X', [3, 2]), 'X', [[1, 0]]).ok, false, 'the 2 alone, the 3 still playable after it: refused');
  assert.ok(turn(laid({ X: [1, 1, 9], O: [5, 5, 1] }, 'X', [3, 2]), 'X', [[1, 0], [0, 0]]).ok);
  // a step that would leave the other die unusable while another order uses both: dice 4 and 2, X at progress 1 and 4 (one
  // off), two O on X's point 7 (O progress 2): the 2 on the piece at 4 (to 6), then the 4 on the piece at 1 (to 5): both. The
  // 4 on the piece at 1 first (to 5) then the 2 on the 5 (to 7: closed) or on the 4 (to 6): both too. The 4 on the piece at
  // 4 (to 8, the last point: not every piece home) then the 2: the piece at 1 to 3: both. Every order uses both here.
  m = laid({ X: [1, 4, 9], O: [2, 2, 1] }, 'X', [4, 2]);
  assert.equal(R.bglMaxUse(m, 'X'), 2);
  assert.equal(R.bglPlayable(m, 'X').length, R.bglMoves(m, 'X').length, 'no step loses a die');
  // no die usable at all: double 1s, X's last piece at progress 2, two O on X's point 3 (O progress 6): the roll is lost.
  m = laid({ X: [2, 9, 9], O: [6, 6, 1] }, 'X', [1, 1, 1, 1]);
  assert.equal(R.bglMaxUse(m, 'X'), 0);
  void n;
});
test('bglite audit: a step that leaves the other die unusable is refused when another order uses both, and the computer, the random mover and the replays never play one', () => {
  // X at progress 5 (two off), dice 3 and 1, O pieces: two on X's point 7 (O progress 2). The 3 first: 5 -> 8 (the last
  // point; every piece home -> off: the win). Bearing off with a die counts as every die used: fine.
  // The constructed trap: X at 1 and 1 (one off), two O on X's point 5 (O progress 4), dice 4 and 1. The 4 first on either
  // piece lands on 5: closed. The 1 first (1 -> 2), then the 4 (2 -> 6): both. So the 1 must come first.
  const m = laid({ X: [1, 1, 9], O: [4, 4, 1] }, 'X', [4, 1]);
  assert.deepEqual(R.bglPlayable(m, 'X').map(s => m.dice.v[s.d]), [1]);
  // A position where the 1 first kills the 4: X at 4 alone (two off), O blocks on X's 6 (O 3, two) and nothing else:
  // the 1 first (4 -> 5), then the 4 (5 -> 9: off? every piece home: progress 5 is not home (home is 6..8): lands... 9 > 8
  // with a piece out of home: not allowed) -> the 4 is lost; the 4 first (4 -> 8: the last point, not home before the
  // move -> lands on 8), then the 1 (8 -> off: home now): both. So only the 4 may go first.
  const t = laid({ X: [4, 9, 9], O: [3, 3, 1] }, 'X', [4, 1]);
  assert.equal(R.bglMaxUse(t, 'X'), 2);
  assert.deepEqual(R.bglPlayable(t, 'X').map(s => t.dice.v[s.d]), [4], 'the 1 first would lose the 4');
  assert.equal(E.applyMove(laid({ X: [4, 9, 9], O: [3, 3, 1] }, 'X', [4, 1]), 'X', { steps: [[1, 0]] }, lcg(1)).ok, false, 'the server refuses it');
  assert.equal(E.applyMove(laid({ X: [4, 9, 9], O: [3, 3, 1] }, 'X', [4, 1]), 'X', { d: 1, k: 0 }, lcg(1)).ok, false, 'an older client\'s single step too');
  const ok = E.applyMove(laid({ X: [4, 9, 9], O: [3, 3, 1] }, 'X', [4, 1]), 'X', { steps: [[0, 0], [1, 0]] }, lcg(1));
  assert.ok(ok.ok); assert.equal(ok.outcome, 'win');
  for (const level of ['easy', 'normal', 'hard']) {
    const b = A.best(laid({ X: [4, 9, 9], O: [3, 3, 1] }, 'X', [4, 1]), 'X', lcg(3), null, { level, until: null });
    assert.deepEqual(b.move.steps.map(s => s[0]), [0, 1], `${level}: the 4 first`);
  }
  for (let s = 0; s < 20; s++) assert.deepEqual(R.randomMove(laid({ X: [4, 9, 9], O: [3, 3, 1] }, 'X', [4, 1]), 'X', lcg(s)).steps.map(x => x[0]), [0, 1], 'the random mover too');
});
test('bglite audit: the turn ends once no legal move remains; a roll no die can use ends it at once', () => {
  const m = laid({ X: [2, 9, 9], O: [6, 6, 1] }, null, []);
  m.pos.O = [6, 6, 1];                                               // two O on X's point 3 (O progress 6)
  const r = E.applyMove(m, 'X', 'roll', fixed(1 / 6 + 0.01));        // a double of 2s: 2 -> 4? (point 4 open) ... use a closed roll below
  assert.ok(r.ok);
  const s = laid({ X: [2, 9, 9], O: [6, 6, 1] }, 'X', [1, 1, 1, 1]); // 1s: point 3 closed, nothing else on the board
  assert.equal(R.bglMoves(s, 'X').length, 0, 'no legal step');
  const t = laid({ X: [1, 1, 1], O: [1, 1, 1] }, 'X', [2, 3]);
  const done = turn(t, 'X', [[0, 0], [1, 1]]);
  assert.ok(done.ok); assert.equal(t.dice, null, 'both used: the turn is over'); assert.notEqual(done.again, true);
});
test('bglite audit: thousands of random turns from random positions: every turn the computer, the random mover and the draft make is one the server takes, and it uses as many dice as can be used', () => {
  const r = lcg(77);
  let n = 0;
  for (let g = 0; g < 60; g++) {
    const m = mini('a' + g);
    for (let t = 0, p = 'X'; t < 80; t++, p = R.bglOther(p)) {
      E.applyMove(m, p, 'roll', r);
      if (!m.dice) continue;
      const max = R.bglMaxUse(m, p), b = A.best(m, p, r, null, { level: ['easy', 'normal', 'hard'][t % 3], until: () => 0 });
      const c = JSON.parse(JSON.stringify(m)), res = E.applyMove(c, p, b.move, r);
      assert.ok(res.ok, 'the computer\'s turn is legal');
      const won = c.pos[p].every(a => a > c.n);
      assert.ok(won || b.move.steps.length === max, `as many dice as can be used (${b.move.steps.length} of ${max})`);
      const rm = R.randomMove(m, p, r);
      assert.ok(E.applyMove(JSON.parse(JSON.stringify(m)), p, rm, r).ok, 'the random mover\'s too');
      E.applyMove(m, p, b.move, r); n++;
      if (m.pos.X.every(a => a > m.n) || m.pos.O.every(a => a > m.n)) break;
    }
  }
  assert.ok(n > 200, String(n));
});
