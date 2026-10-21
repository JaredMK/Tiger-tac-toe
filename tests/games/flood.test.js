'use strict';
// Flood: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
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
test('flood: the admin\'s settings: three colours, 12 to win and mistakes deal a square that plays by them', () => {
  E.setTune('flood', { colors: 3, goal: 12, miss: 20 });
  try {
    const m = E.newMini('flood', lcg(1));
    assert.ok(m.colors.every(c => c < 3)); assert.equal(E.applyMove(m, 'X', 3).ok, false, 'a fourth colour is no move');
    const st = tunedPlay('flood', 5), sq = st.squares[4].mini;
    assert.ok(Math.max(sq.score.X, sq.score.O) >= 12 && Math.min(sq.score.X, sq.score.O) < 12, `won at 12 (${sq.score.X} to ${sq.score.O})`);
  } finally { E.setTune('flood', null); }
  assert.equal(E.newMini('flood', lcg(1)).tune, undefined);
});

test('flood: the Hard computer searches deeper (a forced win Normal misses), legal moves, within its time', () => {
  const hard = { level: 'hard', until: null }, normal = { level: 'normal', until: null };
  const R = require('../../src/games/flood/rules.js');                 // (the search itself)
  const pm = { type: 'flood', colors: [1, 4, 4, 4, 1, 3, 1, 1, 2, 1, 1, 4, 1, 4, 1, 4, 1, 1, 1, 2, 0, 4, 3, 3, 2, 0, 3, 4, 2, 0, 1, 3, 0, 2, 0, 3], owner: ['-', null, null, null, null, null, 'X', 'X', null, null, null, null, 'O', null, null, null, null, null, 'O', null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null], score: { X: 2, O: 2 } };   // O to move: colour 2 wins by force; Normal (two moves deep) plays 4 and X wins by force
  const h = R.floodHard(pm, 'O');
  assert.ok(h.c === 2 && h.v >= R.FLOOD_HARD.win - 36, `a forced win seen (${h.c}: ${h.v} at depth ${h.depth})`);
  const w = E.localBest(pm, 'O', lcg(1), {}, hard);
  assert.equal(w.move, 2); assert.equal(w.win, false); assert.equal(w.after.type, 'flood'); assert.equal(w.after.score.O, pm.score.O + E.floodGain(pm, 2));
  assert.equal(E.localBest(pm, 'O', lcg(1), {}, normal).move, 4, 'Normal as before');
  const a = E.floodApply(pm, 4, 'O');
  assert.ok(R.floodHard({ type: 'flood', colors: a.colors, owner: a.owner, score: a.score }, 'X').v >= R.FLOOD_HARD.win - 36, 'after Normal\'s move X wins by force');
  // the goal reached is a win now; legal moves everywhere (the admin's colours and goal too), the mistake rate still applied, quickly
  const near = E.newMini('flood', lcg(2)); near.score = { X: 17, O: 10 };
  const nw = E.localBest(E.publicMini(near), 'X', lcg(1), {}, hard);
  assert.ok(nw.win && nw.move !== near.colors[0] && E.floodGain(E.publicMini(near), nw.move) > 0);
  const r = lcg(5);
  E.localBest(E.publicMini(E.newMini('flood', lcg(1))), 'X', lcg(1), {}, hard);                   // (warm)
  for (let k = 0; k < 8; k++) {
    E.setTune('flood', k >= 6 ? { colors: 3, goal: 12 } : null);
    const b = E.newMini('flood', lcg(k + 10));
    E.setTune('flood', null);
    let p = 'X';
    for (let i = 0; i < k; i++) { const mv = E.randomLegalMove(b, p, r); if (E.applyMove(b, p, mv, r).outcome !== 'continue') break; p = E.other(p); }
    if (b.score.X >= R.floodCfg(b).goal || b.score.O >= R.floodCfg(b).goal) continue;
    const t0 = performance.now(); const mv = E.localBest(E.publicMini(b), p, lcg(k), {}, hard).move; const ms = performance.now() - t0;
    assert.ok(Number.isInteger(mv) && mv >= 0 && mv < R.floodCfg(b).colors && mv !== b.colors[0], `a legal colour (${mv})`);
    assert.ok(ms < 60, `a Hard move in ${ms.toFixed(1)} ms`);
  }
  const sq = E.newMini('flood', lcg(2)); sq.tune = { miss: 50 };
  const slips = new Set();
  for (let i = 0; i < 20; i++) slips.add(E.localBest(E.publicMini(sq), 'X', E.makeRng('flood-hard-miss' + i), {}, hard).move);
  assert.ok(slips.size > 1, 'the mistake rate still applies');
  const t1 = performance.now(), until = () => Math.max(0, t1 + 12 - performance.now());
  const timed = E.localBest(E.publicMini(E.newMini('flood', lcg(3))), 'X', lcg(1), {}, { level: 'hard', until });
  assert.ok(performance.now() - t1 < 40 && Number.isInteger(timed.move) && timed.move !== E.newMini('flood', lcg(3)).colors[0], 'stops at its budget with a legal move');
});
