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
const foodOf = (s, c) => s.food.filter(f => f && f[2] === c);
// A run steered greedily for the food of colour c (the tests' own hand): the move it makes and its sim.
function chase(m, p, c, maxTicks) {
  const s = R.snakeStart(m, p);
  for (let n = 0; n < (maxTicks || 400) && !s.end; n++) {
    const f = foodOf(s, c)[0], [hx, hy] = s.body[0];
    if (f) {
      const want = f[0] !== hx ? (f[0] > hx ? 0 : 2) : f[1] !== hy ? (f[1] > hy ? 1 : 3) : null;
      if (want != null) { if (!R.snakeQueue(s, want) && (want + 2) % 4 === s.dir) R.snakeQueue(s, hy < 5 ? 1 : 3); }
    }
    R.snakeTick(s, null);
  }
  return { move: R.snakeResult(s), sim: s };
}

/* ===================================== Snake ===================================== */
test('snake: a fresh square (version 2, the food\'s seed, nothing scored), a public view with nothing hidden but a run\'s log', () => {
  const m = mini(3);
  assert.equal(m.type, 'snake'); assert.equal(m.v, 2);
  assert.deepEqual(m.score, { X: 0, O: 0 }); assert.deepEqual(m.tries, { X: 0, O: 0 }); assert.equal(m.last, null);
  assert.ok(Number.isInteger(m.seed.X) && m.seed.X === m.seed.O, 'one seed, each player\'s attempts their own (the player and the attempt number are in it)');
  const r = E.applyMove(m, 'X', R.snakeAi(m, 'X', E.makeRng('a')).move, E.makeRng('x'));
  assert.equal(r.ok, true);
  const pub = E.publicMini(m);
  assert.ok(pub.last && !('log' in pub.last) && 'log' in m.last, 'the log rides the move\'s flash, never the square');
  assert.equal(pub.score.X, m.score.X);
});
test('snake: the snake starts in the middle heading right, moves exactly a cell a tick, dies on the wall and on itself', () => {
  const m = mini(5), s = R.snakeStart(m, 'X');
  assert.deepEqual(s.body, [[5, 5], [4, 5], [3, 5]]); assert.equal(s.dir, 0);
  s.food = [[0, 0, 'X'], [0, 10, 'O']];                                  // (out of the way)
  R.snakeTick(s, null);
  assert.deepEqual(s.body, [[6, 5], [5, 5], [4, 5]]); assert.equal(s.k, 1); assert.equal(s.ms, cfg().tick);
  for (let i = 0; i < 4; i++) R.snakeTick(s, null);
  assert.equal(s.end, null); assert.deepEqual(s.body[0], [10, 5]);
  R.snakeTick(s, null);
  assert.equal(s.end, 'wall');
  const u = R.snakeStart(m, 'X'); u.body = [[5, 5], [4, 5], [3, 5], [3, 6], [4, 6], [5, 6], [6, 6]]; u.food = [[0, 0, 'X'], [0, 10, 'O']];
  R.snakeTick(u, 1);   // down into (5,6): its own body
  assert.equal(u.end, 'self');
  const w = R.snakeStart(m, 'X'); w.body = [[5, 5], [4, 5], [4, 6], [5, 6]]; w.food = [[0, 0, 'X'], [0, 10, 'O']];
  R.snakeTick(w, 1);
  assert.equal(w.end, null, 'into the tail\'s cell: it has moved on'); assert.deepEqual(w.body[0], [5, 6]);
});
test('snake: the turn queue: a turn takes effect on the next tick, two may wait (a U-turn from two quick taps), a third is lost; a reversal into the neck and a turn that changes nothing are never queued', () => {
  const m = mini(7), s = R.snakeStart(m, 'X');
  s.food = [[0, 0, 'X'], [0, 10, 'O']];
  assert.equal(R.snakeQueue(s, 2), false, 'straight back into the neck: ignored');
  assert.equal(R.snakeQueue(s, 0), false, 'the way it already heads: ignored');
  assert.equal(R.snakeQueue(s, 3), true, 'up: queued');
  assert.equal(s.dir, 0, 'nothing yet: it takes effect on the next tick'); assert.deepEqual(s.body[0], [5, 5]);
  assert.equal(R.snakeQueue(s, 1), false, 'down after up: the reversal of the last turn queued');
  assert.equal(R.snakeQueue(s, 2), true, 'then left: the second waiting');
  assert.equal(R.snakeQueue(s, 1), false, 'a third: the queue is full');
  assert.deepEqual(s.q, [3, 2]); assert.deepEqual(s.rec, [[0, 3], [1, 2]], 'logged at the tick they came in (2 x tick, +1 for the second)');
  R.snakeTick(s, null);
  assert.equal(s.dir, 3); assert.deepEqual(s.body[0], [5, 4]); assert.equal(s.turned, true); assert.deepEqual(s.q, [2]);
  R.snakeTick(s, null);
  assert.equal(s.dir, 2); assert.deepEqual(s.body[0], [4, 4], 'the second turn on the tick after: a U-turn in two ticks');
  R.snakeTick(s, null);
  assert.equal(s.turned, false); assert.deepEqual(s.body[0], [3, 4]);
  assert.equal(R.snakeQueue(s, 1), true); assert.deepEqual(s.rec[2], [6, 1], 'a turn at tick 3: key 6');
  // the pace quickens with every food down to the floor; the cap ends a run
  const c = cfg(), t = R.snakeStart(m, 'X');
  assert.equal(R.snakeTickMs(t), c.tick);
  t.eaten = 4; assert.equal(R.snakeTickMs(t), c.tick - 4 * c.speedUp);
  t.eaten = 1000; assert.equal(R.snakeTickMs(t), c.minTick);
  const q = R.snakeStart(m, 'X'); q.ms = c.runCap * 1000 - 1;
  R.snakeTick(q, null);
  assert.equal(q.end, 'out'); assert.equal(q.k, 0, 'the tick past the cap is not taken');
});
test('snake: food: always red (X\'s) and yellow (O\'s) on the grid, never on the snake; your colour scores for you, the other for the other player, and both grow the snake', () => {
  const m = mini(9);
  for (let i = 0; i < 25; i++) {
    const mm = clone(m); mm.tries.X = i;
    const r = R.snakeAi(mm, 'X', E.makeRng('f' + i)), s = R.snakeStart(mm, 'X');
    assert.equal(foodOf(s, 'X').length, cfg().food); assert.equal(foodOf(s, 'O').length, cfg().food);
    // played through tick by tick: the food is always there, one of each, never under the snake or on each other
    const log = E.fingUnlog(r.move.log, 2 * r.move.ticks - 1, 3), turns = new Map(log);
    while (!s.end && s.k < r.move.ticks) {
      R.snakeFeed(s, turns); R.snakeTick(s, null);
      if (s.end) break;
      assert.equal(foodOf(s, 'X').length, 1); assert.equal(foodOf(s, 'O').length, 1);
      const cells = new Set(s.body.map(([x, y]) => x + ',' + y));
      for (const f of s.food) assert.ok(!cells.has(f[0] + ',' + f[1]), 'never on the snake');
      assert.notDeepEqual(s.food[0].slice(0, 2), s.food[1].slice(0, 2));
    }
  }
  // its own colour, then the other: +1 each way, a cell longer each time, and put back the same colour
  const s = R.snakeStart(m, 'X'); s.food = [[6, 5, 'X'], [7, 5, 'O']];
  R.snakeTick(s, null);
  assert.deepEqual([s.got, s.gave, s.eaten, s.body.length, s.last], [1, 0, 1, 4, 'eat']);
  assert.equal(foodOf(s, 'X').length, 1); assert.notDeepEqual(foodOf(s, 'X')[0].slice(0, 2), [6, 5]);
  const xf = foodOf(s, 'X')[0];
  if (!(xf[0] === 7 && xf[1] === 5)) {
    R.snakeTick(s, null);
    assert.deepEqual([s.got, s.gave, s.eaten, s.body.length, s.last], [1, 1, 2, 5, 'gift']);
    assert.equal(foodOf(s, 'O').length, 1, 'the other colour put back too');
  }
  // for O, it is the other way round
  const o = R.snakeStart(m, 'O'); o.food = [[6, 5, 'X'], [0, 0, 'O']];
  R.snakeTick(o, null);
  assert.deepEqual([o.got, o.gave], [0, 1]);
});
test('snake: the same log gives the same run (the phone, the server, a replay), tick for tick, queue and all, and it passes the check', () => {
  for (let i = 0; i < 12; i++) {
    const m = mini(20 + i, { X: 2 * i, O: i }), r = R.snakeAi(m, 'X', E.makeRng('d' + i));
    const log = E.fingUnlog(r.move.log, 2 * r.move.ticks - 1, 3);
    assert.ok(log, 'the inputs read back');
    const a = R.snakeReplay(m, 'X', log, r.move.ticks), b = R.snakeReplay(clone(m), 'X', log, r.move.ticks);
    assert.deepEqual([a.k, a.got, a.gave, a.body, a.end], [r.sim.k, r.sim.got, r.sim.gave, r.sim.body, r.sim.end === 'out' ? null : r.sim.end]);
    assert.deepEqual([b.k, b.got, b.body], [a.k, a.got, a.body]);
    const c = R.snakeCheck(m, 'X', r.move);
    assert.equal(c.why, null, `attempt ${i}: ${c.why}`);
    assert.ok(R.SNAKE_ENDS.includes(r.move.end));
  }
  // a live run with two quick taps in one tick (as the phone queues them) checks out the same
  const m = mini(33), s = R.snakeStart(m, 'X');
  R.snakeTick(s, null); R.snakeQueue(s, 3); R.snakeQueue(s, 2); R.snakeTick(s, null); R.snakeTick(s, null); R.snakeQueue(s, 1); R.snakeTick(s, null);
  s.end = s.end || 'stop';
  const mv = R.snakeResult(s);
  assert.equal(mv.log, E.fingLog([[2, 3], [3, 2], [6, 1]]));
  const c = R.snakeCheck(m, 'X', mv);
  assert.equal(c.why, null); assert.deepEqual(c.sim.body, s.body);
});
test('snake: a move that does not replay as it claims is refused (more points either way, another end, a turn the queue would not take, a bad log)', () => {
  const m = mini(31), r = R.snakeAi(m, 'X', E.makeRng('e')), ok = r.move;
  const why = mv => R.snakeCheck(m, 'X', mv).why;
  assert.equal(why(ok), null);
  assert.equal(why(Object.assign({}, ok, { n: ok.n + 1 })), 'replay');
  assert.equal(why(Object.assign({}, ok, { g: ok.g + 1 })), 'replay', 'points given that were not');
  assert.equal(why(Object.assign({}, ok, { end: ok.end === 'wall' ? 'self' : 'wall' })), 'replay');
  assert.equal(why(Object.assign({}, ok, { ticks: ok.ticks + 1 })), ok.ticks + 1 > R.snakeMaxTicks(cfg()) ? 'bad' : 'replay');
  assert.equal(why(Object.assign({}, ok, { log: ok.log + ',zzz:1' })), 'bad', 'a turn after the last tick');
  assert.equal(why(Object.assign({}, ok, { log: 'zz' })), 'bad');
  assert.equal(why(Object.assign({}, ok, { end: 'fell' })), 'bad');
  assert.equal(why({ log: '', ticks: 0, n: 0, g: 0, end: 'stop' }), 'bad', 'no ticks is no run');
  assert.equal(why('bank'), 'bad');
  assert.equal(why(Object.assign({}, ok, { ticks: 100000 })), 'bad');
  // the queue's rules hold on the server too: a reversal, a third turn in a tick, a turn that changes nothing
  assert.equal(why({ log: E.fingLog([[0, 2]]), ticks: 3, n: 0, g: 0, end: 'stop' }), 'bad', 'straight back');
  assert.equal(why({ log: E.fingLog([[0, 0]]), ticks: 3, n: 0, g: 0, end: 'stop' }), 'bad', 'no turn');
  assert.equal(why({ log: E.fingLog([[1, 3]]), ticks: 3, n: 0, g: 0, end: 'stop' }), 'bad', 'a second slot with no first');
  assert.equal(why({ log: E.fingLog([[0, 3], [1, 1]]), ticks: 3, n: 0, g: 0, end: 'stop' }), 'bad', 'down right after up: the reversal of the last turn queued');
  // a run stopped by the clock is taken as it stands
  const s = R.snakeStart(m, 'X'); R.snakeTick(s, null); R.snakeTick(s, 3);
  assert.equal(why({ log: E.fingLog(s.rec), ticks: 2, n: 0, g: 0, end: 'stop' }), null);
  assert.equal(why({ log: E.fingLog(s.rec), ticks: 2, n: 0, g: 0, end: 'out' }), 'replay', 'not at the cap');
});
test('snake: a run adds its points to both totals (the mover\'s colour to the mover, the other colour to the other player), counts an attempt; a total at the target wins; a timed-out run adds nothing', () => {
  const m = mini(40, { X: 26, O: 2 }), rng = E.makeRng('w');
  const r = R.snakeAi(m, 'X', E.makeRng('win')), res = E.applyMove(m, 'X', r.move, rng), T = cfg().target;
  assert.equal(res.ok, true);
  assert.equal(m.tries.X, 1); assert.equal(m.last.by, 'X'); assert.equal(m.last.from, 26); assert.equal(m.last.to, Math.min(T, 26 + r.move.n));
  assert.equal(m.last.ofrom, 2); assert.equal(m.last.oto, 2 + r.move.g); assert.equal(m.score.O, 2 + r.move.g);
  if (m.score.X >= T) { assert.equal(res.outcome, 'win'); assert.equal(res.note, 'top'); assert.equal(r.move.end, 'top'); assert.equal(res.winner, undefined); }
  else { assert.equal(res.outcome, 'continue'); assert.equal(res.note, r.move.n > 0 ? 'up' : 'none'); }
  // the other colour: the other player +1 (here, O's food eaten by X)
  const g = mini(43, { X: 0, O: 4 }), cr = chase(g, 'X', 'O', 60);
  assert.ok(cr.move.g >= 1, 'the chase ate O\'s food');
  const gr = E.applyMove(g, 'X', cr.move, rng);
  assert.equal(gr.ok, true, gr.reason); assert.equal(g.score.O, 4 + cr.move.g); assert.equal(g.score.X, cr.move.n);
  const t = mini(41, { X: 4, O: 9 }), a = E.applyMove(t, 'O', 'auto', rng);
  assert.deepEqual([a.ok, a.outcome, a.note], [true, 'continue', 'out']);
  assert.equal(t.score.O, 9); assert.equal(t.tries.O, 1); assert.equal(t.last.auto, true);
  assert.equal(E.randomLegalMove(t, 'X', rng), 'auto', 'no phone plays a timeout: the run ends as it stands');
  const u = mini(42, { X: T - 1, O: 0 }), ur = R.snakeAi(u, 'X', E.makeRng('u'));
  E.applyMove(u, 'X', ur.move, rng);
  assert.ok(u.score.X <= T, 'the total never passes the target');
});
test('snake: a win for the other player mid-run: the other colour\'s food takes them to the target, the run ends there, and the square is theirs (note gift), through the board too', () => {
  const T = cfg().target, g = mini(44, { X: 3, O: T - 1 }), cr = chase(g, 'X', 'O', 80);
  assert.equal(cr.move.end, 'gift', 'the run ends on the point that wins it for them'); assert.equal(cr.move.g, 1);
  assert.deepEqual(R.snakeCheck(clone(g), 'X', cr.move).why, null, 'the server sees the same');
  const st = E.newMatch(E.makeRng('gift'), { games: ['snake'] });
  st.squares[0].mini = clone(g); st.turn = 'X';
  const res = E.playMove(st, 0, cr.move, E.makeRng('gx'));
  assert.equal(res.ok, true, res.reason);
  assert.equal(st.squares[0].owner, 'O', 'claimed for O'); assert.equal(res.flash.winner, 'O'); assert.equal(res.flash.kind, 'claim');
  assert.equal(res.flash.snake.oto, T); assert.equal(res.flash.snake.end, 'gift');
  const r2 = E.applyMove(clone(g), 'X', cr.move, E.makeRng('x'));
  assert.deepEqual([r2.outcome, r2.winner, r2.note], ['win', 'O', 'gift']);
  // the computer never eats the food that wins the square for the other player when it can help it
  let gifts = 0;
  for (let i = 0; i < 30; i++) { const mm = mini(100 + i, { X: 0, O: T - 1 }); if (R.snakeAi(mm, 'X', E.makeRng('ng' + i)).move.end === 'gift') gifts++; }
  assert.ok(gifts <= 2, `${gifts} of 30 runs handed the square over`);
});
test('snake: the whole move through the board (playMove): the flash carries the run (its log, both totals), and the win claims the square', () => {
  const T = cfg().target, st = E.newMatch(E.makeRng('pm'), { games: ['snake'] });
  st.squares[0].mini = mini(50, { X: T - 2, O: 0 }); st.turn = 'X';
  const sq = st.squares[0], r = R.snakeAi(sq.mini, 'X', E.makeRng('pm-run'));
  const res = E.playMove(st, 0, r.move, E.makeRng('pm-x'));
  assert.equal(res.ok, true);
  const f = res.flash;
  assert.equal(f.type, 'snake'); assert.ok(f.snake); assert.equal(f.snake.by, 'X'); assert.equal(f.snake.goal, T); assert.equal(f.snake.log, r.move.log); assert.equal(f.snake.ai, false);
  assert.deepEqual(f.snake.at, { X: sq.mini.score.X, O: sq.mini.score.O });
  if (sq.owner) { assert.equal(f.kind, 'claim'); assert.equal(sq.owner, 'X'); } else assert.equal(f.kind, 'move');
  const won = f.kind === 'claim';
  assert.equal(R.flashMs(f, 4, won), f.snake.ms + R.SNAKE.hold + (won ? 600 : 0));
  const shown = Object.assign({}, f, { rep: [[0, 'snk-start'], [10, 'snk', 'go'], [900, 'snk', 'k=4'], [f.snake.ms + 900, 'snk', `end=${f.snake.ticks.toString(36)}`]] });
  assert.equal(R.snakeShown(shown), true);
  assert.equal(R.flashMs(shown, 4, won), R.SNAKE.hold + (won ? 600 : 0), 'a run shown before the move (the replay\'s chunks): the result alone');
  assert.equal(R.snakeShown(Object.assign({}, f, { rep: [[0, 'snk', 'go'], [500, 'snk', 'k=3']] })), false, 'a log without its end is not whole');
  assert.equal(R.snakeShown(Object.assign({}, f, { snake: Object.assign({}, f.snake, { ai: true }) })), true, 'the computer\'s run here: shown before the move');
});
test('snake: the replay chunks: the computer\'s run noted as a phone would note it, whole, within the log\'s limits, and read back to the same queue', () => {
  for (let i = 0; i < 8; i++) {
    const m = mini(60 + i), r = R.snakeAi(m, 'X', E.makeRng('c' + i)), list = R.snakeSynthList(r.sim);
    assert.ok(list.length >= 2 && list.length <= E.REP.max, `${list.length} chunks`);
    assert.deepEqual(list[0], [0, 'snk', 'go']);
    for (const [ms, act, val] of list) { assert.equal(act, 'snk'); assert.ok(val.length <= R.SNAKE_REP.valMax, val); assert.match(val, E.REP.val); assert.ok(ms >= 0); }
    for (let j = 1; j < list.length; j++) assert.ok(list[j][0] - list[j - 1][0] <= E.REP.gap, 'no gap the log would cut');
    const norm = E.repNorm(list);
    assert.ok(norm && R.snakeRepOk(norm), 'a whole log once normalised');
    const turns = new Map(); let K = 0, end = null;
    for (const [, , v] of list) { const c = R.snakeChunkParse(v); assert.ok(c, v); if (c.go) continue; for (const [t, d] of c.turns) { assert.ok(t >> 1 < c.k || c.end, 'a chunk at k holds turns queued before tick k'); turns.set(t, d); } K = Math.max(K, c.k); if (c.end) end = c.k; }
    assert.equal(end, r.sim.k); assert.equal(K, r.sim.k);
    assert.deepEqual([...turns.entries()].sort((a, b) => a[0] - b[0]), r.sim.rec.filter(([k]) => k >> 1 < r.sim.k), 'every turn, by its key');
    // played through from the chunks as the other phone does (snakeFeed before each tick): the same run
    const s = R.snakeStart(m, 'X');
    while (!s.end && s.k < r.sim.k) { R.snakeFeed(s, turns); R.snakeTick(s, null); }
    assert.deepEqual([s.k, s.got, s.gave, s.body], [r.sim.k, r.sim.got, r.sim.gave, r.sim.body]);
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
test('snake: the computer: steers for its own colour and round the other; Hard is better than Normal, Normal than Easy; Hard keeps to its time (ctx.until)', () => {
  const m = mini(70), avg = (h, k) => { let t = 0, g = 0; for (let i = 0; i < 60; i++) { const mm = clone(m); mm.tries.X = i; const mv = R.snakeAi(mm, 'X', E.makeRng('h' + i), h).move; t += mv.n; g += mv.g; } return k === 'g' ? g / 60 : t / 60; };
  const perfect = avg({ err: 0, grow: 0, slip: 0, safe: true });
  assert.ok(perfect >= 20, `a perfect hand gets ${perfect} a run`);
  assert.ok(avg({ err: 0, grow: 0, slip: 0, safe: true }, 'g') < 0.5, 'it keeps clear of the other colour');
  const normal = avg(R.snakeHand(m, 'normal')), hard = avg(R.snakeHand(m, 'hard')), easy = avg(R.snakeHand(m, 'easy'));
  assert.ok(hard > normal && normal > easy, `hard ${hard} > normal ${normal} > easy ${easy}`);
  assert.ok(normal >= 3 && normal <= 10, `Normal scores about ${normal} a run`);
  for (const level of ['easy', 'normal', 'hard']) {
    const b = A.best(E.publicMini(m), 'X', E.makeRng('b' + level), null, { level });
    assert.equal(R.snakeCheck(m, 'X', b.move).why, null); assert.ok(b.q >= 0 && b.q <= 1);
  }
  // Hard's runs to choose from: as many as its time allows (one when none is left), the best kept
  let asked = 0;
  const one = R.snakeBestOf(m, 'X', E.makeRng('u1'), R.snakeHand(m, 'hard'), A.SNAKE_HARD_TRIES, () => { asked++; return 0; });
  assert.ok(one && asked === 1, 'out of time after the first run: no second');
  const all = R.snakeBestOf(m, 'X', E.makeRng('u2'), R.snakeHand(m, 'hard'), 3, null);
  assert.ok(all.move.n >= 0);
  assert.ok(A.needs(m, 'X') > 1 && A.needs(mini(71, { X: cfg().target - 1, O: 0 }), 'X') === 1);
});
test('snake: a square\'s settings are its own (a bigger target, a slower pace, more food), and the explainer\'s {target} is the setting', () => {
  E.setTune('snake', { target: 12, tick: 300, food: 2 });
  try {
    const m = E.newMini('snake', E.makeRng('tuned'));
    assert.deepEqual(m.tune, { target: 12, tick: 300, food: 2 });
    const s = R.snakeStart(m, 'X');
    assert.equal(s.goal, 12); assert.equal(R.snakeTickMs(s), 300); assert.equal(foodOf(s, 'X').length, 2); assert.equal(foodOf(s, 'O').length, 2);
    m.score.X = 11; const r = R.snakeAi(m, 'X', E.makeRng('t'), { err: 0, grow: 0, slip: 0, safe: true });
    assert.equal(r.move.end, 'top'); assert.equal(r.move.n, 1);
    assert.equal(E.applyMove(m, 'X', r.move, E.makeRng('t2')).outcome, 'win');
  } finally { E.setTune('snake', null); }
  const meta = require('../../src/games/snake/meta.js');
  assert.match(meta.explainer.win, /\{target\}/); assert.match(meta.explainer.play, /other player/); assert.equal(meta.turnSecs, 60); assert.equal(meta.realTime, true); assert.equal(meta.category, 'skill');
  assert.ok(!meta.TUNE.some(f => f.k === 'gold' || f.k === 'goldWorth'), 'the golden apples are retired');
});
test('snake: a square dealt before the two colours (no v) plays on with the new run, keeping its scores and its old target', () => {
  const old = { type: 'snake', seed: 12345, score: { X: 30, O: 12 }, tries: { X: 4, O: 4 }, last: { by: 'O', from: 4, to: 12, n: 8, ticks: 90, end: 'wall', ms: 15000, len: 11, try: 3 } };
  assert.equal(R.snakeGoal(old), R.SNAKE.oldTarget);
  const r = R.snakeAi(old, 'X', E.makeRng('old'));
  const res = E.applyMove(old, 'X', r.move, E.makeRng('o2'));
  assert.equal(res.ok, true, res.reason);
  assert.ok(old.score.X <= 35 && old.score.X >= 30);
  assert.equal(R.snakeGoal(Object.assign({}, old, { tune: { target: 40 } })), 40, 'one dealt with its own target keeps it');
  assert.equal(R.snakeGoal(mini(1)), cfg().target);
});
test('snake: a timed-out player: nothing is played for them (timeoutClose has no move; the run on the phone ends as it stands)', () => {
  const st = E.newMatch(E.makeRng('to'), { games: ['snake'] });
  st.squares[0].mini = mini(80); st.turn = 'X'; st.timer = E.newTimer(30); st.timer.for = 'X';
  assert.equal(E.timeoutMove(st, E.makeRng('t')).missed, 'X', 'a square only opened: a missed turn');
  assert.equal(st.squares[0].mini.tries.X, 0);
  // a run cut by the turn's clock mid-way (the phone stops it 700 ms early): taken as it stands, its points kept, both ways
  const m = mini(81), full = R.snakeAi(m, 'X', E.makeRng('cut')).sim, log = E.fingUnlog(R.snakeResult(full).log, 2 * full.k - 1, 3);
  const half = Math.max(1, Math.floor(full.k / 2)), s = R.snakeReplay(m, 'X', log.filter(([k]) => k >> 1 < half), half);
  s.end = s.end || 'stop';
  const mv = R.snakeResult(s), c = R.snakeCheck(m, 'X', mv);
  assert.equal(c.why, null); assert.equal(mv.end === 'stop' ? mv.ticks : half, half);
  const res = E.applyMove(m, 'X', mv, E.makeRng('cut2'));
  assert.equal(res.ok, true); assert.equal(m.score.X, mv.n); assert.equal(m.score.O, mv.g);
});
test('snake: Super Chaos: both in one square, each total takes both runs\' points for it', () => {
  const base = mini(90, { X: 5, O: 5 }), fx = clone(base), fo = clone(base);
  fx.score = { X: 9, O: 6 }; fo.score = { X: 7, O: 8 };
  const m = clone(base); m.score = { X: 9, O: 8 };
  const out = R.scMerge(m, { base, forks: { X: fx, O: fo }, played: ['X', 'O'] });
  assert.deepEqual(m.score, { X: 11, O: 9 }); assert.deepEqual(out.win, { X: false, O: false });
  assert.equal(R.scMerge(clone(base), { base, forks: { X: fx }, played: ['X'] }), null, 'one alone: its own copy');
});
