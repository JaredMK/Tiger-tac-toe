'use strict';
// Run with:  node --test
// The arcade games in the shared engine (engine.js): Bullseye, Echo, Plinko, Cup Pong, Trivia and Odd One Out.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
// Play whole turns until the match is over: the computer on both sides.
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
test.before(() => E.setTriviaBank(bank(40)));

/* ===================================== Bullseye ===================================== */
test('bullseye: a small board on a field, a bullseye in its middle; a throw is where two lines stopped; bullseye 3, board 1, off 0; first to 5; the board moves after every throw', () => {
  const m = E.newMini('bullseye', lcg(1)), c = m.cfg, B = E.BULLS;
  assert.deepEqual(c, E.BULL_DEFAULTS, 'dealt with the config of the day (here the defaults)');
  assert.ok(c.bull < c.board && c.board <= 12, `a small board (${c.board} of ${B.w} across) with a smaller bullseye (${c.bull})`);
  const inside = pos => pos[0] - c.board >= 0 && pos[0] + c.board <= B.w && pos[1] - c.board >= 0 && pos[1] + c.board <= B.h;
  assert.ok(inside(m.pos), 'the whole board on the field');
  const aim = (pos, dx, dy) => ({ x: (pos[0] + dx) / B.w, y: (pos[1] + dy) / B.h });
  // a bullseye: 3, and X's lines get faster; O's untouched
  let pos = m.pos.slice();
  assert.deepEqual(E.applyMove(m, 'X', aim(pos, 0.5, -0.5), lcg(2)), { ok: true, outcome: 'continue', note: 'bull' });
  assert.deepEqual([m.pts.X, m.speed.X, m.speed.O], [3, c.ramp, 1]);
  assert.deepEqual(m.last.pos, pos, 'the throw was scored where the board was');
  assert.ok(Math.hypot(m.pos[0] - pos[0], m.pos[1] - pos[1]) >= Math.min(B.minMove, 30) && inside(m.pos), `then the board moves on (${pos} -> ${m.pos})`);
  // the board (outside the bullseye): 1
  pos = m.pos.slice();
  assert.equal(E.applyMove(m, 'O', aim(pos, c.bull + 1, 0), lcg(3)).note, 'board'); assert.deepEqual([m.pts.O, m.speed.O], [1, c.ramp]);
  // off the board: 0, and nothing gets faster
  pos = m.pos.slice();
  assert.equal(E.applyMove(m, 'O', aim(pos, 0, c.board + 0.5), lcg(4)).note, 'miss'); assert.deepEqual([m.pts.O, m.speed.O], [1, c.ramp]);
  // the edges: on the bullseye's rim is the bullseye; on the board's rim is the board
  pos = m.pos.slice();
  assert.equal(E.bullsScore(c, pos, (pos[0] + c.bull) / B.w, pos[1] / B.h).pts, 3);
  assert.equal(E.bullsScore(c, pos, (pos[0] + c.board) / B.w, pos[1] / B.h).pts, 1);
  assert.equal(E.bullsScore(c, pos, (pos[0] + c.board + 0.01) / B.w, pos[1] / B.h).pts, 0);
  // X: 3 + 1 + 1 = 5 takes the square
  pos = m.pos.slice(); E.applyMove(m, 'X', aim(pos, 0, c.bull + 1), lcg(5));
  pos = m.pos.slice(); const w = E.applyMove(m, 'X', aim(pos, -(c.bull + 1), 0), lcg(6));
  assert.deepEqual([w.outcome, m.pts.X], ['win', 5]);
  for (const bad of [0.5, { x: -0.1, y: 0.5 }, { x: 0.5, y: 1.2 }, { x: 'a', y: 0.5 }, { x: 0.5 }, null, 'x']) assert.equal(E.applyMove(E.newMini('bullseye', lcg(9)), 'O', bad).ok, false, `refused: ${JSON.stringify(bad)}`);
  // the lines: cfg.sweep ms across at the start, cfg.ramp times faster per scoring throw
  assert.equal(E.bullsPeriod(c, 1), c.sweep); assert.equal(E.bullsPeriod(c, 2), c.sweep / 2);
  assert.ok(c.sweep < 2200, 'faster than the old marker (2.2 s across)');
  // the board's spots: always whole on the field, a fair way from the last, and spread round it
  const r = lcg(7); let p0 = E.bullsSpot(c, null, r), sumX = 0;
  for (let k = 0; k < 500; k++) { const p1 = E.bullsSpot(c, p0, r); assert.ok(inside(p1)); assert.ok(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) >= B.minMove - 1e-9); sumX += p1[0]; p0 = p1; }
  assert.ok(Math.abs(sumX / 500 - B.w / 2) < 6, 'left and right alike');
});

test('bullseye: the config (board, bullseye, sweep, ramp) is checked value by value and copied into each square as dealt; older squares carry on', () => {
  E.setBullsConfig({ board: 12, bull: 3, sweep: 1000, ramp: 1.2 });
  const m = E.newMini('bullseye', lcg(1));
  assert.deepEqual(m.cfg, { board: 12, bull: 3, sweep: 1000, ramp: 1.2 });
  E.setBullsConfig({ board: 99, bull: 'x', sweep: 100, ramp: 1.1 });
  assert.deepEqual(E.bullsConfig(), Object.assign({}, E.BULL_DEFAULTS, { ramp: 1.1 }), 'anything off its range is the default');
  E.setBullsConfig({ board: 6, bull: 8 });
  assert.ok(E.bullsConfig().bull < E.bullsConfig().board, 'the bullseye never as big as the board');
  E.setBullsConfig(null);
  assert.deepEqual(m.cfg, { board: 12, bull: 3, sweep: 1000, ramp: 1.2 }, 'a square keeps the values it was dealt with');
  assert.deepEqual(E.newMini('bullseye', lcg(2)).cfg, E.BULL_DEFAULTS);
  // a square from before (the bar and its hits) plays on as a board in the middle, its hits as points
  const old = { type: 'bullseye', hits: { X: 2, O: 1 }, speed: { X: 1.5, O: 1 }, last: { by: 'X', at: 0.5, hit: true } };
  E.upgradeMini(old);
  assert.deepEqual([old.pts, old.pos, old.hits, old.cfg], [{ X: 2, O: 1 }, [50, 60], undefined, E.BULL_DEFAULTS]);
  assert.equal(E.applyMove(old, 'X', { x: 0.5, y: 0.5 }, lcg(3)).note, 'bull');
});

test('bullseye: the computer lands a bullseye about 15%, the board 45% and misses 40% at the start, slipping as its lines speed up; a timeout stops both lines at random', () => {
  const rng = lcg(5), count = speed => {
    const c = { 3: 0, 1: 0, 0: 0 };
    for (let k = 0; k < 4000; k++) { const m = E.newMini('bullseye', rng); m.speed.X = speed; const r = E.localBest(E.publicMini(m), 'X', rng); c[E.bullsScore(m.cfg, m.pos, r.move.x, r.move.y).pts]++; }
    return { bull: c[3] / 4000, board: c[1] / 4000, miss: c[0] / 4000 };
  };
  const start = count(1);
  assert.ok(Math.abs(start.bull - 0.15) < 0.025 && Math.abs(start.board - 0.45) < 0.03 && Math.abs(start.miss - 0.4) < 0.03, JSON.stringify(start));
  const fast = count(2);
  assert.ok(fast.miss > start.miss + 0.1, `worse when faster (${JSON.stringify(fast)})`);
  // throws to 5, alone on a square: about 5-7
  const throws = [];
  for (let g = 0; g < 1500; g++) {
    const r = lcg(1000 + g), m = E.newMini('bullseye', r);
    let n = 0;
    while (m.pts.X < 5 && n < 60) { assert.equal(E.applyMove(m, 'X', E.localBest(E.publicMini(m), 'X', r).move, r).ok, true); n++; }
    throws.push(n);
  }
  const mean = throws.reduce((a, b) => a + b, 0) / throws.length;
  assert.ok(mean > 5 && mean < 7.5, `the computer takes ${mean.toFixed(2)} throws to 5`);
  const st = E.newMatch(lcg(8), { games: ['bullseye'], mode: 'online', timer: 30 });
  const before = JSON.stringify(st.squares.map(q => q.mini.pts));
  const t = E.timeoutMove(st, lcg(9));
  assert.equal(t.ok, true); assert.ok(st.flash.timeout && st.flash.bull, 'the timed-out throw is a throw');
  assert.notEqual(JSON.stringify(st.squares.map(q => q.mini.pts)), before === '' ? null : undefined);
  const mv = E.randomLegalMove(E.newMini('bullseye', lcg(1)), 'X', lcg(2));
  assert.ok(mv.x >= 0 && mv.x <= 1 && mv.y >= 0 && mv.y <= 1, 'both lines somewhere on the field');
});

/* ===================================== Echo ===================================== */
test('echo: four patterns of 4, 8, 11 and 14 per player, drawn once; an attempt is judged in order; a failed pattern plays again unchanged; beating all four wins', () => {
  const m = E.newMini('echo', lcg(2));
  assert.deepEqual(m.seqs.X.map(s => s.length), [4, 8, 11, 14]); assert.deepEqual(m.seqs.O.map(s => s.length), [4, 8, 11, 14]);
  assert.notDeepEqual(m.seqs.X, m.seqs.O, 'each player their own');
  assert.ok(m.seqs.X.flat().every(k => k >= 0 && k < 4));
  const s0 = m.seqs.X[0].slice();
  const wrong = s0.slice(0, 2).concat((s0[2] + 1) % 4);
  assert.deepEqual(E.applyMove(m, 'X', wrong), { ok: true, outcome: 'continue', note: 'fail' });
  assert.deepEqual([m.last.failAt, m.last.pass, m.level.X], [2, false, 0], 'wrong at the third step: no progress');
  assert.deepEqual(m.seqs.X[0], s0, 'the same pattern waits for the next attempt');
  assert.equal(E.applyMove(m, 'X', s0.slice(0, 3)).note, 'fail', 'short of the end: a fail');
  assert.equal(m.last.failAt, 3);
  assert.deepEqual(E.applyMove(m, 'X', s0), { ok: true, outcome: 'continue', note: 'pass' });
  assert.equal(m.level.X, 1, 'on to the 8-step pattern');
  assert.equal(E.applyMove(m, 'X', 'auto').note, 'fail', 'a timeout: a failed attempt');
  assert.equal(m.last.len, 8);
  for (const bad of [[0, 1, 2, 3, 4], [0, 0, 0, 0, 0, 0, 0, 0, 0], 'pass', 7, [-1]]) assert.equal(E.applyMove(m, 'X', bad).ok, false, `refused: ${JSON.stringify(bad)}`);
  for (let l = 1; l < 4; l++) { const r = E.applyMove(m, 'X', m.seqs.X[l]); assert.equal(r.note, 'pass'); assert.equal(r.outcome, l < 3 ? 'continue' : 'win', `pattern ${l + 1}`); }
  assert.equal(m.level.X, 4); assert.equal(m.level.O, 0);
  assert.equal(E.applyMove(m, 'X', [0]).reason, 'done');
  // the computer's attempts: right as often as the length allows, and its taps come from the pattern
  const rng = lcg(9);
  for (const [level, want] of [[0, 0.95], [1, 0.75], [2, 0.5], [3, 0.3]]) {
    let pass = 0;
    for (let k = 0; k < 1500; k++) {
      const mm = E.newMini('echo', lcg(k + 1)); mm.level.O = level;
      const plan = E.localBest(E.publicMini(mm), 'O', rng), taps = E.cpuEcho(mm, 'O', plan.move, rng);
      const r = E.applyMove(mm, 'O', taps);
      assert.equal(r.ok, true);
      if (r.note === 'pass' || r.outcome === 'win') pass++;
    }
    assert.ok(Math.abs(pass / 1500 - want) < 0.05, `level ${level}: ${pass / 1500} passed (wanted ~${want})`);
  }
});

/* ===================================== Plinko ===================================== */
test('plinko: seven slots, six rows, seven bins; the path is drawn at the drop; the walls turn the chip inward; the odds from every slot', () => {
  const m = E.newMini('plinko', lcg(3));
  assert.ok(m.win >= 0 && m.win < 7);
  const r = E.applyMove(m, 'X', 3, lcg(4));
  assert.equal(r.ok, true);
  assert.equal(m.last.path.length, 6);
  const x = 6 + m.last.path.reduce((t, right) => t + (right ? 1 : -1), 0);
  assert.equal(m.last.bin, x / 2, 'the bin is where the path leads');
  assert.equal(r.outcome, m.last.bin === m.win ? 'win' : 'continue');
  for (let k = 0; k < 300; k++) { const mm = E.newMini('plinko', lcg(k)); E.applyMove(mm, 'O', k % 7, lcg(k * 7 + 1)); assert.ok(mm.last.bin >= 0 && mm.last.bin <= 6 && Number.isInteger(mm.last.bin), 'always a bin'); }
  for (const bad of [-1, 7, 2.5, 'x']) assert.equal(E.applyMove(m, 'X', bad).ok, false);
  // the odds: every row sums to one, the middle is the most likely from the middle, the walls pile up beside them
  const rows = [];
  for (let s = 0; s < 7; s++) { const o = E.plinkoOdds(s); assert.ok(Math.abs(o.reduce((a, b) => a + b, 0) - 1) < 1e-9); rows.push(o.map(v => Math.round(v * 100))); }
  console.log('Plinko: the chance (%) of each bin from each slot');
  rows.forEach((row, s) => console.log(`  slot ${s}: ${row.map(v => String(v).padStart(3)).join('')}`));
  assert.deepEqual(rows[3], [2, 9, 23, 31, 23, 9, 2]);
  assert.deepEqual(rows[0], [31, 47, 19, 3, 0, 0, 0], 'from the edge: more often one in than straight down');
  // simulated drops agree with the table
  const rng = lcg(11), hit = new Array(7).fill(0), N = 20000;
  for (let k = 0; k < N; k++) hit[E.plinkoPath(3, rng).bin]++;
  hit.forEach((h, b) => assert.ok(Math.abs(h / N - E.plinkoOdds(3)[b]) < 0.02, `bin ${b}: ${h / N} (table ${E.plinkoOdds(3)[b]})`));
  // the computer drops above the WIN bin
  for (let w = 0; w < 7; w++) assert.equal(E.localBest({ type: 'plinko', win: w }, 'X', rng).move, w);
});

/* ===================================== Cup Pong ===================================== */
test('cup pong: an aim and a power; the ball lands with a little scatter; a good aim sinks about 40-50% of throws, rims some, and sinking all three cups wins', () => {
  const m = E.newMini('pong', lcg(5));
  const rng = lcg(6);
  let sunk = 0, rims = 0, N = 4000;
  for (let k = 0; k < N; k++) { const a = E.pongAimAt(0), t = E.pongThrow([true, true, true], a.aim, a.power, rng); if (t.sunk) sunk++; else if (t.rim) rims++; }
  console.log(`Cup Pong: a throw aimed at the front cup sinks ${(sunk / N * 100).toFixed(1)}%, rims out ${(rims / N * 100).toFixed(1)}%`);
  assert.ok(sunk / N >= 0.4 && sunk / N <= 0.5, `the make rate of a good aim (${sunk / N})`);
  assert.ok(rims / N > 0.1 && rims / N < 0.35, `rim bounces that fall off (${rims / N})`);
  let r = E.applyMove(m, 'X', { aim: 0, power: 0.6 }, lcg(7));
  assert.equal(r.ok, true);
  assert.ok(['sunk', 'rim', 'miss'].includes(r.note));
  assert.ok(Math.abs(m.last.y - E.pongDist(0.6)) < 0.25 && Math.abs(m.last.x) < 0.25, 'lands about where it was thrown');
  const far = E.applyMove(m, 'O', { aim: 1, power: 1 }, lcg(8));
  assert.ok(far.ok && m.last.x > 0.2 && m.last.cup === null && m.last.note !== 'sunk', 'thrown hard to the right: off the rack');
  for (const bad of [{ aim: 'x', power: 1 }, {}, 5, [1, 1]]) assert.equal(E.applyMove(m, 'X', bad).ok, false);
  assert.equal(E.applyMove(m, 'X', { aim: 9, power: -2 }, lcg(9)).ok, true, 'out-of-range numbers are clamped');
  assert.ok(m.last.aim === 1 && m.last.power === 0);
  // play on until X has sunk all three
  const mm = E.newMini('pong', lcg(5)), rr = lcg(12);
  let n = 0, win = null;
  while (n++ < 200 && !win) { const a = E.pongAimAt(mm.cups.X.indexOf(true)); const res = E.applyMove(mm, 'X', a, rr); if (res.outcome === 'win') win = res; }
  assert.ok(win && mm.cups.X.every(c => !c) && mm.cups.O.every(c => c), 'X\'s cups all down, O\'s all up');
  assert.equal(E.applyMove(mm, 'X', 'auto', rr).ok, true, 'a timed-out throw is a random one');
  // the computer: aimed at a cup still standing, about 45% made
  let made = 0;
  for (let k = 0; k < 2000; k++) { const g = E.newMini('pong', lcg(k)); const b = E.localBest(E.publicMini(g), 'X', rr); const res = E.applyMove(g, 'X', b.move, rr); if (res.note === 'sunk' || res.outcome === 'win') made++; }
  console.log(`Cup Pong: the computer makes ${(made / 2000 * 100).toFixed(1)}% on a full rack`);
  assert.ok(made / 2000 > 0.38 && made / 2000 < 0.52, `the computer's make rate (${made / 2000})`);
  let last = 0;                                                       // one cup left: the harder shot, still made often enough to finish
  for (let k = 0; k < 2000; k++) { const g = E.newMini('pong', lcg(k)); g.cups.X[0] = false; g.cups.X[1] = false; const b = E.localBest(E.publicMini(g), 'X', rr); if (E.applyMove(g, 'X', b.move, rr).outcome === 'win') last++; }
  assert.ok(last / 2000 > 0.25, `the last cup (${last / 2000})`);
});

/* ===================================== Trivia ===================================== */
test('trivia: one question a square, shared; a wrong pick is crossed out for both and the question stays, the right answer never shown; the next turn there carries on; right scores and a new question comes; three right wins', () => {
  const st = E.newMatch(lcg(21), { games: ['trivia'] });
  const asks = [];
  for (const sq of st.squares) { const a = sq.mini.ask; assert.equal(sq.mini.type, 'trivia'); assert.ok(a && a.id && a.q && a.opts.length === 4, 'a question dealt'); asks.push(a.id); assert.equal(a.opts[sq.mini.answer], 'Right ' + a.id.slice(1), 'the right answer is where answer says'); assert.deepEqual(sq.mini.crossed, []); }
  assert.equal(new Set(asks).size, 9, 'nine different questions across the nine squares');
  const sq = st.squares[0], m = sq.mini, q0 = m.ask.id, right = m.answer, wrongs = [0, 1, 2, 3].filter(k => k !== right);
  // X picks wrong: crossed out, no point, the same question, and nothing in the result says which is right
  let r = E.playMove(st, 0, wrongs[0], lcg(1));
  assert.equal(r.ok, true); assert.equal(r.flash.trivia.correct, false);
  assert.equal(r.flash.trivia.right, undefined, 'a wrong pick never reveals the right answer'); assert.equal(m.last.right, undefined);
  assert.deepEqual(r.flash.trivia.crossed, [], 'what was crossed out before this pick'); assert.equal(r.flash.trivia.picked, wrongs[0]);
  assert.equal(m.right.X, 0); assert.equal(m.ask.id, q0, 'the question stays'); assert.deepEqual(m.crossed, [wrongs[0]]);
  E.endFlash(st); E.leaveSquare(st);
  assert.equal(st.turn, 'O');
  // O carries on with the same question; the crossed-out option cannot be picked again
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(m)), 'O', wrongs[0]).reason, 'crossed');
  r = E.playMove(st, 0, wrongs[1], lcg(2));
  assert.equal(r.ok, true); assert.deepEqual(r.flash.trivia.crossed, [wrongs[0]]); assert.deepEqual(m.crossed, [wrongs[0], wrongs[1]]); assert.equal(m.ask.id, q0);
  E.endFlash(st); E.leaveSquare(st);
  // X's timeout: one wrong pick, the last wrong option crossed out (never the right one)
  r = E.playMove(st, 0, 'auto', lcg(3));
  assert.equal(r.ok, true); assert.equal(r.flash.trivia.picked, wrongs[2]); assert.ok(r.flash.trivia.auto); assert.equal(r.flash.trivia.right, undefined);
  assert.deepEqual(m.crossed.slice().sort(), wrongs.slice().sort()); assert.equal(m.ask.id, q0);
  E.endFlash(st); E.leaveSquare(st);
  // only the right one left: a timeout now crosses nothing
  const only1 = JSON.parse(JSON.stringify(m)); const ra = E.applyMove(only1, 'O', 'auto', lcg(4));
  assert.equal(ra.note, 'wrong'); assert.equal(only1.last.picked, -1); assert.deepEqual(only1.crossed, m.crossed); assert.equal(only1.right.O, 0);
  // O takes the right one: a point, the answer shown with it, and a new question dealt (crossed cleared)
  r = E.playMove(st, 0, right, lcg(5));
  assert.equal(r.flash.trivia.correct, true); assert.equal(r.flash.trivia.right, right); assert.equal(m.right.O, 1);
  assert.ok(m.ask && m.ask.id !== q0 && !asks.includes(m.ask.id), 'a new question, not one asked anywhere in the match');
  assert.deepEqual(m.crossed, []); assert.deepEqual(m.asked, [q0]);
  E.endFlash(st); E.leaveSquare(st);
  for (const bad of [4, -1, 'x', 1.5]) assert.equal(E.applyMove(m, 'O', bad).ok, false);
  let n = 0;
  while (!sq.owner && n++ < 30) { if (st.turn === 'O') E.playMove(st, 0, m.answer, lcg(n)); else E.playMove(st, 0, 'auto', lcg(n)); E.endFlash(st); E.leaveSquare(st); }
  assert.equal(sq.owner, 'O', 'three right: O takes the square');
  // the computer: right about 65% of the time with four options, more as they are crossed out, never a crossed one
  const rng = lcg(31);
  for (const [cross, want] of [[0, 0.65], [1, 0.69], [2, 0.77]]) {
    let ok = 0;
    for (let k = 0; k < 3000; k++) {
      const g = E.newMatch(lcg(k), { games: ['trivia'] }), gm = g.squares[0].mini;
      gm.crossed = [0, 1, 2, 3].filter(i => i !== gm.answer).slice(0, cross);
      const b = E.localBest(E.publicMini(gm), 'X', rng);
      assert.ok(!gm.crossed.includes(b.move), 'never a crossed-out option');
      if (b.move === gm.answer) ok++;
    }
    assert.ok(Math.abs(ok / 3000 - want) < 0.035, `${cross} crossed: right ${ok / 3000} (wanted ~${want})`);
  }
  // the whole bank asked: questions come round again rather than the game stalling
  E.setTriviaBank(bank(3));
  const small = E.newMatch(lcg(41), { games: ['trivia'] });
  assert.ok(small.squares.every(q => q.mini.ask && q.mini.ask.q), 'every square still has its question');
  E.setTriviaBank(bank(40));
  // no bank: no question, and a Trivia square is one nobody can move in (it resets like a dead square)
  E.setTriviaBank(null);
  const none = E.newMini('trivia', lcg(1));
  assert.equal(E.canMove(none, 'X'), false);
  assert.equal(E.applyMove(none, 'X', 0).reason, 'noquestion');
  E.setTriviaBank(bank(40));
  // a square from when each player had their own question: it keeps one of them and plays on
  const old = { type: 'trivia', right: { X: 1, O: 0 }, ask: { X: { id: 'q5', q: 'Question 5?', cat: 'Science', opts: ['a', 'b', 'c', 'd'] }, O: null }, answers: { X: 2, O: null }, asked: ['q1'], last: null };
  E.upgradeMini(old);
  assert.deepEqual([old.ask.id, old.answer, old.crossed, old.answers], ['q5', 2, [], undefined]);
  assert.equal(E.applyMove(old, 'O', 2).note, 'right');
});

test('trivia: online, the right answer stays on the server until someone picks it; a wrong pick tells nobody which is right', () => {
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('trivia'), timer: 60 }, lcg(51), 'tq1');
  const pub = rec.state.squares[0].mini;
  assert.equal(pub.answer, undefined, 'nothing in the public state says which answer is right');
  assert.ok(pub.ask.opts.length === 4 && pub.ask.q, 'the question and its options are there');
  assert.ok(Number.isInteger(rec.secrets[0].answer), 'the answer is in the secrets');
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(pub)), 'X', 0).reason, 'secret', 'a phone cannot judge a guess by itself');
  const right = rec.secrets[0].answer, wrong = (right + 1) % 4;
  let r = E.applyOnlineMove(rec, 'X', 0, wrong, lcg(52));
  assert.equal(r.ok, true); assert.equal(r.entries[0].trivia.correct, false);
  const leak = JSON.stringify(r.entries[0]) + JSON.stringify(r.rec.state);
  assert.equal(r.entries[0].trivia.right, undefined, 'the result of a wrong pick: no right answer in it');
  assert.ok(!/"right":\d/.test(leak) && !/"answer":\d/.test(leak), 'nor anywhere in what the phones get');
  assert.deepEqual(r.rec.state.squares[0].mini.crossed, [wrong], 'crossed out, for both phones'); assert.equal(r.rec.state.squares[0].mini.ask.id, pub.ask.id);
  r = E.applyOnlineMove(r.rec, 'O', 0, right, lcg(53));
  assert.equal(r.ok, true); assert.equal(r.entries[0].trivia.correct, true, 'the server judges and tells both phones');
  assert.equal(r.entries[0].trivia.right, right, 'the right answer shows with the right pick');
  const after = r.rec.state.squares[0].mini;
  assert.equal(after.answer, undefined, 'the next question\'s answer is hidden again'); assert.notEqual(after.ask.id, pub.ask.id);
  assert.ok(Number.isInteger(r.rec.secrets[0].answer));
});

/* ===================================== Odd One Out ===================================== */
test('odd one out: exactly one tile differs, in lightness (and a touch in hue); 3x3 clear, then 4x4, then 5x5 subtle; a wrong tap shows the odd one; three finds win', () => {
  const m = E.newMini('oddone', lcg(61));
  for (const p of ['X', 'O']) {
    const g = m.grid[p];
    assert.equal(g.n, 3); assert.equal(g.tiles.length, 9);
    assert.equal(g.tiles.filter(c => c === g.odd).length, 1, 'exactly one odd tile');
    assert.equal(g.tiles[m.pos[p]], g.odd, 'at pos');
    assert.notEqual(g.base, g.odd);
  }
  const L = c => Number(c.match(/ (\d+)%\)$/)[1]), H = c => Number(c.match(/^hsl\((\d+) /)[1]);
  const lv = (level) => { const gs = []; for (let k = 0; k < 40; k++) gs.push(E.oddGrid(level, lcg(k * 3 + level))); return gs; };
  for (const [level, n, dl] of [[0, 3, 16], [1, 4, 10], [2, 5, 6], [5, 5, 6]]) {
    for (const g of lv(level)) {
      assert.equal(g.grid.n, n);
      assert.equal(Math.abs(L(g.grid.odd) - L(g.grid.base)), dl, `level ${level}: the lightness step is ${dl}`);
      assert.ok(Math.abs(H(g.grid.odd) - H(g.grid.base)) % 360 <= 6, 'hue a touch off');
      assert.ok(L(g.grid.odd) >= 30 && L(g.grid.odd) <= 80 && L(g.grid.base) >= 42 && L(g.grid.base) <= 62, 'never near black or white');
      assert.equal(g.grid.tiles.filter(c => c === g.grid.odd).length, 1);
    }
  }
  const pos = m.pos.X, wrong = (pos + 1) % 9;
  let r = E.applyMove(m, 'X', wrong, lcg(1));
  assert.deepEqual([r.note, m.last.correct, m.last.pos, m.finds.X], ['wrong', false, pos, 0], 'a wrong tap: no progress, the odd tile told');
  assert.equal(m.grid.X.n, 3, 'still 3x3');
  assert.notEqual(m.pos.X, undefined);
  r = E.applyMove(m, 'X', m.pos.X, lcg(2));
  assert.deepEqual([r.note, m.finds.X, m.grid.X.n], ['found', 1, 4], 'a find: a 4x4 next');
  assert.equal(E.applyMove(m, 'X', m.pos.X, lcg(3)).note, 'found'); assert.equal(m.grid.X.n, 5);
  assert.equal(E.applyMove(m, 'X', 'auto', lcg(4)).note, 'wrong', 'a timeout counts as wrong');
  assert.deepEqual(E.applyMove(m, 'X', m.pos.X, lcg(5)), { ok: true, outcome: 'win', note: 'found' });
  assert.equal(m.grid.O.n, 3, 'O still at the start');
  for (const bad of [25, -1, 'x']) assert.equal(E.applyMove(m, 'O', bad).ok, false);
  // the computer: a find 90%, 70%, then 50% of the time
  const rng = lcg(71);
  for (const [finds, want] of [[0, 0.9], [1, 0.7], [2, 0.5]]) {
    let ok = 0;
    for (let k = 0; k < 1500; k++) { const g = E.newMini('oddone', lcg(k)); g.finds.X = finds; const n = E.oddGrid(finds, lcg(k + 9)); g.grid.X = n.grid; g.pos.X = n.pos; if (E.localBest(E.publicMini(g), 'X', rng).move === n.pos) ok++; }
    assert.ok(Math.abs(ok / 1500 - want) < 0.04, `${finds} finds: ${ok / 1500} (wanted ~${want})`);
  }
});

test('odd one out: online, the odd tile\'s place stays on the server until the tap', () => {
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('oddone'), timer: 60 }, lcg(81), 'od1');
  const pub = rec.state.squares[0].mini;
  assert.equal(pub.pos, undefined);
  assert.ok(pub.grid.X.tiles.length === 9, 'the tiles to draw are public');
  assert.ok(Number.isInteger(rec.secrets[0].pos.X));
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(pub)), 'X', 0).reason, 'secret');
  const r = E.applyOnlineMove(rec, 'X', 0, rec.secrets[0].pos.X, lcg(82));
  assert.equal(r.ok, true); assert.equal(r.entries[0].odd.correct, true);
  assert.equal(r.rec.state.squares[0].mini.pos, undefined); assert.ok(Number.isInteger(r.rec.secrets[0].pos.X));
});

/* ===================================== all together ===================================== */
test('the arcade games: random moves are legal, timeouts work, and matches of the computer against itself finish', () => {
  const rng = lcg(91);
  for (const t of ['bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone']) {
    for (let k = 0; k < 30; k++) {
      const st = E.newMatch(lcg(k), { games: [t] }), m = st.squares[0].mini;
      const mv = E.randomLegalMove(m, 'X', rng);
      assert.equal(E.playMove(st, 0, mv, rng).ok, true, `${t}: a random move (${JSON.stringify(mv)})`);
    }
    const st = E.newMatch(lcg(7), { games: [t], mode: 'online', timer: 60 });
    const r = E.timeoutMove(st, rng);
    assert.equal(r.ok, true, `${t}: a timeout move`);
    assert.equal(st.lock, null, `${t}: the turn ends`);
    const { st: done, n } = cpuMatch([t], 3 + t.length);
    assert.ok(done.winner, `${t}: a match of the computer against itself finishes (${n} moves)`);
    assert.ok(n < 400, `${t}: in reasonable time (${n} moves)`);
  }
  const { st, n } = cpuMatch(['bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'ttt'], 99);
  assert.ok(st.winner, `all six together: finishes (${n} moves)`);
  // each of the six's playback timings are set, under a few seconds
  for (const t of ['bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone']) {
    const st2 = E.newMatch(lcg(5), { games: [t] });
    const r = E.playMove(st2, 0, E.randomLegalMove(st2.squares[0].mini, 'X', rng), rng);
    const ms = E.playMs(r.flash);
    assert.ok(ms >= 500 && ms <= 3500, `${t}: plays in ${ms} ms`);
  }
});
