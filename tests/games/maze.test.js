'use strict';
// Maze Runner (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/maze/rules.js');
const M = require('../../src/games/maze/meta.js');

const bits = m => (m & 1) + ((m >> 1) & 1) + ((m >> 2) & 1) + ((m >> 3) & 1);
function tree(open, w, h = w) {                                   // every cell reached from the start, by n - 1 passages, each open from both sides
  const n = w * h; let edges = 0; const seen = new Set([0]), stack = [0];
  for (let c = 0; c < n; c++) for (const d of R.DIRS) if (open[c] & R.BIT[d]) { const t = R.mazeStep(w, c, d); assert.ok(t >= 0 && t < n && (open[t] & R.BIT[R.BACK[d]]), 'a passage is open from both sides'); if (d === 'e') assert.ok(c % w < w - 1); if (d === 'w') assert.ok(c % w > 0); edges++; }
  while (stack.length) { const c = stack.pop(); for (const d of R.DIRS) if (open[c] & R.BIT[d]) { const t = R.mazeStep(w, c, d); if (!seen.has(t)) { seen.add(t); stack.push(t); } } }
  return seen.size === n && edges / 2 === n - 1;
}

test('maze: Admin only, luck; a maze is a tree over the whole grid (one path between any two cells), its walls hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion], ['admin', 'luck', '1.32.0']);
  assert.deepEqual(E.tuneFields('maze').map(f => f.k), ['cols', 'rows', 'branch', 'minPath', 'turns', 'boards']);
  for (let g = 0; g < 25; g++) {
    const m = E.newMini('maze', E.makeRng('t' + g));
    assert.deepEqual([m.v, m.w, m.h, m.sep, m.one, m.start, m.flag, m.at.X, m.at.O], [2, 8, 10, true, false, 72, 7, 72, 72], 'a maze 8 wide and 10 tall, the door bottom left, the flag top right');
    for (const p of ['X', 'O']) { assert.ok(tree(m.open[p], m.w, m.h)); assert.ok(R.mazePathLen(m.open[p], R.mazeGeo(m)) >= 22, 'no path to the flag shorter than the minimum'); assert.equal(m.seen[p].filter(v => v >= 0).length, 1, 'only the start is seen'); }
    assert.notDeepEqual(m.open.X, m.open.O, 'never the same maze: the second runner would read the first one\'s map');
    assert.ok(!('open' in E.publicMini(m))); const c = JSON.parse(JSON.stringify(m)); R.hide(c); assert.ok(!('open' in c)); assert.deepEqual(R.secret(m), { open: m.open });
  }
});

test('maze: the deal makes each maze the wanted length for a runner alone, so a maze each is as long as the other', () => {
  const rng = E.makeRng('len'), G = R.mazeGeoOf(8, 10); let off = 0;
  for (let g = 0; g < 20; g++) { const open = R.mazeDeal(G, { branch: 60, minPath: 22, turns: 8 }, rng), t = R.mazeTurns(open, G, E.makeRng('m' + g)); if (Math.abs(t - 8) > 2) off++; }
  assert.ok(off <= 3, `mazes far from 8 turns: ${off} of 20`);
  for (let g = 0; g < 60; g++) { const r = E.makeRng('solo' + g), G2 = R.mazeGeoOf(5 + (g % 4), 6 + (g % 5)), open = R.mazeMake(G2, r, g % 3 * 50); assert.ok(tree(open, G2.w, G2.h)); assert.ok(R.mazeSolo(open, G2, r, g % 2 ? 'normal' : 'easy') < 80, 'a runner alone always gets out'); }
});

test('maze: a dash runs the corridor round its bends to a fork (pick again), a dead end (the turn ends there) or the flag (the square)', () => {
  const m = E.newMini('maze', E.makeRng('a')), G = R.mazeGeo(m), open = m.open.X;
  const d0 = R.mazeWays(m, 'X')[0], run = R.mazeRun(open, G, m.at.X, d0);
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
  assert.ok(won); assert.equal(t.at.O, R.mazeFlag(t)); assert.equal(t.turns.O, dead + 1);
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
  const fork = R.DIRS.find(d => { const r = R.mazeRun(q.open[p], R.mazeGeo(q), q.at[p], d); return r && r.end === 'fork'; });
  if (fork) {
    assert.ok(E.playMove(st, 4, fork, E.makeRng('e')).ok); assert.deepEqual(Object.keys(st.flash.mz).sort(), ['end', 'fresh', 'from', 'path']); E.endFlash(st);
    assert.equal(st.lock, 4); const at = q.at[p];
    st.timer.deadline = 1; assert.ok(E.timeoutMove(st, E.makeRng('t')).ok); assert.notEqual(st.turn, p); assert.equal(q.at[p], at);
  }
  assert.equal(R.timeoutClose(q, p), null);
});

test('maze: harder generation: branching makes more dead ends; the shortest path to the flag is held to its minimum', () => {
  const G = R.mazeGeoOf(8, 10), rng = E.makeRng('gen'), dead = b => { let s = 0; for (let k = 0; k < 40; k++) s += R.mazeDeadEnds(R.mazeMake(G, rng, b)); return s / 40; };
  const lo = dead(0), hi = dead(100); assert.ok(hi > lo + 0.12, `dead ends: branching 0 ${lo.toFixed(2)}, 100 ${hi.toFixed(2)}`);
  for (let k = 0; k < 30; k++) { const open = R.mazeLong(G, rng, 60, 24); assert.ok(R.mazePathLen(open, G) >= 24); }
  assert.equal(R.mazePathLen(R.mazeLong(R.mazeGeoOf(4, 4), rng, 60, 200), R.mazeGeoOf(4, 4)) > 0, true, 'an impossible minimum still deals a maze: the longest drawn');
  E.setTune('maze', { cols: 6, rows: 12, minPath: 20, turns: 6 }); try { const m = E.newMini('maze', E.makeRng('tall')); assert.deepEqual([m.w, m.h, m.start, m.flag], [6, 12, 66, 5]); assert.ok(R.mazePathLen(m.open.X, R.mazeGeo(m)) >= 20); } finally { E.setTune('maze', null); }
});

test('maze: one runner: one maze and one runner both players move; whoever\'s dash reaches the flag takes the square', () => {
  E.setTune('maze', { boards: 'one' });
  try {
    const m = E.newMini('maze', E.makeRng('one'));
    assert.ok(m.one && !m.sep && Array.isArray(m.open)); assert.equal(R.mazeSeen(m, 'X'), R.mazeSeen(m, 'O'));
    const rng = E.makeRng('play'); let p = 'X', won = null;
    for (let k = 0; k < 600 && !won; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok, r.reason); assert.equal(m.at.X, m.at.O, 'the one runner: both players\' places the same');
      if (r.outcome === 'win') won = p; else if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(won); assert.equal(m.at[won], m.flag);
    assert.match(M.explainVars({ boards: 'one' }).boardText, /One runner for both/);
  } finally { E.setTune('maze', null); }
});

test('maze: a square dealt before the rework (no h: a square maze, the door and flag in the middle) plays on as it was', () => {
  const w = 6, rng = E.makeRng('old'), open = R.mazeMake(R.mazeGeoOf(w, w), rng, 100), start = w * (w - 1) + (w >> 1), seen = new Array(36).fill(-1); seen[start] = open[start];
  const m = { type: 'maze', v: 1, sep: false, w, open, seen, at: { X: start, O: start }, turns: { X: 0, O: 0 }, last: null };
  assert.deepEqual(R.mazeGeo(m), { w: 6, h: 6, n: 36, start: 33, flag: 3 });
  let won = false; for (let k = 0; k < 300 && !won; k++) won = E.applyMove(m, 'X', R.randomMove(m, 'X', rng), rng).outcome === 'win';
  assert.ok(won); assert.equal(m.at.X, 3);
  assert.ok(!('h' in R.publicView(m)), 'its record keeps its old shape');
});

test('maze: the win reveals the winner\'s whole maze (the cells still in fog listed for the ripple), and the flash covers the reveal and the dance', () => {
  for (const boards of ['separate', 'shared', 'one']) {
    E.setTune('maze', { boards });
    try {
      const m = E.newMini('maze', E.makeRng('w' + boards)), rng = E.makeRng('wr' + boards); let won = null, p = 'X', before = null;
      for (let k = 0; k < 600 && !won; k++) {
        const s = R.mazeSeen(m, p); before = s.slice();
        const r = E.applyMove(m, p, R.randomMove(m, p, rng), rng);
        if (r.outcome === 'win') won = p; else if (!r.again) p = p === 'X' ? 'O' : 'X';
      }
      assert.ok(won, boards);
      const seen = R.mazeSeen(m, won), open = m.sep ? m.open[won] : m.open, G = R.mazeGeo(m);
      assert.deepEqual(seen, open, 'every cell of the winner\'s maze is seen');
      const rev = before.map((v, c) => (v < 0 && !m.last.path.includes(c) ? c : -1)).filter(c => c >= 0);
      assert.deepEqual(m.last.rev, rev, 'rev: the cells the reveal lifts the fog off');
      if (m.sep) { const other = won === 'X' ? 'O' : 'X'; assert.ok(m.seen[other].some(v => v < 0), 'the other maze is left as it was'); }
      const f = { type: 'maze', by: won }; R.moveFlash(null, won, null, null, m, f);
      assert.deepEqual(f.mz.rev, rev);
      assert.equal(R.flashMs(f), m.last.path.length * R.MAZE.step + R.mazeWinMs(), 'the flash covers the reveal and the dance');
      assert.ok(R.mazeWinMs() >= R.mazeDanceAt() + R.MAZE.dance && R.mazeDanceAt() > R.mazeRevealAt() + R.MAZE.reveal);
      const v = R.publicView(m); assert.ok(!('open' in v)); assert.deepEqual(v.last.rev, rev); assert.deepEqual(JSON.parse(JSON.stringify(v)), v);
      assert.equal(G.n, seen.length);
    } finally { E.setTune('maze', null); }
  }
});
