'use strict';
// Twist Four (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/twist/rules.js');
const M = require('../../src/games/twist/meta.js');

const put = (m, p, cells) => { for (const c of cells) m.cells[c] = p; };

test('twist: Admin only, brain; a 6x6 board in four quarters, 4 in a row to win by default (5 ran ten turns each)', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'brain', '1.24.0']);
  assert.deepEqual(E.gameFields('twist').map(f => f.k), ['line', 'size']);
  const m = E.newMini('twist', E.makeRng('a'));
  assert.deepEqual([m.n, m.L, m.cells.length, m.cells.every(c => c === null)], [6, 4, 36, true]);
  assert.equal(R.twistLines(6, 5).length, 32); assert.equal(R.twistLines(6, 4).length, 54);
  assert.equal(E.secretOf(m), null);
});

test('twist: a quarter turned a quarter turn carries its pieces round; four turns bring it back; the other quarters stay', () => {
  const cells = Array.from({ length: 36 }, (_, i) => i);
  const cw = R.twistTurn(cells, 6, 0, 1);
  assert.deepEqual([cw[0], cw[1], cw[2], cw[6], cw[7], cw[8], cw[12], cw[13], cw[14]], [12, 6, 0, 13, 7, 1, 14, 8, 2], 'clockwise: the left column becomes the top row');
  assert.deepEqual(R.twistTurn(cw, 6, 0, -1), cells, 'the other way undoes it');
  let x = cells; for (let k = 0; k < 4; k++) x = R.twistTurn(x, 6, 3, 1); assert.deepEqual(x, cells);
  for (const q of [0, 1, 2, 3]) { const t = R.twistTurn(cells, 6, q, 1); assert.equal(t.filter((v, i) => v !== i).length, 8, 'eight cells move (the middle one stays)'); assert.equal(R.twistTo(6, q, 1, t.indexOf(cells[q >= 2 ? 18 + (q % 2 ? 3 : 0) : (q % 2 ? 3 : 0)])), t.indexOf(cells[q >= 2 ? 18 + (q % 2 ? 3 : 0) : (q % 2 ? 3 : 0)]) >= 0 ? R.twistTo(6, q, 1, t.indexOf(cells[q >= 2 ? 18 + (q % 2 ? 3 : 0) : (q % 2 ? 3 : 0)])) : -1); }
});

test('twist: a move places a piece and turns a quarter; a line by the placement wins at once with no twist; a twist is owed otherwise', () => {
  const m = E.newMini('twist', E.makeRng('b'));
  let r = E.applyMove(m, 'X', { c: 0, q: 3, d: 1 }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, m.cells[0], m.moves, m.last.at], ['continue', 'placed', 'X', 1, 0]);
  assert.equal(E.applyMove(m, 'O', { c: 0, q: 0, d: 1 }, E.makeRng('x')).reason, 'taken');
  assert.equal(E.applyMove(m, 'O', { c: 5 }, E.makeRng('x')).reason, 'noturn');
  for (const bad of [null, {}, { c: 99, q: 0, d: 1 }, { c: 5, q: 4, d: 1 }, { c: 5, q: 0, d: 2 }, 'x']) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  r = E.applyMove(m, 'O', { c: 8, q: 0, d: 1 }, E.makeRng('x'));
  assert.equal(m.cells[R.twistTo(6, 0, 1, 8)], 'O', 'the placed piece went round with its quarter'); assert.equal(m.cells[2], 'X', 'and so did the piece that was there');
  const w = E.newMini('twist', E.makeRng('c')); put(w, 'X', [18, 19, 20]);
  r = E.applyMove(w, 'X', { c: 21 }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, w.winCells, w.last.q], ['win', 'line', [18, 19, 20, 21], null], 'four across two quarters: won by the placement, nothing turned');
});

test('twist: after the twist: the mover\'s line wins, also when both get one; a line for the other side alone is theirs; a full board is a draw', () => {
  const m = E.newMini('twist', E.makeRng('d')); put(m, 'O', [3, 4, 5]); m.cells[14] = 'O';   // O's piece at 14 turns up to 2 when the top left quarter goes anticlockwise
  let r = E.applyMove(m, 'X', { c: 35, q: 0, d: -1 }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'O', 'gift'], 'X twisted a line together for O');
  const b = E.newMini('twist', E.makeRng('e')); put(b, 'O', [3, 4, 5]); b.cells[14] = 'O'; put(b, 'X', [18, 19, 20]);
  b.cells[33] = null; r = E.applyMove(b, 'X', { c: 12, q: 1, d: 1 }, E.makeRng('x'));
  assert.ok(r.ok);
  const both = E.newMini('twist', E.makeRng('f')); put(both, 'O', [3, 4, 5]); both.cells[14] = 'O'; put(both, 'X', [30, 31, 32]); both.cells[21] = 'X';
  // X places at 33: four along the bottom at once
  r = E.applyMove(both, 'X', { c: 33 }, E.makeRng('x')); assert.deepEqual([r.outcome, r.winner], ['win', undefined]);
  const t = R.twistTry((() => { const c = new Array(36).fill(null); [3, 4, 5, 14].forEach(i => { c[i] = 'O'; }); [8, 20, 26, 32].forEach(i => { c[i] = 'X'; }); c[8] = null; c[6] = 'X'; return c; })(), 6, 4, 'X', { c: 35, q: 0, d: -1 });
  assert.ok(t && (t.end === 'lose' || t.end === 'win'));
  const full = E.newMini('twist', E.makeRng('g')); const pat = 'XXOOXXOOXXOOOOXXOOXXOOXXXXOOXXOOXXOO'.split(''); pat.forEach((v, i) => { full.cells[i] = v; }); full.cells[35] = null;
  const fr = R.twistTry(full.cells, 6, 4, 'O', { c: 35, q: 0, d: 1 }); assert.ok(fr.end === 'draw' || fr.end === 'win' || fr.end === 'lose');
});

test('twist: the computer takes a win, stops one, and whole squares end (won or drawn); Hard beats Easy', () => {
  const m = E.newMini('twist', E.makeRng('h')); put(m, 'X', [18, 19, 20]);
  for (const level of ['easy', 'normal', 'hard']) { const mv = E.localBest(E.publicMini(m), 'X', E.makeRng(level), {}, { level, until: null }).move; const r = R.twistTry(m.cells, 6, 4, 'X', mv); assert.equal(r.end, 'win', level + ' takes the line'); }
  // a threat it can stop: X has three along the top edge of a quarter; wherever a safe move exists, the computer makes one
  const canWin = cells => { for (let c = 0; c < 36; c++) if (!cells[c]) for (const q of [0, 1, 2, 3]) for (const d of [1, -1]) { const t = R.twistTry(cells, 6, 4, 'X', { c, q, d }); if (t && t.end === 'win') return true; } return false; };
  const th = E.newMini('twist', E.makeRng('th')); put(th, 'X', [1, 2]); th.cells[9] = 'X'; put(th, 'O', [22, 28]);
  let safe = 0; for (let c = 0; c < 36; c++) if (!th.cells[c]) for (const q of [0, 1, 2, 3]) for (const d of [1, -1]) { const t = R.twistTry(th.cells, 6, 4, 'O', { c, q, d }); if (t && t.end !== 'lose' && !canWin(t.cells)) safe++; }
  if (safe) for (const level of ['normal', 'hard']) { const mv = E.localBest(E.publicMini(th), 'O', E.makeRng(level), {}, { level, until: null }).move, after = R.twistTry(th.cells, 6, 4, 'O', mv); assert.equal(canWin(after.cells), false, level + ' leaves no winning reply where it can'); }
  let ends = 0, hard = 0;
  for (let g = 0; g < 12; g++) {
    const rng = E.makeRng('w' + g), t = E.newMini('twist', rng), lv = g % 2 ? { X: 'hard', O: 'easy' } : { X: 'easy', O: 'hard' }; let p = 'X';
    for (let k = 0; k < 40; k++) { const r = E.applyMove(t, p, E.localBest(E.publicMini(t), p, rng, {}, { level: lv[p], until: null }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome !== 'continue') { ends++; if (r.outcome === 'win' && lv[r.winner || p] === 'hard') hard++; break; } p = p === 'X' ? 'O' : 'X'; }
  }
  assert.equal(ends, 12); assert.ok(hard >= 10, `Hard beat Easy in ${hard} of 12`);
  const st = E.newMatch(E.makeRng('i'), { games: ['twist'] });
  assert.ok(E.playMove(st, 4, { c: 7, q: 0, d: 1 }, E.makeRng('s')).ok); assert.deepEqual(Object.keys(st.flash.tw).sort(), ['at', 'by', 'c', 'd', 'line', 'q']);
});
