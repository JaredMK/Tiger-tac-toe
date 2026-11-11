'use strict';
// Hex: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');

const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics
// Trivia needs its questions (the page fetches trivia.json; the server has it as a file): a small made-up bank here.
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
// The engine takes all its randomness from the caller. Where a test does not care which random choice
// is made, these wrappers hand it a fixed seeded generator.
const anyRng = () => E.makeRng('any');
const L = Object.assign({}, E, {
  newState: rng => E.newState(rng || anyRng()),
  startMatch: (st, rng) => E.startMatch(st, rng || anyRng()),
  newMatch: (rng, setup) => E.newMatch(rng || anyRng(), setup),
  playMove: (st, i, m, rng, opts) => E.playMove(st, i, m, rng || anyRng(), opts),
  cpuMove: (st, rng) => E.cpuMove(st, rng || anyRng()),
  timeoutMove: (st, rng) => E.timeoutMove(st, rng || anyRng()),
  randomLegalMove: (mini, p, rng) => E.randomLegalMove(mini, p, rng || anyRng()),
  applyMove: (mini, p, m, rng, ...rest) => E.applyMove(mini, p, m, rng || anyRng(), ...rest),
});
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const sorted = a => a.slice().sort((x, y) => x - y);
const mini = (type, rng) => L.newMini(type, rng || lcg(11));
const hex4 = () => ({ type: 'hex', cells: new Array(16).fill(null), last: null });   // a 4x4 square (the default size again since November 2026)
const hex5 = () => ({ type: 'hex', cells: new Array(25).fill(null), last: null });   // a 5x5 square dealt before: plays on as it was, Hard by the solved book

// =================================== Hex ===================================
const hx = (r, c) => r * 4 + c;                                    // (the 4x4 board of the tests below)
const hx5 = (r, c) => r * 5 + c;

// ================================ Computer player ================================
const cpuRng = () => lcg(314);

test('hex: neighbours follow the shifted-row layout', () => {
  assert.deepEqual(sorted(L.hexNeighbors(hx(1, 1), 4)), sorted([hx(1, 0), hx(1, 2), hx(0, 1), hx(2, 1), hx(0, 2), hx(2, 0)]));
  assert.ok(!L.hexNeighbors(hx(1, 1), 4).includes(hx(0, 0)), 'up-left is not adjacent');
  assert.ok(!L.hexNeighbors(hx(1, 1), 4).includes(hx(2, 2)), 'down-right is not adjacent');
  assert.deepEqual(sorted(L.hexNeighbors(hx(0, 0), 4)), sorted([hx(0, 1), hx(1, 0)]));
  assert.deepEqual(sorted(L.hexNeighbors(hx(3, 3), 4)), sorted([hx(3, 2), hx(2, 3)]));
  assert.deepEqual(sorted(L.hexNeighbors(hx5(4, 4), 5)), sorted([hx5(4, 3), hx5(3, 4)]), 'the 5x5 board (squares from before)');
  assert.equal(L.HEX_N, 4);
});

test('hex: X wins with a straight row, lopsided with no O cells (a 4x4 square from before; 5x5 the same with five)', () => {
  const f = hex5();
  assert.equal(mini('hex').cells.length, 16, 'a new square: 4x4'); assert.equal(f.cells.length, 25, 'a 5x5 square from before'); assert.equal(f.swap, undefined, 'no swap rule');
  for (const c of [0, 1, 2, 3]) assert.equal(L.applyMove(f, 'X', hx5(2, c)).outcome, 'continue');
  assert.equal(L.applyMove(f, 'X', hx5(2, 4)).outcome, 'win', 'five across');
  const m = hex4();
  for (const c of [0, 1, 2]) assert.equal(L.applyMove(m, 'X', hx(1, c)).outcome, 'continue');
  const r = L.applyMove(m, 'X', hx(1, 3));
  assert.equal(r.outcome, 'win');
  assert.deepEqual(sorted(r.cells), [hx(1, 0), hx(1, 1), hx(1, 2), hx(1, 3)]);
});

test('hex: O wins with a straight column, and the same cells would not win for X', () => {
  const m = hex4();
  for (const r of [0, 1, 2]) L.applyMove(m, 'O', hx(r, 2));
  assert.equal(L.applyMove(m, 'O', hx(3, 2)).outcome, 'win');
  const x = hex4();
  for (const r of [0, 1, 2, 3]) assert.equal(L.applyMove(x, 'X', hx(r, 2)).outcome, 'continue', 'a column is not left-to-right');
  const o = hex4();
  for (const c of [0, 1, 2, 3]) assert.equal(L.applyMove(o, 'O', hx(1, c)).outcome, 'continue', 'a row is not top-to-bottom');
});

test('hex: a diagonal is connected one way and not the other', () => {
  const m = hex4();
  for (const [r, c] of [[3, 0], [2, 1], [1, 2]]) assert.equal(L.applyMove(m, 'X', hx(r, c)).outcome, 'continue');
  const win = L.applyMove(m, 'X', hx(0, 3));
  assert.equal(win.outcome, 'win');
  assert.deepEqual(sorted(win.cells), sorted([hx(3, 0), hx(2, 1), hx(1, 2), hx(0, 3)]));
  const n = hex4();
  for (const [r, c] of [[0, 0], [1, 1], [2, 2], [3, 3]]) assert.equal(L.applyMove(n, 'X', hx(r, c)).outcome, 'continue');
  assert.equal(L.hexPath(n.cells, 'X'), null);
});

test('hex: a winding path is found and reported edge to edge', () => {
  const m = hex4();
  const cells = [hx(0, 0), hx(1, 0), hx(1, 1), hx(0, 2), hx(0, 3)];
  let r;
  for (const c of cells) r = L.applyMove(m, 'X', c);
  assert.equal(r.outcome, 'win');
  const p = r.cells;
  assert.equal(p[0] % 4, 3, 'path starts on the right edge');
  assert.equal(p[p.length - 1] % 4, 0, 'path ends on the left edge');
  for (let k = 1; k < p.length; k++) assert.ok(L.hexNeighbors(p[k - 1], 4).includes(p[k]), 'consecutive path cells touch');
  const b = hex4();
  for (const c of [hx(0, 0), hx(1, 0), hx(0, 2), hx(0, 3)]) L.applyMove(b, 'X', c);
  L.applyMove(b, 'O', hx(1, 1));
  assert.equal(L.hexPath(b.cells, 'X'), null);
  assert.equal(L.applyMove(b, 'X', hx(1, 1)).ok, false, 'taken cells are rejected');
});

test('hex tactics: connects when one cell short and blocks the opponent\'s last link', () => {
  const cells = ['X', 'X', 'X', null, null, null, null, null, null, null, null, null, null, null, null, null];
  assert.equal(L.hexDist(cells, 'X'), 1);
  const win = L.localBest({ type: 'hex', cells }, 'X', cpuRng());
  assert.equal(win.move, 3); assert.equal(win.win, true);
  const block = L.localBest({ type: 'hex', cells }, 'O', cpuRng());
  assert.equal(block.move, 3, 'O takes the last cell of the row');
  const col = ['O', null, null, null, 'O', null, null, null, 'O', null, null, null, null, null, null, null];   // down the left edge: only cell 12 finishes it
  assert.equal(L.hexDist(col, 'O'), 1);
  assert.equal(L.localBest({ type: 'hex', cells: col }, 'X', cpuRng()).move, 12);
  const fork = [null, 'O', null, null, null, 'O', null, null, null, 'O', null, null, null, null, null, null];     // two cells finish it: nothing stops O
  assert.equal(L.hexDist(fork, 'O'), 1);
  assert.ok(L.localBest({ type: 'hex', cells: fork }, 'X', cpuRng()).v < -500, 'X knows the square is lost');
  assert.equal(L.hexDist(new Array(16).fill(null), 'X'), 4);
  assert.equal(L.hexDist(['O', 'O', 'O', 'O', null, null, null, null, null, null, null, null, null, null, null, null], 'O'), 3, 'a row does not help O');
});

test('hex: the admin\'s settings (the computer\'s mistake rate) are dealt into the square and played by', () => {
  E.setTune('hex', { miss: 50 });
  const m = E.newMini('hex', E.makeRng('hex-tune'));
  E.setTune('hex', null);
  assert.deepEqual(m.tune, { miss: 50 });
  m.cells[0] = m.cells[1] = m.cells[2] = m.cells[3] = 'X';   // X wins at cell 4
  const moves = new Set();
  for (let k = 0; k < 30; k++) moves.add(E.localBest(E.publicMini(m), 'X', E.makeRng('hex-ai' + k)).move);
  assert.ok(moves.has(4) && moves.size > 1, 'a slip now and then');
});

test('hex: the Hard computer searches deeper (a forced win Normal misses), legal moves, within its time', () => {
  const hard = { level: 'hard', until: null }, normal = { level: 'normal', until: null };
  const R = require('../../src/games/hex/rules.js');                 // (the search itself)
  const cells = [null, 'X', null, null, 'X', null, null, null, null, 'O', null, 'O', null, null, null, null];   // X to move: cell 6 wins by force in four plies; Normal plays 2 and O wins by force
  const pm = { type: 'hex', cells };
  const h = R.hexHard(cells, 'X');
  assert.ok(h.moves[0].i === 6 && h.moves[0].v >= R.HEX_HARD.win - 16, `a forced win seen (${JSON.stringify(h.moves[0])} at depth ${h.depth})`);
  assert.equal(L.localBest(pm, 'X', cpuRng(), {}, hard).move, 6);
  assert.equal(L.localBest(pm, 'X', cpuRng(), {}, normal).move, 2, 'Normal as before');
  const after = cells.slice(); after[2] = 'X';
  assert.ok(R.hexHard(after, 'O').moves[0].v >= R.HEX_HARD.win - 16, 'after Normal\'s move O wins by force');
  // the shape the square choice needs: a win now, a block, the position after
  const row = ['X', 'X', 'X', null, null, null, null, null, null, null, null, null, null, null, null, null];
  const w = L.localBest({ type: 'hex', cells: row }, 'X', cpuRng(), {}, hard);
  assert.equal(w.move, 3); assert.equal(w.win, true); assert.equal(w.after.cells[3], 'X');
  assert.equal(L.localBest({ type: 'hex', cells: row }, 'O', cpuRng(), {}, hard).move, 3, 'O blocks');
  const e = L.localBest(L.publicMini(hex4()), 'X', cpuRng(), {}, hard);
  assert.ok(Number.isInteger(e.move) && e.move >= 0 && e.move < 16 && e.after.cells[e.move] === 'X' && !e.win);
  const e5 = L.localBest(L.publicMini(hex5()), 'X', cpuRng(), {}, hard);
  assert.ok(Number.isInteger(e5.move) && e5.move >= 0 && e5.move < 25 && e5.after.cells[e5.move] === 'X', '5x5 too');
  const r = lcg(5);
  for (let k = 0; k < 8; k++) {
    const b = mini('hex', lcg(k + 20)); let p = 'X', dead = false;
    for (let i = 0; i < k; i++) { const mv = L.randomLegalMove(b, p, r); if (L.applyMove(b, p, mv, r).outcome !== 'continue') { dead = true; break; } p = L.other(p); }
    if (dead) continue;
    const mv = L.localBest(L.publicMini(b), p, cpuRng(), {}, hard).move;
    assert.ok(Number.isInteger(mv) && !b.cells[mv], `a legal cell (${mv})`);
  }
  const sq = hex4(); sq.tune = { miss: 50 }; sq.cells[0] = sq.cells[1] = sq.cells[2] = 'X';
  const slips = new Set();
  for (let i = 0; i < 20; i++) slips.add(L.localBest(L.publicMini(sq), 'X', E.makeRng('hex-hard-miss' + i), {}, hard).move);
  assert.ok(slips.has(3) && slips.size > 1, 'the mistake rate still applies');
  // the time: a fixed amount of work without a clock, under 60 ms a move here; with a clock it stops when told
  L.localBest(L.publicMini(mini('hex')), 'X', cpuRng(), {}, hard);                                  // (warm)
  for (const seed of [0, 1, 2, 3]) {
    const b = mini('hex', lcg(seed + 40)); let p = 'X';
    for (let i = 0; i < seed * 2; i++) { const mv = L.randomLegalMove(b, p, r); L.applyMove(b, p, mv, r); p = L.other(p); }
    const t0 = performance.now(); L.localBest(L.publicMini(b), p, cpuRng(), {}, hard); const ms = performance.now() - t0;
    assert.ok(ms < 150, `a Hard move in ${ms.toFixed(1)} ms`);
  }
  const t1 = performance.now(), until = () => Math.max(0, t1 + 12 - performance.now());
  const timed = L.localBest(L.publicMini(mini('hex')), 'X', cpuRng(), {}, { level: 'hard', until });
  assert.ok(performance.now() - t1 < 40 && Number.isInteger(timed.move) && timed.move >= 0 && timed.move < 16, 'stops at its budget with a legal move');
});

test('hex: there is no swap: it is no move, in a new square or an old one, and the public view carries no rule', () => {
  const m = hex5();
  L.applyMove(m, 'X', hx5(1, 3));
  assert.equal(L.applyMove(m, 'O', 'swap').ok, false, 'the other player cannot take the first stone');
  assert.equal(m.cells.filter(Boolean).length, 1); assert.equal(L.publicMini(m).swap, undefined);
  const old = hex4(); L.applyMove(old, 'X', 5);
  assert.equal(L.applyMove(old, 'O', 'swap').ok, false);
  for (const ctx of [{}, { level: 'hard', until: null }]) {
    const t = hex5(); L.applyMove(t, 'X', hx5(2, 2));
    for (let k = 0; k < 8; k++) assert.notEqual(L.localBest(L.publicMini(t), 'O', lcg(k + 1), {}, ctx).move, 'swap', `${ctx.level || 'normal'}: never a swap`);
  }
});

test('hex: Hard plays the solved 5x5 game: its opening wins, and it wins every game the solved play wins', () => {
  const A = require('../../src/games/hex/ai.js'), R = require('../../src/games/hex/rules.js');
  const hard = { level: 'hard', until: null }, T = k => (k % 5) * 5 + Math.floor(k / 5);
  // the solved openings: the thirteen that win for the opener when the stone cannot be taken; a half turn of the board changes nothing
  assert.equal(A.HEX_WIN.length, 13);
  for (const k of A.HEX_WIN) assert.ok(A.HEX_WIN.includes(24 - k));
  // the search on small positions against a plain search of the rules
  const S = A.hexSolver(16), bits = (cells, p) => cells.reduce((x, c, i) => (c === p ? x | (1 << i) : x), 0);
  const brute = (cells, p) => {                                   // 1: p, to move, wins
    for (let i = 0; i < 25; i++) { if (cells[i]) continue; cells[i] = p; const w = !!R.hexPath(cells, p) || brute(cells, L.other(p)) < 0; cells[i] = null; if (w) return 1; }
    return -1;
  };
  const r = lcg(21);
  for (let k = 0; k < 25; k++) {
    const b = hex5(); let p = 'X', res = { outcome: 'continue' };
    while (res.outcome === 'continue' && b.cells.filter(c => !c).length > 9) { res = L.applyMove(b, p, L.randomLegalMove(b, p, r), r); p = L.other(p); }
    if (res.outcome !== 'continue') continue;
    S.start();
    assert.equal(S.value(bits(b.cells, 'X'), bits(b.cells, 'O'), p === 'X' ? 0 : 1), brute(b.cells.slice(), p), 'the solver and a plain search agree');
  }
  // Hard against random stones and against the deep search of before: no won game lost
  let games = 0;
  for (let g = 0; g < 80; g++) {
    const rng = E.makeRng('hex-solved' + g), b = hex5(), me = g % 2 ? 'X' : 'O', opener = (g >> 1) % 2 ? 'X' : 'O';
    let p = opener, res, first = null;
    do {
      let mv;
      if (p === me) mv = L.localBest(L.publicMini(b), p, rng, {}, hard).move;
      else if (g % 8 === 7) mv = R.hexHard(b.cells, p).moves[0].i;   // (the deep search of before)
      else mv = L.randomLegalMove(b, p, rng);
      if (first === null) first = mv;
      res = L.applyMove(b, p, mv, rng); assert.equal(res.ok, true);
      if (res.outcome === 'continue') p = L.other(p);
    } while (res.outcome === 'continue');
    const lostOpening = opener !== me && A.HEX_WIN.includes(opener === 'X' ? first : T(first));   // (the other side opened with a winner: nothing promised)
    if (!lostOpening) { games++; assert.equal(p, me, `game ${g}: Hard wins a game the solved play wins (${opener === me ? 'opening' : 'second, against ' + first})`); }
  }
  assert.ok(games >= 60);
  // the other levels' count of a square is untouched; Hard's own positions carry the solved result
  const m = hex5(); L.applyMove(m, 'X', 3);
  const pm = L.publicMini(m), lb = L.localBest(pm, 'O', lcg(1), {}, hard);
  assert.equal(L.needsOf(pm, 'X'), 4); assert.equal(L.needsOf(pm, 'O'), 5);
  assert.ok(L.needsOf(lb.after, 'O') > 5 * L.needsOf(lb.after, 'X'), 'after any answer to the winning opening the square is the opener\'s');
});
