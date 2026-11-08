'use strict';
// Snake: its rules and AI, test by test (npm test). The engine is the one the page and the server run; the
// game's own names come from its rules.js (the engine does not list them).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/snake/rules.js');
const A = require('../../src/games/snake/ai.js');

const mini = (seed, score) => { const m = E.newMini('snake', E.makeRng('snake-t:' + (seed || 1))); if (score) m.score = Object.assign({ X: 0, O: 0 }, score); return m; };
const clone = v => JSON.parse(JSON.stringify(v));
const cfg = () => E.tuneLive('snake');

/* ===================================== Snake ===================================== */
test('snake: a fresh square (the apples\' seed, nothing eaten), a public view with nothing hidden but a run\'s log', () => {
  const m = mini(3);
  assert.equal(m.type, 'snake');
  assert.deepEqual(m.score, { X: 0, O: 0 }); assert.deepEqual(m.tries, { X: 0, O: 0 }); assert.equal(m.last, null);
  assert.ok(Number.isInteger(m.seed.X) && m.seed.X === m.seed.O, 'one seed, each player\'s attempts their own (the player and the attempt number are in it)');
  const r = E.applyMove(m, 'X', R.snakeAi(m, 'X', E.makeRng('a')).move, E.makeRng('x'));
  assert.equal(r.ok, true);
  const pub = E.publicMini(m);
  assert.ok(pub.last && !('log' in pub.last) && 'log' in m.last, 'the log rides the move\'s flash, never the square');
  assert.equal(pub.score.X, m.score.X);
});
test('snake: the snake starts in the middle heading right, moves a cell a tick, grows on an apple, dies on the wall and on itself', () => {
  const m = mini(5), s = R.snakeStart(m, 'X');
  assert.deepEqual(s.body, [[5, 5], [4, 5], [3, 5]]); assert.equal(s.dir, 0); assert.ok(s.apple && s.apple.length === 3);
  R.snakeTick(s, null);
  assert.deepEqual(s.body[0], [6, 5]); assert.equal(s.body.length, 3); assert.equal(s.k, 1); assert.equal(s.ms, cfg().tick);
  // straight into the wall: 4 more cells, then the wall
  for (let i = 0; i < 4; i++) R.snakeTick(s, null);
  assert.equal(s.end, null); assert.deepEqual(s.body[0], [10, 5]);
  R.snakeTick(s, null);
  assert.equal(s.end, 'wall');
  // an apple put right ahead: eaten, the snake a cell longer, the next apple placed elsewhere
  const t = R.snakeStart(m, 'X'); t.apple = [6, 5, 0];
  R.snakeTick(t, null);
  assert.equal(t.ate, 1); assert.equal(t.eaten, 1); assert.equal(t.body.length, 4); assert.equal(t.last, 'eat');
  assert.ok(t.apple && !(t.apple[0] === 6 && t.apple[1] === 5), 'a new apple on a free cell');
  assert.ok(!t.body.some(([x, y]) => x === t.apple[0] && y === t.apple[1]), 'never on the snake');
  // a golden apple is worth more
  const g = R.snakeStart(m, 'X'); g.apple = [6, 5, 1];
  R.snakeTick(g, null);
  assert.equal(g.ate, cfg().goldWorth); assert.equal(g.eaten, 1); assert.equal(g.last, 'gold');
  // into itself: a tight loop with a long body
  const u = R.snakeStart(m, 'X'); u.body = [[5, 5], [4, 5], [3, 5], [3, 6], [4, 6], [5, 6], [6, 6]]; u.apple = [0, 0, 0];
  R.snakeTick(u, 1);   // down into (5,6): its own body
  assert.equal(u.end, 'self');
  // the tail cell is free (it moves on) unless the snake eats this tick
  const w = R.snakeStart(m, 'X'); w.body = [[5, 5], [4, 5], [4, 6], [5, 6]]; w.apple = [0, 0, 0];
  R.snakeTick(w, 1);
  assert.equal(w.end, null, 'into the tail\'s cell: it has moved on'); assert.deepEqual(w.body[0], [5, 6]);
});
test('snake: a turn is taken at its tick (never straight back), recorded in the log; the pace quickens with every apple down to the floor; the cap ends a run', () => {
  const m = mini(7), s = R.snakeStart(m, 'X');
  R.snakeTick(s, 2);                                     // straight back: ignored
  assert.equal(s.dir, 0); assert.deepEqual(s.rec, []);
  R.snakeTick(s, 3);                                     // up
  assert.equal(s.dir, 3); assert.deepEqual(s.rec, [[1, 3]]); assert.deepEqual(s.body[0], [6, 4]);
  R.snakeTick(s, 3);                                     // up again: no turn
  assert.deepEqual(s.rec, [[1, 3]]);
  const c = cfg(), t = R.snakeStart(m, 'X');
  assert.equal(R.snakeTickMs(t), c.tick);
  t.eaten = 4; assert.equal(R.snakeTickMs(t), c.tick - 4 * c.speedUp);
  t.eaten = 1000; assert.equal(R.snakeTickMs(t), c.minTick);
  const q = R.snakeStart(m, 'X'); q.ms = c.runCap * 1000 - 1;
  R.snakeTick(q, null);
  assert.equal(q.end, 'out'); assert.equal(q.k, 0, 'the tick past the cap is not taken');
});
test('snake: the same log gives the same run (the phone, the server, a replay), tick for tick, and it passes the check', () => {
  for (let i = 0; i < 12; i++) {
    const m = mini(20 + i, { X: 5 * i, O: 0 }), r = R.snakeAi(m, 'X', E.makeRng('d' + i));
    const log = E.fingUnlog(r.move.log, r.move.ticks, 3);
    assert.ok(log, 'the inputs read back');
    const a = R.snakeReplay(m, 'X', log, r.move.ticks), b = R.snakeReplay(clone(m), 'X', log, r.move.ticks);
    assert.deepEqual([a.k, a.ate, a.body, a.end], [r.sim.k, r.sim.ate, r.sim.body, r.sim.end === 'out' ? null : r.sim.end]);
    assert.deepEqual([b.k, b.ate, b.body], [a.k, a.ate, a.body]);
    const c = R.snakeCheck(m, 'X', r.move);
    assert.equal(c.why, null, `attempt ${i}: ${c.why}`);
    assert.ok(['wall', 'self', 'top', 'out', 'stop'].includes(r.move.end));
  }
});
test('snake: a move that does not replay as it claims is refused (more apples, another end, a turn at a tick never made, a bad log)', () => {
  const m = mini(31), r = R.snakeAi(m, 'X', E.makeRng('e')), ok = r.move;
  const why = mv => R.snakeCheck(m, 'X', mv).why;
  assert.equal(why(ok), null);
  assert.equal(why(Object.assign({}, ok, { n: ok.n + 1 })), 'replay');
  assert.equal(why(Object.assign({}, ok, { end: ok.end === 'wall' ? 'self' : 'wall' })), 'replay');
  assert.equal(why(Object.assign({}, ok, { ticks: ok.ticks + 1 })), ok.ticks + 1 > R.snakeMaxTicks(cfg()) ? 'bad' : 'replay');
  assert.equal(why(Object.assign({}, ok, { log: ok.log + ',zz:1' })), 'bad', 'a turn after the last tick');
  assert.equal(why(Object.assign({}, ok, { log: 'zz' })), 'bad');
  assert.equal(why(Object.assign({}, ok, { end: 'fell' })), 'bad');
  assert.equal(why({ log: '', ticks: 0, n: 0, end: 'stop' }), 'bad', 'no ticks is no run');
  assert.equal(why('bank'), 'bad');
  assert.equal(why(Object.assign({}, ok, { ticks: 100000 })), 'bad');
  // a run stopped by the clock is taken as it stands (the server cannot time it: core/verify.js is not the game's)
  const s = R.snakeStart(m, 'X'); R.snakeTick(s, null); R.snakeTick(s, 3);
  assert.equal(why({ log: E.fingLog(s.rec), ticks: 2, n: 0, end: 'stop' }), null);
  assert.equal(why({ log: E.fingLog(s.rec), ticks: 2, n: 0, end: 'out' }), 'replay', 'not at the cap');
});
test('snake: a run adds its apples to the player\'s total, counts an attempt, and the total at the target wins the square; a timed-out run adds nothing', () => {
  const m = mini(40, { X: 30, O: 2 }), rng = E.makeRng('w');
  const r = R.snakeAi(m, 'X', E.makeRng('win')), res = E.applyMove(m, 'X', r.move, rng);
  assert.equal(res.ok, true);
  assert.equal(m.tries.X, 1); assert.equal(m.last.by, 'X'); assert.equal(m.last.from, 30); assert.equal(m.last.to, Math.min(35, 30 + r.move.n));
  if (m.score.X >= 35) { assert.equal(res.outcome, 'win'); assert.equal(res.note, 'top'); assert.equal(r.move.end, 'top'); }
  else { assert.equal(res.outcome, 'continue'); assert.equal(res.note, r.move.n > 0 ? 'up' : 'none'); }
  const t = mini(41, { X: 4, O: 9 }), a = E.applyMove(t, 'O', 'auto', rng);
  assert.deepEqual([a.ok, a.outcome, a.note], [true, 'continue', 'out']);
  assert.equal(t.score.O, 9); assert.equal(t.tries.O, 1); assert.equal(t.last.auto, true);
  assert.equal(E.randomLegalMove(t, 'X', rng), 'auto', 'no phone plays a timeout: the run ends as it stands');
  // the total never passes the target
  const u = mini(42, { X: 34, O: 0 }), ur = R.snakeAi(u, 'X', E.makeRng('u'));
  E.applyMove(u, 'X', ur.move, rng);
  assert.ok(u.score.X <= 35);
});
test('snake: the whole move through the board (playMove): the flash carries the run (its log, the totals), and the win claims the square', () => {
  const st = E.newMatch(E.makeRng('pm'), { games: ['snake'] });
  st.squares[0].mini = mini(50, { X: 33, O: 0 }); st.turn = 'X';
  const sq = st.squares[0], r = R.snakeAi(sq.mini, 'X', E.makeRng('pm-run'));
  const res = E.playMove(st, 0, r.move, E.makeRng('pm-x'));
  assert.equal(res.ok, true);
  const f = res.flash;
  assert.equal(f.type, 'snake'); assert.ok(f.snake); assert.equal(f.snake.by, 'X'); assert.equal(f.snake.goal, 35); assert.equal(f.snake.log, r.move.log); assert.equal(f.snake.ai, false);
  assert.equal(f.m, undefined, 'the move is too big to ride the flash: the run is in flash.snake');
  if (sq.owner) { assert.equal(f.kind, 'claim'); assert.equal(sq.owner, 'X'); } else assert.equal(f.kind, 'move');
  // the flash's time: someone else's run plays first (no whole replay log), then the result
  const won = f.kind === 'claim';
  assert.equal(R.flashMs(f, 4, won), f.snake.ms + R.SNAKE.hold + (won ? 600 : 0));
  const shown = Object.assign({}, f, { rep: [[0, 'snk-start'], [10, 'snk', 'go'], [900, 'snk', 'k=4'], [f.snake.ms + 900, 'snk', `end=${f.snake.ticks.toString(36)}`]] });
  assert.equal(R.snakeShown(shown), true);
  assert.equal(R.flashMs(shown, 4, won), R.SNAKE.hold + (won ? 600 : 0), 'a run shown before the move (the replay\'s chunks): the result alone');
  assert.equal(R.snakeShown(Object.assign({}, f, { rep: [[0, 'snk', 'go'], [500, 'snk', 'k=3']] })), false, 'a log without its end is not whole');
  assert.equal(R.snakeShown(Object.assign({}, f, { snake: Object.assign({}, f.snake, { ai: true }) })), true, 'the computer\'s run here: shown before the move');
});
test('snake: the replay chunks: the computer\'s run noted as a phone would note it, whole, within the log\'s limits, and read back to the same turns', () => {
  for (let i = 0; i < 8; i++) {
    const m = mini(60 + i), r = R.snakeAi(m, 'X', E.makeRng('c' + i)), list = R.snakeSynthList(r.sim);
    assert.ok(list.length >= 2 && list.length <= E.REP.max, `${list.length} chunks`);
    assert.deepEqual(list[0], [0, 'snk', 'go']);
    for (const [ms, act, val] of list) { assert.equal(act, 'snk'); assert.ok(val.length <= R.SNAKE_REP.valMax, val); assert.match(val, E.REP.val); assert.ok(ms >= 0); }
    for (let j = 1; j < list.length; j++) assert.ok(list[j][0] - list[j - 1][0] <= E.REP.gap, 'no gap the log would cut');
    const norm = E.repNorm(list);
    assert.ok(norm && R.snakeRepOk(norm), 'a whole log once normalised');
    const turns = new Map(); let K = 0, end = null;
    for (const [, , v] of list) { const c = R.snakeChunkParse(v); assert.ok(c, v); if (c.go) continue; for (const [t, d] of c.turns) turns.set(t, d); K = Math.max(K, c.k); if (c.end) end = c.k; }
    assert.equal(end, r.sim.k); assert.equal(K, r.sim.k);
    assert.deepEqual([...turns.entries()].sort((a, b) => a[0] - b[0]), r.sim.rec, 'every turn, at its tick');
    for (const [t] of r.sim.rec) { const at = list.find(([, , v]) => { const c = R.snakeChunkParse(v); return c && !c.go && c.turns.some(x => x[0] === t); })[0]; assert.ok(at >= r.sim.at[t], 'a turn is noted only once its tick is in'); }
  }
  assert.deepEqual(R.snakeChunkParse('go'), { go: true });
  assert.deepEqual(R.snakeChunkParse('k=a|3:1,7:2'), { k: 10, end: false, turns: [[3, 1], [7, 2]] });
  assert.deepEqual(R.snakeChunkParse('end=1z'), { k: 71, end: true, turns: [] });
  assert.equal(R.snakeChunkParse('end=1z|9:4'), null);
  assert.equal(R.snakeChunkParse('x'), null);
  assert.deepEqual(R.snakeChunkVals('k=5', []), ['k=5']);
  const many = R.snakeChunkVals('k=zz', Array.from({ length: 30 }, (_, i) => [100 + i, i % 4]));
  assert.ok(many.length > 1 && many.every(v => v.length <= R.SNAKE_REP.valMax));
  assert.equal(many.reduce((n, v) => n + R.snakeChunkParse(v).turns.length, 0), 30);
});
test('snake: the computer: an autopilot that paths to the apple and avoids itself; Hard misses fewer turns; a perfect hand reaches the target', () => {
  const m = mini(70), avg = h => { let t = 0; for (let i = 0; i < 60; i++) { const mm = clone(m); mm.tries.X = i; t += R.snakeAi(mm, 'X', E.makeRng('h' + i), h).move.n; } return t / 60; };
  const perfect = avg({ err: 0, grow: 0, safe: true });
  assert.ok(perfect >= 30, `a perfect hand gets ${perfect} a run (the target or near it)`);
  const normal = avg(R.snakeHand(m, 'normal')), hard = avg(R.snakeHand(m, 'hard')), easy = avg(R.snakeHand(m, 'easy'));
  assert.ok(hard > normal && normal > easy, `hard ${hard} > normal ${normal} > easy ${easy}`);
  assert.ok(normal >= 4 && normal <= 12, `Normal eats about ${normal} a run`);
  // its moves pass the check, at every level, and the AI hook returns one with a chance
  for (const level of ['easy', 'normal', 'hard']) {
    const b = A.best(E.publicMini(m), 'X', E.makeRng('b' + level), null, { level });
    assert.equal(R.snakeCheck(m, 'X', b.move).why, null); assert.ok(b.q > 0 && b.q <= 1);
  }
  assert.ok(A.needs(m, 'X') > 1 && A.needs(mini(71, { X: 34, O: 0 }), 'X') === 1);
});
test('snake: a square\'s settings are its own (a bigger target, a slower pace), and the explainer\'s {target} is the setting', () => {
  E.setTune('snake', { target: 12, tick: 300 });
  try {
    const m = E.newMini('snake', E.makeRng('tuned'));
    assert.deepEqual(m.tune, { target: 12, tick: 300 });
    const s = R.snakeStart(m, 'X');
    assert.equal(s.goal, 12); assert.equal(R.snakeTickMs(s), 300);
    m.score.X = 11; const r = R.snakeAi(m, 'X', E.makeRng('t'), { err: 0, grow: 0, safe: true });
    assert.equal(r.move.end, 'top'); assert.equal(r.move.n, 1);
    assert.equal(E.applyMove(m, 'X', r.move, E.makeRng('t2')).outcome, 'win');
  } finally { E.setTune('snake', null); }
  const meta = require('../../src/games/snake/meta.js');
  assert.match(meta.explainer.win, /\{target\}/); assert.equal(meta.turnSecs, 60); assert.equal(meta.realTime, true); assert.equal(meta.category, 'skill');
});
test('snake: a timed-out player: nothing is played for them (timeoutClose has no move; the run on the phone ends as it stands)', () => {
  const st = E.newMatch(E.makeRng('to'), { games: ['snake'] });
  st.squares[0].mini = mini(80); st.turn = 'X'; st.timer = E.newTimer(30); st.timer.for = 'X';
  assert.equal(E.timeoutMove(st, E.makeRng('t')).missed, 'X', 'a square only opened: a missed turn');
  assert.equal(st.squares[0].mini.tries.X, 0);
});
