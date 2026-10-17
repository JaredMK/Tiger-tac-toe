'use strict';
// Simulations: Mini Golf. Slow, so never part of npm test:
// npm run sim -- golf
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));
const inside = (pos, S) => pos == null || (pos[0] >= -0.01 && pos[0] <= S.w + 0.01 && pos[1] >= -0.01 && pos[1] <= S.h + 0.01);

test('golf: 22 layouts made by hand, and the mirror of each that is not its own (42 holes); each with its tee, cup and walls; nothing ever leaves the table or ends inside a wall', () => {
  assert.equal(P.LAYOUTS.length, 22); assert.equal(P.HOLES.length, 42);
  assert.deepEqual(P.HOLES.slice(0, 6).map(h => h.name), ['Zigzag', 'Dogleg', 'The horseshoe', 'The funnel', 'Round the bar', 'Pinball'], 'the six there were keep their places');
  assert.equal(new Set(P.LAYOUTS.map(h => h.name)).size, 22, 'each its own');
  const key = h => JSON.stringify([h.walls.map(w => w.join()).sort(), h.bumpers.map(b => b.join()).sort(), h.cup]);
  assert.equal(new Set(P.LAYOUTS.map(key)).size, 22, 'no two alike');
  P.HOLES.forEach((h, i) => {
    const base = P.HOLES[h.of];
    if (i < 22) assert.equal(h.of, i);
    else {
      assert.equal(h.name, base.name + ', mirrored');
      assert.deepEqual([h.tee, h.cup], [[100 - base.tee[0], base.tee[1]], [100 - base.cup[0], base.cup[1]]].map(p => p.map(v => Math.round(v * 100) / 100)), 'the mirror image');
      assert.notEqual(key(h), key(base), 'not the same as the layout itself');
    }
  });
  assert.deepEqual(P.LAYOUTS.filter((_, i) => !P.HOLES.some((h, j) => j >= 22 && h.of === i)).map(h => h.name), ['The horseshoe', 'Pinball'], 'every layout but the two that are their own mirror image has its mirror');
  const rng = lcg(3);
  for (let h = 0; h < P.HOLES.length; h++) {
    const hole = P.HOLES[h];
    assert.ok(hole.tee && hole.cup && hole.name);
    for (let k = 0; k < 8; k++) {
      const m = Object.assign(mini('golf', 'esc' + h + k), { hole });
      m.hole = h;
      // the balls anywhere on the table (clear of the walls and bumpers), a hard shot in any direction
      const clear = ([x, y]) => hole.walls.every(([cx, cy, w, hh, a]) => { const c = Math.cos(a || 0), sn = Math.sin(a || 0), dx = x - cx, dy = y - cy; return Math.abs(dx * c + dy * sn) > w / 2 + P.GOLF.ballR || Math.abs(dy * c - dx * sn) > hh / 2 + P.GOLF.ballR; }) && hole.bumpers.every(([cx, cy, br]) => Math.hypot(x - cx, y - cy) > br + P.GOLF.ballR);
      const spot = () => { let q; do q = [6 + rng() * 88, 6 + rng() * 148]; while (!clear(q)); return q; };
      m.balls.X = spot(); do m.balls.O = spot(); while (Math.hypot(m.balls.O[0] - m.balls.X[0], m.balls.O[1] - m.balls.X[1]) < 2 * P.GOLF.ballR);
      const r = P.run('golf', m, 'X', { aim: (rng() - 0.5) * 2 * Math.PI, power: 0.6 + rng() * 0.4 });
      for (const p of ['X', 'O']) {
        assert.ok(inside(r.final[p], P.GOLF), `hole ${h}: ${p} stays on the table (${r.final[p]})`);
        for (const f of r.rec.frames) { const i = r.rec.ids.indexOf(p) * 2; if (f[i] != null) assert.ok(f[i] >= -1 && f[i] <= 101 && f[i + 1] >= -1 && f[i + 1] <= 161, `hole ${h}: never off the table mid-shot`); }
        if (r.final[p]) for (const [x, y, w, hh, a] of hole.walls) if (!a) assert.ok(Math.abs(r.final[p][0] - x) > w / 2 + P.GOLF.ballR - 0.6 || Math.abs(r.final[p][1] - y) > hh / 2 + P.GOLF.ballR - 0.6, `hole ${h}: ${p} does not end inside a wall`);
      }
    }
  }
});

test('golf: every hole (all 42) is solved by the computer in 2-6 shots (its best candidate each time, no error); full putt power: a full putt crosses the whole course', () => {
  const tally = [];
  for (let h = 0; h < P.HOLES.length; h++) {
    const m = mini('golf', 'solve' + h); m.hole = h; const tee = P.HOLES[h].tee; m.balls = { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] };
    let shots = 0, won = false;
    const rng = lcg(7 + h);
    while (shots < 7 && !won) {
      let best = null;
      for (const c of E.physCandidates(m, 'X', rng)) { const r = P.run('golf', m, 'X', c); const s = E.physScore(m, 'X', r); if (!best || s > best.s) best = { c, s }; }
      const r = E.applyMove(m, 'X', best.c);
      shots++;
      if (r.outcome === 'win') won = r.winner === 'X';
    }
    assert.ok(won && shots >= 2 && shots <= 6, `${P.HOLES[h].name}: holed in ${shots} shots`);
    tally.push(`${P.HOLES[h].name} ${shots}`);
    assert.ok(P.HOLES[h].walls.length + P.HOLES[h].bumpers.length >= 2 && P.HOLES[h].path.length >= 3, `${P.HOLES[h].name}: things in the way, and turns`);
  }
  console.log('Mini Golf, shots with no error: ' + tally.join(', '));
  // no cap: on an empty course a full putt from the bottom reaches the far end (and comes off it)
  P.HOLES.push({ name: 'open', tee: [50, 150], cup: [96, 150], walls: [], bumpers: [], path: [[96, 150]] });
  try {
    const open = mini('golf', 'open'); open.hole = P.HOLES.length - 1; open.balls = { X: [50, 150], O: [8, 152] };
    const far = P.run('golf', open, 'X', { aim: 0, power: 1 }), ys = far.rec.frames.map(f => f[far.rec.ids.indexOf('X') * 2 + 1]);
    assert.ok(Math.min(...ys) < P.GOLF.ballR + 2, `a full putt reaches the far end (${Math.min(...ys)})`);
    const half = P.run('golf', open, 'X', { aim: 0, power: 0.5 });
    assert.ok(150 - half.final.X[1] > 40 && 150 - half.final.X[1] < 80, `half power rolls ${(150 - half.final.X[1]).toFixed(1)}`);
  } finally { P.HOLES.pop(); }
});

test('golf: the courses make it hard: the computer, with its usual error, takes 3 to 5 putts on average on every hole (all 42)', () => {
  const avg = [];
  for (let h = 0; h < P.HOLES.length; h++) {
    const hole = P.HOLES[h];
    assert.ok(hole.walls.length + hole.bumpers.length >= 3 && hole.path.length >= 4, `${hole.name}: walls and bumpers in the way, and turns`);
    let sum = 0;
    const N = 10;
    for (let g = 0; g < N; g++) {
      const rng = E.makeRng('golf' + h + ':' + g), m = E.newMini('golf', rng); m.hole = h; m.balls = { X: hole.tee.slice(), O: [hole.tee[0] + 6, hole.tee[1]] }; m.holed = { X: false, O: false };
      let putts = 0;
      while (putts < 25) { const ai = E.physAi(m, 'X', rng), r = P.run('golf', m, 'X', ai.move); putts++; if (r.final.X === null) break; m.balls.X = r.final.X; if (r.final.O) m.balls.O = r.final.O; }
      sum += putts;
    }
    avg.push(sum / N);
  }
  console.log('Mini Golf: the computer\'s putts per hole: ' + P.HOLES.map((hh, k) => `${hh.name} ${avg[k].toFixed(2)}`).join(', '));
  assert.ok(avg.every(a => a >= 2.6 && a <= 5.6), `each hole 3 to 5 or so, on 10 tries (${avg.map(a => a.toFixed(2))})`);   // (40 tries each: all within 3 to 5)
  const all = avg.reduce((a, b) => a + b, 0) / avg.length;
  assert.ok(all >= 3 && all <= 5, `3 to 5 on average (${all.toFixed(2)})`);
  assert.ok(P.LAYOUTS.filter(hh => hh.walls.some(w => w[4])).length >= 6, 'angled walls on many layouts');
});
