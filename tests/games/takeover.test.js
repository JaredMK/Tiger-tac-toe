'use strict';
// Takeover: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
function cpuSquare(t, seed, guard = 400) {                        // the computer on both sides of one square: moves until it is decided
  const st = E.newMatch(lcg(seed), { games: [t] }), rr = lcg(seed + 7);
  let n = 0, kind = null;
  while (n < guard) {
    st.lock = 4;
    const m = E.cpuMove(st, rr), r = E.playMove(st, 4, m.move, rr);
    assert.equal(r.ok, true, `${t}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    assert.deepEqual(JSON.parse(JSON.stringify(st)), st, 'the state stays plain JSON');
    n++; kind = st.flash.kind; E.endFlash(st); st.lock = null;
    if (kind !== 'move' && kind !== 'again') break;
  }
  return { n, kind, owner: st.squares[4].owner };
}

/* ===================================== Takeover ===================================== */
test('takeover: an empty cell and the cells around it, the other player\'s too; the full board goes to whoever has most', () => {
  const m = E.newMini('takeover', lcg(1)), o = 'O';
  assert.equal(m.cells.length, 25); assert.ok(m.cells.every(c => c === null));
  assert.deepEqual(E.applyMove(m, 'X', 12), { ok: true, outcome: 'continue', note: 'take' });
  assert.deepEqual(m.cells.map((c, i) => (c ? i : -1)).filter(i => i >= 0), [7, 11, 12, 13, 17], 'the middle and its four neighbours');
  assert.equal(E.applyMove(m, 'O', 12).ok, false, 'a taken cell is not a move'); assert.equal(E.applyMove(m, 'O', 7).ok, false);
  const r = E.applyMove(m, o, 8);
  assert.equal(r.note, 'flip', 'the other player\'s neighbours turn over');
  assert.deepEqual(m.last.flipped.slice().sort((a, b) => a - b), [7, 13]); assert.deepEqual(m.last.took.slice().sort((a, b) => a - b), [3, 8, 9]);
  assert.deepEqual([E.takeCount(m.cells, 'X'), E.takeCount(m.cells, 'O')], [3, 5]);
  assert.deepEqual(E.takeNear(0).sort((a, b) => a - b), [0, 1, 5], 'a corner has two neighbours'); assert.equal(E.takeNear(24).length, 3);
  // the last empty cell: the board full, most cells wins, the mover or not
  const f = E.newMini('takeover', lcg(2));
  f.cells = Array.from({ length: 25 }, (_, i) => (i < 13 ? 'X' : 'O')); f.cells[24] = null;
  const end = E.applyMove(f, 'X', 24);
  assert.deepEqual([end.outcome, end.winner, end.counts], ['win', 'X', { X: 16, O: 9 }]);
  const g = E.newMini('takeover', lcg(3));
  g.cells = Array.from({ length: 25 }, (_, i) => (i < 17 ? 'O' : 'X')); g.cells[0] = null;
  const end2 = E.applyMove(g, 'X', 0);
  assert.deepEqual([end2.winner, end2.counts.X + end2.counts.O], ['O', 25], 'the mover can fill the board and still lose it');
  for (const bad of [-1, 25, 'x', 1.5]) assert.equal(E.applyMove(E.newMini('takeover', lcg(4)), 'X', bad).ok, false);
});

test('takeover: the computer looks two moves ahead: it takes the most it can keep', () => {
  // X can take 3 of O's cells by playing between them, or a lone corner: it takes them
  const cells = new Array(25).fill(null); for (const k of [6, 8, 2, 12]) cells[k] = 'O';
  const b = E.takeSearch(cells, 'X', null);
  assert.equal(b.i, 7, 'the cell between O\'s four');
  // and it never leaves a full board lost when a winning finish is there
  const end = Array.from({ length: 25 }, (_, i) => (i % 2 ? 'X' : 'O')); end[0] = null; end[1] = 'O'; end[5] = 'O';
  const fin = E.takeSearch(end, 'X', null);
  assert.equal(fin.i, 0);
  const { n, owner } = cpuSquare('takeover', 11);
  assert.ok(owner && n >= 6 && n <= 14, `a square of the computer against itself is decided (${n} moves)`);
});
