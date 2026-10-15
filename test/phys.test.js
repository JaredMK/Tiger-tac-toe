'use strict';
// Run with:  node --test
// Mini Golf, Pool and Bowling: the physics (physics.js on Matter.js) and the rules in the shared engine.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const mini = (t, seed) => E.newMini(t, E.makeRng(seed || t));
function cpuMatch(games, seed, guard = 900) {
  const rng = lcg(seed), st = E.newMatch(rng, { games });
  let n = 0;
  while (!st.winner && n++ < guard) {
    const m = E.cpuMove(st, rng);
    const r = E.playMove(st, m.square, m.move, rng);
    assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
    E.endFlash(st);
  }
  return { st, n };
}
const inside = (pos, S) => pos == null || (pos[0] >= -0.01 && pos[0] <= S.w + 0.01 && pos[1] >= -0.01 && pos[1] <= S.h + 0.01);

/* ===================================== the physics ===================================== */
test('physics: a shot is played out in fixed steps and recorded 30 times a second; the same shot gives the same recording, twice', () => {
  const m = mini('pool', 'det');
  const a = P.run('pool', m, 'X', { aim: 0.05, power: 0.7 }), b = P.run('pool', m, 'X', { aim: 0.05, power: 0.7 });
  assert.deepEqual(a.rec, b.rec, 'identical recordings'); assert.deepEqual(a.final, b.final); assert.deepEqual(a.events, b.events);
  assert.equal(a.rec.fps, 30); assert.deepEqual(a.rec.ids, ['cue', 'x1', 'x2', 'o1', 'o2', 'black']);
  assert.equal(a.rec.frames[0].length, 12, 'x and y per ball per frame');
  assert.ok(Math.abs(a.rec.frames.length / 30 * 1000 - a.ms) < 40, 'the time of the recording');
  assert.ok(a.rec.frames.length > 30 && a.ms <= P.POOL.maxT * 1000 + 100);
  assert.equal(a.events[a.events.length - 1].k, 'stop');
  assert.ok(JSON.stringify(a.rec).length < 40000, `the recording stays small (${JSON.stringify(a.rec).length} bytes)`);
});

test('golf: six holes, each with its tee, cup and walls; nothing ever leaves the table or ends inside a wall', () => {
  assert.equal(P.HOLES.length, 6);
  const rng = lcg(3);
  for (let h = 0; h < P.HOLES.length; h++) {
    const hole = P.HOLES[h];
    assert.ok(hole.tee && hole.cup && hole.name);
    for (let k = 0; k < 25; k++) {
      const m = Object.assign(mini('golf', 'esc' + h + k), { hole });
      m.hole = h;
      // the balls anywhere on the table, a hard shot in any direction
      m.balls.X = [6 + rng() * 88, 6 + rng() * 148]; m.balls.O = [6 + rng() * 88, 6 + rng() * 148];
      const r = P.run('golf', m, 'X', { aim: (rng() - 0.5) * 2 * Math.PI, power: 0.6 + rng() * 0.4 });
      for (const p of ['X', 'O']) {
        assert.ok(inside(r.final[p], P.GOLF), `hole ${h}: ${p} stays on the table (${r.final[p]})`);
        for (const f of r.rec.frames) { const i = r.rec.ids.indexOf(p) * 2; if (f[i] != null) assert.ok(f[i] >= -1 && f[i] <= 101 && f[i + 1] >= -1 && f[i + 1] <= 161, `hole ${h}: never off the table mid-shot`); }
        if (r.final[p]) for (const [x, y, w, hh, a] of hole.walls) if (!a) assert.ok(Math.abs(r.final[p][0] - x) > w / 2 + P.GOLF.ballR - 0.6 || Math.abs(r.final[p][1] - y) > hh / 2 + P.GOLF.ballR - 0.6, `hole ${h}: ${p} does not end inside a wall`);
      }
    }
  }
});

test('golf: the ball drops in the cup only when slow enough, else it lips out; the first ball in takes the square, even knocked in by the other', () => {
  const m = mini('golf', 'cup'); m.hole = 0;
  const cup = P.HOLES[0].cup;
  m.balls.X = [cup[0], cup[1] + 36]; m.balls.O = [90, 150];
  const soft = E.applyMove(JSON.parse(JSON.stringify(m)), 'X', { aim: 0, power: 0.45 });
  assert.deepEqual([soft.outcome, soft.note, soft.winner], ['win', 'holed', 'X'], 'a soft putt drops');
  const hard = JSON.parse(JSON.stringify(m)), hr = E.applyMove(hard, 'X', { aim: 0, power: 0.9 });
  assert.equal(hr.outcome, 'continue'); assert.equal(hr.note, 'lip', 'a hard one lips out');
  assert.ok(hard.last.events.some(e => e.k === 'lip') && !hard.holed.X && hard.balls.X[1] !== m.balls.X[1]);
  assert.equal(hard.shots.X, 1);
  // the other ball, sitting by the cup, knocked in: the square goes to its owner
  const knock = mini('golf', 'knock'); knock.hole = 0;
  knock.balls.O = [cup[0], cup[1] + 7]; knock.balls.X = [cup[0], cup[1] + 30];
  const kr = E.applyMove(knock, 'X', { aim: 0, power: 0.32 });
  assert.equal(kr.outcome, 'win'); assert.equal(kr.winner, 'O', `O's ball went in first (${kr.note})`);
  assert.ok(knock.holed.O);
  for (const bad of [null, 'x', { aim: 'a', power: 0.5 }, { aim: 0, power: 1.5 }, { aim: 4, power: 0.5 }]) assert.equal(E.applyMove(mini('golf', 'b'), 'X', bad).ok, false);
});

test('golf: every hole is solved by the computer in 2-4 shots (its best candidate, no error)', () => {
  for (let h = 0; h < P.HOLES.length; h++) {
    const m = mini('golf', 'solve' + h); m.hole = h; const tee = P.HOLES[h].tee; m.balls = { X: [tee[0] - 3, tee[1]], O: [tee[0] + 3, tee[1]] };
    let shots = 0, won = false;
    const rng = lcg(7 + h);
    while (shots < 6 && !won) {
      let best = null;
      for (const c of E.physCandidates(m, 'X', rng)) { const r = P.run('golf', m, 'X', c); const s = E.physScore(m, 'X', r); if (!best || s > best.s) best = { c, s }; }
      const r = E.applyMove(m, 'X', best.c);
      shots++;
      if (r.outcome === 'win') won = r.winner === 'X';
    }
    assert.ok(won && shots >= 1 && shots <= 4, `${P.HOLES[h].name}: holed in ${shots} shots`);
    console.log(`${P.HOLES[h].name}: ${shots} shot${shots === 1 ? '' : 's'}`);
  }
});

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

test('pool: balls never leave the table nor end overlapping; pockets take what rolls into them', () => {
  const rng = lcg(11);
  let pocketed = 0;
  for (let k = 0; k < 40; k++) {
    const m = mini('pool', 'tbl' + k);
    const r = P.run('pool', m, 'X', { aim: (rng() - 0.5) * 1.2, power: 0.5 + rng() * 0.5 });
    const up = Object.entries(r.final).filter(([, v]) => v);
    for (const [id, v] of up) assert.ok(inside(v, P.POOL), `${id} on the table (${v})`);
    for (let i = 0; i < up.length; i++) for (let j = i + 1; j < up.length; j++) assert.ok(Math.hypot(up[i][1][0] - up[j][1][0], up[i][1][1] - up[j][1][1]) >= P.POOL.ballR * 2 - 0.3, `${up[i][0]} and ${up[j][0]} do not overlap`);
    pocketed += r.result.pocketed.length;
    for (const id of r.result.pocketed) assert.equal(r.final[id], null, 'a pocketed ball is gone');
  }
  assert.ok(pocketed > 3, `hard shots pocket something now and then (${pocketed})`);
});

test('bowling: a fresh rack of ten every roll; the pins down go on the roller\'s total; a strike is ten; a wide roll is a gutter ball; 25 takes the square', () => {
  const m = mini('bowling', 'b');
  assert.deepEqual(m.pins, { X: 0, O: 0 }); assert.equal(P.BOWL.pins.length, 10);
  const r = E.applyMove(m, 'X', { aim: 0, power: 0.85 });
  assert.equal(r.outcome, 'continue'); assert.ok(m.pins.X >= 3 && m.pins.X <= 10, `a straight roll knocks a few (${m.pins.X})`); assert.equal(m.rolls.X, 1);
  assert.equal(m.last.down.filter(Boolean).length, m.last.knocked);
  const g = E.applyMove(m, 'O', { aim: 0.45, power: 0.9 });
  assert.equal(g.note, 'gutter'); assert.equal(m.pins.O, 0); assert.ok(m.last.gutter);
  const before = m.pins.X;
  E.applyMove(m, 'X', { aim: 0, power: 0.85 });
  assert.ok(m.pins.X > before, 'a fresh rack: the same roll knocks pins again');
  // the best angle of the computer's: a strike comes up over a few racks
  let strike = false; const rng = lcg(5);
  for (let k = 0; k < 12 && !strike; k++) { const t = mini('bowling', 'strike' + k); const ai = E.physAi(t, 'X', rng); const rr = E.applyMove(t, 'X', ai.move); if (rr.note === 'strike') strike = true; assert.ok(t.pins.X <= 10); }
  assert.ok(strike, 'a strike within a dozen computer rolls');
  const w = mini('bowling', 'w'); w.pins.X = 20;
  let n = 0; while (w.pins.X < 25 && n++ < 10) { const rr = E.applyMove(w, 'X', { aim: 0, power: 0.85 }); if (rr.outcome === 'win') { assert.equal(rr.note, 'pins'); break; } }
  assert.ok(w.pins.X >= 25);
});

test('physics games: the flash carries the recording and the playback time follows it; timeouts are gentle random shots; the match state stays plain JSON', () => {
  const st = E.newMatch(lcg(9), { games: ['golf', 'pool', 'bowling'] });
  for (const t of ['golf', 'pool', 'bowling']) {
    const i = st.squares.findIndex(s => s.mini.type === t && !s.owner);
    const mv = E.randomLegalMove(st.squares[i].mini, st.turn, lcg(1));
    assert.ok(mv.power >= 0.2 && mv.power <= 0.75, `${t}: a gentle shot (${mv.power})`);
    const r = E.playMove(st, i, mv, lcg(2));
    assert.equal(r.ok, true, `${t}: ${r.reason}`);
    assert.ok(st.flash.phys && st.flash.phys.rec && st.flash.phys.rec.frames.length > 10, `${t}: the recording is in the flash`);
    assert.equal(E.playMs(st.flash), st.flash.phys.ms + (t === 'golf' ? E.GOLF.hold : t === 'pool' ? E.POOLG.hold : E.BOWLG.hold) + (st.flash.kind === 'claim' ? 600 : 0) + (t === 'bowling' && st.flash.phys.strike ? 500 : 0));
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st);
    E.endFlash(st);
  }
  assert.equal(E.secretOf(st.squares[0].mini), null, 'nothing hidden: the table is in the open');
  assert.ok(E.TEST_TYPES.includes('golf') && E.TEST_TYPES.includes('pool') && E.TEST_TYPES.includes('bowling'), 'admin only to begin with');
});

test('physics games: the computer against the computer finishes matches of each, and of all three with the rest', () => {
  for (const [games, seed] of [[['golf'], 1], [['pool'], 2], [['bowling'], 3], [['golf', 'pool', 'bowling', 'ttt', 'dash'], 4]]) {
    const t0 = Date.now();
    const { st, n } = cpuMatch(games, seed);
    assert.ok(st.winner, `${games.join('+')}: a winner after ${n} moves`);
    assert.ok(n < 300, `${games.join('+')}: within 300 moves (${n})`);
    console.log(`${games.join('+')}: ${n} moves, ${Date.now() - t0} ms`);
  }
});
