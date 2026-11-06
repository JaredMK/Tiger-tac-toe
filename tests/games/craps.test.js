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

test('craps: about 49% of rounds win (244 in 495) rolled to the end; one tap of Roll rolls the whole round; first to 3 round wins; a loss takes nothing away', () => {
  const rng = lcg(5); let w = 0, rolls = 0; const N = 100000;
  for (let k = 0; k < N; k++) { const x = E.crapsRound(rng); if (x.result === 'win') w++; rolls += x.rolls.length; }
  assert.ok(Math.abs(w / N - 244 / 495) < 0.006, `win odds ${(w / N).toFixed(4)} (wanted 0.4929)`);
  assert.ok(Math.abs(rolls / N - 3.376) < 0.05, `about 3.4 rolls a round (${(rolls / N).toFixed(2)})`);
  const m = E.newMini('craps', lcg(1));
  assert.deepEqual(m.wins, { X: 0, O: 0 }); assert.equal(m.point, null);
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([1, 1])), { ok: true, outcome: 'continue', note: 'lost' }, 'craps on the come-out');
  assert.deepEqual([m.wins.X, m.rounds.X], [0, 1], 'a loss: nothing taken away');
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([3, 4])), { ok: true, outcome: 'continue', note: 'won', again: true }, 'a round won: the same player rolls again (a hot streak)'); assert.equal(m.wins.X, 1);
  // a point: the dice keep rolling (no choice to make) until the point or a 7
  assert.deepEqual(E.applyMove(m, 'O', 'roll', dice([2, 2], [5, 4], [6, 6], [1, 3])), { ok: true, outcome: 'continue', note: 'won', again: true }, 'point 4, 9 and 12 roll on, 4 made');
  assert.deepEqual([m.last.point, m.last.rolls.length, m.point, m.live, m.wins.O], [4, 4, null, null, 1], 'the round over in the one move: nothing left on');
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([4, 4], [3, 4])), { ok: true, outcome: 'continue', note: 'lost' }, 'point 8, seven out');
  assert.equal(E.applyMove(m, 'X', 'stop').ok, false, 'no Stop any more');
  assert.deepEqual(E.applyMove(m, 'O', 'roll', dice([5, 6])), { ok: true, outcome: 'continue', note: 'won', again: true }, 'the come-out again: 11 wins');
  E.applyMove(m, 'X', 'roll', dice([6, 1]));
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([6, 1])), { ok: true, outcome: 'win', note: 'won' }, 'three rounds: the square');
  for (const bad of ['stand', 'stop', 3, null]) assert.equal(E.applyMove(E.newMini('craps', lcg(2)), 'X', bad).ok, false);
  // a square from before with a point still on: the next roll rolls that round out
  const old = E.newMini('craps', lcg(4)); old.point = 6; old.live = null; old.rolls = [[3, 3]];
  assert.equal(E.applyMove(old, 'O', 'roll', dice([2, 3], [3, 3])).note, 'won', 'the point on from before, made');
  assert.deepEqual([old.last.was, old.point], [6, null]);
  // in a match: one move, the round played back roll by roll; a round won keeps the turn, a round lost passes it
  const st = E.newMatch(lcg(3), { games: ['craps'] }), p0 = st.turn;
  E.playMove(st, 0, 'roll', dice([3, 3], [2, 2], [4, 2]));
  assert.deepEqual([st.flash.kind, st.flash.craps.result, st.flash.craps.point, st.flash.craps.rolls.length], ['again', 'win', 6, 3]);
  const tim = E.crapsTimes(st.flash.craps.rolls, 6, null);
  assert.deepEqual(tim.at, [0, E.CRAPS.roll + E.CRAPS.puck, 2 * E.CRAPS.roll + E.CRAPS.puck], 'each roll in its turn, the puck after the come-out');
  assert.equal(E.playMs(st.flash), tim.end + E.CRAPS.pip, 'the round plays out (a round won: its pip filling in), then the result');
  E.endFlash(st); assert.deepEqual([st.lock, st.turn, st.screen, st.zoom], [0, p0, 'mini', 0], 'a round won: the same player rolls a new round');
  assert.equal(E.playMove(st, 1, 'roll', dice([3, 4])).reason, 'locked', 'held to the square');
  E.playMove(st, 0, 'roll', dice([1, 1]));
  assert.deepEqual([st.flash.kind, st.flash.craps.result], ['move', 'lose']);
  E.endFlash(st); assert.equal(st.lock, null); assert.notEqual(st.turn, p0, 'a round lost: the turn passes');
  assert.equal(E.localBest(E.publicMini(st.squares[0].mini), st.turn, lcg(1)).move, 'roll', 'the computer rolls');
  assert.equal(E.secretOf(st.squares[1].mini), null, 'nothing hidden: the dice are rolled as the move is made');
});

test('craps: online, a timed-out turn rolls nothing; the turn passes', () => {
  const st = E.newMatch(lcg(5), { games: ['craps'], mode: 'online', timer: 60 }), i = 4;
  for (let k = 0; k < 9; k++) if (k !== i) st.squares[k].mini = E.newMini('ttt', lcg(k));
  st.turn = 'X'; st.timer.for = 'X'; st.timer.deadline = 1;
  for (let k = 0; k < 9; k++) if (k !== i) st.squares[k].owner = k % 2 ? 'X' : 'O';
  st.squares[0].owner = null; st.squares[0].mini = E.newMini('craps', lcg(7));
  const r = E.applyOnlineTimeout(E.matchRecord(st), dice([3, 1], [6, 6], [2, 2]));
  assert.deepEqual([r.ok, r.entries, r.missed], [true, [], 'X'], 'nothing rolled: no entry');
  const full = E.fullState(r.rec);
  assert.deepEqual([full.squares[0].mini.last, full.lock, full.turn], [null, null, 'O']);
});

test('craps: the admin\'s rounds to win are dealt into the square and played by', () => {
  E.setTune('craps', { goal: 2 });
  const m = E.newMini('craps', E.makeRng('cr-tune'));
  E.setTune('craps', null);
  assert.deepEqual(m.tune, { goal: 2 });
  const rng = E.makeRng('cr-play');
  let r;
  for (let k = 0; k < 100 && m.wins.X < 2; k++) r = E.applyMove(m, 'X', 'roll', rng);
  assert.equal(m.wins.X, 2); assert.equal(r.outcome, 'win', 'two rounds won takes it');
});

test('craps: the Hard computer has no choice to make (Roll rolls the round out): the same as the usual one', () => {
  const A = require('../../src/games/craps/ai.js'), ctx = { level: 'hard', until: null };
  for (const wins of [0, 1, 2]) {
    const m = E.newMini('craps', lcg(1)); m.wins.X = wins;
    const pm = E.publicMini(m), t0 = performance.now(), h = A.best(pm, 'X', lcg(1), {}, ctx);
    assert.ok(performance.now() - t0 < 60);
    assert.deepEqual(h, A.best(pm, 'X', lcg(1), {}, {})); assert.equal(h.move, 'roll');
  }
});

test('craps: a hot streak: a round won keeps the turn (online too, the match clock held while it plays), a round lost passes it, the square won ends it', () => {
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'craps']));
  const rec0 = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 'm5+0' }, lcg(3), 'hs');
  E.armClock(rec0.state, [], 1000);
  const p = rec0.state.turn, o = p === 'X' ? 'O' : 'X', dl0 = E.clockDeadline(rec0.state.timer);
  let r = E.applyOnlineMove(rec0, p, 4, 'roll', dice([3, 4]));
  assert.deepEqual([r.ok, r.entries[0].kind, r.entries[0].by, r.rec.state.turn, r.rec.state.lock], [true, 'again', p, p, 4], 'a round won: the same player again, held to the square');
  assert.equal(E.holdClock(r.rec.state, r.entries), true);
  assert.equal(r.rec.state.timer.deadline, dl0 + E.replayMs(r.entries), 'the clock stands still while the round plays out');
  assert.equal(E.applyOnlineMove(r.rec, o, 4, 'roll', dice([3, 4])).reason, 'turn', 'not the other player\'s turn');
  assert.equal(E.applyOnlineMove(r.rec, p, 3, 'roll', dice([3, 4])).reason, 'locked', 'only in this square');
  r = E.applyOnlineMove(r.rec, p, 4, 'roll', dice([2, 2], [2, 2]));
  assert.deepEqual([r.entries[0].kind, r.rec.state.turn, E.fullState(r.rec).squares[4].mini.wins[p]], ['again', p, 2], 'point 4 made: still going');
  r = E.applyOnlineMove(r.rec, p, 4, 'roll', dice([5, 6]));
  assert.deepEqual([r.entries[0].kind, r.rec.state.squares[4].owner, r.rec.state.turn, r.rec.state.lock], ['claim', p, o, null], 'the third round won: the square, and the turn passes');
  // a round lost passes the turn
  const st = E.newMatch(lcg(4), { games: ['craps'] }), q = st.turn;
  E.playMove(st, 0, 'roll', dice([5, 6])); assert.equal(st.flash.kind, 'again'); E.endFlash(st);
  assert.equal(st.squares[0].mv[q], 1, 'one turn spent there, however long the streak');
  E.playMove(st, 0, 'roll', dice([4, 4], [3, 4])); assert.deepEqual([st.flash.kind, st.flash.craps.result], ['move', 'lose']);
  E.endFlash(st); assert.deepEqual([st.lock, st.turn, st.squares[0].mv[q]], [null, q === 'X' ? 'O' : 'X', 1]);
});

test('craps: a timed-out player owed a new round after a win rolls nothing; the turn passes, not a miss; Super Chaos rolls one round a round', () => {
  const games = Object.fromEntries(E.TYPES.map(g => [g, g === 'craps']));
  const rec0 = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: 30 }, lcg(5), 'hs2');
  const p = rec0.state.turn;
  const r = E.applyOnlineMove(rec0, p, 2, 'roll', dice([6, 1]));
  assert.equal(r.rec.state.lock, 2);
  const t = E.applyOnlineTimeout(r.rec, dice([3, 4]));
  const full = E.fullState(t.rec);
  assert.deepEqual([t.ok, t.entries, full.turn, full.lock, full.timer.miss.kind, full.timer.streak[p]], [true, [], p === 'X' ? 'O' : 'X', null, 'ended', 0], 'nothing rolled for them');
  assert.deepEqual([full.squares[2].mini.wins[p], full.squares[2].mini.rounds[p]], [1, 1]);
  const R = require('../../src/games/craps/rules.js'), m = E.newMini('craps', lcg(1));
  assert.deepEqual(R.scApply(m, 'X', 'roll', dice([3, 4])), { ok: true, outcome: 'continue', note: 'won' }, 'Super Chaos: a round won is the round\'s move (no streak)');
});
