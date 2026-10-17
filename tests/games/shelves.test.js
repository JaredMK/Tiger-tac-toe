'use strict';
// Shelves: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Shelves ===================================== */
test('shelves: seven shelves of three; a mark, then a grey mark on a random open spot; once full, the shelves you are on (up to 7); a tie goes to the player who did not open the square', () => {
  const m = E.newMini('shelves', lcg(1));
  assert.equal(m.cells.length, 21); assert.equal(m.first, null);
  E.applyMove(m, 'X', 4, lcg(2));
  assert.equal(m.cells[4], 'X'); assert.ok(m.last.grey != null && m.cells[m.last.grey] === 'G' && m.last.grey !== 4);
  assert.equal(m.first, 'X', 'who opened the square');
  E.applyMove(m, 'O', m.cells.indexOf(null), lcg(3)); assert.equal(m.first, 'X', 'and it stays');
  assert.equal(E.applyMove(m, 'O', 4).ok, false);
  const row = (...w) => w.concat(new Array(21 - w.length).fill(null));
  assert.deepEqual([E.shelfOn(row('X', null, null, 'X', 'X', null, null, null, null, 'O', 'X', 'O'), 'X'), E.shelfOn(row('X', null, null, 'X', 'X', null, null, null, null, 'O', 'X', 'O'), 'O')], [3, 1]);
  assert.equal(E.shelfOn(row(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'X'), 'X'), 1, 'the seventh shelf counts');
  const full = (cells, first) => { const q = E.newMini('shelves', lcg(9)); q.cells = cells; q.first = first; return q; };
  const end = full(['O', 'G', 'G', 'O', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'G', 'O', 'G', 'X', 'G', 'G', 'O', 'G', null], 'X');
  assert.deepEqual(E.applyMove(end, 'O', 20, lcg(4)), { ok: true, outcome: 'win', note: 'full', winner: 'O', counts: { X: 3, O: 5 } }, 'the last spot: O on five shelves, X on three');
  assert.equal(end.last.grey, null, 'no grey mark once full');
  const tie = c => ['X', 'G', 'G', 'O', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'G', 'O', 'G', 'X', 'G', 'G', 'O', 'G', null];
  assert.deepEqual(E.applyMove(full(tie(), 'X'), 'O', 20, lcg(6)), { ok: true, outcome: 'win', note: 'tiebreak', winner: 'O', counts: { X: 4, O: 4 } }, 'level: the tie goes to O (X opened the square)');
  assert.deepEqual(E.applyMove(full(tie(), 'O'), 'O', 20, lcg(6)), { ok: true, outcome: 'win', note: 'tiebreak', winner: 'X', counts: { X: 4, O: 4 } }, 'and to X when O opened it');
  const x = full(['X', 'G', 'G', 'X', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'O', 'O', 'G', 'X', 'G', 'G', 'G', 'G', null], 'O');
  assert.deepEqual(E.applyMove(x, 'O', 20, lcg(8)), { ok: true, outcome: 'win', note: 'full', winner: 'X', counts: { X: 5, O: 3 } });
  // a square from before: six shelves, and a tie resets it
  const old = { type: 'shelves', cells: ['X', 'G', 'G', 'O', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'G', 'O', 'G', 'X', 'G', null], last: null };
  const tr = E.applyMove(old, 'O', 17, lcg(6));
  assert.deepEqual([tr.outcome, tr.note], ['draw', 'tie'], `4 shelves each on an old square: a reset (${JSON.stringify(tr)})`);
});

test('shelves: the first mover no longer has the edge (the computer against itself: about 52% for whoever opens the square, under 60%)', () => {
  const N = 6000; let first = 0, decided = 0;
  for (let g = 0; g < N; g++) {
    const rng = lcg(1000 + g), m = E.newMini('shelves', rng), opener = g % 2 ? 'O' : 'X';
    let p = opener, res = null;
    while (!res || res.outcome === 'continue') { res = E.applyMove(m, p, E.shelfPick(E.publicMini(m), p, rng).i, rng); p = E.other(p); }
    assert.notEqual(res.outcome, 'draw', 'a tie never resets a new square');
    decided++; if (res.winner === opener) first++;
  }
  const rate = first / decided;
  assert.ok(rate < 0.6 && rate > 0.44, `first mover ${(100 * rate).toFixed(1)}% of ${decided}`);
});

test('shelves: the computer goes for shelves it is not on, more so ones the other player is missing too and that are nearly full', () => {
  const pm = { type: 'shelves', cells: new Array(21).fill(null) };
  pm.cells[0] = 'X'; pm.cells[1] = 'G';                              // shelf 0: X on it, one spot left
  pm.cells[3] = 'O'; pm.cells[4] = 'G';                              // shelf 1: O on it, one left
  pm.cells[6] = 'G'; pm.cells[7] = 'G';                              // shelf 2: nobody, one left
  const b = E.shelfPick(pm, 'X', null);
  assert.equal(b.i, 8, 'the nearly full shelf neither player is on');
  pm.cells[8] = 'G';
  assert.equal(E.shelfPick(pm, 'X', null).i, 5, 'then the nearly full one only the other player is on');
});
