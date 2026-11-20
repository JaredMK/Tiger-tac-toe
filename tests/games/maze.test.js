'use strict';
// Maze Runner (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/maze/rules.js');
const M = require('../../src/games/maze/meta.js');

const bits = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
function tree(open, w) {                                          // every cell reached from the start, by n - 1 passages, each open from both sides
  const n = w * w; let edges = 0; const seen = new Set([0]), stack = [0];
  for (let c = 0; c < n; c++) for (const d of R.DIRS) if (open[c] & R.BIT[d]) { const t = R.mazeStep(w, c, d); assert.ok(t >= 0 && t < n && (open[t] & R.BIT[R.BACK[d]]), 'a passage is open from both sides'); if (d === 'e') assert.ok(c % w < w - 1); if (d === 'w') assert.ok(c % w > 0); edges++; }
  while (stack.length) { const c = stack.pop(); for (const d of R.DIRS) if (open[c] & R.BIT[d]) { const t = R.mazeStep(w, c, d); if (!seen.has(t)) { seen.add(t); stack.push(t); } } }
  return seen.size === n && edges / 2 === n - 1;
}

test('maze: Admin only, luck; a maze is a tree over the whole grid (one path between any two cells), its walls hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'luck', '1.24.0']);
  assert.deepEqual(E.tuneFields('maze').map(f => f.k), ['size', 'turns', 'boards']);
  for (let g = 0; g < 25; g++) {
    const m = E.newMini('maze', E.makeRng('t' + g));
    assert.deepEqual([m.w, m.sep, m.at.X, m.at.O], [6, true, R.mazeStart(6), R.mazeStart(6)]);
    for (const p of ['X', 'O']) { assert.ok(tree(m.open[p], m.w)); assert.equal(m.seen[p].filter(v => v >= 0).length, 1, 'only the start is seen'); }
    assert.notDeepEqual(m.open.X, m.open.O, 'never the same maze: the second runner would read the first one\'s map');
    assert.ok(!('open' in E.publicMini(m))); const c = JSON.parse(JSON.stringify(m)); R.hide(c); assert.ok(!('open' in c)); assert.deepEqual(R.secret(m), { open: m.open });
  }
});

test('maze: the deal makes each maze the wanted length for a runner alone, so a maze each is as long as the other', () => {
  const rng = E.makeRng('len'); let off = 0;
  for (let g = 0; g < 30; g++) { const open = R.mazeDeal(6, 6, rng), t = R.mazeTurns(open, 6, E.makeRng('m' + g)); if (Math.abs(t - 6) > 1.6) off++; }
  assert.ok(off <= 3, `mazes far from 6 turns: ${off} of 30`);
  for (let g = 0; g < 60; g++) { const r = E.makeRng('solo' + g), open = R.mazeMake(5, r); assert.ok(R.mazeSolo(open, 5, r, g % 2 ? 'normal' : 'easy') < 60, 'a runner alone always gets out'); }
});

test('maze: a dash runs the corridor round its bends to a fork (pick again), a dead end (the turn ends there) or the flag (the square)', () => {
  const m = E.newMini('maze', E.makeRng('a')), w = m.w, open = m.open.X;
  const d0 = R.mazeWays(m, 'X')[0], run = R.mazeRun(open, w, m.at.X, d0);
  const r = E.applyMove(m, 'X', d0, E.makeRng('x'));
  assert.equal(m.at.X, run.path[run.path.length - 1]);
  assert.deepEqual([r.outcome, !!r.again, r.note], run.end === 'flag' ? ['win', false, 'flag'] : run.end === 'dead' ? ['continue', false, 'dead'] : ['continue', true, 'fork']);
  for (const c of run.path) assert.equal(m.seen.X[c], open[c], 'every cell passed is seen');
  run.path.slice(0, -1).forEach(c => assert.equal(bits(open[c]), 2, 'a corridor until the last cell'));
  assert.ok(m.seen.O.filter(v => v >= 0).length === 1, 'the other maze is untouched');
  const wall = R.DIRS.find(d => !(open[m.at.X] & R.BIT[d]));
  if (wall) assert.equal(E.applyMove(m, 'X', wall, E.makeRng('x')).reason, 'wall');
  assert.equal(E.applyMove(m, 'X', 'up', E.makeRng('x')).ok, false);
  const hidden = JSON.parse(JSON.stringify(m)); R.hide(hidden);
  assert.equal(E.applyMove(hidden, 'X', R.mazeWays(hidden, 'X')[0], E.makeRng('x')).reason, 'secret');
  // a whole run of one side alone: turns counted per dead end, the flag reached
  const t = E.newMini('maze', E.makeRng('b')), rng = E.makeRng('run'); let won = false, dead = 0;
  for (let k = 0; k < 300 && !won; k++) { const q = E.applyMove(t, 'O', E.randomLegalMove(t, 'O', rng), rng); if (q.note === 'dead') dead++; won = q.outcome === 'win'; }
  assert.ok(won); assert.equal(t.at.O, R.mazeFlag(t.w)); assert.equal(t.turns.O, dead + 1);
});

test('maze: shared: one maze, both runners in it, what one has seen the other sees', () => {
  E.setTune('maze', { boards: 'shared' });
  try {
    const m = E.newMini('maze', E.makeRng('s'));
    assert.ok(Array.isArray(m.open) && Array.isArray(m.seen) && !m.sep);
    E.applyMove(m, 'X', R.mazeWays(m, 'X')[0], E.makeRng('x'));
    assert.ok(m.seen.filter(v => v >= 0).length > 1); assert.equal(R.mazeSeen(m, 'O'), R.mazeSeen(m, 'X'));
  } finally { E.setTune('maze', null); }
});

test('maze: the computer never re-enters a branch it has finished, and takes the flag\'s way once it is seen; a timeout mid-turn plays nothing', () => {
  for (let g = 0; g < 20; g++) {
    const rng = E.makeRng('c' + g), m = E.newMini('maze', rng); let deadEnds = new Set(), won = false;
    for (let k = 0; k < 200 && !won; k++) {
      const mv = E.localBest(E.publicMini(m), 'X', rng, {}, { level: g % 2 ? 'hard' : 'normal' }).move, r = E.applyMove(m, 'X', mv, rng);
      assert.ok(r.ok);
      if (r.note === 'dead') { assert.ok(!deadEnds.has(m.at.X), 'never the same dead end twice'); deadEnds.add(m.at.X); }
      won = r.outcome === 'win';
    }
    assert.ok(won);
  }
  const st = E.newMatch(E.makeRng('i'), { games: ['maze'] }), p = st.turn, q = st.squares[4].mini;
  const fork = R.DIRS.find(d => { const r = R.mazeRun(q.open[p], q.w, q.at[p], d); return r && r.end === 'fork'; });
  if (fork) {
    assert.ok(E.playMove(st, 4, fork, E.makeRng('e')).ok); assert.deepEqual(Object.keys(st.flash.mz).sort(), ['end', 'fresh', 'from', 'path']); E.endFlash(st);
    assert.equal(st.lock, 4); const at = q.at[p];
    st.timer.deadline = 1; assert.ok(E.timeoutMove(st, E.makeRng('t')).ok); assert.notEqual(st.turn, p); assert.equal(q.at[p], at);
  }
  assert.equal(R.timeoutClose(q, p), null);
});
