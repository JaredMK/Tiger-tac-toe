'use strict';
// Block Drop (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/blocks/rules.js');
const M = require('../../src/games/blocks/meta.js');

const rows = (...r) => r.reverse().map(s => s.split('').map(ch => (ch === '.' ? 0 : 1)));   // a grid written top row first
const pad = (g, n) => { while (g.length < n) g.push(Array(g[0].length).fill(0)); return g; };
// a square whose next pieces for `p` are the kinds asked for (found by trying seeds)
const withKinds = (p, kinds, tune) => { for (let s = 0; s < 20000; s++) { const m = E.newMini('blocks', E.makeRng('k' + s)); if (kinds.every((k, i) => R.blockKind(m, p, i) === k)) return m; } throw new Error('no such square'); };

test('blocks: Admin only, brain; allowed in Find Match (the server makes the same move); its settings; pieces of its own', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, !!M.realTime], ['admin', 'brain', '1.25.0', false, false]);
  assert.ok(!E.FIND_MATCH_HOLD.includes('blocks'));
  assert.deepEqual(E.tuneFields('blocks').map(f => f.k), ['pieces', 'lines', 'cols', 'rows', 'even', 'junk']);
  const m = E.newMini('blocks', E.makeRng('a')), c = R.blocksCfg(m);
  assert.deepEqual([m.cols, m.rows, c.lines, c.pieces, c.junk, c.even, E.secretOf(m)], [6, 8, 4, 3, false, true, null]);
  assert.deepEqual(R.KINDS.map(k => [k.id, k.rot.length, k.rot[0].length]), [['two', 2, 2], ['three', 2, 3], ['corner', 4, 3], ['square', 1, 4]]);
  const seen = [0, 0, 0, 0]; for (let k = 0; k < 4000; k++) seen[R.blockKind(m, 'X', k)]++;
  seen.forEach((n, i) => assert.ok(Math.abs(n / 4000 - R.KINDS[i].w / 8) < 0.03, `${R.KINDS[i].id} comes up by its weight`));
  assert.notDeepEqual(Array.from({ length: 12 }, (_, k) => R.blockKind(m, 'X', k)), Array.from({ length: 12 }, (_, k) => R.blockKind(m, 'O', k)), 'each player their own run of pieces');
});

test('blocks: a piece falls straight down and rests on what is there; a full row clears; a piece that will not fit fills the board', () => {
  const g = pad(rows('#.....', '##.###'), 8);
  assert.deepEqual(R.blockRest(g, R.blockCells(0, 0), 2), [[2, 0], [3, 1]].map(([x, y]) => [x, y]).slice(0, 0).concat([[2, 1], [3, 1]]), 'a flat two over the gap rests on the block beside it');
  assert.deepEqual(R.blockRest(g, R.blockCells(0, 1), 2), [[2, 0], [2, 1]], 'upright, it drops into the gap');
  assert.equal(R.blockRest(g, R.blockCells(1, 0), 4), null, 'off the side'); assert.equal(R.blockRest(g, R.blockCells(1, 0), -1), null);
  let t = R.blockTry(g, 0, 1, 2);
  assert.deepEqual([t.cleared, t.over, t.grid[0].join(''), t.grid[1].join('')], [[0], false, '101000', '000000'], 'the full row goes and what was over it comes down');
  const tall = pad(rows('#.....', '#.....', '#.....', '#.....', '#.....', '#.....', '#.....'), 8);
  t = R.blockTry(tall, 0, 1, 0); assert.deepEqual([t.over, t.grid.flat().some(v => v)], [true, false], 'over the top: the board is cleared');
  assert.equal(R.blockPlaces(g, 2).length, 4 * 5); assert.equal(R.blockPlaces(g, 3).length, 5);
});

test('blocks: three pieces a turn; rows count; first to 4 with equal turns off; the turn out of time ends where it stands', () => {
  E.setTune('blocks', { even: 'off' });
  try {
    const m = withKinds('X', [1, 1, 3]);                             // three in a line twice, then a square
    let r = E.applyMove(m, 'X', { r: 0, c: 0 }, E.makeRng('x'));
    assert.deepEqual([r.outcome, r.note, r.again, m.run, m.last.at, m.k.X], ['continue', 'place', true, { by: 'X', left: 2 }, [[0, 0], [1, 0], [2, 0]], 1]);
    assert.equal(E.applyMove(m, 'O', 'end', E.makeRng('x')).ok, false);
    r = E.applyMove(m, 'X', { r: 0, c: 3 }, E.makeRng('x'));
    assert.deepEqual([r.note, r.again, m.lines.X, m.last.cleared, m.grid.X.flat().some(v => v), m.last.was[0].join('')], ['line', true, 1, [0], false, '222000']);
    assert.equal(R.timeoutClose(m, 'X'), 'end'); assert.equal(R.timeoutClose(m, 'O'), null);
    r = E.applyMove(m, 'X', 'end', E.makeRng('x')); assert.deepEqual([r.ok, !!r.again, m.run], [true, false, null]);
    for (const bad of [null, {}, { r: 0 }, { r: 5, c: 0 }, { r: 0, c: 9 }, { r: 0, c: 1.5 }, 'x']) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
    m.lines.X = 3; m.grid.X[0] = [1, 1, 1, 1, 0, 0];
    r = E.applyMove(m, 'X', { r: 0, c: 4 }, E.makeRng('x')); assert.deepEqual([r.outcome, r.note, m.lines.X], ['win', 'won', 4]);
    const o = E.newMini('blocks', E.makeRng('o')); o.lines.O = 2; o.grid.O = pad(rows('#.....', '#.....', '#.....', '#.....', '#.....', '#.....', '#.....', '#.....'), 8);
    r = E.applyMove(o, 'O', { r: R.blockKind(o, 'O', 0) === 0 ? 1 : 0, c: 0 }, E.makeRng('x'));
    assert.deepEqual([r.note, !!r.again, o.lines.O, o.last.over, o.grid.O.flat().some(v => v), o.run], ['over', false, 1, true, false, null], 'the board filled: cleared, a row lost, the turn over');
  } finally { E.setTune('blocks', null); }
});

test('blocks: equal turns: the first to move reaching the target is answered: fewer pieces wins, then the cleaner board, then a draw; unanswered, it is theirs', () => {
  const set = (m, p, k, grid0) => { m.lines[p] = 3; m.k[p] = k; m.grid[p][0] = grid0.slice(); };
  const fill = (m, p) => { const kind = R.blockKind(m, p, m.k[p]), w = R.blockWide(R.blockCells(kind, 0)); m.grid[p][0] = Array.from({ length: 6 }, (_, x) => (x < w ? 0 : 1)); if (kind === 3) m.grid[p][1] = [0, 0, 1, 1, 1, 1]; return { r: 0, c: 0 }; };
  const reach = (kx, ko) => { const m = E.newMini('blocks', E.makeRng('e' + kx + ko)); m.turns = { X: 2, O: 2 }; set(m, 'X', kx, [0, 0, 0, 0, 0, 0]); set(m, 'O', ko, [0, 0, 0, 0, 0, 0]); const r = E.applyMove(m, 'X', fill(m, 'X'), E.makeRng('x')); return [m, r]; };
  let [m, r] = reach(7, 6);
  assert.deepEqual([r.outcome, r.note, !!r.again, m.final.by, m.final.k, m.run], ['continue', 'reached', false, 'X', 8, null], 'X has had a turn more: O answers');
  r = E.applyMove(m, 'O', fill(m, 'O'), E.makeRng('x')); assert.deepEqual([r.outcome, r.winner, r.note, m.last.ans.k], ['win', undefined, 'passed', 7], 'O got there in fewer pieces');
  [m, r] = reach(7, 8); r = E.applyMove(m, 'O', fill(m, 'O'), E.makeRng('x')); assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'X', 'held'], 'O needed more pieces');
  [m, r] = reach(7, 7); r = (() => { const mv = fill(m, 'O'); m.grid.O[3] = [0, 0, 0, 0, 0, 1]; return E.applyMove(m, 'O', mv, E.makeRng('x')); })(); assert.deepEqual([r.outcome, r.winner], ['win', 'X'], 'as many pieces: X\'s board is the cleaner');
  [m, r] = reach(7, 7); const left = m.final.left; r = E.applyMove(m, 'O', fill(m, 'O'), E.makeRng('x')); if (m.last.ans.left === left) assert.deepEqual([r.outcome, r.note], ['draw', 'tie']);
  [m, r] = reach(7, 2); for (let k = 0; k < 3; k++) { m.grid.O = m.grid.O.map(() => [0, 0, 0, 0, 0, 0]); m.lines.O = 0; r = E.applyMove(m, 'O', { r: 0, c: 0 }, E.makeRng('x')); }
  assert.deepEqual([r.outcome, r.winner, r.note], ['win', 'X', 'held'], 'the answering turn fell short');
  [m, r] = reach(7, 2); r = E.applyMove(m, 'X', { r: 0, c: 0 }, E.makeRng('x')); assert.deepEqual([r.outcome, r.note], ['win', 'unanswered']);
  [m, r] = reach(7, 2); m.lines.O = 0; E.applyMove(m, 'O', { r: 0, c: 0 }, E.makeRng('x')); r = E.applyMove(m, 'O', 'end', E.makeRng('x')); assert.deepEqual([r.outcome, r.winner], ['win', 'X'], 'the answer ran out of time');
  const t = E.newMini('blocks', E.makeRng('s')); t.turns = { X: 3, O: 2 }; set(t, 'O', 6, [0, 0, 0, 0, 0, 0]); r = E.applyMove(t, 'O', fill(t, 'O'), E.makeRng('x')); assert.deepEqual([r.outcome, r.note], ['win', 'won'], 'the second to move, level on turns: theirs at once');
});

test('blocks: junk rows; the computer by level; the flash; whole squares end', () => {
  E.setTune('blocks', { junk: 'on' });
  try {
    const m = withKinds('X', [3]); m.grid.X[0] = [0, 0, 1, 1, 1, 1]; m.grid.X[1] = [0, 0, 1, 1, 1, 1]; m.grid.O[0] = [1, 0, 0, 0, 0, 0];
    const r = E.applyMove(m, 'X', { r: 0, c: 0 }, E.makeRng('j'));
    assert.deepEqual([m.lines.X, m.last.junk, m.grid.O[0].filter(v => v === 9).length, m.grid.O[1].join(''), r.note], [2, 1, 5, '100000', 'line'], 'two rows with one piece: a junk row in under the other stack, one gap in it');
  } finally { E.setTune('blocks', null); }
  const rowsOf = level => { let s = 0; for (let g = 0; g < 60; g++) { const m = E.newMini('blocks', E.makeRng('q' + g)), rng = E.makeRng(level + g); for (let k = 0; k < 12; k++) { m.final = null; m.lines.X = Math.min(m.lines.X, 3); const before = m.lines.X; E.applyMove(m, 'X', E.localBest(E.publicMini(m), 'X', rng, {}, { level }).move, rng); s += Math.max(0, m.lines.X - before); } } return s / 60; };
  const e = rowsOf('easy'), n = rowsOf('normal'), h = rowsOf('hard');
  assert.ok(e < n && n <= h + 0.3, `rows in 12 pieces: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} <= hard ${h.toFixed(2)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['blocks'] });
  assert.ok(E.playMove(st, 4, { r: 0, c: 0 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.bd).sort(), ['at', 'by', 'c', 'cleared', 'from', 'hit', 'junk', 'kind', 'left', 'over', 'r', 'to', 'was']);
  assert.ok(E.playMs(st.flash) >= R.BLOCKS.fall);
  let ends = 0;
  for (let g = 0; g < 90; g++) { const rng = E.makeRng('w' + g), t = E.newMini('blocks', rng); let q = 'X'; for (let k = 0; k < 3000; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome !== 'continue') { ends++; break; } if (!r.again) q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(ends, 90);
});
