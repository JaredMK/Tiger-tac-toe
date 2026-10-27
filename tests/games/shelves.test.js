'use strict';
// Shelves: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Shelves ===================================== */
test('shelves: seven shelves of three; a mark, then a grey mark on a random open spot; once full, the shelves you are on (up to 7); a tie is a draw, never the second mover\'s', () => {
  const m = E.newMini('shelves', lcg(1));
  assert.equal(m.cells.length, 21);
  E.applyMove(m, 'X', 4, lcg(2));
  assert.equal(m.cells[4], 'X'); assert.ok(m.last.grey != null && m.cells[m.last.grey] === 'G' && m.last.grey !== 4);
  assert.equal(E.applyMove(m, 'O', 4).ok, false);
  const row = (...w) => w.concat(new Array(21 - w.length).fill(null));
  assert.deepEqual([E.shelfOn(row('X', null, null, 'X', 'X', null, null, null, null, 'O', 'X', 'O'), 'X'), E.shelfOn(row('X', null, null, 'X', 'X', null, null, null, null, 'O', 'X', 'O'), 'O')], [3, 1]);
  assert.equal(E.shelfOn(row(null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'X'), 'X'), 1, 'the seventh shelf counts');
  const full = (cells, first) => { const q = E.newMini('shelves', lcg(9)); q.cells = cells; q.first = first; return q; };
  const end = full(['O', 'G', 'G', 'O', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'G', 'O', 'G', 'X', 'G', 'G', 'O', 'G', null], 'X');
  assert.deepEqual(E.applyMove(end, 'O', 20, lcg(4)), { ok: true, outcome: 'win', note: 'full', winner: 'O', counts: { X: 3, O: 5 } }, 'the last spot: O on five shelves, X on three');
  assert.equal(end.last.grey, null, 'no grey mark once full');
  const tie = c => ['X', 'G', 'G', 'O', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'G', 'O', 'G', 'X', 'G', 'G', 'O', 'G', null];
  for (const first of ['X', 'O']) assert.deepEqual(E.applyMove(full(tie(), first), 'O', 20, lcg(6)), { ok: true, outcome: 'draw', note: 'tie', counts: { X: 4, O: 4 } }, `level: a draw, whoever opened it (${first})`);
  const x = full(['X', 'G', 'G', 'X', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'O', 'O', 'G', 'X', 'G', 'G', 'G', 'G', null], 'O');
  assert.deepEqual(E.applyMove(x, 'O', 20, lcg(8)), { ok: true, outcome: 'win', note: 'full', winner: 'X', counts: { X: 5, O: 3 } });
  // a square from before: six shelves, and a tie resets it
  const old = { type: 'shelves', cells: ['X', 'G', 'G', 'O', 'G', 'G', 'X', 'O', 'G', 'X', 'G', 'G', 'G', 'O', 'G', 'X', 'G', null], last: null };
  const tr = E.applyMove(old, 'O', 17, lcg(6));
  assert.deepEqual([tr.outcome, tr.note], ['draw', 'tie'], `4 shelves each on an old square: a reset (${JSON.stringify(tr)})`);
});

test('shelves: with ties a draw, the first mover wins nearly every square that is not one (the computer against itself), so Shelves is Admin only', () => {
  const N = 2000; let first = 0, decided = 0, draws = 0;
  for (let g = 0; g < N; g++) {
    const rng = lcg(1000 + g), m = E.newMini('shelves', rng), opener = g % 2 ? 'O' : 'X';
    let p = opener, res = null;
    while (!res || res.outcome === 'continue') { res = E.applyMove(m, p, E.shelfPick(E.publicMini(m), p, rng).i, rng); p = E.other(p); }
    if (res.outcome === 'draw') { draws++; continue; }
    decided++; if (res.winner === opener) first++;
  }
  assert.ok(draws > 0 && first / decided > 0.9, `first mover ${(100 * first / decided).toFixed(1)}% of ${decided}, ${draws} draws: still lopsided (rebalance before release)`);
  assert.ok(E.TEST_TYPES.includes('shelves'), 'Admin only by default');
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

/* ---------- the admin's Mini-game Settings ---------- */
function tunedPlay(t, seed, guard = 400) {                        // (the computer on both sides of square 4 until it is decided)
  const st = E.newMatch(lcg(seed), { games: Object.fromEntries(E.TYPES.map(g => [g, g === t])) }), rr = lcg(seed + 7);
  let n = 0, kind = null;
  while (n < guard) {
    st.lock = 4;
    const m = E.cpuMove(st, rr), r = E.playMove(st, 4, m.move, rr);
    assert.equal(r.ok, true, `${t}: ${JSON.stringify(m.move)} refused (${r.reason})`);
    n++; kind = st.flash.kind; E.endFlash(st); st.lock = null;
    if (kind !== 'move' && kind !== 'again') break;
  }
  assert.ok(n < guard, `${t}: the square is decided`);
  return st;
}
test('shelves: the admin\'s settings: five shelves of four and mistakes deal a square that plays by them', () => {
  E.setTune('shelves', { n: 5, per: 4, miss: 20 });
  try {
    const m = E.newMini('shelves', lcg(1));
    assert.equal(m.cells.length, 20);
    m.cells = ['X', null, null, null, null, 'X', null, null, null, null, null, null, null, null, null, null, null, null, null, null];
    assert.equal(E.shelfOn(m.cells, 'X', 4), 2, 'spots 0 and 5: shelves 1 and 2 of four spots each');
    const st = tunedPlay('shelves', 11);
    assert.equal(st.squares[4].mini.cells.length, 20);
  } finally { E.setTune('shelves', null); }
  assert.equal(E.newMini('shelves', lcg(1)).cells.length, 21);
});

/* ---------- the Hard computer ---------- */
test('shelves: Hard solves the square (every grey mark counted): it keeps the tie that Normal throws away, plays a legal spot, and takes under 60 ms', () => {
  const hard = { level: 'hard', until: null };
  // O to move, spots 7, 18 and 20 open: a mark on shelf 6 (18 or 20) holds X to a tie (a draw) half the time (X
  // takes the last spot of shelf 6 only when the grey misses it); Normal's 7 lets X have shelf 6 for sure, and the square
  const cells = 'XGGGXOO.XGGGXGXGGO.O.'.split('').map(c => (c === '.' ? null : c));
  const pm = { type: 'shelves', cells };
  assert.equal(E.shelfPick(pm, 'O', null).i, 7, 'Normal');
  const b = E.localBest(pm, 'O', lcg(1), {}, hard);
  assert.ok(b.move === 18 || b.move === 20, 'Hard: ' + b.move);
  assert.equal(b.after.cells[b.move], 'O');
  // a legal move from any position, on the usual board and the admin's; the time it takes
  const times = [];
  for (let g = 0; g < 12; g++) {
    const q = E.newMini('shelves', lcg(20 + g)), rng = lcg(40 + g);
    let p = 'X';
    for (let k = 0; k < g % 7; k++) { E.applyMove(q, p, q.cells.indexOf(null), rng); p = E.other(p); }
    const t0 = performance.now(), r = E.localBest(E.publicMini(q), p, rng, {}, hard);
    times.push(performance.now() - t0);
    assert.equal(q.cells[r.move], null, 'a legal spot');
    assert.equal(E.applyMove(q, p, r.move, rng).ok, true);
  }
  const ms = times.slice(1).sort((a, b) => a - b), txt = 'ms: ' + times.map(t => t.toFixed(1)).join(' ');
  assert.ok(ms[ms.length >> 1] < 60 && ms[ms.length - 1] < 200, txt);   // (typically under 60, never slow: a busy CI runner can spike one)
  E.setTune('shelves', { n: 5, per: 4 });
  try { const q = E.newMini('shelves', lcg(9)); const r = E.localBest(E.publicMini(q), 'X', lcg(1), {}, hard); assert.equal(q.cells[r.move], null); } finally { E.setTune('shelves', null); }
});
