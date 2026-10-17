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
