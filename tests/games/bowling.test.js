'use strict';
// Bowling: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('bowling: a turn is one roll at a fresh rack; a wide roll is a gutter ball; every pin down counts, no bonuses; the target takes the square', () => {
  const m = mini('bowling', 'b');
  assert.deepEqual([m.pins, m.frames, m.open], [{ X: 0, O: 0 }, { X: [], O: [] }, undefined]); assert.equal(P.BOWL.pins.length, 10);
  const r = E.applyMove(m, 'X', { aim: 0, power: 0.85 });
  assert.equal(r.outcome, 'continue'); assert.equal(r.again, undefined, 'one roll: the turn passes at once'); assert.ok(m.pins.X >= 3 && m.pins.X <= 10, `a straight roll knocks a few (${m.pins.X})`); assert.equal(m.rolls.X, 1);
  assert.deepEqual(m.frames.X, [{ r: [m.pins.X], strike: m.pins.X === 10, total: m.pins.X }]);
  assert.equal(m.last.down.filter(Boolean).length, m.last.knocked);
  // the other player: a fresh rack of their own; a gutter ball is a roll of nothing
  const g = E.applyMove(m, 'O', { aim: 0.45, power: 0.9 });
  assert.deepEqual([g.note, g.again, m.pins.O, m.last.gutter, m.frames.O], ['gutter', undefined, 0, true, [{ r: [0], strike: false, total: 0 }]]);
  // X's next turn: a fresh rack again
  const before = m.pins.X;
  assert.equal(E.applyMove(m, 'X', { aim: 0, power: 0.85 }).again, undefined);
  assert.ok(m.pins.X > before && m.frames.X.length === 2, 'a fresh rack: the same roll knocks pins again');
  // a strike (all ten down) is noted: the best angle of the computer's comes up with one over a few racks
  let strike = false; const rng = lcg(5);
  for (let k = 0; k < 40 && !strike; k++) { const t = mini('bowling', 'strike' + k); const ai = E.physAi(t, 'X', rng); const rr = E.applyMove(t, 'X', ai.move); if (rr.note === 'strike') { strike = true; assert.deepEqual([rr.again, t.frames.X[0].strike, t.pins.X], [undefined, true, 10]); } }
  assert.ok(strike, 'a strike within forty computer rolls');
  // 35 pins take the square (the target: the admin's setting)
  const w = mini('bowling', 'w'); w.pins.X = 30;
  let n = 0; while (w.pins.X < 35 && n++ < 10) { const rr = E.applyMove(w, 'X', { aim: 0, power: 0.85 }); if (rr.outcome === 'win') { assert.equal(rr.note, 'pins'); break; } }
  assert.ok(w.pins.X >= 35);
  assert.equal(E.bowlTarget(w), 35);
});
test('bowling: no back wall — the ball and any pin that pass the end of the lane drop into the pit and are gone; nothing comes back', () => {
  const pos = { ball: P.BOWL.start }; P.BOWL.pins.forEach((p, k) => { pos['p' + k] = p; });
  let pits = 0, back = 0;
  for (let i = 0; i < 12; i++) {
    const r = P.run('bowling', pos, 'ball', { aim: (i - 6) * 0.008, power: 0.7 + (i % 3) * 0.15 });
    assert.ok(!r.events.some(e => e.k === 'wall'), 'nothing hits a wall at the back');
    pits += r.events.filter(e => e.k === 'pit').length;
    r.rec.ids.forEach((id, j) => { let low = false; for (const f of r.rec.frames) { const y = f[2 * j + 1]; if (y == null) continue; if (y < 6) low = true; else if (low && y > 12) back++; } });
    for (const e of r.events.filter(e => e.k === 'pit')) assert.equal(r.final[e.id], null, `${e.id} in the pit is gone`);
    if (r.final.ball) assert.ok(r.final.ball[1] >= P.BOWL.pit, 'the ball is never left past the end of the lane');
  }
  assert.ok(pits > 0, 'pins knocked hard enough drop into the pit');
  assert.equal(back, 0, 'nothing bounces back down the lane from the end');
});

test('bowling: its settings (TUNE) are dealt into the square and played by: the target, a slower ball; the computer\'s error', () => {
  E.setTune('bowling', { vMax: 90, aiPow: 0, target: 12 });
  const m = mini('bowling', 'tune');
  E.setTune('bowling', null);
  assert.deepEqual(m.tune, { vMax: 90, aiPow: 0, target: 12 });
  assert.equal(E.bowlTarget(m), 12, 'the target as dealt');
  const t = JSON.parse(JSON.stringify(m)); t.pins.O = 11;
  assert.equal(E.applyMove(t, 'O', { aim: 0, power: 0.85 }).outcome, 'win', 'the dealt target takes the square');
  const slow = JSON.parse(JSON.stringify(m)), fast = Object.assign(JSON.parse(JSON.stringify(m)), { tune: undefined });
  E.applyMove(slow, 'X', { aim: 0.3, power: 1 }); E.applyMove(fast, 'X', { aim: 0.3, power: 1 });
  assert.ok(slow.last.ms > fast.last.ms, `the same roll is slower (${slow.last.ms} vs ${fast.last.ms} ms)`);
  const ai = E.physAi(E.publicMini(m), 'X', E.makeRng('ai'));
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(m)), 'X', ai.move).ok, true);
});

// Equal rolls (November 2026, the square's `even` setting, off by default): the target takes the square outright only for
// a player who has not rolled more often than the other; reached with a roll in hand, the other player gets one roll to
// answer (mini.final): more pins takes it, the same is a draw, fewer leaves it to the leader.
test('bowling: equal rolls — the target reached with a roll in hand waits for one answer; more pins take it, level is a draw, fewer leave it', () => {
  const at = (x, o, rx, ro, seed, even) => { E.setTune('bowling', { even: even || 'on' }); const m = mini('bowling', seed || 'even'); E.setTune('bowling', null); m.pins = { X: x, O: o }; m.rolls = { X: rx, O: ro }; return m; };
  const roll = (m, p, aim) => E.applyMove(m, p, { aim: aim == null ? 0 : aim, power: 0.85 });
  // X reaches the target on its 4th roll, O has rolled 3 and is within a rack: O's roll to answer
  let m = at(30, 32, 3, 3); let r = roll(m, 'X');
  assert.ok(m.pins.X >= 35, `a straight roll takes X past 35 (${m.pins.X})`);
  assert.deepEqual([r.outcome, r.note, m.final], ['continue', 'reached', { by: 'X' }]);
  assert.deepEqual(E.publicMini(m).final, { by: 'X' }, 'on show for both');
  // the answer: fewer leaves the square with X (a gutter ball), named as the winner of O's move
  let a = JSON.parse(JSON.stringify(m)); r = roll(a, 'O', 0.45);
  assert.deepEqual([r.outcome, r.winner, r.note, a.final], ['win', 'X', 'held', null]);
  // more takes it for O
  a = JSON.parse(JSON.stringify(m)); a.pins.O = a.pins.X - 1; r = roll(a, 'O');
  assert.ok(a.pins.O > a.pins.X); assert.deepEqual([r.outcome, r.winner, r.note], ['win', undefined, 'passed']);
  // level: a draw (the square resets)
  a = JSON.parse(JSON.stringify(m)); a.pins.O = a.pins.X; r = roll(a, 'O', 0.45);
  assert.deepEqual([r.outcome, r.note], ['draw', 'tie']);
  // the answer cannot be put off: the leader rolling there again first takes it
  a = JSON.parse(JSON.stringify(m)); r = roll(a, 'X', 0.45);
  assert.deepEqual([r.outcome, r.winner, r.note, a.final], ['win', undefined, 'unanswered', null]);
  // an answer that could not reach the leader's total is not waited for
  m = at(30, 20, 3, 3); r = roll(m, 'X');
  assert.deepEqual([r.outcome, r.note, m.final], ['win', 'pins', null], 'O more than a rack behind: X wins at once');
  // the player who has not rolled more often wins outright (the second to roll, level on rolls)
  m = at(20, 30, 4, 3); r = roll(m, 'O');
  assert.deepEqual([r.outcome, r.note, m.final], ['win', 'pins', null]);
  // off (the admin's setting), and always in Super Chaos: first to the target
  m = at(30, 32, 3, 3, 'off', 'off');
  assert.equal(E.tune(m).even, 'off', 'off is the default'); r = roll(m, 'X');
  assert.deepEqual([r.outcome, r.note], ['win', 'pins']);
  m = at(30, 32, 3, 3); r = E.rulesOf('bowling').scApply(m, 'X', { aim: 0, power: 0.85 });
  assert.deepEqual([r.outcome, r.note, m.final], ['win', 'pins', null]);
  // the computer answers and takes: one roll needed either way
  m = at(30, 32, 3, 3); roll(m, 'X');
  assert.equal(E.aiOf('bowling').needs(E.publicMini(m), 'O'), 1); assert.equal(E.aiOf('bowling').needs(E.publicMini(m), 'X'), 1);
  assert.equal(E.aiOf('bowling').best(E.publicMini(m), 'X', E.makeRng('q')).q, 1, 'the leader\'s roll takes it for certain');
  const q = E.aiOf('bowling').best(E.publicMini(m), 'O', E.makeRng('q')).q; assert.ok(q > 0 && q < 1, `the answer may win (${q})`);
});

test('bowling: the rack is a true triangle a ball cannot slip through; a pocket roll strikes more often than not, and a slow flick\'s ball still carries into the pit', () => {
  const S = P.BOWL, d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  for (let i = 0; i < 10; i++) { const near = S.pins.map((p, j) => (j === i ? Infinity : d(p, S.pins[i]))).sort((a, b) => a - b)[0]; assert.ok(Math.abs(near - 10) < 0.02, `pin ${i}: its neighbours 10 away (${near})`); }
  assert.ok(10 - 2 * S.pinR < 2 * S.ballR, 'the gap between two pins is narrower than the ball');
  const pos = {}; let strikes = 0, n = 0, low = 0;
  for (const power of [0.7, 0.85, 1]) for (const aim of [-0.03, -0.024, -0.018, -0.012, 0.012, 0.018, 0.024, 0.03]) { const r = P.run('bowling', pos, 'ball', { aim, power }); n++; if (r.result.knocked === 10) strikes++; if (r.result.knocked < 7) low++; }
  assert.ok(strikes / n >= 0.4, `pocket rolls strike (${strikes} of ${n})`); assert.equal(low, 0, 'and never leave more than three');
  for (const aim of [-0.02, 0, 0.02]) { const r = P.run('bowling', pos, 'ball', { aim, power: E.BOWLG.powMin }); assert.ok(r.events.some(e => e.k === 'end' || e.k === 'gutter'), `the slowest roll (aim ${aim}) leaves the lane`); assert.ok(r.ms < 4200, `and is over soon (${r.ms} ms)`); }
  // the same roll is the same roll (the server's and the phone's)
  assert.deepEqual(P.run('bowling', pos, 'ball', { aim: 0.017, power: 0.9 }), P.run('bowling', pos, 'ball', { aim: 0.017, power: 0.9 }));
});

test('bowling: the flick — a swipe that points at a drawn pin rolls at that pin; the finger\'s speed is the power; a short or sideways swipe is nothing', () => {
  for (const [W, H] of [[336, 388], [366, 590], [300, 300], [600, 520]]) {
    const G = E.bowlGeom(W, H), ball = E.bowlProject(G, E.BLANE.start[0], E.BLANE.start[1], 0);
    for (const [x, y] of P.BOWL.pins.concat([[30, 120], [80, 90], [50, 0]])) {
      const t = E.bowlProject(G, x, y, 0), dx = t.X - ball.X, dy = ball.Y - t.Y, k = 60 / Math.hypot(dx, dy);   // a 60 px swipe from anywhere, along the drawn line from the ball to the spot
      const m = E.bowlFlick(G, dx * k, dy * k, 1.2, null), want = Math.atan2(x - E.BLANE.start[0], E.BLANE.start[1] - y);
      assert.ok(m && Math.abs(m.aim - want) < 0.0011, `${W}x${H}: the swipe at (${x}, ${y}) rolls at it (${m && m.aim} for ${want.toFixed(4)})`);
      assert.ok(Math.abs(E.bowlAimOf(G, E.bowlScreenAngle(G, want)) - want) < 1e-9);
    }
    assert.ok(E.bowlProject(G, 50, 30, 0).s < E.bowlProject(G, 50, 214, 0).s * 0.75, 'the pins are drawn smaller than the ball\'s end');
    assert.ok(E.bowlProject(G, 0, 240, 0).X >= -W * 0.03 && E.bowlProject(G, 100, 240, 0).X <= W * 1.03 && E.bowlProject(G, 50, 240, 0).Y <= H && E.bowlProject(G, 50, 24, 13.5).Y >= 66, `the lane fits the canvas, the back row's heads under the score board (${E.bowlProject(G, 50, 24, 13.5).Y.toFixed(0)})`);
  }
  const G = E.bowlGeom(336, 388);
  assert.equal(E.bowlFlick(G, 0, 60, 0.4, null).power, E.BOWLG.powMin, 'the slowest flick: the slowest roll');
  assert.equal(E.bowlFlick(G, 0, 60, 0.1, null).power, E.BOWLG.powMin); assert.equal(E.bowlFlick(G, 0, 60, 1.7, null).power, 1); assert.equal(E.bowlFlick(G, 0, 60, 5, null).power, 1);
  const mid = E.bowlFlick(G, 0, 60, 1.05, null).power; assert.ok(Math.abs(mid - (E.BOWLG.powMin + 1) / 2) < 0.002, `half way between: half way (${mid})`);
  assert.equal(E.bowlFlick(G, 0, 60, 1.2, { flickMin: 1.2, flickMax: 2, angleGain: 1 }).power, E.BOWLG.powMin, 'the square\'s own flick speeds');
  assert.ok(E.bowlFlick(G, 10, 60, 1, { angleGain: 2 }).aim > E.bowlFlick(G, 10, 60, 1, null).aim * 1.9, 'the angle\'s gain');
  assert.equal(E.bowlFlick(G, 0, 10, 1, null), null, 'too short'); assert.equal(E.bowlFlick(G, 80, 60, 1, null), null, 'sideways'); assert.equal(E.bowlFlick(G, 0, -60, 1, null), null, 'downwards');
  assert.ok(Math.abs(E.bowlFlick(G, 70, 60, 1, null).aim) <= E.BOWLG.aimMax);
  assert.equal(E.bowlFlick(G, -0.0001, 60, 1, null).aim, 0, 'never a -0'); assert.ok(E.physShot(E.bowlFlick(G, 12, 70, 0.9, null)), 'a move as the rules take it');
  for (const f of E.tuneFields('bowling')) if (['flickMin', 'flickMax', 'angleGain', 'even'].includes(f.k)) assert.ok(f.group === 'Rules');
  assert.equal(E.minVersionOf('bowling'), '1.13.0');
});
