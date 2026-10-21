'use strict';
// Clash Grid: its rules, its Super Chaos round end and its AI, test by test (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');

const grid = s => s.replace(/\s/g, '').split('').map(ch => (ch === '.' ? null : ch));   // 25 cells, row by row: . X O B
const clash = cells => ({ type: 'clash', cells, last: null });
const sq = mini => ({ owner: null, mini, mv: { X: 0, O: 0 } });
// A Super Chaos round against the computer (it plays O): Clash Grid in square 0, the computer's claim given.
function round(cells, cpuCell) {
  const rng = E.makeRng('cl');
  const st = E.newState(rng);
  st.setup.local = { pick: 'X', p2: 'cpu', n1: '', n2: '' };
  E.seatLocal(st.setup, rng);
  assert.ok(E.startChaos(st, rng));
  st.squares = Array.from({ length: 9 }, (_, i) => sq(i ? { type: 'hilo', target: 20, lo: 1, hi: 20, guesses: [] } : clash(cells)));
  E.scBegin(st, rng);
  st.sc.cpu = E.scCpu(st, rng, { square: 0, moves: [cpuCell] });
  return st;
}
function human(st, c) {
  const r = E.playMove(st, 0, c, E.makeRng('h'));
  assert.ok(r.ok, JSON.stringify(r));
  st.flash = null; E.leaveSquare(st);
  return E.chaosResolve(st, E.makeRng('r'));
}

test('clash grid: 28 runs of four on a 5x5 grid; a claim takes an empty cell; four in a row wins', () => {
  assert.equal(E.CLASH_LINES.length, 28);
  const m = E.newMini('clash', E.makeRng('c'));
  assert.equal(m.cells.length, 25);
  for (const c of [0, 1, 2]) assert.equal(E.applyMove(m, 'X', c).outcome, 'continue');
  assert.equal(E.applyMove(m, 'O', 2).ok, false, 'taken');
  const r = E.applyMove(m, 'X', 3);
  assert.deepEqual([r.outcome, r.cells], ['win', [0, 1, 2, 3]]);
  const b = clash(grid('XXXB. ..... ..... ..... .....'));
  assert.equal(E.clashLine(b.cells, 'X'), null, 'a blocked cell breaks the line');
});

test('clash grid in Super Chaos: the same cell in the same round is blocked for good (a clash in the recap); different cells both stand', () => {
  const st = round(grid('..... ..... ..... ..... .....'), 12);
  const rc = human(st, 12);
  const m = st.squares[0].mini;
  assert.equal(m.cells[12], 'B');
  assert.equal(m.cells.filter(c => c).length, 1);
  assert.deepEqual(rc.resolve.map(x => [x.square, x.flash.scr.blocked]), [[0, 12]], 'the clash plays in its square');
  assert.equal(rc.pre[0].cells[12], null, 'until then the cell is empty on the board');
  const s2 = round(grid('..... ..... ..... ..... .....'), 6);
  const r2 = human(s2, 12);
  assert.deepEqual([s2.squares[0].mini.cells[12], s2.squares[0].mini.cells[6]], ['X', 'O']);
  assert.deepEqual(r2.resolve, []);
});

test('clash grid in Super Chaos: four in a row claims the square; a collision on the fourth cell stops it; both at once reset it', () => {
  const st = round(grid('XXX.. OOO.. ..... ..... .....'), 20);
  assert.deepEqual(human(st, 3).claims.map(c => [c.square, c.by]), [[0, 'X']]);
  const s2 = round(grid('XXX.. ..... OO... ..... .....'), 3);
  const r2 = human(s2, 3);
  assert.deepEqual([r2.claims.length, s2.squares[0].mini.cells[3]], [0, 'B'], 'blocked: no four');
  const s3 = round(grid('XXX.. OOO.. ..... ..... .....'), 8);
  const r3 = human(s3, 3);
  assert.deepEqual(r3.resets.map(x => [x.square, x.why]), [[0, 'both']], 'a double win resets');
});

test('clash grid in Super Chaos: the fourth claim is never judged on the mover\'s own screen (no win, no line); four in a row is found, and lit up, only at the round\'s end', () => {
  const st = round(grid('XXX.. OOO.. ..... ..... .....'), 20);
  const r = E.playMove(st, 0, 3, E.makeRng('h'));
  assert.ok(r.ok);
  assert.deepEqual([r.flash.kind, r.flash.winner, r.flash.clash.line, st.sc.me.win], ['move', undefined, null, false], 'a plain claim on the mover\'s screen');
  assert.equal(st.squares[0].mini.winCells, undefined);
  st.flash = null; E.leaveSquare(st);
  const rc = E.chaosResolve(st, E.makeRng('r'));
  assert.deepEqual(rc.resolve.map(x => [x.square, x.flash.scr.lines, x.flash.scr.who]), [[0, [[0, 1, 2, 3]], 'X']], 'the round\'s end lights the line in the square');
  assert.deepEqual(rc.claims.map(c => [c.square, c.by]), [[0, 'X']]);
  // the computer's fourth claim, in its own move: a plain claim too (the recap replays it), the line only at the end
  const s2 = round(grid('XX... OOO.. ..... ..... .....'), 8);
  assert.equal(s2.sc.cpu.win, false);
  assert.ok(s2.sc.cpu.steps.every(f => !f.clash.line && f.kind === 'move'));
});

test('clash grid in Super Chaos: a full grid, or one where neither can still make four, resets', () => {
  const full = grid('XOXOX XOXOX OXOXO OXOXO XOX..');
  const st = round(full, 23);
  const rc = human(st, 24);
  assert.deepEqual(rc.resets.map(x => [x.square, x.why]), [[0, 'full']]);
  const dead = grid('XOBOX OXBXO BBBBB XOBOX ..B..');
  const s2 = round(dead, 21);
  assert.deepEqual(human(s2, 20).resets.map(x => [x.square, x.why]), [[0, 'blocked']]);
});

test('clash grid AI: completes its own four, blocks the other player\'s, and steers clear of a cell the other player wants when a collision there would cost it', () => {
  const rng = E.makeRng('ai');
  const pm = c => ({ type: 'clash', cells: c, last: null });
  assert.equal(E.localBest(pm(grid('OOO.. ..... XX... ..... .....')), 'O', rng).move, 3, 'its own four');
  assert.equal(E.localBest(pm(grid('XXX.. ..... ..O.. ..... .....')), 'O', rng).move, 3, 'blocks the three');
  // O can finish at 3 (where X will block it: both picking it blocks it for good) or at 14, down its column: it takes 14
  const c = grid('OOO.O XXX.O ..... ....O .....');
  const m = E.localBest(pm(c), 'O', rng).move;
  assert.ok(m === 14, 'the cell X will not take: ' + m);
  assert.ok(E.needsOf(pm(grid('OOO.. ..... ..... ..... .....')), 'O') < E.needsOf(pm(grid('O.... ..... ..... ..... .....')), 'O'));
});

test('clash grid: Super Chaos only; never dealt in a normal match', () => {
  assert.ok(E.SC_ONLY.includes('clash') && E.scTypes().includes('clash'));
  assert.equal(E.dealable('clash'), false);
  assert.equal(E.dealable('clash', true), true);
  const rng = E.makeRng('n');
  const st = E.newState(rng);
  for (const t of E.TYPES) st.setup.games[t] = t === 'clash';
  assert.equal(E.startMatch(st, rng), false, 'a normal match cannot deal it');
  for (const t of E.TYPES) st.setup.games[t] = true;
  for (let k = 0; k < 40; k++) { assert.ok(E.startMatch(st, E.makeRng('m' + k))); assert.ok(!st.squares.some(s => s.mini.type === 'clash')); }
  assert.ok(!E.newState(rng).squares.some(s => s.mini.type === 'clash'));
});

test('clash grid: computer against computer in Super Chaos rounds: squares are won (others reset), and collisions happen', () => {
  const rng = E.makeRng('aa');
  let claims = 0, won = 0, blocked = 0, games = 0;
  for (let g = 0; g < 150; g++) {
    let cells = new Array(25).fill(null);
    for (let r = 0; r < 25; r++) {
      const x = E.localBest({ type: 'clash', cells }, 'X', rng).move, o = E.localBest({ type: 'clash', cells }, 'O', rng).move;
      cells = cells.slice();
      if (x === o) { cells[x] = 'B'; blocked++; } else { cells[x] = 'X'; cells[o] = 'O'; }
      claims++;
      const wx = E.clashLine(cells, 'X'), wo = E.clashLine(cells, 'O');
      if (wx || wo) { if (!(wx && wo)) won++; break; }
      if (!cells.includes(null) || (!E.clashOpen(cells, 'X').length && !E.clashOpen(cells, 'O').length)) break;
    }
    games++;
  }
  const avg = claims / games;
  assert.ok(avg >= 4 && avg <= 10, 'rounds a square: ' + avg.toFixed(2));
  assert.ok(won / games > 0.25, 'squares are won: ' + won + '/' + games);
  assert.ok(blocked > 0, 'collisions: ' + blocked);
  console.log(`clash AI v AI: ${avg.toFixed(2)} rounds a square, ${won}/${games} won, ${blocked} cells blocked`);
});

test('clash grid: the admin settings deal a 6x6 grid where three in a row wins (also at the round\'s end); the computer plays it', () => {
  E.setTune('clash', { n: 6, need: 3, miss: 10 });
  try {
    const m = E.newMini('clash', E.makeRng('t'));
    assert.equal(m.cells.length, 36); assert.deepEqual(m.tune, { n: 6, need: 3, miss: 10 });
    assert.equal(E.applyMove(m, 'X', 0).outcome, 'continue'); assert.equal(E.applyMove(m, 'X', 7).outcome, 'continue');
    assert.deepEqual(E.applyMove(m, 'X', 14).cells, [0, 7, 14]);
    const rng = E.makeRng('t2'), g = E.newMini('clash', rng);
    for (let n = 0; n < 36; n++) { const mv = E.localBest(E.publicMini(g), n % 2 ? 'O' : 'X', rng).move; assert.equal(g.cells[mv], null); if (E.applyMove(g, n % 2 ? 'O' : 'X', mv).outcome === 'win') break; }
    // Super Chaos: X's third in a row is judged at the round's end
    const st = E.newState(rng);
    st.setup.local = { pick: 'X', p2: 'cpu', n1: '', n2: '' };
    E.seatLocal(st.setup, rng);
    assert.ok(E.startChaos(st, rng));
    st.squares = Array.from({ length: 9 }, (_, i) => sq(i ? { type: 'hilo', target: 20, lo: 1, hi: 20, guesses: [] } : Object.assign(E.newMini('clash', rng), { cells: grid('XX.... ...... ...... ...... ...... ......') })));
    E.scBegin(st, rng);
    st.sc.cpu = E.scCpu(st, rng, { square: 0, moves: [35] });
    human(st, 2);
    assert.equal(st.squares[0].owner, 'X');
  } finally { E.setTune('clash', null); }
});
