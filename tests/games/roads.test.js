'use strict';
// Roads: its rules and AI, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;

/* ===================================== Roads ===================================== */
// The first tests play an older square's 4x4 grid (24 lines; it plays on as it was); the honeycomb's follow.
const G = E.ROAD_LAYOUTS.grid;
const H = (r, c) => r * 3 + c, V = (r, c) => 12 + r * 4 + c;      // a line across from dot (r,c); a line down from it
const segsOf = (p, ks) => { const s = new Array(24).fill(null); for (const k of ks) s[k] = p; return s; };

test('roads: the longest trail, against cases checked by hand (an older square\'s grid)', () => {
  assert.equal(G.segs.length, 24);
  const L = ks => E.roadLongest(segsOf('X', ks), 'X').len;
  assert.equal(L([]), 0);
  assert.equal(L([H(0, 0), H(0, 1), H(0, 2)]), 3, 'a straight row of three');
  assert.equal(L([H(1, 0), H(1, 1), V(1, 1)]), 2, 'a T: three lines at one dot, only two in one trail');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1)]), 4, 'a square: all the way round');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(1, 1), H(2, 1), V(1, 1), V(1, 2)]), 8, 'two squares meeting at a corner: through the corner twice');
  assert.equal(L([H(1, 0), H(1, 1), V(0, 1), V(1, 1)]), 2, 'a plus: two arms');
  assert.equal(L([H(0, 0), H(0, 1), V(1, 0), V(2, 0), H(3, 0), V(2, 1)]), 4, 'apart: the longer piece (a U of four)');
  assert.equal(L([H(0, 0), H(0, 1), H(3, 0), H(3, 1), V(2, 0), V(2, 1)]), 3, 'a fork at the bottom: one branch only');
  assert.equal(L([H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(0, 1)]), 5, 'a square with a tail: round it and off');
  assert.equal(L([H(0, 0), H(0, 1), H(0, 2), V(0, 3), V(1, 3), V(2, 3), H(3, 2), H(3, 1), H(3, 0), V(2, 0), V(1, 0), V(0, 0)]), 12, 'the whole rim');
  // the lines of the trail, in order, each one joined to the next
  const t = E.roadLongest(segsOf('X', [H(0, 0), H(1, 0), V(0, 0), V(0, 1), H(0, 1)]), 'X');
  for (let k = 1; k < t.segs.length; k++) { const a = G.segs[t.segs[k - 1]], b = G.segs[t.segs[k]]; assert.ok(a.some(v => b.includes(v)), 'a joined trail'); }
  // against a brute force over every order of the lines, on random sets
  const brute = ks => { let best = 0; const used = new Set(); const go = (v, n) => { best = Math.max(best, n); for (const k of ks) { if (used.has(k)) continue; const [a, b] = G.segs[k]; if (v != null && a !== v && b !== v) continue; used.add(k); if (v == null) { go(a, n + 1); go(b, n + 1); } else go(a === v ? b : a, n + 1); used.delete(k); } }; go(null, 0); return best; };
  const rng = lcg(9);
  for (let k = 0; k < 300; k++) {
    const ks = Array.from({ length: 24 }, (_, i) => i).filter(() => rng() < 0.3).slice(0, 8);
    assert.equal(L(ks), brute(ks), `lines ${ks}`);
  }
});

test('roads: a line, then a random open line blocked; once none is open, the longer road wins and a tie resets', () => {
  const m = E.newMini('roads', lcg(1));
  E.applyMove(m, 'X', 0, lcg(2));
  assert.equal(m.segs[0], 'X'); assert.ok(m.last.block != null && m.segs[m.last.block] === 'B' && m.last.block !== 0);
  assert.equal(E.applyMove(m, 'O', 0).ok, false); assert.equal(E.applyMove(m, 'O', m.last.block).ok, false, 'a blocked line is not a move');
  const end = E.newMini('roads', lcg(3));
  end.segs = new Array(24).fill('B'); for (const k of [H(0, 0), H(0, 1), H(0, 2)]) end.segs[k] = 'X'; for (const k of [H(3, 0), H(3, 1)]) end.segs[k] = 'O'; end.segs[V(2, 0)] = null;
  assert.deepEqual(E.applyMove(end, 'O', V(2, 0), lcg(4)), { ok: true, outcome: 'draw', note: 'tie' }, '3 and 3: a tie');
  const win = E.newMini('roads', lcg(5));
  win.segs = new Array(24).fill('B'); for (const k of [H(0, 0), H(0, 1), H(0, 2)]) win.segs[k] = 'X'; win.segs[H(3, 0)] = 'O'; win.segs[V(2, 3)] = null;
  assert.deepEqual(E.applyMove(win, 'O', V(2, 3), lcg(6)), { ok: true, outcome: 'win', note: 'full', winner: 'X', counts: { X: 3, O: 1 } });
});

test('roads: the computer lengthens its own road and takes the line the other player wants most', () => {
  const s = new Array(24).fill(null); s[H(0, 0)] = 'X'; s[H(0, 1)] = 'X';
  const ext = E.roadPick({ type: 'roads', segs: s }, 'X', null);
  assert.ok([H(0, 2), V(0, 0), V(0, 1), V(0, 2)].includes(ext.k) && E.roadLongest(ext.after, 'X').len === 3, 'it lengthens its road');
  const t = new Array(24).fill('B'); t[H(1, 0)] = 'O'; t[H(1, 1)] = 'O'; t[H(1, 2)] = null; t[H(3, 2)] = null;
  assert.equal(E.roadPick({ type: 'roads', segs: t }, 'X', null).k, H(1, 2), 'it cuts off the other player\'s best extension');
});

// ---- the honeycomb ----
const HX = E.ROAD_LAYOUTS.hex7;
const cellEdges = (L, c) => { const ring = L.cells[c]; return ring.map((v, i) => { const a = Math.min(v, ring[(i + 1) % 6]), b = Math.max(v, ring[(i + 1) % 6]); return L.segs.findIndex(e => e[0] === a && e[1] === b); }); };
test('roads: a honeycomb of 7 hexagons, 24 corners and 30 edges (the smaller option: 4 hexagons, 16 and 19)', () => {
  assert.deepEqual([HX.pts.length, HX.segs.length, HX.cells.length], [24, 30, 7]);
  assert.deepEqual([E.ROAD_LAYOUTS.hex4.pts.length, E.ROAD_LAYOUTS.hex4.segs.length, E.ROAD_LAYOUTS.hex4.cells.length], [16, 19, 4]);
  const deg = new Array(24).fill(0); for (const [a, b] of HX.segs) { deg[a]++; deg[b]++; }
  assert.deepEqual([...new Set(deg)].sort(), [2, 3], 'every corner on 2 or 3 edges');
  assert.equal(deg.filter(d => d === 3).length, 12, 'the 12 corners where hexagons meet');
  for (let c = 0; c < 7; c++) assert.ok(cellEdges(HX, c).every(k => k >= 0), 'each hexagon\'s six edges are roads');
  const share = c => cellEdges(HX, c).filter(k => [0, 1, 2, 3, 4, 5, 6].some(d => d !== c && cellEdges(HX, d).includes(k))).length;
  assert.equal(share(0), 6, 'the middle hexagon shares every edge');
  for (let c = 1; c < 7; c++) assert.equal(share(c), 3, 'a ring hexagon shares three');
  for (const [x, y] of HX.pts) assert.ok(x >= 7 && x <= 93 && y >= 7 && y <= 93, 'inside the field');
  E.setRoadsConfig(null); assert.equal(E.newMini('roads', lcg(1)).segs.length, 30, 'a new square: 7 hexagons');
  E.setRoadsConfig({ layout: 'hex4' }); assert.equal(E.newMini('roads', lcg(1)).segs.length, 19, 'the admin\'s smaller one');
  E.setRoadsConfig({ layout: 'nope' }); assert.equal(E.newMini('roads', lcg(1)).segs.length, 30);
  E.setRoadsConfig(null);
  assert.equal(E.roadGeom(new Array(24).fill(null)), E.ROAD_LAYOUTS.grid, 'an older square: the grid');
});

test('roads: the longest trail on the honeycomb, by hand and against a brute force', () => {
  const segs = ks => { const s = new Array(30).fill(null); for (const k of ks) s[k] = 'X'; return s; };
  const L = ks => E.roadLongest(segs(ks), 'X').len;
  const middle = cellEdges(HX, 0), ring = cellEdges(HX, 1);
  assert.equal(L(middle), 6, 'one hexagon: all the way round');
  const two = [...new Set(middle.concat(ring))];
  assert.equal(two.length, 11);
  assert.equal(L(two), 11, 'two hexagons side by side: every edge in one trail (only the shared edge\'s ends are forks)');
  const rim = HX.segs.map((e, k) => k).filter(k => [0, 1, 2, 3, 4, 5, 6].filter(c => cellEdges(HX, c).includes(k)).length === 1);   // the edges of one hexagon only: the outside
  assert.equal(rim.length, 18); assert.equal(L(rim), 18, 'the outside rim: once round');
  assert.equal(L(middle.slice(0, 3)), 3, 'three edges of one hexagon in a row');
  const brute = ks => { let best = 0; const used = new Set(); const go = (v, n) => { best = Math.max(best, n); for (const k of ks) { if (used.has(k)) continue; const [a, b] = HX.segs[k]; if (v != null && a !== v && b !== v) continue; used.add(k); if (v == null) { go(a, n + 1); go(b, n + 1); } else go(a === v ? b : a, n + 1); used.delete(k); } }; go(null, 0); return best; };
  const rng = lcg(11);
  for (let k = 0; k < 300; k++) {
    const ks = Array.from({ length: 30 }, (_, i) => i).filter(() => rng() < 0.3).slice(0, 9);
    assert.equal(L(ks), brute(ks), `edges ${ks}`);
  }
  // a trail's edges, in order, each joined to the next
  const t = E.roadLongest(segs(two), 'X');
  for (let k = 1; k < t.segs.length; k++) { const a = HX.segs[t.segs[k - 1]], b = HX.segs[t.segs[k]]; assert.ok(a.some(v => b.includes(v))); }
});

test('roads: on the honeycomb, the computer against itself: 15 moves (7.5 each) on 7 hexagons, 10 (5 each) on 4; the longer road wins, a tie resets', () => {
  const avg = {};
  for (const layout of ['hex7', 'hex4']) {
    E.setRoadsConfig({ layout });
    let moves = 0, games = 0, ties = 0, firstWins = 0, decided = 0;
    for (let g = 0; g < 200; g++) {
      const rng = lcg(100 + g), m = E.newMini('roads', rng);
      let p = g % 2 ? 'O' : 'X', first = p, r, n = 0;
      do { r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng).move, rng); assert.equal(r.ok, true); n++; p = p === 'X' ? 'O' : 'X'; } while (r.outcome === 'continue');
      const x = E.roadLongest(m.segs, 'X').len, o = E.roadLongest(m.segs, 'O').len;
      if (r.outcome === 'draw') { ties++; assert.equal(x, o); } else { decided++; assert.equal(r.winner, x > o ? 'X' : 'O'); if (r.winner === first) firstWins++; }
      moves += n; games++;
    }
    avg[layout] = { perPlayer: moves / games / 2, ties: ties / games, firstWins: firstWins / Math.max(1, decided) };
  }
  E.setRoadsConfig(null);
  assert.equal(avg.hex7.perPlayer, 7.5);
  assert.equal(avg.hex4.perPlayer, 5);
  console.log('# roads AI vs AI:', JSON.stringify(avg));
});
