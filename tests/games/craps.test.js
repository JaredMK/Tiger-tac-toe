'use strict';
// Craps: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const die = n => (n - 1) / 6 + 0.01;                              // an rng value that makes randInt(rng, 6) roll n - 1
const dice = (...pairs) => seq(...pairs.flatMap(([a, b]) => [die(a), die(b)]));

/* ===================================== Craps ===================================== */
test('craps: the come-out roll wins on 7 or 11, loses on 2, 3 or 12; anything else is the point, made before a 7 to win', () => {
  const r = (...pairs) => E.crapsRound(dice(...pairs));
  assert.deepEqual(r([3, 4]), { rolls: [[3, 4]], point: null, result: 'win' }, '7 on the come-out');
  assert.deepEqual(r([5, 6]), { rolls: [[5, 6]], point: null, result: 'win' }, '11 on the come-out');
  for (const [a, b] of [[1, 1], [1, 2], [6, 6]]) assert.equal(r([a, b]).result, 'lose', `${a + b} on the come-out: craps`);
  const made = r([2, 2], [6, 5], [5, 1], [3, 1]);                   // point 4; 11 and 6 roll on; 4 made
  assert.deepEqual([made.point, made.result, made.rolls.length], [4, 'win', 4]);
  const out = r([4, 4], [6, 6], [2, 3], [4, 3]);                    // point 8; 12 and 5 roll on (no craps after the come-out); seven out
  assert.deepEqual([out.point, out.result, out.rolls.length], [8, 'lose', 4]);
  assert.equal(r([5, 5], [3, 4]).result, 'lose', 'point 10, then a 7');
  assert.equal(r([4, 2], [1, 1], [6, 5], [3, 3]).result, 'win', 'point 6: 2 and 11 mean nothing after the come-out');
});

test('craps: about 49% of rounds win (244 in 495) rolled to the end; first to 3 round wins; a loss takes nothing away; a move is one roll', () => {
  const rng = lcg(5); let w = 0, rolls = 0; const N = 100000;
  for (let k = 0; k < N; k++) { const x = E.crapsRound(rng); if (x.result === 'win') w++; rolls += x.rolls.length; }
  assert.ok(Math.abs(w / N - 244 / 495) < 0.006, `win odds ${(w / N).toFixed(4)} (wanted 0.4929)`);
  assert.ok(Math.abs(rolls / N - 3.376) < 0.05, `about 3.4 rolls a round (${(rolls / N).toFixed(2)})`);
  const m = E.newMini('craps', lcg(1));
  assert.deepEqual(m.wins, { X: 0, O: 0 }); assert.equal(m.point, null);
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([1, 1])), { ok: true, outcome: 'continue', note: 'lost' }, 'craps on the come-out');
  assert.deepEqual([m.wins.X, m.rounds.X], [0, 1], 'a loss: nothing taken away');
  assert.equal(E.applyMove(m, 'X', 'roll', dice([3, 4])).note, 'won'); assert.equal(m.wins.X, 1);
  assert.equal(E.applyMove(m, 'X', 'stop').ok, false, 'no Stop without a point');
  // a point: the roller chooses; a roll that is neither the point nor a 7: the choice again
  assert.deepEqual(E.applyMove(m, 'O', 'roll', dice([2, 2])), { ok: true, outcome: 'continue', note: 'point', again: true });
  assert.deepEqual([m.point, m.live], [4, 'O']);
  assert.equal(E.applyMove(m, 'X', 'roll', dice([2, 2])).reason, 'busy', 'the other player waits while O chooses');
  assert.deepEqual(E.applyMove(m, 'O', 'roll', dice([5, 4])), { ok: true, outcome: 'continue', note: 'stay', again: true });
  assert.deepEqual(m.rolls, [[2, 2], [5, 4]]);
  // Stop: the turn ends with the point on; X carries on the round: the point wins it for X
  assert.deepEqual(E.applyMove(m, 'O', 'stop'), { ok: true, outcome: 'continue', note: 'stop' });
  assert.deepEqual([m.point, m.live, m.last.kind], [4, null, 'stop']);
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([1, 3])), { ok: true, outcome: 'continue', note: 'won' }, 'X rolls O\'s point: X wins the round');
  assert.equal(m.last.inherited, true); assert.deepEqual([m.wins.X, m.wins.O, m.point], [2, 0, null]);
  // an inherited point and a 7: sevens out, nobody scores; the next roll is a come-out again
  E.applyMove(m, 'O', 'roll', dice([4, 4])); E.applyMove(m, 'O', 'stop');
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([3, 4])), { ok: true, outcome: 'continue', note: 'lost' }, 'a 7 on the inherited point: seven out');
  assert.deepEqual([m.wins.X, m.wins.O, m.point], [2, 0, null]);
  assert.deepEqual(E.applyMove(m, 'O', 'roll', dice([5, 6])), { ok: true, outcome: 'continue', note: 'won' }, 'the come-out again: 11 wins');
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([6, 1])), { ok: true, outcome: 'win', note: 'won' }, 'three rounds: the square');
  for (const bad of ['stand', 3, null]) assert.equal(E.applyMove(E.newMini('craps', lcg(2)), 'X', bad).ok, false);
  // in a match: a point keeps the roller in the square (again); Stop passes the turn
  const st = E.newMatch(lcg(3), { games: ['craps'] }), p0 = st.turn;
  E.playMove(st, 0, 'roll', dice([3, 3]));
  assert.deepEqual([st.flash.kind, st.flash.craps.result, st.flash.craps.point, st.flash.craps.sum], ['again', 'point', 6, 6]);
  assert.equal(E.playMs(st.flash), E.CRAPS.land + E.CRAPS.flash, 'Roll again or Stop as soon as the dice land, after a brief flash');
  assert.ok(E.CRAPS.land + E.CRAPS.flash <= 900, 'under a second, all told');
  E.endFlash(st); assert.equal(st.lock, 0, 'held in the square'); assert.equal(st.turn, p0);
  assert.equal(E.localBest(E.publicMini(st.squares[0].mini), p0, lcg(1)).move, 'roll', 'the computer rolls on');
  assert.equal(E.randomLegalMove(st.squares[0].mini, p0, lcg(1)), 'stop', 'a timeout mid-turn: Stop');
  E.playMove(st, 0, 'stop', lcg(9)); assert.equal(st.flash.craps.kind, 'stop'); assert.equal(E.playMs(st.flash), E.CRAPS.stop);
  E.endFlash(st); assert.equal(st.lock, null); assert.notEqual(st.turn, p0, 'the turn passes');
  assert.equal(E.randomLegalMove(st.squares[1].mini, 'X', lcg(1)), 'roll');
  assert.equal(E.secretOf(st.squares[1].mini), null, 'nothing hidden: the dice are rolled as the move is made');
});

test('craps: online, a timed-out roll that sets a point ends the turn there and then (a Stop), the point left on for whoever plays here next', () => {
  const st = E.newMatch(lcg(5), { games: ['craps'], mode: 'online', timer: 60 }), i = 4;
  for (let k = 0; k < 9; k++) if (k !== i) st.squares[k].mini = E.newMini('ttt', lcg(k));
  st.lock = i; st.turn = 'X'; st.timer.for = 'X'; st.timer.deadline = 1;
  let rec = E.matchRecord(st);
  const r = E.applyOnlineTimeout(rec, dice([3, 1]));               // a 4: the point
  assert.equal(r.ok, true); assert.equal(r.entries.length, 2, 'the roll, then the Stop');
  const full = E.fullState(r.rec), m = full.squares[i].mini;
  assert.equal(m.point, 4, 'the point stays on'); assert.equal(m.live, null, 'nobody mid-turn');
  assert.equal(full.lock, null, 'no bonus move after a timeout'); assert.equal(full.turn, 'O', 'the turn passes');
  assert.equal(r.entries[1].kind, 'move'); assert.equal(full.squares[i].mini.last.kind, 'stop');
  // a come-out roll that settles the round needs no Stop
  const st2 = E.newMatch(lcg(6), { games: ['craps'], mode: 'online', timer: 60 });
  for (let k = 0; k < 9; k++) if (k !== i) st2.squares[k].mini = E.newMini('ttt', lcg(k));
  st2.lock = i; st2.turn = 'X'; st2.timer.for = 'X'; st2.timer.deadline = 1;
  const r2 = E.applyOnlineTimeout(E.matchRecord(st2), dice([4, 3]));   // a 7: the round won
  assert.equal(r2.ok, true); assert.equal(r2.entries.length, 1);
  assert.equal(E.fullState(r2.rec).turn, 'O');
});
