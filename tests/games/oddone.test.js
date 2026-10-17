'use strict';
// Odd One Out: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const only = t => Object.fromEntries(E.TYPES.map(g => [g, g === t]));
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

test('odd one out: online, the odd tile\'s place stays on the server until the tap', () => {
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: only('oddone'), timer: 60 }, lcg(81), 'od1');
  const pub = rec.state.squares[0].mini;
  assert.equal(pub.pos, undefined);
  assert.ok(pub.grid.X.tiles.length === 9, 'the tiles to draw are public');
  assert.ok(Number.isInteger(rec.secrets[0].pos.X));
  assert.equal(E.applyMove(JSON.parse(JSON.stringify(pub)), 'X', 0).reason, 'secret');
  const r = E.applyOnlineMove(rec, 'X', 0, rec.secrets[0].pos.X, lcg(82));
  assert.equal(r.ok, true); assert.equal(r.entries[0].odd.correct, true);
  assert.equal(r.rec.state.squares[0].mini.pos, undefined); assert.ok(Number.isInteger(r.rec.secrets[0].pos.X));
});

test('oddone: the odd tile is equally likely in every cell (1,000 grids a level, each from its own seed as the server deals them; no column or row favoured)', () => {
  const crit = { 8: 26.1, 15: 37.7, 24: 51.2 };                            // chi-squared at p = 0.001, by degrees of freedom (3x3, 4x4, 5x5)
  for (let level = 0; level < 3; level++) {
    const n = E.ODD.sizes[level], cnt = new Array(n * n).fill(0), N = 1000;
    for (let i = 0; i < N; i++) cnt[E.oddGrid(level, E.makeRng('oddpos:' + level + ':' + i)).pos]++;
    const exp = N / (n * n), chi = cnt.reduce((s, x) => s + (x - exp) ** 2 / exp, 0);
    assert.ok(chi < crit[n * n - 1], `level ${level + 1}: chi-squared ${chi.toFixed(1)} over ${n * n} cells`);
    for (let c = 0; c < n; c++) {
      const col = cnt.filter((_, k) => k % n === c).reduce((a, b) => a + b, 0) / N, row = cnt.filter((_, k) => Math.floor(k / n) === c).reduce((a, b) => a + b, 0) / N;
      assert.ok(Math.abs(col - 1 / n) < 0.05 && Math.abs(row - 1 / n) < 0.05, `level ${level + 1}: column ${c + 1} ${col.toFixed(3)}, row ${c + 1} ${row.toFixed(3)} (each about ${(1 / n).toFixed(3)})`);
    }
  }
});
