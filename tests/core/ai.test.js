'use strict';
// The computer's levels (src/core/aiw.js, ai.js, mc.js): Normal unchanged, Easy careless, Hard choosing its
// square by playouts within its budget; the weights' limits; the levels in Play Local's setup. Plain node --test.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ttt = cells => ({ type: 'ttt', cells: cells.slice(), last: null });
const T = (...c) => ttt(Array.from({ length: 9 }, (_, i) => c[i] || null));
const games = ['ttt', 'c4', 'hilo', 'pig', 'coins', 'hunt', 'bs', 'memory', 'snakes'];
function board(squares, owners, turn) {
  const st = E.newMatch(lcg(3), { games });
  squares.forEach((m, i) => { if (m) st.squares[i].mini = typeof m === 'string' ? E.newMini(m, lcg(i + 1)) : m; });
  (owners || []).forEach((o, i) => { st.squares[i].owner = o || null; });
  st.turn = turn || 'X';
  return st;
}
test('levels: the three, normal for anything else; the weights checked against their limits, the defaults when unset', () => {
  assert.deepEqual(E.LEVELS, ['easy', 'normal', 'hard']);
  for (const v of ['hard', 'nope', null, undefined, 3]) assert.equal(E.levelOf(v), v === 'hard' ? 'hard' : 'normal');
  E.setAiWeights(null); assert.deepEqual(E.aiWeights(), E.AI_DEFAULTS);
  E.setAiWeights({ attack: 9, defend: 'x', explore: 0.5, playouts: 123, junk: 1 });
  const w = E.aiWeights();
  assert.equal(w.attack, E.AI_DEFAULTS.attack, 'out of range: the default'); assert.equal(w.defend, E.AI_DEFAULTS.defend); assert.equal(w.explore, 0.5); assert.equal(w.playouts, 120, 'on its step'); assert.equal(w.junk, undefined);
  E.setAiWeights(null);
});
test('levels: Play Local keeps the level with the setup and the match carries it; Normal is the default', () => {
  const st = E.newState(lcg(1));
  assert.equal(E.normLocal(st.setup).level, 'normal');
  st.setup.local = { pick: 'X', p2: 'cpu', n1: '', n2: '', level: 'hard' };
  E.seatLocal(st.setup, lcg(2)); st.setup.games = Object.fromEntries(E.TYPES.map(t => [t, t === 'ttt']));
  assert.ok(E.startMatch(st, lcg(3)));
  assert.equal(st.cpu, 'O'); assert.equal(st.cpuLevel, 'hard');
  st.setup.local.p2 = 'human'; E.seatLocal(st.setup, lcg(2)); E.startMatch(st, lcg(3));
  assert.equal(st.cpuLevel, null, 'no computer, no level');
  assert.equal(E.newMatch(lcg(4), { games: ['ttt'], players: { X: 'human', O: 'cpu' }, level: 'easy' }).cpuLevel, 'easy');
});
test('levels: Normal plays exactly as before, whatever the weights; Easy makes careless moves; Hard never does', () => {
  E.setAiWeights({ attack: 2.5, defend: 0.3 });
  const a = E.cpuMove(board(['ttt', 'ttt', T('X', 'X')], [], 'X'), lcg(9), null, { level: 'normal' });
  E.setAiWeights(null);
  const b = E.cpuMove(board(['ttt', 'ttt', T('X', 'X')], [], 'X'), lcg(9));
  assert.deepEqual([a.square, a.move], [b.square, b.move], 'the weights are the Hard computer\'s');
  let careless = 0;
  for (let k = 0; k < 200; k++) { const m = E.cpuMove(board(['ttt', 'ttt', 'ttt'], [], 'X'), E.makeRng('easy' + k), null, { level: 'easy' }); if (m.careless) careless++; }
  assert.ok(careless > 30 && careless < 90, `Easy: careless about 30% of the time (${careless} of 200)`);
  for (let k = 0; k < 40; k++) assert.ok(!E.cpuMove(board(['ttt', 'ttt', 'ttt'], [], 'X'), lcg(k + 1), null, { level: 'hard' }).careless, 'Hard: never careless');
});
test('levels: Hard takes a match-winning square and blocks one, like Normal; elsewhere it chooses by playouts, deterministic from the rng', () => {
  const win = board(['ttt', 'ttt', T('X', 'X'), 'ttt', 'ttt', T('O', 'O')], ['X', 'X', null, 'O', 'O'], 'X');
  const m = E.cpuMove(win, lcg(5), null, { level: 'hard' });
  assert.equal(m.square, 2); assert.equal(m.move, 2);
  const block = board([T('X', 'X', null, 'O', 'O'), 'ttt', 'ttt', 'ttt', 'ttt', T('O', 'O')], [null, null, null, 'O', 'O'], 'X');
  const mb = E.cpuMove(block, lcg(5), null, { level: 'hard' });
  assert.equal(mb.square, 5); assert.equal(mb.move, 2);
  const st = board(['ttt', 'c4', 'hilo', 'pig', 'coins', 'hunt', 'bs', 'memory', 'snakes'], [], 'X');
  const h1 = E.cpuMove(st, lcg(11), null, { level: 'hard' }), h2 = E.cpuMove(st, lcg(11), null, { level: 'hard' });
  assert.deepEqual([h1.square, h1.move, h1.mc], [h2.square, h2.move, h2.mc], 'the same rng, the same choice');
  assert.equal(h1.mc.n, E.AI_DEFAULTS.playouts, 'every playout without a clock');
  assert.equal(h1.mc.p.length, 9); assert.ok(h1.mc.p.every(p => p >= 0 && p <= 1));
  assert.ok(Math.max(...h1.mc.p) === h1.mc.p[E.cpuMove(st, lcg(11), null, { level: 'hard' }).square === h1.square ? h1.mc.p.indexOf(Math.max(...h1.mc.p)) : 0], 'the square with the best playouts');
});
test('levels: Hard keeps to its time budget with a clock, and still answers', () => {
  const st = board(['ttt', 'c4', 'hilo', 'pig', 'coins', 'hunt', 'bs', 'memory', 'snakes'], [], 'X');
  const m = E.cpuMove(st, lcg(2), null, { level: 'hard', clock: () => performance.now(), budget: 30 });
  assert.ok(m && m.mc && m.mc.n < E.AI_DEFAULTS.playouts, `fewer playouts in 30 ms (${m.mc.n})`);   // (none at all when the squares' own searches used the budget: then the best-scored square, as Normal)
  assert.ok(E.playMove(st, m.square, m.move, lcg(2)).ok, 'and a legal move');
  const real = Date.now();
  for (let k = 0; k < 5; k++) assert.ok(E.cpuMove(st, lcg(k), null, { level: 'hard', clock: Date.now, budget: 300 }));
  assert.ok(Date.now() - real < 5 * 450, `five decisions inside their budgets (${Date.now() - real} ms)`);
});
test('levels: a whole match of Hard against Normal plays out legally, every game dealt', () => {
  const rng = lcg(21), st = E.newMatch(rng, { games: E.TYPES.filter(t => !['golf', 'pool', 'bowling', 'pinball'].includes(t) && !E.SC_ONLY.includes(t)) });
  let n = 0;
  while (!st.winner && n++ < 500) {
    const m = E.cpuMove(st, rng, null, { level: st.turn === 'X' ? 'hard' : 'normal' });
    const r = E.playMove(st, m.square, m.move, rng);
    assert.equal(r.ok, true, `${st.squares[m.square].mini.type}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    E.endFlash(st);
  }
  assert.ok(st.winner, `finishes (${n} moves)`);
});
test('catching up: a square the other side is well ahead in, with little chance of catching up, gives way to one still open; not when it would win them the match and can still be stopped', () => {
  assert.equal(E.catchUp(2, 2, 5), 1, 'level: as it was');
  assert.equal(E.catchUp(5, 1, 5), E.CATCH.factor, 'well behind: little chance');
  assert.equal(E.catchUp(3, 2, 5), 1, 'one move behind: still a race');
  assert.equal(E.catchUp(4.2, 1, E.AI.block + 1), 1, 'their match-winning square, still stoppable');
  assert.equal(E.catchUp(20, 1, E.AI.block + 1), E.CATCH.factor, 'theirs, but out of reach');
  const pig = (x, o) => Object.assign(E.newMini('pig', lcg(9)), { bank: { X: x, O: o } });
  for (const level of ['easy', 'normal', 'hard']) {
    const behind = board([pig(0, 0), null, null, null, pig(13, 42)], [], 'X');   // the centre: O needs one more turn, X four
    for (let i = 0; i < 9; i++) if (i !== 0 && i !== 4) behind.squares[i].owner = null;
    behind.squares.forEach((s, i) => { if (i !== 0 && i !== 4) s.mini = pig(0, 0); });
    const go = E.cpuMove(behind, lcg(5), null, { level: level === 'easy' ? 'normal' : level });
    assert.notEqual(go.square, 4, `${level}: builds elsewhere, not in the centre O has nearly won`);
  }
  const threat = board([null, pig(0, 0), null, null, pig(13, 42), null, null, pig(0, 0)], [null, 'O', null, null, null, null, null, 'O'], 'X');
  threat.squares.forEach((s, i) => { if (![1, 4, 7].includes(i)) s.mini = pig(0, 0); });
  assert.equal(E.cpuMove(threat, lcg(5), null, { level: 'normal' }).square, 4, 'the centre would win O the match: it fights for it');
});
