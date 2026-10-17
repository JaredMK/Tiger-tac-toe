'use strict';
// Pool: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('pool: the fixed layout; a pocketed ball is gone; own ball down means another shot; theirs counts for them; the black loses; a scratch returns the cue ball', () => {
  const m = mini('pool', 'rules');
  assert.deepEqual(Object.keys(m.balls), ['cue', 'x1', 'x2', 'o1', 'o2', 'black']);
  assert.deepEqual(m.balls, P.POOL.start); assert.deepEqual(m.pocketed, { X: 0, O: 0 });
  // own ball straight into a side pocket: shoot again
  const own = JSON.parse(JSON.stringify(m)); own.balls.x1 = [12, 90]; own.balls.cue = [50, 90];
  const r1 = E.applyMove(own, 'X', { aim: -Math.PI / 2, power: 0.35 });
  assert.deepEqual([r1.outcome, r1.note, r1.again], ['continue', 'again', true]);
  assert.ok(own.down.x1 && own.pocketed.X === 1 && !own.down.cue, 'the ball is down, the cue ball is not');
  assert.deepEqual(own.last.pocketed, ['x1']);
  // the opponent's ball: counts for them, the turn ends
  const theirs = JSON.parse(JSON.stringify(m)); theirs.balls.o1 = [12, 90]; theirs.balls.cue = [50, 90];
  const r2 = E.applyMove(theirs, 'X', { aim: -Math.PI / 2, power: 0.35 });
  assert.deepEqual([r2.outcome, r2.note, !!r2.again], ['continue', 'theirs', false]); assert.equal(theirs.pocketed.O, 1);
  // the black: the square is lost at once
  const black = JSON.parse(JSON.stringify(m)); black.balls.black = [12, 90]; black.balls.cue = [50, 90];
  const r3 = E.applyMove(black, 'X', { aim: -Math.PI / 2, power: 0.35 });
  assert.deepEqual([r3.outcome, r3.note, r3.winner], ['win', 'black', 'O']);
  // a scratch: the cue ball back on its spot, the turn over
  const scratch = JSON.parse(JSON.stringify(m)); scratch.balls.cue = [8, 90];
  const r4 = E.applyMove(scratch, 'X', { aim: -Math.PI / 2, power: 0.5 });
  assert.deepEqual([r4.outcome, r4.note], ['continue', 'scratch']); assert.deepEqual(scratch.balls.cue, P.POOL.start.cue); assert.ok(!scratch.down.cue);
  assert.ok(scratch.last.scratch);
  // ...and the other side gets a ball more, in their colour, on a free spot
  assert.equal(scratch.last.added, 'o3'); assert.deepEqual(E.poolIds(scratch), ['cue', 'x1', 'x2', 'o1', 'o2', 'o3', 'black']);
  const at = scratch.balls.o3, R = P.POOL.ballR;
  for (const id of E.poolIds(scratch)) if (id !== 'o3' && !scratch.down[id]) assert.ok(Math.hypot(scratch.balls[id][0] - at[0], scratch.balls[id][1] - at[1]) > R * 2.5, `clear of ${id}`);
  for (const [x, y, r] of P.POOL.pockets) assert.ok(Math.hypot(x - at[0], y - at[1]) > r + R * 2, 'away from the pockets');
  assert.deepEqual(E.poolMine('O', scratch), ['o1', 'o2', 'o3']);
  // it plays like the others: in the physics, and it counts for O when it goes down
  const r4b = E.applyMove(scratch, 'O', { aim: 0, power: 0.2 });
  assert.equal(r4b.ok, true); assert.ok(scratch.last.rec.ids.includes('o3'), 'the extra ball is in the shot');
  const o3 = JSON.parse(JSON.stringify(scratch)); o3.balls.o3 = [12, 90]; o3.balls.cue = [50, 90]; o3.balls.x1 = [50, 30];
  const r4c = E.applyMove(o3, 'X', { aim: -Math.PI / 2, power: 0.35 });
  assert.deepEqual([r4c.note, o3.pocketed.O, o3.down.o3], ['theirs', 1, true], 'sunk by X: it counts for O');
  // a second scratch by O: X gets x3
  const s2 = JSON.parse(JSON.stringify(scratch)); s2.balls.cue = [8, 90];
  E.applyMove(s2, 'O', { aim: -Math.PI / 2, power: 0.5 });
  assert.equal(s2.last.added, 'x3'); assert.deepEqual(E.poolMine('X', s2), ['x1', 'x2', 'x3']);
  // the last own ball: the square
  const last = JSON.parse(JSON.stringify(m)); last.pocketed.X = 1; last.down.x2 = true; last.balls.x1 = [12, 90]; last.balls.cue = [50, 90];
  const r5 = E.applyMove(last, 'X', { aim: -Math.PI / 2, power: 0.35 });
  assert.deepEqual([r5.outcome, r5.note], ['win', 'cleared']);
  // their last ball, pocketed for them: theirs
  const gift = JSON.parse(JSON.stringify(m)); gift.pocketed.O = 1; gift.down.o2 = true; gift.balls.o1 = [12, 90]; gift.balls.cue = [50, 90];
  const r6 = E.applyMove(gift, 'X', { aim: -Math.PI / 2, power: 0.35 });
  assert.deepEqual([r6.outcome, r6.note, r6.winner], ['win', 'gift', 'O']);
  // the cue's spot taken: the cue ball comes back just below it
  const taken = JSON.parse(JSON.stringify(m)); taken.balls.x1 = P.POOL.start.cue.slice(); taken.balls.cue = [8, 90];
  E.applyMove(taken, 'X', { aim: -Math.PI / 2, power: 0.5 });
  assert.ok(taken.balls.cue[1] > P.POOL.start.cue[1] && Math.hypot(taken.balls.cue[0] - taken.balls.x1[0], taken.balls.cue[1] - taken.balls.x1[1]) >= P.POOL.ballR * 2, 'not on top of the ball there');
});

test('pool, more power: a full-power shot runs the table 3 times and more (off the far rails twice or more); the meter is squared, so a light pull is still light', () => {
  const lone = (aim, power) => {
    const r = P.run('pool', { balls: { cue: P.POOL.start.cue.slice() }, down: {} }, 'X', { aim, power }), i = r.rec.ids.indexOf('cue');
    const pts = r.rec.frames.map(f => [f[2 * i], f[2 * i + 1]]).filter(q => q[0] != null);
    let len = 0, turns = 0, dir = 0;
    for (let k = 1; k < pts.length; k++) { const dy = pts[k][1] - pts[k - 1][1]; len += Math.hypot(pts[k][0] - pts[k - 1][0], dy); const d = Math.sign(dy); if (d && dir && d !== dir) turns++; if (d) dir = d; }
    return { len, turns, ms: r.ms };
  };
  for (const aim of [0, 0.25, -0.4]) {
    const f = lone(aim, 1);
    console.log(`Pool: full power at aim ${aim}: ${f.len.toFixed(0)} units (${(f.len / P.POOL.h).toFixed(2)} table lengths), ${f.turns} far-rail bounces, ${f.ms} ms`);
    assert.ok(f.len >= 3 * P.POOL.h && f.turns >= 2, `full power runs the table 3 times (${(f.len / P.POOL.h).toFixed(2)}), off the far rails twice or more (${f.turns})`);
  }
  const light = lone(0, 0.2);
  assert.ok(light.len > 2 && light.len < 25, `a light pull (a fifth of the meter) is a gentle tap (${light.len.toFixed(1)} units)`);
  assert.ok(lone(0, 0.5).len < lone(0, 1).len / 3, 'the meter is squared: half the meter is well under a third of the run');
});

test('pool, no tunnelling at full power: balls never pass through a rail or each other, at any frame', () => {
  const rng = lcg(23), R = P.POOL.ballR;
  for (let k = 0; k < 60; k++) {
    const m = mini('pool', 'tun' + k), r = P.run('pool', m, 'X', { aim: (rng() - 0.5) * 2 * Math.PI, power: 0.85 + rng() * 0.15 });
    const n = r.rec.ids.length;
    for (const fr of r.rec.frames) {
      const at = r.rec.ids.map((id, i) => (fr[2 * i] == null ? null : [fr[2 * i], fr[2 * i + 1]]));
      at.forEach((q, i) => { if (q) assert.ok(q[0] >= R - 0.6 && q[0] <= P.POOL.w - R + 0.6 && q[1] >= R - 0.6 && q[1] <= P.POOL.h - R + 0.6, `shot ${k}: ${r.rec.ids[i]} inside the rails (${q})`); });
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (at[i] && at[j]) assert.ok(Math.hypot(at[i][0] - at[j][0], at[i][1] - at[j][1]) >= 2 * R * 0.75, `shot ${k}: ${r.rec.ids[i]} and ${r.rec.ids[j]} never pass into each other`);
    }
  }
  // head on at full power: the ball in the way is struck (not passed through), from close and from far
  for (const gap of [6, 20, 60, 110]) {
    const pos = { balls: { cue: [50, 160], x1: [50, 160 - gap] }, down: {} }, r = P.run('pool', pos, 'X', { aim: 0, power: 1 });
    assert.ok(r.events.some(e => e.k === 'balls'), `${gap} apart: the balls meet`);
    const i = r.rec.ids.indexOf('x1'), first = r.rec.frames.findIndex(f => f[2 * i + 1] != null && f[2 * i + 1] < 160 - gap - 1);
    const j = r.rec.ids.indexOf('cue');
    assert.ok(first >= 0 && r.rec.frames.slice(0, first + 1).every(f => f[2 * j + 1] == null || f[2 * j + 1] > (f[2 * i + 1] == null ? -1 : f[2 * i + 1]) - 0.5), `${gap} apart: the white stays behind the ball it strikes`);
  }
});
