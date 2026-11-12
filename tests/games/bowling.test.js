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
  for (let k = 0; k < 40 && !strike; k++) { const t = mini('bowling', 'strike' + k); const ai = E.aiOf('bowling').best(t, 'X', rng, null, { level: 'hard' }); const rr = E.applyMove(t, 'X', ai.move); if (rr.note === 'strike') { strike = true; assert.deepEqual([rr.again, t.frames.X[0].strike, t.pins.X], [undefined, true, 10]); } }
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
  E.setTune('bowling', { vMax: 90, aiMs: 0, target: 12 });
  const m = mini('bowling', 'tune');
  E.setTune('bowling', null);
  assert.deepEqual(m.tune, { vMax: 90, aiMs: 0, target: 12 });
  assert.equal(E.bowlTarget(m), 12, 'the target as dealt');
  const t = JSON.parse(JSON.stringify(m)); t.pins.O = 11;
  assert.equal(E.applyMove(t, 'O', { aim: 0, power: 0.85 }).outcome, 'win', 'the dealt target takes the square');
  const slow = JSON.parse(JSON.stringify(m)), fast = Object.assign(JSON.parse(JSON.stringify(m)), { tune: undefined });
  E.applyMove(slow, 'X', { aim: 0.3, power: 1 }); E.applyMove(fast, 'X', { aim: 0.3, power: 1 });
  assert.ok(slow.last.ms > fast.last.ms, `the same roll is slower (${slow.last.ms} vs ${fast.last.ms} ms)`);
  const ai = E.aiOf('bowling').best(E.publicMini(m), 'X', E.makeRng('ai'));
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(m)), 'X', ai.move).ok, true);
  // the hook: a square's own (thousandths of a radian a unit rolled at full curve); none bends nothing
  const bend = hook => { E.setTune('bowling', { hook }); const h = mini('bowling', 'hook'); E.setTune('bowling', null); E.applyMove(h, 'X', { aim: 0, curve: 1, power: 0.85 }); const f = h.last.rec.frames, i = h.last.rec.ids.indexOf('ball'); let x = 50; for (const fr of f) if (fr[2 * i] != null && fr[2 * i + 1] > 60) x = fr[2 * i]; return x; };
  assert.ok(Math.abs(bend(0) - 50) < 0.5 && bend(20) > bend(10) + 3 && bend(10) > 60, `a stronger hook bends more (${bend(0)}, ${bend(10)}, ${bend(20)})`);
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

test('bowling: the rack is a true triangle a ball cannot slip through; a pocket roll strikes more often than not, and the slowest roll\'s ball still carries into the pit', () => {
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

test('bowling: the three sweeps — each meter sweeps back and forth and stops where it is tapped; a roll is { aim, curve, power }; the curve hooks late, the same way at any power', () => {
  const per = E.bowlPeriods(null);
  assert.deepEqual(per, [1700, 1500, 1300], 'the default periods (TUNE aimMs, curveMs, powerMs)');
  for (let k = 0; k < 3; k++) {
    assert.equal(E.bowlWave(0, per[k], k), k < 2 ? 0.5 : 0, 'the aim and the curve start in the middle, the power at the bottom');
    let prev = E.bowlWave(0, per[k], k), turns = 0, dir = 0;
    for (let t = 10; t <= 2 * per[k]; t += 10) { const u = E.bowlWave(t, per[k], k); assert.ok(u >= 0 && u <= 1); const d = Math.sign(u - prev); if (d && dir && d !== dir) turns++; if (d) dir = d; prev = u; }
    assert.ok(turns >= 3 && turns <= 4, `back and forth, twice a period (${turns})`);
    for (const u of [0, 0.13, 0.5, 0.77, 1]) assert.ok(Math.abs(E.bowlMeterU(k, E.bowlMeter(k, u)) - u) < 0.003, 'a value and its place on the meter');
  }
  assert.deepEqual([E.bowlMeter(0, 0), E.bowlMeter(0, 1), E.bowlMeter(1, 0), E.bowlMeter(1, 1), E.bowlMeter(2, 0), E.bowlMeter(2, 1), E.bowlMeter(1, 0.5)], [-E.BOWLG.aimSweep, E.BOWLG.aimSweep, -1, 1, E.BOWLG.powMin, 1, 0]);
  // the move: curve -1..1, none in an older move
  assert.deepEqual(E.bowlShot({ aim: 0.1, power: 0.8 }), { aim: 0.1, curve: 0, power: 0.8 });
  assert.deepEqual(E.bowlShot({ aim: 0.1234, curve: -0.5557, power: 0.8 }), { aim: 0.123, curve: -0.556, power: 0.8 });
  for (const c of [1.01, -2, 'x', NaN]) assert.equal(E.bowlShot({ aim: 0, curve: c, power: 0.8 }), null);
  assert.equal(E.applyMove(mini('bowling', 'bad'), 'X', { aim: 0, curve: 3, power: 0.8 }).ok, false, 'the rules refuse a curve off the meter');
  // the hook: straight for the first stretch, then bending the curve's way, by the distance rolled: the guide line is the ball's way
  const pos = {};
  for (const curve of [-0.7, 0.4, 1]) {
    const path = E.bowlPath(-curve * 0.15, curve, undefined);
    for (const power of [0.75, 1]) {
      const r = P.run('bowling', pos, 'ball', { aim: -curve * 0.15, curve, power }), i = r.rec.ids.indexOf('ball');
      for (const f of r.rec.frames) { const x = f[2 * i], y = f[2 * i + 1]; if (x == null || y < 60 || r.events.some(e => e.k === 'pin' && e.t * r.rec.fps < r.rec.frames.indexOf(f))) continue; const q = path.reduce((a, b) => (Math.abs(b[1] - y) < Math.abs(a[1] - y) ? b : a)); assert.ok(Math.abs(q[0] - x) < 1.2, `curve ${curve} power ${power}: the ball (${x.toFixed(1)}, ${y.toFixed(1)}) on the guide (${q[0].toFixed(1)})`); }
    }
    assert.ok(Math.abs(path.find(p => p[1] < 214 - 45)[0] - (50 + Math.tan(-curve * 0.15) * 45)) < 0.6, 'straight for the first stretch');
  }
  // a hook into the pocket is the best roll: it strikes more often over a spread of aims than the best straight ball
  const strikes = curve => { let best = 0; for (let c = 10; c <= 90; c += 2) { let n = 0; for (let x = c - 2; x <= c + 2; x += 1) for (const power of [0.8, 0.95]) if (P.run('bowling', pos, 'ball', { aim: Math.atan((x - 50) / 169), curve, power }).result.knocked === 10) n++; best = Math.max(best, n); } return best; };
  const straight = strikes(0), hook = Math.max(strikes(0.7), strikes(-0.7));
  assert.ok(hook > straight, `the hook's window (${hook} of 10) beats the straight ball's (${straight})`);
  for (const f of E.tuneFields('bowling')) if (['aimMs', 'curveMs', 'powerMs', 'hook', 'even'].includes(f.k)) assert.ok(f.group === 'Rules');
  assert.ok(!E.tuneFields('bowling').some(f => /^flick|angleGain|aiAim|aiPow/.test(f.k)), 'the flick\'s settings are gone');
  assert.equal(E.minVersionOf('bowling'), '1.15.0');
});

test('bowling: the geometry — the lane fits the canvas; the pins small at the far end', () => {
  for (const [W, H] of [[336, 388], [366, 590], [300, 300], [600, 520]]) {
    const G = E.bowlGeom(W, H);
    for (const want of [-0.2, 0, 0.13]) assert.ok(Math.abs(E.bowlAimOf(G, E.bowlScreenAngle(G, want)) - want) < 1e-9);
    assert.ok(E.bowlProject(G, 50, 30, 0).s < E.bowlProject(G, 50, 214, 0).s * 0.75, 'the pins are drawn smaller than the ball\'s end');
    assert.ok(E.bowlProject(G, 0, 240, 0).X >= -W * 0.03 && E.bowlProject(G, 100, 240, 0).X <= W * 1.03 && E.bowlProject(G, 50, 240, 0).Y <= H && E.bowlProject(G, 50, 24, 13.5).Y >= 66, `the lane fits the canvas, the back row's heads under the score board (${E.bowlProject(G, 50, 24, 13.5).Y.toFixed(0)})`);
  }
});

test('bowling: the computer — each level a pick and its timing error on the three taps; Hard better than Normal, Normal than Easy', async () => {
  const A = await import('../../src/games/bowling/ai.js');
  const m = mini('bowling', 'ai'), avg = level => { const rng = lcg(9); let s = 0; for (let i = 0; i < 40; i++) { const mv = E.aiOf('bowling').best(E.publicMini(m), 'X', rng, null, { level }).move; assert.ok(E.bowlShot(mv) && mv.curve != null, 'a roll with its curve'); s += P.run('bowling', {}, 'ball', mv).result.knocked; } return s / 40; };
  const e = avg('easy'), n = avg('normal'), h = avg('hard');
  assert.ok(h > n && n > e, `pins a roll: Hard ${h}, Normal ${n}, Easy ${e}`);
  const c = A.bowlPick(E.publicMini(m), 'X', lcg(1), 'normal').c;
  E.setTune('bowling', { aiMs: 0 }); const z = mini('bowling', 'z'); E.setTune('bowling', null);
  assert.deepEqual(A.bowlTimed(c, z, 0, lcg(2)), c, 'no timing error: the roll it meant');
});
