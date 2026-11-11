'use strict';
// Shut the Box (November 2026): its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const A = require('../../src/games/shut/ai.js');
const R = require('../../src/games/shut/rules.js');

// A die that lands on the faces given, in turn (randInt(rng, 6) = floor(rng() * 6)).
const dice = (...faces) => { let k = 0; return () => (faces[k++ % faces.length] - 1 + 0.5) / 6; };
const fresh = () => E.newMini('shut', E.makeRng('shut-t'));

test('shut: each player their own box of tiles 1 to 6, all open; nothing hidden; the settings are dealt into the square', () => {
  const m = fresh();
  assert.deepEqual(m.up, { X: [true, true, true, true, true, true], O: [true, true, true, true, true, true] });
  assert.equal(m.roll, null);
  assert.deepEqual(Object.keys(E.publicMini(m)).sort(), ['roll', 'rolls', 'type', 'up']);
  E.setTune('shut', { tiles: 8, oneDie: 9 });
  try { const t = E.newMini('shut', E.makeRng('s2')); assert.equal(t.up.X.length, 8); assert.deepEqual(R.shutCfg(t), { tiles: 8, oneDie: 9 }); } finally { E.setTune('shut', null); }
  const meta = require('../../src/games/shut/meta.js');
  assert.deepEqual([meta.category, meta.release, meta.minVersion, meta.TUNE[0].k, meta.TUNE[0].def], ['luck', 'admin', '1.8.0', 'again', 'off']);
});

test('shut: Roll, then tiles that add up to it; the turn held between the two; the flip ends the turn (go again off)', () => {
  const m = fresh();
  assert.equal(E.applyMove(m, 'X', [3, 4], dice(1)).ok, false, 'no tiles before a roll');
  const r = E.applyMove(m, 'X', 'roll', dice(3, 4));
  assert.deepEqual([r.ok, r.note, r.again], [true, 'roll', true]);
  assert.deepEqual(m.roll, { by: 'X', d: [3, 4] });
  assert.equal(E.applyMove(m, 'X', 'roll', dice(1)).reason, 'rolled', 'one roll at a time');
  assert.equal(E.applyMove(m, 'X', [1, 2], dice(1)).reason, 'sum', 'they must add up to the roll');
  assert.equal(E.applyMove(m, 'X', [7], dice(1)).ok, false); assert.equal(E.applyMove(m, 'X', [3, 3, 1], dice(1)).ok, false, 'a tile once');
  const f = E.applyMove(m, 'X', [4, 1, 2], dice(1));
  assert.deepEqual([f.ok, f.outcome, f.note, !!f.again], [true, 'continue', 'flip', false]);
  assert.deepEqual(m.up.X, [false, false, true, false, true, true]); assert.equal(m.roll, null);
  assert.deepEqual(m.last, { by: 'X', kind: 'flip', d: [3, 4], tiles: [1, 2, 4] });
});

test('shut: a roll no tiles make ends the turn with no change; one die once the open tiles add up to 6 or less; the last tile shuts the box and wins', () => {
  const m = fresh();
  m.up.X = [false, false, false, false, false, true];             // only the 6 left: one die
  let r = E.applyMove(m, 'X', 'roll', dice(5));
  assert.deepEqual([r.ok, r.note, !!r.again, m.roll, m.last.d, m.last.none], [true, 'none', false, null, [5], true]);
  assert.deepEqual(m.up.X, [false, false, false, false, false, true], 'nothing changed');
  r = E.applyMove(m, 'X', 'roll', dice(6)); assert.equal(r.note, 'roll'); assert.deepEqual(m.roll.d, [6]);
  r = E.applyMove(m, 'X', [6], dice(1)); assert.deepEqual([r.outcome, r.note], ['win', 'shut']);
  const t = fresh(); t.up.O = [true, false, false, false, false, false];   // a 1 left: only a die of 1 makes it
  assert.equal(R.shutDice(t.up.O, R.shutCfg(t)), 1);
  assert.equal(R.shutDice(fresh().up.X, R.shutCfg(t)), 2);
});

test('shut: Go again on success: on, a flip keeps the turn (roll again); off by default', () => {
  E.setTune('shut', { again: 'on' });
  try {
    const m = E.newMini('shut', E.makeRng('ga'));
    E.applyMove(m, 'X', 'roll', dice(6, 6));
    const r = E.applyMove(m, 'X', [1, 5, 6], dice(1));
    assert.deepEqual([r.note, r.again], ['flip', true]);
  } finally { E.setTune('shut', null); }
});

test('shut: in a match the roll holds the turn to the square; a timeout with a roll waiting flips nothing and the turn passes, not a miss; the other player\'s roll left behind is cleared', () => {
  const st = E.newMatch(E.makeRng('sm'), { games: ['shut'] }), p = st.turn, i = 4;
  let r = E.playMove(st, i, 'roll', dice(2, 3));
  assert.ok(r.ok); assert.equal(st.flash.kind, 'again'); assert.equal(st.flash.shut.kind, 'roll'); assert.deepEqual(st.flash.shut.d, [2, 3]);
  E.endFlash(st);
  assert.equal(st.lock, i, 'held to the square'); assert.equal(st.turn, p);
  assert.equal(require('../../src/core/board.js').timeoutClose(st.squares[i].mini, p), 'drop');
  const t = E.timeoutMove(st, E.makeRng('to'));
  assert.ok(t.ok && t.closed, JSON.stringify(t));
  assert.equal(st.squares[i].mini.roll, null); assert.ok(st.squares[i].mini.up[p].every(Boolean), 'nothing flipped');
  // a roll left over (from an older record) for the other side: cleared by the next player's roll
  const m = fresh(); m.roll = { by: 'O', d: [1, 1] };
  assert.equal(E.applyMove(m, 'X', 'roll', dice(1, 2)).ok, true); assert.equal(m.roll.by, 'X');
  assert.ok(E.playMs({ kind: 'move', shut: { kind: 'flip', d: [3, 4], tiles: [3, 4] } }) >= 0);
});

test('shut: the computer: every level a legal move; Hard flips by the exact table; needs and q from it; quick', () => {
  const m = fresh(), t0 = performance.now();
  for (const level of ['easy', 'normal', 'hard']) {
    for (let k = 0; k < 30; k++) {
      const s = fresh(); s.up.X = s.up.X.map((_, j) => (k >> j & 1) === 0 || j === 5);
      const b0 = A.best(E.publicMini(s), 'X', E.makeRng('a' + k), {}, { level });
      assert.equal(b0.move, 'roll');
      E.applyMove(s, 'X', 'roll', E.makeRng('r' + k + level));
      if (!s.roll) continue;
      const b = A.best(E.publicMini(s), 'X', E.makeRng('b' + k), {}, { level });
      assert.ok(Array.isArray(b.move)); assert.equal(R.shutSum(b.move), R.shutSum(s.roll.d)); assert.ok(b.move.every(n => s.up.X[n - 1]));
    }
  }
  const t = A.shutTables(6, 6);
  assert.ok(t.V[63] > 7.5 && t.V[63] < 9, 'about 8 turns alone from a full box: ' + t.V[63].toFixed(2));
  assert.ok(A.needs(E.publicMini(m), 'X') > 7); assert.equal(A.needs(Object.assign(E.publicMini(m), { up: { X: [false, false, false, false, false, false], O: m.up.O } }), 'X'), 0);
  const last = fresh(); last.up.X = [false, false, false, true, false, false];
  assert.ok(Math.abs(A.best(E.publicMini(last), 'X', E.makeRng('q'), {}, { level: 'hard' }).q - 1 / 6) < 1e-9, 'q: a 4 on one die');
  assert.ok(performance.now() - t0 < 1500);
});

test('shut: whole squares between the computers end with a winner, each player about 3 to 6 turns', () => {
  let turns = 0, wins = 0;
  for (let g = 0; g < 300; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('shut', rng), n = { X: 0, O: 0 }; let p = 'X', start = true;
    for (let k = 0; k < 1000; k++) {
      if (start) { n[p]++; start = false; }
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok, r.reason);
      if (r.outcome === 'win') { wins++; turns += (n.X + n.O) / 2; break; }
      if (!r.again) { p = p === 'X' ? 'O' : 'X'; start = true; }
    }
  }
  assert.equal(wins, 300);
  assert.ok(turns / wins >= 3 && turns / wins <= 6, 'turns a player ' + (turns / wins).toFixed(2));
});
