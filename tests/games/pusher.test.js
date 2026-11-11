'use strict';
// Coin Pusher (November 2026; reworked the same month: a live machine and a dropper to time): its rules and computer,
// test by test (npm test). The engine is the one the page and the server run: a move is its taps, worked out the same
// on the mover's phone (live), on the server (the result kept) and on the other phone (from the flash).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/pusher/rules.js');
const A = require('../../src/games/pusher/ai.js');

const fresh = s => E.newMini('pusher', E.makeRng('psh-' + s));
const clone = v => JSON.parse(JSON.stringify(v));
const mv = (k, ph = 0, dp = 0) => ({ ph, dp, k });

test('pusher: each player their own machine, alike at the start, its coins in whole units, a public seed; the settings are the admin\'s', () => {
  const m = fresh('a'), c = E.tuneLive('pusher');
  assert.equal(c.target, 12); assert.equal(c.perMove, 3); assert.equal(c.again, 'off'); assert.equal(c.maxSecs, 8);
  assert.equal(m.coins.X.length, c.start); assert.deepEqual(m.coins.X, m.coins.O); assert.equal(m.v, 2); assert.ok(Number.isInteger(m.seed));
  assert.ok(m.coins.X.every(a => Number.isInteger(a[0]) && Number.isInteger(a[1])));
  assert.deepEqual(m.score, { X: 0, O: 0 });
  // a move: ph and dp in thousandths, three steps from 0, each later than the one before, the last within the time limit
  for (const bad of [mv([0, 10]), mv([1, 10, 20]), mv([0, 10, 10]), mv([0, 20, 10]), mv([0, 10, R.pushMaxSteps(c) + 1]), mv([0, 10, 20], 1000), mv([0, 10, 20], 0, -1), { s: [1, 2, 3] }, null])
    assert.equal(E.applyMove(clone(m), 'X', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  assert.ok(E.applyMove(clone(m), 'X', mv([0, 30, R.pushMaxSteps(c)]), E.makeRng('x')).ok, 'the last coin on the limit');
  E.setTune('pusher', { target: 20, start: 30 });
  try { const t = fresh('b'); assert.equal(t.coins.X.length, 30); assert.deepEqual(t.tune, { target: 20, start: 30 }); } finally { E.setTune('pusher', null); }
});

test('pusher: the move is its inputs alone: the same taps give the same push whatever the rng; the live steps, the server and the replay agree frame for frame', () => {
  const m = fresh('c'), m2 = clone(m), c = E.tuneLive('pusher'), move = mv([0, 47, 96], 321, 654);
  const r1 = E.applyMove(m, 'X', move, E.makeRng('one')), r2 = E.applyMove(m2, 'X', move, E.makeRng('another'));
  assert.deepEqual([r1, m.coins, m.score, m.last.stars], [r2, m2.coins, m2.score, m2.last.stars], 'no randomness beyond the move and the square');
  // the phone's live play: step by step, each coin released at its step where the dropper is
  const was = fresh('c'), stars = R.pushStars(was, 'X', c, 3), sim = R.pushInit(c, was.coins.X, 0.321, true);
  const end = 96 + R.pushSettleSteps(c);
  while (sim.s < end) { const i = move.k.indexOf(sim.s); R.pushStep(sim, i >= 0 ? { x: R.pushDropX(c, sim.s / R.PUSH.hz, 0.654), st: stars[i] } : null); }
  assert.deepEqual(R.pushRest(sim), m.coins.X, 'the live play ends where the server did');
  assert.equal(sim.pts, m.last.pts);
  // the replay from the flash
  const st = E.newMatch(E.makeRng('pm'), { games: ['pusher'] }); st.turn = 'X';
  assert.ok(E.playMove(st, 4, move, E.makeRng('f')).ok);
  const f = st.flash.push, rp = R.pushReplay(c, f);
  for (const k of ['ph', 'dp', 'k', 'stars', 'from', 'scored', 'pts', 'lost', 'before', 'after', 'ms']) assert.ok(k in f, k);
  assert.deepEqual(rp.coins, st.squares[4].mini.coins.X, 'the replay ends where the server did');
  assert.equal(rp.frames.length, rp.steps); assert.equal(f.ms, Math.round(rp.steps * 1000 / R.PUSH.hz));
  assert.ok(E.playMs(st.flash) >= f.ms);
  // each coin drops where the dropper was at its step
  const drops = rp.events.filter(e => e.kind === 'drop');
  assert.equal(drops.length, 3);
  move.k.forEach((k, i) => assert.ok(Math.abs(drops[i].x - Math.max(R.PUSH.r, Math.min(1 - R.PUSH.r, R.pushDropX(c, k / R.PUSH.hz, 0.654)))) < 1e-3));
});

test('pusher: the bar and the dropper are triangle waves from where they were; the dropper spans the shelf', () => {
  const c = E.tuneLive('pusher');
  assert.equal(R.pushBar(c, 0, 0), R.PUSH.back);
  assert.ok(Math.abs(R.pushBar(c, c.period / 2, 0) - (R.PUSH.back + c.stroke)) < 1e-9);
  assert.ok(Math.abs(R.pushDropX(c, 0, 0) - R.PUSH.r) < 1e-9, 'the left wall');
  assert.ok(Math.abs(R.pushDropX(c, c.dropPeriod / 2, 0) - (1 - R.PUSH.r)) < 1e-9, 'the right wall half a sweep on');
  assert.ok(Math.abs(R.pushDropX(c, 0, 0.25) - 0.5) < 1e-9, 'dp: where in its sweep it starts');
});

test('pusher: coins over the front edge score (a star coin its worth), coins off the sides near the front are lost, and the machine keeps the rest', () => {
  const c = Object.assign(E.tuneLive('pusher'), { starPct: 0 }), r = R.PUSH.r, Q = R.PUSH.Q;
  const col = []; for (let y = R.PUSH.back + r + 0.001; y < 1; y += 2 * r) col.push([Math.round(0.5 * Q), Math.round(y * Q)]);
  const res = R.pushSim(c, col, [], false, 0);
  assert.ok(res.scored >= 1, 'a full column: the front coin goes over'); assert.equal(res.pts, res.scored);
  assert.equal(res.coins.length + res.scored + res.lost, col.length, 'every coin counted');
  const star = col.map((a, i) => (i === col.length - 1 ? a.concat([1]) : a)), rs = R.pushSim(Object.assign({}, c, { starWorth: 3 }), star, [], false, 0);
  assert.equal(rs.pts, rs.scored + 2, 'the star coin at the front is worth 3');
  const side = [[Math.round(0.02 * Q), Math.round(0.9 * Q)], [Math.round(0.08 * Q), Math.round(0.9 * Q)]];
  const rl = R.pushSim(c, side, [], false, 0);
  assert.equal(rl.lost, 1); assert.equal(rl.coins.length, 1);
  // the machine persists: the next move starts from what the last left; the other machine is untouched
  const m = fresh('d'), was = m.coins.O.slice();
  E.applyMove(m, 'X', mv([0, 40, 80]), E.makeRng('p1'));
  assert.deepEqual(m.coins.O, was, "the other player's machine untouched");
  assert.equal(m.coins.X.length, was.length + 3 - m.last.scored - m.last.lost);
  const keep = m.coins.X.slice(); E.applyMove(m, 'O', mv([0, 5, 10]), E.makeRng('p2'));
  assert.deepEqual(m.last.from, was); assert.deepEqual(m.coins.X, keep);
});

test('pusher: the server holds a move to the time the turn has lasted (its last coin and the settle)', () => {
  const m = fresh('v'), c = E.tuneLive('pusher'), move = mv([0, 60, 120]), ms = R.pushRunMs(m, 'X', move);
  assert.equal(ms, Math.round((120 + R.pushSettleSteps(c)) * 1000 / R.PUSH.hz));
  assert.equal(E.onlineCheck(m, 'X', move, 100000, 100000 - ms - 10), null, 'within the time');
  assert.equal(E.onlineCheck(m, 'X', move, 100000, 100000 - 500).why, 'fast', 'longer than the turn has lasted');
  assert.equal(E.onlineCheck(m, 'X', 'auto', 100000, 0).why, 'auto');
  assert.equal(E.onlineCheck(m, 'X', { s: [1] }, 100000, 0).why, 'bad');
});

test('pusher: reaching the target lets the other player finish the round; the higher total wins, level totals are a draw', () => {
  const m = fresh('e'); m.score = { X: 11, O: 3 }; m.turns = { X: 4, O: 4 }; m.moves = { X: 4, O: 4 }; m.last = { by: 'O' };
  let r = null; for (let k = 0; k < 40 && !(r && r.note === 'reached'); k++) { const t = clone(m); r = E.applyMove(t, 'X', mv([0, 20 + k * 3, 60 + k * 5], (k * 97) % 1000, (k * 131) % 1000), E.makeRng('r' + k)); if (r.note === 'reached') Object.assign(m, t); }
  assert.equal(r.note, 'reached'); assert.equal(r.outcome, 'continue'); assert.deepEqual(m.final, { by: 'X' });
  const lvl = clone(m); lvl.score.O = lvl.score.X; lvl.coins.O = [];   // (an empty shelf: O's last turn scores nothing)
  assert.equal(E.applyMove(lvl, 'O', mv([0, 10, 20]), E.makeRng('l')).outcome, 'draw', 'level: a draw');
  const o = clone(m); o.coins.O = [];
  const ro = E.applyMove(o, 'O', mv([0, 10, 20]), E.makeRng('o'));
  assert.deepEqual([ro.outcome, ro.winner], ['win', 'X'], 'O could not catch up');
});

test('pusher: the computer: legal taps at every level, aimed over the columns it wants; Hard through the real push, quickly; needs counts turns', () => {
  const m = fresh('h'), pm = E.publicMini(m, 'X'), c = E.tuneLive('pusher');
  for (const level of ['easy', 'normal', 'hard']) {
    const b = E.localBest(pm, 'X', E.makeRng('ai' + level), {}, { level, until: null });
    assert.ok(R.pushMove(c, b.move), level + ': ' + JSON.stringify(b.move));
    assert.ok(E.applyMove(clone(m), 'X', b.move, E.makeRng('a')).ok);
  }
  // an exact hand drops over the columns it aims at
  const plan = A.pushPlan(c, [2, 6, 4], 0.5, 0, E.makeRng('p'));
  const xs = plan.k.map(k => R.pushDropX(c, k / R.PUSH.hz, plan.dp / 1000)), col = x => Math.floor(x * R.PUSH.slots);
  assert.deepEqual(xs.map(col), [2, 6, 4]);
  const shelf = []; for (let y = 0.3; y < 0.98; y += 0.1) shelf.push([Math.round(0.85 * R.PUSH.Q), Math.round(y * R.PUSH.Q)]);
  assert.ok(A.pushPressure(shelf, 7) > A.pushPressure(shelf, 1), 'pressure where the coins are');
  assert.equal(A.pushNormal(shelf, 3)[0], 7);
  const t0 = performance.now(); E.localBest(pm, 'X', E.makeRng('h'), {}, { level: 'hard', until: null });
  assert.ok(performance.now() - t0 < 2500, 'Hard is quick');
  assert.ok(A.needs(pm, 'X') >= 1);
});

test('pusher: whole squares between the computers end with a winner or a draw in a few turns', () => {
  let ended = 0;
  for (let g = 0; g < 12; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('pusher', rng); let p = 'X';
    for (let k = 0; k < 60; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok);
      if (r.outcome !== 'continue') { ended++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(ended, 12);
});
