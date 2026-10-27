'use strict';
// Pool: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));

test('pool: the fixed layout; a pocketed ball is gone; own ball down means another shot; theirs counts for them; the black loses; every scratch returns the cue ball and puts a ball back for the shooter (nothing for the other side); all of a side\'s balls on the table down wins', () => {
  const m = mini('pool', 'rules');
  assert.deepEqual(Object.keys(m.balls), ['cue', 'x1', 'x2', 'x3', 'o1', 'o2', 'o3', 'black']);
  assert.deepEqual(m.balls, P.POOL.start);
  for (const [a, A] of Object.entries(m.balls)) for (const [b, B] of Object.entries(m.balls)) if (a < b) assert.ok(Math.hypot(A[0] - B[0], A[1] - B[1]) > P.POOL.ballR * 2.5, `${a} and ${b} do not overlap`);
  for (const id of Object.keys(m.balls)) for (const [x, y, r] of P.POOL.pockets) assert.ok(Math.hypot(m.balls[id][0] - x, m.balls[id][1] - y) > r + P.POOL.ballR, `${id} clear of the pockets`); assert.deepEqual(m.pocketed, { X: 0, O: 0 });
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
  // a scratch with nothing pocketed: a new extra ball in the shooter's colour, on a free spot; nothing for the other side
  assert.deepEqual([scratch.last.back, scratch.last.added], ['x4', true]); assert.deepEqual(E.poolIds(scratch), ['cue', 'x1', 'x2', 'x3', 'x4', 'o1', 'o2', 'o3', 'black']); assert.deepEqual(scratch.pocketed, { X: 0, O: 0 });
  assert.equal(E.poolLeft('X', scratch), 4); assert.equal(E.poolLeft('O', scratch), 3);
  // a second scratch in a row (the cue ball sent into the pocket again): another, x5; O's scratch adds an o4
  scratch.balls.cue = [8, 90]; E.applyMove(scratch, 'X', { aim: -Math.PI / 2, power: 0.5 });
  assert.equal(scratch.last.back, 'x5'); assert.equal(E.poolLeft('X', scratch), 5, 'two scratches: two more balls to sink');
  scratch.balls.cue = [8, 90]; E.applyMove(scratch, 'O', { aim: -Math.PI / 2, power: 0.5 });
  assert.equal(scratch.last.back, 'o4');
  // a scratch with one of the shooter's balls down: that ball comes back on a free spot, off the shooter's count
  const back = JSON.parse(JSON.stringify(m)); back.down.x2 = true; back.pocketed.X = 1; back.balls.cue = [8, 90];
  const r4b = E.applyMove(back, 'X', { aim: -Math.PI / 2, power: 0.5 });
  assert.deepEqual([r4b.outcome, r4b.note], ['continue', 'scratch']);
  assert.equal(back.last.back, 'x2'); assert.ok(!back.down.x2, 'x2 back on the table'); assert.deepEqual(back.pocketed, { X: 0, O: 0 }, 'off X\'s count; nothing for O');
  assert.deepEqual(E.poolMine('O', back), ['o1', 'o2', 'o3'], 'the other side gets no ball more'); assert.equal(back.last.added, false, 'a pocketed ball returned, none added');
  const at = back.balls.x2, R = P.POOL.ballR;
  for (const id of E.poolIds(back)) if (id !== 'x2' && !back.down[id]) assert.ok(Math.hypot(back.balls[id][0] - at[0], back.balls[id][1] - at[1]) > R * 2.5, `clear of ${id}`);
  for (const [x, y, r] of P.POOL.pockets) assert.ok(Math.hypot(x - at[0], y - at[1]) > r + R * 2, 'away from the pockets');
  assert.deepEqual(back.last.at, at);
  // the last own ball: the square
  const last = JSON.parse(JSON.stringify(m)); last.pocketed.X = 2; last.down.x2 = last.down.x3 = last.down.o2 = true; last.balls.x1 = [12, 90]; last.balls.cue = [50, 90];
  const r5 = E.applyMove(last, 'X', { aim: -Math.PI / 2, power: 0.35 });
  assert.deepEqual([r5.outcome, r5.note], ['win', 'cleared']);
  // the shot that sinks the last ball and scratches: no win; one of the sunk balls comes back, and X must sink it too
  const sc = JSON.parse(JSON.stringify(m)); sc.pocketed.X = 2; sc.down.x2 = sc.down.x3 = true; sc.balls.x1 = [12, 90]; sc.balls.cue = [28, 90];
  const probe = JSON.parse(JSON.stringify(sc)); const pr = P.run('pool', probe, 'X', { aim: -Math.PI / 2, power: 0.5 });
  if (pr.result.pocketed.includes('x1') && pr.result.pocketed.includes('cue')) {
    const rs = E.applyMove(sc, 'X', { aim: -Math.PI / 2, power: 0.5 });
    assert.deepEqual([rs.outcome, rs.note], ['continue', 'scratch']); assert.equal(E.poolLeft('X', sc), 1, 'one ball to sink again');
  }
  const forced = JSON.parse(JSON.stringify(m)); forced.pocketed.X = 2; forced.down.x2 = forced.down.x3 = true; forced.balls.x1 = [12, 90]; forced.balls.cue = [8, 90];
  forced.balls.x1 = [50, 30];                                                                 // (nothing sunk but the white: a scratch with balls on the table)
  assert.equal(E.applyMove(forced, 'X', { aim: -Math.PI / 2, power: 0.5 }).outcome, 'continue');
  assert.equal(E.poolLeft('X', forced), 2, 'x1 and the returned ball');
  // all of them, not the first two: a square from before with a third ball of X's on the table is not won at two
  const three = JSON.parse(JSON.stringify(m)); three.balls.x4 = [80, 150]; three.pocketed.X = 2; three.down.x2 = three.down.x3 = three.down.o2 = true; three.balls.x1 = [12, 90]; three.balls.cue = [50, 90];
  const r5b = E.applyMove(three, 'X', { aim: -Math.PI / 2, power: 0.35 });
  assert.deepEqual([r5b.outcome, r5b.note, three.pocketed.X], ['continue', 'again', 3], 'three down, one (a scratch\'s extra) still on the table: shoot again');
  // their last ball, pocketed for them: theirs
  const gift = JSON.parse(JSON.stringify(m)); gift.pocketed.O = 2; gift.down.o2 = gift.down.o3 = true; gift.balls.o1 = [12, 90]; gift.balls.cue = [50, 90];
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

test('pool: its settings (TUNE) are dealt into the square and played by: a slower full-power shot', () => {
  E.setTune('pool', { vMax: 150, aiAim: 0 });
  const m = mini('pool', 'tune');
  E.setTune('pool', null);
  assert.deepEqual(m.tune, { vMax: 150, aiAim: 0 });
  const far = s => { const r = s.last.rec, i = r.ids.indexOf('cue'); return Math.max(...r.frames.map(f => Math.abs(f[i * 2 + 1] - r.frames[0][i * 2 + 1]) + Math.abs(f[i * 2] - r.frames[0][i * 2]))); };
  const slow = JSON.parse(JSON.stringify(m)), fast = Object.assign(JSON.parse(JSON.stringify(m)), { tune: undefined });
  E.applyMove(slow, 'X', { aim: -Math.PI / 2, power: 0.3 }); E.applyMove(fast, 'X', { aim: -Math.PI / 2, power: 0.3 });
  assert.ok(slow.last.ms < fast.last.ms || far(slow) < far(fast), 'the same shot runs slower');
  const ai = E.physAi(E.publicMini(m), 'X', E.makeRng('ai'));
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(m)), 'X', ai.move).ok, true);
});

test('pool AI: scores shots by the rules: its last ball down wins, the black loses, a scratch costs a ball back, their last ball down loses; it plays racks to a finish', () => {
  const m = mini('pool', 'aiscore'); m.down.x2 = m.down.x3 = true; m.pocketed.X = 2;
  const shot = (pocketed, final) => ({ result: { pocketed }, final: Object.assign({}, final) });
  const gone = ids => Object.fromEntries(ids.map(id => [id, null]));
  assert.equal(E.physScore(m, 'X', shot(['x1'], gone(['x1']))), 1000, 'the last ball: the square');
  assert.equal(E.physScore(m, 'X', shot(['black'], gone(['black']))), -1000, 'the black');
  assert.ok(E.physScore(m, 'X', shot(['x1', 'cue'], gone(['x1', 'cue']))) < 1000, 'the last ball with a scratch: one comes back, not a win');
  assert.ok(E.physScore(m, 'X', shot(['cue'], gone(['cue']))) < E.physScore(m, 'X', shot([], {})), 'a scratch is worse than nothing down (a ball more to sink, even with none pocketed)');
  const g = JSON.parse(JSON.stringify(m)); g.down.o2 = g.down.o3 = true; g.pocketed.O = 2;
  assert.equal(E.physScore(g, 'X', shot(['o1'], gone(['o1']))), -1000, 'their last ball: theirs');
  assert.equal(E.physNeeds(m, 'X'), 2, 'one ball left: about two shots');
  const rng = lcg(5);
  let finished = 0;
  for (let k = 0; k < 4; k++) {
    const r0 = mini('pool', 'rack' + k); let turn = 'X', end = null;
    for (let n = 0; n < 60 && !end; n++) { const ai = E.physAi(r0, turn, rng), r = E.applyMove(r0, turn, ai.move, rng); if (r.outcome === 'win') end = r; else if (!r.again) turn = turn === 'X' ? 'O' : 'X'; }
    if (end) { finished++; if (end.note === 'cleared') assert.equal(E.poolLeft(turn, r0), 0, 'cleared: none of the winner\'s balls left'); }
  }
  assert.ok(finished >= 3, `the computer finishes racks (${finished} of 4 in 60 shots)`);
});
