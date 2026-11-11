'use strict';
// Ship, Captain & Crew (November 2026): its rules and computer, test by test (npm test). The engine is the one the
// page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/scc/rules.js');
const A = require('../../src/games/scc/ai.js');

// An rng that rolls the given dice faces in order (each 1-6), then anything.
const dice = (...faces) => { let k = 0; const any = E.makeRng('scc-any'); return () => (k < faces.length ? (faces[k++] - 1 + 0.5) / 6 : any()); };
const fresh = () => E.newMini('scc', E.makeRng('scc-t'));

test('scc: a ship, then a captain, then a crew, in that order only; one roll can set aside all three', () => {
  assert.deepEqual(R.sccTake(0, [5, 4, 2, 2, 1]).lv, 0, 'no 6: nothing, the 5 and 4 wait');
  assert.deepEqual(R.sccTake(0, [6, 4, 2, 2, 1]), { took: [0], lv: 1, cargo: null, rest: [4, 2, 2, 1] }, 'a 6 and a 4: only the ship');
  const all = R.sccTake(0, [4, 5, 3, 6, 2]);
  assert.deepEqual([all.lv, all.took, all.cargo], [3, [3, 1, 0], [3, 2]], 'all three at once, the other two the cargo');
  assert.deepEqual(R.sccTake(1, [5, 5, 4, 1]).took, [0, 2], 'from the ship: one captain, then the crew');
  const m = fresh();
  let r = E.applyMove(m, 'X', 'roll', dice(6, 1, 1, 2, 3));
  assert.deepEqual([r.ok, r.outcome, r.again, r.note], [true, 'continue', true, 'aside']);
  assert.deepEqual([m.turn.lv, m.turn.n, m.turn.dice.length], [1, 1, 4]);
  r = E.applyMove(m, 'X', 'roll', dice(4, 5, 3, 3));
  assert.deepEqual([m.turn.lv, m.turn.cargo], [3, [3, 3]]);
  assert.equal(r.note, 'crew');
});

test('scc: with all three in, the cargo can be rerolled with the rolls left, or kept; the last roll scores as it lies', () => {
  const m = fresh();
  E.applyMove(m, 'X', 'roll', dice(6, 5, 4, 1, 2));
  assert.deepEqual(m.turn.cargo, [1, 2]);
  assert.equal(E.applyMove(m, 'O', 'keep', dice()).ok, false, 'only the player whose turn it is');
  let r = E.applyMove(m, 'X', 'roll', dice(6, 6));
  assert.deepEqual([m.turn.cargo, m.turn.n, r.again], [[6, 6], 2, true], 'two dice rolled: the cargo replaced');
  r = E.applyMove(m, 'X', 'keep', dice());
  assert.deepEqual([r.outcome, r.note, !!r.again, m.score.X, m.turn, m.turns.X], ['continue', 'cargo', false, 12, null, 1]);
  // the third roll ends the turn
  const n = fresh();
  E.applyMove(n, 'O', 'roll', dice(6, 5, 4, 1, 1)); E.applyMove(n, 'O', 'roll', dice(2, 2));
  r = E.applyMove(n, 'O', 'roll', dice(5, 3));
  assert.deepEqual([r.outcome, n.score.O, n.turn, n.last.end, n.last.pts], ['continue', 8, null, true, 8]);
  assert.equal(E.applyMove(n, 'O', 'keep', dice()).ok, false, 'nothing to keep: the turn is over');
});

test('scc: without all three by the last roll, the turn scores 0; Keep needs the crew', () => {
  const m = fresh();
  E.applyMove(m, 'X', 'roll', dice(6, 1, 1, 1, 1));
  assert.equal(E.applyMove(m, 'X', 'keep', dice()).reason, 'nocrew');
  E.applyMove(m, 'X', 'roll', dice(5, 1, 1, 1));
  const r = E.applyMove(m, 'X', 'roll', dice(3, 3, 3));
  assert.deepEqual([r.note, m.score.X, m.last.pts, m.last.lv, m.turns.X], ['sunk', 0, 0, 2, 1]);
  assert.equal(E.applyMove(m, 'X', 'roll', dice(1, 1, 1, 1, 1)).ok, true, 'a new turn');
});

test('scc: the target wins the square; "Go again on success" keeps the turn after a score; a timeout ends the turn as it stands', () => {
  const m = fresh(); m.score.X = R.sccCfg(m).target - 5;
  E.applyMove(m, 'X', 'roll', dice(6, 5, 4, 2, 3));
  assert.deepEqual(E.applyMove(m, 'X', 'keep', dice()), { ok: true, outcome: 'win', note: 'cargo' });
  E.setTune('scc', { again: 'on' });
  try {
    const g = E.newMini('scc', E.makeRng('ga'));
    E.applyMove(g, 'X', 'roll', dice(6, 5, 4, 2, 3));
    assert.equal(E.applyMove(g, 'X', 'keep', dice()).again, true, 'a score: the same player goes again');
    E.applyMove(g, 'X', 'roll', dice(1, 1, 1, 1, 1)); E.applyMove(g, 'X', 'roll', dice(1, 1, 1, 1, 1));
    assert.ok(!E.applyMove(g, 'X', 'roll', dice(1, 1, 1, 1, 1)).again, 'nothing scored: the turn passes');
  } finally { E.setTune('scc', null); }
  // the timeout: through the board
  const st = E.newMatch(E.makeRng('scc-to'), { games: ['scc'] }); st.turn = 'X';
  const sq = st.squares[4]; sq.mini = fresh();
  assert.ok(E.playMove(st, 4, 'roll', dice(6, 5, 4, 3, 3)).ok); E.endFlash(st);
  assert.equal(st.lock, 4, 'the turn is held to the square');
  assert.equal(R.timeoutClose(sq.mini, 'X'), 'stop'); assert.equal(R.timeoutClose(sq.mini, 'O'), null);
  const to = E.timeoutMove(st, E.makeRng('x'));
  assert.ok(to.closed, 'the turn ended as it stood'); assert.equal(sq.mini.score.X, 6, 'the cargo counted');
  const z = fresh(); E.applyMove(z, 'O', 'roll', dice(6, 1, 1, 1, 1));
  assert.deepEqual([E.applyMove(z, 'O', 'stop', dice()).ok, z.score.O, z.turn], [true, 0, null], 'without the crew: 0');
});

test('scc: the computer: Normal keeps 8 or more, Easy 6 or more, both what reaches the target; Hard by the race; every move legal', () => {
  const pm = (score, turn) => Object.assign(E.publicMini(fresh()), { score, turn });
  const t = c => ({ by: 'X', n: 1, lv: 3, dice: c, cargo: c });
  assert.equal(A.best(pm({ X: 0, O: 0 }, t([4, 4])), 'X', E.makeRng('a'), {}, { level: 'normal' }).move, 'keep');
  assert.equal(A.best(pm({ X: 0, O: 0 }, t([3, 4])), 'X', E.makeRng('a'), {}, { level: 'normal' }).move, 'roll');
  assert.equal(A.best(pm({ X: 0, O: 0 }, t([3, 3])), 'X', E.makeRng('a'), {}, { level: 'easy' }).move, 'keep');
  assert.equal(A.best(pm({ X: 19, O: 0 }, t([1, 2])), 'X', E.makeRng('a'), {}, { level: 'normal' }).move, 'keep', '3 reaches 22');
  assert.equal(A.best(pm({ X: 19, O: 0 }, t([1, 2])), 'X', E.makeRng('a'), {}, { level: 'hard' }).move, 'keep');
  assert.equal(A.best(pm({ X: 0, O: 0 }, null), 'X', E.makeRng('a'), {}, { level: 'hard' }).move, 'roll');
  // Hard: 10 short with one roll left, a cargo of 9 still needs a whole turn with the crew: it rolls for 10 or more (Normal keeps)
  const n1 = { by: 'X', n: 2, lv: 3, dice: [4, 5], cargo: [4, 5] };
  assert.equal(A.best(pm({ X: 12, O: 10 }, n1), 'X', E.makeRng('a'), {}, { level: 'hard' }).move, 'roll');
  assert.equal(A.best(pm({ X: 12, O: 10 }, n1), 'X', E.makeRng('a'), {}, { level: 'normal' }).move, 'keep');
  const { V } = A.sccRace(22, 3, false);
  assert.ok(V[22][22] > 0.5 && V[22][22] < 0.62, 'the first to roll a little ahead: ' + V[22][22].toFixed(3));
  assert.ok(V[1][22] > 0.4 && V[22][1] < V[1][22]);
  assert.ok(A.needs(pm({ X: 0, O: 0 }, null), 'X') > 3 && A.needs(pm({ X: 20, O: 0 }, null), 'X') >= 1);
});

test('scc: whole squares between the computers end with a winner, each move legal; the flash and the public view carry the move', () => {
  let wins = 0;
  for (let g = 0; g < 60; g++) {
    const rng = E.makeRng('scc-w' + g), m = E.newMini('scc', rng); let p = 'X';
    for (let k = 0; k < 600; k++) {
      const lv = ['easy', 'normal', 'hard'][g % 3], b = E.localBest(E.publicMini(m), p, rng, {}, { level: lv, until: null });
      const r = E.applyMove(m, p, b.move, rng);
      assert.ok(r.ok, r.reason);
      if (r.outcome === 'win') { wins++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(wins, 60);
  const st = E.newMatch(E.makeRng('scc-f'), { games: ['scc'] }); st.turn = 'X';
  st.squares[0].mini = fresh();
  E.playMove(st, 0, 'roll', dice(6, 5, 2, 2, 1));
  const f = st.flash.scc;
  assert.deepEqual([f.kind, f.lv0, f.lv, f.took, f.rolled, f.n, f.end], ['roll', 0, 2, [0, 1], [6, 5, 2, 2, 1], 1, false]);
  assert.ok(E.playMs(st.flash) >= R.sccTimes(f).end);
  assert.deepEqual(Object.keys(E.publicMini(st.squares[0].mini)).sort(), ['last', 'score', 'turn', 'turns', 'type', 'v']);
});
