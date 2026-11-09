// Dominoes: the line's layout on the table (view.js domLayout) is physically right, as real players lay it: every tile
// touches the one before at exactly one shared edge midpoint, with the matching pips meeting; no two tiles overlap;
// doubles lie crosswise to the line; the line snakes at the run's edge, the turn taken by the tile that would cross it;
// every tile lies on the felt, which keeps its shape and grows only when a line reaches past it; and a draw's tiles come
// one by one (domDrawTimes), the flash holding until the last has landed. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/dominoes/rules.js');
const V = await import('../../src/games/dominoes/view.js');

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const same = (p, q) => near(p[0], q[0]) && near(p[1], q[1]);
// A tile's rectangle: horizontal (rot 0 or 180) 2 x 1, vertical 1 x 2, about its centre.
const rect = p => { const v = p.rot % 180 !== 0; return { x0: p.x - (v ? 0.5 : 1), x1: p.x + (v ? 0.5 : 1), y0: p.y - (v ? 1 : 0.5), y1: p.y + (v ? 1 : 0.5) }; };
const overlap = (a, b) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 1e-6 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 1e-6;
const onEdge = (r, p) => (near(p[0], r.x0) || near(p[0], r.x1)) && p[1] >= r.y0 - 1e-6 && p[1] <= r.y1 + 1e-6 || (near(p[1], r.y0) || near(p[1], r.y1)) && p[0] >= r.x0 - 1e-6 && p[0] <= r.x1 + 1e-6;
const inside = (r, p) => p[0] > r.x0 - 1e-6 && p[0] < r.x1 + 1e-6 && p[1] > r.y0 - 1e-6 && p[1] < r.y1 + 1e-6;
const within = (r, box) => r.x0 >= box.x - 1e-6 && r.x1 <= box.x + box.w + 1e-6 && r.y0 >= box.y - 1e-6 && r.y1 <= box.y + box.h + 1e-6;
// The value of the half of tile p nearest the point q.
const valueAt = (p, q) => { const da = Math.hypot(p.ha[0] - q[0], p.ha[1] - q[1]), db = Math.hypot(p.hb[0] - q[0], p.hb[1] - q[1]); return da < db - 1e-9 ? p.a : db < da - 1e-9 ? p.b : (p.a === p.b ? p.a : null); };

// Every invariant on one line's layout.
function check(line, left, label) {
  const L = V.domLayout(line, left), T = L.tiles, n = line.length;
  assert.equal(T.length, n, label);
  for (let k = 0; k < n; k++) {
    const p = T[k], r = rect(p);
    assert.ok(p && Number.isFinite(p.x) && Number.isFinite(p.y), `${label}: tile ${k} placed`);
    assert.ok([0, 90, 180, 270].includes(p.rot), `${label}: tile ${k} square to the table (${p.rot})`);
    assert.equal(p.dbl, line[k][0] === line[k][1]);
    assert.ok(within(r, L.box), `${label}: tile ${k} on the felt (${JSON.stringify(r)} in ${JSON.stringify(L.box)})`);
    // its halves: each a unit square inside the tile, one unit apart, carrying the tile's values
    assert.ok(inside(r, p.ha) && inside(r, p.hb), `${label}: tile ${k}'s halves inside it`);
    assert.ok(near(Math.hypot(p.ha[0] - p.hb[0], p.ha[1] - p.hb[1]), 1), `${label}: tile ${k}'s halves a unit apart`);
    assert.equal(p.a, line[k][0]); assert.equal(p.b, line[k][1]);
    assert.ok(onEdge(r, p.l) && onEdge(r, p.r), `${label}: tile ${k}'s contacts on its edges`);
    for (let j = 0; j < k; j++) assert.ok(!overlap(r, rect(T[j])), `${label}: tiles ${j} and ${k} overlap (${JSON.stringify(rect(T[j]))} / ${JSON.stringify(r)})`);
    if (k) {
      const q = T[k - 1];
      assert.ok(same(q.r, p.l), `${label}: tiles ${k - 1} and ${k} touch at one shared point (${q.r} vs ${p.l})`);
      // the matching pips meet: the half of each nearest the shared point carries the same value (a double's either)
      const va = valueAt(q, q.r), vb = valueAt(p, p.l);
      assert.equal(va, line[k - 1][1], `${label}: tile ${k - 1}'s right value at the contact`); assert.equal(vb, line[k][0], `${label}: tile ${k}'s left value at the contact`);
      assert.equal(va, vb, `${label}: the pips that meet are equal between ${k - 1} and ${k}`);
      // the shared point is the midpoint of an edge of each tile (a half's edge: half a unit from the contact half's centre)
      const hq = valueAt(q, q.r) === q.a && q.a !== q.b ? q.ha : q.hb, hp = valueAt(p, p.l) === p.a && p.a !== p.b ? p.ha : p.hb;
      assert.ok(q.dbl || near(Math.hypot(hq[0] - q.r[0], hq[1] - q.r[1]), 0.5), `${label}: the contact half a unit from tile ${k - 1}'s contact`);
      assert.ok(p.dbl || near(Math.hypot(hp[0] - p.l[0], hp[1] - p.l[1]), 0.5), `${label}: the contact half a unit from tile ${k}'s contact`);
    }
    // a double lies crosswise to the line it joins: perpendicular to the line's direction through the tile laid before it
    // (the one nearer the first tile; a tile that turned a corner has no one direction and is skipped)
    if (p.dbl && k !== left) {
      const q = k < left ? T[k + 1] : T[k - 1];
      const prevDir = Math.abs(q.r[0] - q.l[0]) > 1e-6 && Math.abs(q.r[1] - q.l[1]) < 1e-6 ? 'h' : Math.abs(q.r[1] - q.l[1]) > 1e-6 && Math.abs(q.r[0] - q.l[0]) < 1e-6 ? 'v' : 'turn';
      const mine = p.rot % 180 ? 'v' : 'h';
      if (prevDir !== 'turn') assert.notEqual(mine, prevDir, `${label}: the double at ${k} lies crosswise to the line before it`);
    }
  }
  if (n) {
    const b = L.box;
    assert.ok(near(b.w, V.TABLE.w) && near(b.x, V.TABLE.x), `${label}: the felt always the run's width`);
    assert.ok(b.h >= V.TABLE.minH - 1e-6 && Number.isInteger(b.h) && Number.isInteger(b.y * 2), `${label}: whole rows (${b.y}, ${b.h})`);
    assert.ok(b.h <= L.span.y1 - L.span.y0 + 2 * V.DOML.margin + 2 + 1e-6 || near(b.h, V.TABLE.minH), `${label}: no taller than the line needs`);
  }
  return L;
}

test('Dominoes layout: the first tiles lie end to end on the anchor row, a double crosswise, a tile fitting an end turned to meet it, the line growing both ways from the first tile', () => {
  const T = V.TABLE, box0 = { x: -1, y: -3, w: 12, h: 6 };
  assert.deepEqual(T, { x: -1, w: 12, minH: 6 });
  assert.deepEqual(V.domLayout([], 0).tiles, []); assert.deepEqual(V.domLayout([], 0).box, box0);
  const one = check([[2, 5, 'X']], 0, 'one');
  assert.deepEqual([one.tiles[0].x, one.tiles[0].y, one.tiles[0].rot], [5, 0, 0], 'the first tile from the anchor, its a half on the left');
  assert.deepEqual(one.tiles[0].l, [4, 0]); assert.deepEqual(one.tiles[0].r, [6, 0]);
  const dbl = check([[3, 3, 'X']], 0, 'double');
  assert.deepEqual([dbl.tiles[0].x, dbl.tiles[0].y, dbl.tiles[0].rot], [4.5, 0, 90], 'a double first: crosswise, one unit along the row');
  // 6-2 on the left (its 2 meeting the line's 2), 2-5 the first tile, 5-5 crosswise, 5-1 after it
  const L = check([[6, 2, 'O'], [2, 5, 'X'], [5, 5, 'O'], [5, 1, 'X']], 1, 'four');
  assert.deepEqual(L.tiles.map(p => [p.x, p.y, p.rot]), [[3, 0, 0], [5, 0, 0], [6.5, 0, 90], [8, 0, 0]]);
  assert.deepEqual(L.tiles[0].ha, [2.5, 0], 'the 6 on the left half'); assert.deepEqual(L.tiles[0].hb, [3.5, 0]);
  assert.deepEqual(L.box, box0, 'the felt as it is: three rows about the anchor row');
  // a tile laid on the left end carries its right value towards the line (a 4-6 laid as 4-6 on a 6 end)
  const L2 = check([[4, 6, 'X'], [6, 2, 'O'], [2, 5, 'X']], 2, 'left two');
  assert.deepEqual(L2.tiles.map(p => [p.x, p.rot]), [[1, 0], [3, 0], [5, 0]]);
});

test('Dominoes layout: the line turns at the run\'s edge with the tile that would cross it, runs back along the next row, and a double at a corner lies as the corner tile would, the line continuing from its end', () => {
  // five non-doubles fill the run (x 4..10 then the left part 4..0); the sixth to the right turns down the corner column
  const row = [[0, 1, 'X'], [1, 2, 'O'], [2, 3, 'X'], [3, 4, 'O'], [4, 5, 'X'], [5, 6, 'O'], [6, 0, 'X'], [0, 2, 'O']];
  const L = check(row, 0, 'corner');
  const P = L.tiles.map(p => [p.x, p.y, p.rot]);
  assert.deepEqual(P.slice(0, 3), [[5, 0, 0], [7, 0, 0], [9, 0, 0]], 'the run to x = 10');
  assert.deepEqual(P[3], [10.5, 0.5, 90], 'the fourth would cross the edge: it turns down the corner column, its 3 beside the row\'s 3');
  assert.deepEqual(P[4], [10, 2, 180], 'the next runs back along the row below, from under the corner tile');
  assert.deepEqual(P.slice(5), [[8, 2, 180], [6, 2, 180], [4, 2, 180]]);
  // a double where the run is full: it lies as the corner tile would (crosswise to the row), and the line goes on from its end
  const dblCorner = [[0, 1, 'X'], [1, 2, 'O'], [2, 3, 'X'], [3, 3, 'O'], [3, 4, 'X'], [4, 5, 'O']];
  const D = check(dblCorner, 0, 'double corner');
  const Q = D.tiles.map(p => [p.x, p.y, p.rot]);
  assert.deepEqual(Q[3], [10.5, 0.5, 90], 'the double at the corner: vertical, its upper half beside the row\'s last half');
  assert.deepEqual(Q[4], [10, 2, 180], 'the line continues from its end into the row below');
  assert.deepEqual(Q[5], [8, 2, 180]);
  // a double with one unit left in the run lies crosswise in the run (it needs one); the next tile turns from the run's end
  const dblFit = [[0, 0, 'X'], [0, 1, 'O'], [1, 2, 'X'], [2, 2, 'O'], [2, 3, 'X'], [3, 4, 'O']];
  const F = check(dblFit, 0, 'double fits');
  assert.deepEqual(F.tiles.map(p => [p.x, p.y, p.rot]), [[4.5, 0, 90], [6, 0, 0], [8, 0, 0], [9.5, 0, 90], [10.5, 0.5, 90], [10, 2, 180]]);
  // the left part turns up at the left edge the same way, the rows above running right
  const leftRun = [[6, 0, 'O'], [0, 5, 'X'], [5, 4, 'O'], [4, 3, 'X'], [3, 2, 'O'], [2, 1, 'X'], [1, 1, 'O']];
  const G = check(leftRun, 6, 'left corner');
  assert.deepEqual(G.tiles.map(p => [p.x, p.y, p.rot]), [[4, -2, 180], [2, -2, 180], [0, -2, 180], [-0.5, -0.5, 90], [1, 0, 0], [3, 0, 0], [4.5, 0, 90]], 'the double first; three tiles leftward; the fourth turns up the left corner column; the row above runs right');
});

test('Dominoes layout: 200 random lines from legal play (every tile of the set at times) hold every invariant; a line past the felt grows it about the line, its shape kept, and the longest line still fits', () => {
  let corners = 0, dblCorners = 0, grown = 0, longest = 0;
  for (let g = 0; g < 200; g++) {
    const rng = lcg(1000 + g), m = E.newMini('dominoes', E.makeRng('dl' + g));
    if (g % 4 === 0) { m.hands.X = m.pile.splice(0, 11); m.hands.O = m.pile.splice(0, 11); }   // big hands: the line can take the whole set
    let p = 'X';
    for (let k = 0; k < 200; k++) {
      const mv = E.randomLegalMove(m, p, rng); if (mv == null) break;
      const r = E.applyMove(m, p, mv, rng); assert.ok(r.ok, JSON.stringify([mv, r]));
      if (m.line.length) {
        const L = check(m.line, m.left || 0, `game ${g} move ${k}`);
        if (L.box.h > V.TABLE.minH + 1e-6) grown++;
        longest = Math.max(longest, m.line.length);
      }
      if (r.outcome !== 'continue') break;
      if (!r.again) p = p === 'X' ? 'O' : 'X';
    }
    const L = V.domLayout(m.line, m.left || 0);
    for (let k = 1; k < L.tiles.length; k++) { const q = L.tiles[k - 1], t = L.tiles[k]; if (q.rot % 180 === 0 && t.rot % 180 !== 0 && Math.abs(t.y - q.y) > 1e-6) { corners++; if (t.dbl) dblCorners++; } }
  }
  assert.ok(longest >= 20, `long lines seen: ${longest}`);
  assert.ok(corners >= 40, `corners seen: ${corners}`); assert.ok(dblCorners >= 1, `doubles at a corner seen: ${dblCorners}`);
  // the longest line a double-six set can make, all one way: it reaches past the felt, which grows to hold it (its shape kept), the tiles scaled down together
  const all = []; let v = 0;
  for (let k = 0; k < 28; k++) { all.push([v, (v + 1) % 7, 'X']); v = (v + 1) % 7; }   // 28 tiles chained 0-1, 1-2, ...: never a double
  const L = check(all, 0, 'all right');
  assert.deepEqual(L.box, { x: -1, y: -1, w: 12, h: 11 }, 'the felt grown to the line\'s five rows (the anchor row and four below)');
  const Lb = check(all, 14, 'both ways'); assert.deepEqual(Lb.box, { x: -1, y: -5, w: 12, h: 10 }, 'grown both ways from the middle: five rows, two above and two below');
  // the felt moves a row before it grows: a line two rows down keeps three rows, the felt slid down one
  const two = all.slice(0, 11); const L2 = check(two, 0, 'two rows down');
  assert.deepEqual(L2.box, { x: -1, y: -1, w: 12, h: 6 }, 'rows 0, 2 and 4: the felt slid down a row, still six tall');
  assert.deepEqual(check(all.slice(0, 5), 0, 'one row down').box, { x: -1, y: -3, w: 12, h: 6 }, 'rows 0 and 2: the felt as it began');
  // at 360x640 the table's room is about 269 x 250 px: a tile of the longest line's felt is still over 40 px long
  assert.ok(Math.min(269 / L.box.w, 250 / L.box.h) * 2 > 40, `a tile ${(Math.min(269 / L.box.w, 250 / L.box.h) * 2).toFixed(1)} px long`);
  assert.ok(grown > 0, `lines past three rows seen: ${grown} renders`);
});

test('Dominoes draws: the tiles come one at a time, DOMT.draw apart (a long draw squeezed into drawAll), the flash holding until the last has landed; the view slides each in at its moment and the sounds come once each', () => {
  const T = R.DOMT;
  assert.ok(T.draw >= 250 && T.draw <= 350, 'a tile every 250 to 350 ms'); assert.ok(T.drawSlide < T.draw, 'each slide done before the next');
  for (const n of [1, 2, 3, 6, 7, 12, 22]) {
    const lands = R.domDrawTimes(n);
    assert.equal(lands.length, n);
    for (let k = 1; k < n; k++) { assert.ok(lands[k] - lands[k - 1] >= 100 && lands[k] - lands[k - 1] <= T.draw, `${n}: ${lands[k] - lands[k - 1]} apart`); }
    assert.ok(lands[n - 1] <= (n <= 6 ? T.draw * n : Math.max(T.drawAll, 100 * n)) + 1e-6, `${n} tiles in ${lands[n - 1]} ms`);
    const f = { dom: { by: 'X', kind: 'draw', drew: n, fits: true, left: 3 + n, pile: 22 - n } };
    assert.ok(R.flashMs(f, 4, false) >= lands[n - 1] + 200, 'flashMs covers the last landing and a hold');
    assert.equal(R.domTimes(f.dom).land, lands[n - 1]); assert.deepEqual(R.domTimes(f.dom).lands, lands);
    const snd = []; V.sounds(f, (s, t) => snd.push([s, t]), false, null, null);
    assert.equal(snd.filter(s => s[0] === 'cardSlide').length, n, 'a slide for each tile');
    const dsl = Math.min(T.drawSlide, lands[0]);
    assert.deepEqual(snd.filter(s => s[0] === 'cardSlide').map(s => s[1]), lands.map(l => l - dsl), 'each slide starting so it lands on its moment (a long draw\'s slides shorter)');
    assert.deepEqual(snd[snd.length - 1], ['domClick', lands[n - 1] + 60], 'the last one fits: a click as it lands');
  }
  assert.equal(V.moveText({ dom: { kind: 'draw', drew: 4 } }, 'Sam'), 'Sam drew 4 tiles', 'the flash says how many came');
});
