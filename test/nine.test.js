'use strict';
// Run with:  node --test
// Craps, Takeover and Flood (and the rest of the nine, as they come) in the shared engine.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const die = n => (n - 1) / 6 + 0.01;                              // an rng value that makes randInt(rng, 6) roll n - 1
const dice = (...pairs) => seq(...pairs.flatMap(([a, b]) => [die(a), die(b)]));
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

/* ===================================== Craps ===================================== */
test('craps: the come-out roll wins on 7 or 11, loses on 2, 3 or 12; anything else is the point, made before a 7 to win', () => {
  const r = (...pairs) => E.crapsRound(dice(...pairs));
  assert.deepEqual(r([3, 4]), { rolls: [[3, 4]], point: null, result: 'win' }, '7 on the come-out');
  assert.deepEqual(r([5, 6]), { rolls: [[5, 6]], point: null, result: 'win' }, '11 on the come-out');
  for (const [a, b] of [[1, 1], [1, 2], [6, 6]]) assert.equal(r([a, b]).result, 'lose', `${a + b} on the come-out: craps`);
  const made = r([2, 2], [6, 5], [5, 1], [3, 1]);                   // point 4; 11 and 6 roll on; 4 made
  assert.deepEqual([made.point, made.result, made.rolls.length], [4, 'win', 4]);
  const out = r([4, 4], [6, 6], [2, 3], [4, 3]);                    // point 8; 12 and 5 roll on (no craps after the come-out); seven out
  assert.deepEqual([out.point, out.result, out.rolls.length], [8, 'lose', 4]);
  assert.equal(r([5, 5], [3, 4]).result, 'lose', 'point 10, then a 7');
  assert.equal(r([4, 2], [1, 1], [6, 5], [3, 3]).result, 'win', 'point 6: 2 and 11 mean nothing after the come-out');
});

test('craps: about 49% of rounds win (244 in 495); first to 2 round wins; a loss takes nothing away; a move is the whole round', () => {
  const rng = lcg(5); let w = 0, rolls = 0; const N = 100000;
  for (let k = 0; k < N; k++) { const x = E.crapsRound(rng); if (x.result === 'win') w++; rolls += x.rolls.length; }
  assert.ok(Math.abs(w / N - 244 / 495) < 0.006, `win odds ${(w / N).toFixed(4)} (wanted 0.4929)`);
  assert.ok(Math.abs(rolls / N - 3.376) < 0.05, `about 3.4 rolls a round (${(rolls / N).toFixed(2)})`);
  const m = E.newMini('craps', lcg(1));
  assert.deepEqual(m.wins, { X: 0, O: 0 });
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([1, 1])), { ok: true, outcome: 'continue', note: 'lost' });
  assert.deepEqual([m.wins.X, m.rounds.X], [0, 1], 'a loss: nothing taken away');
  assert.equal(E.applyMove(m, 'X', 'roll', dice([3, 4])).note, 'won'); assert.equal(m.wins.X, 1);
  assert.deepEqual(E.applyMove(m, 'O', 'auto', dice([2, 2], [2, 2])), { ok: true, outcome: 'continue', note: 'won' }, 'a timeout rolls the round to its end');
  assert.deepEqual(E.applyMove(m, 'X', 'roll', dice([5, 6])), { ok: true, outcome: 'win', note: 'won' }, 'two rounds: the square');
  for (const bad of ['stand', 3, null]) assert.equal(E.applyMove(E.newMini('craps', lcg(2)), 'X', bad).ok, false);
  // the flash carries every roll and the point; the playback takes each roll in turn
  const st = E.newMatch(lcg(3), { games: ['craps'] });
  E.playMove(st, 0, 'roll', dice([3, 3], [1, 2], [6, 6], [2, 4]));
  assert.deepEqual(st.flash.craps.rolls, [[3, 3], [1, 2], [6, 6], [2, 4]]); assert.equal(st.flash.craps.point, 6); assert.equal(st.flash.craps.result, 'win');
  const t = E.crapsTimes(st.flash.craps.rolls, 6);
  assert.deepEqual(t.at, [0, E.CRAPS.roll + E.CRAPS.puck, 2 * E.CRAPS.roll + E.CRAPS.puck, 3 * E.CRAPS.roll + E.CRAPS.puck], 'one roll after another, the puck after the come-out');
  assert.equal(E.playMs(st.flash), t.end + E.CRAPS.hold);
  assert.equal(E.randomLegalMove(st.squares[1].mini, 'X', lcg(1)), 'roll');
  assert.equal(E.secretOf(st.squares[1].mini), null, 'nothing hidden: the dice are rolled as the move is made');
});

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

/* ===================================== Flood ===================================== */
test('flood: six by six, five colours, the blob starts as the top-left cell alone; a colour grows it; the cells grabbed go to the mover; 18 wins', () => {
  for (let k = 0; k < 50; k++) { const m = E.newMini('flood', lcg(k)); assert.equal(m.colors.length, 36); assert.ok(m.colors.every(c => c >= 0 && c < 5)); assert.ok(m.colors[1] !== m.colors[0] && m.colors[6] !== m.colors[0], 'the blob is one cell to begin with'); assert.equal(m.owner[0], '-'); }
  const m = E.newMini('flood', lcg(1));
  m.colors = [0, 1, 1, 2, 3, 4, 2, 1, 3, 3, 4, 0, 2, 2, 2, 3, 4, 1, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0];
  assert.equal(E.applyMove(m, 'X', 0).ok, false, 'not the blob\'s own colour');
  const r = E.applyMove(m, 'X', 1);
  assert.equal(r.note, 'grow'); assert.deepEqual(m.last.waves.map(w => w.slice().sort((a, b) => a - b)), [[1], [2, 7]], 'the 1s joined to the blob, in waves out from it');
  assert.equal(m.score.X, 3); assert.deepEqual([m.owner[1], m.owner[2], m.owner[7], m.owner[0]], ['X', 'X', 'X', '-']);
  assert.ok([0, 1, 2, 7].every(i => m.colors[i] === 1), 'the whole blob in the new colour');
  E.applyMove(m, 'O', 2);                                              // 2s next to the blob: 3 (via 2), 6, 12, 13, 14 ...
  assert.ok(m.score.O >= 3 && m.owner[3] === 'O' && m.owner[6] === 'O', `O's grab (${m.score.O})`);
  assert.equal(m.last.waves.flat().length, m.score.O);
  const none = E.applyMove(m, 'X', 0);
  assert.ok(none.ok && ['grow', 'none'].includes(none.note));
  // 18 wins: the mover, there and then
  const w = E.newMini('flood', lcg(2)); w.score = { X: 17, O: 10 };
  const c = [0, 1, 2, 3, 4].find(k => k !== w.colors[0] && E.floodGain(w, k) > 0);
  assert.equal(E.applyMove(w, 'X', c).outcome, 'win');
  for (const bad of [-1, 5, 'red', null]) assert.equal(E.applyMove(E.newMini('flood', lcg(5)), 'X', bad).ok, false);
});

test('flood: the computer looks two moves ahead, always grows the blob when it can, and a square of it against itself ends', () => {
  const m = E.newMini('flood', lcg(9)), pm = E.publicMini(m);
  const b = E.floodSearch(pm, 'X', null);
  const gains = [0, 1, 2, 3, 4].filter(c => c !== m.colors[0]).map(c => E.floodGain(pm, c));
  assert.ok(Math.max(...gains) === 0 || b.gain > 0, 'a colour that grabs something');
  let total = 0; const N = 40;
  for (let k = 0; k < N; k++) { const { n, owner } = cpuSquare('flood', 100 + k); assert.ok(owner, `decided (${n} moves)`); total += n; }
  assert.ok(total / N / 2 >= 3 && total / N / 2 <= 8, `about ${(total / N / 2).toFixed(1)} moves a player`);
});

/* ===================================== together ===================================== */
test('the new games: admin only to begin with, in the full list, dealt and played to the end by the computer; random and timed-out moves are legal', () => {
  for (const t of ['craps', 'takeover', 'flood']) {
    assert.ok(E.TYPES.includes(t) && E.TEST_TYPES.includes(t), `${t}: in the list, admin only`);
    assert.ok(E.INFO[t] && E.INFO[t].name, `${t}: named`);
    for (let k = 0; k < 30; k++) {
      const st = E.newMatch(lcg(k), { games: [t] }), mv = E.randomLegalMove(st.squares[0].mini, 'X', lcg(k + 1));
      assert.equal(E.playMove(st, 0, mv, lcg(k + 2)).ok, true, `${t}: a random move (${JSON.stringify(mv)})`);
      assert.ok(E.playMs(st.flash) >= 500 && E.playMs(st.flash) < 60000);
    }
    const st = E.newMatch(lcg(7), { games: [t], mode: 'online', timer: 60 });
    assert.equal(E.timeoutMove(st, lcg(8)).ok, true, `${t}: a timeout`);
    const { n, owner } = cpuSquare(t, 21);
    assert.ok(owner, `${t}: decided (${n} moves)`);
  }
  // a whole match of the three with others, the computer on both sides
  const rng = lcg(31), st = E.newMatch(rng, { games: ['craps', 'takeover', 'flood', 'ttt'] });
  let n = 0;
  while (!st.winner && n++ < 600) { const m = E.cpuMove(st, rng); assert.equal(E.playMove(st, m.square, m.move, rng).ok, true); E.endFlash(st); }
  assert.ok(st.winner, `a match finishes (${n} moves)`);
});
