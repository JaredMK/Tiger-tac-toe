'use strict';
// Simulations: Odd One Out. Slow, so never part of npm test:
// npm run sim -- oddone
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling are dealt only with their physics

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: i % 2 ? 'Science' : 'History', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
test.before(() => E.setTriviaBank(bank(40)));

/* ===================================== Odd One Out ===================================== */
test('odd one out: exactly one tile differs, in lightness (and a touch in hue), by the admin\'s difference for its level (ΔE 2000, the same on every colour); 3x3, then 4x4, then 5x5, smaller each time; a wrong tap shows the odd one; three finds win', () => {
  const m = E.newMini('oddone', lcg(61));
  for (const p of ['X', 'O']) {
    const g = m.grid[p];
    assert.equal(g.n, 3); assert.equal(g.tiles.length, 9);
    assert.equal(g.tiles.filter(c => c === g.odd).length, 1, 'exactly one odd tile');
    assert.equal(g.tiles[m.pos[p]], g.odd, 'at pos');
    assert.notEqual(g.base, g.odd);
  }
  const hsl = c => c.match(/hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)/).slice(1).map(Number), L = c => hsl(c)[2], H = c => hsl(c)[0];
  assert.deepEqual(E.ODD_DEFAULTS, { d1: 4, d2: 2.8, d3: 2 });
  assert.ok(Math.abs(E.deltaE00([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 1e-3, 'CIEDE2000 as published (Sharma, Wu and Dalal, pair 1)');
  const lv = (level) => { const gs = []; for (let k = 0; k < 300; k++) gs.push(E.oddGrid(level, lcg(k * 3 + level))); return gs; };
  for (const [level, n, want] of [[0, 3, 4], [1, 4, 2.8], [2, 5, 2], [5, 5, 2]]) {
    const ds = [];
    for (const g of lv(level)) {
      assert.equal(g.grid.n, n);
      const d = E.oddDelta(hsl(g.grid.base), hsl(g.grid.odd)); ds.push(d);
      assert.ok(Math.abs(d - want) < 0.25, `level ${level}: the difference ${d.toFixed(2)}, wanted ${want}`);
      { const dh = Math.abs(H(g.grid.odd) - H(g.grid.base)) % 360; assert.ok(Math.min(dh, 360 - dh) <= 6, `hue a touch off (${dh})`); }
      assert.ok(L(g.grid.odd) >= 30 && L(g.grid.odd) <= 80 && L(g.grid.base) >= 42 && L(g.grid.base) <= 62, 'never near black or white');
      assert.equal(g.grid.tiles.filter(c => c === g.grid.odd).length, 1);
    }
  }
  // the admin's values: a new grid by them; off their range, the default
  E.setOddConfig({ d1: 9, d2: 'x', d3: 99 });
  assert.deepEqual(E.oddConfig(), { d1: 9, d2: 2.8, d3: 2 });
  { const g = E.oddGrid(0, lcg(7)).grid; assert.ok(Math.abs(E.oddDelta(hsl(g.base), hsl(g.odd)) - 9) < 0.25, 'level 1 at the admin\'s 9'); }
  E.setOddConfig(null);
  const pos = m.pos.X, wrong = (pos + 1) % 9;
  let r = E.applyMove(m, 'X', wrong, lcg(1));
  assert.deepEqual([r.note, m.last.correct, m.last.pos, m.finds.X], ['wrong', false, pos, 0], 'a wrong tap: no progress, the odd tile told');
  assert.equal(m.grid.X.n, 3, 'still 3x3');
  assert.notEqual(m.pos.X, undefined);
  r = E.applyMove(m, 'X', m.pos.X, lcg(2));
  assert.deepEqual([r.note, m.finds.X, m.grid.X.n], ['found', 1, 4], 'a find: a 4x4 next');
  assert.equal(E.applyMove(m, 'X', m.pos.X, lcg(3)).note, 'found'); assert.equal(m.grid.X.n, 5);
  assert.equal(E.applyMove(m, 'X', 'auto', lcg(4)).note, 'wrong', 'a timeout counts as wrong');
  assert.deepEqual(E.applyMove(m, 'X', m.pos.X, lcg(5)), { ok: true, outcome: 'win', note: 'found' });
  assert.equal(m.grid.O.n, 3, 'O still at the start');
  for (const bad of [25, -1, 'x']) assert.equal(E.applyMove(m, 'O', bad).ok, false);
  // the computer: a find 75%, 60%, then 45% of the time (a typical player is meant to miss about 25%, 40%, 55%)
  const rng = lcg(71);
  for (const [finds, want] of [[0, 0.75], [1, 0.6], [2, 0.45]]) {
    let ok = 0;
    for (let k = 0; k < 1500; k++) { const g = E.newMini('oddone', lcg(k)); g.finds.X = finds; const n = E.oddGrid(finds, lcg(k + 9)); g.grid.X = n.grid; g.pos.X = n.pos; if (E.localBest(E.publicMini(g), 'X', rng).move === n.pos) ok++; }
    assert.ok(Math.abs(ok / 1500 - want) < 0.04, `${finds} finds: ${ok / 1500} (wanted ~${want})`);
  }
});
