'use strict';
// Coin Pusher (November 2026; reworked the same month: a live machine and a dropper to time): its rules and computer,
// test by test (npm test). The engine is the one the page and the server run: a move is its taps, worked out the same
// on the mover's phone (live), on the server (the result kept) and on the other phone (from the flash).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/pusher/rules.js');
const A = require('../../src/games/pusher/ai.js');

const opened = m => { m.moves = { X: 1, O: 1 }; m.turns = { X: 1, O: 1 }; return m; };   // (a square past its opening move: 3 coins a move)
const fresh = s => opened(E.newMini('pusher', E.makeRng('psh-' + s)));
const clone = v => JSON.parse(JSON.stringify(v));
const mv = (k, ph = 0, dp = 0) => ({ ph, dp, k });

test('pusher: one shared machine (v 3), its fresh shelf settled and every coin on it the machine\'s own, in whole units, a public seed; the settings are the admin\'s', () => {
  const m = fresh('a'), c = E.tuneLive('pusher');
  assert.equal(c.target, 14); assert.equal(c.perMove, 3); assert.equal(c.again, 'off'); assert.equal(c.maxSecs, 8); assert.equal(c.coin, 0.08); assert.equal(c.start, 18);
  assert.equal(m.v, 3); assert.ok(Array.isArray(m.coins), 'one shelf'); assert.ok(m.coins.length > 0 && m.coins.length <= c.start); assert.ok(Number.isInteger(m.seed));
  assert.ok(m.coins.every(a => Number.isInteger(a[0]) && Number.isInteger(a[1]) && !(a[3] | 0)), 'every coin the machine\'s own');
  const pc = R.pushCfg(m), rest = R.pushSim(pc, m.coins, [], false, 0, null);
  assert.equal(rest.scored + rest.lost, 0, 'settled: left alone, nothing falls (no free sweep for the first mover)');
  assert.deepEqual(m.score, { X: 0, O: 0 });
  // a move: ph and dp in thousandths, three steps from 0, each later than the one before, the last within the time limit
  for (const bad of [mv([0, 10]), mv([1, 10, 20]), mv([0, 10, 10]), mv([0, 20, 10]), mv([0, 10, R.pushMaxSteps(c) + 1]), mv([0, 10, 20], 1000), mv([0, 10, 20], 0, -1), { s: [1, 2, 3] }, null])
    assert.equal(E.applyMove(clone(m), 'X', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  assert.ok(E.applyMove(clone(m), 'X', mv([0, 30, R.pushMaxSteps(c)]), E.makeRng('x')).ok, 'the last coin on the limit');
  const op = E.newMini('pusher', E.makeRng('psh-a')), oc = R.pushCfg(op);
  assert.equal(oc.perMove, 2, 'the square\'s opening move: 2 coins'); assert.equal(E.applyMove(clone(op), 'X', mv([0, 10, 20]), E.makeRng('x')).ok, false);
  assert.ok(E.applyMove(op, 'X', mv([0, 10]), E.makeRng('x')).ok); assert.equal(R.pushCfg(op).perMove, 3, 'then 3 a move');
  E.setTune('pusher', { target: 20, start: 30 });
  try { const t = fresh('b'); assert.ok(t.coins.length > 18 && t.coins.length <= 30); assert.deepEqual(t.tune, { target: 20, start: 30 }); } finally { E.setTune('pusher', null); }
});

test('pusher: the move is its inputs alone: the same taps give the same push whatever the rng; the live steps, the server and the replay agree frame for frame', () => {
  const m = fresh('c'), m2 = clone(m), c = E.tuneLive('pusher'), move = mv([0, 47, 96], 321, 654);
  const r1 = E.applyMove(m, 'X', move, E.makeRng('one')), r2 = E.applyMove(m2, 'X', move, E.makeRng('another'));
  assert.deepEqual([r1, m.coins, m.score, m.last.stars], [r2, m2.coins, m2.score, m2.last.stars], 'no randomness beyond the move and the square');
  // the phone's live play: step by step, each coin released at its step where the dropper is
  const was = fresh('c'), pc = R.pushCfg(was), stars = R.pushStars(was, 'X', pc, 3), sim = R.pushInit(pc, was.coins, was.ph, true, 'X', R.pushGoal(was, pc));
  while (!R.pushOver(sim, 96)) { const i = move.k.indexOf(sim.s); R.pushStep(sim, i >= 0 ? { x: R.pushDropX(pc, sim.s / R.PUSH.hz, 0.654), st: stars[i], ow: R.OWN.X } : null); }
  assert.deepEqual(R.pushRest(sim), m.coins, 'the live play ends where the server did');
  assert.equal(sim.pts, m.last.pts);
  // the replay from the flash
  const st = E.newMatch(E.makeRng('pm'), { games: ['pusher'] }); st.turn = 'X'; st.squares[4].mini = clone(was);
  assert.ok(E.playMove(st, 4, move, E.makeRng('f')).ok);
  const f = st.flash.push, rp = R.pushReplay(c, f);
  for (const k of ['ph', 'dp', 'k', 'stars', 'from', 'scored', 'pts', 'opp', 'lost', 'before', 'after', 'ob', 'oa', 'ms']) assert.ok(k in f, k);
  assert.deepEqual(rp.coins, st.squares[4].mini.coins, 'the replay ends where the server did');
  assert.ok(rp.coins.some(q => q[3] === R.OWN.X), 'the coins dropped are X\'s');
  assert.equal(rp.frames.length, rp.steps); assert.equal(f.ms, Math.round(rp.steps * 1000 / R.pushHz(c))); assert.equal(rp.steps, sim.s, 'the replay stops on the same step');
  assert.ok(E.playMs(st.flash) >= f.ms);
  // each coin drops where the dropper was at its step
  const drops = rp.events.filter(e => e.kind === 'drop');
  assert.equal(drops.length, 3);
  const r = R.pushR(R.pushCfg(st.squares[4].mini));
  move.k.forEach((k, i) => assert.ok(Math.abs(drops[i].x - Math.max(r, Math.min(1 - r, R.pushDropX(R.pushCfg(st.squares[4].mini), k / R.PUSH.hz, 0.654)))) < 1e-3));
});

test('pusher: the bar and the dropper are triangle waves from where they were; the dropper spans the shelf', () => {
  const c = E.tuneLive('pusher');
  assert.equal(R.pushBar(c, 0, 0), R.PUSH.back);
  assert.ok(Math.abs(R.pushBar(c, c.period / 2, 0) - (R.PUSH.back + c.stroke)) < 1e-9);
  assert.ok(Math.abs(R.pushDropX(c, 0, 0) - R.PUSH.r) < 1e-9, 'the left wall');
  assert.ok(Math.abs(R.pushDropX(c, c.dropPeriod * R.pushPace(c) / 2, 0) - (1 - R.PUSH.r)) < 1e-9, 'the right wall half a (real) sweep on: the dropper keeps its real speed');
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
  // the one machine persists: the next move, either player's, starts from what the last left
  const m = fresh('d'), was = m.coins.slice();
  E.applyMove(m, 'X', mv([0, 40, 80]), E.makeRng('p1'));
  assert.equal(m.coins.length, was.length + 3 - m.last.scored - m.last.lost);
  const keep = m.coins.map(q => q.slice()); E.applyMove(m, 'O', mv([0, 5, 10]), E.makeRng('p2'));
  assert.deepEqual(m.last.from, keep, 'O pushes the shelf X left');
});

test('pusher: the server holds a move to the time the turn has lasted (the machine run to its settle)', () => {
  const m = fresh('v'), move = mv([0, 60, 120]), ms = R.pushRunMs(m, 'X', move), t = clone(m);
  E.applyMove(t, 'X', move, E.makeRng('v')); assert.equal(ms, t.last.ms, 'the very run apply makes');
  assert.equal(E.onlineCheck(m, 'X', move, 100000, 100000 - ms - 10), null, 'within the time');
  assert.equal(E.onlineCheck(m, 'X', move, 100000, 100000 - 1).why, 'fast', 'longer than the turn has lasted');
  assert.equal(E.onlineCheck(m, 'X', 'auto', 100000, 0).why, 'auto');
  assert.equal(E.onlineCheck(m, 'X', { s: [1] }, 100000, 0).why, 'bad');
});

test('pusher: the first coin to take a total to the target wins the square at once, mid-move: the machine stops there, the server, the live play and the replay alike', () => {
  const m = fresh('e'); m.coins = m.coins.map(q => [q[0], Math.min(9900, q[1] + 600), q[2] | 0, 0]);   // (a crowded front: a move scores)
  m.turns = { X: 4, O: 4 }; m.moves = { X: 4, O: 4 }; m.last = { by: 'O' };
  let found = null;
  for (let need = 1; need <= 3 && !found; need++) for (let k = 0; k < 40 && !found; k++) {
    const t = clone(m); t.score = { X: 14 - need, O: 3 };
    const move = mv([0, 60 + k * 4, 140 + k * 6], 0, (k * 131) % 1000), r = E.applyMove(t, 'X', move, E.makeRng('r' + k));
    if (r.outcome === 'win' && t.last.win === 'X' && !t.final) {
      const c = R.pushCfg(t), all = R.pushSim(c, m.coins, R.pushDrops(c, move, t.last.stars, R.OWN.X), false, m.ph, 'X');   // (no goal: the move as it would have run)
      const done = R.pushReplay(c, Object.assign({}, t.last, { by: 'X', v: 3 }));
      if (done.steps <= move.k[2]) found = { t, r, move, all, done, need };   // (won before the last coin dropped)
    }
  }
  assert.ok(found, 'a move won before its last coin');
  const { t, r, move, all, done } = found;
  assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'X', 'reached'], 'no matching turn: the square is X\'s');
  assert.ok(t.score.X >= 14);
  assert.ok(done.steps < all.steps, `the machine stopped on the winning coin (${done.steps} of ${all.steps} steps)`);
  assert.equal(done.events.filter(e => e.kind === 'drop').length < 3, true, 'the coins after it never dropped');
  assert.equal(t.last.ms, done.ms, 'the replay ends where the server did');
  assert.equal(done.events[done.events.length - 1].kind, 'off', 'the last thing the machine did: the winning coin over the edge');
  // the live play stops on the same step
  const c = R.pushCfg(t), sim = R.pushInit(c, m.coins, m.ph, false, 'X', { X: 14 - found.need, O: 3, target: 14 });
  while (sim.win == null && sim.s < 2000) { const i = move.k.indexOf(sim.s); R.pushStep(sim, i >= 0 ? { x: R.pushDropX(c, sim.s / R.PUSH.hz, move.dp / 1000), st: t.last.stars[i], ow: R.OWN.X } : null); }
  assert.deepEqual([sim.win, sim.s], ['X', done.steps]);
  // the other side's coins can win it for them on the mover's turn too
  const o = clone(m); o.score = { X: 13, O: 3 }; o.coins = o.coins.map(q => [q[0], q[1], q[2] | 0, R.OWN.X]);
  let won = null; for (let k = 0; k < 40 && !won; k++) { const u = clone(o), rr = E.applyMove(u, 'O', mv([0, 30 + k * 3, 70 + k * 5], 0, (k * 97) % 1000), E.makeRng('q' + k)); if (rr.outcome === 'win') won = rr; }
  assert.ok(won); assert.equal(won.winner, 'X', 'X\'s coin over on O\'s move: X wins there and then');
  // a square from before already in its matching turn plays it out
  const old = clone(m); old.score = { X: 15, O: 3 }; old.final = { by: 'X' }; old.coins = []; old.last = { by: 'X' };
  assert.deepEqual([E.applyMove(old, 'O', mv([0, 10, 20]), E.makeRng('l')).winner], ['X']);
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
    const rng = E.makeRng('w' + g), m = E.newMini('pusher', rng); let p = 'X';   // (from its opening move)
    for (let k = 0; k < 60; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok);
      if (r.outcome !== 'continue') { ended++; break; }
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
  }
  assert.equal(ended, 12);
});

test('pusher: after the last coin the machine runs only until it has settled (a full stroke with nothing falling, every coin still), then the move ends at once', () => {
  const mini = opened(E.newMini('pusher', E.makeRng('settle'))), c = R.pushCfg(mini), stroke = R.pushStrokeSteps(c), cap = R.pushCapSteps(c);
  assert.equal(stroke, Math.round(c.period * R.PUSH.hz)); assert.equal(c.settleStrokes, 4); assert.equal(cap, 4 * stroke);
  let early = 0;
  for (let k = 0; k < 30; k++) {
    const m = clone(mini); m.coins = m.coins.map(q => [q[0], Math.min(9900, q[1] + (k % 3) * 300), q[2] | 0, 0]);
    const move = mv([0, 20 + k * 3, 50 + k * 5], 0, (k * 89) % 1000), last = move.k[2];
    const sim = R.pushInit(c, m.coins, m.ph, false, 'X'), stars = R.pushStars(m, 'X', c, 3);
    let lastFall = 0, ended = null;
    while (!R.pushOver(sim, last)) {
      const i = move.k.indexOf(sim.s); R.pushStep(sim, i >= 0 ? { x: R.pushDropX(c, sim.s / R.PUSH.hz, move.dp / 1000), st: stars[i], ow: R.OWN.X } : null);
      if (sim.last.some(e => e.kind !== 'drop')) lastFall = sim.s;
    }
    ended = sim.s;
    assert.ok(ended - last <= cap, 'at most settleStrokes strokes after the last coin');
    if (ended - last < cap) {
      early++;
      assert.ok(ended - Math.max(last + 1, lastFall) >= stroke, 'a full stroke since the last coin dropped and the last fell');
      assert.ok(sim.move < R.PUSH.still, 'every coin still');
    }
    const res = R.pushSim(c, m.coins, R.pushDrops(c, move, stars, R.OWN.X), false, m.ph, 'X');
    assert.equal(res.steps, ended, 'the server stops on the same step'); assert.equal(res.ms, Math.round(ended * 1000 / R.pushHz(c)));
  }
  assert.ok(early >= 24, `most moves end once settled, before the cap (${early} of 30)`);
});
test('pusher: nothing happens between turns: the machine stops where the move ended and the next move starts from there; a coin left on the edge stays put', () => {
  const m = fresh('frz'); m.coins = m.coins.map(q => [q[0], Math.min(9900, q[1] + 500), q[2] | 0, 0]);
  const c = R.pushCfg(m);
  E.applyMove(m, 'X', mv([0, 40, 90], 0, 300), E.makeRng('f1'));
  const end = m.last.ph / 1000 + Math.round(m.last.ms * R.pushHz(c) / 1000) / R.PUSH.hz / c.period;
  assert.ok(Math.abs(R.pushBar(c, 0, m.ph) - R.pushBar(c, 0, end)) < 1e-5, 'the bar frozen where the move left it (mini.ph)');
  const shelf = clone(m.coins), edge = shelf.filter(q => q[1] > 0.93 * R.PUSH.Q);
  // the machine at rest: one more step from there, nothing dropped, moves nothing and drops nothing
  const sim = R.pushInit(c, shelf, m.ph, false, 'O'); R.pushStep(sim, null);
  assert.equal(sim.last.length, 0, 'no coin falls at the turn\'s change'); assert.ok(sim.move < 1e-3, 'every coin at rest');
  // the next move (O's, whatever ph it sends) starts from that shelf and that bar
  const before = m.ph;
  E.applyMove(m, 'O', mv([0, 30, 60], 777, 500), E.makeRng('f2'));
  assert.deepEqual(m.last.from, shelf, 'the shelf as the last move left it, the coins on the edge included');
  assert.ok(edge.every(q => m.last.from.some(a => a[0] === q[0] && a[1] === q[1])), 'balanced on the edge: still there for the next move');
  assert.equal(m.last.ph, before * 1000, 'the bar where it stood, not where the phone said');
});

// ----- the shared machine (v 3, November 2026): whose coin scores for whom -----
test('pusher: a player\'s coins score for them whenever they go over, on anyone\'s move; the machine\'s own coins score for the mover; off the sides nobody scores', () => {
  const c = Object.assign(R.pushCfg(fresh('o')), { starPct: 0 }), r = R.pushR(c), Q = R.PUSH.Q;
  const col = []; for (let y = R.PUSH.back + r + 0.001; y < 1; y += 2 * r) col.push([Math.round(0.5 * Q), Math.round(y * Q), 0, 0]);
  const front = col.length - 1;
  for (const [ow, to] of [[0, 'O'], [R.OWN.X, 'X'], [R.OWN.O, 'O']]) {
    const shelf = col.map((a, i) => (i === front ? [a[0], a[1], 0, ow] : a.slice()));
    const res = R.pushSim(c, shelf, [], false, 0, 'O');                                 // O's move pushes the column
    assert.ok(res.scored >= 1, 'the front coin goes over');
    const off = res.events.find(e => e.kind === 'off' && e.ow === ow);
    assert.ok(off, 'the coin with that owner went over'); assert.equal(off.to, to, `owner ${ow}: scores for ${to}`);
    assert.equal(res.by[to] >= 1, true);
    if (to === 'X') assert.ok(res.opp >= 1, 'X scores on O\'s move'); else assert.ok(res.pts >= 1);
  }
  const side = R.pushSim(c, [[Math.round(0.02 * Q), Math.round(0.9 * Q), 0, R.OWN.X], [Math.round(0.1 * Q), Math.round(0.9 * Q), 0, 0]], [], false, 0, 'O');   // (X's coin shoved off the side by the other)
  assert.deepEqual([side.lost, side.by.X, side.by.O], [1, 0, 0], 'off a side: nobody scores');
});
test('pusher: a move updates both totals; the totals and the shelf agree with the replay; reaching the target on the other side\'s points also finishes the round', () => {
  const m = fresh('t');
  m.coins = m.coins.map((q, i) => [q[0], Math.min(9900, q[1] + 600), q[2] | 0, i % 2 ? R.OWN.X : 0]);   // (a crowded front: half of it X's)
  const b0 = { X: m.score.X, O: m.score.O };
  E.applyMove(m, 'O', mv([0, 30, 60], 250, 400), E.makeRng('t1'));
  assert.equal(m.score.O - b0.O, m.last.pts); assert.equal(m.score.X - b0.X, m.last.opp);
  assert.ok(m.last.opp > 0, 'X\'s coins went over on O\'s move');
  const f = fresh('u'); f.score = { X: 13, O: 2 }; f.turns = { X: 4, O: 3 }; f.moves = { X: 4, O: 3 }; f.last = { by: 'X' };   // (O's move levels the turns)
  f.coins = f.coins.map((q, i) => [q[0], Math.min(9900, q[1] + 600), q[2] | 0, R.OWN.X]);   // (every coin X's: O's push can only score for X)
  const r = E.applyMove(f, 'O', mv([0, 30, 60], 250, 400), E.makeRng('t2'));
  assert.ok(f.score.X >= 14, 'X over the target on O\'s move');
  assert.equal(r.outcome, 'win'); assert.equal(r.winner, 'X', 'the turns level: the round is over');
});
test('pusher: a square from before (v 2, a machine each) becomes the shared machine at its next move, the totals kept; its miniature and the computer read it meanwhile', () => {
  const m = fresh('old'); const old = m.coins.map(q => [q[0], q[1]].concat(q[2] ? [1] : []));
  m.v = 2; m.coins = { X: old, O: old.map(q => q.slice()) }; m.score = { X: 5, O: 4 };
  assert.ok(R.pushShelf(m, 'X').length > 0);
  for (const level of ['easy', 'normal', 'hard']) assert.ok(R.pushMove(R.pushCfg(Object.assign({}, m, { v: 3 })), E.localBest(E.publicMini(m, 'X'), 'X', E.makeRng('l' + level), {}, { level, until: null }).move));
  const r = E.applyMove(m, 'X', mv([0, 30, 60]), E.makeRng('up'));
  assert.ok(r.ok); assert.equal(m.v, 3); assert.ok(Array.isArray(m.coins)); assert.ok(m.score.X >= 5 && m.score.O >= 4, 'the totals kept');
});
